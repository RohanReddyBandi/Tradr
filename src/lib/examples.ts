import type { Candle, Shape } from '../types'
import { makeRng } from './random'
import { pathThrough } from './generator'
import { SIGNAL_RECIPES, type SignalKey } from './signalCandles'
import { findChartPatterns } from './chartPatterns'

// Small example charts for the Learn tab. Candlestick examples reuse the
// generator's recipes; chart-pattern examples are drawn through a few points
// and then found by the real scanner, so the markup is exactly what the game
// would draw. (examples.test.ts checks every example is detected.)

export interface PatternExample {
  candles: Candle[]
  shapes: Shape[] // what to draw on top
}

const R = 1.2 // a typical candle's size at a price of 100

// Flip a chart upside down around 100, turning a bullish example into its bearish twin.
const flip = (cs: Candle[]): Candle[] =>
  cs.map((c) => ({ time: c.time, open: 200 - c.open, close: 200 - c.close, high: 200 - c.low, low: 200 - c.high }))

// ---------------------------------------------------------------------------
// Candlestick examples: a short lead-in, then the pattern.
// ---------------------------------------------------------------------------

type LeadIn = 'down' | 'up' | 'flat'
interface CandleRecipe {
  recipe: SignalKey
  flipped?: boolean // build the bullish version, then turn it upside down
  lead?: LeadIn // the move into the pattern (down by default)
}

const CANDLE_RECIPES: Record<string, CandleRecipe> = {
  hammer: { recipe: 'hammer' },
  shootingStar: { recipe: 'hammer', flipped: true },
  invertedHammer: { recipe: 'invertedHammer' },
  hangingMan: { recipe: 'invertedHammer', flipped: true },
  dragonflyDoji: { recipe: 'dragonflyDoji' },
  gravestoneDoji: { recipe: 'dragonflyDoji', flipped: true },
  longLeggedDoji: { recipe: 'longLeggedDoji', lead: 'flat' },
  doji: { recipe: 'doji', lead: 'flat' },
  spinningTop: { recipe: 'spinningTop', lead: 'flat' },
  bullishMarubozu: { recipe: 'bullishMarubozu', lead: 'flat' },
  bearishMarubozu: { recipe: 'bullishMarubozu', lead: 'flat', flipped: true },
  bullishEngulfing: { recipe: 'bullishEngulfing' },
  bearishEngulfing: { recipe: 'bullishEngulfing', flipped: true },
  piercingLine: { recipe: 'piercingLine' },
  darkCloudCover: { recipe: 'piercingLine', flipped: true },
  bullishHarami: { recipe: 'bullishHarami' },
  bearishHarami: { recipe: 'bullishHarami', flipped: true },
  tweezerBottom: { recipe: 'tweezerBottom' },
  tweezerTop: { recipe: 'tweezerBottom', flipped: true },
  morningStar: { recipe: 'morningStar' },
  eveningStar: { recipe: 'morningStar', flipped: true },
  abandonedBabyBullish: { recipe: 'abandonedBaby' },
  abandonedBabyBearish: { recipe: 'abandonedBaby', flipped: true },
  threeWhiteSoldiers: { recipe: 'threeWhiteSoldiers' },
  threeBlackCrows: { recipe: 'threeWhiteSoldiers', flipped: true },
  threeInsideUp: { recipe: 'threeInsideUp' },
  threeInsideDown: { recipe: 'threeInsideUp', flipped: true },
  threeOutsideUp: { recipe: 'threeOutsideUp' },
  threeOutsideDown: { recipe: 'threeOutsideUp', flipped: true },
  risingThreeMethods: { recipe: 'risingThreeMethods', lead: 'up' },
  fallingThreeMethods: { recipe: 'risingThreeMethods', lead: 'up', flipped: true },
}

function leadIn(direction: LeadIn, count: number): Candle[] {
  const candles: Candle[] = []
  let close = 100
  for (let i = 0; i < count; i++) {
    const open = close
    const step = direction === 'down' ? -0.8 * R : direction === 'up' ? 0.8 * R : (i % 2 === 0 ? 0.3 : -0.3) * R
    close = open + step
    candles.push({ time: i, open, close, high: Math.max(open, close) + 0.2 * R, low: Math.min(open, close) - 0.2 * R })
  }
  return candles
}

export function candleExample(key: string): PatternExample | null {
  const spec = CANDLE_RECIPES[key]
  if (!spec) return null
  const candles = leadIn(spec.lead ?? 'down', 8)
  const last = candles[candles.length - 1].close
  const pattern = SIGNAL_RECIPES[spec.recipe](R, makeRng(7))
  pattern.forEach((b, k) => {
    candles.push({ time: candles.length + k, open: b.open + last, high: b.high + last, low: b.low + last, close: b.close + last })
  })
  return {
    candles: spec.flipped ? flip(candles) : candles,
    shapes: [{ kind: 'candles', fromIndex: candles.length - pattern.length, toIndex: candles.length - 1 }],
  }
}

