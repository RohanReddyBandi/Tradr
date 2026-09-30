import { describe, expect, it } from 'vitest'
import {
  RANGE_SHOWN,
  breakEvenWinRate,
  candleGoals,
  contextRound,
  followThrough,
  losingStreak,
  pullbackChart,
  rangeThenBreak,
  recoveryNeeded,
  simulateRun,
  swingLabels,
  trendChart,
  uptrendChart,
} from './lessons'
import { lineVerdict, readLine } from './userMarkup'
import { reviewStopAndTarget } from './riskReview'
import { chartExample } from './examples'
import { makeQuestion } from './quiz'
import { findCandlePatterns } from './candlePatterns'
import { findChartPatterns } from './chartPatterns'

describe('candle goals', () => {
  const candle = (open: number, high: number, low: number, close: number) => ({ time: 0, open, high, low, close })
  it('tells green, red, doji and hammer apart', () => {
    expect(candleGoals(candle(100, 104, 99, 103)).green).toBe(true)
    expect(candleGoals(candle(103, 104, 99, 100)).red).toBe(true)
    expect(candleGoals(candle(100, 102, 98, 100.1)).doji).toBe(true)
    expect(candleGoals(candle(102, 103.1, 97, 103)).hammer).toBe(true)
    expect(candleGoals(candle(100, 104, 99, 103)).hammer).toBe(false)
  })
})

describe('trend charts', () => {
  it('label uptrends with higher highs and higher lows', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const labels = swingLabels(trendChart('up', seed)).map((s) => s.label)
      expect(labels.filter((l) => l === 'HH' || l === 'HL').length).toBeGreaterThan(labels.filter((l) => l === 'LH' || l === 'LL').length)
    }
  })
  it('label downtrends with lower highs and lower lows', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const labels = swingLabels(trendChart('down', seed)).map((s) => s.label)
      expect(labels.filter((l) => l === 'LH' || l === 'LL').length).toBeGreaterThan(labels.filter((l) => l === 'HH' || l === 'HL').length)
    }
  })
  it('keep ranges roughly level', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const labels = swingLabels(trendChart('range', seed)).map((s) => s.label)
      expect(labels.filter((l) => l === 'H' || l === 'L').length).toBeGreaterThanOrEqual(labels.length - 2)
    }
  })
})

describe('the level and trendline lessons', () => {
  it('have a floor with three touches before the break', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const shown = rangeThenBreak(seed).slice(0, RANGE_SHOWN)
      const floor = Math.min(...shown.map((c) => c.low))
      const reading = readLine(shown, { kind: 'level', price: floor })
      expect(reading.role).toBe('support')
      expect(reading.touches.length).toBeGreaterThanOrEqual(3)
    }
  })
  it('have an uptrend whose lows line up', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const candles = uptrendChart(seed)
      const low = (a: number, b: number) => {
        const slice = candles.slice(a, b + 1)
        const price = Math.min(...slice.map((c) => c.low))
        return { index: a + slice.findIndex((c) => c.low === price), price }
      }
      const verdict = lineVerdict(readLine(candles, { kind: 'trend', from: low(8, 12), to: low(28, 32) }))
      expect(['strong', 'ok']).toContain(verdict)
    }
  })
})

describe('the context lesson', () => {
  it('ends both charts with the same pattern', () => {
    for (const key of ['hammer', 'bullishEngulfing', 'shootingStar'] as const) {
      const round = contextRound(key, 3)
      const last = (cs: typeof round.good) => cs.length - 1
      expect(findCandlePatterns(round.good, [last(round.good)]).map((m) => m.pattern.key)).toContain(key)
      expect(findCandlePatterns(round.bad, [last(round.bad)]).map((m) => m.pattern.key)).toContain(key)
    }
  })
})

describe('the risk lessons', () => {
  it('has a pullback where a stop under the swing low is logical', () => {
    const candles = pullbackChart(4)
    const entry = candles[candles.length - 1].close
    const swing = Math.min(...candles.slice(-10).map((c) => c.low))
    const review = reviewStopAndTarget(candles, { direction: 'long', entry, size: 1000, stop: swing - 0.2, target: entry + 3 * (entry - swing + 0.2) })
    expect(review.stop).toBe('logical')
  })
  it('does the arithmetic', () => {
    expect(breakEvenWinRate(2)).toBeCloseTo(1 / 3)
    expect(recoveryNeeded(0.5)).toBeCloseTo(1)
    expect(losingStreak(10_000, 0.1, 2).map(Math.round)).toEqual([10_000, 9_000, 8_100])
  })
  it('simulates runs that match their odds on average', () => {
    const run = simulateRun(0.6, 2, 2000, 7)
    const winRate = run.wins.filter(Boolean).length / run.wins.length
    expect(winRate).toBeGreaterThan(0.55)
    expect(winRate).toBeLessThan(0.65)
    expect(run.balances).toHaveLength(2001)
    expect(run.longestLosing).toBeGreaterThan(2)
  })
})

describe('follow-through', () => {
  it('moves the way the pattern leans', () => {
    const example = chartExample('doubleBottom')!
    const last = example.candles[example.candles.length - 1].close
    expect(followThrough(example, 'bullish').at(-1)!.close).toBeGreaterThan(last)
    expect(followThrough(example, 'bearish').at(-1)!.close).toBeLessThan(last)
  })
})

describe('the quiz', () => {
  it('always has four different options including the answer, and the answer is on the chart', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const q = makeQuestion(seed)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options).toContain(q.key)
      const found =
        q.kind === 'chart'
          ? findChartPatterns(q.candles).map((m) => m.pattern.key)
          : findCandlePatterns(q.candles, [q.candles.length - 1]).map((m) => m.pattern.key)
      expect(found).toContain(q.key)
      // No other option is also on the chart.
      expect(q.options.filter((k) => k !== q.key && found.includes(k))).toEqual([])
    }
  })
})
