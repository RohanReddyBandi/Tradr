// Downloads real daily price history and saves 90-day windows of it to
// src/data/historicalCharts.json, which the app bundles (so it needs no API
// key or network at runtime).
//
// Data source: Quandl's "WIKI Prices", on Nasdaq Data Link. Nasdaq describes it
// as end-of-day prices for about 3,000 US companies, "curated by the Quandl
// community and released into the public domain", so the file can live in
// the repo and ship with the site. It stopped updating in March 2018, so every
// chart is from 1996 to early 2018.
//   https://data.nasdaq.com/databases/WIKIP
//
// Downloading it needs a free Nasdaq Data Link API key. Put yours in a file
// called .env.local next to package.json (Git ignores it):
//   NASDAQ_DATA_LINK_API_KEY=your-key-here
// then run:  npm run fetch-charts
// The key is only sent to Nasdaq; it is never printed or saved anywhere else.

import { mkdir, readFile, writeFile } from 'node:fs/promises'

// Well-known US companies, with the name to reveal after the trade.
const TICKERS = [
  ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['AMZN', 'Amazon'], ['GOOGL', 'Alphabet'], ['FB', 'Facebook (now Meta)'],
  ['NVDA', 'Nvidia'], ['TSLA', 'Tesla'], ['NFLX', 'Netflix'], ['AMD', 'AMD'], ['INTC', 'Intel'],
  ['CSCO', 'Cisco'], ['ORCL', 'Oracle'], ['IBM', 'IBM'], ['ADBE', 'Adobe'], ['CRM', 'Salesforce'],
  ['JPM', 'JPMorgan Chase'], ['BAC', 'Bank of America'], ['WFC', 'Wells Fargo'], ['GS', 'Goldman Sachs'], ['V', 'Visa'],
  ['MA', 'Mastercard'], ['WMT', 'Walmart'], ['COST', 'Costco'], ['HD', 'Home Depot'], ['LOW', "Lowe's"],
  ['KO', 'Coca-Cola'], ['PEP', 'PepsiCo'], ['MCD', "McDonald's"], ['SBUX', 'Starbucks'], ['NKE', 'Nike'],
  ['DIS', 'Disney'], ['BA', 'Boeing'], ['CAT', 'Caterpillar'], ['GE', 'General Electric'], ['XOM', 'ExxonMobil'],
  ['CVX', 'Chevron'], ['PFE', 'Pfizer'], ['JNJ', 'Johnson & Johnson'], ['MRK', 'Merck'], ['UNH', 'UnitedHealth'],
  ['T', 'AT&T'], ['VZ', 'Verizon'], ['F', 'Ford'], ['EBAY', 'eBay'], ['QCOM', 'Qualcomm'],
]

// Well-known one-day moves, by the last trading day before them: each becomes
// a window whose replay starts with the move. The dates are all this list
// claims, and each is checked against the data (a day that didn't move at
// least MIN_FAMOUS_MOVE is reported and skipped).
const FAMOUS = [
  ['MSFT', '2000-03-31'], ['INTC', '2000-09-21'], ['MRK', '2004-09-29'], ['AAPL', '2008-09-26'],
  ['BAC', '2011-08-05'], ['NFLX', '2011-10-24'], ['JPM', '2012-05-10'], ['FB', '2012-07-26'],
  ['AAPL', '2013-01-23'], ['NFLX', '2013-01-23'], ['TSLA', '2013-05-08'], ['FB', '2013-07-24'],
  ['AMZN', '2015-07-23'], ['DIS', '2015-08-04'], ['WMT', '2015-10-13'], ['NVDA', '2016-11-10'],
  ['GE', '2017-11-10'],
]
const MIN_FAMOUS_MOVE = 0.04

const FROM = '1996-01-01'
const WINDOW = 90 // 60 candles to decide on + 30 to replay
const PER_TICKER = 6 // random windows saved per ticker
const PAUSE_MS = 400 // wait between requests, to be polite to the server
const API = 'https://data.nasdaq.com/api/v3/datatables/WIKI/PRICES.json'

// A seeded random number generator (mulberry32), so re-running the script
// picks the same windows.
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

// The API key: from the environment, or from .env.local.
async function apiKey() {
  if (process.env.NASDAQ_DATA_LINK_API_KEY) return process.env.NASDAQ_DATA_LINK_API_KEY.trim()
  try {
    const text = await readFile(new URL('../.env.local', import.meta.url), 'utf8')
    const line = text.split('\n').find((l) => l.trim().startsWith('NASDAQ_DATA_LINK_API_KEY='))
    return line ? line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : null
  } catch {
    return null
  }
}

