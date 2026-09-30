import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Review } from '../game/useGame'
import { GRADE_LABEL, isGoodGrade, type Breakdown } from '../lib/analyze'
import { FUTURE_CANDLES } from '../lib/generator'
import { CandleChart } from '../components/CandleChart'
import { Markup } from '../components/Markup'
import { DifficultyBadge } from '../components/DifficultyBadge'
import { findEntry } from '../lib/library'
import { COLORS } from '../theme'
import { formatMoney, formatSignedMoney, formatSignedPercent } from '../format'
import type { BestLevels } from '../lib/bestLevels'
import { riskAndReward, sign, type TradePlan, type TradeResult } from '../lib/trade'
import type { Candle, Finding } from '../types'
import { MarkupReviewCard } from './MarkupReviewCard'

interface Props {
  review: Review
  onSettle: () => void // the replay finished
  onNext: () => void
  onLearn: (patternName: string) => void // open a pattern in the Learn tab
}

const FIRST_CANDLE_DELAY = 450 // ms pause before the replay starts
const CANDLE_DELAY = 70 // ms between replayed candles

export function BreakdownView({ review, onSettle, onNext, onLearn }: Props) {
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
  const [mineFocus, setMineFocus] = useState<number | null>(null) // one of your drawings, highlighted from "Your markup"
  const m = review.markupReview
  const mineStatus = useMemo(() => {
    if (!m) return undefined
    const good = new Map<number, boolean>([...m.lines.map((l) => [l.drawing, l.good] as const), ...m.candles.map((c) => [c.drawing, c.correct] as const)])
    return (k: number) => (good.has(k) ? (good.get(k) ? 'good' : 'bad') : null)
  }, [m])

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
    if (b.best) prices.push(b.best.stop, b.best.target)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [allCandles, b.plan, b.best])
  const visibleCandles = useMemo(() => allCandles.slice(0, shown), [allCandles, shown])

  // The numbers so far, updated as each replayed candle arrives.
  const revealed = shown - card.candles.length // replay candles on screen
  const movePct = ((allCandles[shown - 1].close - b.entry) / b.entry) * 100
  const live = b.plan && b.result ? liveResult(b.plan, b.result, card.future, revealed) : null
  const liveMissed = b.missed ? liveResult(b.missed.plan, b.missed.result, card.future, revealed) : null
  const favorable = live ? Math.sign(live.pnl) : 0
  const exitColor = favorable > 0 ? COLORS.up : favorable < 0 ? COLORS.down : COLORS.chalk

  const activeFinding = b.findings.find((f) => f.id === activeId)
  // The main pattern to study: the first one on this chart that the Learn tab covers.
  const lesson = b.findings.find((f) => findEntry(f.name))
  const activeScan = b.scanned.find((f) => f.id === activeId)
  // Everything a pattern chip needs to highlight its pattern on the chart.
  const chip = (f: Finding, scanner = false) => (
    <PatternChip
      key={f.id}
      finding={f}
      scanner={scanner}
      active={activeId === f.id}
      pinned={pinnedId === f.id}
      onToggle={() => setPinnedId((id) => (id === f.id ? null : f.id))}
      onHover={(on) => setHoveredId(on ? f.id : null)}
    />
  )

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
            {/* Real charts reveal what they were once the replay is over. */}
            {done && card.real && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-[15px] text-soft">
                It was <span className="font-semibold text-white">{card.real.name}</span>{' '}
                <span className="font-mono text-sm">({card.real.ticker})</span>, {dateRange(card.real.from, card.real.to)}.
              </motion.p>
            )}
          </div>

          <ResultCard b={b} movePct={movePct} live={live} liveMissed={liveMissed} balanceBefore={review.balanceBefore} />

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
                  scanned={b.scanned}
                  showFindings={done}
                  activeId={activeId}
                  levels={b.plan && { stop: b.plan.stop, target: b.plan.target }}
                  best={b.best && { stop: b.best.stop, target: b.best.target }}
                  exit={b.result && { index: entryIndex + 1 + b.result.exit.index, price: b.result.exit.price }}
                  mine={review.markup?.drawings ?? null}
                  mineStatus={mineStatus}
                  mineFocus={mineFocus}
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
                {b.findings.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">{b.findings.map((f) => chip(f))}</div>
                ) : (
                  <p className="mt-2 text-sm text-soft">Nothing clear on this chart.</p>
                )}
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

              {b.plan && b.best && (
                <Reveal>
                  <AccuracyCard plan={b.plan} best={b.best} />
                </Reveal>
              )}

              {m && (
                <Reveal>
                  <MarkupReviewCard review={m} onFocus={setMineFocus} onLearn={onLearn} />
                </Reveal>
              )}

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

              {b.best && (
                <Reveal>
                  <SectionTitle>Best stop and target</SectionTitle>
                  <BestLevelsSection b={b} best={b.best} />
                </Reveal>
              )}

              {card.real ? (
                <Reveal>
                  <SectionTitle>Pattern scanner</SectionTitle>
                  <p className="mt-2 text-sm leading-relaxed text-soft">
                    Real charts have no built-in answer, so the patterns above come from the scanner and its read is what
                    your call was graded against. Treat it as a well-informed second opinion: real prices rarely draw
                    textbook shapes.
                  </p>
                </Reveal>
              ) : (
              <Reveal>
                <SectionTitle>Pattern scanner</SectionTitle>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Reading only the candles, the way it reads real charts, the scanner found:
                </p>
                {b.scanned.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">{b.scanned.map((f) => chip(f, true))}</div>
                ) : (
                  <p className="mt-2 text-sm text-soft">No clear chart pattern.</p>
                )}
                {activeScan && (
                  <p className="mt-3 text-sm leading-relaxed text-soft">
                    <span className="font-semibold text-white">{activeScan.name}. </span>
                    {activeScan.meaning}
                  </p>
                )}
                {b.scannerAgrees !== null && (
                  <p className="mt-3 text-sm leading-relaxed text-soft">
                    {b.scannerAgrees
                      ? `It spotted the ${card.setup.name.toLowerCase()} built into this chart.`
                      : `It missed the ${card.setup.name.toLowerCase()} built into this chart. Messy charts fool scanners as well as people.`}
                  </p>
                )}
              </Reveal>
              )}

              <Reveal>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-neutral-700 px-4 py-3.5">
                  <span className="text-sm text-muted">{card.real ? 'Real chart' : 'Generated chart'}</span>
                  <span className="text-right font-mono text-sm text-soft">
                    {card.real ? `${card.real.ticker} · ${dateRange(card.real.from, card.real.to)}` : card.setup.name}
                  </span>
                </div>
              </Reveal>

              <Reveal>
                <div className="flex gap-3">
                  {lesson && (
                    <button
                      onClick={() => onLearn(lesson.name)}
                      className="h-14 flex-1 rounded-2xl border border-neutral-800 bg-card px-4 text-[17px] font-semibold text-neutral-100 transition-colors hover:border-neutral-600"
                    >
                      Learn this pattern
                    </button>
                  )}
                  <button
                    onClick={onNext}
                    className="flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-up text-lg font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
                  >
                    Next card
                    <kbd className="hidden rounded-md border border-black/20 px-1.5 py-0.5 font-mono text-xs font-medium lg:inline">Enter</kbd>
                  </button>
                </div>
              </Reveal>
            </motion.div>
          )}
        </aside>
      </div>
    </div>
  )
}

