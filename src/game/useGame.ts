import { useState } from 'react'
import type { ChartCard, Decision } from '../types'
import { generateCard } from '../lib/generator'
import { analyze, type Breakdown } from '../lib/analyze'
import { DEFAULT_POSITION_SHARE, type Direction, type TradePlan } from '../lib/trade'

export const STARTING_BALANCE = 10_000

// A card you swiped buy or sell on, waiting for you to set up the trade.
export interface PendingTrade {
  card: ChartCard
  direction: Direction
}

// A card you've finished, ready for its Breakdown.
export interface Review {
  card: ChartCard
  breakdown: Breakdown
  settled: boolean // has the P&L been added to the balance yet?
}

// All of the game's state lives here, so switching tabs doesn't lose it.
// (Phase 6 will save it to localStorage.)
export function useGame() {
  const [balance, setBalance] = useState(STARTING_BALANCE)
  const [history, setHistory] = useState<Review[]>([])
  const [deck, setDeck] = useState<ChartCard[]>(() => [1, 2, 3].map((n) => generateCard(n)))
  const [pending, setPending] = useState<PendingTrade | null>(null)
  const [review, setReview] = useState<Review | null>(null)

  // The usual position size, used as the default and to show what skips missed.
  const stake = Math.round(balance * DEFAULT_POSITION_SHARE * 100) / 100

  // Grade the card, open its Breakdown, and move the deck along.
  function finish(card: ChartCard, decision: Decision, plan: TradePlan | null) {
    setReview({ card, breakdown: analyze(card, decision, plan, stake), settled: false })
    setDeck((cards) => [...cards.slice(1), generateCard(cards[cards.length - 1].number + 1)])
  }

  // You swiped. A skip goes straight to the Breakdown; buy and sell open the trade setup.
  function decide(decision: Decision) {
    const card = deck[0]
    if (decision === 'skip') finish(card, 'skip', null)
    else setPending({ card, direction: decision === 'buy' ? 'long' : 'short' })
  }

  // You confirmed the trade on the setup screen.
  function enterTrade(plan: TradePlan) {
    if (!pending) return
    finish(pending.card, plan.direction === 'long' ? 'buy' : 'sell', plan)
    setPending(null)
  }

  // You backed out of the setup screen: the card is still on top of the deck.
  function cancelTrade() {
    setPending(null)
  }

  // The replay finished: now the result counts. Guarded so it only happens once.
  function settle() {
    if (!review || review.settled) return
    const done = { ...review, settled: true }
    setReview(done)
    setBalance((b) => Math.round((b + review.breakdown.pnl) * 100) / 100)
    setHistory((h) => [done, ...h])
  }

  // Leave the Breakdown and show the next card.
  function next() {
    settle()
    setReview(null)
  }

  return { balance, history, deck, pending, review, decide, enterTrade, cancelTrade, settle, next }
}

export type Game = ReturnType<typeof useGame>
