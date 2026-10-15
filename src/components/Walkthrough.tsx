import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Sheet } from './Sheet'
import { COLORS } from '../theme'
import { markWalkthroughSeen } from '../game/walkthrough'

// The first time you open Tradr: three short steps on how a card works, with
// a small drawing for each. It comes back from "How it works" under the deck.

interface Step {
  title: string
  body: ReactNode
  picture: ReactNode
}

const STEPS: Step[] = [
  {
    title: 'Read the chart, make the call',
    body: (
      <>
        Each card is a daily chart, from a real stock or generated. Swipe <b className="text-up">right to buy</b> if you think it&rsquo;s heading up,{' '}
        <b className="text-down">left to sell</b> if it&rsquo;s heading down, and <b className="text-white">up to skip</b> when there&rsquo;s no clear
        setup. The buttons and arrow keys work too.
      </>
    ),
    picture: <CallPicture />,
  },
  {
    title: 'Plan your exits',
    body: (
      <>
        After a buy or sell, drag the <b className="text-down">stop loss</b>, where you admit you&rsquo;re wrong, and the{' '}
        <b className="text-up">take profit</b>, where you collect. They start far out, so where they go is your call. Size the trade by amount, or by{' '}
        <b className="text-white">Risk</b> to size it from your stop.
      </>
    ),
    picture: <ExitsPicture />,
  },
  {
    title: 'Watch it play out',
    body: (
      <>
        The next 30 days play out and the trade closes at your stop or target. The Breakdown then grades your read and your exits and shows what the chart
        was saying. The Learn tab teaches every pattern behind it. It&rsquo;s all paper money: you start with $10,000.
      </>
    ),
    picture: <ReplayPicture />,
  },
]

