import type { Bias, Candle, ChartPoint, Shape } from '../types'
import { averageTrueRange } from './trade'
import { findPivots, type Pivot } from './pivots'

// Finds chart patterns in raw candles, with no idea how the chart was made.
// This is what will read real charts. Everything is measured in ATR (a
// normal day's range) so the same rules work at any price.
//
// The approach:
//   1. Find the swing points (pivots.ts).
//   2. Each detector looks for its shape in those swings, or in lines fitted
//      through them.
//   3. Bearish patterns are found by flipping the chart upside down and
//      running the bullish detector (a double top is an upside-down double
//      bottom), just like candlePatterns.ts.

// ---------------------------------------------------------------------------
// The library: what each pattern is called and what it means
// ---------------------------------------------------------------------------

export type PatternFamily = 'reversal' | 'flag' | 'triangle' | 'channel' | 'breakout' | 'structure' | 'level'

export interface ChartPatternInfo {
  key: string
  name: string
  bias: Bias // which way it usually points
  family: PatternFamily
  signals: string // what it usually points to, in a few words
  meaning: string
  trap: string // the classic mistake with this pattern
}

const info = (key: string, name: string, bias: Bias, family: PatternFamily, signals: string, meaning: string, trap: string): ChartPatternInfo => ({
  key,
  name,
  bias,
  family,
  signals,
  meaning,
  trap,
})

