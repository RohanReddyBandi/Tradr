import { useEffect, useState } from 'react'
import type { ChartCard, Decision } from '../types'
import { makeDealer } from '../lib/generator'
import { drawRealCard, loadRealWindows, loadedRealWindows } from '../lib/realCards'
import { analyze, type Breakdown } from '../lib/analyze'
import { DEFAULT_POSITION_SHARE, type Direction, type TradePlan } from '../lib/trade'
import type { TradeRecord } from '../lib/stats'

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

// ---------------------------------------------------------------------------
// Saving to the browser (localStorage). Only the balance and the history are
// saved. localStorage can be missing or full (private windows, for example),
// so every read and write is wrapped in try/catch and the game still works.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'tradr:v1'

interface Saved {
  version: 1
  balance: number
  history: TradeRecord[]
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    return saved.version === 1 && typeof saved.balance === 'number' && Array.isArray(saved.history) ? saved : null
  } catch {
    return null
  }
}

function save(saved: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // Storage is full or blocked: keep playing, just without saving.
  }
}

// About a third of the cards are real charts, once those have loaded.
const REAL_SHARE = 0.35

// Generated cards come from a shuffled "bag" of every setup, so the same
// setup doesn't come back until you've seen all the others.
const dealGenerated = makeDealer()

function nextCard(number: number): ChartCard {
  const real = loadedRealWindows()
  return real && Math.random() < REAL_SHARE ? drawRealCard(real, number) : dealGenerated(number)
}

// A fresh deck, numbered on from the last card played.
const freshDeck = (lastNumber: number) => [1, 2, 3].map((n) => nextCard(lastNumber + n))

// All of the game's state lives here, so switching tabs doesn't lose it.
export function useGame() {
  const [saved] = useState(load)
  const [balance, setBalance] = useState(saved?.balance ?? STARTING_BALANCE)
  const [history, setHistory] = useState<TradeRecord[]>(saved?.history ?? [])
  const [deck, setDeck] = useState<ChartCard[]>(() => freshDeck(saved?.history[0]?.cardNumber ?? 0))
  const [pending, setPending] = useState<PendingTrade | null>(null)
  const [review, setReview] = useState<Review | null>(null)

  // Save whenever the balance or history changes.
  useEffect(() => save({ version: 1, balance, history }), [balance, history])

  // Start loading the real charts in the background; later cards can use them.
  useEffect(() => {
    loadRealWindows().catch(() => {
      // If they can't load, every card is simply a generated one.
    })
  }, [])

  // The usual position size, used as the default and to show what skips missed.
  const stake = Math.round(balance * DEFAULT_POSITION_SHARE * 100) / 100

  // Grade the card, open its Breakdown, and move the deck along.
  function finish(card: ChartCard, decision: Decision, plan: TradePlan | null) {
    setReview({ card, breakdown: analyze(card, decision, plan, stake), settled: false })
    setDeck((cards) => [...cards.slice(1), nextCard(cards[cards.length - 1].number + 1)])
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
    const { card, breakdown: b } = review
    const balanceAfter = Math.round((balance + b.pnl) * 100) / 100
    const record: TradeRecord = {
      id: card.id,
      cardNumber: card.number,
      setupName: card.real ? `${card.real.ticker} · ${card.setup.name}` : card.setup.name,
      ticker: card.real?.ticker ?? null,
      difficulty: card.difficulty,
      decision: b.decision,
      grade: b.grade,
      outcome: b.outcome,
      pnl: b.pnl,
      r: b.result ? b.result.r : null,
      missedPnl: b.missed ? b.missed.result.pnl : null,
      balanceAfter,
      patterns: b.findings.map((f) => f.name),
      at: Date.now(),
    }
    setReview({ ...review, settled: true })
    setBalance(balanceAfter)
    setHistory((h) => [record, ...h])
  }

  // Leave the Breakdown and show the next card.
  function next() {
    settle()
    setReview(null)
  }

  // Start over: $10,000, no history.
  function reset() {
    setBalance(STARTING_BALANCE)
    setHistory([])
    setPending(null)
    setReview(null)
    setDeck(freshDeck(0))
  }

  return { balance, history, deck, pending, review, decide, enterTrade, cancelTrade, settle, next, reset }
}

export type Game = ReturnType<typeof useGame>
