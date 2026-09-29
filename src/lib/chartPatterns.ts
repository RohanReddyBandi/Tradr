import type { Bias, Candle, ChartPoint, Finding, Shape } from '../types'
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

export type PatternFamily = 'reversal' | 'flag' | 'triangle' | 'channel' | 'breakout' | 'gap' | 'structure' | 'level'

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
    info('roundingBottom', 'Rounding bottom', 'bullish', 'reversal', 'Bullish reversal',
      'A slow, smooth U: selling fades out, price goes quiet at the bottom, then buyers gradually take over. Also called a saucer.',
      "It takes a long time to form, and the right side can stall. It's confirmed when price gets back to where the U started."),
    info('roundingTop', 'Rounding top', 'bearish', 'reversal', 'Bearish reversal',
      'A slow, smooth upside-down U: buying fades out, price goes quiet at the top, then sellers gradually take over.',
      "It takes a long time to form, and the right side can stall. It's confirmed when price gets back to where the arc started."),
    info('vBottom', 'V-bottom', 'bullish', 'reversal', 'Bullish reversal',
      'A sharp drop, then an equally sharp rally straight back up, with almost no time spent at the bottom. Sellers ran out all at once.',
      "There's no warning before the turn, so it's only clear after a big chunk of the rally. Chasing it late means a wide stop."),
    info('vTop', 'V-top', 'bearish', 'reversal', 'Bearish reversal',
      'A sharp rally, then an equally sharp drop straight back down, with almost no time spent at the top. Buyers ran out all at once.',
      "There's no warning before the turn, so it's only clear after a big chunk of the drop. Chasing it late means a wide stop."),
    info('diamondBottom', 'Diamond bottom', 'bullish', 'reversal', 'Bullish reversal',
      'After a drop, the swings first widen out, then narrow back in, drawing a diamond. The wild swinging calms down and buyers take over.',
      'It looks like a symmetrical triangle once the left half is ignored. Wait for a close above the upper right edge.'),
    info('diamondTop', 'Diamond top', 'bearish', 'reversal', 'Bearish reversal',
      'After a rise, the swings first widen out, then narrow back in, drawing a diamond. The wild swinging calms down and sellers take over.',
      'It looks like a symmetrical triangle once the left half is ignored. Wait for a close below the lower right edge.'),
    info('broadeningFormation', 'Broadening formation', 'neutral', 'triangle', 'Wild swings, no edge',
      'Each swing goes higher and lower than the last, like a megaphone. Nobody is in control and the swings keep getting bigger.',
      'Trading breakouts here gets whipsawed: price keeps overshooting both lines. Many traders just stay out.'),
    info('ascendingBroadeningWedge', 'Ascending broadening wedge', 'bearish', 'triangle', 'Bearish reversal',
      'Both lines rise, but they spread apart: rallies overshoot higher while dips get deeper. The trend up is getting unstable.',
      'The rallies look strong, which is exactly what traps late buyers. The deeper dips are the real message.'),
    info('descendingBroadeningWedge', 'Descending broadening wedge', 'bullish', 'triangle', 'Bullish reversal',
      'Both lines fall, but they spread apart: drops overshoot lower while bounces get bigger. The trend down is getting unstable.',
      'The drops look scary, which is exactly what shakes out sellers. The bigger bounces are the real message.'),
    info('bullishRectangle', 'Bullish rectangle', 'bullish', 'channel', 'Bullish continuation',
      'An uptrend pauses in a flat range with a clear floor and ceiling. Buyers are resting, and it usually breaks out upward.',
      'Until it breaks, it is just a range. Buying in the middle of it has no edge; the floor or the breakout does.'),
    info('bearishRectangle', 'Bearish rectangle', 'bearish', 'channel', 'Bearish continuation',
      'A downtrend pauses in a flat range with a clear floor and ceiling. Sellers are resting, and it usually breaks down.',
      'Until it breaks, it is just a range. Selling in the middle of it has no edge; the ceiling or the breakdown does.'),
    info('risingTrendline', 'Rising trendline', 'bullish', 'channel', 'Uptrend support',
      'A straight line through three or more rising lows. Each time price dips to it, buyers step in a little higher.',
      "Two touches make a guess, three make a trendline. A close below it is the first sign the uptrend is over."),
    info('fallingTrendline', 'Falling trendline', 'bearish', 'channel', 'Downtrend resistance',
      'A straight line through three or more falling highs. Each time price bounces to it, sellers step in a little lower.',
      "Two touches make a guess, three make a trendline. A close above it is the first sign the downtrend is over."),
    info('volatilitySqueeze', 'Volatility squeeze', 'neutral', 'triangle', 'A big move, either way',
      'The candles have shrunk to a fraction of their usual size. Quiet periods like this tend to end with a burst.',
      "It tells you a move is coming, not which way. Let the breakout pick the side."),
    info('bullishChangeOfCharacter', 'Bullish change of character', 'bullish', 'structure', 'Downtrend may be over',
      'In a downtrend of lower highs and lower lows, price just closed above the last lower high. Traders call this a change of character (CHoCH).',
      "It's an early warning, not a new uptrend yet. A higher low on the next dip would confirm it."),
    info('bearishChangeOfCharacter', 'Bearish change of character', 'bearish', 'structure', 'Uptrend may be over',
      'In an uptrend of higher highs and higher lows, price just closed below the last higher low. Traders call this a change of character (CHoCH).',
      "It's an early warning, not a new downtrend yet. A lower high on the next bounce would confirm it."),
    info('islandBottom', 'Island bottom', 'bullish', 'gap', 'Bullish reversal',
      'Price gapped down, spent a few days stranded below, then gapped back up. The candles in between sit alone like an island.',
      "It's rare and needs real gaps on both sides. If price falls back into the island, the reversal failed."),
    info('islandTop', 'Island top', 'bearish', 'gap', 'Bearish reversal',
      'Price gapped up, spent a few days stranded above, then gapped back down. The candles in between sit alone like an island.',
      "It's rare and needs real gaps on both sides. If price climbs back into the island, the reversal failed."),
    info('breakawayGapUp', 'Breakaway gap up', 'bullish', 'gap', 'Bullish breakout',
      'After a quiet sideways stretch, price gapped up clean out of the range. Breakaway gaps often start a new trend.',
      'Wait a day or two: a breakaway gap that fills right away was a false start.'),
    info('breakawayGapDown', 'Breakaway gap down', 'bearish', 'gap', 'Bearish breakdown',
      'After a quiet sideways stretch, price gapped down clean out of the range. Breakaway gaps often start a new trend.',
      'Wait a day or two: a breakaway gap that fills right away was a false start.'),
    info('runawayGapUp', 'Runaway gap up', 'bullish', 'gap', 'Bullish continuation',
      'In the middle of an uptrend, price gapped up again. Buyers are so keen they skip prices, which often means the trend has more to go.',
      'It looks just like an exhaustion gap until later. A runaway gap stays open; an exhaustion gap fills.'),
    info('runawayGapDown', 'Runaway gap down', 'bearish', 'gap', 'Bearish continuation',
      'In the middle of a downtrend, price gapped down again. Sellers are so keen they skip prices, which often means the trend has more to go.',
      'It looks just like an exhaustion gap until later. A runaway gap stays open; an exhaustion gap fills.'),
    info('exhaustionGapDown', 'Exhaustion gap down', 'bullish', 'gap', 'Bullish reversal',
      'After a long slide, price gapped down one last time, then quickly climbed back and filled the gap. The final panic ran out of sellers.',
      "It only becomes an exhaustion gap once it's filled. Before that, it looks like one more gap down."),
    info('exhaustionGapUp', 'Exhaustion gap up', 'bearish', 'gap', 'Bearish reversal',
      'After a long run up, price gapped up one last time, then quickly fell back and filled the gap. The final burst ran out of buyers.',
      "It only becomes an exhaustion gap once it's filled. Before that, it looks like one more gap up."),
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
  // The average true range over the whole chart: a normal day's size here.
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

