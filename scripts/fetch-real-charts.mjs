// Downloads real daily price history and saves random 90-day windows to
// src/data/realCharts.json, so the app needs no API key or network at runtime.
//
// Data source: Yahoo Finance's public chart endpoint
//   https://query1.finance.yahoo.com/v8/finance/chart/<TICKER>?range=15y&interval=1d
// It needs no API key. It's unofficial, so it can change without notice, and
// the data is for personal, educational use.
//
// Run it with:  npm run fetch-charts

import { mkdir, writeFile } from 'node:fs/promises'

// Well-known US stocks and funds, with the name to reveal after the trade.
const TICKERS = [
  ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['AMZN', 'Amazon'], ['GOOGL', 'Alphabet'], ['META', 'Meta Platforms'],
  ['NVDA', 'Nvidia'], ['TSLA', 'Tesla'], ['NFLX', 'Netflix'], ['AMD', 'AMD'], ['INTC', 'Intel'],
  ['CSCO', 'Cisco'], ['ORCL', 'Oracle'], ['IBM', 'IBM'], ['ADBE', 'Adobe'], ['CRM', 'Salesforce'],
  ['JPM', 'JPMorgan Chase'], ['BAC', 'Bank of America'], ['WFC', 'Wells Fargo'], ['GS', 'Goldman Sachs'], ['V', 'Visa'],
  ['MA', 'Mastercard'], ['WMT', 'Walmart'], ['COST', 'Costco'], ['HD', 'Home Depot'], ['LOW', "Lowe's"],
  ['KO', 'Coca-Cola'], ['PEP', 'PepsiCo'], ['MCD', "McDonald's"], ['SBUX', 'Starbucks'], ['NKE', 'Nike'],
  ['DIS', 'Disney'], ['BA', 'Boeing'], ['CAT', 'Caterpillar'], ['GE', 'GE Aerospace'], ['XOM', 'ExxonMobil'],
  ['CVX', 'Chevron'], ['PFE', 'Pfizer'], ['JNJ', 'Johnson & Johnson'], ['MRK', 'Merck'], ['UNH', 'UnitedHealth'],
  ['T', 'AT&T'], ['VZ', 'Verizon'], ['F', 'Ford'], ['SPY', 'S&P 500 ETF'], ['QQQ', 'Nasdaq-100 ETF'],
]

const WINDOW = 90 // 60 candles to decide on + 30 to replay

// Well-known moves, by the last trading day before them: each becomes a
// window whose replay starts with the move. The dates are all this list
// claims; nothing about why is shown in the app.
const FAMOUS = [
  ['AAPL', '2019-01-02'], ['META', '2022-02-02'], ['NFLX', '2022-04-19'], ['NVDA', '2023-05-24'],
  ['SPY', '2020-02-21'], ['TSLA', '2020-08-11'], ['BA', '2019-03-08'], ['DIS', '2019-04-11'],
  ['INTC', '2024-08-01'], ['PFE', '2020-11-06'], ['AMZN', '2022-04-28'], ['GOOGL', '2023-02-07'],
  ['QQQ', '2022-11-09'], ['CRM', '2024-05-29'], ['NKE', '2024-06-27'],
]
const PER_TICKER = 6 // windows saved per ticker
const YEARS = 15
const PAUSE_MS = 1200 // wait between requests, to be polite to the server

// A seeded random number generator (mulberry32), so re-running the script
// picks the same windows as long as the data hasn't changed.
function makeRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const round = (n) => Math.round(n * 100) / 100
const isoDate = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10)

