import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Review } from '../game/useGame'
import { GRADE_LABEL, isGoodGrade, type Breakdown } from '../lib/analyze'
import { FUTURE_CANDLES } from '../lib/generator'
import { CandleChart } from '../components/CandleChart'
import { Markup } from '../components/Markup'
import { DifficultyBadge } from '../components/DifficultyBadge'
import { COLORS } from '../theme'
import { formatR, formatSignedMoney, formatSignedPercent } from '../format'
import { riskAndReward, sign, type TradePlan, type TradeResult } from '../lib/trade'
import type { Candle } from '../types'

interface Props {
  review: Review
  onSettle: () => void // the replay finished
  onNext: () => void
}

const FIRST_CANDLE_DELAY = 450 // ms pause before the replay starts
const CANDLE_DELAY = 70 // ms between replayed candles

export function BreakdownView({ review, onSettle, onNext }: Props) {
  const { card, breakdown: b } = review
  const reduceMotion = useReducedMotion()
  const allCandles = useMemo(() => [...card.candles, ...card.future], [card])
  const entryIndex = card.candles.length - 1

  // How many candles are on screen. The replay adds one at a time.
  const [shown, setShown] = useState(reduceMotion || review.settled ? allCandles.length : card.candles.length)
  const done = shown >= allCandles.length
  // The pattern to highlight: the chip under the mouse, or else the last one tapped.
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const activeId = hoveredId ?? pinnedId

  useEffect(() => {
    if (done) return
    const wait = shown === card.candles.length ? FIRST_CANDLE_DELAY : CANDLE_DELAY
    const timer = setTimeout(() => setShown((n) => n + 1), wait)
    return () => clearTimeout(timer)
  }, [shown, done, card.candles.length])

  // Once the replay is over, the trade's result is added to your balance.
  // (Calling this more than once is harmless; the game only counts it once.)
  useEffect(() => {
    if (done) onSettle()
  }, [done, onSettle])

  // Enter, Space, or → moves on once the replay is done.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!['Enter', ' ', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      if (done) onNext()
      else setShown(allCandles.length) // first press skips to the end of the replay
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [done, allCandles.length, onNext])

  // Keep the price axis still during the replay, and tall enough to show
  // your stop and target even if price never got near them.
  const priceRange = useMemo(() => {
    const prices = allCandles.flatMap((c) => [c.low, c.high])
    if (b.plan) prices.push(b.plan.stop, b.plan.target)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [allCandles, b.plan])
  const visibleCandles = useMemo(() => allCandles.slice(0, shown), [allCandles, shown])

  // The numbers so far, updated as each replayed candle arrives.
  const revealed = shown - card.candles.length // replay candles on screen
  const movePct = ((allCandles[shown - 1].close - b.entry) / b.entry) * 100
  const live = b.plan && b.result ? liveResult(b.plan, b.result, card.future, revealed) : null
  const liveMissed = b.missed ? liveResult(b.missed.plan, b.missed.result, card.future, revealed) : null
  const favorable = live ? Math.sign(live.pnl) : 0
  const exitColor = favorable > 0 ? COLORS.up : favorable < 0 ? COLORS.down : COLORS.chalk

  const activeFinding = b.findings.find((f) => f.id === activeId)

  return (
    <div className="h-full overflow-y-auto lg:overflow-hidden">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-6 pb-10 md:max-w-lg lg:grid lg:h-full lg:max-w-[1240px] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)] lg:gap-10 lg:px-10 lg:py-8">
        {/* Left: the verdict, the numbers, and the chart. */}
        <section className="flex flex-col gap-5 lg:min-h-0">
          <div>
            <div className="flex items-center justify-between text-[13px] text-muted">
              <span className="text-[11px] tracking-[0.08em] uppercase">Breakdown</span>
              <span className="flex items-center gap-3">
                <DifficultyBadge difficulty={card.difficulty} />
                Card {card.number}
              </span>
            </div>
            <h1 className="mt-2 text-[28px] leading-[1.1] font-bold tracking-tight text-balance lg:text-[38px]">
              {done ? (
                <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="block">
                  {b.headline}
                </motion.span>
              ) : (
                <span className="text-neutral-500">Playing out the next {FUTURE_CANDLES} days…</span>
              )}
            </h1>
          </div>

          <ResultCard b={b} movePct={movePct} live={live} liveMissed={liveMissed} />

          <div
            className="relative h-[320px] rounded-3xl border border-edge bg-card px-2 pt-3 pb-2 lg:min-h-[360px] lg:flex-1"
            onClick={() => setShown(allCandles.length)}
          >
            <CandleChart
              candles={visibleCandles}
              slots={allCandles.length}
              priceRange={priceRange}
              label={`Chart of ${card.candles.length} candles you saw, then ${shown - card.candles.length} replayed candles`}
              overlay={(project) => (
                <Markup
                  project={project}
                  candles={allCandles}
                  entryIndex={entryIndex}
                  shownCount={shown}
                  exitColor={exitColor}
                  findings={b.findings}
                  showFindings={done}
                  activeId={activeId}
                  levels={b.plan && { stop: b.plan.stop, target: b.plan.target }}
                  exit={b.result && { index: entryIndex + 1 + b.result.exit.index, price: b.result.exit.price }}
                />
              )}
            />
          </div>
        </section>

        {/* Right: the grades and the explanation. */}
        <aside className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {!done ? (
            <p className="rounded-2xl border border-dashed border-neutral-800 px-4 py-5 text-[15px] leading-relaxed text-muted">
              The breakdown appears when the replay ends. Tap the chart or press Enter to skip ahead.
            </p>
          ) : (
            <motion.div
              className="flex flex-col gap-6"
              initial="hidden"
              animate="shown"
              variants={{ shown: { transition: { staggerChildren: 0.08 } } }}
            >
              <Reveal>
                <div className="grid grid-cols-2 gap-3">
                  <GradeTile b={b} />
                  <OutcomeTile b={b} />
                </div>
                <p className="mt-3 text-sm leading-snug text-muted">
                  Decision and outcome are graded separately. Good reads can still lose.
                </p>
              </Reveal>

              <Reveal>
                <SectionTitle>Patterns spotted</SectionTitle>
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.findings.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setPinnedId((id) => (id === f.id ? null : f.id))}
                      onMouseEnter={() => setHoveredId(f.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      aria-pressed={pinnedId === f.id}
                      className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-[15px] transition-colors ${
                        activeId === f.id ? 'border-neutral-500 bg-neutral-900 text-white' : 'border-neutral-800 bg-card text-neutral-200 hover:border-neutral-600'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={f.type === 'candle' ? 'size-2.5 rounded-[3px] border border-marker bg-marker/20' : 'h-0.5 w-3 rounded-full bg-chalk'}
                      />
                      {f.name}
                    </button>
                  ))}
                </div>
                <p className="mt-3 min-h-[3lh] text-sm leading-relaxed text-soft">
                  {activeFinding ? (
                    <>
                      <span className="font-semibold text-white">{activeFinding.name}. </span>
                      {activeFinding.meaning}
                    </>
                  ) : (
                    <span className="text-muted">Tap a pattern to see it on the chart. Grey is the chart pattern, yellow boxes are the exact candles.</span>
                  )}
                </p>
              </Reveal>

              <Reveal>
                <SectionTitle>What the chart was saying</SectionTitle>
                <p className="mt-2 text-[16px] leading-relaxed text-neutral-200">{b.chartText}</p>
              </Reveal>

              <Reveal>
                <SectionTitle>Your call</SectionTitle>
                <p className="mt-2 text-[16px] leading-relaxed text-neutral-200">{b.callText}</p>
              </Reveal>

              {b.riskText && (
                <Reveal>
                  <SectionTitle>Your stop and target</SectionTitle>
                  <p className="mt-2 text-[16px] leading-relaxed text-neutral-200">{b.riskText}</p>
                </Reveal>
              )}

              <Reveal>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-neutral-700 px-4 py-3.5">
                  <span className="text-sm text-muted">Generated chart</span>
                  <span className="text-right font-mono text-sm text-soft">{card.setup.name}</span>
                </div>
              </Reveal>

              <Reveal>
                <button
                  onClick={onNext}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-up text-lg font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
                >
                  Next card
                  <kbd className="hidden rounded-md border border-black/20 px-1.5 py-0.5 font-mono text-xs font-medium lg:inline">Enter</kbd>
                </button>
              </Reveal>
            </motion.div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Reveal({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 8 }, shown: { opacity: 1, y: 0 } }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">{children}</h2>
}

