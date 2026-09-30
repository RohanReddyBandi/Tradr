import type { Candle } from '../types'
import { makeRng, type Rng } from './random'
import { CANDLE_PATTERNS, findCandlePatterns, resolveOverlaps, type CandleMatch } from './candlePatterns'
import { CANDLE_RECIPES, CHART_SHAPES, GAPS, MIRRORS, R, flip, leadIn, type LeadIn } from './examples'
import { CHART_PATTERNS } from './chartPatterns'
import { SIGNAL_RECIPES, type Bar } from './signalCandles'

// The Practice tab's three drills:
//   Mark:  a short chart with a few candlestick patterns hidden in it. You
//          name the candles; the pattern detector grades you.
//   Build: drag one to five candles into a named candlestick pattern.
//   Draw:  draw a chart pattern with your finger or mouse; the chart
//          pattern scanner says what it sees.

// ---------------------------------------------------------------------------
// Mark the candles
// ---------------------------------------------------------------------------

export interface MarkChart {
  candles: Candle[]
  answers: CandleMatch[] // the patterns to find (one per group of candles)
  all: CandleMatch[] // every pattern the detector sees, including smaller ones inside bigger ones
}

// One ordinary candle that moves price along in a direction without forming
// any named pattern. Each opens a hair beyond the previous close, which keeps
// runs of candles from reading as "three white soldiers" and friends.
function plainCandle(prev: Candle, direction: LeadIn, rng: Rng, flatStep: number): Candle {
  const wick = () => R * rng.range(0.1, 0.28)
  let up: boolean
  let size: number
  if (direction === 'flat') {
    up = flatStep % 2 === 0
    size = rng.range(0.3, 0.5)
  } else {
    // Mostly with the trend, with the odd small candle against it.
    const counter = rng.chance(0.2)
    up = (direction === 'up') !== counter
    size = counter ? rng.range(0.2, 0.3) : rng.range(0.45, 0.7)
  }
  const sign = up ? 1 : -1
  // A counter candle opens just past the previous candle's wick, so it can't sit inside it.
  const againstTrend = direction !== 'flat' && up !== (direction === 'up')
  const open = againstTrend
    ? (up ? prev.low : prev.high) - sign * R * 0.02
    : prev.close + sign * R * rng.range(0.03, 0.08)
  const close = open + sign * size * R
  const lower = againstTrend && up ? R * rng.range(0.08, 0.14) : wick()
  const upper = againstTrend && !up ? R * rng.range(0.08, 0.14) : wick()
  return { time: 0, open, close, high: Math.max(open, close) + upper, low: Math.min(open, close) - lower }
}

const flipBar = (b: Bar): Bar => ({ open: -b.open, close: -b.close, high: -b.low, low: -b.high })

// Candlestick patterns that can appear in the drills: every one with a recipe.
export const PRACTICE_CANDLES = CANDLE_PATTERNS.filter((p) => CANDLE_RECIPES[p.key])

// A chart of about 30 candles with `count` different patterns planted in it,
// each after the move it needs (a hammer comes after a drop, and so on).
// Plain candles can still line up into a pattern by accident, so we check
// with the detector and rebuild until it sees exactly the planted patterns.
export function makeMarkChart(seed: number, count = 3): MarkChart {
  const rng = makeRng(seed)
  let last: MarkChart | null = null

  for (let attempt = 0; attempt < 120; attempt++) {
    // Pick different patterns, and at most one five-candle one (they're long).
    const keys: string[] = []
    while (keys.length < count) {
      const p = rng.pick(PRACTICE_CANDLES)
      if (keys.includes(p.key) || (p.size === 5 && keys.some((k) => CANDLE_PATTERNS.find((c) => c.key === k)?.size === 5))) continue
      keys.push(p.key)
    }

    const candles: Candle[] = [{ time: 0, open: 100, close: 100.3, high: 100.5, low: 99.8 }]
    const add = (c: Candle) => candles.push({ ...c, time: candles.length })
    const planted: { key: string; start: number; end: number }[] = []
    let step = 0

    for (const key of keys) {
      const spec = CANDLE_RECIPES[key]
      // Recipes are bullish; a flipped (bearish) one needs the opposite move before it.
      const base = spec.lead ?? 'down'
      const lead: LeadIn = spec.flipped ? (base === 'down' ? 'up' : base === 'up' ? 'down' : 'flat') : base
      const leadLength = planted.length === 0 ? 7 : rng.int(5, 6)
      for (let k = 0; k < leadLength; k++) add(plainCandle(candles[candles.length - 1], lead, rng, step++))

      let bars = SIGNAL_RECIPES[spec.recipe](R, rng)
      if (spec.flipped) bars = bars.map(flipBar)
      const from = candles[candles.length - 1].close
      const start = candles.length
      for (const b of bars) add({ time: 0, open: b.open + from, high: b.high + from, low: b.low + from, close: b.close + from })
      planted.push({ key, start, end: candles.length - 1 })
    }
    for (let k = 0; k < 2; k++) add(plainCandle(candles[candles.length - 1], 'flat', rng, step++))

    const all = findCandlePatterns(candles)
    const answers = resolveOverlaps(all)
    last = { candles, answers, all }
    const exact =
      answers.length === planted.length &&
      planted.every((p) => answers.some((a) => a.pattern.key === p.key && a.start === p.start && a.end === p.end))
    if (exact) return last
  }
  return last! // very unlikely: the patterns it did find are still a fair test
}

// One of your marks: "candle 12 is a hammer".
export interface Mark {
  index: number
  key: string
}

export interface MarkGrade {
  mark: Mark
  correct: boolean // there really is that pattern on that candle
  partOf?: CandleMatch // it's right, but the answer is a bigger pattern around it
  actually?: CandleMatch // it's wrong: this is what's there instead (if anything)
}

export interface MarkResult {
  grades: MarkGrade[]
  found: CandleMatch[]
  missed: CandleMatch[]
  wrong: number
}

const covers = (m: CandleMatch, index: number) => m.start <= index && index <= m.end

// Any candle in a pattern counts: you can mark a morning star on any of its three candles.
export function gradeMarks(chart: MarkChart, marks: Mark[]): MarkResult {
  const grades = marks.map((mark): MarkGrade => {
    const answer = chart.answers.find((a) => covers(a, mark.index))
    const correct = chart.all.some((m) => m.pattern.key === mark.key && covers(m, mark.index))
    if (!correct) return { mark, correct, actually: answer }
    return { mark, correct, partOf: answer && answer.pattern.key !== mark.key ? answer : undefined }
  })
  const found = chart.answers.filter((a) => marks.some((m) => m.key === a.pattern.key && covers(a, m.index)))
  return {
    grades,
    found,
    missed: chart.answers.filter((a) => !found.includes(a)),
    wrong: grades.filter((g) => !g.correct).length,
  }
}

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
