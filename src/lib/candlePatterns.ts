import type { Bias, Candle } from '../types'

// ---------------------------------------------------------------------------
// Candle measurements
// ---------------------------------------------------------------------------

const body = (c: Candle) => Math.abs(c.close - c.open)
const range = (c: Candle) => c.high - c.low
const upperWick = (c: Candle) => c.high - Math.max(c.open, c.close)
const lowerWick = (c: Candle) => Math.min(c.open, c.close) - c.low
const isGreen = (c: Candle) => c.close > c.open
const isRed = (c: Candle) => c.close < c.open
const bodyTop = (c: Candle) => Math.max(c.open, c.close)
const bodyBottom = (c: Candle) => Math.min(c.open, c.close)
const bodyMiddle = (c: Candle) => (c.open + c.close) / 2

// Average high-to-low size of the `count` candles before index i. Patterns
// compare against this so they work the same at $5 or $500.
function averageRange(candles: Candle[], i: number, count = 10) {
  const slice = candles.slice(Math.max(0, i - count), i)
  if (slice.length === 0) return range(candles[i]) || 1
  return slice.reduce((sum, c) => sum + range(c), 0) / slice.length
}

function averageBody(candles: Candle[], i: number, count = 10) {
  const slice = candles.slice(Math.max(0, i - count), i)
  if (slice.length === 0) return body(candles[i]) || 1
  return slice.reduce((sum, c) => sum + body(c), 0) / slice.length
}

// Was price rising, falling, or going sideways *into* candle i?
// We compare the close just before i with the close `lookback` candles
// earlier, measured in average candle sizes.
export function trendInto(candles: Candle[], i: number, lookback = 6): 'up' | 'down' | 'flat' {
  const end = i - 1
  const start = end - lookback
  if (start < 0) return 'flat'
  const change = candles[end].close - candles[start].close
  const typical = averageRange(candles, i, lookback)
  if (change > 1.2 * typical) return 'up'
  if (change < -1.2 * typical) return 'down'
  return 'flat'
}

// ---------------------------------------------------------------------------
// The trick that halves this file: flip the chart upside down.
// Negating every price turns green candles red, highs into lows, and uptrends
// into downtrends. So a bearish engulfing is exactly a bullish engulfing on
// the flipped chart, a shooting star is a flipped hammer, and so on. We write
// each bullish test once and get the bearish one for free.
// ---------------------------------------------------------------------------

const flippedCache = new WeakMap<Candle[], Candle[]>()

function upsideDown(candles: Candle[]): Candle[] {
  let flipped = flippedCache.get(candles)
  if (!flipped) {
    flipped = candles.map((c) => ({ time: c.time, open: -c.open, close: -c.close, high: -c.low, low: -c.high }))
    flippedCache.set(candles, flipped)
  }
  return flipped
}

type Test = (candles: Candle[], i: number) => boolean // i = last candle of the pattern

const flipped =
  (test: Test): Test =>
  (candles, i) =>
    test(upsideDown(candles), i)

// ---------------------------------------------------------------------------
// Single-candle tests (i is the candle)
// ---------------------------------------------------------------------------

// Long lower wick, small body near the top. Shape shared by the hammer and hanging man.
function hammerShape(c: Candle) {
  const b = body(c)
  return (
    range(c) > 0 &&
    b >= 0.05 * range(c) &&
    b <= 0.35 * range(c) &&
    lowerWick(c) >= 2 * b &&
    upperWick(c) <= Math.max(0.1 * range(c), 0.5 * b)
  )
}

// Long upper wick, small body near the bottom. Shared by inverted hammer and shooting star.
const invertedHammerShape = (c: Candle) => hammerShape({ ...c, open: -c.open, close: -c.close, high: -c.low, low: -c.high })

const hammer: Test = (cs, i) => hammerShape(cs[i]) && trendInto(cs, i) === 'down'
const invertedHammer: Test = (cs, i) => invertedHammerShape(cs[i]) && trendInto(cs, i) === 'down'

const dragonflyDoji: Test = (cs, i) => {
  const c = cs[i]
  const r = range(c)
  return r > 0 && body(c) <= 0.1 * r && upperWick(c) <= 0.1 * r && lowerWick(c) >= 0.6 * r
}

const longLeggedDoji: Test = (cs, i) => {
  const c = cs[i]
  const r = range(c)
  return r >= averageRange(cs, i) && body(c) <= 0.1 * r && upperWick(c) >= 0.3 * r && lowerWick(c) >= 0.3 * r
}

const doji: Test = (cs, i) => {
  const c = cs[i]
  return range(c) > 0 && body(c) <= 0.08 * range(c)
}