export const CHART_PATTERNS: Record<string, ChartPatternInfo> = Object.fromEntries(
  [
    info('supportLevel', 'Support level', 'bullish', 'level', 'A floor while it holds',
      'A price where buyers have stepped in more than once. Traders expect it to hold again.',
      'Support only matters until it breaks. A close well below it turns the floor into a ceiling.'),
    info('resistanceLevel', 'Resistance level', 'bearish', 'level', 'A ceiling while it holds',
      'A price where sellers have stepped in more than once. Traders expect it to cap rallies again.',
      'Resistance only matters until it breaks. A close well above it turns the ceiling into a floor.'),
    info('breakout', 'Breakout', 'bullish', 'breakout', 'Bullish',
      'Price closed above a line that had held it back. Buyers finally won that fight.',
      'Many breakouts fail. Waiting for a close (not just a wick) above the line filters out a lot of them.'),
    info('breakdown', 'Breakdown', 'bearish', 'breakout', 'Bearish',
      'Price closed below a line that had held it up. Sellers finally won that fight.',
      'Many breakdowns fail. Waiting for a close (not just a wick) below the line filters out a lot of them.'),
    info('falseBreakout', 'False breakout', 'bearish', 'breakout', 'Bearish reversal',
      'Price poked above resistance, then fell back below it. The buyers who chased the break are trapped.',
      'It looks exactly like a real breakout until it fails. The tell is how fast price falls back.'),
    info('falseBreakdown', 'False breakdown', 'bullish', 'breakout', 'Bullish reversal',
      'Price poked below support, then climbed back above it. The sellers who chased the break are trapped.',
      'It looks exactly like a real breakdown until it fails. The tell is how fast price climbs back.'),
    info('higherHighsHigherLows', 'Higher highs and higher lows', 'bullish', 'structure', 'Uptrend',
      'Each rally beats the last high and each dip holds above the last low. That staircase is an uptrend.',
      'The trend is only intact while the last higher low holds. Below it, the staircase is broken.'),
    info('lowerHighsLowerLows', 'Lower highs and lower lows', 'bearish', 'structure', 'Downtrend',
      'Each drop breaks the last low and each bounce stalls below the last high. That staircase is a downtrend.',
      'The trend is only intact while the last lower high holds. Above it, the staircase is broken.'),
    info('ascendingChannel', 'Ascending channel', 'bullish', 'channel', 'Uptrend',
      'Price climbs between two parallel rising lines. Buying near the bottom line has been working.',
      'A push that fails to reach the top line is an early warning; a close below the bottom line ends it.'),
    info('descendingChannel', 'Descending channel', 'bearish', 'channel', 'Downtrend',
      'Price falls between two parallel falling lines. Selling near the top line has been working.',
      'A dip that fails to reach the bottom line is an early warning; a close above the top line ends it.'),
    info('horizontalChannel', 'Horizontal channel', 'neutral', 'channel', 'A range, no trend',
      'Price bounces between a flat floor and a flat ceiling. No trend, just a range.',
      'Trading from the middle of a range has no edge. The edges are where the decisions happen.'),
    info('doubleBottom', 'Double bottom', 'bullish', 'reversal', 'Bullish reversal',
      'Two lows at about the same price with a bounce in between. Buyers defended the same floor twice.',
      "It isn't confirmed until price clears the middle peak (the neckline). Before that it can still become a lower low."),
    info('doubleTop', 'Double top', 'bearish', 'reversal', 'Bearish reversal',
      'Two highs at about the same price with a dip in between. Sellers defended the same ceiling twice.',
      "It isn't confirmed until price falls through the middle low (the neckline). Before that it can still become a higher high."),
    info('tripleBottom', 'Triple bottom', 'bullish', 'reversal', 'Bullish reversal',
      'Three lows at about the same price. A floor tested three times and still holding.',
      'Every test uses up some of the buyers waiting there. A fourth test breaks more often than the first.'),
    info('tripleTop', 'Triple top', 'bearish', 'reversal', 'Bearish reversal',
      'Three highs at about the same price. A ceiling tested three times and still holding.',
      'Every test uses up some of the sellers waiting there. A fourth test breaks more often than the first.'),
    info('inverseHeadAndShoulders', 'Inverse head and shoulders', 'bullish', 'reversal', 'Bullish reversal',
      'Three dips with the middle one deepest. A close above the neckline signals the downtrend is over.',
      "Trading it before the neckline breaks is guessing. The right shoulder can still turn into a new low."),
    info('headAndShoulders', 'Head and shoulders', 'bearish', 'reversal', 'Bearish reversal',
      'Three peaks with the middle one highest. A close below the neckline signals the uptrend is over.',
      "Trading it before the neckline breaks is guessing. The right shoulder can still turn into a new high."),
    info('ascendingTriangle', 'Ascending triangle', 'bullish', 'triangle', 'Bullish breakout',
      'A flat ceiling with rising lows under it. Buyers keep paying more, and a close above the ceiling usually starts a move up.',
      'The longer it takes to break, the weaker the pattern. A close below the rising line cancels it.'),
    info('descendingTriangle', 'Descending triangle', 'bearish', 'triangle', 'Bearish breakdown',
      'A flat floor with falling highs above it. Sellers keep accepting less, and a close below the floor usually starts a move down.',
      'The longer it takes to break, the weaker the pattern. A close above the falling line cancels it.'),
    info('symmetricalTriangle', 'Symmetrical triangle', 'neutral', 'triangle', 'A breakout either way',
      'Falling highs and rising lows squeezing together. Pressure is building, but the direction is open until it breaks.',
      "Picking a side before the break is a coin flip. Let the close outside the lines tell you."),
    info('risingWedge', 'Rising wedge', 'bearish', 'triangle', 'Bearish reversal',
      'Two rising lines squeezing together. Each rally gains less ground, and breaks below the bottom line are often sharp.',
      'It can keep grinding higher for a while. Wait for the bottom line to break before selling.'),
    info('fallingWedge', 'Falling wedge', 'bullish', 'triangle', 'Bullish reversal',
      'Two falling lines squeezing together. Each drop gains less ground, and breaks above the top line are often sharp.',
      'It can keep grinding lower for a while. Wait for the top line to break before buying.'),
    info('bullFlag', 'Bull flag', 'bullish', 'flag', 'Bullish continuation',
      'A sharp rally (the pole), then a tight pullback channel (the flag). It usually breaks out upward.',
      'A flag that gives back more than half the pole is no longer a flag. That much selling is a warning.'),
    info('bearFlag', 'Bear flag', 'bearish', 'flag', 'Bearish continuation',
      'A sharp drop (the pole), then a tight bounce channel (the flag). It usually breaks down.',
      'A flag that wins back more than half the pole is no longer a flag. That much buying is a warning.'),
    info('bullishPennant', 'Bullish pennant', 'bullish', 'flag', 'Bullish continuation',
      'A sharp rally, then a small triangle that squeezes tight. It usually breaks out upward.',
      'Pennants should be short. One that drags on for weeks has lost the energy of the pole.'),
    info('bearishPennant', 'Bearish pennant', 'bearish', 'flag', 'Bearish continuation',
      'A sharp drop, then a small triangle that squeezes tight. It usually breaks down.',
      'Pennants should be short. One that drags on for weeks has lost the energy of the pole.'),
    info('cupAndHandle', 'Cup and handle', 'bullish', 'reversal', 'Bullish continuation',
      'A rounded U-shaped bottom back up to the old high (the cup), then a small dip (the handle). Buyers are absorbing the last sellers before a push higher.',
      'A V-shaped cup is not the same thing, and a handle that sinks deep into the cup cancels the pattern.'),
    info('invertedCupAndHandle', 'Inverted cup and handle', 'bearish', 'reversal', 'Bearish continuation',
      'A rounded upside-down U back down to the old low, then a small bounce (the handle). Sellers are absorbing the last buyers.',
      'An upside-down V is not the same thing, and a handle that rises deep into the cup cancels the pattern.'),
  ].map((p) => [p.key, p]),
)

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export interface ChartPatternMatch {
  pattern: ChartPatternInfo
  bias: Bias // this instance's lean (a support level only leans bullish when price is sitting on it)
  shapes: Shape[]
  labelAt?: ChartPoint
  start: number // first candle involved
  end: number // last candle involved
}

