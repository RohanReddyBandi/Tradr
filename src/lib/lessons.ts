import type { Bias, Candle } from '../types'
import { makeRng } from './random'
import { averageTrueRange } from './trade'
import { findPivots } from './pivots'
import { CANDLE_RECIPES, R, candlesThrough, flip, type PatternExample, type Points } from './examples'
import { SIGNAL_RECIPES } from './signalCandles'
import { CANDLE_PATTERNS } from './candlePatterns'

// The logic behind the Learn tab's lessons: charts built to teach one idea
// each, and the arithmetic the risk lessons play with. The widgets live in
// pages/learn/lessons/.

// The lessons, in course order (pages/learn/Lessons.tsx has the same list with the widgets).
export const LESSON_IDS = ['candle', 'trend', 'levels', 'trendlines', 'context', 'risk', 'size', 'luck']

// ---------------------------------------------------------------------------
// Reading a candle
// ---------------------------------------------------------------------------

export function candleParts(c: Candle) {
  const range = c.high - c.low
  const body = Math.abs(c.close - c.open)
  return {
    range,
    body,
    upper: c.high - Math.max(c.open, c.close),
    lower: Math.min(c.open, c.close) - c.low,
    change: c.open ? (c.close - c.open) / c.open : 0,
  }
}

// The shapes the anatomy lesson asks you to make.
export type CandleGoal = 'green' | 'red' | 'doji' | 'hammer'

export function candleGoals(c: Candle): Record<CandleGoal, boolean> {
  const { range, body, upper, lower } = candleParts(c)
  const solid = range > 0 && body > 0.15 * range
  return {
    green: solid && c.close > c.open,
    red: solid && c.close < c.open,
    doji: range > 0 && body <= 0.08 * range,
    // A small body up top, a lower wick at least twice the body, and hardly any upper wick.
    hammer: range > 0 && body >= 0.05 * range && lower >= 2 * body && upper <= 0.6 * body && lower >= 0.55 * range,
  }
}

// ---------------------------------------------------------------------------
// Trends: a staircase of swings
// ---------------------------------------------------------------------------

export type TrendKind = 'up' | 'down' | 'range'

// A chart of five to seven swings: rising steps, falling steps, or a flat range.
export function trendChart(kind: TrendKind, seed: number): Candle[] {
  const rng = makeRng(seed)
  const points: Points = [[0, kind === 'range' ? 105 : 100]]
  let price = points[0][1]
  let at = 0
  const legs = rng.int(6, 8)
  for (let k = 0; k < legs; k++) {
    const rising = k % 2 === 0
    at += rng.int(4, 7)
    if (kind === 'range') price = rising ? 110 + rng.range(-0.6, 0.6) : 100 + rng.range(-0.6, 0.6)
    else price += rising ? rng.range(7, 10) : -rng.range(3, 5)
    points.push([at, price])
  }
  const candles = candlesThrough(points, seed)
  return kind === 'down' ? flip(candles) : candles
}

export type SwingLabel = 'HH' | 'HL' | 'LH' | 'LL' | 'H' | 'L'

// Each swing high and low, labelled against the one before it: a higher
// high (HH), lower low (LL), and so on. About-equal swings get plain H or L.
export function swingLabels(candles: Candle[]) {
  const atr = averageTrueRange(candles, candles.length - 1)
  const pivots = findPivots(candles, 2 * atr)
  const last: Partial<Record<'high' | 'low', number>> = {}
  return pivots.map((p) => {
    const before = last[p.kind]
    last[p.kind] = p.price
    let label: SwingLabel
    if (before === undefined || Math.abs(p.price - before) < 0.8 * atr) label = p.kind === 'high' ? 'H' : 'L'
    else if (p.kind === 'high') label = p.price > before ? 'HH' : 'LH'
    else label = p.price > before ? 'HL' : 'LL'
    return { ...p, label }
  })
}

// ---------------------------------------------------------------------------
// Support and resistance, and trendlines
// ---------------------------------------------------------------------------

// A range with a floor near 100 and a ceiling near 110, then (after `shown`
// candles) a break below the floor, a retest from underneath, and a drop.
export const RANGE_SHOWN = 42
export function rangeThenBreak(seed: number): Candle[] {
  return candlesThrough(
    [[0, 106], [6, 110.4], [12, 100.2], [18, 110], [24, 100], [30, 109.6], [36, 100.3], [41, 104], [45, 99], [48, 96.2], [53, 99.4], [58, 94.5]],
    seed,
  )
}

// A clean uptrend whose pullbacks stop on a straight rising line.
export function uptrendChart(seed: number): Candle[] {
  return candlesThrough([[0, 100], [6, 108], [10, 104], [16, 112], [20, 108], [26, 116], [30, 112], [35, 119], [38, 115.2], [43, 121]], seed)
}

// ---------------------------------------------------------------------------
// Location beats the candle
// ---------------------------------------------------------------------------

