import type { Candle } from '../types'
import { averageTrueRange, riskAndReward, sign, simulateTrade, sizeForRisk, type TradePlan, type TradeResult } from './trade'

// After the replay: where the stop loss and take profit SHOULD have gone, and
// how close yours were. This uses hindsight (the replay candles), so nobody
// gets these exactly; they're a benchmark to learn from.
//
// For a long (a short is the mirror image):
//   1. The logical stop is just under the lowest low of the last 10 candles:
//      below it, the idea behind the trade is broken.
//   2. Replay forward until price breaks that logical stop. The highest high
//      before then is the most the trade could have made: the best target
//      sits just under it (a target right at the top might not quite fill).
//   3. The best stop is just under the deepest dip on the way to that high,
//      the tightest stop that would have stayed in. It's never closer than
//      half an ATR (tighter than that is just noise) or past the logical stop.

export interface BestLevels {
  stop: number
  target: number
  peak: number // the best price reached before the idea broke
  peakDay: number // the replay day it was reached (1 = the first day)
  logicalStop: number // just past the recent swing, knowable before the trade
  movedYourWay: boolean // did price go your way by at least half an ATR?
  stopAccuracy: number // 0 to 1: how close your stop's distance was to the best one's
  targetAccuracy: number | null // 0 to 1, or null when there was no move to target
  result: TradeResult // what the best levels would have done, risking the same dollars
}

const SWING_LOOKBACK = 10

// Compares how far each level is from the entry: 1 when yours is the same
// distance as the best one, 0.5 when it's twice as far (or half as far).
function accuracy(yours: number, best: number, entry: number) {
  const a = Math.abs(yours - entry)
  const b = Math.abs(best - entry)
  if (!(a > 0) || !(b > 0)) return 0
  return Math.min(a, b) / Math.max(a, b)
}

export function bestLevels(candles: Candle[], future: Candle[], plan: TradePlan, balance = Infinity): BestLevels {
  const s = sign(plan.direction) // +1 long, -1 short
  const entry = plan.entry
  const atr = averageTrueRange(candles)
  // Work in "long terms": for a short, flip every price with s so higher is always better.
  const better = (price: number) => price * s
  const recent = candles.slice(-SWING_LOOKBACK)
  const swing = s > 0 ? Math.min(...recent.map((c) => c.low)) : Math.max(...recent.map((c) => c.high))
  let logicalStop = swing - s * 0.25 * atr
  if (better(entry) - better(logicalStop) < 0.5 * atr) logicalStop = entry - s * 0.5 * atr

  // Walk the replay until the logical stop breaks, tracking the best price and the worst dip before it.
  let peak = entry
  let peakIndex = -1
  let worstBeforePeak = entry
  let worstSoFar = entry
  for (let i = 0; i < future.length; i++) {
    const c = future[i]
    const best = s > 0 ? c.high : c.low
    const worst = s > 0 ? c.low : c.high
    if (better(worst) <= better(logicalStop)) break // the idea broke
    if (better(worst) < better(worstSoFar)) worstSoFar = worst
    if (better(best) > better(peak)) {
      peak = best
      peakIndex = i
      worstBeforePeak = worstSoFar
    }
  }

  const movedYourWay = better(peak) - better(entry) >= 0.5 * atr
  let stop: number
  let target: number
  if (movedYourWay) {
    target = peak - s * 0.1 * atr
    // Just past the deepest dip, but no closer than half an ATR and no wider than the logical stop.
    const underDip = better(worstBeforePeak) - 0.1 * atr
    stop = s * Math.min(better(entry) - 0.5 * atr, Math.max(better(logicalStop), underDip))
  } else {
    // Price never really went your way: the best you could do was a small loss at the logical stop.
    stop = logicalStop
    target = entry + s * Math.max(0.5 * atr, better(peak) - better(entry))
  }
  stop = Math.round(stop * 100) / 100
  target = Math.round(target * 100) / 100

  // Same dollars at risk as your trade, so the two results compare fairly.
  const { risk } = riskAndReward(plan)
  const size = sizeForRisk(entry, stop, risk, balance)
  const result = simulateTrade({ ...plan, stop, target, size }, future)

  return {
    stop,
    target,
    peak,
    peakDay: peakIndex + 1,
    logicalStop: Math.round(logicalStop * 100) / 100,
    movedYourWay,
    stopAccuracy: accuracy(plan.stop, stop, entry),
    targetAccuracy: movedYourWay ? accuracy(plan.target, target, entry) : null,
    result,
  }
}
