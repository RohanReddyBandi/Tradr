import type { Candle, ChartCard, ChartPoint } from '../types'
import { averageTrueRange } from './trade'
import { findCandlePatterns, findSignalPatterns, resolveOverlaps } from './candlePatterns'
import { CHART_PATTERNS, findChartPatterns } from './chartPatterns'
import { entryByKey, findEntry } from './library'

// What you can draw on the trade setup chart before entering (lines, levels,
// named candles, and the chart pattern you think it is), and how the
// Breakdown grades it. Lines are judged the way traders judge them: by how
// many times price touched them and turned, and whether price respected them.

export type Drawing =
  | { kind: 'trend'; from: ChartPoint; to: ChartPoint } // a sloped line between two points
  | { kind: 'level'; price: number } // a horizontal line across the whole chart
  | { kind: 'candle'; index: number; key: string } // "candle 58 is a hammer"

export type Line = Extract<Drawing, { kind: 'trend' | 'level' }>

export interface ChartMarkup {
  drawings: Drawing[]
  pattern: string | null // the chart pattern you named (a Learn library key)
}

export const EMPTY_MARKUP: ChartMarkup = { drawings: [], pattern: null }

export const isLine = (d: Drawing): d is Line => d.kind !== 'candle'

// A line's price at a candle position. Trendlines carry on past their ends.
export function lineAt(line: Line, index: number) {
  if (line.kind === 'level') return line.price
  const { from, to } = line
  if (to.index === from.index) return to.price
  return from.price + ((to.price - from.price) * (index - from.index)) / (to.index - from.index)
}

// ---------------------------------------------------------------------------
// Reading a line: touches and closes through it
// ---------------------------------------------------------------------------

// All in ATRs (a normal day's range).
const NEAR = 0.35 // a wick this close to the line touches it
const PIERCE = 0.6 // a wick may poke this far through and still count as a touch
const THROUGH = 0.3 // a close this far past the line is on the wrong side
const RECENT = 4 // closes through the line in the last few candles are a break, not a flaw
const SAME_TOUCH = 3 // touching candles this close together are one touch (the same dip)

export interface LineReading {
  role: 'support' | 'resistance' // is price mostly above it (a floor) or below it (a ceiling)?
  touches: number[] // the candle of each separate touch
  crossings: number // closes clearly on the wrong side, after the first touch
  brokeAtEnd: boolean // one of the last few candles closed through it
}

// Read the line as a floor and as a ceiling, and keep whichever fits better.
// Counting starts at the first touch: a level only exists once price has
// found it, so where price was before then doesn't count against it.
// Trendlines are read from where they start to the newest candle, carried
// on past their drawn end the way traders extend them.
export function readLine(candles: Candle[], line: Line, atr = averageTrueRange(candles, candles.length - 1)): LineReading {
  const last = candles.length - 1
  const from = line.kind === 'level' ? 0 : Math.max(0, Math.round(Math.min(line.from.index, line.to.index)))
  const to = last

  function readAs(role: LineReading['role']): LineReading {
    const s = role === 'support' ? 1 : -1
    const touches: number[] = []
    let lastTouch = -Infinity
    let crossings = 0
    let brokeAtEnd = false
    for (let i = from; i <= to; i++) {
      const c = candles[i]
      const at = lineAt(line, i)
      if ((at - c.close) * s > THROUGH * atr) {
        if (i > last - RECENT) brokeAtEnd = true
        else if (touches.length > 0) crossings++
        continue
      }
      const room = ((role === 'support' ? c.low : c.high) - at) * s // how far the wick stayed on its own side
      if (room <= NEAR * atr && room >= -PIERCE * atr) {
        if (i - lastTouch > SAME_TOUCH) touches.push(i)
        lastTouch = i
      }
    }
    return { role, touches, crossings, brokeAtEnd }
  }

  const score = (r: LineReading) => r.touches.length * 2 - r.crossings
  const floor = readAs('support')
  const ceiling = readAs('resistance')
  return score(floor) >= score(ceiling) ? floor : ceiling
}

export type LineVerdict = 'strong' | 'ok' | 'weak' | 'cut'