interface Live {
  pnl: number
  r: number
  closed: boolean // has the trade hit its stop or target (or the last candle) yet?
}

// Where a trade stands after `revealed` replay candles: the final result once
// it has closed, otherwise its value at the latest close ("marked to market").
function liveResult(plan: TradePlan, result: TradeResult, future: Candle[], revealed: number): Live {
  if (revealed <= 0) return { pnl: 0, r: 0, closed: false }
  if (revealed - 1 >= result.exit.index) return { pnl: result.pnl, r: result.r, closed: true }
  const shares = plan.size / plan.entry
  const pnl = shares * (future[revealed - 1].close - plan.entry) * sign(plan.direction)
  const { risk } = riskAndReward(plan)
  return { pnl, r: risk > 0 ? pnl / risk : 0, closed: false }
}

const EXIT_LABEL = { stop: 'Stopped out', target: 'Target hit', end: `Held ${FUTURE_CANDLES} days` }

function ResultCard({ b, movePct, live, liveMissed }: { b: Breakdown; movePct: number; live: Live | null; liveMissed: Live | null }) {
  // Skipped: show how far price moved, and what trading the setup would have done.
  if (!b.plan || !b.result || !live) {
    return (
      <div className="flex items-end justify-between rounded-3xl border border-edge bg-card px-5 py-4">
        <div>
          <div className="text-[13px] font-medium text-soft">Skipped · no position</div>
          <div className="mt-1 font-mono text-[32px] leading-none font-medium text-soft tabular-nums">{formatSignedPercent(movePct)}</div>
        </div>
        {liveMissed && (
          <div className="text-right">
            <div className="text-[13px] text-muted">Trading the setup</div>
            <div className="mt-1 font-mono text-lg tabular-nums">{formatSignedMoney(liveMissed.pnl)}</div>
          </div>
        )}
      </div>
    )
  }

  const tone = live.pnl > 0 ? 'text-up' : live.pnl < 0 ? 'text-down' : 'text-soft'
  const side = b.plan.direction === 'long' ? 'Long' : 'Short'
  return (
    <div className="flex items-end justify-between rounded-3xl border border-edge bg-card px-5 py-4">
      <div>
        <div className={`text-[13px] font-medium ${tone}`}>{live.closed ? `${EXIT_LABEL[b.result.exit.reason]} · ${side}` : `In the trade · ${side}`}</div>
        <div className={`mt-1 font-mono text-[32px] leading-none font-medium tabular-nums ${tone}`}>{formatSignedMoney(live.pnl)}</div>
      </div>
      <div className="text-right">
        <div className="text-[13px] text-muted">R-multiple</div>
        <div className="mt-1 font-mono text-lg tabular-nums">{formatR(live.r)}</div>
      </div>
    </div>
  )
}