// Curved line of best fit: the parabola y = a·t² + b·t + c closest to the
// points, with t running from 0 (first point) to 1 (last point). The three
// "normal equations" of least squares are solved with Cramer's rule.
function fitParabola(points: ChartPoint[]) {
  const first = points[0].index
  const span = points[points.length - 1].index - first
  const t = (index: number) => (index - first) / span
  const s = [0, 0, 0, 0, 0] // sums of t^0 ... t^4
  const r = [0, 0, 0] // sums of y, t·y, t²·y
  for (const p of points) {
    const x = t(p.index)
    for (let k = 0; k < 5; k++) s[k] += x ** k
    for (let k = 0; k < 3; k++) r[k] += x ** k * p.price
  }
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const matrix = [
    [s[4], s[3], s[2]],
    [s[3], s[2], s[1]],
    [s[2], s[1], s[0]],
  ]
  const rhs = [r[2], r[1], r[0]]
  const d = det(matrix)
  // Cramer's rule: swap one column for the right-hand side.
  const solve = (col: number) => det(matrix.map((row, i) => row.map((v, j) => (j === col ? rhs[i] : v)))) / d
  const [a, b, c] = [solve(0), solve(1), solve(2)]
  return {
    a, // above 0: the curve opens upward (a U)
    at: (index: number) => a * t(index) ** 2 + b * t(index) + c,
    vertex: first + (-b / (2 * a)) * span, // the index where the curve turns
  }
}