export function lineVerdict(reading: LineReading): LineVerdict {
  const touches = reading.touches.length
  if (reading.crossings >= 3 && reading.crossings >= touches) return 'cut'
  if (touches >= 3) return 'strong'
  if (touches === 2) return 'ok'
  return 'weak'
}

// ---------------------------------------------------------------------------
// Grading everything you drew
// ---------------------------------------------------------------------------

export interface LineGrade {
  drawing: number // position in markup.drawings
  line: Line
  reading: LineReading
  verdict: LineVerdict
  matches: string | null // the chart's own line it lines up with ("the neckline"), if any
  replay: 'held' | 'broke' | 'untested'
  brokeOnDay: number | null
  good: boolean
  title: string // "Support at 101.20"
  text: string
}

export interface CandleMarkGrade {
  drawing: number
  index: number
  key: string
  name: string
  correct: boolean
  actually: string | null // what's really on that candle, when you were wrong
}

export interface PatternGuess {
  key: string
  name: string
  verdict: 'right' | 'close' | 'wrong' // close: same kind of pattern (both flags, both reversals...)
  answer: string | null // the chart's main pattern
}

export interface MarkupReview {
  pattern: PatternGuess | null
  lines: LineGrade[]
  candles: CandleMarkGrade[]
  missedSignals: string[] // signal candles at the decision point you didn't name (only if you named any)
  right: number
  total: number
}

// The chart's own lines (from the built-in pattern, or the scanner on real
// charts), for spotting when yours lines up with one.
function builtInLines(card: ChartCard) {
  return card.setup.chartFindings.flatMap((f) =>
    f.shapes.flatMap((s) => {
      const name = s.kind === 'line' || s.kind === 'level' ? s.label?.toLowerCase() ?? `a line of the ${f.name.toLowerCase()}` : null
      if (s.kind === 'level') return [{ name, from: s.fromIndex, to: s.toIndex, at: () => s.price }]
      if (s.kind === 'line') {
        const line: Line = { kind: 'trend', from: s.from, to: s.to }
        return [{ name, from: Math.min(s.from.index, s.to.index), to: Math.max(s.from.index, s.to.index), at: (i: number) => lineAt(line, i) }]
      }
      return []
    }),
  )
}

// The built-in line yours sits on: on average within 0.6 ATR of it, over at least 3 candles.
function matchingLine(card: ChartCard, line: Line, atr: number): string | null {
  const last = card.candles.length - 1
  const [from, to] = line.kind === 'level' ? [0, last] : [Math.min(line.from.index, line.to.index), Math.max(line.from.index, line.to.index)]
  let best: { name: string; distance: number } | null = null
  for (const b of builtInLines(card)) {
    const a = Math.max(Math.ceil(from), b.from)
    const z = Math.min(Math.floor(to), b.to, last)
    if (z - a < 3 || !b.name) continue
    let total = 0
    for (let i = a; i <= z; i++) total += Math.abs(lineAt(line, i) - b.at(i))
    const distance = total / (z - a + 1) / atr
    if (distance < 0.6 && (!best || distance < best.distance)) best = { name: b.name, distance }
  }
  return best?.name ?? null
}

// Did the line hold during the replay? Trendlines are carried forward.
function replayOf(card: ChartCard, line: Line, role: LineReading['role'], atr: number) {
  const s = role === 'support' ? 1 : -1
  const n = card.candles.length
  let tested = false
  for (let k = 0; k < card.future.length; k++) {
    const c = card.future[k]
    const at = lineAt(line, n + k)
    if ((at - c.close) * s > THROUGH * atr) return { replay: 'broke' as const, brokeOnDay: k + 1 }
    if (((role === 'support' ? c.low : c.high) - at) * s <= NEAR * atr) tested = true
  }
  return { replay: tested ? ('held' as const) : ('untested' as const), brokeOnDay: null }
}

