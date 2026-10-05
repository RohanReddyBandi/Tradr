import type { TradeRecord } from '../lib/stats'

// Checks for data read back from localStorage. Anything there can be damaged
// (a full disk, an old version, someone editing it by hand), so each piece is
// checked before the app trusts it: a bad record is dropped instead of
// crashing the page that shows it.

export const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
export const isText = (s: unknown): s is string => typeof s === 'string'
export const isTextList = (xs: unknown): xs is string[] => Array.isArray(xs) && xs.every(isText)
const oneOf = <T extends string>(options: readonly T[]) => (s: unknown): s is T => options.includes(s as T)

const isDecision = oneOf(['buy', 'sell', 'skip'] as const)
const isDifficulty = oneOf(['easy', 'medium', 'hard'] as const)
const isGrade = oneOf(['good-read', 'poor-read', 'no-edge', 'good-pass', 'missed-setup'] as const)
const isOutcome = oneOf(['win', 'loss', 'flat'] as const)
const optionalNumber = (n: unknown) => n === undefined || n === null || isNumber(n)

export function isTradeRecord(value: unknown): value is TradeRecord {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  const markup = r.markup as Record<string, unknown> | null | undefined
  return (
    isText(r.id) &&
    isNumber(r.cardNumber) &&
    isText(r.setupName) &&
    (r.ticker === null || isText(r.ticker)) &&
    isDifficulty(r.difficulty) &&
    isDecision(r.decision) &&
    isGrade(r.grade) &&
    isOutcome(r.outcome) &&
    isNumber(r.pnl) &&
    (r.r === null || isNumber(r.r)) &&
    (r.missedPnl === null || isNumber(r.missedPnl)) &&
    optionalNumber(r.stopAccuracy) &&
    optionalNumber(r.targetAccuracy) &&
    (markup === undefined || markup === null || (typeof markup === 'object' && isNumber(markup.right) && isNumber(markup.total))) &&
    isNumber(r.balanceAfter) &&
    isTextList(r.patterns) &&
    isNumber(r.at)
  )
}
