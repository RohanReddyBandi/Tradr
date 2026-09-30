import type { Bias, ChartCard, Decision, Finding } from '../types'
import { findSignalPatterns } from './candlePatterns'
import { findChartPatterns, pickChartPatterns, toFinding } from './chartPatterns'
import { SCANNER_MATCHES } from './setups'
import { FUTURE_CANDLES } from './generator'
import { defaultPlan, simulateTrade, type TradePlan, type TradeResult } from './trade'
import { reviewStopAndTarget, type StopTargetReview } from './riskReview'
import { formatMoney } from '../format'

// A result smaller than this many R counts as breaking even.
const FLAT_R = 0.15

export type Grade = 'good-read' | 'poor-read' | 'no-edge' | 'good-pass' | 'missed-setup'
export type Outcome = 'win' | 'loss' | 'flat'

export const GRADE_LABEL: Record<Grade, string> = {
  'good-read': 'Good read',
  'poor-read': 'Poor read',
  'no-edge': 'No edge',
  'good-pass': 'Good pass',
  'missed-setup': 'Missed setup',
}

export const isGoodGrade = (grade: Grade) => grade === 'good-read' || grade === 'good-pass'

export interface Breakdown {
  decision: Decision
  bias: Bias // which way the chart pointed
  grade: Grade // was the decision right, given what the chart showed?
  outcome: Outcome // how the trade went (for skips: how trading the setup would have gone)
  entry: number // last close before the decision
  movePct: number // how far price moved over the whole replay, in % (+ is up)
  plan: TradePlan | null // your trade (null when skipped)
  result: TradeResult | null // how your trade ended
  missed: { plan: TradePlan; result: TradeResult } | null // skips: trading the setup with default levels
  pnl: number // dollars won or lost (0 when skipped)
  risk: StopTargetReview | null // how good your stop and target were
  findings: Finding[] // everything to name and draw, chart patterns first
  scanned: Finding[] // what the pattern scanner found reading only the candles
  scannerAgrees: boolean | null // did it find the built-in setup? (null when there's none to find)
  headline: string
  chartText: string // "What the chart was saying"
  callText: string // "Your call"
  riskText: string | null // "Your stop and target"
}

const money = (n: number) => formatMoney(Math.abs(n))
const pct = (n: number) => `${Math.abs(n).toFixed(1)}%`
const rText = (r: number) => `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}R`

function outcomeOf(r: number): Outcome {
  if (Math.abs(r) < FLAT_R) return 'flat'
  return r > 0 ? 'win' : 'loss'
}