const spinningTop: Test = (cs, i) => {
  const c = cs[i]
  const b = body(c)
  const r = range(c)
  return r > 0 && b > 0.1 * r && b <= 0.3 * r && upperWick(c) >= b && lowerWick(c) >= b
}

const bullishMarubozu: Test = (cs, i) => {
  const c = cs[i]
  return isGreen(c) && body(c) >= 0.9 * range(c) && range(c) >= 0.8 * averageRange(cs, i)
}

// ---------------------------------------------------------------------------
// Two-candle tests (a = i - 1, b = i)
// ---------------------------------------------------------------------------

const bullishEngulfing: Test = (cs, i) => {
  if (i < 1) return false
  const [a, b] = [cs[i - 1], cs[i]]
  return (
    isRed(a) &&
    isGreen(b) &&
    b.open <= a.close &&
    b.close >= a.open &&
    body(b) > body(a) &&
    trendInto(cs, i - 1) !== 'up'
  )
}

const bullishHarami: Test = (cs, i) => {
  if (i < 1) return false
  const [a, b] = [cs[i - 1], cs[i]]
  return (
    isRed(a) &&
    body(a) >= averageBody(cs, i - 1) &&
    isGreen(b) &&
    bodyTop(b) <= a.open &&
    bodyBottom(b) >= a.close &&
    body(b) <= 0.5 * body(a) &&
    trendInto(cs, i - 1) === 'down'
  )
}

const piercingLine: Test = (cs, i) => {
  if (i < 1) return false
  const [a, b] = [cs[i - 1], cs[i]]
  return (
    isRed(a) &&
    body(a) >= averageBody(cs, i - 1) &&
    isGreen(b) &&
    b.open < a.close &&
    b.close > bodyMiddle(a) &&
    b.close < a.open &&
    trendInto(cs, i - 1) === 'down'
  )
}

const tweezerBottom: Test = (cs, i) => {
  if (i < 1) return false
  const [a, b] = [cs[i - 1], cs[i]]
  return (
    isRed(a) &&
    isGreen(b) &&
    Math.abs(a.low - b.low) <= 0.05 * averageRange(cs, i - 1) &&
    trendInto(cs, i - 1) === 'down'
  )
}

// ---------------------------------------------------------------------------
// Three-candle tests (a = i - 2, b = i - 1, c = i)
// ---------------------------------------------------------------------------

const morningStar: Test = (cs, i) => {
  if (i < 2) return false
  const [a, b, c] = [cs[i - 2], cs[i - 1], cs[i]]
  return (
    isRed(a) &&
    body(a) >= averageBody(cs, i - 2) &&
    body(b) <= 0.35 * body(a) && // the small "star" in the middle
    bodyTop(b) <= a.close + 0.1 * body(a) && // star sits below the first candle's body
    isGreen(c) &&
    c.close > bodyMiddle(a) &&
    trendInto(cs, i - 2) === 'down'
  )
}

const abandonedBabyBullish: Test = (cs, i) => {
  if (i < 2) return false
  const [a, b, c] = [cs[i - 2], cs[i - 1], cs[i]]
  return (
    isRed(a) &&
    body(b) <= 0.1 * range(b) && // the middle candle is a doji...
    b.high < a.low && // ...that gapped below the first candle...
    b.high < c.low && // ...and below the third
    isGreen(c) &&
    trendInto(cs, i - 2) === 'down'
  )
}

const threeWhiteSoldiers: Test = (cs, i) => {
  if (i < 2) return false
  const three = [cs[i - 2], cs[i - 1], cs[i]]
  const minBody = 0.6 * averageBody(cs, i - 2)
  return three.every((c, k) => {
    if (!isGreen(c) || body(c) < minBody || upperWick(c) > 0.35 * body(c)) return false
    if (k === 0) return true
    const prev = three[k - 1]
    // Each opens inside the previous body and closes higher.
    return c.open >= prev.open && c.open <= prev.close && c.close > prev.close
  })
}

const threeInsideUp: Test = (cs, i) => bullishHarami(cs, i - 1) && isGreen(cs[i]) && cs[i].close > cs[i - 2].open

const threeOutsideUp: Test = (cs, i) => bullishEngulfing(cs, i - 1) && isGreen(cs[i]) && cs[i].close > cs[i - 1].close

// ---------------------------------------------------------------------------
// Five-candle test (a = i - 4 ... e = i)
// ---------------------------------------------------------------------------

const risingThreeMethods: Test = (cs, i) => {
  if (i < 4) return false
  const [a, b, c, d, e] = cs.slice(i - 4, i + 1)
  const middle = [b, c, d]
  return (
    isGreen(a) &&
    body(a) >= 1.2 * averageBody(cs, i - 4) &&
    middle.every((m) => body(m) <= 0.6 * body(a) && m.high <= a.high && m.low >= a.low) &&
    middle.filter(isRed).length >= 2 &&
    isGreen(e) &&
    e.close > a.close
  )
}

