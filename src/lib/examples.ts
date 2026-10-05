import type { Candle, Shape } from '../types'
import { makeRng } from './random'
import { CANDLE_RECIPES, SIGNAL_RECIPES, type LeadIn } from './signalCandles'
import { findChartPatterns } from './chartPatterns'

// Small example charts for the Learn tab. Candlestick examples reuse the
// generator's recipes; chart-pattern examples are drawn through a few points
// and then found by the real scanner, so the markup is exactly what the game
// would draw. (examples.test.ts checks every example is detected.)

export interface PatternExample {
  candles: Candle[]
  shapes: Shape[] // what to draw on top
}

export const R = 1.2 // a typical candle's size at a price of 100

// Flip a chart upside down around 100, turning a bullish example into its bearish twin.
export const flip = (cs: Candle[]): Candle[] =>
  cs.map((c) => ({ time: c.time, open: 200 - c.open, close: 200 - c.close, high: 200 - c.low, low: 200 - c.high }))

// ---------------------------------------------------------------------------
// Candlestick examples: a short lead-in, then the pattern.
// ---------------------------------------------------------------------------

// The recipes live next to the candles they draw; re-exported here for the Learn and Practice code.
export { CANDLE_RECIPES, type CandleRecipe, type LeadIn } from './signalCandles'