// Where the stop and target should have gone (in hindsight), and what that
// would have made. For a skipped setup, where they should have gone had you traded it.
function BestLevelsSection({ b, best }: { b: Breakdown; best: BestLevels }) {
  const plan = b.plan ?? b.missed?.plan
  if (!plan) return null
  const long = plan.direction === 'long'
  const position = formatMoney(plan.size)
  const extreme = long ? 'high' : 'low'
  const dip = long ? 'dip' : 'bounce'
  const made = best.result.pnl >= 0 ? `made ${formatMoney(best.result.pnl)}` : `lost ${formatMoney(-best.result.pnl)}`

  let text: string
  if (!best.movedYourWay) {
    text = `Price never really moved your way before breaking the logical stop at ${best.logicalStop.toFixed(2)}, just past the recent swing. The best you could do was a small, planned loss there: with the same ${position} position, a stop at ${best.stop.toFixed(2)} would have ${made}. Sometimes the best trade is a quick exit.`
  } else {
    text = `In hindsight, the best take profit was ${best.target.toFixed(2)}, just inside the ${extreme} of ${best.peak.toFixed(2)} on day ${best.peakDay}, and the best stop was ${best.stop.toFixed(2)}, just past the deepest ${dip} on the way there. With the same ${position} position, those levels would have ${made}.`
  }

  if (!b.plan || !b.result) {
    return (
      <p className="mt-2 text-[16px] leading-relaxed text-neutral-200">
        Had you traded it: {text.charAt(0).toLowerCase()}
        {text.slice(1)}
      </p>
    )
  }
  const yours = b.result.pnl >= 0 ? `made ${formatMoney(b.result.pnl)}` : `lost ${formatMoney(-b.result.pnl)}`
  return (
    <>
      <p className="mt-2 text-[16px] leading-relaxed text-neutral-200">
        {text} Yours {yours}.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Hindsight is perfect and nobody hits these exactly. Accuracy compares distances from your entry: 100% is the same distance as the
        best level, 50% is twice as far away (or half as far).
      </p>
    </>
  )
}