// Every adjusted daily bar for a ticker since FROM, oldest first. Adjusted
// prices account for splits and dividends, so a split doesn't look like a crash.
async function fetchDaily(ticker, key) {
  const rows = []
  let cursor = null
  do {
    const params = new URLSearchParams({
      ticker,
      'date.gte': FROM,
      'qopts.columns': 'date,adj_open,adj_high,adj_low,adj_close,adj_volume',
      api_key: key,
    })
    if (cursor) params.set('qopts.cursor_id', cursor)
    const response = await fetch(`${API}?${params}`)
    // Errors name the status only: the request URL holds the key.
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json()
    for (const [date, open, high, low, close, volume] of json.datatable?.data ?? []) {
      // Keep only well-formed rows: a YYYY-MM-DD date and real, positive prices.
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      if (![open, high, low, close].every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)) continue
      rows.push({ date, open, close, high: Math.max(high, open, close), low: Math.min(low, open, close), volume: Number.isFinite(volume) && volume > 0 ? volume : 0 })
    }
    cursor = json.meta?.next_cursor_id ?? null
  } while (cursor)
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 86_400_000

// A window is usable if nothing looks broken: no missing stretch of days (a
// gap over 5 calendar days is more than a long weekend), no one-day jumps over
// 25% (usually a bad split adjustment), hardly any days where the price didn't
// move, and no prices under $5 (rounded to the cent, those charts look blocky).
function usable(rows, checkJumps = true) {
  if (rows.some((r) => r.low < 5)) return false
  let flatDays = 0
  for (let i = 1; i < rows.length; i++) {
    if (days(rows[i - 1].date, rows[i].date) > 5) return false
    if (checkJumps && Math.abs(rows[i].open / rows[i - 1].close - 1) > 0.25) return false
    if (checkJumps && Math.abs(rows[i].close / rows[i - 1].close - 1) > 0.25) return false
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

// The famous windows for a ticker: 60 days up to the decision day, then 30
// more. Big one-day moves are the point, so jumps aren't held against them.
function famousWindows(ticker, rows) {
  return FAMOUS.filter(([t]) => t === ticker).flatMap(([, decision]) => {
    const end = rows.findLastIndex((r) => r.date <= decision)
    const start = end - 59
    const slice = rows.slice(start, start + WINDOW)
    if (start < 0 || slice.length < WINDOW || !usable(slice, false)) {
      console.warn(`  ${ticker} ${decision}: no clean window, skipped`)
      return []
    }
    const move = slice[60].close / slice[59].close - 1
    if (Math.abs(move) < MIN_FAMOUS_MOVE) {
      console.warn(`  ${ticker} ${decision}: the next day only moved ${(move * 100).toFixed(1)}%, skipped`)
      return []
    }
    return [{ start, slice }]
  })
}

const toWindow = (ticker, name, w, famous) => ({
  ticker,
  name,
  from: w[0].date, // first candle you see
  decision: w[59].date, // the day you decide
  to: w[w.length - 1].date, // last replay candle
  ...(famous ? { famous: true } : {}),
  bars: w.map((r) => [round(r.open), round(r.high), round(r.low), round(r.close), Math.round(r.volume)]), // volume in shares
})

async function main() {
  const key = await apiKey()
  if (!key) {
    console.error('No API key. Put NASDAQ_DATA_LINK_API_KEY=... in .env.local (see the top of this script).')
    process.exit(1)
  }
  const rng = makeRng(20240101)
  const out = []
  for (const [ticker, name] of TICKERS) {
    try {
      const rows = await fetchDaily(ticker, key)
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
  if (out.length === 0) {
    console.error('Nothing downloaded, so the existing file was left alone. Is the API key right?')
    process.exit(1)
  }

  const meta = {
    source: 'Quandl WIKI Prices via Nasdaq Data Link (https://data.nasdaq.com/databases/WIKIP), released into the public domain',
    adjusted: 'split- and dividend-adjusted',
  }
  await mkdir(new URL('../src/data/', import.meta.url), { recursive: true })
  await writeFile(new URL('../src/data/historicalCharts.json', import.meta.url), JSON.stringify({ meta, windows: out }))
  console.log(`\nSaved ${out.length} windows from ${new Set(out.map((w) => w.ticker)).size} tickers to src/data/historicalCharts.json`)
}

main()