export function Walkthrough({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  function finish() {
    markWalkthroughSeen()
    onDone()
  }

  return (
    <Sheet
      title={
        <div>
          <div className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">How Tradr works</div>
          <div className="mt-1.5 flex gap-1.5" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
            {STEPS.map((_, k) => (
              <span key={k} className={`h-1 w-6 rounded-full transition-colors ${k <= index ? 'bg-up' : 'bg-neutral-800'}`} />
            ))}
          </div>
        </div>
      }
      onClose={finish}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={index} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
          <div className="rounded-2xl border border-edge bg-[#07090c] px-2 py-3">{step.picture}</div>
          <h2 className="mt-4 text-[21px] leading-snug font-semibold tracking-tight">{step.title}</h2>
          <p className="mt-2 text-[15.5px] leading-relaxed text-soft">{step.body}</p>
        </motion.div>
      </AnimatePresence>
      <div className="mt-6 flex items-center gap-2">
        {index > 0 ? (
          <button type="button" onClick={() => setIndex(index - 1)} className="h-12 rounded-2xl px-4 text-[15px] text-soft hover:text-white">
            Back
          </button>
        ) : (
          <button type="button" onClick={finish} className="h-12 rounded-2xl px-4 text-[15px] text-muted hover:text-white">
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={() => (last ? finish() : setIndex(index + 1))}
          className="ml-auto h-12 min-w-36 rounded-2xl bg-up px-6 text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
        >
          {last ? 'Start trading' : 'Next'}
        </button>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// The drawings: plain SVG in the app's chart colors.
// ---------------------------------------------------------------------------

// A gentle made-up price path, as [open, close] per candle, for the drawings.
const PATH = [
  [62, 58], [58, 60], [60, 55], [55, 52], [52, 54], [54, 49], [49, 47], [47, 50], [50, 46], [46, 48],
  [48, 52], [52, 51], [51, 55], [55, 58], [58, 56], [56, 60], [60, 63], [63, 61],
]

function Candles({ x0, step, y, from = 0, to = PATH.length, dim = false }: { x0: number; step: number; y: (v: number) => number; from?: number; to?: number; dim?: boolean }) {
  return (
    <g opacity={dim ? 0.45 : 1}>
      {PATH.slice(from, to).map(([open, close], k) => {
        const x = x0 + k * step
        const up = close >= open
        const color = up ? COLORS.up : COLORS.down
        const top = y(Math.max(open, close))
        const bottom = y(Math.min(open, close))
        return (
          <g key={k}>
            <line x1={x} x2={x} y1={top - 5} y2={bottom + 5} stroke={color} strokeWidth={1.2} />
            <rect x={x - step * 0.3} y={top} width={step * 0.6} height={Math.max(1.5, bottom - top)} rx={1} fill={color} />
          </g>
        )
      })}
    </g>
  )
}

const picture = (children: ReactNode, label: string) => (
  <svg viewBox="0 0 320 140" className="block h-[140px] w-full" role="img" aria-label={label}>
    {children}
  </svg>
)

function CallPicture() {
  const y = (v: number) => 128 - (v - 40) * 4.2
  return picture(
    <>
      <rect x={92} y={10} width={136} height={120} rx={14} fill="#0b0b0b" stroke="#2a2a2a" />
      <Candles x0={106} step={6.4} y={(v) => y(v) + 4} />
      <g fontFamily="inherit" fontSize={13} fontWeight={600}>
        <text x={18} y={76} fill={COLORS.down}>
          ← Sell
        </text>
        <text x={302} y={76} textAnchor="end" fill={COLORS.up}>
          Buy →
        </text>
      </g>
      <path d="M160 6 l-5 6 h10 z" fill="#d9d9d9" />
      <text x={174} y={13} fontSize={11} fill="#b5b5b5">
        Skip
      </text>
    </>,
    'A chart card: swipe left to sell, right to buy, up to skip',
  )
}

function ExitsPicture() {
  const y = (v: number) => 128 - (v - 44) * 4.2
  const x0 = 22
  const step = 9.5
  const entryX = x0 + (PATH.length - 1) * step
  const entry = 61
  const target = 71
  const stop = 55
  // A grab handle on a line, with arrows pointing the way it drags.
  const handle = (price: number, color: string) => (
    <g transform={`translate(256 ${y(price) - 9})`}>
      <rect width={30} height={18} rx={9} fill="#0b0b0b" stroke={color} strokeWidth={1.25} />
      <path d="M11 7.5 l4 -4 l4 4 M11 10.5 l4 4 l4 -4" fill="none" stroke="#e8e8e8" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
  return picture(
    <>
      <Candles x0={x0} step={step} y={y} />
      <rect x={entryX} y={y(target)} width={308 - entryX} height={y(entry) - y(target)} fill={COLORS.up} opacity={0.12} />
      <rect x={entryX} y={y(entry)} width={308 - entryX} height={y(stop) - y(entry)} fill={COLORS.down} opacity={0.12} />
      <line x1={entryX} x2={308} y1={y(target)} y2={y(target)} stroke={COLORS.up} strokeWidth={1.5} strokeDasharray="6 5" />
      <line x1={entryX} x2={308} y1={y(stop)} y2={y(stop)} stroke={COLORS.down} strokeWidth={1.5} strokeDasharray="6 5" />
      <line x1={entryX} x2={308} y1={y(entry)} y2={y(entry)} stroke="#d9d9d9" strokeWidth={1.25} />
      <g fontSize={11} fontWeight={600}>
        <text x={entryX + 6} y={y(target) - 6} fill={COLORS.up}>
          Take profit
        </text>
        <text x={entryX + 6} y={y(stop) + 15} fill={COLORS.down}>
          Stop loss
        </text>
        <text x={entryX + 6} y={y(entry) - 5} fill="#d9d9d9">
          Entry
        </text>
      </g>
      {handle(target, COLORS.up)}
      {handle(stop, COLORS.down)}
    </>,
    'Drag the stop loss and take profit lines into place',
  )
}

function ReplayPicture() {
  const y = (v: number) => 132 - (v - 40) * 3.2
  const step = 9.5
  const x0 = 22
  const split = x0 + 11.5 * step
  // After the call: price climbs to the take profit.
  const replay: [number, number][] = [[51, 54], [54, 53], [53, 57], [57, 60], [60, 59], [59, 63], [63, 66], [66, 65], [65, 69], [69, 72]]
  const target = 71
  return picture(
    <>
      <Candles x0={x0} step={step} y={y} to={12} dim />
      <rect x={split} y={0} width={320 - split} height={140} fill="#ffffff" opacity={0.03} />
      <line x1={split} x2={split} y1={8} y2={132} stroke="#38bdf8" strokeWidth={1} strokeDasharray="3 4" />
      {replay.map(([open, close], k) => {
        const x = split + 8 + k * step
        const up = close >= open
        const color = up ? COLORS.up : COLORS.down
        const top = y(Math.max(open, close))
        const bottom = y(Math.min(open, close))
        return (
          <g key={k}>
            <line x1={x} x2={x} y1={top - 4} y2={bottom + 4} stroke={color} strokeWidth={1.2} />
            <rect x={x - step * 0.3} y={top} width={step * 0.6} height={Math.max(1.5, bottom - top)} rx={1} fill={color} />
          </g>
        )
      })}
      <line x1={split} x2={312} y1={y(target)} y2={y(target)} stroke={COLORS.up} strokeWidth={1.5} strokeDasharray="6 5" />
      <g transform={`translate(${split + 44} 106)`}>
        <rect width={118} height={24} rx={12} fill="#0b0b0b" stroke={COLORS.up} strokeOpacity={0.5} />
        <text x={59} y={16} textAnchor="middle" fontSize={11.5} fontWeight={600} fill={COLORS.up}>
          ✓ Good read · +2.1R
        </text>
      </g>
    </>,
    'The next 30 days play out, here up to the take profit, and the trade is graded',
  )
}
