import { describe, expect, it } from 'vitest'
import { findSignalPatterns } from './candlePatterns'
import { EASY_SETUPS, FUTURE_CANDLES, SETUP_WIN_RATE, VISIBLE_CANDLES, generateCard, makeDealer } from './generator'
import { analyze } from './analyze'
import { defaultPlan } from './trade'
import { makeRng } from './random'
import { SETUPS } from './setups'

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
    // Decoy cards are left out on purpose: their last candle is meant to mislead.
    for (const card of cards.filter((c) => !c.difficultyNotes.some((n) => n.includes('decoy')))) {
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
    // Held to the end (a very wide stop and target), trading with the setup should win about SETUP_WIN_RATE of the time.
    const worked = directional.filter((c) => {
      const long = c.setup.bias === 'bullish'
      const entry = c.candles[c.candles.length - 1].close
      const plan = { direction: long ? 'long' : 'short', entry, size: 1000, stop: long ? entry * 0.01 : entry * 10, target: long ? entry * 10 : entry * 0.01 } as const
      return analyze(c, long ? 'buy' : 'sell', plan, 1000).pnl > 0
    })
    expect(worked.length / directional.length).toBeGreaterThan(SETUP_WIN_RATE - 0.07)
    expect(worked.length / directional.length).toBeLessThan(SETUP_WIN_RATE + 0.07)
  })

  it('makes a mix of difficulties, each with its own setups and signals', () => {
    const count = (d: string) => cards.filter((c) => c.difficulty === d).length / cards.length
    expect(count('easy')).toBeGreaterThan(0.25)
    expect(count('medium')).toBeGreaterThan(0.33)
    expect(count('hard')).toBeGreaterThan(0.25)
    // Easy cards stick to the clearest setups; hard cards say why they're hard.
    const easySetups = new Set(cards.filter((c) => c.difficulty === 'easy').map((c) => c.setup.key))
    expect([...easySetups].every((key) => EASY_SETUPS.includes(key))).toBe(true)
    expect(easySetups.size).toBeGreaterThanOrEqual(8)
    expect(cards.filter((c) => c.difficulty === 'hard').every((c) => c.difficultyNotes.length >= 2)).toBe(true)
  })

  it('still finishes hard setups with an agreeing signal almost every time', () => {
    const hard = Array.from({ length: 600 }, (_, i) => generateCard(i + 1, i * 104729 + 7, 'hard')).filter(
      (c) => c.setup.bias !== 'neutral',
    )
    const agreeing = hard.filter((c) => findSignalPatterns(c.candles).some((m) => m.pattern.bias === c.setup.bias))
    expect(agreeing.length / hard.length).toBeGreaterThan(0.93)
  })

  it('puts decoy candles on some hard choppy charts', () => {
    const hardChop = Array.from({ length: 1500 }, (_, i) => generateCard(i + 1, i * 7 + 3, 'hard')).filter(
      (c) => c.setup.key === 'chop',
    )
    const decoys = hardChop.filter((c) => findSignalPatterns(c.candles).some((m) => m.pattern.bias !== 'neutral'))
    expect(decoys.length / hardChop.length).toBeGreaterThan(0.5)
    expect(analyze(decoys[0], 'buy', defaultPlan(decoys[0].candles, 'long', 1000), 1000).chartText).toMatch(/decoy/)
  })

  it('uses every setup and both directions', () => {
    const names = new Set(cards.map((c) => c.setup.name))
    expect(names.size).toBeGreaterThanOrEqual(37)
  })
})

describe('analyze', () => {
  const bullish = cards.find((c) => c.setup.bias === 'bullish')!
  const neutral = cards.find((c) => c.setup.bias === 'neutral')!

  const long = defaultPlan(bullish.candles, 'long', 1000)
  const short = defaultPlan(bullish.candles, 'short', 1000)

  it('grades the decision on the setup, not the result', () => {
    expect(analyze(bullish, 'buy', long, 1000).grade).toBe('good-read')
    expect(analyze(bullish, 'sell', short, 1000).grade).toBe('poor-read')
    expect(analyze(bullish, 'skip', null, 1000).grade).toBe('missed-setup')
    expect(analyze(neutral, 'skip', null, 1000).grade).toBe('good-pass')
    expect(analyze(neutral, 'buy', defaultPlan(neutral.candles, 'long', 1000), 1000).grade).toBe('no-edge')
  })

  it('reviews the stop and target on trades, and shows what a skip missed', () => {
    const traded = analyze(bullish, 'buy', long, 1000)
    expect(traded.riskText).toBeTruthy()
    expect(traded.result).not.toBeNull()
    const skipped = analyze(bullish, 'skip', null, 1000)
    expect(skipped.pnl).toBe(0)
    expect(skipped.missed).not.toBeNull()
    expect(skipped.riskText).toBeNull()
  })
})

describe('makeDealer', () => {
  const deal = makeDealer(makeRng(5).next)
  // One full bag: every setup both ways, and each no-edge setup twice.
  const bagSize = SETUPS.length * 2 // two tickets per setup: bullish and bearish, or a no-edge setup twice
  const firstBag = Array.from({ length: bagSize }, (_, i) => deal(i + 1))

  it('deals every setup, both ways, before repeating any', () => {
    const seen = new Map<string, number>()
    for (const card of firstBag) {
      const name = `${card.setup.key}:${card.setup.bias}`
      seen.set(name, (seen.get(name) ?? 0) + 1)
    }
    for (const setup of SETUPS) {
      if (setup.neutral) expect(seen.get(`${setup.key}:neutral`)).toBe(2)
      else {
        expect(seen.get(`${setup.key}:bullish`)).toBe(1)
        expect(seen.get(`${setup.key}:bearish`)).toBe(1)
      }
    }
  })

  it('still mixes difficulties', () => {
    const cards = [...firstBag, ...Array.from({ length: 200 }, (_, i) => deal(bagSize + i + 1))]
    const share = (d: string) => cards.filter((c) => c.difficulty === d).length / cards.length
    expect(share('easy')).toBeGreaterThan(0.15)
    expect(share('medium')).toBeGreaterThan(0.3)
    expect(share('hard')).toBeGreaterThan(0.2)
    expect(cards.filter((c) => c.difficulty === 'easy').every((c) => EASY_SETUPS.includes(c.setup.key))).toBe(true)
  })
})

describe('good reads', () => {
  it('pay off about 4 times in 5 with the usual stop and target', () => {
    const directional = cards.filter((c) => c.setup.bias !== 'neutral')
    const wins = directional.filter((c) => {
      const long = c.setup.bias === 'bullish'
      return analyze(c, long ? 'buy' : 'sell', defaultPlan(c.candles, long ? 'long' : 'short', 1000), 1000).outcome === 'win'
    })
    const rate = wins.length / directional.length
    expect(rate).toBeGreaterThan(0.74)
    expect(rate).toBeLessThan(0.88)
  })
})
