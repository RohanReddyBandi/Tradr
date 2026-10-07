import type { Candle } from '../types'

export type Direction = 'long' | 'short'

// Everything you choose on the trade setup screen.
export interface TradePlan {
  direction: Direction
  entry: number // the last close before you decided
  size: number // dollars put into the trade
  stop: number // stop loss price
  target: number // take profit price
}

// How the trade ended during the replay.
export interface TradeExit {
  reason: 'stop' | 'target' | 'end' // stopped out, target hit, or held to the last candle
  index: number // which replay candle (0 = first one after you entered)
  price: number // the price you got out at
}

export interface TradeResult {
  exit: TradeExit
  pnl: number // dollars won or lost
  r: number // result measured in "R": how many times your risk you won or lost
}

// +1 for long (you win when price goes up), -1 for short (you win when it goes down).
export const sign = (direction: Direction) => (direction === 'long' ? 1 : -1)

// Average True Range: how big a normal day's move is, over the last `count`
// candles. "True range" also counts gaps: if a candle opened far from the
// previous close, that jump is part of the day's move.
export function averageTrueRange(candles: Candle[], count = 14) {
  const recent = candles.slice(-count - 1)
  let total = 0
  for (let i = 1; i < recent.length; i++) {
    const c = recent[i]
    const prevClose = recent[i - 1].close
    total += Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose))
  }
  return total / Math.max(1, recent.length - 1)
}

const cents = (n: number) => Math.round(n * 100) / 100

// Until you change it, a trade uses this share of your balance.
export const DEFAULT_POSITION_SHARE = 0.1

// A sensible starting point for the setup screen: stop 2 ATR away and target
// 4 ATR away (1 : 2 risk/reward). These are deliberately generic; the
// Breakdown tells you whether a level from the chart would have been better.
export function defaultPlan(candles: Candle[], direction: Direction, size: number): TradePlan {
  const entry = candles[candles.length - 1].close
  const atr = averageTrueRange(candles)
  const s = sign(direction)
  return {
    direction,
    entry,
    size: cents(size),
    stop: cents(entry - s * 2 * atr),
    target: cents(entry + s * 4 * atr),
  }
}

// Where the stop and target START on the setup screen: out at the edges of
// the chart, at least OPENING_DISTANCE normal days (ATR) from the entry. They
// aren't a suggestion: they're parked out of the way so you drag them to
// your own levels.
export const OPENING_DISTANCE = 6

export function openingPlan(candles: Candle[], direction: Direction, size: number): TradePlan {
  const entry = candles[candles.length - 1].close
  const atr = averageTrueRange(candles)
  const top = Math.max(...candles.map((c) => c.high), entry + OPENING_DISTANCE * atr)
  const bottom = Math.max(0.01, Math.min(...candles.map((c) => c.low), entry - OPENING_DISTANCE * atr))
  const long = direction === 'long'
  return {
    direction,
    entry,
    size: cents(size),
    stop: cents(long ? bottom : top),
    target: cents(long ? top : bottom),
  }
}

// Dollars lost if the stop is hit, and dollars won if the target is hit.
// You buy (size / entry) shares, and each share moves by the price difference.
export function riskAndReward(plan: TradePlan) {
  const shares = plan.size / plan.entry
  return {
    risk: shares * Math.abs(plan.entry - plan.stop),
    reward: shares * Math.abs(plan.target - plan.entry),
  }
}

// What's wrong with a plan, in words, or null if it's fine.
export function planProblem(plan: TradePlan, balance: number): string | null {
  const long = plan.direction === 'long'
  if (!(plan.size > 0)) return 'Enter a position size above $0.'
  if (plan.size > balance) return `You only have ${balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} to trade with.`
  // Number("1e999") is Infinity, which is "above 0" but not a price.
  if (!(plan.stop > 0) || !(plan.target > 0) || !Number.isFinite(plan.stop) || !Number.isFinite(plan.target)) return 'Enter a price for the stop loss and take profit.'
  if (long && plan.stop >= plan.entry) return 'For a long, the stop loss goes below the entry.'
  if (!long && plan.stop <= plan.entry) return 'For a short, the stop loss goes above the entry.'
  if (long && plan.target <= plan.entry) return 'For a long, the take profit goes above the entry.'
  if (!long && plan.target >= plan.entry) return 'For a short, the take profit goes below the entry.'
  return null
}

// ---------------------------------------------------------------------------
// The replay: walk through the future candles one day at a time and see
// whether the stop or the target got hit.
// ---------------------------------------------------------------------------
export function simulateTrade(plan: TradePlan, future: Candle[]): TradeResult {
  const long = plan.direction === 'long'
  let exit: TradeExit | null = null

  for (let i = 0; i < future.length && !exit; i++) {
    const c = future[i]

    // 1. Gaps. If the day OPENS past your stop, you can't get out at the stop
    //    price; the first price available is the open, which is worse. The
    //    same goes for a gap past your target, except that one works for you.
    const openedPastStop = long ? c.open <= plan.stop : c.open >= plan.stop
    const openedPastTarget = long ? c.open >= plan.target : c.open <= plan.target
    if (openedPastStop) exit = { reason: 'stop', index: i, price: c.open }
    else if (openedPastTarget) exit = { reason: 'target', index: i, price: c.open }
    else {
      // 2. Otherwise, did the day's range (low to high) reach either level?
      const touchedStop = long ? c.low <= plan.stop : c.high >= plan.stop
      const touchedTarget = long ? c.high >= plan.target : c.low <= plan.target
      // A daily candle can't tell us which came first if it touched both, so
      // we assume the worse one (the stop). Real traders plan the same way.
      if (touchedStop) exit = { reason: 'stop', index: i, price: plan.stop }
      else if (touchedTarget) exit = { reason: 'target', index: i, price: plan.target }
    }
  }

  // 3. Neither level was hit: close at the last candle.
  exit ??= { reason: 'end', index: future.length - 1, price: future[future.length - 1].close }

  const shares = plan.size / plan.entry
  const pnl = cents(shares * (exit.price - plan.entry) * sign(plan.direction))
  const { risk } = riskAndReward(plan)
  return { exit, pnl, r: risk > 0 ? pnl / risk : 0 }
}
