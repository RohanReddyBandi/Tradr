import type { Rng } from './random'

// A candle without a date yet.
export interface Bar {
  open: number
  high: number
  low: number
  close: number
}

// Make a bar from its open and close plus how far the wicks stick out.
function bar(open: number, close: number, upperWick: number, lowerWick: number): Bar {
  return {
    open,
    close,
    high: Math.max(open, close) + upperWick,
    low: Math.min(open, close) - lowerWick,
  }
}

// Each recipe builds the candles of one *bullish* candlestick pattern, as if
// the previous candle closed at 0. The generator then shifts them to the real
// price (and flips them upside down for the bearish version).
// `R` is the size of a typical candle, so every pattern is drawn to scale.
type Recipe = (R: number, rng: Rng) => Bar[]

const hammer: Recipe = (R, rng) => {
  const b = 0.22 * R * rng.range(0.9, 1.1)
  const open = -0.1 * R
  return [bar(open, open + b, 0.02 * R, b * rng.range(2.6, 3.4))]
}

const invertedHammer: Recipe = (R, rng) => {
  const b = 0.22 * R * rng.range(0.9, 1.1)
  const open = -0.1 * R
  return [bar(open, open + b, b * rng.range(2.6, 3.4), 0.02 * R)]
}

const dragonflyDoji: Recipe = (R, rng) => {
  const open = -0.05 * R
  return [bar(open, open + 0.01 * R, 0.02 * R, rng.range(1.15, 1.7) * R)]
}

const bullishEngulfing: Recipe = (R, rng) => {
  const red = bar(rng.range(0.02, 0.1) * R, -rng.range(0.45, 0.75) * R, rng.range(0.05, 0.18) * R, rng.range(0.05, 0.15) * R)
  const green = bar(red.close - rng.range(0.03, 0.12) * R, red.open + rng.range(0.2, 0.6) * R, rng.range(0.04, 0.14) * R, rng.range(0.06, 0.18) * R)
  return [red, green]
}

const threeOutsideUp: Recipe = (R, rng) => {
  const [red, green] = bullishEngulfing(R, rng)
  return [red, green, bar(green.close - rng.range(0.02, 0.1) * R, green.close + rng.range(0.4, 0.8) * R, rng.range(0.04, 0.12) * R, 0.06 * R)]
}

const piercingLine: Recipe = (R, rng) => {
  const redBody = rng.range(0.85, 1.25) * R
  const red = bar(0.05 * R, 0.05 * R - redBody, rng.range(0.05, 0.15) * R, rng.range(0.05, 0.15) * R)
  // Opens below the red close, closes past its middle but short of its open.
  const green = bar(red.close - rng.range(0.12, 0.3) * R, red.close + redBody * rng.range(0.58, 0.85), 0.1 * R, rng.range(0.05, 0.15) * R)
  return [red, green]
}

const tweezerBottom: Recipe = (R, rng) => {
  const red = bar(0, -rng.range(0.45, 0.8) * R, 0.1 * R, rng.range(0.2, 0.4) * R)
  const open = red.close + 0.05 * R
  // The green candle's wick reaches down to exactly the same low.
  const green = bar(open, open + rng.range(0.35, 0.7) * R, rng.range(0.05, 0.15) * R, open - red.low)
  return [red, green]
}

const bullishHarami: Recipe = (R, rng) => {
  const redBody = rng.range(1.05, 1.45) * R
  const red = bar(0.05 * R, 0.05 * R - redBody, rng.range(0.05, 0.15) * R, rng.range(0.05, 0.15) * R)
  // A small green body tucked inside the red one.
  const open = red.close + redBody * rng.range(0.12, 0.35)
  const green = bar(open, open + redBody * rng.range(0.2, 0.42), 0.1 * R, 0.1 * R)
  return [red, green]
}

const threeInsideUp: Recipe = (R, rng) => {
  const [red, green] = bullishHarami(R, rng)
  return [red, green, bar(green.close, red.open + rng.range(0.12, 0.45) * R, 0.1 * R, 0.05 * R)]
}

