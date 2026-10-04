import { describe, expect, it } from 'vitest'
import { LIBRARY } from './library'
import { detect, examplesOf, lookAlikes, nonExamples, twinOf } from './patternStudy'
import { SPOT } from './spotting'

describe('studying a pattern', () => {
  it('has a spotting checklist for every pattern', () => {
    for (const e of LIBRARY) expect(SPOT[e.key]?.length, e.key).toBeGreaterThanOrEqual(3)
  })

  it('pairs patterns with their upside-down twins', () => {
    expect(twinOf('doubleBottom')).toBe('doubleTop')
    expect(twinOf('doubleTop')).toBe('doubleBottom')
    expect(twinOf('hammer')).toBe('shootingStar')
    expect(twinOf('doji')).toBeNull()
    expect(lookAlikes('headAndShoulders')).toContain('tripleTop')
  })

  it('draws real examples of every pattern', () => {
    for (const e of LIBRARY) {
      const examples = examplesOf(e.key, 7)
      expect(examples.length, e.key).toBe(3)
      for (const x of examples) expect(detect(x.candles, e.kind), e.key).toContain(e.key)
    }
  })

  it('finds look-alikes for every pattern that really are not it', () => {
    const thin: string[] = []
    for (const e of LIBRARY) {
      const misses = nonExamples(e.key, 11)
      for (const m of misses) expect(detect(m.candles, e.kind), `${e.key}: ${m.note}`).not.toContain(e.key)
      if (misses.length < 2) thin.push(`${e.key}:${misses.length}`)
    }
    expect(thin).toEqual([])
  })

})

describe('how to trade it', () => {
  it('tells reversal candles from continuation ones', async () => {
    const { howToTrade } = await import('./spotting')
    expect(howToTrade('candle', null, false, 'bullish')).toMatch(/confirm/)
    expect(howToTrade('candle', null, true, 'bullish')).toMatch(/trend is carrying on/)
    expect(howToTrade('chart', 'reversal', false, 'bearish')).toMatch(/below the neckline/)
  })
})

describe('play it out', () => {
  it('moves the way the pattern leans, and reaches a given target', async () => {
    const { followThrough } = await import('./patternStudy')
    const { chartExample } = await import('./examples')
    const example = chartExample('doubleBottom')!
    const last = example.candles[example.candles.length - 1].close
    expect(followThrough(example, 'bullish').at(-1)!.close).toBeGreaterThan(last)
    expect(followThrough(example, 'bearish').at(-1)!.close).toBeLessThan(last)
    const goal = last * 1.2
    expect(followThrough(example, 'bullish', 5, goal).at(-1)!.close).toBeGreaterThan(goal * 0.98)
  })
})