// ---------------------------------------------------------------------------
// The pattern library. Longer patterns come first, and within the same size
// the more specific pattern comes first (e.g. abandoned baby before morning
// star), because when two patterns cover the same candles we keep the first.
// ---------------------------------------------------------------------------

export interface CandlePatternInfo {
  key: string
  name: string
  bias: Bias
  size: number // how many candles it spans
  meaning: string
  test: Test
}

export const CANDLE_PATTERNS: CandlePatternInfo[] = [
  // Five candles
  { key: 'risingThreeMethods', name: 'Rising three methods', bias: 'bullish', size: 5, test: risingThreeMethods,
    meaning: 'A big green candle, a few small pullback candles that stay inside it, then another big green candle. Buyers only paused.' },
  { key: 'fallingThreeMethods', name: 'Falling three methods', bias: 'bearish', size: 5, test: flipped(risingThreeMethods),
    meaning: 'A big red candle, a few small bounce candles that stay inside it, then another big red candle. Sellers only paused.' },

  // Three candles
  { key: 'abandonedBabyBullish', name: 'Bullish abandoned baby', bias: 'bullish', size: 3, test: abandonedBabyBullish,
    meaning: 'A doji that gapped away from the candles on both sides. A rare, sharp turn from selling to buying.' },
  { key: 'abandonedBabyBearish', name: 'Bearish abandoned baby', bias: 'bearish', size: 3, test: flipped(abandonedBabyBullish),
    meaning: 'A doji that gapped away from the candles on both sides. A rare, sharp turn from buying to selling.' },
  { key: 'morningStar', name: 'Morning star', bias: 'bullish', size: 3, test: morningStar,
    meaning: 'A big red candle, a small pause candle, then a strong green candle. A three-day turn from selling to buying.' },
  { key: 'eveningStar', name: 'Evening star', bias: 'bearish', size: 3, test: flipped(morningStar),
    meaning: 'A big green candle, a small pause candle, then a strong red candle. A three-day turn from buying to selling.' },
  { key: 'threeWhiteSoldiers', name: 'Three white soldiers', bias: 'bullish', size: 3, test: threeWhiteSoldiers,
    meaning: 'Three strong green candles in a row, each closing higher. Steady, determined buying.' },
  { key: 'threeBlackCrows', name: 'Three black crows', bias: 'bearish', size: 3, test: flipped(threeWhiteSoldiers),
    meaning: 'Three strong red candles in a row, each closing lower. Steady, determined selling.' },
  { key: 'threeInsideUp', name: 'Three inside up', bias: 'bullish', size: 3, test: threeInsideUp,
    meaning: 'A bullish harami, then a third candle closing above the first. The turn up got confirmed.' },
  { key: 'threeInsideDown', name: 'Three inside down', bias: 'bearish', size: 3, test: flipped(threeInsideUp),
    meaning: 'A bearish harami, then a third candle closing below the first. The turn down got confirmed.' },
  { key: 'threeOutsideUp', name: 'Three outside up', bias: 'bullish', size: 3, test: threeOutsideUp,
    meaning: 'A bullish engulfing, then another higher close. Buyers took over and kept going.' },
  { key: 'threeOutsideDown', name: 'Three outside down', bias: 'bearish', size: 3, test: flipped(threeOutsideUp),
    meaning: 'A bearish engulfing, then another lower close. Sellers took over and kept going.' },

  // Two candles
  { key: 'bullishEngulfing', name: 'Bullish engulfing', bias: 'bullish', size: 2, test: bullishEngulfing,
    meaning: "A green candle whose body swallows the previous red one. Buyers overpowered sellers in a single day." },
  { key: 'bearishEngulfing', name: 'Bearish engulfing', bias: 'bearish', size: 2, test: flipped(bullishEngulfing),
    meaning: 'A red candle whose body swallows the previous green one. Sellers overpowered buyers in a single day.' },
  { key: 'piercingLine', name: 'Piercing line', bias: 'bullish', size: 2, test: piercingLine,
    meaning: "Opened below the previous red candle, then rallied past the middle of it. Buyers fought back hard." },
  { key: 'darkCloudCover', name: 'Dark cloud cover', bias: 'bearish', size: 2, test: flipped(piercingLine),
    meaning: 'Opened above the previous green candle, then sank past the middle of it. Sellers fought back hard.' },
  { key: 'bullishHarami', name: 'Bullish harami', bias: 'bullish', size: 2, test: bullishHarami,
    meaning: 'A small green candle tucked inside the previous big red one. The selling is losing force.' },
  { key: 'bearishHarami', name: 'Bearish harami', bias: 'bearish', size: 2, test: flipped(bullishHarami),
    meaning: 'A small red candle tucked inside the previous big green one. The buying is losing force.' },
  { key: 'tweezerBottom', name: 'Tweezer bottom', bias: 'bullish', size: 2, test: tweezerBottom,
    meaning: 'Two candles with matching lows. Price hit the same floor twice and held.' },
  { key: 'tweezerTop', name: 'Tweezer top', bias: 'bearish', size: 2, test: flipped(tweezerBottom),
    meaning: 'Two candles with matching highs. Price hit the same ceiling twice and failed.' },

  // One candle
  { key: 'bullishMarubozu', name: 'Bullish marubozu', bias: 'bullish', size: 1, test: bullishMarubozu,
    meaning: 'A full green candle with almost no wicks. Buyers were in control from the open to the close.' },
  { key: 'bearishMarubozu', name: 'Bearish marubozu', bias: 'bearish', size: 1, test: flipped(bullishMarubozu),
    meaning: 'A full red candle with almost no wicks. Sellers were in control from the open to the close.' },
  { key: 'hammer', name: 'Hammer', bias: 'bullish', size: 1, test: hammer,
    meaning: 'A long lower wick after a drop. Sellers pushed price down, then buyers pushed it all the way back up.' },
  { key: 'shootingStar', name: 'Shooting star', bias: 'bearish', size: 1, test: flipped(hammer),
    meaning: 'A long upper wick after a rise. Buyers pushed price up, then sellers slammed it back down.' },
  { key: 'invertedHammer', name: 'Inverted hammer', bias: 'bullish', size: 1, test: invertedHammer,
    meaning: 'A long upper wick after a drop. Buyers made a first push up; it needs the next candle to follow through.' },
  { key: 'hangingMan', name: 'Hanging man', bias: 'bearish', size: 1, test: flipped(invertedHammer),
    meaning: 'A hammer-shaped candle after a rise. Sellers showed up during the day, a warning the uptrend is tiring.' },
  { key: 'dragonflyDoji', name: 'Dragonfly doji', bias: 'bullish', size: 1, test: dragonflyDoji,
    meaning: 'Opened and closed at the high after a deep dip. Buyers rejected the lower prices.' },
  { key: 'gravestoneDoji', name: 'Gravestone doji', bias: 'bearish', size: 1, test: flipped(dragonflyDoji),
    meaning: 'Opened and closed at the low after a spike up. Sellers rejected the higher prices.' },
  { key: 'longLeggedDoji', name: 'Long-legged doji', bias: 'neutral', size: 1, test: longLeggedDoji,
    meaning: 'Long wicks both ways and almost no body. A big fight with no winner.' },
  { key: 'doji', name: 'Doji', bias: 'neutral', size: 1, test: doji,
    meaning: 'Opened and closed at about the same price. Neither side won the day.' },
  { key: 'spinningTop', name: 'Spinning top', bias: 'neutral', size: 1, test: spinningTop,
    meaning: 'A small body with wicks on both sides. Nobody is in control.' },
]