const morningStar: Recipe = (R, rng) => {
  const redBody = rng.range(0.95, 1.35) * R
  const red = bar(0, -redBody, 0.1 * R, 0.1 * R)
  const starOpen = red.close - rng.range(0.1, 0.25) * R
  const star = bar(starOpen, starOpen + (rng.chance(0.5) ? 1 : -1) * rng.range(0.05, 0.14) * R, rng.range(0.1, 0.25) * R, rng.range(0.1, 0.25) * R)
  const green = bar(star.close + 0.05 * R, red.close + redBody * rng.range(0.62, 0.95), 0.08 * R, 0.08 * R)
  return [red, star, green]
}

const abandonedBaby: Recipe = (R) => {
  const red = bar(0, -1.1 * R, 0.1 * R, 0.1 * R)
  const dojiOpen = red.low - 0.35 * R // gaps below the red candle
  const doji = bar(dojiOpen, dojiOpen + 0.005 * R, 0.1 * R, 0.1 * R)
  const greenOpen = doji.high + 0.25 * R // and the green candle gaps above the doji
  return [red, doji, bar(greenOpen, greenOpen + 0.9 * R, 0.08 * R, 0.05 * R)]
}

const bullishMarubozu: Recipe = (R, rng) => {
  const open = 0.02 * R
  return [bar(open, open + 1.5 * R * rng.range(0.95, 1.15), 0.03 * R, 0.03 * R)]
}

const threeWhiteSoldiers: Recipe = (R, rng) => {
  const first = bar(0, rng.range(0.7, 1) * R, 0.08 * R, 0.06 * R)
  // Each opens inside the one before and closes higher.
  const next = (prev: Bar) => {
    const open = prev.close - (prev.close - prev.open) * rng.range(0.15, 0.45)
    return bar(open, prev.close + rng.range(0.4, 0.75) * R, rng.range(0.03, 0.1) * R, 0.05 * R)
  }
  const second = next(first)
  return [first, second, next(second)]
}

const risingThreeMethods: Recipe = (R) => {
  const big = bar(0, 1.5 * R, 0.06 * R, 0.06 * R)
  const pause1 = bar(big.close - 0.05 * R, big.close - 0.35 * R, 0.05 * R, 0.05 * R)
  const pause2 = bar(pause1.close + 0.05 * R, pause1.close - 0.25 * R, 0.05 * R, 0.05 * R)
  const pause3 = bar(pause2.close, pause2.close + 0.2 * R, 0.05 * R, 0.05 * R)
  const finish = bar(pause3.close + 0.02 * R, big.close + 0.5 * R, 0.05 * R, 0.05 * R)
  return [big, pause1, pause2, pause3, finish]
}

const morningDojiStar: Recipe = (R) => {
  const red = bar(0, -1.1 * R, 0.1 * R, 0.1 * R)
  const dojiOpen = red.close - 0.15 * R
  const doji = bar(dojiOpen, dojiOpen + 0.005 * R, 0.15 * R, 0.15 * R)
  return [red, doji, bar(doji.close + 0.05 * R, red.close + 0.8 * R, 0.08 * R, 0.08 * R)]
}

const bullishHaramiCross: Recipe = (R) => {
  const red = bar(0.05 * R, -1.15 * R, 0.1 * R, 0.1 * R)
  const dojiOpen = red.close + 0.45 * R
  return [red, bar(dojiOpen, dojiOpen + 0.01 * R, 0.2 * R, 0.2 * R)]
}

const bullishKicker: Recipe = (R, rng) => {
  const red = bar(0, -rng.range(0.75, 1.1) * R, 0.05 * R, 0.05 * R)
  const open = red.open + rng.range(0.15, 0.4) * R // gaps up above where the red candle opened
  return [red, bar(open, open + rng.range(0.95, 1.4) * R, 0.08 * R, 0.03 * R)]
}

const bullishCounterattack: Recipe = (R) => {
  const red = bar(0.05 * R, -1.1 * R, 0.1 * R, 0.1 * R)
  const open = red.low - 0.65 * R // opens far below...
  return [red, bar(open, red.close + 0.005 * R, 0.08 * R, 0.1 * R)] // ...and closes right where the red one did
}

