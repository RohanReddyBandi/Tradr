import type { Bias, Candle, Shape } from '../types'
import { generateCard } from './generator'
import { SETUPS } from './setups'
import { makeRng } from './random'
import { landmarks, reviewStopAndTarget, type ChartSpot, type StopTargetReview } from './riskReview'
import { sign, simulateTrade, type Direction, type TradePlan, type TradeResult } from './trade'

// Stop losses and take profits, for the Learn lesson and its drill: the
// levels a trader would plan before entering (no hindsight), how a pair of
// exits is graded, and the charts to practice on.

// Opens the lesson when passed to Learn as its focus (in place of a pattern name).
export const EXITS_FOCUS = 'stop-loss-and-take-profit'

export interface Exits {
  stop: number
  target: number
}

export interface TextbookExits extends Exits {
  swing: ChartSpot // the stop sits just past this
  obstacle: ChartSpot | null // the target sits just short of this
  ratio: number // reward ÷ risk
}

const cents = (n: number) => Math.round(n * 100) / 100
const LESSON_SIZE = 1000 // dollars, for results the lesson quotes

// The plan a careful trader would make before entering:
//   - stop: a quarter of a normal day (ATR) past the recent swing point
//   - target: just short of the nearest ceiling (long) or floor (short);
//     with nothing in the way, twice the risk.
export function textbookExits(candles: Candle[], direction: Direction): TextbookExits {
  const entry = candles[candles.length - 1].close
  const s = sign(direction)
  const { swing, obstacle, touching, atr } = landmarks(candles, direction, entry)
  const stop = cents(swing.price - s * 0.25 * atr)
  const risk = Math.abs(entry - stop)
  const inTheWay = touching ? null : obstacle
  let target = inTheWay ? inTheWay.price - s * 0.15 * atr : entry + s * 2 * risk
  // Past 1 : 4 a target rarely fills within the month, even short of the obstacle.
  if (Math.abs(target - entry) > 4 * risk) target = entry + s * 3 * risk
  target = cents(target)
  return { stop, target, swing, obstacle: inTheWay, ratio: Math.abs(target - entry) / risk }
}

export const STOP_WORDS: Record<StopTargetReview['stop'], string> = {
  logical: 'Just past the swing',
  'a-bit-wide': 'A bit wide',
  'inside-swing': 'Inside the swing',
  'too-tight': 'Too tight',
  'too-wide': 'Too wide',
}

const STOP_POINTS: Record<StopTargetReview['stop'], number> = { logical: 1, 'a-bit-wide': 0.7, 'inside-swing': 0.35, 'too-tight': 0.15, 'too-wide': 0.2 }
const TARGET_POINTS: Record<StopTargetReview['target'], number> = { solid: 1, 'thin-ratio': 0.5, ambitious: 0.45, 'poor-ratio': 0.1 }

export interface ExitGrade {
  review: StopTargetReview
  stop: number // 0 to 1
  target: number // 0 to 1
  total: number // the average of the two
  pastObstacle: boolean // the target sits beyond the next ceiling (long) or floor (short)
  stopWords: string
  targetWords: string
}

// Grades a stop and target on what you could know when you placed them
// (where the swing and the next obstacle were, and the payoff), not on how
// the trade happened to turn out.
export function gradeExits(candles: Candle[], plan: TradePlan): ExitGrade {
  const review = reviewStopAndTarget(candles, plan)
  const { atr } = landmarks(candles, plan.direction, plan.entry)
  const pastObstacle = review.obstacle !== null && (plan.target - review.obstacle) * sign(plan.direction) > 0.3 * atr
  const stop = STOP_POINTS[review.stop]
  const target = TARGET_POINTS[review.target] * (pastObstacle ? 0.6 : 1)
  const ratio = `1 : ${review.ratio.toFixed(1)}`
  const targetWords =
    review.target === 'poor-ratio'
      ? `${ratio}: closer than the stop`
      : review.target === 'ambitious'
        ? `${ratio}: too far to fill`
        : pastObstacle
          ? `${ratio}, past ${plan.direction === 'long' ? 'resistance' : 'support'}`
          : review.target === 'thin-ratio'
            ? `${ratio}: thin`
            : ratio
  return { review, stop, target, total: (stop + target) / 2, pastObstacle, stopWords: STOP_WORDS[review.stop], targetWords }
}

// A fixed price range that fits the candles, the replay and the levels.
export function exitRange(candles: Candle[], levels: number[]) {
  const prices = [...candles.flatMap((c) => [c.low, c.high]), ...levels]
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  return { min: lo - (hi - lo) * 0.06, max: hi + (hi - lo) * 0.08 }
}

export const dayOf = (result: TradeResult) => `day ${result.exit.index + 1}`

export function outcomeWords(result: TradeResult) {
  if (result.exit.reason === 'target') return `Hit the take profit on ${dayOf(result)}`
  if (result.exit.reason === 'stop') return `Stopped out on ${dayOf(result)}`
  return 'Neither level was hit, so it closed at the end'
}

// Break-even win rate: with wins worth `ratio` times a loss, you need to win
// 1 / (1 + ratio) of your trades to come out even.
export const breakEven = (ratio: number) => 1 / (1 + ratio)