// `plan` is your trade (null for a skip); `stake` is the usual position size,
// used to show what trading a skipped setup would have done.
export function analyze(card: ChartCard, decision: Decision, plan: TradePlan | null, stake: number): Breakdown {
  const { setup } = card
  const bias = setup.bias
  const entry = card.candles[card.candles.length - 1].close
  const movePct = ((card.future[card.future.length - 1].close - entry) / entry) * 100

  // --- What happened --------------------------------------------------------
  const result = plan ? simulateTrade(plan, card.future) : null
  let missed: Breakdown['missed'] = null
  if (!plan && bias !== 'neutral') {
    const missedPlan = defaultPlan(card.candles, bias === 'bullish' ? 'long' : 'short', stake)
    missed = { plan: missedPlan, result: simulateTrade(missedPlan, card.future) }
  }
  const outcome = result ? outcomeOf(result.r) : missed ? outcomeOf(missed.result.r) : 'flat'

  // --- The grade: judged only on what the chart showed, never on the result --
  const yourSide = decision === 'buy' ? 'bullish' : decision === 'sell' ? 'bearish' : null
  let grade: Grade
  if (bias === 'neutral') grade = yourSide ? 'no-edge' : 'good-pass'
  else if (!yourSide) grade = 'missed-setup'
  else grade = yourSide === bias ? 'good-read' : 'poor-read'

  // --- The candlestick patterns right at the decision point -----------------
  const candleFindings: Finding[] = findSignalPatterns(card.candles).map((m, k) => ({
    id: `candle-${k}`,
    name: m.pattern.name,
    type: 'candle',
    bias: m.pattern.bias,
    meaning: m.pattern.meaning,
    shapes: [{ kind: 'candles', fromIndex: m.start, toIndex: m.end }],
  }))

  // --- The words ------------------------------------------------------------
  const candleText =
    candleFindings.length > 0
      ? candleFindings.map((f) => `In the yellow box: ${f.name}. ${f.meaning}`).join(' ')
      : 'No named candlestick pattern formed on the last few candles.'
  const leaning = {
    bullish: 'Put together, the chart favored buying.',
    bearish: 'Put together, the chart favored selling.',
    neutral: 'Put together, there was no edge either way. This was a chart to skip.',
  }[bias]
  // A strong candle on a chart with no setup: location matters more than the candle.
  const decoyText =
    bias === 'neutral' && candleFindings.some((f) => f.bias !== 'neutral')
      ? "A strong candle in the middle of a range is a decoy: with no floor or ceiling behind it, it doesn't tell you much."
      : ''
  const hardText = card.difficultyNotes.length ? `What made this one hard: ${listOf(card.difficultyNotes)}.` : ''

  const risk = plan ? reviewStopAndTarget(card.candles, plan) : null

  // --- The scanner: the same candles, read with no answer key ----------------
  // On generated charts we can check it against the built-in pattern. Real
  // charts already come from the scanner, so there's nothing to compare.
  const scanned = card.source === 'real' ? [] : pickChartPatterns(findChartPatterns(card.candles)).map(toFinding)
  const expected = SCANNER_MATCHES[setup.key]
  const scannerAgrees = expected
    ? findChartPatterns(card.candles).some((m) => expected.includes(m.pattern.key) && (m.bias === bias || m.bias === 'neutral'))
    : null

  return {
    decision,
    bias,
    grade,
    outcome,
    entry,
    movePct,
    plan,
    result,
    missed,
    pnl: result?.pnl ?? 0,
    risk,
    findings: [...setup.chartFindings, ...candleFindings],
    scanned,
    scannerAgrees,
    headline: headlineFor(grade, outcome),
    chartText: [setup.story, candleText, decoyText, leaning, hardText].filter(Boolean).join(' '),
    callText: callTextFor(decision, bias, grade, outcome, movePct, plan, result, missed),
    riskText: plan && result && risk ? riskTextFor(plan, result, risk, grade, card) : null,
  }
}

function headlineFor(grade: Grade, outcome: Outcome): string {
  const lines: Record<Grade, Record<Outcome, string>> = {
    'good-read': { win: 'Good read, and it paid', loss: 'Good read, unlucky result', flat: 'Good read, no follow-through' },
    'poor-read': { win: 'Bad read, got lucky', loss: 'Bad read, and it cost you', flat: 'Bad read, no damage done' },
    'no-edge': { win: 'No edge, got lucky', loss: 'No edge, and it cost you', flat: 'No edge, no result' },
    'good-pass': { win: 'Good pass', loss: 'Good pass', flat: 'Good pass' },
    'missed-setup': { win: 'Missed setup, and it paid off', loss: 'Missed setup, but it failed anyway', flat: 'Missed setup, no harm done' },
  }
  return lines[grade][outcome]
}

