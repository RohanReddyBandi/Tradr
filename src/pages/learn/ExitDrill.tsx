import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { annotate, illustrativeVolume } from '../../lib/annotate'
import { EXIT_ROUNDS, exitRange, gradeExits, makeExitChart, outcomeWords, type ExitGrade } from '../../lib/exits'
import { averageTrueRange, openingPlan, simulateTrade, type TradePlan } from '../../lib/trade'
import { AnnotatedChart } from '../../components/AnnotatedChart'
import { TradeLines } from '../../components/TradeLines'
import { ExitLines } from './ExitCharts'
import { formatR } from '../../format'

interface Props {
  onRoundDone: (score: number) => void
  onRunDone: (average: number) => void
  onExit: () => void
}

const REVIEW_SPAN = 30 // candles before the entry the review shows

const newSeed = () => Math.floor(Math.random() * 2 ** 31)
const mark = (points: number) => (points === 1 ? '✓' : points >= 0.5 ? '½' : '✗')
const tone = (points: number) => (points === 1 ? 'text-up' : points >= 0.5 ? 'text-amber' : 'text-down')

// The stop-and-target drill: a setup where you're told the direction, the
// stop and target parked far away, and you drag them where they belong.
// Graded on what you could know at the time, then the month plays out.
export function ExitDrill({ onRoundDone, onRunDone, onExit }: Props) {
  const [runSeed, setRunSeed] = useState(newSeed)
  const [index, setIndex] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [runOver, setRunOver] = useState(false)
  const chart = useMemo(() => makeExitChart(runSeed + index * 7919), [runSeed, index])

  function next() {
    if (scores.length >= EXIT_ROUNDS) {
      setRunOver(true)
      onRunDone(scores.reduce((a, b) => a + b, 0) / scores.length)
    } else setIndex((i) => i + 1)
  }

  function newRun() {
    setRunSeed(newSeed())
    setIndex(0)
    setScores([])
    setRunOver(false)
  }

  if (runOver) {
    const average = scores.reduce((a, b) => a + b, 0) / scores.length
    return (
      <div className="rounded-3xl border border-edge bg-card p-6">
        <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Stop loss & take profit drill</div>
        <div className="mt-3 flex items-baseline gap-3">
          <span className={`font-mono text-[44px] leading-none ${average >= 0.8 ? 'text-up' : average >= 0.5 ? 'text-amber' : 'text-down'}`}>{Math.round(average * 100)}%</span>
          <span className="text-[15px] text-soft">{average >= 0.8 ? 'Your exits are in the right places.' : 'Stops just past the swing, targets just short of the next level.'}</span>
        </div>
        <p className="mt-2 font-mono text-[13px] text-muted">{scores.map((x, i) => `#${i + 1} ${Math.round(x * 100)}%`).join('   ')}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={newRun} className="h-11 rounded-xl bg-up px-5 text-[15px] font-semibold text-black hover:bg-[#5fe6ab]">
            {EXIT_ROUNDS} more charts
          </button>
          <button type="button" onClick={onExit} className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft hover:border-neutral-600 hover:text-white">
            Back to the lesson
          </button>
        </div>
      </div>
    )
  }

  return (
    <Round
      key={`${runSeed}-${index}`}
      chart={chart}
      round={index}
      scores={scores}
      onChecked={(score) => {
        setScores((xs) => [...xs, score])
        onRoundDone(score)
      }}
      onNext={next}
      onExit={onExit}
    />
  )
}

interface RoundProps {
  chart: ReturnType<typeof makeExitChart>
  round: number
  scores: number[]
  onChecked: (score: number) => void
  onNext: () => void
  onExit: () => void
}