function highestHigh(candles: Candle[], from: number, to: number): ChartPoint {
  let best = Math.max(0, from)
  for (let i = best; i <= to; i++) if (candles[i].high > candles[best].high) best = i
  return { index: best, price: candles[best].high }
}

function lowestLow(candles: Candle[], from: number, to: number): ChartPoint {
  let best = Math.max(0, from)
  for (let i = best; i <= to; i++) if (candles[i].low < candles[best].low) best = i
  return { index: best, price: candles[best].low }
}

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

// Rounding bottom: a slow U. We fit a parabola through the closes and check
// three things: it's a real U (not a V), price spent a good while near the
// bottom, and the right side has climbed back at least halfway.
const roundingBottom: Detector = ({ candles, atr, last, close }, side) => {
  for (const length of [50, 42, 34, 28]) {
    const start = last - length + 1
    if (start < 0) continue
    const points = candles.slice(start).map((c, k) => ({ index: start + k, price: c.close }))
    const curve = fitParabola(points)
    if (curve.a <= 0) continue
    const bottomAt = curve.vertex
    if (bottomAt < start + 0.3 * length || bottomAt > start + 0.72 * length) continue

    const bottom = curve.at(bottomAt)
    const left = curve.at(start) - bottom
    const right = curve.at(last) - bottom
    if (left < 4 * atr || right < 0.45 * left || right > 1.4 * left) continue

    // The closes hug the curve...
    const error = mean(points.map((p) => Math.abs(p.price - curve.at(p.index))))
    if (error > 0.12 * left) continue
    // ...and linger near the bottom (a V would race through it).
    const lowest = Math.min(...points.map((p) => p.price))
    const nearBottom = points.filter((p) => p.price <= lowest + 0.15 * left).length
    if (nearBottom < 0.22 * length) continue
    if (close < candles[last - 4].close) continue // still curling up

    const arc: ChartPoint[] = []
    for (let k = 0; k <= 16; k++) {
      const i = start + ((last - start) * k) / 16
      arc.push({ index: i, price: curve.at(i) - 0.6 * atr }) // just under the candles
    }
    const low = lowestLow(candles, Math.round(bottomAt) - 4, Math.round(bottomAt) + 4)
    return found(
      pick(side, 'roundingBottom', 'roundingTop'),
      [{ kind: 'curve', points: arc }, { kind: 'dot', at: low, label: 'Bottom', place: 'below' }],
      start,
      last,
      { index: Math.round(bottomAt), price: low.price - 2 * atr },
    )
  }
  return null
}