// "Mar 4 – Jul 12, 2019", or with both years if it crosses New Year.
function dateRange(from: string, to: string) {
  const f = new Date(`${from}T00:00:00Z`)
  const t = new Date(`${to}T00:00:00Z`)
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' } as const
  const sameYear = f.getUTCFullYear() === t.getUTCFullYear()
  const start = f.toLocaleDateString('en-US', sameYear ? opts : { ...opts, year: 'numeric' })
  return `${start} – ${t.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

interface ChipProps {
  finding: Finding
  scanner: boolean // a scanner result (dashed) rather than the built-in markup
  active: boolean
  pinned: boolean
  onToggle: () => void
  onHover: (on: boolean) => void
}

// A pattern name you can hover or tap to highlight it on the chart.
function PatternChip({ finding, scanner, active, pinned, onToggle, onHover }: ChipProps) {
  const swatch =
    finding.type === 'candle'
      ? 'size-2.5 rounded-[3px] border border-marker bg-marker/20'
      : scanner
        ? 'w-3 border-t-2 border-dashed border-neutral-200'
        : 'h-0.5 w-3 rounded-full bg-chalk'
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      aria-pressed={pinned}
      className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-[15px] transition-colors ${scanner ? 'border-dashed' : ''} ${
        active ? 'border-neutral-500 bg-neutral-900 text-white' : 'border-neutral-800 bg-card text-neutral-200 hover:border-neutral-600'
      }`}
    >
      <span aria-hidden="true" className={swatch} />
      {finding.name}
    </button>
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

// How the trade ended, for the line under the money.
function exitLine(result: TradeResult) {
  const day = result.exit.index + 1
  if (result.exit.reason === 'stop') return `Stopped out on day ${day}`
  if (result.exit.reason === 'target') return `Target hit on day ${day}`
  return `Held all ${FUTURE_CANDLES} days`
}

interface ResultProps {
  b: Breakdown
  movePct: number
  live: Live | null
  liveMissed: Live | null
  balanceBefore: number
}

function ResultCard({ b, movePct, live, liveMissed, balanceBefore }: ResultProps) {
  // Skipped: show how far price moved, and what trading the setup would have done.
  if (!b.plan || !b.result || !live) {
    return (
      <div className="rounded-3xl border border-edge bg-card px-5 py-4">
        <div className="text-[13px] font-medium text-soft">You skipped</div>
        <div className="mt-2 font-mono text-[40px] leading-none font-medium text-soft tabular-nums">$0.00</div>
        <div className="mt-3 text-[13px] text-muted">
          Price moved {formatSignedPercent(movePct)}
          {liveMissed && (
            <>
              {' '}· trading the setup would have made{' '}
              <span className={`font-mono ${liveMissed.pnl >= 0 ? 'text-up' : 'text-down'}`}>{formatSignedMoney(liveMissed.pnl)}</span>
            </>
          )}
        </div>
      </div>
    )
  }

  // Traded: the money you made or lost, in big type.
  const tone = live.pnl > 0 ? 'text-up' : live.pnl < 0 ? 'text-down' : 'text-soft'
  const side = b.plan.direction === 'long' ? 'Long' : 'Short'
  const verdict = !live.closed ? 'So far' : live.pnl > 0.004 ? 'You made' : live.pnl < -0.004 ? 'You lost' : 'You broke even'
  const amount = live.closed ? formatMoney(Math.abs(live.pnl)) : formatSignedMoney(live.pnl)
  return (
    <div className="rounded-3xl border border-edge bg-card px-5 py-4">
      <div className={`text-[13px] font-medium ${live.closed ? tone : 'text-soft'}`}>{verdict}</div>
      <div className={`mt-2 font-mono text-[40px] leading-none font-medium tabular-nums ${tone}`}>{amount}</div>
      <div className="mt-3 text-[13px] text-muted">
        {live.closed ? exitLine(b.result) : 'In the trade'} · {side} · {formatMoney(b.plan.size)} position
      </div>
      {live.closed && <MoneyMath plan={b.plan} result={b.result} balanceBefore={balanceBefore} />}
    </div>
  )
}