// Tuning knobs, all in ATRs.
const SWING = 2.2 // a swing must move at least this much to count
const SAME_PRICE = 1.0 // two swings this close count as the same level

interface Chart {
  candles: Candle[]
  pivots: Pivot[]
  atr: number
  last: number // index of the last candle
  close: number // last close
}

function readChart(candles: Candle[]): Chart {
  const atr = averageTrueRange(candles, candles.length - 1)
  const last = candles.length - 1
  return { candles, atr, last, close: candles[last].close, pivots: findPivots(candles, SWING * atr) }
}

type Side = 'bull' | 'bear'
const pick = (side: Side, bull: string, bear: string) => (side === 'bull' ? bull : bear)
const pt = (p: Pivot): ChartPoint => ({ index: p.index, price: p.price })
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

// Straight line of best fit ("least squares") through some points.
function fitLine(points: ChartPoint[]) {
  const mx = mean(points.map((p) => p.index))
  const my = mean(points.map((p) => p.price))
  let sxx = 0
  let sxy = 0
  for (const p of points) {
    sxx += (p.index - mx) ** 2
    sxy += (p.index - mx) * (p.price - my)
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  return { slope, at: (index: number) => my + slope * (index - mx) }
}

const lineThrough = (a: ChartPoint, b: ChartPoint) => (i: number) =>
  a.price + ((b.price - a.price) * (i - a.index)) / (b.index - a.index)

function found(key: string, shapes: Shape[], start: number, end: number, labelAt?: ChartPoint, bias?: Bias): ChartPatternMatch {
  const pattern = CHART_PATTERNS[key]
  return { pattern, bias: bias ?? pattern.bias, shapes, labelAt, start, end }
}

// --- Flipping (see the note at the top) ---
const flipCandles = (cs: Candle[]): Candle[] =>
  cs.map((c) => ({ time: c.time, open: -c.open, close: -c.close, high: -c.low, low: -c.high }))

function unflipShape(s: Shape): Shape {
  const p = (x: ChartPoint): ChartPoint => ({ index: x.index, price: -x.price })
  switch (s.kind) {
    case 'line':
      return { ...s, from: p(s.from), to: p(s.to) }
    case 'level':
      return { ...s, price: -s.price }
    case 'dot':
      return { ...s, at: p(s.at), place: s.place === 'above' ? 'below' : 'above' }
    case 'curve':
      return { ...s, points: s.points.map(p) }
    case 'candles':
      return s
  }
}

const unflip = (m: ChartPatternMatch): ChartPatternMatch => ({
  ...m,
  shapes: m.shapes.map(unflipShape),
  labelAt: m.labelAt && { index: m.labelAt.index, price: -m.labelAt.price },
})

type Detector = (chart: Chart, side: Side) => ChartPatternMatch | null

// Run a bullish-shaped detector on the chart, and on the flipped chart for the bearish twin.
function bothWays(detector: Detector, chart: Chart, flipped: Chart): ChartPatternMatch[] {
  const bull = detector(chart, 'bull')
  const bear = detector(flipped, 'bear')
  return [bull, bear && unflip(bear)].filter((m): m is ChartPatternMatch => m !== null)
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

// Double and triple bottoms: the latest low matches one or two lows before it.
const multipleBottom: Detector = ({ candles, pivots, atr, last, close }, side) => {
  const lows = pivots.filter((p) => p.kind === 'low')
  const latest = lows[lows.length - 1]
  if (!latest || last - latest.index > 12 || close < latest.price) return null

  // Walk back through the earlier lows while they sit at the same price.
  const same = [latest]
  for (let k = lows.length - 2; k >= 0 && same.length < 3; k--) {
    if (Math.abs(lows[k].price - latest.price) > SAME_PRICE * atr) break
    same.unshift(lows[k])
  }
  if (same.length < 2 || latest.index - same[0].index < 8) return null

  // Real bounces in between, and a fall into the pattern beforehand.
  const bounces = pivots.filter((p) => p.kind === 'high' && p.index > same[0].index && p.index < latest.index)
  if (bounces.length < same.length - 1) return null
  const floor = mean(same.map((p) => p.price))
  const neck = Math.max(...bounces.map((p) => p.price))
  if (neck - floor < 2.5 * atr) return null
  const before = candles.slice(Math.max(0, same[0].index - 15), same[0].index)
  if (before.length === 0 || Math.max(...before.map((c) => c.high)) - floor < 3 * atr) return null

  const triple = same.length === 3
  const key = triple ? pick(side, 'tripleBottom', 'tripleTop') : pick(side, 'doubleBottom', 'doubleTop')
  const ordinal = ['1st', '2nd', '3rd']
  return found(
    key,
    [
      { kind: 'level', price: floor, fromIndex: Math.max(0, same[0].index - 3), toIndex: last, label: pick(side, 'Support', 'Resistance') },
      { kind: 'level', price: neck, fromIndex: same[0].index, toIndex: last, label: 'Neckline' },
      ...same.map((p, k): Shape => ({ kind: 'dot', at: pt(p), label: `${ordinal[k]} ${pick(side, 'low', 'high')}`, place: 'below' })),
    ],
    same[0].index,
    last,
    { index: Math.round((same[0].index + latest.index) / 2), price: floor - 1.8 * atr },
  )
}

// Inverse head and shoulders: five swings ending at the latest low go
// low (left shoulder), high, lower low (head), high, higher low (right shoulder).
const headAndShoulders: Detector = ({ pivots, atr, last }, side) => {
  let j = pivots.length - 1
  if (pivots[j]?.kind !== 'low') j--
  if (j < 4) return null
  const [left, neck1, head, neck2, right] = pivots.slice(j - 4, j + 1)
  if (left.kind !== 'low' || last - right.index > 15) return null

  const depth = Math.min(neck1.price, neck2.price) - head.price
  if (depth < 3 * atr) return null
  if (head.price > Math.min(left.price, right.price) - atr) return null // the head must be clearly lowest
  if (Math.abs(left.price - right.price) > 0.4 * depth + 0.5 * atr) return null // shoulders about level
  if (Math.abs(neck1.price - neck2.price) > 0.4 * depth) return null // neckline roughly flat

  const neckline = lineThrough(pt(neck1), pt(neck2))
  const from = Math.max(0, neck1.index - 3)
  return found(
    pick(side, 'inverseHeadAndShoulders', 'headAndShoulders'),
    [
      { kind: 'line', from: { index: from, price: neckline(from) }, to: { index: last, price: neckline(last) }, label: 'Neckline' },
      { kind: 'dot', at: pt(left), label: 'Left shoulder', place: 'below' },
      { kind: 'dot', at: pt(head), label: 'Head', place: 'below' },
      { kind: 'dot', at: pt(right), label: 'Right shoulder', place: 'below' },
    ],
    left.index,
    last,
    { index: head.index, price: neckline(head.index) + 1.8 * atr },
  )
}

// Cup and handle: high (left rim), a rounded low, a high at the same price
// (right rim), then a small, recent dip (the handle).
const cupAndHandle: Detector = ({ candles, pivots, atr, last, close }, side) => {
  const j = pivots.length - 1
  if (j < 3 || pivots[j].kind !== 'low') return null
  const [left, bottom, right, handle] = pivots.slice(j - 3, j + 1)
  if (left.kind !== 'high') return null

  const depth = Math.min(left.price, right.price) - bottom.price
  const span = right.index - left.index
  if (depth < 4 * atr || span < 15 || Math.abs(left.price - right.price) > 1.2 * atr) return null
  const where = (bottom.index - left.index) / span
  if (where < 0.25 || where > 0.75) return null

  // Rounded, not V-shaped: most of the middle of the cup sits near the bottom.
  const middle = candles.slice(left.index + Math.round(span * 0.3), left.index + Math.round(span * 0.7))
  if (middle.filter((c) => c.low <= bottom.price + 0.35 * depth).length < middle.length * 0.5) return null

  // A shallow, recent handle that price is still above.
  if (right.price - handle.price > 0.5 * depth || last - right.index > 15 || close < handle.price) return null

  // Draw the cup as a U-shaped curve (a parabola through the rims and the bottom).
  const curve: ChartPoint[] = []
  for (let k = 0; k <= 16; k++) {
    const i = left.index + (span * k) / 16
    const edge = i < bottom.index ? left : right
    const t = (i - bottom.index) / (edge.index - bottom.index) // 0 at the bottom, 1 at the rim
    curve.push({ index: i, price: bottom.price + (edge.price - bottom.price) * t * t })
  }
  return found(
    pick(side, 'cupAndHandle', 'invertedCupAndHandle'),
    [
      { kind: 'curve', points: curve },
      { kind: 'level', price: (left.price + right.price) / 2, fromIndex: left.index, toIndex: last, label: 'Rim' },
      { kind: 'line', from: pt(right), to: pt(handle), label: 'Handle' },
    ],
    left.index,
    last,
    { index: bottom.index, price: bottom.price - 1.8 * atr },
  )
}

// Bull flag or pennant: a steep pole up, then a short pause that gives back
// less than half of it. Parallel pause lines make a flag; squeezing ones make a pennant.
const flagOrPennant: Detector = ({ candles, pivots, atr, last }, side) => {
  for (let k = pivots.length - 1; k >= 1; k--) {
    const top = pivots[k]
    if (top.kind !== 'high' || !top.confirmed) continue
    const age = last - top.index
    if (age < 4) continue
    if (age > 22) break

    // The pole starts at the lowest low of the 10 candles before the top.
    let baseIndex = Math.max(0, top.index - 10)
    for (let i = baseIndex; i < top.index; i++) if (candles[i].low < candles[baseIndex].low) baseIndex = i
    const base = { index: baseIndex, price: candles[baseIndex].low }
    const pole = top.price - base.price
    const days = top.index - base.index
    if (pole < 5 * atr || days < 2 || pole / days < 0.7 * atr) continue

    // The pause, leaving off the last couple of candles (that's where a breakout would be).
    const pauseEnd = age >= 7 ? last - 2 : last
    const pause = candles.slice(top.index + 1, pauseEnd + 1)
    if (pause.length < 3) continue
    if (top.price - Math.min(...pause.map((c) => c.low)) > 0.5 * pole) continue

    const upper = fitLine(pause.map((c, i) => ({ index: top.index + 1 + i, price: c.high })))
    const lower = fitLine(pause.map((c, i) => ({ index: top.index + 1 + i, price: c.low })))
    if (upper.slope > 0.1 * atr) continue // a bull flag drifts sideways or down, not up

    const widthStart = upper.at(top.index + 1) - lower.at(top.index + 1)
    const widthEnd = upper.at(pauseEnd) - lower.at(pauseEnd)
    const pennant = widthEnd < 0.6 * widthStart
    const key = pennant ? pick(side, 'bullishPennant', 'bearishPennant') : pick(side, 'bullFlag', 'bearFlag')
    const from = top.index
    return found(
      key,
      [
        { kind: 'line', from: base, to: pt(top), label: 'Pole' },
        { kind: 'line', from: { index: from, price: upper.at(from) }, to: { index: last, price: upper.at(last) } },
        { kind: 'line', from: { index: from, price: lower.at(from) }, to: { index: last, price: lower.at(last) } },
      ],
      base.index,
      last,
      { index: from + 3, price: upper.at(from + 3) + 1.5 * atr },
    )
  }
  return null
}

// Higher highs and higher lows: the longest run of swings at the end where
// each swing beats the swing of the same kind before it.
const marketStructure: Detector = ({ pivots, atr, last }, side) => {
  const recent = pivots.filter((p) => last - p.index <= 50)
  let first = recent.length - 1
  for (let k = recent.length - 1; k >= 2; k--) {
    // Swings alternate high/low, so the same kind is two back.
    if (recent[k].price > recent[k - 2].price + 0.3 * atr) first = k - 2
    else break
  }
  const run = recent.slice(first)
  if (run.length < 4) return null

  const shapes: Shape[] = []
  run.forEach((p, k) => {
    if (k > 0) shapes.push({ kind: 'line', from: pt(run[k - 1]), to: pt(p) })
    const firstOfKind = k < 2
    const label =
      p.kind === 'high'
        ? firstOfKind ? pick(side, 'High', 'Low') : pick(side, 'HH', 'LL')
        : firstOfKind ? pick(side, 'Low', 'High') : pick(side, 'HL', 'LH')
    shapes.push({ kind: 'dot', at: pt(p), label, place: p.kind === 'high' ? 'above' : 'below' })
  })
  return found(pick(side, 'higherHighsHigherLows', 'lowerHighsLowerLows'), shapes, run[0].index, last)
}

// Channels, triangles, and wedges: fit one line through the swing highs and
// one through the swing lows, then look at how the two lines relate.
function trendLines({ candles, pivots, atr, last, close }: Chart): ChartPatternMatch[] {
  const swings = pivots.filter((p) => p.confirmed && last - p.index <= 50)

  // Use as many recent swings as fit the lines well (at least 4).
  for (let count = Math.min(8, swings.length); count >= 4; count--) {
    const used = swings.slice(-count)
    const highs = used.filter((p) => p.kind === 'high')
    const lows = used.filter((p) => p.kind === 'low')
    if (highs.length < 2 || lows.length < 2) continue

    const upper = fitLine(highs.map(pt))
    const lower = fitLine(lows.map(pt))
    const onLine = (p: Pivot, line: typeof upper) => Math.abs(p.price - line.at(p.index)) <= 0.8 * atr
    if (!highs.every((p) => onLine(p, upper)) || !lows.every((p) => onLine(p, lower))) continue

    const start = used[0].index
    const end = used[used.length - 1].index
    const widthStart = upper.at(start) - lower.at(start)
    const widthEnd = upper.at(end) - lower.at(end)
    if (widthEnd <= 0.5 * atr) continue // the lines crossed

    // The candles in between should stay (roughly) inside the lines.
    const span = candles.slice(start, end + 1)
    const inside = span.filter((c, i) => c.high <= upper.at(start + i) + 0.8 * atr && c.low >= lower.at(start + i) - 0.8 * atr)
    if (inside.length < 0.9 * span.length) continue

    // Slopes in ATRs per candle. "Flat" means under 0.04.
    const up = upper.slope / atr
    const down = lower.slope / atr
    const rising = (s: number) => s > 0.04
    const falling = (s: number) => s < -0.04
    const flat = (s: number) => !rising(s) && !falling(s)

    let key: string | null = null
    if (widthEnd < 0.65 * widthStart) {
      if (flat(up) && rising(down)) key = 'ascendingTriangle'
      else if (flat(down) && falling(up)) key = 'descendingTriangle'
      else if (falling(up) && rising(down)) key = 'symmetricalTriangle'
      else if (rising(up) && rising(down)) key = 'risingWedge'
      else if (falling(up) && falling(down)) key = 'fallingWedge'
    } else if (Math.abs(up - down) <= 0.08 && widthStart >= 2 * atr) {
      const slope = (up + down) / 2
      key = rising(slope) ? 'ascendingChannel' : falling(slope) ? 'descendingChannel' : 'horizontalChannel'
    }
    if (!key) return []

    // Has the latest close already left the pattern?
    const broke = close > upper.at(last) + 0.25 * atr ? 'up' : close < lower.at(last) - 0.25 * atr ? 'down' : null
    const typical = CHART_PATTERNS[key].bias
    const bias: Bias = broke === 'up' ? 'bullish' : broke === 'down' ? 'bearish' : typical

    const shapes: Shape[] = [
      { kind: 'line', from: { index: start, price: upper.at(start) }, to: { index: last, price: upper.at(last) } },
      { kind: 'line', from: { index: start, price: lower.at(start) }, to: { index: last, price: lower.at(last) } },
    ]
    const matches = [found(key, shapes, start, last, { index: start + 3, price: upper.at(start + 3) + 1.5 * atr }, bias)]
    if (broke) {
      const c = candles[last]
      matches.push(
        found(broke === 'up' ? 'breakout' : 'breakdown', [
          { kind: 'dot', at: { index: last, price: broke === 'up' ? c.high : c.low }, label: broke === 'up' ? 'Breakout' : 'Breakdown', place: broke === 'up' ? 'above' : 'below' },
        ], last, last),
      )
    }
    return matches
  }
  return []
}

// Support and resistance: prices where several swings bunched up. Also
// checks whether the newest candles broke through one, or faked it.
function levels({ candles, pivots, atr, last, close }: Chart): ChartPatternMatch[] {
  // Group older swings (not the last few candles, where breaks happen) by price.
  const swings = pivots.filter((p) => p.confirmed && p.index < last - 3).sort((a, b) => a.price - b.price)
  const groups: Pivot[][] = []
  for (const p of swings) {
    const group = groups[groups.length - 1]
    if (group && p.price - mean(group.map((g) => g.price)) <= 0.7 * atr) group.push(p)
    else groups.push([p])
  }
  // A level needs at least two touches, a few candles apart.
  const touched = groups.filter((g) => g.length >= 2 && Math.max(...g.map((p) => p.index)) - Math.min(...g.map((p) => p.index)) >= 4)

  const matches: ChartPatternMatch[] = []
  const earlier = candles.slice(Math.max(0, last - 10), last - 4) // before the latest few candles
  const recent = candles.slice(last - 4)

  let support: { price: number; group: Pivot[] } | null = null
  let resistance: { price: number; group: Pivot[] } | null = null

  for (const group of touched) {
    const price = mean(group.map((p) => p.price))
    const wasBelow = earlier.every((c) => c.close <= price + 0.3 * atr)
    const wasAbove = earlier.every((c) => c.close >= price - 0.3 * atr)
    const touches = group.map((p): Shape => ({ kind: 'dot', at: pt(p), label: '', place: p.kind === 'high' ? 'above' : 'below' }))
    const from = Math.max(0, Math.min(...group.map((p) => p.index)) - 2)
    const line = (label: string): Shape => ({ kind: 'level', price, fromIndex: from, toIndex: last, label })

    if (wasBelow && close > price + 0.3 * atr) {
      matches.push(found('breakout', [line('Old resistance'), ...touches], from, last))
    } else if (wasAbove && close < price - 0.3 * atr) {
      matches.push(found('breakdown', [line('Old support'), ...touches], from, last))
    } else if (wasBelow && recent.some((c) => c.high > price + 0.3 * atr) && close < price) {
      matches.push(found('falseBreakout', [line('Resistance'), ...touches], from, last))
    } else if (wasAbove && recent.some((c) => c.low < price - 0.3 * atr) && close > price) {
      matches.push(found('falseBreakdown', [line('Support'), ...touches], from, last))
    }

    // Remember the nearest level on each side of the current price.
    if (price <= close && close - price <= 3 * atr && (!support || price > support.price)) support = { price, group }
    if (price >= close && price - close <= 3 * atr && (!resistance || price < resistance.price)) resistance = { price, group }
  }

  for (const [level, key, label] of [
    [support, 'supportLevel', 'Support'],
    [resistance, 'resistanceLevel', 'Resistance'],
  ] as const) {
    if (!level) continue
    // It only leans one way when price is sitting right on it.
    const near = Math.abs(close - level.price) <= 1.2 * atr
    const from = Math.max(0, Math.min(...level.group.map((p) => p.index)) - 2)
    matches.push(
      found(
        key,
        [
          { kind: 'level', price: level.price, fromIndex: from, toIndex: last, label },
          ...level.group.map((p): Shape => ({ kind: 'dot', at: pt(p), label: '', place: p.kind === 'high' ? 'above' : 'below' })),
        ],
        from,
        last,
        undefined,
        near ? CHART_PATTERNS[key].bias : 'neutral',
      ),
    )
  }
  return matches
}

// ---------------------------------------------------------------------------
// Putting it together
// ---------------------------------------------------------------------------

// Every chart pattern found in the candles.
export function findChartPatterns(candles: Candle[]): ChartPatternMatch[] {
  if (candles.length < 20) return []
  const chart = readChart(candles)
  const flipped = readChart(flipCandles(candles))
  return [
    ...bothWays(multipleBottom, chart, flipped),
    ...bothWays(headAndShoulders, chart, flipped),
    ...bothWays(cupAndHandle, chart, flipped),
    ...bothWays(flagOrPennant, chart, flipped),
    ...trendLines(chart),
    ...bothWays(marketStructure, chart, flipped),
    ...levels(chart),
  ]
}

// The most specific pattern families come first.
const PRIORITY: PatternFamily[] = ['reversal', 'flag', 'triangle', 'channel', 'breakout', 'structure', 'level']

// The few patterns worth showing: at most one per family, most specific
// first, without repeating the same story twice.
export function pickChartPatterns(matches: ChartPatternMatch[], max = 3): ChartPatternMatch[] {
  const sorted = [...matches].sort((a, b) => PRIORITY.indexOf(a.pattern.family) - PRIORITY.indexOf(b.pattern.family))
  const picked: ChartPatternMatch[] = []
  for (const m of sorted) {
    const families = picked.map((p) => p.pattern.family)
    if (families.includes(m.pattern.family)) continue
    // A channel or triangle already shows the trend; a reversal already shows its level.
    if (m.pattern.family === 'structure' && (families.includes('channel') || families.includes('triangle'))) continue
    if (m.pattern.family === 'level' && families.includes('reversal')) continue
    picked.push(m)
    if (picked.length === max) break
  }
  return picked
}
