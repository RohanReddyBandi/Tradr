import type { Bias, Candle, ChartPoint, Shape } from '../types'
import { makeRng } from './random'
import { averageTrueRange } from './trade'

// Turns a pattern's markup into the textbook style the Learn tab draws:
// support in blue, resistance and necklines in amber, numbered swing points,
// a measured-move target, a breakout arrow, and a line at the decision point.
// Also makes the illustrative volume bars Learn charts show.

export type Role = 'support' | 'resistance' | 'neckline' | 'trend' | 'pole' | 'target'

export type Note =
  | { kind: 'hline'; price: number; from: number; to: number; role: Role; label?: string }
  | { kind: 'line'; from: ChartPoint; to: ChartPoint; role: Role; label?: string }
  | { kind: 'marker'; at: ChartPoint; n: number; place: 'above' | 'below'; caption?: string }
  | { kind: 'curve'; points: ChartPoint[] }
  | { kind: 'box'; from: number; to: number; label?: string; bias: Bias }
  | { kind: 'arrow'; at: ChartPoint; dir: 'up' | 'down' }
  | { kind: 'vline'; index: number }
  | { kind: 'tag'; at: ChartPoint; text: string } // the pattern's name, written on the chart

const SUPPORT = /support|floor|range low|bottom line/i
const RESISTANCE = /resistance|ceiling|range high|top line/i
const NECKLINE = /neckline|rim/i
const POLE = /pole/i
// Dot labels that just count ("1st low") add nothing to a numbered marker.
const COUNTING = /^(1st|2nd|3rd|\d+(st|nd|rd|th))\s/i

const along = (from: ChartPoint, to: ChartPoint) => (i: number) =>
  to.index === from.index ? to.price : from.price + ((to.price - from.price) * (i - from.index)) / (to.index - from.index)

// Is price mostly above a line over its span (so the line is a floor) or below it?
function sideOf(candles: Candle[], at: (i: number) => number, from: number, to: number): 'support' | 'resistance' {
  let above = 0
  let below = 0
  for (let i = Math.max(0, Math.round(from)); i <= Math.min(candles.length - 1, Math.round(to)); i++) {
    if (candles[i].close >= at(i)) above++
    else below++
  }
  return above >= below ? 'support' : 'resistance'
}

function roleOf(label: string | undefined, candles: Candle[], at: (i: number) => number, from: number, to: number): Role {
  if (label && POLE.test(label)) return 'pole'
  if (label && NECKLINE.test(label)) return 'neckline'
  if (label && /new support/i.test(label)) return 'support'
  if (label && /new resistance/i.test(label)) return 'resistance'
  if (label && SUPPORT.test(label)) return 'support'
  if (label && RESISTANCE.test(label)) return 'resistance'
  return sideOf(candles, at, from, to)
}

// The words to print by a line: its role, unless the pattern gave it a better name.
function lineLabel(role: Role, label: string | undefined) {
  if (label && !SUPPORT.test(label) && !RESISTANCE.test(label)) return label
  return role === 'support' ? 'Support' : role === 'resistance' ? 'Resistance' : label
}

export interface Annotated {
  notes: Note[]
  target: number | null // where a measured move would take price
  breakout: number | null // the line price has to clear
}