// ---------------------------------------------------------------------------
// Chart-pattern examples: [candle index, price] points to draw through.
// Each bullish (or neutral) shape also serves its upside-down twin.
// ---------------------------------------------------------------------------

type Points = [number, number][]

const CHART_SHAPES: Record<string, Points> = {
  supportLevel: [[0, 110], [8, 100], [16, 110], [24, 100.3], [32, 110], [40, 101.5], [42, 101]],
  breakout: [[0, 100], [8, 110], [16, 100], [24, 110.2], [32, 101], [40, 109.8], [44, 106], [47, 109], [48, 113]],
  falseBreakdown: [[0, 110], [8, 100], [16, 110], [24, 100.2], [32, 109], [40, 101], [44, 98], [45, 97.5], [46, 101.5]],
  higherHighsHigherLows: [[0, 100], [6, 108], [10, 104], [16, 112], [20, 108], [26, 116], [30, 112], [34, 115]],
  ascendingChannel: [[0, 100], [10, 112], [16, 108], [22, 118], [28, 114], [34, 124], [38, 120]],
  horizontalChannel: [[0, 100], [8, 110], [16, 100.2], [24, 110.3], [32, 100.1], [40, 109.8], [44, 104]],
  doubleBottom: [[0, 130], [15, 100], [23, 115], [31, 100.5], [36, 108]],
  tripleBottom: [[0, 140], [12, 100], [18, 112], [24, 100.3], [30, 112], [36, 100.2], [40, 107]],
  inverseHeadAndShoulders: [[0, 125], [10, 100], [16, 110], [22, 92], [28, 110.5], [34, 100.5], [40, 112]],
  ascendingTriangle: [[0, 90], [10, 110], [16, 96], [22, 110], [28, 103], [34, 110], [38, 106]],
  symmetricalTriangle: [[0, 105], [10, 120], [16, 90], [22, 114], [28, 97], [34, 109], [38, 104]],
  risingWedge: [[0, 96], [10, 110], [16, 104], [22, 116], [28, 112], [34, 119], [40, 113.5]],
  bullFlag: [[0, 98], [20, 100], [28, 125], [31, 120], [34, 123], [37, 118], [40, 121], [43, 117], [44, 122]],
  bullishPennant: [[0, 98], [20, 100], [28, 125], [31, 116], [34, 123], [37, 118], [40, 122], [42, 119.5], [43, 121], [44, 120.5]],
  cupAndHandle: [[0, 120], [4, 121], [10, 110], [16, 103], [22, 101], [28, 103], [34, 110], [40, 120.5], [44, 116], [46, 118]],
}

// Bearish (or mirrored) patterns: which shape to flip.
const MIRRORS: Record<string, string> = {
  resistanceLevel: 'supportLevel',
  breakdown: 'breakout',
  falseBreakout: 'falseBreakdown',
  lowerHighsLowerLows: 'higherHighsHigherLows',
  descendingChannel: 'ascendingChannel',
  doubleTop: 'doubleBottom',
  tripleTop: 'tripleBottom',
  headAndShoulders: 'inverseHeadAndShoulders',
  descendingTriangle: 'ascendingTriangle',
  fallingWedge: 'risingWedge',
  bearFlag: 'bullFlag',
  bearishPennant: 'bullishPennant',
  invertedCupAndHandle: 'cupAndHandle',
}

// Candles through the points, with a little randomness so they look real.
function candlesThrough(points: Points, seed: number): Candle[] {
  const rng = makeRng(seed)
  const closes = pathThrough(points.map(([at, price]) => ({ at, price })), rng, 0.2)
  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1]
    const upper = 0.15 + rng.next() * 0.3
    const lower = 0.15 + rng.next() * 0.3
    return { time: i, open, close, high: Math.max(open, close) + upper, low: Math.min(open, close) - lower }
  })
}

export function chartExample(key: string): PatternExample | null {
  const base = CHART_SHAPES[key] ? key : MIRRORS[key]
  if (!base) return null
  // The random wiggle can blur a delicate shape (pennants especially), so try
  // a few seeds in order and keep the first one the scanner recognises.
  // Same result every time, because the seeds are fixed.
  let fallback: PatternExample | null = null
  for (let seed = 1; seed <= 40; seed++) {
    let candles = candlesThrough(CHART_SHAPES[base], seed)
    if (base !== key) candles = flip(candles)
    const match = findChartPatterns(candles).find((m) => m.pattern.key === key)
    if (match) return { candles, shapes: match.shapes }
    fallback ??= { candles, shapes: [] }
  }
  return fallback
}
