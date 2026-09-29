import type { Candle } from '../types'
import { averageTrueRange, riskAndReward, sign, type TradePlan } from './trade'

// Grades your stop loss and take profit, and explains why.
//
// The idea: a stop belongs just past the most recent swing point (the last
// low for a long, the last high for a short). If price gets past that level,
// the idea behind the trade is broken anyway. Distances are measured in ATR
// (a normal day's range) so the same rules work for a $20 or $300 stock.

export type StopVerdict = 'too-tight' | 'inside-swing' | 'logical' | 'a-bit-wide' | 'too-wide'
export type TargetVerdict = 'poor-ratio' | 'thin-ratio' | 'solid' | 'ambitious'

export interface StopTargetReview {
  stop: StopVerdict
  target: TargetVerdict
  swing: number // the swing low (long) or high (short) a logical stop hides behind
  obstacle: number | null // the nearest ceiling (long) or floor (short) in the target's way
  ratio: number // reward ÷ risk, e.g. 2 means "1 : 2"
  good: boolean // sound risk management overall?
  text: string
}

const SWING_LOOKBACK = 10 // candles to look back for the recent swing point

// Local peaks: candles whose high beats the `span` candles on each side.
function swingHighs(candles: Candle[], span = 3): number[] {
  const peaks: number[] = []
  for (let i = span; i < candles.length - span; i++) {
    const neighbours = [...candles.slice(i - span, i), ...candles.slice(i + 1, i + span + 1)]
    if (neighbours.every((c) => c.high <= candles[i].high)) peaks.push(candles[i].high)
  }
  return peaks
}

// Local dips, found by flipping the chart upside down and looking for peaks.
const swingLows = (candles: Candle[], span = 3) =>
  swingHighs(candles.map((c) => ({ ...c, high: -c.low, low: -c.high })), span).map((p) => -p)

export function reviewStopAndTarget(candles: Candle[], plan: TradePlan): StopTargetReview {
  const long = plan.direction === 'long'
  const s = sign(plan.direction)
  const atr = averageTrueRange(candles)
  const recent = candles.slice(-SWING_LOOKBACK)
  const swing = long ? Math.min(...recent.map((c) => c.low)) : Math.max(...recent.map((c) => c.high))
  const money = (n: number) => n.toFixed(2)
  const words = long
    ? { swing: 'low', past: 'under', inside: 'above', obstacle: 'resistance', edge: 'ceiling' }
    : { swing: 'high', past: 'over', inside: 'below', obstacle: 'support', edge: 'floor' }

  // --- The stop -------------------------------------------------------------
  const stopDays = Math.abs(plan.entry - plan.stop) / atr // distance in "normal days"
  const pastSwing = (swing - plan.stop) * s // > 0 when the stop is beyond the swing point

  let stop: StopVerdict
  if (pastSwing < 0) stop = stopDays < 1 ? 'too-tight' : 'inside-swing'
  else if (pastSwing <= 1.0 * atr) stop = 'logical'
  else stop = stopDays > 5 ? 'too-wide' : 'a-bit-wide'

  const stopText = {
    'too-tight': `Your stop was only ${stopDays.toFixed(1)}× a normal day's range from the entry. That's inside everyday noise, so ordinary wiggles can knock you out before the idea plays out.`,
    'inside-swing': `Your stop sat ${words.inside} the recent swing ${words.swing} at ${money(swing)}, so a normal retest of that level would stop you out. Just ${words.past} ${money(swing)} is the logical spot: if price gets past it, the idea is wrong anyway.`,
    logical: `Your stop was just ${words.past} the recent swing ${words.swing} at ${money(swing)}: a logical spot. If price gets past that level, the setup is broken anyway.`,
    'a-bit-wide': `Your stop was a bit past the swing ${words.swing} at ${money(swing)}. That's safe, but it risks more than the idea needs.`,
    'too-wide': `Your stop was ${stopDays.toFixed(1)}× a normal day's range away, far past the swing ${words.swing} at ${money(swing)}. You'd lose a lot before admitting the trade was wrong; a stop just ${words.past} ${money(swing)} risks less for the same idea.`,
  }[stop]

  // --- The target -----------------------------------------------------------
  const { risk, reward } = riskAndReward(plan)
  const ratio = risk > 0 ? reward / risk : 0
  let target: TargetVerdict
  if (ratio < 1) target = 'poor-ratio'
  else if (ratio < 1.5) target = 'thin-ratio'
  else if (ratio <= 4) target = 'solid'
  else target = 'ambitious'

  const ratioText = ratio.toFixed(1)
  const targetText = {
    'poor-ratio': `Your target was closer than your stop (1 : ${ratioText}), so you'd need to be right more than half the time just to break even.`,
    'thin-ratio': `1 : ${ratioText} risk/reward is thin; most traders look for at least 1 : 2.`,
    solid: `1 : ${ratioText} risk/reward is solid.`,
    ambitious: `1 : ${ratioText} is ambitious: a target that far away rarely gets hit within a month.`,
  }[target]

  // Swing points in the target's direction: the ceilings (long) or floors
  // (short) price has to get through. "Nearest" means closest to the entry.
  const levels = long ? swingHighs(candles) : swingLows(candles)
  const distance = (p: number) => (p - plan.entry) * s
  const nearest = (ps: number[]) => (ps.length ? (long ? Math.min(...ps) : Math.max(...ps)) : null)
  const touching = nearest(levels.filter((p) => distance(p) > 0 && distance(p) <= 0.5 * atr))
  const obstacle = nearest(levels.filter((p) => distance(p) > 0.5 * atr))

  let obstacleText = ''
  if (touching !== null) {
    obstacleText = ` You entered right next to ${words.obstacle} at ${money(touching)}, so price had to break through it before the trade could work.`
  } else if (obstacle === null) {
    obstacleText = ` Price was at the edge of its range, so there was no obvious ${words.edge} in the way.`
  } else {
    const pastObstacle = (plan.target - obstacle) * s
    if (pastObstacle > 0.3 * atr) {
      obstacleText = ` The target sat past ${words.obstacle} at ${money(obstacle)}, where price often stalls first.`
    } else if (pastObstacle > -1.5 * atr) {
      obstacleText = ` Just ${long ? 'under' : 'above'} ${words.obstacle} at ${money(obstacle)} is a sensible place to take profit.`
    }
  }

  return {
    stop,
    target,
    swing,
    obstacle: touching ?? obstacle,
    ratio,
    good: (stop === 'logical' || stop === 'a-bit-wide') && target === 'solid',
    text: `${stopText} ${targetText}${obstacleText}`,
  }
}