// `last` is the decision point (the last candle you can see).
export function annotate(shapes: Shape[], candles: Candle[], bias: Bias, last = candles.length - 1, measure = true): Annotated {
  const notes: Note[] = []
  let markers = 0
  const dots = shapes.filter((s): s is Extract<Shape, { kind: 'dot' }> => s.kind === 'dot').sort((a, b) => a.at.index - b.at.index)

  for (const s of shapes) {
    if (s.kind === 'level') {
      const role = roleOf(s.label, candles, () => s.price, s.fromIndex, s.toIndex)
      notes.push({ kind: 'hline', price: s.price, from: s.fromIndex, to: s.toIndex, role, label: lineLabel(role, s.label) })
    } else if (s.kind === 'line') {
      const at = along(s.from, s.to)
      const role = roleOf(s.label, candles, at, Math.min(s.from.index, s.to.index), Math.max(s.from.index, s.to.index))
      notes.push({ kind: 'line', from: s.from, to: s.to, role, label: s.label })
    } else if (s.kind === 'curve') {
      notes.push({ kind: 'curve', points: s.points })
    } else if (s.kind === 'candles') {
      notes.push({ kind: 'box', from: s.fromIndex, to: s.toIndex, bias })
    }
  }
  for (const d of dots) {
    markers++
    notes.push({ kind: 'marker', at: d.at, n: markers, place: d.place, caption: d.label && !COUNTING.test(d.label) ? d.label : undefined })
  }

  // The measured move: the line price breaks, plus the pattern's height (or the pole's length).
  let target: number | null = null
  let breakout: number | null = null
  if (measure && bias !== 'neutral') {
    const up = bias === 'bullish'
    const barrier = notes.flatMap((n) => {
      if (n.kind === 'hline' && (n.role === (up ? 'resistance' : 'support') || n.role === 'neckline')) return [n.price]
      if (n.kind === 'line' && (n.role === (up ? 'resistance' : 'support') || n.role === 'neckline')) return [along(n.from, n.to)(last)]
      return []
    })
    const pole = notes.find((n): n is Extract<Note, { kind: 'line' }> => n.kind === 'line' && n.role === 'pole')
    const start = Math.min(
      ...notes.flatMap((n) => (n.kind === 'hline' ? [n.from] : n.kind === 'line' ? [n.from.index, n.to.index] : n.kind === 'marker' ? [n.at.index] : [])),
      last,
    )
    const span = candles.slice(Math.max(0, start), last + 1)
    if (barrier.length && span.length) {
      breakout = up ? Math.min(...barrier.filter((p) => p >= candles[last].close - 4 * averageTrueRange(candles))) : Math.max(...barrier)
      if (!Number.isFinite(breakout)) breakout = up ? Math.max(...barrier) : Math.min(...barrier)
      const extreme = up ? Math.min(...span.map((c) => c.low)) : Math.max(...span.map((c) => c.high))
      const height = pole ? Math.abs(pole.to.price - pole.from.price) : Math.abs(breakout - extreme)
      target = up ? breakout + height : breakout - height
    } else if (pole) {
      const height = Math.abs(pole.to.price - pole.from.price)
      breakout = candles[last].close
      target = up ? breakout + height : breakout - height
    }
    // A target past zero, or wildly beyond the chart, isn't a sensible thing to draw.
    const prices = candles.flatMap((c) => [c.low, c.high])
    const range = Math.max(...prices) - Math.min(...prices)
    if (target !== null && (target <= 0 || Math.abs(target - candles[last].close) > 1.6 * range)) target = null
    if (target !== null) notes.push({ kind: 'hline', price: target, from: 0, to: last + 40, role: 'target', label: 'Target' })
    const c = candles[last]
    notes.push({ kind: 'arrow', at: { index: last, price: up ? c.low : c.high }, dir: up ? 'up' : 'down' })
  }
  notes.push({ kind: 'vline', index: last + 0.5 })
  return { notes, target, breakout }
}

// Made-up but believable volume for each candle: busier on big candles and
// gaps, quieter in tight stretches. Learn charts only; it's illustration.
export function illustrativeVolume(candles: Candle[], seed = 1): number[] {
  const rng = makeRng(seed)
  const ranges = candles.map((c) => c.high - c.low)
  const typical = ranges.reduce((a, b) => a + b, 0) / Math.max(1, ranges.length) || 1
  return candles.map((c, i) => {
    const gap = i > 0 && (c.low > candles[i - 1].high || c.high < candles[i - 1].low) ? 1.6 : 1
    return (0.45 + 0.35 * rng.next()) * (0.5 + 0.9 * (ranges[i] / typical)) * gap
  })
}
