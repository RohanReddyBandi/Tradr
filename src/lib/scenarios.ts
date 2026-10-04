import type { Bias, Candle, ChartCard, ChartPoint, Shape } from '../types'
import { makeRng, type Rng } from './random'
import { averageTrueRange } from './trade'
import { findCandlePatterns, findSignalPatterns } from './candlePatterns'
import { findChartPatterns } from './chartPatterns'
import { generateCard, type SetupTicket } from './generator'
import { SETUPS } from './setups'
import { CANDLE_RECIPES, REVERSAL_SIGNALS } from './signalCandles'
import { LIBRARY, entryByKey, findEntry } from './library'

import { drawPattern, followThrough, lookAlikes } from './patternStudy'
import { lineAt, type Line } from './userMarkup'
import { illustrativeVolume } from './annotate'

// Real-world practice for the Learn tab: a full, messy chart (the same kind
// the swipe cards use) with a pattern in it. You read it the way a trader
// would, one question at a time:
//   1. the trend          2. the chart pattern     3. its key lines (you draw them)
//   4. the signal candle  5. your call (buy, sell, or skip), then the replay.
// Every answer comes from the chart's own answer key, checked by the detectors.

export type Trend = 'up' | 'down' | 'sideways'
export type Call = 'buy' | 'sell' | 'skip'

export interface Scenario {
  focus: string | null // the pattern being practiced (null: a mixed scenario)
  candles: Candle[]
  future: Candle[]
  volume: number[] // candles, then future
  bias: Bias
  trend: Trend | null // null when the chart has no clear trend to ask about
  pattern: { key: string; options: string[] } | null
  candle: { key: string; from: number; to: number; options: string[] } | null
  lines: Line[] // the key lines to find
  shapes: Shape[] // the full answer markup
  tag: { at: ChartPoint; text: string } | null // where to write the pattern's name once it's out
  atr: number
  story: string
  name: string // what the chart was, for the reveal
}

// ---------------------------------------------------------------------------
// The trend
// ---------------------------------------------------------------------------

// Compare the first third of the chart with the last third (leaving out the
// final few candles, where the pattern itself happens), in normal days' moves.
export function trendOf(candles: Candle[]): Trend | null {
  const n = candles.length
  const third = Math.floor(n / 3)
  const mean = (cs: Candle[]) => cs.reduce((s, c) => s + c.close, 0) / cs.length
  const atr = averageTrueRange(candles, n - 1)
  const move = (mean(candles.slice(n - third - 4, n - 4)) - mean(candles.slice(0, third))) / atr
  if (move > 4) return 'up'
  if (move < -4) return 'down'
  if (Math.abs(move) < 1.5) return 'sideways'
  return null // somewhere in between: too close to call fairly
}

// ---------------------------------------------------------------------------
// Which swipe-card setups draw which pattern
// ---------------------------------------------------------------------------

let tickets: Map<string, SetupTicket[]> | null = null

function ticketsFor(key: string): SetupTicket[] {
  if (!tickets) {
    tickets = new Map()
    for (const s of SETUPS) {
      const biases: Bias[] = s.neutral ? ['neutral'] : ['bullish', 'bearish']
      for (const bias of biases) {
        const card = generateCard(1, 4242, 'medium', { key: s.key, bias })
        for (const f of card.setup.chartFindings) {
          const k = findEntry(f.name)?.key
          if (k) tickets.set(k, [...(tickets.get(k) ?? []), { key: s.key, bias }])
        }
      }
    }
  }
  return tickets.get(key) ?? []
}

// ---------------------------------------------------------------------------
// Building a scenario
// ---------------------------------------------------------------------------

// Four choices: the answer, then its look-alikes and others from its group,
// leaving out anything else the detectors see here (so only one is right).
function choices(key: string, also: string[], rng: Rng): string[] {
  const entry = entryByKey(key)!
  const pool = [
    ...lookAlikes(key),
    ...LIBRARY.filter((e) => e.kind === entry.kind && e.group === entry.group).map((e) => e.key),
    ...LIBRARY.filter((e) => e.kind === entry.kind).map((e) => e.key),
  ]
  const picked: string[] = []
  for (const k of pool) {
    if (picked.length === 3) break
    if (k === key || also.includes(k) || picked.includes(k)) continue
    // A little shuffle within the look-alikes, so the order isn't always the same.
    if (picked.length < 2 && rng.chance(0.25)) continue
    picked.push(k)
  }
  return [key, ...picked].map((k) => [rng.next(), k] as const).sort((a, b) => a[0] - b[0]).map(([, k]) => k)
}

