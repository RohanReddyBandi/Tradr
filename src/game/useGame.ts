import { useState } from 'react'
import type { ChartCard, Decision } from '../types'
import { generateCard } from '../lib/generator'
import { analyze, DEFAULT_POSITION_SHARE, type Breakdown } from '../lib/analyze'

export const STARTING_BALANCE = 10_000

// A card you've made a call on.
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
  const [review, setReview] = useState<Review | null>(null)

  // You swiped: grade the call and open the Breakdown.
  function decide(decision: Decision) {
    const card = deck[0]
    const size = Math.round(balance * DEFAULT_POSITION_SHARE * 100) / 100
    setReview({ card, breakdown: analyze(card, decision, size), settled: false })
    // Take the card off the top and add a fresh one to the bottom.
    setDeck((cards) => [...cards.slice(1), generateCard(cards[cards.length - 1].number + 1)])
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

  return { balance, history, deck, review, decide, settle, next }
}

export type Game = ReturnType<typeof useGame>
