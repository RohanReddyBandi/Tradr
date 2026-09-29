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

// Opens right at its low and climbs for most of the day, after a drop.
const bullishBeltHold: Test = (cs, i) => {
  const c = cs[i]
  return (
    isGreen(c) &&
    lowerWick(c) <= 0.03 * range(c) &&
    body(c) >= 0.6 * range(c) &&
    range(c) >= averageRange(cs, i) &&
    trendInto(cs, i) === 'down'
  )
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

// A harami whose small candle is a doji: the selling stalled completely.
const bullishHaramiCross: Test = (cs, i) => {
  if (i < 1) return false
  const [a, b] = [cs[i - 1], cs[i]]
  return (
    isRed(a) &&
    body(a) >= averageBody(cs, i - 1) &&
    range(b) > 0 &&
    body(b) <= 0.1 * range(b) &&
    bodyTop(b) <= a.open &&
    bodyBottom(b) >= a.close &&
    trendInto(cs, i - 1) === 'down'
  )
}

// A solid red candle, then a solid green one that gaps up above the red
// candle's open and never trades back down into it.
const bullishKicker: Test = (cs, i) => {
  if (i < 1) return false
  const [a, b] = [cs[i - 1], cs[i]]
  const solid = 0.8 * averageBody(cs, i - 1)
  return isRed(a) && isGreen(b) && body(a) >= solid && body(b) >= solid && b.low >= a.open
}

// Opens far below a big red candle, then rallies to close right where it closed.
const bullishCounterattack: Test = (cs, i) => {
  if (i < 1) return false
  const [a, b] = [cs[i - 1], cs[i]]
  return (
    isRed(a) &&
    body(a) >= averageBody(cs, i - 1) &&
    isGreen(b) &&
    b.open < a.low &&
    body(b) >= 0.6 * body(a) &&
    Math.abs(b.close - a.close) <= 0.1 * averageRange(cs, i - 1) &&
    trendInto(cs, i - 1) === 'down'
  )
}

// A gap: the whole candle sits above the one before, leaving an empty space.
const risingWindow: Test = (cs, i) => i >= 1 && cs[i].low - cs[i - 1].high >= 0.1 * averageRange(cs, i - 1)

// The whole candle fits inside a bigger one before it. Neutral, so no flipped twin.
const insideBar: Test = (cs, i) => {
  if (i < 1) return false
  const [a, b] = [cs[i - 1], cs[i]]
  return b.high < a.high && b.low > a.low && range(a) >= averageRange(cs, i - 1)
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

// A morning star whose middle candle is a doji.
const morningDojiStar: Test = (cs, i) => morningStar(cs, i) && body(cs[i - 1]) <= 0.1 * range(cs[i - 1])

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
  signals: string // what it usually points to, in a few words
  trap: string // the classic mistake with this pattern
  test: Test
}

export const CANDLE_PATTERNS: CandlePatternInfo[] = [
  // Five candles
  { key: 'risingThreeMethods', name: 'Rising three methods', bias: 'bullish', size: 5, test: risingThreeMethods,
    meaning: 'A big green candle, a few small pullback candles that stay inside it, then another big green candle. Buyers only paused.',
    signals: 'Bullish continuation',
    trap: "The pause candles must stay inside the first candle's range. If they break below it, the uptrend is in trouble, not resting." },
  { key: 'fallingThreeMethods', name: 'Falling three methods', bias: 'bearish', size: 5, test: flipped(risingThreeMethods),
    meaning: 'A big red candle, a few small bounce candles that stay inside it, then another big red candle. Sellers only paused.',
    signals: 'Bearish continuation',
    trap: "The pause candles must stay inside the first candle's range. If they break above it, the downtrend is in trouble, not resting." },

  // Three candles
  { key: 'abandonedBabyBullish', name: 'Bullish abandoned baby', bias: 'bullish', size: 3, test: abandonedBabyBullish,
    meaning: 'A doji that gapped away from the candles on both sides. A rare, sharp turn from selling to buying.',
    signals: 'Bullish reversal',
    trap: "It's rare on daily stock charts because real gaps on both sides are rare. Don't force it onto a doji that merely sits low." },
  { key: 'abandonedBabyBearish', name: 'Bearish abandoned baby', bias: 'bearish', size: 3, test: flipped(abandonedBabyBullish),
    meaning: 'A doji that gapped away from the candles on both sides. A rare, sharp turn from buying to selling.',
    signals: 'Bearish reversal',
    trap: "It's rare on daily stock charts because real gaps on both sides are rare. Don't force it onto a doji that merely sits high." },
  { key: 'morningDojiStar', name: 'Morning doji star', bias: 'bullish', size: 3, test: morningDojiStar,
    meaning: 'A big red candle, a doji, then a strong green candle. The doji shows the selling stopped dead before buyers took over.',
    signals: 'Bullish reversal',
    trap: "The doji alone proves nothing. It's the strong green candle after it that makes the turn." },
  { key: 'eveningDojiStar', name: 'Evening doji star', bias: 'bearish', size: 3, test: flipped(morningDojiStar),
    meaning: 'A big green candle, a doji, then a strong red candle. The doji shows the buying stopped dead before sellers took over.',
    signals: 'Bearish reversal',
    trap: "The doji alone proves nothing. It's the strong red candle after it that makes the turn." },
  { key: 'morningStar', name: 'Morning star', bias: 'bullish', size: 3, test: morningStar,
    meaning: 'A big red candle, a small pause candle, then a strong green candle. A three-day turn from selling to buying.',
    signals: 'Bullish reversal',
    trap: "The third candle has to close well into the first candle's body. A weak third candle is just a pause, not a turn." },
  { key: 'eveningStar', name: 'Evening star', bias: 'bearish', size: 3, test: flipped(morningStar),
    meaning: 'A big green candle, a small pause candle, then a strong red candle. A three-day turn from buying to selling.',
    signals: 'Bearish reversal',
    trap: "The third candle has to close well into the first candle's body. A weak third candle is just a pause, not a turn." },
  { key: 'threeWhiteSoldiers', name: 'Three white soldiers', bias: 'bullish', size: 3, test: threeWhiteSoldiers,
    meaning: 'Three strong green candles in a row, each closing higher. Steady, determined buying.',
    signals: 'Bullish reversal or continuation',
    trap: 'After a long run up, three more big green candles can mean buyers are worn out, not strong. Check what came before.' },
  { key: 'threeBlackCrows', name: 'Three black crows', bias: 'bearish', size: 3, test: flipped(threeWhiteSoldiers),
    meaning: 'Three strong red candles in a row, each closing lower. Steady, determined selling.',
    signals: 'Bearish reversal or continuation',
    trap: 'After a long slide, three more big red candles can mean sellers are worn out, not strong. Check what came before.' },
  { key: 'threeInsideUp', name: 'Three inside up', bias: 'bullish', size: 3, test: threeInsideUp,
    meaning: 'A bullish harami, then a third candle closing above the first. The turn up got confirmed.',
    signals: 'Bullish reversal',
    trap: "Without the third candle it's only a harami, which is much weaker. Wait for the confirmation." },
  { key: 'threeInsideDown', name: 'Three inside down', bias: 'bearish', size: 3, test: flipped(threeInsideUp),
    meaning: 'A bearish harami, then a third candle closing below the first. The turn down got confirmed.',
    signals: 'Bearish reversal',
    trap: "Without the third candle it's only a harami, which is much weaker. Wait for the confirmation." },
  { key: 'threeOutsideUp', name: 'Three outside up', bias: 'bullish', size: 3, test: threeOutsideUp,
    meaning: 'A bullish engulfing, then another higher close. Buyers took over and kept going.',
    signals: 'Bullish reversal',
    trap: "It's strongest at a support level. In the middle of a range it means much less." },
  { key: 'threeOutsideDown', name: 'Three outside down', bias: 'bearish', size: 3, test: flipped(threeOutsideUp),
    meaning: 'A bearish engulfing, then another lower close. Sellers took over and kept going.',
    signals: 'Bearish reversal',
    trap: "It's strongest at a resistance level. In the middle of a range it means much less." },

  // Two candles
  { key: 'bullishKicker', name: 'Bullish kicker', bias: 'bullish', size: 2, test: bullishKicker,
    meaning: "A solid red candle, then a solid green one that gaps up above where the red one opened. The mood flipped overnight.",
    signals: 'Strong bullish reversal',
    trap: 'It usually comes from news. If the gap fills (price drops back into the red candle), the signal is gone.' },
  { key: 'bearishKicker', name: 'Bearish kicker', bias: 'bearish', size: 2, test: flipped(bullishKicker),
    meaning: 'A solid green candle, then a solid red one that gaps down below where the green one opened. The mood flipped overnight.',
    signals: 'Strong bearish reversal',
    trap: 'It usually comes from news. If the gap fills (price climbs back into the green candle), the signal is gone.' },
  { key: 'bullishCounterattack', name: 'Bullish counterattack', bias: 'bullish', size: 2, test: bullishCounterattack,
    meaning: 'After a big red candle, the next one opens far lower, then rallies all the way back to the same close. Buyers erased the gap.',
    signals: 'Possible bullish reversal',
    trap: "It's weaker than a piercing line, because buyers only got back to even. Wait for the next candle to push higher." },
  { key: 'bearishCounterattack', name: 'Bearish counterattack', bias: 'bearish', size: 2, test: flipped(bullishCounterattack),
    meaning: 'After a big green candle, the next one opens far higher, then sinks all the way back to the same close. Sellers erased the gap.',
    signals: 'Possible bearish reversal',
    trap: "It's weaker than dark cloud cover, because sellers only got back to even. Wait for the next candle to push lower." },
  { key: 'bullishEngulfing', name: 'Bullish engulfing', bias: 'bullish', size: 2, test: bullishEngulfing,
    meaning: "A green candle whose body swallows the previous red one. Buyers overpowered sellers in a single day.",
    signals: 'Bullish reversal',
    trap: 'After a rise, an engulfing candle means little. It needs a drop before it, ideally into support.' },
  { key: 'bearishEngulfing', name: 'Bearish engulfing', bias: 'bearish', size: 2, test: flipped(bullishEngulfing),
    meaning: 'A red candle whose body swallows the previous green one. Sellers overpowered buyers in a single day.',
    signals: 'Bearish reversal',
    trap: 'After a drop, an engulfing candle means little. It needs a rise before it, ideally into resistance.' },
  { key: 'piercingLine', name: 'Piercing line', bias: 'bullish', size: 2, test: piercingLine,
    meaning: "Opened below the previous red candle, then rallied past the middle of it. Buyers fought back hard.",
    signals: 'Bullish reversal',
    trap: "If the green candle closes below the middle of the red one, it's much weaker. The halfway line is the whole point." },
  { key: 'darkCloudCover', name: 'Dark cloud cover', bias: 'bearish', size: 2, test: flipped(piercingLine),
    meaning: 'Opened above the previous green candle, then sank past the middle of it. Sellers fought back hard.',
    signals: 'Bearish reversal',
    trap: "If the red candle closes above the middle of the green one, it's much weaker. The halfway line is the whole point." },
  { key: 'bullishHaramiCross', name: 'Bullish harami cross', bias: 'bullish', size: 2, test: bullishHaramiCross,
    meaning: 'A doji tucked inside the previous big red candle. The selling stopped completely for a day.',
    signals: 'Early bullish reversal',
    trap: "A stall isn't a turn. It needs a green candle after it before it means buyers are in charge." },
  { key: 'bearishHaramiCross', name: 'Bearish harami cross', bias: 'bearish', size: 2, test: flipped(bullishHaramiCross),
    meaning: 'A doji tucked inside the previous big green candle. The buying stopped completely for a day.',
    signals: 'Early bearish reversal',
    trap: "A stall isn't a turn. It needs a red candle after it before it means sellers are in charge." },
  { key: 'bullishHarami', name: 'Bullish harami', bias: 'bullish', size: 2, test: bullishHarami,
    meaning: 'A small green candle tucked inside the previous big red one. The selling is losing force.',
    signals: 'Early bullish reversal',
    trap: "A harami only says the selling slowed down. It's a warning, not a buy signal on its own." },
  { key: 'bearishHarami', name: 'Bearish harami', bias: 'bearish', size: 2, test: flipped(bullishHarami),
    meaning: 'A small red candle tucked inside the previous big green one. The buying is losing force.',
    signals: 'Early bearish reversal',
    trap: "A harami only says the buying slowed down. It's a warning, not a sell signal on its own." },
  { key: 'tweezerBottom', name: 'Tweezer bottom', bias: 'bullish', size: 2, test: tweezerBottom,
    meaning: 'Two candles with matching lows. Price hit the same floor twice and held.',
    signals: 'Bullish reversal',
    trap: 'Matching lows in the middle of nowhere mean little. They matter at a support level.' },
  { key: 'tweezerTop', name: 'Tweezer top', bias: 'bearish', size: 2, test: flipped(tweezerBottom),
    meaning: 'Two candles with matching highs. Price hit the same ceiling twice and failed.',
    signals: 'Bearish reversal',
    trap: 'Matching highs in the middle of nowhere mean little. They matter at a resistance level.' },

  { key: 'risingWindow', name: 'Rising window', bias: 'bullish', size: 2, test: risingWindow,
    meaning: 'A gap up: the whole candle sits above the one before, leaving an empty space. Buyers were so eager they skipped those prices.',
    signals: 'Bullish continuation',
    trap: 'Gaps often get filled later. A gap that fills within a day or two was not a strong one.' },
  { key: 'fallingWindow', name: 'Falling window', bias: 'bearish', size: 2, test: flipped(risingWindow),
    meaning: 'A gap down: the whole candle sits below the one before, leaving an empty space. Sellers were so eager they skipped those prices.',
    signals: 'Bearish continuation',
    trap: 'Gaps often get filled later. A gap that fills within a day or two was not a strong one.' },
  { key: 'insideBar', name: 'Inside bar', bias: 'neutral', size: 2, test: insideBar,
    meaning: "The whole candle, wicks and all, fits inside the bigger one before it. The market is catching its breath.",
    signals: 'Pause before the next move',
    trap: "It doesn't say which way. Traders wait for price to break out of the bigger candle's high or low." },

  // One candle
  { key: 'bullishMarubozu', name: 'Bullish marubozu', bias: 'bullish', size: 1, test: bullishMarubozu,
    meaning: 'A full green candle with almost no wicks. Buyers were in control from the open to the close.',
    signals: 'Bullish momentum',
    trap: 'A huge candle can wear buyers out too. After a long run, the next day often gives some back.' },
  { key: 'bearishMarubozu', name: 'Bearish marubozu', bias: 'bearish', size: 1, test: flipped(bullishMarubozu),
    meaning: 'A full red candle with almost no wicks. Sellers were in control from the open to the close.',
    signals: 'Bearish momentum',
    trap: 'A huge candle can wear sellers out too. After a long slide, the next day often gives some back.' },
  { key: 'bullishBeltHold', name: 'Bullish belt hold', bias: 'bullish', size: 1, test: bullishBeltHold,
    meaning: 'After a drop, a candle opens at its low and climbs all day. Sellers never got a chance to push it lower.',
    signals: 'Bullish reversal',
    trap: "It's common and fairly weak on its own. It means more at a support level." },
  { key: 'bearishBeltHold', name: 'Bearish belt hold', bias: 'bearish', size: 1, test: flipped(bullishBeltHold),
    meaning: 'After a rise, a candle opens at its high and sinks all day. Buyers never got a chance to push it higher.',
    signals: 'Bearish reversal',
    trap: "It's common and fairly weak on its own. It means more at a resistance level." },
  { key: 'hammer', name: 'Hammer', bias: 'bullish', size: 1, test: hammer,
    meaning: 'A long lower wick after a drop. Sellers pushed price down, then buyers pushed it all the way back up.',
    signals: 'Bullish reversal',
    trap: 'The same shape after a rise is a hanging man, which means the opposite. Always check what came before.' },
  { key: 'shootingStar', name: 'Shooting star', bias: 'bearish', size: 1, test: flipped(hammer),
    meaning: 'A long upper wick after a rise. Buyers pushed price up, then sellers slammed it back down.',
    signals: 'Bearish reversal',
    trap: 'The same shape after a drop is an inverted hammer, which means the opposite. Always check what came before.' },
  { key: 'invertedHammer', name: 'Inverted hammer', bias: 'bullish', size: 1, test: invertedHammer,
    meaning: 'A long upper wick after a drop. Buyers made a first push up; it needs the next candle to follow through.',
    signals: 'Possible bullish reversal',
    trap: "On its own it's weak. It needs the next candle to close higher to mean much." },
  { key: 'hangingMan', name: 'Hanging man', bias: 'bearish', size: 1, test: flipped(invertedHammer),
    meaning: 'A hammer-shaped candle after a rise. Sellers showed up during the day, a warning the uptrend is tiring.',
    signals: 'Possible bearish reversal',
    trap: "On its own it's weak. It needs the next candle to close lower to mean much." },
  { key: 'dragonflyDoji', name: 'Dragonfly doji', bias: 'bullish', size: 1, test: dragonflyDoji,
    meaning: 'Opened and closed at the high after a deep dip. Buyers rejected the lower prices.',
    signals: 'Bullish reversal',
    trap: 'At the top of a rally the same candle is far less bullish. Where it appears decides what it means.' },
  { key: 'gravestoneDoji', name: 'Gravestone doji', bias: 'bearish', size: 1, test: flipped(dragonflyDoji),
    meaning: 'Opened and closed at the low after a spike up. Sellers rejected the higher prices.',
    signals: 'Bearish reversal',
    trap: 'At the bottom of a drop the same candle is far less bearish. Where it appears decides what it means.' },
  { key: 'longLeggedDoji', name: 'Long-legged doji', bias: 'neutral', size: 1, test: longLeggedDoji,
    meaning: 'Long wicks both ways and almost no body. A big fight with no winner.',
    signals: 'Indecision',
    trap: "It doesn't point either way. Wait for the next candle to see who won." },
  { key: 'doji', name: 'Doji', bias: 'neutral', size: 1, test: doji,
    meaning: 'Opened and closed at about the same price. Neither side won the day.',
    signals: 'Indecision',
    trap: 'Dojis are common and usually mean nothing. They only matter after a strong move or at a key level.' },
  { key: 'spinningTop', name: 'Spinning top', bias: 'neutral', size: 1, test: spinningTop,
    meaning: 'A small body with wicks on both sides. Nobody is in control.',
    signals: 'Indecision',
    trap: "It's a stretch to read it as a reversal. It just says neither side is in control today." },
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
// (a doji inside a morning star), resolveOverlaps keeps one.
export function findSignalPatterns(candles: Candle[]): CandleMatch[] {
  const last = candles.length - 1
  let matches = findCandlePatterns(candles, [last])
  if (matches.length === 0) matches = findCandlePatterns(candles, [last - 1])
  return resolveOverlaps(matches)
}

// When patterns share candles, keep one: a pattern that points somewhere beats
// an indecision pattern (a hammer says more than the inside bar it's part of),
// then the bigger pattern wins. Ties keep library order.
export function resolveOverlaps(matches: CandleMatch[]): CandleMatch[] {
  const neutralLast = (m: CandleMatch) => (m.pattern.bias === 'neutral' ? 1 : 0)
  const sorted = [...matches].sort((a, b) => neutralLast(a) - neutralLast(b) || b.pattern.size - a.pattern.size)

  const kept: CandleMatch[] = []
  for (const m of sorted) {
    const overlapsKept = kept.some((k) => m.start <= k.end && m.end >= k.start)
    if (!overlapsKept) kept.push(m)
  }
  return kept.sort((a, b) => a.start - b.start)
}