// V-bottom: a steep fall straight into a steep climb, with only a few
// candles anywhere near the low.
const vBottom: Detector = ({ candles, pivots, atr, last, close }, side) => {
  // The lowest swing low of the last 14 candles (a small dip on the way back
  // up would otherwise count as the bottom).
  const lows = pivots.filter((p) => p.kind === 'low' && p.confirmed && last - p.index <= 14)
  if (lows.length === 0) return null
  const bottom = lows.reduce((a, b) => (b.price < a.price ? b : a))
  if (last - bottom.index < 3) return null

  const top = highestHigh(candles, bottom.index - 12, bottom.index)
  const drop = top.price - bottom.price
  const fallDays = bottom.index - top.index
  if (drop < 6 * atr || fallDays < 3 || drop / fallDays < 0.6 * atr) return null

  const peak = highestHigh(candles, bottom.index, last)
  const climb = peak.price - bottom.price
  const climbDays = peak.index - bottom.index
  if (climb < 0.6 * drop || climbDays < 2 || climb / climbDays < 0.5 * atr) return null
  if (close < bottom.price + 0.5 * drop) return null

  // A U spends about 45% of its time in the bottom fifth of its depth; a V, far less.
  const span = candles.slice(top.index, last + 1)
  if (span.filter((c) => c.low <= bottom.price + 0.2 * drop).length > 0.36 * span.length) return null

  return found(
    pick(side, 'vBottom', 'vTop'),
    [
      { kind: 'line', from: top, to: pt(bottom) },
      { kind: 'line', from: pt(bottom), to: peak },
      { kind: 'dot', at: pt(bottom), label: pick(side, 'Bottom', 'Top'), place: 'below' },
    ],
    top.index,
    last,
    { index: top.index, price: top.price + 1.5 * atr },
  )
}

// Diamond bottom: the swings spread out and then pull back in. The widest
// high and the widest low sit in the middle, and the ends are narrow.
const diamond: Detector = ({ candles, pivots, atr, last }, side) => {
  const swings = pivots.filter((p) => p.confirmed && last - p.index <= 55)
  for (let count = Math.min(9, swings.length); count >= 6; count--) {
    const used = swings.slice(-count)
    if (last - used[used.length - 1].index > 12) break
    const highs = used.filter((p) => p.kind === 'high')
    const lows = used.filter((p) => p.kind === 'low')
    if (highs.length < 3 || lows.length < 3) continue

    const top = highs.reduce((a, b) => (b.price > a.price ? b : a))
    const bottom = lows.reduce((a, b) => (b.price < a.price ? b : a))
    const [firstHigh, lastHigh] = [highs[0], highs[highs.length - 1]]
    const [firstLow, lastLow] = [lows[0], lows[lows.length - 1]]
    if (top === firstHigh || top === lastHigh || bottom === firstLow || bottom === lastLow) continue
    if (Math.abs(top.index - bottom.index) > 12) continue

    const width = top.price - bottom.price
    if (width < 6 * atr) continue
    const inside = (p: Pivot, share: number) => p.price <= top.price - share * width && p.price >= bottom.price + share * width
    if (!inside(firstHigh, 0.2) || !inside(firstLow, 0.2) || !inside(lastHigh, 0.25) || !inside(lastLow, 0.25)) continue
    if (lastHigh.price - lastLow.price > 0.6 * width) continue

    // A diamond bottom comes after a fall.
    const first = used[0].index
    const before = candles[Math.max(0, first - 10)].close
    if (first < 6 || before - (top.price + bottom.price) / 2 < 0.4 * width) continue

    return found(
      pick(side, 'diamondBottom', 'diamondTop'),
      [
        { kind: 'line', from: pt(firstHigh), to: pt(top) },
        { kind: 'line', from: pt(top), to: pt(lastHigh) },
        { kind: 'line', from: pt(firstLow), to: pt(bottom) },
        { kind: 'line', from: pt(bottom), to: pt(lastLow) },
      ],
      first,
      last,
      { index: top.index, price: top.price + 1.5 * atr },
    )
  }
  return null
}

