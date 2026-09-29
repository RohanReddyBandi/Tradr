import type { Bias, Candle, ChartCard } from '../types'
import { findChartPatterns, pickChartPatterns, toFinding, type PatternFamily } from './chartPatterns'
import { findSignalPatterns } from './candlePatterns'
import { VISIBLE_CANDLES } from './generator'

// Real price history, saved by scripts/fetch-real-charts.mjs.
export interface RealWindow {
  ticker: string
  name: string
  from: string
  decision: string
  to: string
  bars: number[][] // [open, high, low, close] for 90 days
}

// The real charts are about 700 KB, so they're loaded as a separate file the
// first time they're needed instead of slowing down the first page load.
//
// The file isn't in the Git repo (the prices come from Yahoo Finance, whose
// terms don't allow redistributing them), so it may not exist: after cloning,
// run `npm run fetch-charts` to create it. import.meta.glob is Vite's way of
// saying "load this file if it's there", so a missing file just means an
// empty list here, and every card is a generated one.
const dataFile = import.meta.glob<{ default: RealWindow[] }>('../data/realCharts.json')
let windows: RealWindow[] | null = null

export async function loadRealWindows(): Promise<RealWindow[]> {
  const load = Object.values(dataFile)[0]
  windows ??= load ? (await load()).default : []
  return windows
}

// The real charts, if they've loaded and there are any.
export const loadedRealWindows = () => (windows && windows.length > 0 ? windows : null)

// How much each kind of pattern counts toward the chart's lean. Specific,
// complete patterns count double; context like a trend or a level counts once.
const WEIGHT: Record<PatternFamily, number> = {
  reversal: 2,
  flag: 2,
  triangle: 2,
  breakout: 2,
  channel: 1,
  structure: 1,
  level: 1,
}

const direction = (bias: Bias) => (bias === 'bullish' ? 1 : bias === 'bearish' ? -1 : 0)

// Turn a window of real prices into a card. There's no built-in answer, so the
// scanner reads the chart: bullish patterns add to a score, bearish ones
// subtract, and only a clear score (2 or more either way) counts as a setup.
export function makeRealCard(w: RealWindow, number: number): ChartCard {
  const start = Date.UTC(2024, 0, 2) / 1000 // dates stay hidden, so any evenly spaced days will do
  const all: Candle[] = w.bars.map(([open, high, low, close], i) => ({ time: start + i * 86400, open, high, low, close }))
  const candles = all.slice(0, VISIBLE_CANDLES)
  const future = all.slice(VISIBLE_CANDLES)

  const matches = pickChartPatterns(findChartPatterns(candles))
  const signals = findSignalPatterns(candles)
  const score =
    matches.reduce((sum, m) => sum + direction(m.bias) * WEIGHT[m.pattern.family], 0) +
    signals.reduce((sum, s) => sum + direction(s.pattern.bias), 0)
  const bias: Bias = score >= 2 ? 'bullish' : score <= -2 ? 'bearish' : 'neutral'

  const leaning = [...matches.map((m) => m.bias), ...signals.map((s) => s.pattern.bias)]
  const mixed = leaning.includes('bullish') && leaning.includes('bearish')
  const primary = matches.find((m) => m.bias === bias) ?? matches[0]

  const intro = "This is a real chart, so there's no built-in answer: the read comes from the pattern scanner."
  let story: string
  if (!primary) story = `${intro} It found no clear chart pattern.`
  else {
    const names = matches.map((m) => m.pattern.name.toLowerCase())
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    story = `${intro} It found: ${list}. ${primary.pattern.name}: ${primary.pattern.meaning.charAt(0).toLowerCase()}${primary.pattern.meaning.slice(1)}`
    if (mixed) story += ' Some signals pointed different ways, which is normal on real charts.'
  }

  // A strong, one-sided read is medium; anything murkier is hard.
  const difficulty = Math.abs(score) >= 4 ? 'medium' : 'hard'
  const difficultyNotes =
    difficulty === 'hard'
      ? ['it was a real chart, and real prices rarely draw textbook shapes', ...(mixed ? ['the signals disagreed with each other'] : [])]
      : []

  return {
    id: `real-${w.ticker}-${w.from}-${number}`,
    number,
    source: 'real',
    difficulty,
    difficultyNotes,
    candles,
    future,
    setup: {
      key: 'real',
      name: bias === 'neutral' ? 'No clear setup' : primary?.pattern.name ?? (bias === 'bullish' ? 'Bullish candles' : 'Bearish candles'),
      bias,
      story,
      chartFindings: matches.map(toFinding),
    },
    real: { ticker: w.ticker, name: w.name, from: w.from, decision: w.decision, to: w.to },
  }
}

// Pick an unused real chart. Charts with a clear read are preferred, but a
// few murky ones get through too: skipping those is part of the game.
const used = new Set<number>()

export function drawRealCard(pool: RealWindow[], number: number): ChartCard {
  if (used.size >= pool.length) used.clear()
  let fallback: ChartCard | null = null
  for (let attempt = 0; attempt < 6; attempt++) {
    let index = Math.floor(Math.random() * pool.length)
    while (used.has(index)) index = (index + 1) % pool.length
    const card = makeRealCard(pool[index], number)
    if (card.setup.bias !== 'neutral' || Math.random() < 0.3) {
      used.add(index)
      return card
    }
    fallback ??= card
  }
  return fallback!
}