export interface CandleMatch {
  pattern: CandlePatternInfo
  start: number // index of the first candle in the pattern
  end: number // index of the last candle
}

// Find every candlestick pattern that ends at one of the given indexes
// (all candles by default).
export function findCandlePatterns(candles: Candle[], endIndexes?: number[]): CandleMatch[] {
  const ends = endIndexes ?? candles.map((_, i) => i)
  const matches: CandleMatch[] = []
  for (const end of ends) {
    for (const pattern of CANDLE_PATTERNS) {
      const start = end - pattern.size + 1
      if (start >= 0 && pattern.test(candles, end)) matches.push({ pattern, start, end })
    }
  }
  return matches
}

// The patterns right at the decision point. We look for patterns that finish
// on the very last candle; only if there are none do we look one candle
// earlier (the newest candle always has the final say). If patterns overlap
// (a doji inside a morning star), we keep the bigger one.
export function findSignalPatterns(candles: Candle[]): CandleMatch[] {
  const last = candles.length - 1
  let matches = findCandlePatterns(candles, [last])
  if (matches.length === 0) matches = findCandlePatterns(candles, [last - 1])
  // Bigger patterns first; ties keep library order.
  matches.sort((a, b) => b.pattern.size - a.pattern.size)

  const kept: CandleMatch[] = []
  for (const m of matches) {
    const overlapsKept = kept.some((k) => m.start <= k.end && m.end >= k.start)
    if (!overlapsKept) kept.push(m)
  }
  return kept.sort((a, b) => a.start - b.start)
}
