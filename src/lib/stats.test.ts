import { describe, expect, it } from 'vitest'
import { computeStats, type TradeRecord } from './stats'

let n = 0
function record(fields: Partial<TradeRecord>): TradeRecord {
  n += 1
  return {
    id: `r${n}`,
    cardNumber: n,
    setupName: 'Bull flag',
    ticker: null,
    difficulty: 'medium',
    decision: 'buy',
    grade: 'good-read',
    outcome: 'win',
    pnl: 0,
    r: 0,
    missedPnl: null,
    balanceAfter: 10_000,
    patterns: ['Bull flag'],
    at: n,
    ...fields,
  }
}

// History is stored newest first, like the game keeps it.
// Played in this order: a winning buy, a losing sell, then a skip.
const history = [
  record({ decision: 'buy', grade: 'good-read', outcome: 'win', pnl: 100, r: 2, balanceAfter: 10_100, difficulty: 'easy' }),
  record({ decision: 'sell', grade: 'poor-read', outcome: 'loss', pnl: -30, r: -1, balanceAfter: 10_070, difficulty: 'hard', patterns: ['Bull flag', 'Hammer'] }),
  record({ decision: 'skip', grade: 'missed-setup', outcome: 'win', pnl: 0, r: null, missedPnl: 40, balanceAfter: 10_070, patterns: ['Double bottom'] }),
].reverse()

describe('computeStats', () => {
  const stats = computeStats(history, 10_000)

  it('builds the equity curve from trades only, oldest first', () => {
    expect(stats.equity).toEqual([10_000, 10_100, 10_070])
  })

  it('works out win rate, average R, and best and worst trades', () => {
    expect(stats.trades).toBe(2)
    expect(stats.winRate).toBe(0.5)
    expect(stats.averageR).toBe(0.5)
    expect(stats.best?.pnl).toBe(100)
    expect(stats.worst?.pnl).toBe(-30)
  })

  it('grades decisions separately from results, skips included', () => {
    expect(stats.decisionAccuracy).toBeCloseTo(1 / 3)
    expect(stats.skips).toBe(1)
    expect(stats.skippedWinners).toBe(1)
  })

  it('tracks how often each pattern was read correctly, worst first', () => {
    expect(stats.patterns.get('Bull flag')).toEqual({ name: 'Bull flag', seen: 2, correct: 1 })
    expect(stats.patternsMissed[0].correct).toBe(0) // Hammer or Double bottom: never right
  })

  it('averages stop and target accuracy, ignoring trades saved before it existed', () => {
    const scored = [
      record({ stopAccuracy: 0.5, targetAccuracy: 1 }),
      record({ stopAccuracy: 0.9, targetAccuracy: null }), // no move to target: the stop alone counts
      record({}),
    ]
    const s = computeStats(scored, 10_000)
    expect(s.stopAccuracy).toBeCloseTo(0.7)
    expect(s.targetAccuracy).toBeCloseTo(1)
    expect(s.accuracy).toBeCloseTo((0.75 + 0.9) / 2)
  })

  it('adds up chart markup over the trades that had some', () => {
    const marked = [record({ markup: { right: 2, total: 3 } }), record({ markup: null }), record({ markup: { right: 1, total: 1 } }), record({})]
    expect(computeStats(marked, 10_000).markup).toEqual({ trades: 2, right: 3, total: 4 })
    expect(computeStats([record({})], 10_000).markup).toBeNull()
  })

  it('handles an empty history', () => {
    const empty = computeStats([], 10_000)
    expect(empty.equity).toEqual([10_000])
    expect(empty.winRate).toBeNull()
    expect(empty.averageR).toBeNull()
  })
})
