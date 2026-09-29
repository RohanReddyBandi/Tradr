import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import type { Decision } from '../types'
import { STARTING_BALANCE, type Game } from '../game/useGame'
import { SwipeCard, type SwipeCardHandle } from '../components/SwipeCard'
import { SessionPanel } from '../components/SessionPanel'
import { LogoIcon } from '../components/icons'
import { BreakdownView } from './BreakdownView'
import { formatMoney } from '../format'

const KEY_TO_DECISION: Record<string, Decision> = {
  ArrowRight: 'buy',
  ArrowLeft: 'sell',
  ArrowUp: 'skip',
}

// The Swipe tab: the card deck, or the Breakdown of the card you just played.
export function SwipePage({ game }: { game: Game }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {game.review ? (
        <motion.div
          key={`review-${game.review.card.id}`}
          className="h-full"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <BreakdownView review={game.review} onSettle={game.settle} onNext={game.next} />
        </motion.div>
      ) : (
        <motion.div key="deck" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <Deck game={game} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Deck({ game }: { game: Game }) {
  const topCard = useRef<SwipeCardHandle>(null)

  // How far the top card has been dragged (0 to 1). The card behind grows
  // into place as you drag, so it's ready by the time the top one is gone.
  const progress = useMotionValue(0)
  const backScale = useTransform(progress, [0, 1], [0.93, 0.985])
  const backY = useTransform(progress, [0, 1], [12, 2])

  // Arrow keys do the same thing as swiping.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const decision = KEY_TO_DECISION[event.key]
      if (!decision) return
      event.preventDefault()
      topCard.current?.swipe(decision)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Only the top two cards are drawn, back one first so the top one sits in front.
  const [top, behind] = game.deck

  return (
    <div className="flex h-full flex-col lg:mx-auto lg:grid lg:max-w-[1240px] lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)] lg:gap-10 lg:px-10 lg:py-8">
      <section className="flex min-h-0 flex-1 flex-col">
        {/* On desktop the top bar shows the logo and balance instead. */}
        <header className="flex items-center justify-between px-6 pt-6 pb-4 lg:hidden">
          <div className="flex items-center gap-2.5">
            <LogoIcon />
            <span className="text-[26px] leading-none font-bold tracking-tight">Tradr</span>
          </div>
          <div className="text-right">
            <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Paper balance</div>
            <div className="mt-1 font-mono text-[17px] leading-none font-semibold">{formatMoney(game.balance)}</div>
          </div>
        </header>

        <div className="relative mx-4 min-h-0 flex-1 lg:mx-0">
          <motion.div
            key={behind.id}
            className="absolute inset-0 origin-bottom"
            style={{ scale: backScale, y: backY }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <SwipeCard card={behind} isTop={false} onDecision={() => {}} />
          </motion.div>
          <motion.div
            key={top.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <SwipeCard card={top} isTop onDecision={game.decide} progress={progress} ref={topCard} />
          </motion.div>
        </div>

        <div className="flex items-center justify-center gap-4 pt-7 tall:pt-9 lg:pt-8">
          <button
            onClick={() => topCard.current?.swipe('sell')}
            className="h-14 w-28 rounded-2xl border border-down/25 bg-down/10 text-lg font-semibold text-down transition-colors hover:bg-down/15 lg:w-36"
          >
            ← Sell
          </button>
          <button
            onClick={() => topCard.current?.swipe('skip')}
            className="size-14 rounded-full border border-neutral-800 bg-neutral-900 text-[15px] font-medium text-soft transition-colors hover:text-white"
          >
            Skip
          </button>
          <button
            onClick={() => topCard.current?.swipe('buy')}
            className="h-14 w-28 rounded-2xl border border-up/25 bg-up/10 text-lg font-semibold text-up transition-colors hover:bg-up/15 lg:w-36"
          >
            Buy →
          </button>
        </div>

        <p className="px-6 pt-3 pb-4 text-center text-[13px] text-muted tall:pb-16 lg:pb-0">
          Swipe right to buy, left to sell, up to skip
          <span className="hidden sm:inline lg:hidden"> · or use the arrow keys</span>
        </p>
      </section>

      <div className="hidden min-h-0 lg:flex lg:flex-col">
        <SessionPanel history={game.history} sessionPnl={game.balance - STARTING_BALANCE} />
      </div>
    </div>
  )
}