// Candles into the pattern's price, then the pattern itself.
function withPattern(points: Points, key: string, seed: number): Candle[] {
  const spec = CANDLE_RECIPES[key]
  const candles = candlesThrough(points, seed)
  const from = candles[candles.length - 1].close
  for (const b of SIGNAL_RECIPES[spec.recipe](R, makeRng(seed))) {
    candles.push({ time: candles.length, open: b.open + from, high: b.high + from, low: b.low + from, close: b.close + from })
  }
  return candles
}

export interface ContextRound {
  key: string // the candlestick pattern both charts end with
  size: number // how many candles it spans
  good: Candle[] // at a floor after a drop (or a ceiling after a rally)
  bad: Candle[] // in the middle of a choppy range
  level: number // the floor (or ceiling) the good one sits on
  goodFirst: boolean // is the good chart shown on the left?
}

// Both charts end with the same pattern: one at a level that's held before,
// one in the middle of nowhere. Bearish rounds are the bullish ones flipped.
export function contextRound(key: 'hammer' | 'bullishEngulfing' | 'shootingStar', seed: number): ContextRound {
  const bearish = key === 'shootingStar'
  const base = bearish ? 'hammer' : key
  let good = withPattern([[0, 112], [6, 101.2], [12, 110], [18, 101], [24, 108.5], [30, 104], [34, 101.8]], base, seed)
  let bad = withPattern([[0, 100], [6, 110], [12, 100.6], [18, 109.4], [24, 101.2], [29, 108], [34, 105]], base, seed + 1)
  let level = Math.min(...good.slice(0, 20).map((c) => c.low))
  if (bearish) {
    good = flip(good)
    bad = flip(bad)
    level = 200 - level
  }
  const size = CANDLE_PATTERNS.find((p) => p.key === key)!.size
  return { key, size, good, bad, level, goodFirst: makeRng(seed * 31).chance(0.5) }
}

// ---------------------------------------------------------------------------
// Risk, reward, and luck
// ---------------------------------------------------------------------------

// A pullback in an uptrend that ends on a hammer: a long setup to plan.
export function pullbackChart(seed: number): Candle[] {
  return withPattern([[0, 103], [7, 110], [12, 106], [19, 113], [25, 109.2], [28, 110]], 'hammer', seed)
}

// With a target `ratio` times as far as the stop, the share of trades you
// must win just to break even.
export const breakEvenWinRate = (ratio: number) => 1 / (1 + ratio)

// After losing `loss` (0.2 = 20%) of your account, the gain you need to get back to even.
export const recoveryNeeded = (loss: number) => loss / (1 - loss)

// Your balance after each of `count` straight losses, risking `risk` of it each time.
export function losingStreak(balance: number, risk: number, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, k) => balance * (1 - risk) ** k)
}

export interface Run {
  wins: boolean[]
  balances: number[] // starting balance, then after each trade
  longestLosing: number
  longestWinning: number
}

// `count` trades that each win with probability `winRate`. Every trade risks
// `risk` of the current balance; a win pays `ratio` times that.
export function simulateRun(winRate: number, ratio: number, count: number, seed: number, balance = 10_000, risk = 0.01): Run {
  const rng = makeRng(seed)
  const wins: boolean[] = []
  const balances = [balance]
  let streak = { losing: 0, winning: 0 }
  let longestLosing = 0
  let longestWinning = 0
  for (let k = 0; k < count; k++) {
    const won = rng.chance(winRate)
    wins.push(won)
    const stake = balances[balances.length - 1] * risk
    balances.push(balances[balances.length - 1] + (won ? stake * ratio : -stake))
    streak = won ? { losing: 0, winning: streak.winning + 1 } : { losing: streak.losing + 1, winning: 0 }
    longestLosing = Math.max(longestLosing, streak.losing)
    longestWinning = Math.max(longestWinning, streak.winning)
  }
  return { wins, balances, longestLosing, longestWinning }
}

// ---------------------------------------------------------------------------
// "What happens next?" on the pattern cards
// ---------------------------------------------------------------------------

// A typical follow-through after an example: price moves the way the pattern
// leans (or drifts sideways for a neutral one). For illustration only: real
// patterns fail too.
export function followThrough(example: PatternExample, bias: Bias, seed = 5): Candle[] {
  const { candles } = example
  const last = candles[candles.length - 1]
  const prices = candles.flatMap((c) => [c.low, c.high])
  const height = Math.max((Math.max(...prices) - Math.min(...prices)) * 0.55, 5 * R)
  const count = Math.max(8, Math.round(candles.length * 0.3))
  const s = bias === 'bullish' ? 1 : bias === 'bearish' ? -1 : 0
  const wiggle = height * 0.15
  const points: Points =
    s === 0
      ? [[0, last.close], [Math.round(count * 0.3), last.close + wiggle], [Math.round(count * 0.65), last.close - wiggle], [count, last.close]]
      : [[0, last.close], [Math.round(count * 0.45), last.close + s * height * 0.55], [Math.round(count * 0.6), last.close + s * height * 0.4], [count, last.close + s * height]]
  return candlesThrough(points, seed)
    .slice(1)
    .map((c, k) => ({ ...c, time: candles.length + k }))
}
