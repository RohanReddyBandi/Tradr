import { describe, expect, it } from 'vitest'
import { breakEven, buildLesson, gradeExits, LESSON_SEEDS, lessonChart, makeExitChart, teaches, textbookExits, type LessonKind } from './exits'
import { averageTrueRange, OPENING_DISTANCE, openingPlan, type TradePlan } from './trade'
import { generateCard } from './generator'

const charts = Array.from({ length: 40 }, (_, i) => makeExitChart(500 + i * 7919))
const planFor = (c: (typeof charts)[number], levels: { stop: number; target: number }): TradePlan => ({ direction: c.direction, entry: c.entry, size: 1000, ...levels })

describe('openingPlan', () => {
  it('parks the stop and target far out, on the right sides, past every candle', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { candles } = generateCard(1, seed)
      const atr = averageTrueRange(candles)
      const highs = Math.max(...candles.map((c) => c.high))
      const lows = Math.min(...candles.map((c) => c.low))
      const long = openingPlan(candles, 'long', 1000)
      const short = openingPlan(candles, 'short', 1000)
      expect(long.target - long.entry).toBeGreaterThanOrEqual(OPENING_DISTANCE * atr - 0.01)
      expect(long.entry - long.stop).toBeGreaterThanOrEqual(Math.min(OPENING_DISTANCE * atr, long.entry - 0.01) - 0.01)
      expect(long.target).toBeGreaterThanOrEqual(highs - 0.01)
      expect(long.stop).toBeLessThanOrEqual(lows + 0.01)
      // A short is the mirror image.
      expect(short.stop).toBe(long.target)
      expect(short.target).toBe(long.stop)
    }
  })
})

describe('textbook exits', () => {
  it('always have a clean answer on drill charts: full marks for the stop and the target', () => {
    for (const c of charts) {
      const grade = gradeExits(c.candles, planFor(c, c.textbook))
      expect(grade.total).toBe(1)
      expect(c.textbook.ratio).toBeGreaterThanOrEqual(1.5)
      expect(c.textbook.ratio).toBeLessThanOrEqual(4)
    }
  })

  it('put the stop just past the swing and the target short of the obstacle', () => {
    for (const c of charts) {
      const t = textbookExits(c.candles, c.direction)
      const s = c.direction === 'long' ? 1 : -1
      expect((t.swing.price - t.stop) * s).toBeGreaterThan(0)
      if (t.obstacle) expect((t.obstacle.price - t.target) * s).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('gradeExits', () => {
  it('marks down a stop inside everyday noise', () => {
    const c = charts[0]
    const atr = averageTrueRange(c.candles)
    const s = c.direction === 'long' ? 1 : -1
    const grade = gradeExits(c.candles, planFor(c, { stop: c.entry - s * 0.3 * atr, target: c.textbook.target }))
    expect(grade.review.stop).toBe('too-tight')
    expect(grade.stop).toBeLessThan(0.5)
    expect(grade.total).toBeLessThan(0.75)
  })

  it('marks down a target closer than the stop, and one past the next obstacle', () => {
    const c = charts.find((x) => x.textbook.obstacle)!
    const s = c.direction === 'long' ? 1 : -1
    const risk = Math.abs(c.entry - c.textbook.stop)
    const close = gradeExits(c.candles, planFor(c, { stop: c.textbook.stop, target: c.entry + s * 0.5 * risk }))
    expect(close.review.target).toBe('poor-ratio')
    expect(close.target).toBeLessThan(0.2)
    const atr = averageTrueRange(c.candles)
    const past = gradeExits(c.candles, planFor(c, { stop: c.textbook.stop, target: c.textbook.obstacle!.price + s * atr }))
    expect(past.pastObstacle).toBe(true)
    expect(past.target).toBeLessThan(1)
  })

  it('knows the break-even win rate', () => {
    expect(breakEven(1)).toBeCloseTo(0.5)
    expect(breakEven(2)).toBeCloseTo(1 / 3)
  })
})

describe('the lesson charts', () => {
  it.each(['good', 'tight', 'greedy', 'wide'] as LessonKind[])('the pinned %s chart still teaches its lesson', (kind) => {
    // If the generator changes, find new seeds: the fallback search in lessonChart does it, slowly.
    expect(teaches(buildLesson(kind, LESSON_SEEDS[kind]))).toBe(true)
    expect(teaches(lessonChart(kind))).toBe(true)
  })

  it('shows the too-tight stop on the same chart as the textbook one', () => {
    const good = lessonChart('good')
    const tight = lessonChart('tight')
    expect(tight.candles).toEqual(good.candles)
    expect(tight.result.exit.reason).toBe('stop')
    expect(good.result.exit.reason).toBe('target')
  })
})