function GradeTile({ b }: { b: Breakdown }) {
  const good = isGoodGrade(b.grade)
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${good ? 'border-up/25 bg-up/[0.07]' : 'border-amber/25 bg-amber/[0.07]'}`}>
      <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Your decision</div>
      <div className={`mt-1 text-xl font-bold ${good ? 'text-up' : 'text-amber'}`}>{GRADE_LABEL[b.grade]}</div>
    </div>
  )
}

function OutcomeTile({ b }: { b: Breakdown }) {
  let label: string
  let tone: 'up' | 'down' | 'soft'
  if (b.decision !== 'skip') {
    label = { win: 'Win', loss: 'Loss', flat: 'Flat' }[b.outcome]
    tone = { win: 'up', loss: 'down', flat: 'soft' }[b.outcome] as typeof tone
  } else if (b.bias === 'neutral') {
    label = 'No trade'
    tone = 'soft'
  } else {
    label = { win: 'Setup worked', loss: 'Setup failed', flat: 'Went nowhere' }[b.outcome]
    tone = 'soft'
  }
  const styles = {
    up: 'border-up/25 bg-up/[0.07] text-up',
    down: 'border-down/25 bg-down/[0.07] text-down',
    soft: 'border-neutral-800 bg-card text-soft',
  }[tone]
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${styles}`}>
      <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Outcome</div>
      <div className="mt-1 text-xl font-bold">{label}</div>
    </div>
  )
}