// A gap up at candle i: its low is clearly above the previous candle's high.
const gapUpAt = (candles: Candle[], i: number, atr: number) => i > 0 && candles[i].low - candles[i - 1].high >= 0.25 * atr
const gapDownAt = (candles: Candle[], i: number, atr: number) => i > 0 && candles[i - 1].low - candles[i].high >= 0.25 * atr

// Gaps, in order of how much they say: an island, an exhaustion gap that got
// filled, a breakaway gap out of a range, then a runaway gap mid-trend.
const gaps: Detector = ({ candles, atr, last, close }, side) => {
  const recent = (days: number) => Array.from({ length: days }, (_, k) => last - k).filter((i) => i > 0)
  const gapShape = (at: number, price: number, label: string): Shape => ({ kind: 'level', price, fromIndex: at - 1, toIndex: Math.min(last, at + 4), label })

  // Island bottom: a gap down, a few stranded candles, then a gap up.
  for (const up of recent(10)) {
    if (!gapUpAt(candles, up, atr)) continue
    for (let down = up - 1; down >= Math.max(1, up - 12); down--) {
      if (!gapDownAt(candles, down, atr)) continue
      const island = candles.slice(down, up)
      const islandTop = Math.max(...island.map((c) => c.high))
      if (islandTop >= candles[down - 1].low || islandTop >= candles[up].low) continue
      return found(
        pick(side, 'islandBottom', 'islandTop'),
        [
          { kind: 'level', price: islandTop, fromIndex: down - 1, toIndex: up, label: 'Island' },
          { kind: 'dot', at: lowestLow(candles, down, up - 1), label: '', place: 'below' },
        ],
        down - 1,
        last,
        { index: down, price: islandTop + 2.5 * atr },
      )
    }
  }

  // Exhaustion gap down: a long slide, one more gap down, then price filled it.
  for (const g of recent(10)) {
    if (!gapDownAt(candles, g, atr) || g < 12) continue
    const slide = candles[Math.max(0, g - 20)].close - candles[g - 1].close
    const gapTop = candles[g - 1].low
    const filled = candles.slice(g + 1).some((c) => c.close > gapTop)
    if (slide >= 7 * atr && filled && close > candles[g].high) {
      return found(pick(side, 'exhaustionGapDown', 'exhaustionGapUp'), [gapShape(g, gapTop, 'Gap filled')], g - 1, last, {
        index: g,
        price: gapTop + 2.5 * atr,
      })
    }
  }

  // Breakaway and runaway gaps up, still open (price never came back to fill them).
  for (const g of recent(8)) {
    if (!gapUpAt(candles, g, atr) || g < 16) continue
    const gapBottom = candles[g - 1].high
    if (candles.slice(g).some((c) => c.low <= gapBottom)) continue
    const base = candles.slice(g - 15, g)
    const baseHigh = Math.max(...base.map((c) => c.high))
    const baseLow = Math.min(...base.map((c) => c.low))
    const label = { index: g, price: candles[g].low - 2.5 * atr }
    if (baseHigh - baseLow <= 7 * atr && candles[g].low > baseHigh) {
      return found(
        pick(side, 'breakawayGapUp', 'breakawayGapDown'),
        [{ kind: 'level', price: baseHigh, fromIndex: g - 15, toIndex: g, label: 'Range high' }, gapShape(g, gapBottom, 'Gap')],
        g - 15,
        last,
        label,
      )
    }
    if (candles[g - 1].close - candles[g - 15].close >= 5 * atr) {
      return found(pick(side, 'runawayGapUp', 'runawayGapDown'), [gapShape(g, gapBottom, 'Gap')], g - 15, last, label)
    }
  }
  return null
}