function gradeLine(card: ChartCard, line: Line, drawing: number, atr: number): LineGrade {
  const reading = readLine(card.candles, line, atr)
  const verdict = lineVerdict(reading)
  const matches = matchingLine(card, line, atr)
  // A line price had already broken before you entered has nothing left to hold in the replay.
  const { replay, brokeOnDay } = reading.brokeAtEnd ? { replay: 'untested' as const, brokeOnDay: null } : replayOf(card, line, reading.role, atr)
  const support = reading.role === 'support'
  const touches = reading.touches.length

  const title =
    line.kind === 'level'
      ? `${support ? 'Support' : 'Resistance'} at ${line.price.toFixed(2)}`
      : `${support ? 'Support' : 'Resistance'} trendline`
  const read = {
    strong: `Price touched it ${touches} times and turned. That's a line worth trusting.`,
    ok: 'Two touches. Two points make a line; a third touch is what confirms it.',
    weak: touches === 1 ? 'Price only touched it once. A line needs at least two touches to mean anything.' : "Price never came to it, so it wasn't marking anything.",
    cut: `Price closed through it ${reading.crossings} times, so it wasn't holding price back.`,
  }[verdict]
  const parts = [read]
  if (matches) parts.push(`It lines up with ${matches.startsWith('a line') ? matches : `the ${matches}`} on this chart.`)
  if (reading.brokeAtEnd) parts.push(support ? 'The last candles closed below it: a breakdown.' : 'The last candles closed above it: a breakout.')
  if (replay === 'broke') parts.push(`In the replay, price broke through it on day ${brokeOnDay}.`)
  else if (replay === 'held') parts.push('In the replay it held.')

  return {
    drawing,
    line,
    reading,
    verdict,
    matches,
    replay,
    brokeOnDay,
    good: verdict === 'strong' || verdict === 'ok' || matches !== null,
    title,
    text: parts.join(' '),
  }
}

// The chart pattern you named, against the chart's own pattern (and, as a
// second opinion, anything the scanner finds pointing the same way).
function gradePattern(card: ChartCard, key: string): PatternGuess {
  const name = entryByKey(key)?.name ?? key
  const answers = card.setup.chartFindings.map((f) => findEntry(f.name)?.key).filter((k): k is string => !!k)
  const scanned = findChartPatterns(card.candles)
    .filter((m) => m.bias === card.setup.bias || m.bias === 'neutral')
    .map((m) => m.pattern.key)
  const answer = card.setup.chartFindings[0]?.name ?? null
  if (answers.includes(key) || scanned.includes(key)) return { key, name, verdict: 'right', answer }
  const family = CHART_PATTERNS[key]?.family
  const close = answers.some((k) => CHART_PATTERNS[k]?.family === family)
  return { key, name, verdict: close ? 'close' : 'wrong', answer }
}

// null when you didn't draw or name anything.
export function gradeMarkup(card: ChartCard, markup: ChartMarkup): MarkupReview | null {
  if (markup.drawings.length === 0 && !markup.pattern) return null
  const atr = averageTrueRange(card.candles, card.candles.length - 1)

  const lines = markup.drawings.flatMap((d, k) => (isLine(d) ? [gradeLine(card, d, k, atr)] : []))

  const found = findCandlePatterns(card.candles)
  const covers = (m: { start: number; end: number }, i: number) => m.start <= i && i <= m.end
  const candles = markup.drawings.flatMap((d, k): CandleMarkGrade[] => {
    if (d.kind !== 'candle') return []
    const correct = found.some((m) => m.pattern.key === d.key && covers(m, d.index))
    const there = resolveOverlaps(found.filter((m) => covers(m, d.index)))[0]
    return [{ drawing: k, index: d.index, key: d.key, name: entryByKey(d.key)?.name ?? d.key, correct, actually: correct ? null : there?.pattern.name ?? null }]
  })

  // The signal candles right at the decision point: the ones that matter most.
  const missedSignals =
    candles.length === 0
      ? []
      : findSignalPatterns(card.candles)
          .filter((m) => !candles.some((c) => c.correct && c.key === m.pattern.key && covers(m, c.index)))
          .map((m) => m.pattern.name)

  const pattern = markup.pattern ? gradePattern(card, markup.pattern) : null
  const right = lines.filter((l) => l.good).length + candles.filter((c) => c.correct).length + (pattern?.verdict === 'right' ? 1 : 0)
  return { pattern, lines, candles, missedSignals, right, total: lines.length + candles.length + (pattern ? 1 : 0) }
}
