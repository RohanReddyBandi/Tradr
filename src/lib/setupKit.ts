import type { Bias, Candle, ChartPoint, Finding, Shape } from '../types'
import type { Rng } from './random'
import type { SignalKey } from './signalCandles'

// The shared pieces for writing chart setups (setups.ts and moreSetups.ts).
// Every setup is described in its *bullish* form, around a price of 100.
// The generator flips the finished chart upside down for the bearish version
// (a double bottom becomes a double top), so each shape is only written once.

// A point the price path must pass through. With `touch`, the candle's wick
// (not its close) lands exactly on that price, so drawn lines touch the chart.
export interface Waypoint {
  at: number // candle index
  price: number
  touch?: 'high' | 'low'
  // Price jumps to this point overnight, leaving a gap on the chart. Needs a
  // waypoint on the candle just before it (at - 1).
  gap?: boolean
  // The stretch leading up to this point is quiet: small candles, little wiggle.
  calm?: boolean
  // A softer version for backstories: the stretch is this much quieter (0.5 = half the usual size).
  hush?: number
}

export interface Blueprint {
  waypoints: Waypoint[] // first one at index 0, last one at `end`
  // The chart-pattern markup, built once the candles exist so it can hug real wicks.
  findings: (candles: Candle[], bias: Bias) => Finding[]
  prices: Record<string, number> // prices the story quotes
  counts?: Record<string, number> // plain numbers the story quotes
  target: number // where the pattern says price should go
  invalidation: number // where the idea is proven wrong
}

export interface SetupRecipe {
  key: string
  names: { bullish: string; bearish: string }
  neutral?: boolean // a no-edge chart, where skipping is the right call
  signals: SignalKey[] // candle patterns that can finish this setup
  // `end` is the index of the last candle before the signal candles; `R` is a
  // typical candle's size.
  build: (rng: Rng, end: number, R: number) => Blueprint
  story: (bias: Bias, prices: Record<string, number>, counts: Record<string, number>) => string
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export const either = (bias: Bias, bullish: string, bearish: string) => (bias === 'bearish' ? bearish : bullish)

export function lowest(cs: Candle[], from: number, to: number): ChartPoint {
  let best = from
  for (let i = from; i <= to; i++) if (cs[i].low < cs[best].low) best = i
  return { index: best, price: cs[best].low }
}

export function highest(cs: Candle[], from: number, to: number): ChartPoint {
  let best = from
  for (let i = from; i <= to; i++) if (cs[i].high > cs[best].high) best = i
  return { index: best, price: cs[best].high }
}

// A straight line through two points, as a function of candle index.
export const lineThrough = (a: ChartPoint, b: ChartPoint) => (i: number) =>
  a.price + ((b.price - a.price) * (i - a.index)) / (b.index - a.index)

export const line = (from: ChartPoint, to: ChartPoint, label?: string): Shape => ({ kind: 'line', from, to, label })
export const level = (price: number, fromIndex: number, toIndex: number, label?: string): Shape => ({
  kind: 'level',
  price,
  fromIndex,
  toIndex,
  label,
})
export const dot = (at: ChartPoint, label: string, place: 'above' | 'below'): Shape => ({ kind: 'dot', at, label, place })

// Story formatting.
export const money = (n: number) => n.toFixed(2)
export const percent = (from: number, to: number) => `${Math.abs(((to - from) / from) * 100).toFixed(1)}%`
export function lastCandles(n: number) {
  return n === 1 ? 'last candle' : `last ${['', '', 'two', 'three', 'four', 'five'][n]} candles`
}
