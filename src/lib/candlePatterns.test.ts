import { describe, expect, it } from 'vitest'
import type { Candle } from '../types'
import { findCandlePatterns, findSignalPatterns, trendInto } from './candlePatterns'

// Build candles from [open, high, low, close] rows.
const candles = (rows: number[][]): Candle[] =>
  rows.map(([open, high, low, close], i) => ({ time: i, open, high, low, close }))

// Six falling candles to give the patterns a downtrend to react to.
const downtrend = [
  [110, 110.5, 108.5, 109],
  [109, 109.5, 107.5, 108],
  [108, 108.5, 106.5, 107],
  [107, 107.5, 105.5, 106],
  [106, 106.5, 104.5, 105],
  [105, 105.5, 103.5, 104],
  [104, 104.5, 102.5, 103],
]
const uptrend = downtrend.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c])

const namesAtEnd = (cs: Candle[]) =>
  findCandlePatterns(cs, [cs.length - 1]).map((m) => m.pattern.name)

describe('trendInto', () => {
  it('sees a downtrend and an uptrend', () => {
    expect(trendInto(candles([...downtrend, [103, 103, 103, 103]]), 7)).toBe('down')
    expect(trendInto(candles([...uptrend, [97, 97, 97, 97]]), 7)).toBe('up')
  })
})

describe('single-candle patterns', () => {
  it('finds a hammer after a downtrend', () => {
    expect(namesAtEnd(candles([...downtrend, [102.8, 103.1, 100.5, 103]]))).toContain('Hammer')
  })

  it('calls the same hammer shape a hanging man after an uptrend', () => {
    const names = namesAtEnd(candles([...uptrend, [97.2, 97.5, 94.9, 97.4]]))
    expect(names).toContain('Hanging man')
    expect(names).not.toContain('Hammer')
  })

  it('finds a shooting star after an uptrend (a flipped hammer)', () => {
    expect(namesAtEnd(candles([...uptrend, [97.2, 99.5, 96.9, 97]]))).toContain('Shooting star')
  })

  it('finds a doji', () => {
    expect(namesAtEnd(candles([...downtrend, [103, 104, 102, 103.02]]))).toContain('Doji')
  })
})

describe('two-candle patterns', () => {
  it('finds a bullish engulfing', () => {
    const cs = candles([...downtrend, [103, 103.2, 102, 102.3], [102.1, 103.9, 101.9, 103.6]])
    expect(namesAtEnd(cs)).toContain('Bullish engulfing')
  })

  it('finds a bearish engulfing on the mirrored chart', () => {
    const cs = candles([...uptrend, [97, 98, 96.8, 97.7], [97.9, 98.1, 96.1, 96.4]])
    expect(namesAtEnd(cs)).toContain('Bearish engulfing')
  })
})

describe('three-candle patterns', () => {
  it('finds a morning star and hides the smaller patterns inside it', () => {
    const cs = candles([...downtrend, [103, 103.1, 101.4, 101.5], [101.3, 101.5, 101, 101.2], [101.4, 102.9, 101.3, 102.8]])
    const signals = findSignalPatterns(cs).map((m) => m.pattern.name)
    expect(signals).toEqual(['Morning star'])
  })

  it('finds three white soldiers', () => {
    const cs = candles([...downtrend, [103, 104.1, 102.9, 104], [103.6, 105.1, 103.5, 105], [104.6, 106.1, 104.5, 106]])
    expect(namesAtEnd(cs)).toContain('Three white soldiers')
  })
})
