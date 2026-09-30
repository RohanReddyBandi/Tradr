import { describe, expect, it } from 'vitest'
import type { Candle } from '../types'
import { planProblem, riskAndReward, simulateTrade, sizeForRisk, type TradePlan } from './trade'
import { reviewStopAndTarget } from './riskReview'

const candles = (rows: number[][]): Candle[] =>
  rows.map(([open, high, low, close], i) => ({ time: i, open, high, low, close }))

// A long from 100 with the stop at 95 and the target at 110: 1 : 2.
const long: TradePlan = { direction: 'long', entry: 100, size: 1000, stop: 95, target: 110 }
const short: TradePlan = { direction: 'short', entry: 100, size: 1000, stop: 105, target: 90 }

describe('simulateTrade', () => {
  it('stops out when a candle reaches the stop', () => {
    const result = simulateTrade(long, candles([[100, 101, 98, 99], [99, 99.5, 94, 95.5], [95.5, 120, 95, 119]]))
    expect(result.exit).toEqual({ reason: 'stop', index: 1, price: 95 })
    expect(result.pnl).toBe(-50) // 10 shares × $5
    expect(result.r).toBeCloseTo(-1)
  })

  it('takes profit when a candle reaches the target', () => {
    const result = simulateTrade(long, candles([[100, 104, 99, 103], [103, 111, 102, 109]]))
    expect(result.exit).toEqual({ reason: 'target', index: 1, price: 110 })
    expect(result.r).toBeCloseTo(2)
  })

  it('assumes the stop came first when one candle touches both', () => {
    const result = simulateTrade(long, candles([[100, 112, 93, 101]]))
    expect(result.exit.reason).toBe('stop')
  })

  it('fills at the open when price gaps past the stop', () => {
    const result = simulateTrade(long, candles([[100, 101, 99, 100], [92, 93, 90, 91]]))
    expect(result.exit).toEqual({ reason: 'stop', index: 1, price: 92 })
    expect(result.r).toBeCloseTo(-1.6) // worse than -1R: that's what gaps do
  })

  it('closes at the last candle when neither level is hit', () => {
    const result = simulateTrade(long, candles([[100, 102, 98, 101], [101, 104, 100, 103]]))
    expect(result.exit).toEqual({ reason: 'end', index: 1, price: 103 })
    expect(result.pnl).toBe(30)
  })

  it('works the other way round for shorts', () => {
    expect(simulateTrade(short, candles([[100, 106, 99, 104]])).exit.reason).toBe('stop')
    const win = simulateTrade(short, candles([[100, 101, 89, 90]]))
    expect(win.exit.reason).toBe('target')
    expect(win.pnl).toBe(100)
  })
})

describe('riskAndReward and planProblem', () => {
  it('works out dollars at risk and to gain', () => {
    expect(riskAndReward(long)).toEqual({ risk: 50, reward: 100 })
  })

  it('catches stops and targets on the wrong side', () => {
    expect(planProblem(long, 10_000)).toBeNull()
    expect(planProblem({ ...long, stop: 101 }, 10_000)).toMatch(/below the entry/)
    expect(planProblem({ ...short, target: 110 }, 10_000)).toMatch(/below the entry/)
    expect(planProblem({ ...long, size: 20_000 }, 10_000)).toMatch(/only have/)
  })
})

describe('reviewStopAndTarget', () => {
  // Candles with a normal day's range of about 4, a swing low at 96 and a high at 108.
  const chart = candles([
    ...Array.from({ length: 12 }, (_, i) => [104 + (i % 3), 106 + (i % 3), 104 + (i % 3) - 2, 105 + (i % 3)]),
    [106, 108, 104, 105], // the swing high
    [105, 106, 102, 103],
    [103, 104, 100, 101],
    [101, 102, 98, 99],
    [99, 100, 96, 97], // the swing low
    [97, 99, 96.5, 98],
    [98, 101, 97, 100],
    [100, 101.5, 99.5, 101], // (a swing point needs 3 candles on each side)
  ])

  it('calls a stop just under the swing low logical', () => {
    const review = reviewStopAndTarget(chart, { ...long, stop: 95.5, target: 108 })
    expect(review.swing).toBe(96)
    expect(review.stop).toBe('logical')
  })

  it('calls a stop right next to the entry too tight', () => {
    expect(reviewStopAndTarget(chart, { ...long, stop: 99 }).stop).toBe('too-tight')
  })

  it('calls a stop far below the swing too wide', () => {
    expect(reviewStopAndTarget(chart, { ...long, stop: 70, target: 160 }).stop).toBe('too-wide')
  })

  it('notices when a short is entered right on top of a floor', () => {
    // Shorting at 96.5, just above the swing low at 96.
    const review = reviewStopAndTarget(chart, { direction: 'short', entry: 96.5, size: 1000, stop: 101, target: 88 })
    expect(review.obstacle).toBe(96)
    expect(review.text).toMatch(/right next to support at 96.00/)
  })

  it('flags a target that is closer than the stop', () => {
    expect(reviewStopAndTarget(chart, { ...long, stop: 95.5, target: 102 }).target).toBe('poor-ratio')
  })
})

describe('sizeForRisk', () => {
  it('sizes the position so hitting the stop loses exactly the risk', () => {
    const size = sizeForRisk(100, 95, 100) // $5 a share at risk, $100 to risk: 20 shares
    expect(size).toBe(2000)
    expect(riskAndReward({ direction: 'long', entry: 100, size, stop: 95, target: 110 }).risk).toBeCloseTo(100)
  })

  it('buys more when the stop is closer, but never more than you have', () => {
    expect(sizeForRisk(100, 98, 100)).toBe(5000)
    expect(sizeForRisk(100, 99.5, 100, 10_000)).toBe(10_000)
    expect(sizeForRisk(100, 100, 100)).toBe(0) // a stop at the entry risks nothing per share
  })
})
