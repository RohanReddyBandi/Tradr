import { describe, expect, it } from 'vitest'
import { annotate, illustrativeVolume } from './annotate'
import { chartExample } from './examples'

describe('annotate', () => {
  it('labels a double bottom the textbook way', () => {
    const ex = chartExample('doubleBottom')!
    const { notes, target, breakout } = annotate(ex.shapes, ex.candles, 'bullish')
    const roles = notes.flatMap((n) => (n.kind === 'hline' ? [n.role] : []))
    expect(roles).toContain('support')
    expect(roles).toContain('neckline')
    expect(notes.filter((n) => n.kind === 'marker').map((n) => (n.kind === 'marker' ? n.n : 0))).toEqual([1, 2])
    // The target is the neckline plus the pattern's height.
    expect(breakout).not.toBeNull()
    expect(target!).toBeGreaterThan(breakout!)
    expect(notes.some((n) => n.kind === 'arrow' && n.dir === 'up')).toBe(true)
  })

  it('aims a bearish target down', () => {
    const ex = chartExample('headAndShoulders')!
    const { target } = annotate(ex.shapes, ex.candles, 'bearish')
    expect(target!).toBeLessThan(ex.candles[ex.candles.length - 1].close)
  })

  it('draws no target or arrow when told not to measure, or for neutral patterns', () => {
    const ex = chartExample('horizontalChannel')!
    expect(annotate(ex.shapes, ex.candles, 'neutral').target).toBeNull()
    expect(annotate(ex.shapes, ex.candles, 'bullish', undefined, false).notes.some((n) => n.kind === 'arrow')).toBe(false)
  })

  it('makes one positive volume bar per candle', () => {
    const ex = chartExample('bullFlag')!
    const volume = illustrativeVolume(ex.candles)
    expect(volume).toHaveLength(ex.candles.length)
    expect(volume.every((v) => v > 0)).toBe(true)
  })
})
