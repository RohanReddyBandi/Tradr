import { describe, expect, it } from 'vitest'
import { isTradeRecord } from './saved'
import { planProblem } from '../lib/trade'

const good = {
  id: 'a1',
  cardNumber: 3,
  setupName: 'Bull flag',
  ticker: null,
  difficulty: 'medium',
  decision: 'buy',
  grade: 'good-read',
  outcome: 'win',
  pnl: 42.1,
  r: 1.8,
  missedPnl: null,
  stopAccuracy: 0.7,
  targetAccuracy: null,
  markup: { right: 2, total: 3 },
  balanceAfter: 10_042.1,
  patterns: ['Bull flag'],
  at: 1_790_000_000_000,
}

describe('saved trade records', () => {
  it('accepts a well-formed record, and older ones without the newer fields', () => {
    expect(isTradeRecord(good)).toBe(true)
    const { stopAccuracy: _s, targetAccuracy: _t, markup: _m, ...old } = good
    expect(isTradeRecord(old)).toBe(true)
  })

  it('rejects damaged records instead of letting them crash a page', () => {
    for (const bad of [
      null,
      'text',
      { ...good, pnl: 'lots' },
      { ...good, pnl: null }, // Infinity and NaN come back from JSON as null
      { ...good, grade: 'amazing' },
      { ...good, patterns: 'Bull flag' },
      { ...good, patterns: [1, 2] },
      { ...good, markup: { right: 'x', total: 3 } },
      { ...good, ticker: 7 },
    ]) {
      expect(isTradeRecord(bad)).toBe(false)
    }
  })
})

describe('trade plans', () => {
  const plan = { direction: 'long' as const, entry: 100, size: 1000, stop: 95, target: 110 }
  it('refuses prices that are not real numbers', () => {
    expect(planProblem(plan, 10_000)).toBeNull()
    expect(planProblem({ ...plan, target: Infinity }, 10_000)).toMatch(/Enter a price/)
    expect(planProblem({ ...plan, stop: NaN }, 10_000)).toMatch(/Enter a price/)
    expect(planProblem({ ...plan, size: Infinity }, 10_000)).toMatch(/only have/)
  })
})