// Where the pattern's name goes: above the middle of its lines, at its highest
// point, where there's usually open space (the label placer nudges it clear
// of markers and other labels).
function tagSpot(shapes: Shape[]): ChartPoint | null {
  const points = shapes.flatMap((s): ChartPoint[] => {
    if (s.kind === 'level') return [{ index: s.fromIndex, price: s.price }, { index: s.toIndex, price: s.price }]
    if (s.kind === 'line') return [s.from, s.to]
    if (s.kind === 'dot') return [s.at]
    if (s.kind === 'curve') return s.points
    return []
  })
  if (!points.length) return null
  const indexes = points.map((p) => p.index)
  return { index: (Math.min(...indexes) + Math.max(...indexes)) / 2, price: Math.max(...points.map((p) => p.price)) }
}

// The lines worth drawing: levels and trendlines from the answer markup (not the flagpole).
function keyLines(shapes: Shape[]): Line[] {
  return shapes.flatMap((s): Line[] => {
    if (s.kind === 'level') return [{ kind: 'level', price: s.price }]
    if (s.kind === 'line' && !/pole/i.test(s.label ?? '')) return [{ kind: 'trend', from: s.from, to: s.to }]
    return []
  })
}

function fromCard(card: ChartCard, focus: string | null, rng: Rng): Scenario | null {
  const candles = card.candles
  const last = candles.length - 1
  const atr = averageTrueRange(candles, last)
  const findingKeys = card.setup.chartFindings.map((f) => findEntry(f.name)?.key).filter((k): k is string => !!k)
  const scanned = findChartPatterns(candles).map((m) => m.pattern.key)
  const focusKind = focus ? entryByKey(focus)?.kind : null

  // The chart pattern question.
  const patternKey = focusKind === 'chart' ? focus! : (findingKeys[0] ?? null)
  if (focusKind === 'chart' && !findingKeys.includes(focus!)) return null
  const pattern = patternKey ? { key: patternKey, options: choices(patternKey, [...findingKeys, ...scanned], rng) } : null

  // The signal candle question.
  const signal = findSignalPatterns(candles)[0]
  if (focusKind === 'candle' && signal?.pattern.key !== focus) return null
  const sameSpot = signal ? findCandlePatterns(candles, [signal.end]).map((m) => m.pattern.key) : []
  const candle = signal ? { key: signal.pattern.key, from: signal.start, to: signal.end, options: choices(signal.pattern.key, sameSpot, rng) } : null

  const shapes: Shape[] = [...card.setup.chartFindings.flatMap((f) => f.shapes), ...(signal ? [{ kind: 'candles', fromIndex: signal.start, toIndex: signal.end } as Shape] : [])]
  const main = card.setup.chartFindings.find((f) => findEntry(f.name)?.key === patternKey) ?? card.setup.chartFindings[0]
  const tagAt = tagSpot(main?.shapes ?? [])
  return {
    focus,
    candles,
    future: card.future,
    volume: illustrativeVolume([...candles, ...card.future], rng.int(1, 1e9)),
    bias: card.setup.bias,
    trend: trendOf(candles),
    pattern,
    candle,
    lines: keyLines(card.setup.chartFindings.flatMap((f) => f.shapes)),
    shapes,
    tag: patternKey && tagAt ? { at: tagAt, text: entryByKey(patternKey)?.name ?? main.name } : null,
    atr,
    story: card.setup.story,
    name: card.setup.name,
  }
}

// When no swipe-card setup draws a chart pattern, build the chart from its
// example outline instead (shorter, but still freshly drawn and checked).
function fromDrawing(key: string, rng: Rng): Scenario | null {
  const entry = entryByKey(key)!
  const d = drawPattern(key, rng)
  if (!d.ok) return null
  const future = followThrough({ candles: d.candles, shapes: d.shapes }, entry.bias, rng.int(1, 1e6))
  return {
    focus: key,
    candles: d.candles,
    future,
    volume: illustrativeVolume([...d.candles, ...future], rng.int(1, 1e9)),
    bias: entry.bias,
    trend: trendOf(d.candles),
    pattern: { key, options: choices(key, d.detected, rng) },
    candle: null,
    lines: keyLines(d.shapes),
    shapes: d.shapes,
    tag: tagSpot(d.shapes) && { at: tagSpot(d.shapes)!, text: entry.name },
    atr: averageTrueRange(d.candles, d.candles.length - 1),
    story: entry.meaning,
    name: entry.name,
  }
}