const risingWindow: Recipe = (R, rng) => {
  const first = bar(0, rng.range(0.5, 0.7) * R, 0.1 * R, 0.1 * R)
  const open = first.high + rng.range(0.35, 0.5) * R // the gap
  return [first, bar(open, open + rng.range(0.45, 0.8) * R, 0.1 * R, 0.05 * R)]
}

// One strong green candle that opens well above the last close: a clear gap.
const gapUp: Recipe = (R, rng) => {
  const open = rng.range(0.9, 1.2) * R
  return [bar(open, open + rng.range(0.6, 0.9) * R, 0.1 * R, 0.05 * R)]
}

const bullishBeltHold: Recipe = (R, rng) => {
  const open = -rng.range(0.5, 0.8) * R // gaps down, then climbs all day from the open
  return [bar(open, open + rng.range(1.05, 1.35) * R, rng.range(0.1, 0.3) * R, 0)]
}

// Indecision candles for charts with no setup.
const insideBar: Recipe = (R) => {
  const big = bar(0, 0.9 * R, 0.2 * R, 0.2 * R)
  return [big, bar(0.6 * R, 0.4 * R, 0.1 * R, 0.1 * R)]
}
const doji: Recipe = (R, rng) => [bar(0, (rng.chance(0.5) ? 0.02 : -0.02) * R, rng.range(0.25, 0.55) * R, rng.range(0.25, 0.55) * R)]
const spinningTop: Recipe = (R, rng) => {
  const b = rng.range(0.15, 0.25) * R
  return [bar(0, rng.chance(0.5) ? b : -b, b * rng.range(1.2, 2), b * rng.range(1.2, 2))]
}
const longLeggedDoji: Recipe = (R, rng) => [bar(0, 0.02 * R, rng.range(0.6, 0.9) * R, rng.range(0.6, 0.9) * R)]

export const SIGNAL_RECIPES = {
  hammer,
  invertedHammer,
  dragonflyDoji,
  bullishEngulfing,
  threeOutsideUp,
  piercingLine,
  tweezerBottom,
  bullishHarami,
  threeInsideUp,
  morningStar,
  abandonedBaby,
  bullishMarubozu,
  threeWhiteSoldiers,
  risingThreeMethods,
  morningDojiStar,
  bullishHaramiCross,
  bullishKicker,
  bullishCounterattack,
  risingWindow,
  bullishBeltHold,
  gapUp,
  doji,
  spinningTop,
  longLeggedDoji,
  insideBar,
}

export type SignalKey = keyof typeof SIGNAL_RECIPES

// Candles that turn price around at a floor.
export const REVERSAL_SIGNALS: SignalKey[] = [
  'hammer',
  'invertedHammer',
  'dragonflyDoji',
  'bullishEngulfing',
  'piercingLine',
  'tweezerBottom',
  'bullishHarami',
  'threeInsideUp',
  'morningStar',
  'abandonedBaby',
  'morningDojiStar',
  'bullishHaramiCross',
  'bullishBeltHold',
  'bullishCounterattack',
  'bullishKicker',
]

// Candles that push price through a line.
export const BREAKOUT_SIGNALS: SignalKey[] = ['bullishMarubozu', 'threeWhiteSoldiers', 'risingWindow', 'bullishKicker', 'risingThreeMethods', 'gapUp']

// Big, obvious signals, used on easy cards...
export const STRONG_SIGNALS: SignalKey[] = [
  'bullishEngulfing',
  'morningStar',
  'hammer',
  'piercingLine',
  'threeOutsideUp',
  'bullishMarubozu',
  'threeWhiteSoldiers',
  'risingThreeMethods',
  'doji',
  'longLeggedDoji',
]

// ...and quieter ones that are easy to miss, used on hard cards.
export const SUBTLE_SIGNALS: SignalKey[] = [
  'bullishHarami',
  'invertedHammer',
  'tweezerBottom',
  'dragonflyDoji',
  'threeInsideUp',
  'abandonedBaby',
  'bullishHaramiCross',
  'spinningTop',
]

