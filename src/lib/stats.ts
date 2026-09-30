import type { Decision, Difficulty } from '../types'
import type { Grade, Outcome } from './analyze'
import { isGoodGrade } from './analyze'

// One finished card, as saved in history. Small on purpose: it's stored in
// the browser, so it keeps the results, not the whole chart.
export interface TradeRecord {
  id: string
  cardNumber: number
  setupName: string
  ticker: string | null // real charts only
  difficulty: Difficulty
  decision: Decision
  grade: Grade
  outcome: Outcome
  pnl: number // dollars won or lost (0 for skips)
  r: number | null // result in R (null for skips)
  missedPnl: number | null // skips: what trading the setup would have made (null if there was no setup)
  // Trades: how close your stop and target were to the best ones (0 to 1).
  // Missing on trades saved before this was added.
  stopAccuracy?: number | null
  targetAccuracy?: number | null
  markup?: { right: number; total: number } | null // what you drew on the chart, and how much of it was right
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

  // Average accuracy of your stops and targets, over the trades that have it.
  const average = (values: (number | null | undefined)[]) => {
    const known = values.filter((v): v is number => typeof v === 'number')
    return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null
  }

  // Everything you drew on trade setup charts, and how much of it was right.
  const marked = trades.filter((r) => r.markup && r.markup.total > 0)
  const markup = marked.length
    ? { trades: marked.length, right: marked.reduce((n, r) => n + r.markup!.right, 0), total: marked.reduce((n, r) => n + r.markup!.total, 0) }
    : null

  return {
    equity,
    markup,
    stopAccuracy: average(trades.map((r) => r.stopAccuracy)),
    targetAccuracy: average(trades.map((r) => r.targetAccuracy)),
    // Each trade's score is the average of its stop and target scores (as on the Breakdown).
    accuracy: average(trades.map((r) => average([r.stopAccuracy, r.targetAccuracy]))),
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
