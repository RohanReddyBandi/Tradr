import type { Bias, Candle, ChartCard } from '../types'
import { findChartPatterns, pickChartPatterns, toFinding, type PatternFamily } from './chartPatterns'
import { findSignalPatterns } from './candlePatterns'
import { VISIBLE_CANDLES } from './generator'
import { defaultPlan, simulateTrade } from './trade'

// Real price history, saved by scripts/fetch-real-charts.mjs.
export interface RealWindow {
  ticker: string
  name: string
  from: string
  decision: string
  to: string
  famous?: boolean // a well-known move starts the replay
  bars: number[][] // [open, high, low, close, volume] for 90 days (older files have no volume)
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
  gap: 2,
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

// Did trading with the chart's read, with the usual stop and target, pay off?
export function readPaidOff(card: ChartCard): boolean {
  const long = card.setup.bias === 'bullish'
  return simulateTrade(defaultPlan(card.candles, long ? 'long' : 'short', 1000), card.future).r > 0.15
}

// Real markets are harsh: on these charts, trading with the scanner's read
// only pays off about 40% of the time. So that a good read wins about 4 times
// in 5 here too (like the generated charts), each real card is first given a
// kind, in these proportions, and then an unused chart of that kind is dealt.
// The charts are still real; they're picked, like the examples in a textbook.
const NO_EDGE_SHARE = 0.2 // murky charts, where skipping is right
const GOOD_READ_PAYS = 0.8

type Kind = 'no edge' | 'paid off' | 'lost'
const kinds = new Map<number, Kind>() // each window's kind, once we've looked at it
const used = new Set<number>()

function kindOf(card: ChartCard): Kind {
  if (card.setup.bias === 'neutral') return 'no edge'
  return readPaidOff(card) ? 'paid off' : 'lost'
}

export function drawRealCard(pool: RealWindow[], number: number): ChartCard {
  const want: Kind = Math.random() < NO_EDGE_SHARE ? 'no edge' : Math.random() < GOOD_READ_PAYS ? 'paid off' : 'lost'
  // Look through the unused charts in a random order. If none of the wanted
  // kind are left, start the pile over (the charts come around again).
  for (let round = 0; round < 2; round++) {
    const unused = pool.map((_, i) => i).filter((i) => !used.has(i))
    for (let k = unused.length - 1; k >= 0; k--) {
      const pick = Math.floor(Math.random() * (k + 1))
      const index = unused[pick]
      unused[pick] = unused[k]
      if (kinds.has(index) && kinds.get(index) !== want) continue
      const card = makeRealCard(pool[index], number)
      kinds.set(index, kindOf(card))
      if (kinds.get(index) === want) {
        used.add(index)
        return card
      }
    }
    for (const index of used) if (kinds.get(index) === want) used.delete(index)
  }
  return makeRealCard(pool[Math.floor(Math.random() * pool.length)], number)
}