// Rising trendline: three or more swing lows on one rising straight line,
// with price never closing far below it.
const trendline: Detector = ({ candles, pivots, atr, last, close }, side) => {
  const lows = pivots.filter((p) => p.kind === 'low' && p.confirmed && last - p.index <= 55)
  for (let count = Math.min(5, lows.length); count >= 3; count--) {
    const touches = lows.slice(-count)
    const first = touches[0].index
    if (last - first < 15 || last - touches[count - 1].index > 25) continue
    const line = fitLine(touches.map(pt))
    if (line.slope < 0.05 * atr) continue
    if (!touches.every((p) => Math.abs(p.price - line.at(p.index)) <= 0.8 * atr)) continue
    if (candles.slice(first).some((c, k) => c.close < line.at(first + k) - 0.8 * atr)) continue
    if (close > line.at(last) + 5 * atr) continue // too far above for the line to matter

    return found(
      pick(side, 'risingTrendline', 'fallingTrendline'),
      [
        { kind: 'line', from: { index: first, price: line.at(first) }, to: { index: last, price: line.at(last) }, label: 'Trendline' },
        ...touches.map((p): Shape => ({ kind: 'dot', at: pt(p), label: '', place: 'below' })),
      ],
      first,
      last,
    )
  }
  return null
}

// Bullish change of character: a downtrend (a lower high, then a lower low),
// and then, in the last few candles, a close above that lower high.
const changeOfCharacter: Detector = ({ candles, pivots, atr, last }, side) => {
  const swings = pivots.filter((p) => p.confirmed && last - p.index <= 50)
  const highs = swings.filter((p) => p.kind === 'high')
  const lows = swings.filter((p) => p.kind === 'low')
  if (highs.length < 2 || lows.length < 2) return null

  const [earlierHigh, lowerHigh] = highs.slice(-2)
  const [earlierLow, lowerLow] = lows.slice(-2)
  if (lowerHigh.price > earlierHigh.price - 0.3 * atr || lowerLow.price > earlierLow.price - 0.3 * atr) return null
  if (lowerLow.index < lowerHigh.index) return null // the lower low has to come after the lower high

  // The first close above the lower high, after the lower low.
  let breakAt = -1
  for (let i = lowerLow.index + 1; i <= last; i++) {
    if (candles[i].close > lowerHigh.price + 0.2 * atr) {
      breakAt = i
      break
    }
  }
  if (breakAt < 0 || last - breakAt > 4) return null

  return found(
    pick(side, 'bullishChangeOfCharacter', 'bearishChangeOfCharacter'),
    [
      { kind: 'level', price: lowerHigh.price, fromIndex: lowerHigh.index, toIndex: last, label: pick(side, 'Last lower high', 'Last higher low') },
      { kind: 'dot', at: pt(earlierHigh), label: pick(side, 'High', 'Low'), place: 'above' },
      { kind: 'dot', at: pt(lowerHigh), label: pick(side, 'LH', 'HL'), place: 'above' },
      { kind: 'dot', at: pt(lowerLow), label: pick(side, 'LL', 'HH'), place: 'below' },
      { kind: 'dot', at: { index: breakAt, price: candles[breakAt].high }, label: 'CHoCH', place: 'above' },
    ],
    earlierHigh.index,
    last,
  )
}

