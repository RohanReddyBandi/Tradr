import { describe, expect, it } from 'vitest'
import type { Candle } from '../types'
import { bestLevels } from './bestLevels'
import type { TradePlan } from './trade'

// 20 steady candles climbing from 81 to 100: each opens at the last close,
// closes $1 higher, and has 50-cent wicks, so every day's range (the ATR) is $2.
const history: Candle[] = Array.from({ length: 20 }, (_, i) => {
  const open = 80 + i
  return { time: i, open, close: open + 1, high: open + 1.5, low: open - 0.5 }
})
const bar = (open: number, high: number, low: number, close: number, time: number): Candle => ({ time, open, high, low, close })

// After the entry at 100: a dip to 97.5, a rally to 110.5 on day 3, then a slide to 90.
const future = [bar(100, 100.5, 97.5, 98, 20), bar(98, 104.5, 97.8, 104, 21), bar(104, 110.5, 103.5, 110, 22), bar(110, 110.2, 99.5, 100, 23), bar(100, 100.5, 89.5, 90, 24)]
const long: TradePlan = { direction: 'long', entry: 100, size: 2000, stop: 95, target: 110 }

// The same trade upside down, as a short.
const flip = (c: Candle): Candle => ({ time: c.time, open: 200 - c.open, close: 200 - c.close, high: 200 - c.low, low: 200 - c.high })

describe('bestLevels', () => {
  it('puts the best target just inside the high and the best stop just past the dip before it', () => {
    const best = bestLevels(history, future, long)
    expect(best.movedYourWay).toBe(true)
    expect(best.peak).toBe(110.5)
    expect(best.peakDay).toBe(3)
    expect(best.target).toBeCloseTo(110.3) // 0.1 ATR inside the high
    expect(best.stop).toBeCloseTo(97.3) // 0.1 ATR past the 97.5 dip
    expect(best.result.exit.reason).toBe('target')
  })

  it('scores how close your levels were', () => {
    const best = bestLevels(history, future, long)
    expect(best.targetAccuracy).toBeCloseTo(10 / 10.3) // $10 away vs $10.30: nearly perfect
    expect(best.stopAccuracy).toBeCloseTo(2.7 / 5) // $5 away vs $2.70: almost twice as wide as it needed to be
    const perfect = bestLevels(history, future, { ...long, stop: best.stop, target: best.target })
    expect(perfect.stopAccuracy).toBe(1)
    expect(perfect.targetAccuracy).toBe(1)
  })

  it('works the same for a short', () => {
    const best = bestLevels(history.map(flip), future.map(flip), { direction: 'short', entry: 100, size: 2000, stop: 105, target: 90 })
    expect(best.target).toBeCloseTo(89.7)
    expect(best.stop).toBeCloseTo(102.7)
    expect(best.stopAccuracy).toBeCloseTo(2.7 / 5)
  })

  it('recommends a small loss at the logical stop when price never went your way', () => {
    const falling = [bar(100, 100.3, 96, 96.5, 20), bar(96.5, 97, 88, 88.5, 21)]
    const best = bestLevels(history, falling, long)
    expect(best.movedYourWay).toBe(false)
    expect(best.stop).toBe(best.logicalStop)
    expect(best.targetAccuracy).toBeNull()
    expect(best.result.exit.reason).toBe('stop')
  })
})