// ---------------------------------------------------------------------------
// The drill: real-looking setups where you know the direction and place the exits.
// ---------------------------------------------------------------------------

export interface ExitChart {
  candles: Candle[]
  future: Candle[]
  direction: Direction
  bias: Bias
  name: string // the setup, e.g. "Bull flag"
  shapes: Shape[] // its lines, for context
  entry: number
  textbook: TextbookExits
}

export const EXIT_ROUNDS = 5

const TRADEABLE = SETUPS.filter((s) => !s.neutral)

// A drill chart: a generated setup with a clean textbook answer (the stop is
// a sensible distance away and the target pays at least 1 : 1.5 without
// running into anything), so there's always a right way to place them.
export function makeExitChart(seed: number): ExitChart {
  const rng = makeRng(seed)
  let fallback: ExitChart | null = null
  for (let attempt = 0; attempt < 30; attempt++) {
    const bias: Bias = rng.chance(0.5) ? 'bullish' : 'bearish'
    const setup = rng.pick(TRADEABLE)
    const card = generateCard(1, rng.int(1, 2 ** 31), 'medium', { key: setup.key, bias })
    const direction: Direction = bias === 'bullish' ? 'long' : 'short'
    const entry = card.candles[card.candles.length - 1].close
    const textbook = textbookExits(card.candles, direction)
    const chart: ExitChart = {
      candles: card.candles,
      future: card.future,
      direction,
      bias,
      name: card.setup.name,
      shapes: card.setup.chartFindings.flatMap((f) => f.shapes).filter((sh) => sh.kind !== 'candles'),
      entry,
      textbook,
    }
    fallback ??= chart
    const { atr } = landmarks(card.candles, direction, entry)
    const stopDays = Math.abs(entry - textbook.stop) / atr
    const plan = { direction, entry, size: LESSON_SIZE, ...textbook }
    if (stopDays >= 0.8 && stopDays <= 3.5 && gradeExits(card.candles, plan).total === 1) return chart
  }
  return fallback!
}

// ---------------------------------------------------------------------------
// The lesson's charts: one where the textbook exits work, and one for each
// classic mistake, where it visibly costs you. Each comes from a fixed seed
// (found by searching; a test checks they still teach their lesson), with a
// search as a fallback in case the generator changes.
// ---------------------------------------------------------------------------

export type LessonKind = 'good' | 'tight' | 'greedy' | 'wide'

export interface LessonChart extends ExitChart {
  kind: LessonKind
  plan: TradePlan // the exits this chart shows: the textbook ones, or the mistake
  result: TradeResult
  textbookResult: TradeResult
}

export const LESSON_SEEDS: Record<LessonKind, number> = { good: 131, tight: 131, greedy: 6943, wide: 79 }

function lessonPlan(kind: LessonKind, chart: ExitChart): TradePlan {
  const { direction, entry, textbook, candles, future } = chart
  const s = sign(direction)
  const base: TradePlan = { direction, entry, size: LESSON_SIZE, stop: textbook.stop, target: textbook.target }
  const { atr } = landmarks(candles, direction, entry)
  if (kind === 'tight') return { ...base, stop: cents(entry - s * 0.5 * atr) }
  if (kind === 'wide') return { ...base, stop: cents(entry - s * 2.8 * Math.abs(entry - textbook.stop)) }
  if (kind === 'greedy') {
    const best = s > 0 ? Math.max(...future.map((c) => c.high)) : Math.min(...future.map((c) => c.low))
    return { ...base, target: cents(best + s * 0.5 * atr) }
  }
  return base
}

export function buildLesson(kind: LessonKind, seed: number): LessonChart {
  const chart = makeExitChart(seed)
  const plan = lessonPlan(kind, chart)
  const textbookPlan = lessonPlan('good', chart)
  return { ...chart, kind, plan, result: simulateTrade(plan, chart.future), textbookResult: simulateTrade(textbookPlan, chart.future) }
}

// Does this chart show what it's meant to?
export function teaches(l: LessonChart): boolean {
  const good = l.textbookResult
  const risk = Math.abs(l.entry - l.textbook.stop)
  const pays = l.textbook.ratio >= 1.8 && l.textbook.ratio <= 3.2
  if (l.kind === 'good') return l.direction === 'long' && pays && good.exit.reason === 'target' && good.exit.index >= 4
  if (l.kind === 'tight') return pays && good.exit.reason === 'target' && l.result.exit.reason === 'stop' && gradeExits(l.candles, l.plan).review.stop === 'too-tight'
  if (l.kind === 'greedy') return pays && good.exit.reason === 'target' && l.result.pnl < good.pnl * 0.6 && Math.abs(l.plan.target - l.entry) < 6 * risk
  return good.exit.reason === 'stop' && l.result.pnl < good.pnl * 1.8
}

const lessons = new Map<LessonKind, LessonChart>()

export function lessonChart(kind: LessonKind): LessonChart {
  const cached = lessons.get(kind)
  if (cached) return cached
  let found = buildLesson(kind, LESSON_SEEDS[kind])
  for (let k = 1; k <= 3000 && !teaches(found); k++) found = buildLesson(kind, LESSON_SEEDS[kind] + k * 7919)
  lessons.set(kind, found)
  return found
}