// A scenario for practicing one pattern (`focus`), or a mixed one (null).
export function makeScenario(focus: string | null, seed: number): Scenario {
  const rng = makeRng(seed)
  const entry = focus ? entryByKey(focus) : undefined
  for (let attempt = 0; attempt < 14; attempt++) {
    const cardSeed = rng.int(1, 2 ** 31)
    let made: Scenario | null = null
    if (!entry) {
      const s = rng.pick(SETUPS)
      made = fromCard(generateCard(1, cardSeed, 'medium', { key: s.key, bias: s.neutral ? 'neutral' : rng.chance(0.5) ? 'bullish' : 'bearish' }), null, rng)
    } else if (entry.kind === 'chart') {
      const options = ticketsFor(entry.key)
      made = options.length ? fromCard(generateCard(1, cardSeed, 'medium', rng.pick(options)), entry.key, rng) : fromDrawing(entry.key, rng)
    } else {
      // Finish a real setup with this candlestick pattern: a reversal setup for a
      // reversal candle, a breakout for a continuation one, a range for indecision.
      const spec = CANDLE_RECIPES[entry.key]
      const fits = SETUPS.filter((s) => (entry.bias === 'neutral' ? s.neutral : !s.neutral && s.signals.includes(spec.recipe)))
      const pool = fits.length ? fits : SETUPS.filter((s) => !s.neutral && s.signals.some((k) => REVERSAL_SIGNALS.includes(k)))
      const s = rng.pick(pool)
      const card = generateCard(1, cardSeed, 'medium', { key: s.key, bias: s.neutral ? 'neutral' : entry.bias }, { signal: spec.recipe })
      made = fromCard(card, entry.key, rng)
    }
    if (made) return made
  }
  // Very unlikely: fall back to a mixed scenario rather than nothing.
  return makeScenario(null, seed + 1)
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

// Does a line you drew sit on one of the key lines? Within 0.7 of a normal
// day's range on average, over the stretch they share (at least 3 candles).
export function lineMatches(yours: Line, truth: Line, atr: number, last: number): boolean {
  const span = (l: Line): [number, number] => (l.kind === 'level' ? [0, last] : [Math.min(l.from.index, l.to.index), Math.max(l.from.index, l.to.index)])
  const [a0, a1] = span(truth)
  const [b0, b1] = yours.kind === 'level' ? [0, last] : [Math.min(yours.from.index, yours.to.index), last] // your trendlines carry on to the right
  const from = Math.ceil(Math.max(a0, b0))
  const to = Math.floor(Math.min(a1, b1))
  if (to - from < 2) return false
  let total = 0
  for (let i = from; i <= to; i++) total += Math.abs(lineAt(yours, i) - lineAt(truth, i))
  return total / (to - from + 1) < 0.7 * atr
}

// Which key lines you found, and which of your lines found nothing.
export function gradeLines(s: Scenario, drawn: Line[]) {
  const last = s.candles.length - 1
  const found = s.lines.map((t) => drawn.some((d) => lineMatches(d, t, s.atr, last)))
  const stray = drawn.filter((d) => !s.lines.some((t) => lineMatches(d, t, s.atr, last)))
  return { found, stray, share: s.lines.length ? found.filter(Boolean).length / s.lines.length : 1 }
}

export const rightCall = (bias: Bias): Call => (bias === 'bullish' ? 'buy' : bias === 'bearish' ? 'sell' : 'skip')

export interface Answers {
  trend?: Trend
  pattern?: string
  lines?: Line[]
  candle?: string
  call?: Call
}

// Points per question (lines can score part of a point), and the total out of 1.
export function scoreScenario(s: Scenario, a: Answers) {
  const parts: { step: string; points: number }[] = []
  if (s.trend) parts.push({ step: 'trend', points: a.trend === s.trend ? 1 : 0 })
  if (s.pattern) parts.push({ step: 'pattern', points: a.pattern === s.pattern.key ? 1 : 0 })
  if (s.lines.length) parts.push({ step: 'lines', points: gradeLines(s, a.lines ?? []).share })
  if (s.candle) parts.push({ step: 'candle', points: a.candle === s.candle.key ? 1 : 0 })
  parts.push({ step: 'call', points: a.call === rightCall(s.bias) ? 1 : 0 })
  const total = parts.reduce((sum, p) => sum + p.points, 0) / parts.length
  return { parts, total }
}

export const SCENARIOS_PER_RUN = 3
export const SCENARIO_MASTERY = 0.8 // average score over a run of SCENARIOS_PER_RUN to master a pattern
