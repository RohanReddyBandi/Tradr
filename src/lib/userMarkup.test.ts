import { describe, expect, it } from 'vitest'
import { candlesThrough } from './examples'
import { generateCard } from './generator'
import { findSignalPatterns } from './candlePatterns'
import { gradeMarkup, lineAt, lineVerdict, readLine, type Line } from './userMarkup'
import { findEntry } from './library'
import type { ChartCard } from '../types'

// A range: a floor near 100 and a ceiling near 110, touched three times each.
const range = candlesThrough(
  [[0, 105], [6, 110], [12, 100], [18, 110], [24, 100], [30, 110], [36, 100], [42, 105]],
  3,
)

describe('readLine', () => {
  it('finds support at the floor of a range', () => {
    const floor = Math.min(...range.map((c) => c.low))
    const reading = readLine(range, { kind: 'level', price: floor })
    expect(reading.role).toBe('support')
    expect(reading.touches.length).toBeGreaterThanOrEqual(3)
    expect(lineVerdict(reading)).toBe('strong')
  })

  it('finds resistance at the ceiling', () => {
    const ceiling = Math.max(...range.map((c) => c.high))
    const reading = readLine(range, { kind: 'level', price: ceiling })
    expect(reading.role).toBe('resistance')
    expect(lineVerdict(reading)).toBe('strong')
  })

  it('calls a line through the middle of the range cut', () => {
    expect(lineVerdict(readLine(range, { kind: 'level', price: 105 }))).toBe('cut')
  })

  it('calls a line nowhere near price weak', () => {
    const reading = readLine(range, { kind: 'level', price: 140 })
    expect(reading.touches).toHaveLength(0)
    expect(lineVerdict(reading)).toBe('weak')
  })

  it('reads a rising trendline under the lows of an uptrend', () => {
    const up = candlesThrough([[0, 100], [6, 108], [10, 104], [16, 112], [20, 108], [26, 116], [30, 112], [35, 119]], 5)
    // Through the first and last pullback lows.
    const low = (from: number, to: number) => {
      const slice = up.slice(from, to + 1)
      const price = Math.min(...slice.map((c) => c.low))
      return { index: from + slice.findIndex((c) => c.low === price), price }
    }
    const line: Line = { kind: 'trend', from: low(8, 12), to: low(28, 32) }
    const reading = readLine(up, line)
    expect(reading.role).toBe('support')
    expect(reading.touches.length).toBeGreaterThanOrEqual(2)
    expect(lineVerdict(reading)).not.toBe('cut')
  })

  it('extends trendlines past their ends', () => {
    const line: Line = { kind: 'trend', from: { index: 0, price: 100 }, to: { index: 10, price: 110 } }
    expect(lineAt(line, 20)).toBeCloseTo(120)
  })
})

describe('gradeMarkup', () => {
  // A generated card whose built-in pattern has a labelled level.
  function cardWithLevel(): { card: ChartCard; price: number; label: string } {
    for (let seed = 1; seed < 400; seed++) {
      const card = generateCard(seed, seed * 7919)
      for (const f of card.setup.chartFindings) {
        for (const s of f.shapes) if (s.kind === 'level' && s.label && s.toIndex - s.fromIndex > 10) return { card, price: s.price, label: s.label }
      }
    }
    throw new Error('no card with a level')
  }

  it('returns null when nothing was drawn', () => {
    expect(gradeMarkup(generateCard(1, 1), { drawings: [], pattern: null })).toBeNull()
  })

  it("spots a level drawn on the chart's own line", () => {
    const { card, price, label } = cardWithLevel()
    const review = gradeMarkup(card, { drawings: [{ kind: 'level', price }], pattern: null })!
    expect(review.lines[0].matches).toBe(label.toLowerCase())
    expect(review.lines[0].good).toBe(true)
  })

  it('grades the pattern you named against the built-in one', () => {
    for (let seed = 1; seed < 50; seed++) {
      const card = generateCard(seed, seed * 7919)
      const key = card.setup.chartFindings.map((f) => findEntry(f.name)?.key).find(Boolean)
      if (!key) continue
      const right = gradeMarkup(card, { drawings: [], pattern: key })!
      expect(right.pattern!.verdict).toBe('right')
      expect(right.right).toBe(1)
      expect(right.total).toBe(1)
      return
    }
    throw new Error('no card with a library pattern')
  })

  it('marks a candle right when the detector sees that pattern there', () => {
    for (let seed = 1; seed < 50; seed++) {
      const card = generateCard(seed, seed * 104729)
      const signal = findSignalPatterns(card.candles)[0]
      if (!signal) continue
      const review = gradeMarkup(card, {
        drawings: [
          { kind: 'candle', index: signal.end, key: signal.pattern.key },
          { kind: 'candle', index: signal.end, key: 'abandonedBabyBullish' === signal.pattern.key ? 'doji' : 'abandonedBabyBullish' },
        ],
        pattern: null,
      })!
      expect(review.candles[0].correct).toBe(true)
      expect(review.missedSignals).toHaveLength(0)
      return
    }
    throw new Error('no card with a signal')
  })

  it('lists the signal candles you left unnamed', () => {
    for (let seed = 1; seed < 50; seed++) {
      const card = generateCard(seed, seed * 104729)
      const signal = findSignalPatterns(card.candles)[0]
      if (!signal || signal.start < 3) continue
      const review = gradeMarkup(card, { drawings: [{ kind: 'candle', index: 0, key: 'hammer' }], pattern: null })!
      expect(review.missedSignals).toContain(signal.pattern.name)
      return
    }
  })
})
