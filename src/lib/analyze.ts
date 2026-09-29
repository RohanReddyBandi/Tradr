import type { Bias, ChartCard, Decision, Finding } from '../types'
import { findSignalPatterns } from './candlePatterns'
import { FUTURE_CANDLES } from './generator'
import { formatMoney } from '../format'

// Until the trade setup panel exists, every trade uses 10% of your balance
// and is held for the whole replay.
export const DEFAULT_POSITION_SHARE = 0.1

// Moves smaller than this (in %) count as going nowhere.
const FLAT_MOVE = 0.5

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
  exit: number // last close of the replay
  movePct: number // how far price moved during the replay, in % (+ is up)
  stake: number // the position size this card was played with (10% of balance)
  size: number // dollars actually put into the trade (0 when skipped)
  pnl: number // dollars won or lost (0 when skipped)
  missedPnl: number // for skips: what trading with the setup would have made
  findings: Finding[] // everything to name and draw, chart patterns first
  headline: string
  chartText: string // "What the chart was saying"
  callText: string // "Your call"
}

const money = (n: number) => formatMoney(Math.abs(n))
const pct = (n: number) => `${Math.abs(n).toFixed(1)}%`

function outcomeOf(movePctInYourFavor: number): Outcome {
  if (Math.abs(movePctInYourFavor) < FLAT_MOVE) return 'flat'
  return movePctInYourFavor > 0 ? 'win' : 'loss'
}

export function analyze(card: ChartCard, decision: Decision, size: number): Breakdown {
  const { setup } = card
  const bias = setup.bias

  // --- The numbers ---------------------------------------------------------
  const entry = card.candles[card.candles.length - 1].close
  const exit = card.future[card.future.length - 1].close
  const movePct = ((exit - entry) / entry) * 100
  const yourDirection = decision === 'buy' ? 1 : decision === 'sell' ? -1 : 0
  const setupDirection = bias === 'bullish' ? 1 : bias === 'bearish' ? -1 : 0
  const tradeSize = decision === 'skip' ? 0 : size
  const pnl = Math.round(tradeSize * (movePct / 100) * yourDirection * 100) / 100
  const missedPnl = Math.round(size * (movePct / 100) * setupDirection * 100) / 100

  const outcome =
    decision === 'skip'
      ? bias === 'neutral'
        ? 'flat'
        : outcomeOf(movePct * setupDirection)
      : outcomeOf(movePct * yourDirection)

  // --- The grade: judged only on what the chart showed, never on the result --
  let grade: Grade
  if (bias === 'neutral') grade = decision === 'skip' ? 'good-pass' : 'no-edge'
  else if (decision === 'skip') grade = 'missed-setup'
  else grade = yourDirection === setupDirection ? 'good-read' : 'poor-read'

  // --- The candlestick patterns right at the decision point -----------------
  const candleFindings: Finding[] = findSignalPatterns(card.candles).map((m, k) => ({
    id: `candle-${k}`,
    name: m.pattern.name,
    type: 'candle',
    bias: m.pattern.bias,
    meaning: m.pattern.meaning,
    shapes: [{ kind: 'candles', fromIndex: m.start, toIndex: m.end }],
  }))

  // --- The words ----------------------------------------------------------
  const candleText =
    candleFindings.length > 0
      ? candleFindings.map((f) => `In the yellow box: ${f.name}. ${f.meaning}`).join(' ')
      : 'No named candlestick pattern formed on the last few candles.'
  const leaning = {
    bullish: 'Put together, the chart favored buying.',
    bearish: 'Put together, the chart favored selling.',
    neutral: 'Put together, there was no edge either way. This was a chart to skip.',
  }[bias]

  return {
    decision,
    bias,
    grade,
    outcome,
    entry,
    exit,
    movePct,
    stake: size,
    size: tradeSize,
    pnl,
    missedPnl,
    findings: [...setup.chartFindings, ...candleFindings],
    headline: headlineFor(grade, outcome),
    chartText: `${setup.story} ${candleText} ${leaning}`,
    callText: callTextFor(decision, bias, grade, outcome, movePct, tradeSize, pnl, missedPnl),
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

function callTextFor(
  decision: Decision,
  bias: Bias,
  grade: Grade,
  outcome: Outcome,
  movePct: number,
  size: number,
  pnl: number,
  missedPnl: number,
): string {
  const verb = decision === 'buy' ? 'bought' : 'sold'
  const direction = movePct >= 0 ? 'rose' : 'fell'
  const days = `Over the next ${FUTURE_CANDLES} days`

  const call = {
    'good-read': `You ${verb}, trading with the setup.`,
    'poor-read': `You ${verb}, betting against a ${bias} setup.`,
    'no-edge': `You ${verb} without a setup behind it. With nothing pointing either way, that's a coin flip.`,
    'good-pass': 'You skipped. With no edge, passing was the disciplined call.',
    'missed-setup': 'You skipped, but this was a clear setup: the pattern and the signal candle lined up.',
  }[grade]

  let result: string
  if (decision === 'skip') {
    result =
      bias === 'neutral'
        ? `${days} price ${direction} ${pct(movePct)}, a move nobody could have read from this chart.`
        : `${days} price ${direction} ${pct(movePct)}. ${bias === 'bullish' ? 'Buying' : 'Selling'} with the setup would have ${missedPnl >= 0 ? 'made' : 'lost'} ${money(missedPnl)}.`
  } else if (outcome === 'flat') {
    result = `${days} price barely moved (${pct(movePct)}), so your ${money(size)} position about broke even.`
  } else {
    result = `${days} price ${direction} ${pct(movePct)}, so your ${money(size)} position ${pnl >= 0 ? 'made' : 'lost'} ${money(pnl)}.`
  }

  const lessons: Record<Grade, Record<Outcome, string>> = {
    'good-read': {
      win: 'The setup played out.',
      loss: 'Setups like this work more often than not, but not every time. Keep making this call.',
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

  return [call, result, lessons[grade][outcome]].filter(Boolean).join(' ')
}