async function fetchDaily(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${YEARS}y&interval=1d`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const json = await response.json()
  const result = json.chart?.result?.[0]
  const quote = result?.indicators?.quote?.[0]
  if (!result?.timestamp || !quote) throw new Error('unexpected response')

  // One row per trading day; skip days with missing numbers.
  const rows = []
  result.timestamp.forEach((time, i) => {
    const [open, high, low, close] = [quote.open[i], quote.high[i], quote.low[i], quote.close[i]]
    if (![open, high, low, close].every((v) => typeof v === 'number' && v > 0)) return
    const volume = typeof quote.volume?.[i] === 'number' ? quote.volume[i] : 0
    // Occasionally the high/low don't quite contain the open/close; fix that.
    rows.push({ time, open, close, high: Math.max(high, open, close), low: Math.min(low, open, close), volume })
  })
  return rows
}

// A window is usable if every day is there and nothing looks broken: no
// one-day jumps over 25% (usually an unadjusted stock split) and hardly any
// days where the price didn't move at all. We also skip prices under $5:
// after split adjustments some old prices are pennies, and rounding to the
// cent would make those charts blocky.
function usable(rows) {
  if (rows.some((r) => r.low < 5)) return false
  let flatDays = 0
  for (let i = 1; i < rows.length; i++) {
    if (Math.abs(rows[i].open / rows[i - 1].close - 1) > 0.25) return false
    if (Math.abs(rows[i].close / rows[i - 1].close - 1) > 0.25) return false
    if (rows[i].high === rows[i].low) flatDays += 1
  }
  return flatDays <= 2
}

function pickWindows(rows, rng, taken = []) {
  const windows = []
  for (let attempt = 0; attempt < 200 && windows.length < PER_TICKER; attempt++) {
    const start = Math.floor(rng() * (rows.length - WINDOW))
    if (taken.some((s) => Math.abs(s - start) < WINDOW)) continue // no overlapping windows
    const slice = rows.slice(start, start + WINDOW)
    if (!usable(slice)) continue
    taken.push(start)
    windows.push(slice)
  }
  return windows
}

// The famous window for a ticker: 60 days up to the decision day, then 30 more.
// Big one-day moves are the point here, so only the price floor is checked.
function famousWindows(ticker, rows) {
  return FAMOUS.filter(([t]) => t === ticker).flatMap(([, decision]) => {
    let end = -1
    rows.forEach((r, i) => {
      if (isoDate(r.time) <= decision) end = i
    })
    const start = end - 59
    const slice = rows.slice(start, start + WINDOW)
    return start >= 0 && slice.length === WINDOW && slice.every((r) => r.low >= 5) ? [{ start, slice }] : []
  })
}

const toWindow = (ticker, name, w, famous) => ({
  ticker,
  name,
  from: isoDate(w[0].time), // first candle you see
  decision: isoDate(w[59].time), // the day you decide
  to: isoDate(w[w.length - 1].time), // last replay candle
  ...(famous ? { famous: true } : {}),
  bars: w.map((r) => [round(r.open), round(r.high), round(r.low), round(r.close), Math.round(r.volume)]), // volume in shares
})

async function main() {
  const rng = makeRng(20240101)
  const out = []
  for (const [ticker, name] of TICKERS) {
    try {
      const rows = await fetchDaily(ticker)
      const famous = famousWindows(ticker, rows)
      const windows = pickWindows(rows, rng, famous.map((f) => f.start))
      for (const f of famous) out.push(toWindow(ticker, name, f.slice, true))
      for (const w of windows) out.push(toWindow(ticker, name, w, false))
      console.log(`${ticker.padEnd(6)} ${rows.length} days, ${windows.length} windows${famous.length ? ` + ${famous.length} famous` : ''}`)
    } catch (error) {
      console.warn(`${ticker.padEnd(6)} skipped: ${error.message}`)
    }
    await sleep(PAUSE_MS)
  }

  await mkdir(new URL('../src/data/', import.meta.url), { recursive: true })
  await writeFile(new URL('../src/data/realCharts.json', import.meta.url), JSON.stringify(out))
  console.log(`\nSaved ${out.length} windows from ${new Set(out.map((w) => w.ticker)).size} tickers to src/data/realCharts.json`)
}

main()