// Hard cards sometimes end with one of these in the middle of a choppy range:
// a strong-looking candle with nothing behind it.
export const DECOY_SIGNALS: SignalKey[] = ['bullishMarubozu', 'bullishEngulfing']

// ---------------------------------------------------------------------------
// Every candlestick pattern in the library, and the recipe that draws it.
// Bearish patterns are a bullish recipe drawn upside down.
// ---------------------------------------------------------------------------

export type LeadIn = 'down' | 'up' | 'flat'
export interface CandleRecipe {
  recipe: SignalKey
  flipped?: boolean // build the bullish version, then turn it upside down
  lead?: LeadIn // the move into the pattern (down by default)
}

export const CANDLE_RECIPES: Record<string, CandleRecipe> = {
  hammer: { recipe: 'hammer' },
  shootingStar: { recipe: 'hammer', flipped: true },
  invertedHammer: { recipe: 'invertedHammer' },
  hangingMan: { recipe: 'invertedHammer', flipped: true },
  dragonflyDoji: { recipe: 'dragonflyDoji' },
  gravestoneDoji: { recipe: 'dragonflyDoji', flipped: true },
  longLeggedDoji: { recipe: 'longLeggedDoji', lead: 'flat' },
  doji: { recipe: 'doji', lead: 'flat' },
  spinningTop: { recipe: 'spinningTop', lead: 'flat' },
  bullishMarubozu: { recipe: 'bullishMarubozu', lead: 'flat' },
  bearishMarubozu: { recipe: 'bullishMarubozu', lead: 'flat', flipped: true },
  bullishEngulfing: { recipe: 'bullishEngulfing' },
  bearishEngulfing: { recipe: 'bullishEngulfing', flipped: true },
  piercingLine: { recipe: 'piercingLine' },
  darkCloudCover: { recipe: 'piercingLine', flipped: true },
  bullishHarami: { recipe: 'bullishHarami' },
  bearishHarami: { recipe: 'bullishHarami', flipped: true },
  tweezerBottom: { recipe: 'tweezerBottom' },
  tweezerTop: { recipe: 'tweezerBottom', flipped: true },
  morningStar: { recipe: 'morningStar' },
  eveningStar: { recipe: 'morningStar', flipped: true },
  abandonedBabyBullish: { recipe: 'abandonedBaby' },
  abandonedBabyBearish: { recipe: 'abandonedBaby', flipped: true },
  threeWhiteSoldiers: { recipe: 'threeWhiteSoldiers' },
  threeBlackCrows: { recipe: 'threeWhiteSoldiers', flipped: true },
  threeInsideUp: { recipe: 'threeInsideUp' },
  threeInsideDown: { recipe: 'threeInsideUp', flipped: true },
  threeOutsideUp: { recipe: 'threeOutsideUp' },
  threeOutsideDown: { recipe: 'threeOutsideUp', flipped: true },
  risingThreeMethods: { recipe: 'risingThreeMethods', lead: 'up' },
  fallingThreeMethods: { recipe: 'risingThreeMethods', lead: 'up', flipped: true },
  morningDojiStar: { recipe: 'morningDojiStar' },
  eveningDojiStar: { recipe: 'morningDojiStar', flipped: true },
  bullishHaramiCross: { recipe: 'bullishHaramiCross' },
  bearishHaramiCross: { recipe: 'bullishHaramiCross', flipped: true },
  bullishKicker: { recipe: 'bullishKicker', lead: 'flat' },
  bearishKicker: { recipe: 'bullishKicker', lead: 'flat', flipped: true },
  bullishCounterattack: { recipe: 'bullishCounterattack' },
  bearishCounterattack: { recipe: 'bullishCounterattack', flipped: true },
  risingWindow: { recipe: 'risingWindow', lead: 'up' },
  fallingWindow: { recipe: 'risingWindow', lead: 'up', flipped: true },
  insideBar: { recipe: 'insideBar', lead: 'flat' },
  bullishBeltHold: { recipe: 'bullishBeltHold' },
  bearishBeltHold: { recipe: 'bullishBeltHold', flipped: true },
}