function Round({ chart, round, scores, onChecked, onNext, onExit }: RoundProps) {
  const { candles, future, direction, entry, textbook } = chart
  const last = candles.length - 1
  const long = direction === 'long'
  const opening = useMemo(() => openingPlan(candles, direction, 1000), [candles, direction])
  const [stop, setStop] = useState(opening.stop)
  const [target, setTarget] = useState(opening.target)
  const [grade, setGrade] = useState<ExitGrade | null>(null)
  const [shown, setShown] = useState(0)
  const moved = stop !== opening.stop && target !== opening.target

  const plan: TradePlan = { direction, entry, size: 1000, stop, target }
  // (The lines are locked once checked, so these only run then.)
  const result = useMemo(() => (grade ? simulateTrade({ direction, entry, size: 1000, stop, target }, future) : null), [grade, direction, entry, stop, target, future])
  const textbookResult = useMemo(
    () => simulateTrade({ direction, entry, size: 1000, stop: textbook.stop, target: textbook.target }, future),
    [direction, entry, textbook, future],
  )
  const until = result ? Math.min(future.length, Math.max(result.exit.index, textbookResult.exit.index) + 4) : 0
  const played = grade !== null && shown >= until

  // While placing, the chart fits the far-out starting levels. Once checked it
  // zooms in on the levels that matter (yours and the textbook ones) and the replay.
  // (Only the candles you can see, so the room on the chart doesn't hint at where price went.)
  const placingRange = useMemo(() => exitRange(candles, [opening.stop, opening.target]), [candles, opening])
  // The review shows just the last few weeks and the replay, so the exits have room.
  const offset = grade ? Math.max(0, candles.length - REVIEW_SPAN) : 0
  const reviewRange = useMemo(
    () => exitRange([...candles.slice(-REVIEW_SPAN), ...future.slice(0, until)], [stop, target, textbook.stop, textbook.target]),
    [candles, future, until, stop, target, textbook],
  )
  const range = grade ? reviewRange : placingRange
  const allVolume = useMemo(() => illustrativeVolume([...candles, ...future], candles.length * 13), [candles, future])
  const volume = allVolume.slice(offset)
  const at = (spot: { index: number; price: number } | null) => spot && { index: Math.max(0, spot.index - offset), price: spot.price }
  // The setup's own lines, for context: where the support and resistance are.
  const notes = useMemo(() => annotate(chart.shapes, candles, chart.bias, last, false).notes.filter((n) => n.kind !== 'vline'), [chart, candles, last])
  const atr = useMemo(() => averageTrueRange(candles), [candles])

  // Once checked, the next month plays out.
  useEffect(() => {
    if (!grade || shown >= until) return
    const timer = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 400 : 70)
    return () => clearTimeout(timer)
  }, [grade, shown, until])

  function check() {
    const g = gradeExits(candles, plan)
    setGrade(g)
    onChecked(g.total)
  }

  const risk = Math.abs(entry - stop)
  const reward = Math.abs(target - entry)
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
            Chart {round + 1} of {EXIT_ROUNDS}
            {average !== null && <span className="ml-2 font-mono tracking-normal normal-case">· average {Math.round(average * 100)}%</span>}
          </span>
          <button type="button" onClick={onExit} className="h-9 text-[14px] text-muted hover:text-white">
            Back to the lesson
          </button>
        </div>
        <div className="rounded-3xl border border-edge bg-[#07090c] px-1.5 py-2">
          <AnnotatedChart
            candles={grade ? [...candles.slice(offset), ...future.slice(0, shown)] : candles}
            slots={grade ? candles.length - offset + until + 1 : candles.length + future.length}
            range={range}
            notes={grade ? [] : notes}
            volume={volume}
            height={420}
            title={chart.name}
            shadeFrom={grade ? last + 1 - offset : undefined}
            label={`A ${chart.name.toLowerCase()} setup. Place the stop loss and take profit for a ${long ? 'buy' : 'sell'}.`}
            overlay={
              grade
                ? undefined
                : (project) => (
                    <TradeLines
                      project={project}
                      direction={direction}
                      entry={entry}
                      stop={stop}
                      target={target}
                      range={placingRange}
                      onChange={(level, price) => (level === 'stop' ? setStop : setTarget)(price)}
                    />
                  )
            }
          >
            {(scale, plot) =>
              grade && (
                <ExitLines
                  scale={scale}
                  plot={plot}
                  from={last - offset}
                  direction={direction}
                  entry={entry}
                  stop={stop}
                  target={target}
                  swing={at(textbook.swing)}
                  obstacle={at(textbook.obstacle)}
                  ghost={{ stop: textbook.stop, target: textbook.target }}
                />
              )
            }
          </AnnotatedChart>
        </div>
      </section>

      <aside className="mt-4 lg:mt-9">
        <ol className="flex flex-wrap gap-1.5" aria-label="Charts">
          {Array.from({ length: EXIT_ROUNDS }, (_, k) => {
            const points = scores[k]
            return (
              <li
                key={k}
                className={`grid h-8 min-w-8 place-items-center rounded-full border px-2.5 font-mono text-[13px] ${
                  points !== undefined
                    ? `${tone(points)} ${points === 1 ? 'border-up/40' : points >= 0.5 ? 'border-amber/40' : 'border-down/40'}`
                    : k === round
                      ? 'border-neutral-300 text-white'
                      : 'border-neutral-800 text-dim'
                }`}
              >
                {points !== undefined ? mark(points) : k + 1}
              </li>
            )
          })}
        </ol>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={grade ? 'graded' : 'placing'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="mt-4">
            <span className={`inline-block rounded-full border px-3 py-1 text-[13px] font-bold ${long ? 'border-up/30 bg-up/10 text-up' : 'border-down/30 bg-down/10 text-down'}`}>
              {long ? 'BUY' : 'SELL'} at {entry.toFixed(2)}
            </span>
            {!grade ? (
              <>
                <h3 className="mt-3 text-[19px] leading-snug font-semibold">Where do your exits go?</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-soft">
                  You&rsquo;re {long ? 'buying' : 'selling'} this {chart.name.toLowerCase()}. The stop loss (SL) and take profit (TP) start far out: drag them to
                  where you&rsquo;d really get out.
                </p>
                <div className="mt-4 grid grid-cols-3 divide-x divide-edge rounded-2xl border border-edge bg-card py-3 text-center">
                  <Readout label="Risk" value={risk.toFixed(2)} note={`${(risk / atr).toFixed(1)} days' range`} tone="text-down" />
                  <Readout label="Reward" value={reward.toFixed(2)} tone="text-up" />
                  <Readout label="Risk : reward" value={risk > 0 ? `1 : ${(reward / risk).toFixed(1)}` : '—'} tone="text-white" />
                </div>
                <button
                  type="button"
                  onClick={check}
                  className="mt-4 h-12 w-full rounded-2xl bg-up text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
                >
                  Check my exits
                </button>
                {!moved && <p className="mt-2 text-[13px] text-muted">Tip: the lines can also be moved with the arrow keys once focused.</p>}
              </>
            ) : (
              <>
                <dl className="mt-3 flex flex-col gap-2">
                  <Verdict label="Stop loss" words={grade.stopWords} points={grade.stop} />
                  <Verdict label="Take profit" words={grade.targetWords} points={grade.target} />
                </dl>
                <p className="mt-3 text-[15px] leading-relaxed text-neutral-100">{grade.review.text}</p>
                <p className="mt-2 text-[13px] text-muted">
                  Dotted lines: the textbook stop ({textbook.stop.toFixed(2)}) and target ({textbook.target.toFixed(2)}).
                </p>
                <div className="mt-4 min-h-[76px] rounded-2xl border border-edge bg-card px-4 py-3 text-[14px]" aria-live="polite">
                  {played && result ? (
                    <>
                      <div className={result.pnl >= 0 ? 'text-up' : 'text-down'}>
                        Yours: {outcomeWords(result).toLowerCase()}, {formatR(result.r)}
                      </div>
                      <div className="mt-1 text-soft">
                        Textbook: {outcomeWords(textbookResult).toLowerCase()}, {formatR(textbookResult.r)}
                      </div>
                      {grade.total < 0.6 && result.pnl > textbookResult.pnl && (
                        <p className="mt-2 text-[13px] leading-relaxed text-muted">It paid off this time. The grade is for the plan, not the luck: over many trades, exits like these cost more than they make.</p>
                      )}
                      {grade.total >= 0.85 && result.pnl < 0 && (
                        <p className="mt-2 text-[13px] leading-relaxed text-muted">Good exits still lose sometimes. That&rsquo;s what the stop is for: a small, planned loss.</p>
                      )}
                    </>
                  ) : (
                    <span className="text-muted">Playing out the next month…</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!played}
                  className="mt-4 h-12 w-full rounded-2xl bg-up text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab] disabled:opacity-40"
                >
                  {scores.length >= EXIT_ROUNDS ? 'See your score' : 'Next chart'}
                </button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </aside>
    </div>
  )
}

function Readout({ label, value, note, tone: color }: { label: string; value: string; note?: string; tone: string }) {
  return (
    <div className="px-2">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[17px] ${color}`}>{value}</div>
      {note && <div className="mt-0.5 text-[11px] text-muted">{note}</div>}
    </div>
  )
}

function Verdict({ label, words, points }: { label: string; words: string; points: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl border border-edge bg-card px-3.5 py-2.5">
      <dt className="text-[14px] text-soft">{label}</dt>
      <dd className={`text-right text-[14.5px] font-medium ${tone(points)}`}>
        <span aria-hidden="true">{mark(points)} </span>
        {words}
      </dd>
    </div>
  )
}
