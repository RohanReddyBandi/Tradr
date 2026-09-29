import type { Decision, Difficulty } from '../types'
import type { Grade, Outcome } from './analyze'
import { isGoodGrade } from './analyze'

// One finished card, as saved in history. Small on purpose: it's stored in
// the browser, so it keeps the results, not the whole chart.
export interface TradeRecord {
  id: string
  cardNumber: number
  setupName: string
  difficulty: Difficulty
  decision: Decision
  grade: Grade
  outcome: Outcome
  pnl: number // dollars won or lost (0 for skips)
  r: number | null // result in R (null for skips)
  missedPnl: number | null // skips: what trading the setup would have made (null if there was no setup)
  balanceAfter: number
  patterns: string[] // names of the patterns on the chart, for tracking what you get right
  at: number // when, in milliseconds since 1970
}

export interface PatternRecord {
  name: string
  seen: number
  correct: number // times your decision was graded a good read (or good pass)
}

// Everything on the Stats page, worked out from the history.
export function computeStats(history: TradeRecord[], startingBalance: number) {
  const oldestFirst = [...history].reverse()
  const trades = oldestFirst.filter((r) => r.decision !== 'skip')
  const skips = oldestFirst.filter((r) => r.decision === 'skip')
  const share = (part: number, whole: number) => (whole ? part / whole : null)

  // Balance after each trade, starting from the opening balance.
  const equity = [startingBalance, ...trades.map((r) => r.balanceAfter)]

  const byPnl = [...trades].sort((a, b) => b.pnl - a.pnl)

  const difficulty = (['easy', 'medium', 'hard'] as const).map((level) => {
    const cards = oldestFirst.filter((r) => r.difficulty === level)
    return { level, cards: cards.length, goodReads: cards.filter((r) => isGoodGrade(r.grade)).length }
  })

  // How often each pattern shows up, and how often you made the right call on it.
  const patterns = new Map<string, PatternRecord>()
  for (const r of oldestFirst) {
    for (const name of new Set(r.patterns)) {
      const p = patterns.get(name) ?? { name, seen: 0, correct: 0 }
      p.seen += 1
      if (isGoodGrade(r.grade)) p.correct += 1
      patterns.set(name, p)
    }
  }

  return {
    equity,
    cards: history.length,
    trades: trades.length,
    winRate: share(trades.filter((r) => r.outcome === 'win').length, trades.length),
    averageR: trades.length ? trades.reduce((sum, r) => sum + (r.r ?? 0), 0) / trades.length : null,
    best: byPnl[0] ?? null,
    worst: byPnl[byPnl.length - 1] ?? null,
    // Graded on the decision alone, including skips.
    decisionAccuracy: share(oldestFirst.filter((r) => isGoodGrade(r.grade)).length, oldestFirst.length),
    skips: skips.length,
    skippedWinners: skips.filter((r) => (r.missedPnl ?? 0) > 0).length,
    difficulty,
    // Worst first: lowest share correct, then most often seen.
    patternsMissed: [...patterns.values()].sort((a, b) => a.correct / a.seen - b.correct / b.seen || b.seen - a.seen),
    patterns,
  }
}

export type Stats = ReturnType<typeof computeStats>
