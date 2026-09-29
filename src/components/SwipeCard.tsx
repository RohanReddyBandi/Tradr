import { useImperativeHandle, useRef, type PointerEvent as ReactPointerEvent, type Ref } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type PanInfo,
} from 'motion/react'
import type { ChartCard, Decision } from '../types'
import { CandleChart } from './CandleChart'

// Let go after dragging this far (px) and it counts as a swipe...
const SWIPE_DISTANCE = 110
// ...or flick it at least this fast (px per second), even over a short distance.
const FLICK_SPEED = 550
// Once thrown, a card never travels slower than this, so slow drags still leave briskly.
const MIN_THROW_SPEED = 1400

// What the parent can do with the card through its ref (used by the buttons
// and arrow keys, which don't involve dragging).
export interface SwipeCardHandle {
  swipe: (decision: Decision) => void
}

interface Props {
  card: ChartCard
  isTop: boolean // only the front card can be dragged
  onDecision: (decision: Decision) => void
  progress?: MotionValue<number> // 0 at rest, 1 once dragged far enough to count
  ref?: Ref<SwipeCardHandle>
}

export function SwipeCard({ card, isTop, onDecision, progress, ref }: Props) {
  // x and y follow your finger. Everything else is worked out from them.
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  // Grab the top half and the card swings one way; grab the bottom half and
  // it swings the other, like a real card pivoting around your finger.
  const grabSide = useMotionValue(1)
  const rotate = useTransform(() => (x.get() / 22) * grabSide.get())

  const buyStamp = useTransform(x, [25, SWIPE_DISTANCE], [0, 1])
  const sellStamp = useTransform(x, [-SWIPE_DISTANCE, -25], [1, 0])
  const skipStamp = useTransform(y, [-SWIPE_DISTANCE, -25], [1, 0])

  const leaving = useRef(false) // ignore extra swipes while flying away
  const pastThreshold = useRef(false)
  const reduceMotion = useReducedMotion()

  // Tell the deck how far along the swipe is (it grows the next card), and
  // buzz once when you cross the point of no return.
  function trackProgress() {
    const distance = Math.max(Math.abs(x.get()), -y.get())
    const amount = Math.min(1, Math.max(0, distance / SWIPE_DISTANCE))
    progress?.set(amount)
    if (amount >= 1 && !pastThreshold.current) navigator.vibrate?.(8)
    pastThreshold.current = amount >= 1
  }
  useMotionValueEvent(x, 'change', trackProgress)
  useMotionValueEvent(y, 'change', trackProgress)

  // Throw the card off-screen, then report the decision.
  // `velocity` is how fast your finger was moving when you let go (0 for buttons).
  async function throwCard(decision: Decision, velocity = { x: 0, y: 0 }) {
    if (leaving.current) return
    leaving.current = true

    // Head in the swipe's direction, bent a little toward how you actually flicked.
    let dirX = decision === 'buy' ? 1 : decision === 'sell' ? -1 : 0
    let dirY = decision === 'skip' ? -1 : 0
    const flickSpeed = Math.hypot(velocity.x, velocity.y)
    if (flickSpeed > 0) {
      if (decision === 'skip') dirX = Math.max(-0.5, Math.min(0.5, velocity.x / flickSpeed))
      else dirY = Math.max(-0.5, Math.min(0.5, velocity.y / flickSpeed))
    }
    const length = Math.hypot(dirX, dirY)
    dirX /= length
    dirY /= length

    // Far enough to clear the screen from wherever the card is now.
    const distance = Math.max(window.innerWidth, window.innerHeight) * 1.1
    const speed = Math.max(flickSpeed, MIN_THROW_SPEED)
    const duration = reduceMotion ? 0 : Math.min(0.55, Math.max(0.22, distance / speed))
    // A fast flick keeps its speed (linear). From a standstill (a button
    // press or a slow drag) it accelerates away instead of jumping to full speed.
    const ease = flickSpeed >= MIN_THROW_SPEED ? 'linear' : 'easeIn'

    await Promise.all([
      animate(x, x.get() + dirX * distance, { duration, ease }),
      animate(y, y.get() + dirY * distance, { duration, ease }),
    ])
    onDecision(decision)
  }

  useImperativeHandle(ref, () => ({ swipe: (decision) => throwCard(decision) }))

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    grabSide.set(event.clientY < rect.top + rect.height / 2 ? 1 : -1)
  }

  function handleDragEnd(_event: PointerEvent, info: PanInfo) {
    const { offset, velocity } = info
    const mostlyUp = -offset.y > Math.abs(offset.x)

    if (mostlyUp && (offset.y < -SWIPE_DISTANCE || (velocity.y < -FLICK_SPEED && offset.y < -30))) {
      throwCard('skip', velocity)
    } else if (!mostlyUp && (offset.x > SWIPE_DISTANCE || (velocity.x > FLICK_SPEED && offset.x > 30))) {
      throwCard('buy', velocity)
    } else if (!mostlyUp && (offset.x < -SWIPE_DISTANCE || (velocity.x < -FLICK_SPEED && offset.x < -30))) {
      throwCard('sell', velocity)
    } else {
      // Not far or fast enough: spring back, carrying the release speed so it
      // feels like the card was caught, not teleported.
      const spring = { type: 'spring', stiffness: 420, damping: 28 } as const
      animate(x, 0, { ...spring, velocity: velocity.x })
      animate(y, 0, { ...spring, velocity: velocity.y })
    }
  }

  const lastClose = card.candles[card.candles.length - 1].close

  return (
    <motion.div
      drag={isTop}
      dragMomentum={false} // we animate the release ourselves in handleDragEnd
      onPointerDown={handlePointerDown}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02 }}
      style={{ x, y, rotate }}
      className={`relative flex h-full flex-col rounded-3xl border border-edge bg-card select-none ${
        isTop ? 'cursor-grab touch-none active:cursor-grabbing' : ''
      }`}
    >
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="text-[13px] text-soft">
          Card {card.number} · Daily · {card.candles.length} candles
        </span>
        <span className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-soft">Ticker hidden</span>
      </div>

      <div className="min-h-0 flex-1 px-3 pt-3">
        <CandleChart candles={card.candles} />
      </div>

      <div className="flex items-end justify-between px-6 pt-4 pb-6">
        <div>
          <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Last close</div>
          <div className="mt-1 font-mono text-[26px] leading-none font-medium">{lastClose.toFixed(2)}</div>
        </div>
        <div className="text-lg font-bold tracking-tight">What's your call?</div>
      </div>

      {/* Stamps that fade in while dragging, like a dating app. */}
      <Stamp label="Buy" className="top-16 left-6 -rotate-12 border-up text-up" opacity={buyStamp} />
      <Stamp label="Sell" className="top-16 right-6 rotate-12 border-down text-down" opacity={sellStamp} />
      <Stamp label="Skip" className="bottom-28 left-1/2 -translate-x-1/2 border-neutral-400 text-neutral-200" opacity={skipStamp} />
    </motion.div>
  )
}

function Stamp({ label, className, opacity }: { label: string; className: string; opacity: MotionValue<number> }) {
  // The stamp also grows a little as it appears, so crossing the line feels like it "lands".
  const scale = useTransform(opacity, [0, 1], [0.8, 1])
  return (
    <motion.div
      aria-hidden="true"
      style={{ opacity, scale }}
      className={`pointer-events-none absolute z-10 rounded-xl border-2 bg-black/70 px-4 py-1.5 text-2xl font-bold tracking-wider uppercase ${className}`}
    >
      {label}
    </motion.div>
  )
}