export function leadIn(direction: LeadIn, count: number): Candle[] {
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

export type Points = [number, number][]

export const CHART_SHAPES: Record<string, Points> = {
  supportLevel: [[0, 110], [8, 100], [16, 110], [24, 100.3], [32, 110], [40, 101.5], [42, 101]],
  breakout: [[0, 100], [8, 110], [16, 100], [24, 110.2], [32, 101], [40, 109.8], [44, 106], [47, 109], [48, 113]],
  falseBreakdown: [[0, 110], [8, 100], [16, 110], [24, 100.2], [32, 109], [40, 101], [44, 98], [45, 97.5], [46, 101.5]],
  higherHighsHigherLows: [[0, 100], [6, 108], [10, 104], [16, 112], [20, 108], [26, 116], [30, 112], [35, 119]],
  ascendingChannel: [[0, 100], [10, 112], [16, 106], [22, 118], [28, 112], [34, 124], [38, 118]],
  horizontalChannel: [[0, 106], [8, 110], [16, 100.2], [24, 110.3], [32, 100.1], [40, 109.8], [44, 104]],
  doubleBottom: [[0, 130], [15, 100], [23, 115], [31, 100.5], [36, 108]],
  tripleBottom: [[0, 140], [12, 100], [18, 112], [24, 100.3], [30, 112], [36, 100.2], [40, 107]],
  inverseHeadAndShoulders: [[0, 125], [10, 100], [16, 110], [22, 92], [28, 110.5], [34, 100.5], [40, 112]],
  ascendingTriangle: [[0, 90], [10, 110], [16, 96], [22, 110], [28, 103], [34, 110], [38, 106]],
  symmetricalTriangle: [[0, 105], [10, 120], [16, 90], [22, 114], [28, 97], [34, 109], [38, 104]],
  risingWedge: [[0, 96], [10, 110], [16, 104], [22, 116], [28, 112], [34, 119], [40, 113.5]],
  bullFlag: [[0, 98], [20, 100], [28, 125], [31, 120], [34, 123], [37, 118], [40, 121], [43, 117], [44, 122]],
  bullishPennant: [[0, 98], [18, 100], [26, 126], [29, 114], [32, 124], [35, 116.5], [38, 122], [41, 118], [44, 120.5], [46, 119.5], [47, 120.2]],
  cupAndHandle: [[0, 120], [4, 121], [10, 110], [16, 103], [22, 101], [28, 103], [34, 110], [40, 120.5], [44, 116], [46, 118]],
  roundingBottom: [[0, 124], [6, 114], [12, 106], [18, 101.5], [24, 100], [30, 101.5], [36, 106], [42, 113], [46, 117]],
  vBottom: [[0, 118], [16, 122], [24, 100], [31, 117], [33, 116]],
  diamondBottom: [[0, 128], [8, 100], [14, 112], [21, 97], [28, 119], [35, 92], [42, 110], [48, 100], [53, 108], [56, 104]],
  broadeningFormation: [[0, 105], [6, 110], [12, 100], [18, 113], [24, 97], [30, 116], [36, 94], [40, 104]],
  descendingBroadeningWedge: [[0, 122], [6, 120], [12, 112], [18, 118], [24, 104], [30, 116], [36, 96], [40, 104]],
  bullishRectangle: [[0, 90], [14, 108], [20, 101], [26, 108.2], [32, 101.2], [38, 108], [44, 104]],
  risingTrendline: [[0, 98], [6, 108], [10, 103], [17, 114], [22, 107], [28, 117], [34, 111], [40, 121], [43, 117]],
  bullishChangeOfCharacter: [[0, 118], [5, 124], [11, 110], [17, 118], [23, 104], [30, 121]],
  volatilitySqueeze: [[0, 100], [6, 112], [12, 100], [18, 112], [24, 100], [30, 112], [36, 104], [38, 106], [46, 106]],
  downtrendLineBreak: [[0, 112], [6, 122], [12, 106], [18, 118], [24, 103], [30, 114], [36, 100], [44, 112]],
  sellingClimax: [[0, 130], [30, 118], [37, 104], [38, 106]],
  bullishFibPullback: [[0, 100], [4, 99], [16, 115], [24, 106.5], [25, 107.5]],
  // These four also need gaps: see GAPS below.
  islandBottom: [[0, 120], [20, 104], [26, 103], [33, 106]],
  exhaustionGapDown: [[0, 130], [24, 104], [26, 103], [32, 110]],
  breakawayGapUp: [[0, 95], [8, 100], [12, 103], [16, 100], [20, 103], [24, 100.5], [28, 102.5], [30, 103.5], [34, 106]],
  runawayGapUp: [[0, 90], [30, 120], [36, 127]],
}

// Gaps to open up in a shape: [candle index, jump]. Every candle from that
// index on moves up (or down) by the jump, leaving an empty space before it.
export const GAPS: Record<string, [number, number][]> = {
  islandBottom: [[21, -4], [26, 5]],
  exhaustionGapDown: [[25, -4]],
  breakawayGapUp: [[31, 3]],
  runawayGapUp: [[31, 3]],
}

// Bearish (or mirrored) patterns: which shape to flip.
export const MIRRORS: Record<string, string> = {
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
  roundingTop: 'roundingBottom',
  vTop: 'vBottom',
  diamondTop: 'diamondBottom',
  ascendingBroadeningWedge: 'descendingBroadeningWedge',
  bearishRectangle: 'bullishRectangle',
  fallingTrendline: 'risingTrendline',
  bearishChangeOfCharacter: 'bullishChangeOfCharacter',
  islandTop: 'islandBottom',
  exhaustionGapUp: 'exhaustionGapDown',
  breakawayGapDown: 'breakawayGapUp',
  runawayGapDown: 'runawayGapUp',
  uptrendLineBreak: 'downtrendLineBreak',
  buyingClimax: 'sellingClimax',
  bearishFibPullback: 'bullishFibPullback',
}

// Candles through the points, textured to look like a real chart: each leg
// is split into uneven moves (some big candles, some small, the odd one
// against the trend), flat stretches wander a little, opens don't always
// match the last close, and wicks vary, with the occasional long one. The
// points themselves stay exact, and no candle closes past a leg's two ends,
// so the shape the scanner looks for is still there.
export function candlesThrough(points: Points, seed: number, gaps: [number, number][] = []): Candle[] {
  const rng = makeRng(seed)
  const closes = texturedPath(points, rng)
  const candles = closes.map((close, i) => {
    const open = i === 0 ? close - (closes[1] - close) * 0.5 : closes[i - 1] + rng.noise() * 0.12 * R
    const body = Math.abs(close - open)
    const wick = () => R * (0.06 + 0.3 * rng.next() * rng.next() + (rng.chance(0.08) ? 0.45 * rng.next() : 0)) + body * 0.2 * rng.next()
    return { time: i, open, close, high: Math.max(open, close) + wick(), low: Math.min(open, close) - wick() }
  })
  // Shifting everything after a point opens a gap there.
  for (const [at, jump] of gaps) {
    for (const c of candles.slice(at)) {
      c.open += jump
      c.close += jump
      c.high += jump
      c.low += jump
    }
  }
  return candles
}

// Closing prices through the points, one leg at a time.
function texturedPath(points: Points, rng: ReturnType<typeof makeRng>): number[] {
  const closes: number[] = [points[0][1]]
  for (let p = 0; p < points.length - 1; p++) {
    const [from, a] = points[p]
    const [to, b] = points[p + 1]
    const n = to - from
    // Uneven steps that still add up to the whole move: mostly with the leg,
    // some bigger, and roughly one in six against it.
    let weights = Array.from({ length: n }, () => (1 + 2 * rng.noise()) * (rng.chance(0.12) ? 2.2 : 1))
    const total = weights.reduce((x, y) => x + y, 0)
    if (total < n * 0.4) weights = weights.map(() => 1)
    const sum = weights.reduce((x, y) => x + y, 0)
    // Flat legs barely move, so they get a gentle wander instead (pinned at both ends).
    const flat = Math.max(0, 1 - Math.abs(b - a) / (n * 0.9 * R))
    const walk = [0]
    for (let k = 1; k <= n; k++) walk.push(walk[k - 1] + rng.noise() * R * 0.7 * flat)
    const lo = Math.min(a, b) - flat * 0.6 * R
    const hi = Math.max(a, b) + flat * 0.6 * R
    let price = a
    for (let k = 1; k <= n; k++) {
      price += ((b - a) * weights[k - 1]) / sum
      const wander = walk[k] - (walk[n] * k) / n
      closes[from + k] = k === n ? b : Math.min(hi, Math.max(lo, price + wander))
    }
  }
  return closes
}

export function chartExample(key: string): PatternExample | null {
  const base = CHART_SHAPES[key] ? key : MIRRORS[key]
  if (!base) return null
  // The random wiggle can blur a delicate shape, so try a few seeds in order
  // and keep the first one the scanner recognises.
  // Same result every time, because the seeds are fixed.
  let fallback: PatternExample | null = null
  for (let seed = 1; seed <= 40; seed++) {
    let candles = candlesThrough(CHART_SHAPES[base], seed, GAPS[base])
    if (base !== key) candles = flip(candles)
    const match = findChartPatterns(candles).find((m) => m.pattern.key === key)
    if (match) return { candles, shapes: match.shapes }
    fallback ??= { candles, shapes: [] }
  }
  return fallback
}