// How a trade ended, in one sentence.
function exitSentence(result: TradeResult, subject: string): string {
  const { exit, pnl, r } = result
  const day = `day ${exit.index + 1}`
  if (exit.reason === 'stop') return `price hit the stop on ${day}, so ${subject} lost ${money(pnl)} (${rText(r)}).`
  if (exit.reason === 'target') return `price reached the target on ${day}, so ${subject} made ${money(pnl)} (${rText(r)}).`
  return `neither the stop nor the target was hit in ${FUTURE_CANDLES} days. Closing at the last candle, ${subject} ${pnl >= 0 ? 'made' : 'lost'} ${money(pnl)} (${rText(r)}).`
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// ["a", "b", "c"] -> "a, b, and c"
function listOf(items: string[]) {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function callTextFor(
  decision: Decision,
  bias: Bias,
  grade: Grade,
  outcome: Outcome,
  movePct: number,
  plan: TradePlan | null,
  result: TradeResult | null,
  missed: Breakdown['missed'],
): string {
  const verb = decision === 'buy' ? 'bought' : 'sold'
  const call = {
    'good-read': `You ${verb}, trading with the setup.`,
    'poor-read': `You ${verb}, betting against a ${bias} setup.`,
    'no-edge': `You ${verb} without a setup behind it. With nothing pointing either way, that's a coin flip.`,
    'good-pass': 'You skipped. With no edge, passing was the disciplined call.',
    'missed-setup': 'You skipped, but this was a clear setup: the pattern and the signal candle lined up.',
  }[grade]

  let happened: string
  if (plan && result) {
    happened = capitalize(exitSentence(result, `your ${money(plan.size)} position`))
  } else if (missed) {
    const side = bias === 'bullish' ? 'Buying' : 'Selling'
    happened = `${side} with the setup, using a standard stop and target: ${exitSentence(missed.result, 'that trade')}`
  } else {
    happened = `Over the next ${FUTURE_CANDLES} days price ${movePct >= 0 ? 'rose' : 'fell'} ${pct(movePct)}, a move nobody could have read from this chart.`
  }

  const lessons: Record<Grade, Record<Outcome, string>> = {
    'good-read': {
      win: 'The setup played out.',
      loss: 'Setups like this work about 4 times in 5, but never every time. This was the 1 in 5. Keep making this call.',
      flat: 'It went nowhere this time. It was still the right call.',
    },
    'poor-read': {
      win: 'You made money, but the chart was pointing the other way. That is luck, not an edge you can repeat.',
      loss: 'The setup played out, against you.',
      flat: 'No damage this time, but the odds were against you.',
    },
    'no-edge': {
      win: 'You got paid on a coin flip. Over many trades, bets without an edge add up to nothing.',
      loss: 'Coin flips lose about half the time. This was one of those times.',
      flat: 'It went nowhere, which is what trades without an edge tend to do.',
    },
    'good-pass': { win: '', loss: '', flat: '' },
    'missed-setup': {
      win: 'Passing on clear setups leaves money on the table.',
      loss: 'The setup failed this time, so skipping happened to save you money. Over many cards, setups like this one pay.',
      flat: 'It went nowhere, so no harm done.',
    },
  }

  return [call, happened, lessons[grade][outcome]].filter(Boolean).join(' ')
}

function riskTextFor(plan: TradePlan, result: TradeResult, risk: StopTargetReview, grade: Grade, card: ChartCard): string {
  const parts = [risk.text]

  // Stopped out, and then price went your way anyway: the classic badly placed stop.
  const finalClose = card.future[card.future.length - 1].close
  const wouldHaveWon = (finalClose - plan.entry) * (plan.direction === 'long' ? 1 : -1) > 0
  if (result.exit.reason === 'stop' && wouldHaveWon && risk.stop !== 'logical') {
    parts.push("Notice that price went your way after stopping you out. That's the telltale sign of a stop in the wrong place.")
  }

  // Tie the risk management back to the read.
  if (grade === 'poor-read' && risk.good) parts.push('The problem was the entry, not the risk management.')
  else if (grade === 'good-read' && risk.good) parts.push('Good read and solid risk management: that combination wins over time.')
  else if (grade === 'good-read' && !risk.good) parts.push('The read was right; the stop and target are what to work on.')

  return parts.join(' ')
}
