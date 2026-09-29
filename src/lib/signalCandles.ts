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

const dragonflyDoji: Recipe = (R) => {
  const open = -0.05 * R
  return [bar(open, open + 0.01 * R, 0.02 * R, 1.4 * R)]
}

const bullishEngulfing: Recipe = (R) => {
  const red = bar(0.05 * R, -0.55 * R, 0.1 * R, 0.1 * R)
  const green = bar(red.close - 0.05 * R, red.open + 0.35 * R, 0.08 * R, 0.12 * R)
  return [red, green]
}

const threeOutsideUp: Recipe = (R, rng) => {
  const [red, green] = bullishEngulfing(R, rng)
  return [red, green, bar(green.close - 0.05 * R, green.close + 0.6 * R, 0.08 * R, 0.06 * R)]
}

const piercingLine: Recipe = (R) => {
  const red = bar(0.05 * R, -0.95 * R, 0.1 * R, 0.1 * R)
  const green = bar(red.close - 0.2 * R, red.close + 0.65 * R, 0.1 * R, 0.1 * R)
  return [red, green]
}

const tweezerBottom: Recipe = (R) => {
  const red = bar(0, -0.6 * R, 0.1 * R, 0.3 * R)
  const open = red.close + 0.05 * R
  // The green candle's wick reaches down to exactly the same low.
  const green = bar(open, open + 0.5 * R, 0.1 * R, open - red.low)
  return [red, green]
}

const bullishHarami: Recipe = (R) => {
  const red = bar(0.05 * R, -1.15 * R, 0.1 * R, 0.1 * R)
  const green = bar(red.close + 0.3 * R, red.close + 0.7 * R, 0.1 * R, 0.1 * R)
  return [red, green]
}

const threeInsideUp: Recipe = (R, rng) => {
  const [red, green] = bullishHarami(R, rng)
  return [red, green, bar(green.close, red.open + 0.25 * R, 0.1 * R, 0.05 * R)]
}

const morningStar: Recipe = (R, rng) => {
  const red = bar(0, -1.1 * R, 0.1 * R, 0.1 * R)
  const starOpen = red.close - 0.15 * R
  const star = bar(starOpen, starOpen + (rng.chance(0.5) ? 0.08 : -0.08) * R, 0.15 * R, 0.15 * R)
  const green = bar(star.close + 0.05 * R, red.close + 0.8 * R, 0.08 * R, 0.08 * R)
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

const threeWhiteSoldiers: Recipe = (R) => {
  const first = bar(0, 0.8 * R, 0.08 * R, 0.06 * R)
  const second = bar(first.close - 0.3 * R, first.close + 0.6 * R, 0.08 * R, 0.05 * R)
  const third = bar(second.close - 0.3 * R, second.close + 0.6 * R, 0.08 * R, 0.05 * R)
  return [first, second, third]
}

const risingThreeMethods: Recipe = (R) => {
  const big = bar(0, 1.5 * R, 0.06 * R, 0.06 * R)
  const pause1 = bar(big.close - 0.05 * R, big.close - 0.35 * R, 0.05 * R, 0.05 * R)
  const pause2 = bar(pause1.close + 0.05 * R, pause1.close - 0.25 * R, 0.05 * R, 0.05 * R)
  const pause3 = bar(pause2.close, pause2.close + 0.2 * R, 0.05 * R, 0.05 * R)
  const finish = bar(pause3.close + 0.02 * R, big.close + 0.5 * R, 0.05 * R, 0.05 * R)
  return [big, pause1, pause2, pause3, finish]
}

// Indecision candles for charts with no setup.
const doji: Recipe = (R, rng) => [bar(0, (rng.chance(0.5) ? 0.02 : -0.02) * R, 0.4 * R, 0.4 * R)]
const spinningTop: Recipe = (R, rng) => [bar(0, (rng.chance(0.5) ? 0.2 : -0.2) * R, 0.3 * R, 0.3 * R)]
const longLeggedDoji: Recipe = (R) => [bar(0, 0.02 * R, 0.7 * R, 0.7 * R)]

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
  doji,
  spinningTop,
  longLeggedDoji,
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
]

// Candles that push price through a line.
export const BREAKOUT_SIGNALS: SignalKey[] = ['bullishMarubozu', 'threeWhiteSoldiers']

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
  'spinningTop',
]

// Hard cards sometimes end with one of these in the middle of a choppy range:
// a strong-looking candle with nothing behind it.
export const DECOY_SIGNALS: SignalKey[] = ['bullishMarubozu', 'bullishEngulfing']
