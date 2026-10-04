import type { Candle } from '../types'
import { makeRng } from './random'
import { CANDLE_PATTERNS, findCandlePatterns, type CandleMatch } from './candlePatterns'
import { CANDLE_RECIPES, CHART_SHAPES, GAPS, MIRRORS, R, flip, leadIn } from './examples'
import { CHART_PATTERNS } from './chartPatterns'

// Making a pattern yourself, on its page in the Learn tab:
//   Build: drag one to five candles into a named candlestick pattern.
//   Draw:  draw a chart pattern with your finger or mouse; the chart
//          pattern scanner says what it sees.

// Candlestick patterns you can build: every one with a recipe.
export const PRACTICE_CANDLES = CANDLE_PATTERNS.filter((p) => CANDLE_RECIPES[p.key])

// ---------------------------------------------------------------------------
// Build a candlestick pattern
// ---------------------------------------------------------------------------

// A candle's four prices, which the candle editors let you drag.
export type Handle = 'high' | 'low' | 'open' | 'close'

// Move one price, keeping the candle valid: the wicks always reach at least
// as far as the body.
export function adjustCandle(c: Candle, which: Handle, price: number): Candle {
  const next = { ...c, [which]: price }
  if (which === 'high') next.high = Math.max(price, c.open, c.close)
  else if (which === 'low') next.low = Math.min(price, c.open, c.close)
  else {
    next.high = Math.max(c.high, next.open, next.close)
    next.low = Math.min(c.low, next.open, next.close)
  }
  return next
}

export interface BuildTask {
  key: string
  context: Candle[] // the candles before yours (the move the pattern needs)
  start: Candle[] // your candles, before you've touched them
  range: { min: number; max: number } // price range of the editor
}

// Ordinary small candles, alternating green and red, that don't form the
// pattern yet. You drag them into shape.
export function buildTask(key: string): BuildTask {
  const spec = CANDLE_RECIPES[key]
  const pattern = CANDLE_PATTERNS.find((p) => p.key === key)!
  let context = leadIn(spec.lead ?? 'down', 8)
  if (spec.flipped) context = flip(context)

  const start: Candle[] = []
  let close = context[context.length - 1].close
  for (let k = 0; k < pattern.size; k++) {
    // Big enough that the four drag handles start well apart.
    const open = close
    close = open + (k % 2 === 0 ? 0.8 : -0.6) * R
    // Different wick lengths, so no two start candles share a high or low (a tweezer).
    const upper = (0.35 + 0.1 * k) * R
    const lower = (0.5 - 0.08 * k) * R
    start.push({ time: context.length + k, open, close, high: Math.max(open, close) + upper, low: Math.min(open, close) - lower })
  }

  const prices = context.flatMap((c) => [c.low, c.high])
  return {
    key,
    context,
    start,
    range: { min: Math.min(...prices) - 3 * R, max: Math.max(...prices) + 3 * R },
  }
}

// Which patterns end on your last candle right now.
export function readBuild(context: Candle[], yours: Candle[]): CandleMatch[] {
  const candles = [...context, ...yours]
  return findCandlePatterns(candles, [candles.length - 1])
}

// ---------------------------------------------------------------------------
// Draw a chart pattern
// ---------------------------------------------------------------------------

export const DRAW_CANDLES = 60 // same as a swipe card
export const DRAW_PRICES = { min: 70, max: 130 } // the drawing pad's price range, bottom to top

// Chart patterns you can draw: every one with an example shape, except the
// gap patterns (a single pen stroke can't leave a gap).
export const DRAWABLE = Object.values(CHART_PATTERNS).filter((p) => {
  const base = CHART_SHAPES[p.key] ? p.key : MIRRORS[p.key]
  return base && !GAPS[base]
})

// Turn a drawn line into candles. `prices` is one price per candle. Hands
// wobble, so each point is blended a little with its neighbours (the two ends
// are kept exactly as drawn: the last candle is where signals happen). Then
// every candle opens where the last one closed and gets random wicks.
export function candlesFromDrawing(prices: number[], seed = 1): Candle[] {
  const rng = makeRng(seed)
  const last = prices.length - 1
  const smooth = prices.map((p, i) => (i === 0 || i === last ? p : 0.25 * prices[i - 1] + 0.5 * p + 0.25 * prices[i + 1]))
  return smooth.map((close, i) => {
    const open = i === 0 ? close : smooth[i - 1]
    const upper = rng.range(0.4, 1)
    const lower = rng.range(0.4, 1)
    return { time: i, open, close, high: Math.max(open, close) + upper, low: Math.min(open, close) - lower }
  })
}

// Resample a drawing (any number of evenly spaced points, some possibly
// missing) to one price per candle. Missing stretches are filled with a
// straight line; the ends are held flat.
export function resample(points: (number | null)[], count = DRAW_CANDLES): number[] | null {
  const known = points.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null)
  if (known.length < 2) return null
  const at = (x: number) => {
    if (x <= known[0][0]) return known[0][1]
    if (x >= known[known.length - 1][0]) return known[known.length - 1][1]
    const k = known.findIndex(([i]) => i >= x)
    const [x0, y0] = known[k - 1]
    const [x1, y1] = known[k]
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
  }
  return Array.from({ length: count }, (_, i) => at(((i + 0.5) / count) * points.length - 0.5))
}

// A guide to trace for a chart pattern: its example shape, stretched to 60%
// of the pad's height. The shape keeps its own width and sits at the right
// edge (patterns are read at the newest candles), with a flat line leading
// into it. Returns one price per candle.
export function drawGuide(key: string): number[] {
  const base = CHART_SHAPES[key] ? key : MIRRORS[key]
  const points = CHART_SHAPES[base]
  const prices = points.map(([, p]) => (base === key ? p : 200 - p))
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const span = DRAW_PRICES.max - DRAW_PRICES.min
  const fit = (p: number) => DRAW_PRICES.min + span * 0.2 + ((p - low) / (high - low)) * span * 0.6
  const offset = DRAW_CANDLES - 1 - points[points.length - 1][0]
  return Array.from({ length: DRAW_CANDLES }, (_, i) => {
    const x = i - offset
    if (x <= 0) return fit(prices[0])
    const k = points.findIndex(([at]) => at >= x)
    const [x0, p0] = [points[k - 1][0], prices[k - 1]]
    const [x1, p1] = [points[k][0], prices[k]]
    return fit(p0 + ((p1 - p0) * (x - x0)) / (x1 - x0))
  })
}
