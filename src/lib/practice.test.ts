import { describe, expect, it } from 'vitest'
import { findChartPatterns } from './chartPatterns'
import { candleExample } from './examples'
import { makeRng } from './random'
import {
  DRAWABLE,
  PRACTICE_CANDLES,
  buildTask,
  candlesFromDrawing,
  drawGuide,
  gradeMarks,
  makeMarkChart,
  readBuild,
  resample,
} from './practice'

describe('Mark the candles', () => {
  const charts = Array.from({ length: 150 }, (_, i) => makeMarkChart(i + 1))

  it('hides exactly three patterns, and nothing else the detector would name', () => {
    const exact = charts.filter((c) => c.answers.length === 3)
    expect(exact.length / charts.length).toBeGreaterThan(0.95)
  })

  it('uses every candlestick pattern sooner or later', () => {
    const seen = new Set(Array.from({ length: 500 }, (_, i) => makeMarkChart(i + 1000)).flatMap((c) => c.answers.map((a) => a.pattern.key)))
    expect(PRACTICE_CANDLES.filter((p) => !seen.has(p.key)).map((p) => p.key)).toEqual([])
  })

  it('gives full marks for the right answers, on any of their candles', () => {
    for (const chart of charts.slice(0, 30)) {
      const marks = chart.answers.map((a) => ({ index: a.end, key: a.pattern.key }))
      const result = gradeMarks(chart, marks)
      expect(result.found).toHaveLength(chart.answers.length)
      expect(result.wrong).toBe(0)
      const onFirstCandle = gradeMarks(chart, chart.answers.map((a) => ({ index: a.start, key: a.pattern.key })))
      expect(onFirstCandle.found).toHaveLength(chart.answers.length)
    }
  })

  it('counts a wrong name as wrong, and an unmarked pattern as missed', () => {
    const chart = charts[0]
    const [first] = chart.answers
    const wrongKey = PRACTICE_CANDLES.find((p) => !chart.all.some((m) => m.pattern.key === p.key))!.key
    const result = gradeMarks(chart, [{ index: first.start, key: wrongKey }])
    expect(result.wrong).toBe(1)
    expect(result.grades[0].actually).toBe(first)
    expect(result.missed).toHaveLength(chart.answers.length)
  })
})

describe('Build a candlestick', () => {
  for (const pattern of PRACTICE_CANDLES) {
    it(`can build a ${pattern.name.toLowerCase()}, and doesn't start as one`, () => {
      const task = buildTask(pattern.key)
      expect(task.start).toHaveLength(pattern.size)
      expect(readBuild(task.context, task.start).map((m) => m.pattern.key)).not.toContain(pattern.key)
      // The Learn example's candles, dropped into the editor, are recognised.
      const example = candleExample(pattern.key)!
      const yours = example.candles.slice(task.context.length)
      expect(readBuild(task.context, yours).map((m) => m.pattern.key)).toContain(pattern.key)
    })
  }
})

describe('Draw a chart pattern', () => {
  // A shaky hand: a smooth wobble of a point or two on the 60-point-tall pad.
  const wobble = (prices: number[], seed: number) => {
    const rng = makeRng(seed)
    let drift = 0
    return prices.map((p) => {
      drift = drift * 0.7 + rng.noise() * 1.2
      return p + drift
    })
  }

  it('recognises every guide, traced exactly', () => {
    const missed = DRAWABLE.filter((p) => !findChartPatterns(candlesFromDrawing(drawGuide(p.key))).some((m) => m.pattern.key === p.key))
    expect(missed.map((p) => p.key)).toEqual([])
  })

  it('still recognises most guides traced by a shaky hand', () => {
    let hits = 0
    let tries = 0
    for (const p of DRAWABLE) {
      for (let seed = 1; seed <= 6; seed++) {
        tries++
        if (findChartPatterns(candlesFromDrawing(wobble(drawGuide(p.key), seed), seed)).some((m) => m.pattern.key === p.key)) hits++
      }
    }
    expect(hits / tries).toBeGreaterThan(0.8)
  })

  it('fills the gaps in a drawing with straight lines', () => {
    expect(resample([10, null, null, 40], 4)).toEqual([10, 20, 30, 40])
    expect(resample([null, 5, 6], 3)).toEqual([5, 5, 6]) // the start is held flat
    expect(resample([null, null, 7], 3)).toBeNull() // one point isn't a line
  })
})