// The arithmetic behind the dollar amount, so you can check it: shares times
// the move per share, and what that was as a share of your whole balance.
function MoneyMath({ plan, result, balanceBefore }: { plan: TradePlan; result: TradeResult; balanceBefore: number }) {
  const shares = plan.size / plan.entry
  const perShare = (result.exit.price - plan.entry) * sign(plan.direction) // what each share made (or lost)
  const onPosition = (perShare / plan.entry) * 100
  const ofBalance = (plan.size / balanceBefore) * 100
  const onBalance = (result.pnl / balanceBefore) * 100
  const share = ofBalance >= 99.95 ? 'all of your balance' : `${ofBalance.toFixed(ofBalance < 10 ? 1 : 0)}% of your balance`
  return (
    <div className="mt-3 border-t border-edge pt-3 text-[13px] leading-relaxed text-muted">
      <div className="font-mono">
        {shares.toFixed(2)} shares × {formatSignedMoney(perShare)} a share ({plan.entry.toFixed(2)} → {result.exit.price.toFixed(2)}) ={' '}
        <span className="text-neutral-100">{formatSignedMoney(result.pnl)}</span>
      </div>
      <div className="mt-1">
        That's {formatSignedPercent(onPosition)} on the {formatMoney(plan.size)} you put in ({share}), or {formatSignedPercent(onBalance)} on
        your whole balance.
      </div>
    </div>
  )
}

// Colors for an accuracy score: red, amber, then green.
const accuracyTone = (share: number) => (share < 0.4 ? 'text-down' : share < 0.7 ? 'text-amber' : 'text-up')
const accuracyColor = (share: number) => (share < 0.4 ? 'bg-down' : share < 0.7 ? 'bg-amber' : 'bg-up')
const accuracyCard = (share: number) =>
  share < 0.4 ? 'border-down/30 bg-down/[0.06]' : share < 0.7 ? 'border-amber/30 bg-amber/[0.06]' : 'border-up/30 bg-up/[0.06]'

// How close your stop and target were to the best ones: one score, then a
// bar for each level with your price next to the best one.
function AccuracyCard({ plan, best }: { plan: TradePlan; best: BestLevels }) {
  const rows = [
    { name: 'Stop loss', yours: plan.stop, best: best.stop, accuracy: best.stopAccuracy },
    { name: 'Take profit', yours: plan.target, best: best.target, accuracy: best.targetAccuracy },
  ]
  const scores = rows.flatMap((r) => (r.accuracy === null ? [] : [r.accuracy]))
  const overall = scores.reduce((a, b) => a + b, 0) / scores.length
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${accuracyCard(overall)}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] tracking-[0.08em] text-muted uppercase">Stop and target accuracy</span>
        <span className={`font-mono text-[22px] leading-none font-medium tabular-nums ${accuracyTone(overall)}`}>{Math.round(overall * 100)}%</span>
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.name}>
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="text-soft">{row.name}</span>
              <span className="font-mono text-[12px] text-muted">
                {row.yours.toFixed(2)} → best {row.best.toFixed(2)}
                <span className="ml-2 text-[13px] text-neutral-100">{row.accuracy === null ? '—' : `${Math.round(row.accuracy * 100)}%`}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-neutral-800">
              {row.accuracy !== null && (
                <div className={`h-full rounded-full ${accuracyColor(row.accuracy)}`} style={{ width: `${Math.max(4, row.accuracy * 100)}%` }} />
              )}
            </div>
          </div>
        ))}
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
