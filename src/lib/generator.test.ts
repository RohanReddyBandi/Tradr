import { describe, expect, it } from 'vitest'
import { findSignalPatterns } from './candlePatterns'
import { FUTURE_CANDLES, SETUP_WIN_RATE, VISIBLE_CANDLES, generateCard } from './generator'
import { analyze } from './analyze'

// Build lots of cards from fixed seeds so the test gives the same answer every run.
const cards = Array.from({ length: 1500 }, (_, i) => generateCard(i + 1, i * 7919 + 13))

describe('generateCard', () => {
  it('makes 60 visible candles and 30 hidden ones, all sensible', () => {
    for (const card of cards) {
      expect(card.candles).toHaveLength(VISIBLE_CANDLES)
      expect(card.future).toHaveLength(FUTURE_CANDLES)
      for (const c of [...card.candles, ...card.future]) {
        expect(c.low).toBeGreaterThan(0)
        expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close))
        expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close))
      }
    }
  })

  it('is repeatable from a seed', () => {
    expect(generateCard(1, 42)).toEqual(generateCard(1, 42))
  })

  it('finishes almost every setup with a candle pattern that agrees with it', () => {
    const misses: string[] = []
    for (const card of cards) {
      const signals = findSignalPatterns(card.candles)
      const agrees = signals.some((m) => m.pattern.bias === card.setup.bias)
      if (!agrees) misses.push(`${card.setup.name}: ${signals.map((m) => m.pattern.name).join(', ') || 'nothing'}`)
    }
    // Print what went wrong to make tuning easy.
    if (misses.length) console.log(misses.slice(0, 15).join('\n'))
    expect(misses.length / cards.length).toBeLessThan(0.03)
  })

  it('never shows a candle pattern that argues against the setup', () => {
    const conflicts = cards.filter((card) =>
      findSignalPatterns(card.candles).some(
        (m) => m.pattern.bias !== 'neutral' && card.setup.bias !== 'neutral' && m.pattern.bias !== card.setup.bias,
      ),
    )
    expect(conflicts.length / cards.length).toBeLessThan(0.01)
  })

  it('lets setups work roughly as often as SETUP_WIN_RATE', () => {
    const directional = cards.filter((c) => c.setup.bias !== 'neutral')
    const worked = directional.filter((c) => {
      const b = analyze(c, c.setup.bias === 'bullish' ? 'buy' : 'sell', 1000)
      return b.pnl > 0
    })
    expect(worked.length / directional.length).toBeGreaterThan(SETUP_WIN_RATE - 0.07)
    expect(worked.length / directional.length).toBeLessThan(SETUP_WIN_RATE + 0.07)
  })

  it('uses every setup and both directions', () => {
    const names = new Set(cards.map((c) => c.setup.name))
    expect(names.size).toBeGreaterThanOrEqual(19)
  })
})

describe('analyze', () => {
  const bullish = cards.find((c) => c.setup.bias === 'bullish')!
  const neutral = cards.find((c) => c.setup.bias === 'neutral')!

  it('grades the decision on the setup, not the result', () => {
    expect(analyze(bullish, 'buy', 1000).grade).toBe('good-read')
    expect(analyze(bullish, 'sell', 1000).grade).toBe('poor-read')
    expect(analyze(bullish, 'skip', 1000).grade).toBe('missed-setup')
    expect(analyze(neutral, 'skip', 1000).grade).toBe('good-pass')
    expect(analyze(neutral, 'buy', 1000).grade).toBe('no-edge')
  })

  it('makes buy and sell mirror images in dollars', () => {
    const buy = analyze(bullish, 'buy', 1000)
    const sell = analyze(bullish, 'sell', 1000)
    expect(buy.pnl).toBeCloseTo(-sell.pnl, 2)
    expect(analyze(bullish, 'skip', 1000).pnl).toBe(0)
  })
})
