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
  readBuild,
  resample,
} from './practice'

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