// Volatility squeeze: the last 8 candles are less than half their usual size.
function squeeze({ candles, last }: Chart): ChartPatternMatch[] {
  if (last < 40) return []
  const size = (cs: Candle[]) => mean(cs.map((c) => c.high - c.low))
  const recent = candles.slice(last - 7)
  const usual = size(candles.slice(last - 37, last - 7))
  const top = Math.max(...recent.map((c) => c.high))
  const bottom = Math.min(...recent.map((c) => c.low))
  if (size(recent) > 0.5 * usual || top - bottom > 2.5 * usual) return []
  return [
    found(
      'volatilitySqueeze',
      [
        { kind: 'level', price: top, fromIndex: last - 7, toIndex: last, label: 'Squeeze' },
        { kind: 'level', price: bottom, fromIndex: last - 7, toIndex: last },
      ],
      last - 7,
      last,
    ),
  ]
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
      // Squeezing together: a triangle or a wedge.
      if (flat(up) && rising(down)) key = 'ascendingTriangle'
      else if (flat(down) && falling(up)) key = 'descendingTriangle'
      else if (falling(up) && rising(down)) key = 'symmetricalTriangle'
      else if (rising(up) && rising(down)) key = 'risingWedge'
      else if (falling(up) && falling(down)) key = 'fallingWedge'
    } else if (widthEnd > 1.5 * widthStart && widthStart > 0) {
      // Spreading apart: a broadening pattern (a megaphone). Two swings
      // spreading apart happen all the time, so these need five or more.
      if (used.length < 5) continue
      if (rising(up) && rising(down)) key = 'ascendingBroadeningWedge'
      else if (falling(up) && falling(down)) key = 'descendingBroadeningWedge'
      else if (!falling(up) && !rising(down)) key = 'broadeningFormation'
    } else if (Math.abs(up - down) <= 0.08 && widthStart >= 2 * atr) {
      // Parallel: a channel. A flat one right after a trend is a rectangle,
      // a pause that usually carries on in the trend's direction.
      const slope = (up + down) / 2
      if (rising(slope)) key = 'ascendingChannel'
      else if (falling(slope)) key = 'descendingChannel'
      else {
        const into = start >= 8 ? candles[start].close - candles[Math.max(0, start - 15)].close : 0
        key = into > 4 * atr ? 'bullishRectangle' : into < -4 * atr ? 'bearishRectangle' : 'horizontalChannel'
      }
    }
    if (!key) return []

    // Has the latest close already left the pattern?
    const broke = close > upper.at(last) + 0.25 * atr ? 'up' : close < lower.at(last) - 0.25 * atr ? 'down' : null
    const typical = CHART_PATTERNS[key].bias
    const bias: Bias = broke === 'up' ? 'bullish' : broke === 'down' ? 'bearish' : typical

    // Each line starts at its own first touch, so it doesn't dangle off into empty space.
    const upperFrom = highs[0].index
    const lowerFrom = lows[0].index
    const shapes: Shape[] = [
      { kind: 'line', from: { index: upperFrom, price: upper.at(upperFrom) }, to: { index: last, price: upper.at(last) } },
      { kind: 'line', from: { index: lowerFrom, price: lower.at(lowerFrom) }, to: { index: last, price: lower.at(last) } },
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
    ...bothWays(diamond, chart, flipped),
    ...bothWays(roundingBottom, chart, flipped),
    ...bothWays(vBottom, chart, flipped),
    ...bothWays(flagOrPennant, chart, flipped),
    ...trendLines(chart),
    ...squeeze(chart),
    ...bothWays(trendline, chart, flipped),
    ...bothWays(gaps, chart, flipped),
    ...bothWays(changeOfCharacter, chart, flipped),
    ...bothWays(marketStructure, chart, flipped),
    ...levels(chart),
  ]
}

// The most specific pattern families come first.
const PRIORITY: PatternFamily[] = ['reversal', 'flag', 'triangle', 'channel', 'breakout', 'gap', 'structure', 'level']

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
    // A reversal already explains the range it formed in. A rectangle or
    // trendline reading the same candles the other way would only confuse.
    const reversal = picked.find((p) => p.pattern.family === 'reversal')
    if (m.pattern.family === 'channel' && reversal && m.bias !== 'neutral' && m.bias !== reversal.bias) continue
    picked.push(m)
    if (picked.length === max) break
  }
  return picked
}

// A scanner match in the shape the Breakdown draws and lists.
export function toFinding(match: ChartPatternMatch): Finding {
  return {
    id: `scan-${match.pattern.key}`,
    name: match.pattern.name,
    type: 'chart',
    bias: match.bias,
    meaning: match.pattern.meaning,
    shapes: match.shapes,
    labelAt: match.labelAt,
  }
}
