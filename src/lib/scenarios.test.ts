import { describe, expect, it } from 'vitest'
import { LIBRARY } from './library'
import { gradeLines, lineMatches, makeScenario, rightCall, scoreScenario, trendOf } from './scenarios'
import { findCandlePatterns } from './candlePatterns'
import { findChartPatterns } from './chartPatterns'

describe('scenarios', () => {
  it('builds one about every pattern in the library', () => {
    for (const e of LIBRARY) {
      const s = makeScenario(e.key, 17)
      expect(s.focus, e.key).toBe(e.key)
      if (e.kind === 'chart') {
        expect(s.pattern?.key, e.key).toBe(e.key)
      } else {
        expect(s.candle?.key, e.key).toBe(e.key)
        expect(findCandlePatterns(s.candles, [s.candle!.to]).map((m) => m.pattern.key)).toContain(e.key)
      }
    }
  })

  it('offers four different choices with exactly one the detectors back', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = makeScenario(null, seed)
      if (s.pattern) {
        expect(new Set(s.pattern.options).size).toBe(4)
        expect(s.pattern.options).toContain(s.pattern.key)
        const scanned = findChartPatterns(s.candles).map((m) => m.pattern.key)
        expect(s.pattern.options.filter((k) => k !== s.pattern!.key && scanned.includes(k))).toEqual([])
      }
      if (s.candle) {
        expect(new Set(s.candle.options).size).toBe(4)
        const there = findCandlePatterns(s.candles, [s.candle.to]).map((m) => m.pattern.key)
        expect(s.candle.options.filter((k) => k !== s.candle!.key && there.includes(k))).toEqual([])
      }
    }
  })

  it('usually has lines to draw and a trend to call', () => {
    const many = Array.from({ length: 60 }, (_, i) => makeScenario(null, i + 100))
    expect(many.filter((s) => s.lines.length > 0).length).toBeGreaterThan(45)
    expect(many.filter((s) => s.trend !== null).length).toBeGreaterThan(30)
  })

  it('knows where to write the pattern name on every chart pattern scenario', () => {
    for (const e of LIBRARY.filter((x) => x.kind === 'chart')) {
      const s = makeScenario(e.key, 21)
      expect(s.tag, e.key).not.toBeNull()
      expect(s.tag!.text).toBe(e.name)
      expect(s.tag!.at.index).toBeGreaterThanOrEqual(0)
      expect(s.tag!.at.index).toBeLessThan(s.candles.length)
    }
  })

  it('grades drawn lines against the key lines', () => {
    const s = makeScenario('doubleBottom', 5)
    expect(s.lines.length).toBeGreaterThan(0)
    const perfect = gradeLines(s, s.lines)
    expect(perfect.share).toBe(1)
    expect(perfect.stray).toHaveLength(0)
    const far = gradeLines(s, [{ kind: 'level', price: Math.max(...s.candles.map((c) => c.high)) * 3 }])
    expect(far.share).toBe(0)
    expect(far.stray).toHaveLength(1)
    expect(lineMatches({ kind: 'level', price: 100 }, { kind: 'level', price: 100.2 }, 1, 50)).toBe(true)
  })

  it('scores a perfect read as 1', () => {
    const s = makeScenario('headAndShoulders', 9)
    const score = scoreScenario(s, { trend: s.trend ?? undefined, pattern: s.pattern?.key, lines: s.lines, candle: s.candle?.key, call: rightCall(s.bias) })
    expect(score.total).toBe(1)
    expect(scoreScenario(s, {}).total).toBe(0)
  })

  it('reads the trend', () => {
    const up = Array.from({ length: 60 }, (_, i) => ({ time: i, open: 100 + i, close: 100.8 + i, high: 101.2 + i, low: 99.6 + i }))
    expect(trendOf(up)).toBe('up')
    const flat = Array.from({ length: 60 }, (_, i) => ({ time: i, open: 100, close: i % 2 ? 101 : 99, high: 101.5, low: 98.5 }))
    expect(trendOf(flat)).toBe('sideways')
  })
})
