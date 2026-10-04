import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Candle, Shape } from '../../types'
import { entryByKey } from '../../lib/library'
import { SPOT } from '../../lib/spotting'
import { annotate, type Note } from '../../lib/annotate'
import { gradeLines, makeScenario, rightCall, scoreScenario, SCENARIO_MASTERY, type Answers, type Call, type Trend } from '../../lib/scenarios'
import type { Drawing, Line } from '../../lib/userMarkup'
import { AnnotatedChart } from '../../components/AnnotatedChart'
import { DrawingLayer, DrawingShapes } from '../../components/DrawingLayer'
import { LEARN } from '../../theme'

type Step = 'trend' | 'pattern' | 'lines' | 'candle' | 'call'

const STEP_NAME: Record<Step, string> = { trend: 'Trend', pattern: 'Pattern', lines: 'Lines', candle: 'Candle', call: 'Call' }
const TREND_WORDS: Record<Trend, { label: string; why: string }> = {
  up: { label: 'Uptrend', why: 'The left side of the chart sits well below the right: price has been climbing.' },
  down: { label: 'Downtrend', why: 'The left side of the chart sits well above the right: price has been falling.' },
  sideways: { label: 'Sideways', why: 'Both sides of the chart sit at about the same level: price has gone nowhere.' },
}
const CALL_WORDS: Record<Call, string> = { buy: 'Buy', sell: 'Sell', skip: 'Skip' }

interface Props {
  focus: string | null // the pattern being practiced, or null for mixed scenarios
  runLength: number | null // scenarios in a run (null: keep going)
  onScenarioDone?: (score: number) => void
  onRunDone?: (average: number) => void
  onExit: () => void
  exitLabel: string
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31)
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')
const nameOf = (key: string) => entryByKey(key)?.name ?? key

// A real-world scenario: a full chart, read one question at a time, the way
// a trader would. Trend, pattern, its key lines (drawn), the signal candle,
// and the call, then the next 30 days play out with everything labelled.
export function ScenarioPractice({ focus, runLength, onScenarioDone, onRunDone, onExit, exitLabel }: Props) {
  const [runSeed, setRunSeed] = useState(newSeed)
  const [index, setIndex] = useState(0)
  const s = useMemo(() => makeScenario(focus, runSeed + index * 7919), [focus, runSeed, index])
  const steps = useMemo<Step[]>(
    () => [...(s.trend ? ['trend' as const] : []), ...(s.pattern ? ['pattern' as const] : []), ...(s.lines.length ? ['lines' as const] : []), ...(s.candle ? ['candle' as const] : []), 'call'],
    [s],
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [tool, setTool] = useState<'level' | 'trend'>('level')
  const [shown, setShown] = useState(0) // replayed candles
  const [scores, setScores] = useState<number[]>([])
  const [runOver, setRunOver] = useState(false)

  const step = steps[stepIndex]
  const done = (st: Step) => answers[st === 'lines' ? 'lines' : st] !== undefined
  const allDone = done('call')
  const last = s.candles.length - 1
  const score = useMemo(() => scoreScenario(s, answers), [s, answers])

  // The replay, once you've made your call.
  useEffect(() => {
    if (!allDone || shown >= s.future.length) return
    const timer = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 350 : 55)
    return () => clearTimeout(timer)
  }, [allDone, shown, s.future.length])

  function answer(patch: Answers) {
    const next = { ...answers, ...patch }
    setAnswers(next)
    if (patch.call) {
      const total = scoreScenario(s, next).total
      setScores((xs) => [...xs, total])
      onScenarioDone?.(total)
    }
  }

  function nextScenario() {
    if (runLength && scores.length >= runLength) {
      setRunOver(true)
      onRunDone?.(scores.reduce((a, b) => a + b, 0) / scores.length)
      return
    }
    setIndex((i) => i + 1)
    setStepIndex(0)
    setAnswers({})
    setDrawings([])
    setShown(0)
  }

  function newRun() {
    setRunSeed(newSeed())
    setIndex(0)
    setStepIndex(0)
    setAnswers({})
    setDrawings([])
    setShown(0)
    setScores([])
    setRunOver(false)
  }

  // The chart: fixed range and room for the replay from the start, so nothing jumps.
  const range = useMemo(() => {
    const prices = [...s.candles, ...s.future].flatMap((c) => [c.low, c.high])
    const lo = Math.min(...prices)
    const hi = Math.max(...prices)
    return { min: lo - (hi - lo) * 0.08, max: hi + (hi - lo) * 0.1 }
  }, [s])
  const notes: Note[] = useMemo(() => {
    const linesShown = done('lines') || allDone
    const shapes: Shape[] = s.shapes.filter((sh) => (sh.kind === 'candles' ? done('candle') || allDone : linesShown))
    const { notes: made } = annotate(shapes, s.candles, s.bias, last, allDone)
    return made.map((n) => (n.kind === 'box' && s.candle ? { ...n, label: nameOf(s.candle.key) } : n))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, answers, last, allDone])
  const lines = drawings.filter((d): d is Line => d.kind !== 'candle')
  const graded = done('lines') ? gradeLines(s, answers.lines ?? []) : null

  if (runOver) {
    const average = scores.reduce((a, b) => a + b, 0) / scores.length
    const mastered = average >= SCENARIO_MASTERY
    return (
      <div className="rounded-3xl border border-edge bg-card p-6">
        <div className="text-[11px] tracking-[0.08em] text-muted uppercase">{focus ? `${nameOf(focus)} practice` : 'Scenarios'}</div>
        <div className="mt-3 flex items-baseline gap-3">
          <span className={`font-mono text-[44px] leading-none ${mastered ? 'text-up' : average >= 0.5 ? 'text-amber' : 'text-down'}`}>{Math.round(average * 100)}%</span>
          <span className="text-[15px] text-soft">{mastered ? 'Mastered.' : `${Math.round(SCENARIO_MASTERY * 100)}% or more to master it.`}</span>
        </div>
        <p className="mt-2 font-mono text-[13px] text-muted">{scores.map((x, i) => `#${i + 1} ${Math.round(x * 100)}%`).join('   ')}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={newRun} className="h-11 rounded-xl bg-up px-5 text-[15px] font-semibold text-black hover:bg-[#5fe6ab]">
            {runLength} more charts
          </button>
          <button type="button" onClick={onExit} className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft hover:border-neutral-600 hover:text-white">
            {exitLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
            {runLength ? `Chart ${Math.min(index + 1, runLength)} of ${runLength}` : `Scenario ${index + 1}`}
            {scores.length > 0 && <span className="ml-2 font-mono normal-case tracking-normal">· average {Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)}%</span>}
          </span>
          <button type="button" onClick={onExit} className="h-9 text-[14px] text-muted hover:text-white">
            {exitLabel}
          </button>
        </div>
        <div className="rounded-3xl border border-edge bg-[#07090c] px-1.5 py-2">
          <AnnotatedChart
            key={`${runSeed}-${index}`}
            candles={allDone ? [...s.candles, ...s.future.slice(0, shown)] : s.candles}
            slots={s.candles.length + s.future.length}
            range={range}
            notes={notes}
            volume={s.volume}
            height={420}
            title={allDone ? s.name : undefined}
            shadeFrom={allDone ? last + 1 : undefined}
            label="A chart to read: trend, pattern, key lines, signal candle, and your call"
            overlay={
              step === 'lines' && !done('lines')
                ? (project) => (
                    <DrawingLayer
                      project={project}
                      candles={s.candles}
                      slots={s.candles.length + s.future.length}
                      tool={tool}
                      drawings={drawings}
                      selected={null}
                      onAdd={(d) => setDrawings((ds) => [...ds, d])}
                      onPickCandle={() => {}}
                      color={LEARN.yours}
                    />
                  )
                : undefined
            }
          >
            {(scale, plot) => (
              <g>
                {/* Your lines, once you've drawn them. */}
                {(done('lines') || step !== 'lines') && lines.length > 0 && (
                  <DrawingShapes
                    drawings={lines}
                    candles={s.candles}
                    x={scale.x}
                    y={scale.y}
                    width={plot}
                    color={LEARN.yours}
                    extendTo={last}
                    opacity={0.9}
                    status={graded ? (k) => (graded.stray.includes(lines[k]) ? 'bad' : 'good') : undefined}
                  />
                )}
                {/* The candles to name, as a question. */}
                {step === 'candle' && !done('candle') && s.candle && (
                  <rect
                    x={scale.x(s.candle.from) - scale.slot / 2 - 3}
                    y={scale.y(Math.max(...s.candles.slice(s.candle.from, s.candle.to + 1).map((c) => c.high))) - 7}
                    width={scale.slot * (s.candle.to - s.candle.from + 1) + 6}
                    height={
                      scale.y(Math.min(...s.candles.slice(s.candle.from, s.candle.to + 1).map((c) => c.low))) -
                      scale.y(Math.max(...s.candles.slice(s.candle.from, s.candle.to + 1).map((c) => c.high))) +
                      14
                    }
                    rx={5}
                    fill="none"
                    stroke="#f2f2f2"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                )}
              </g>
            )}
          </AnnotatedChart>
        </div>
      </section>

      <aside className="mt-4 lg:mt-9">
        {/* Where you are: one pill per question. */}
        <ol className="flex flex-wrap gap-1.5" aria-label="Questions">
          {steps.map((st, k) => {
            const points = score.parts.find((p) => p.step === st)?.points
            const answered = done(st)
            return (
              <li
                key={st}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                  answered
                    ? points === 1
                      ? 'border-up/40 text-up'
                      : points && points > 0
                        ? 'border-amber/40 text-amber'
                        : 'border-down/40 text-down'
                    : k === stepIndex
                      ? 'border-neutral-300 text-white'
                      : 'border-neutral-800 text-dim'
                }`}
              >
                {answered ? (points === 1 ? '✓' : points && points > 0 ? '½' : '✗') : k + 1}
                <span>{STEP_NAME[st]}</span>
              </li>
            )
          })}
        </ol>

        <div className="mt-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${index}-${step}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {step === 'trend' && s.trend && (
                <Question
                  prompt="Which way is this chart trending?"
                  options={(['up', 'down', 'sideways'] as const).map((t) => ({ id: t, label: TREND_WORDS[t].label }))}
                  picked={answers.trend}
                  right={s.trend}
                  onPick={(t) => answer({ trend: t as Trend })}
                  verdict={answers.trend && <>It's {s.trend === 'sideways' ? 'going sideways' : `in ${article(TREND_WORDS[s.trend].label)} ${TREND_WORDS[s.trend].label.toLowerCase()}`}. {TREND_WORDS[s.trend].why}</>}
                />
              )}
              {step === 'pattern' && s.pattern && (
                <Question
                  prompt="What chart pattern is forming?"
                  options={s.pattern.options.map((k) => ({ id: k, label: nameOf(k) }))}
                  picked={answers.pattern}
                  right={s.pattern.key}
                  onPick={(k) => answer({ pattern: k })}
                  verdict={
                    answers.pattern && (
                      <>
                        It's {article(nameOf(s.pattern.key))} {nameOf(s.pattern.key).toLowerCase()}. {SPOT[s.pattern.key]?.slice(0, 2).join('; ')}.
                      </>
                    )
                  }
                />
              )}
              {step === 'lines' && (
                <LinesStep
                  count={s.lines.length}
                  drawn={lines.length}
                  tool={tool}
                  onTool={setTool}
                  onUndo={() => setDrawings((ds) => ds.slice(0, -1))}
                  onCheck={() => answer({ lines })}
                  result={graded}
                />
              )}
              {step === 'candle' && s.candle && (
                <Question
                  above={<CloseUp candles={s.candles} from={s.candle.from} to={s.candle.to} />}
                  prompt="Name the candles in the dashed box."
                  options={s.candle.options.map((k) => ({ id: k, label: nameOf(k) }))}
                  picked={answers.candle}
                  right={s.candle.key}
                  onPick={(k) => answer({ candle: k })}
                  verdict={answers.candle && <>{nameOf(s.candle.key)}. {entryByKey(s.candle.key)?.meaning}</>}
                />
              )}
              {step === 'call' && (
                <Question
                  prompt="So what's your call?"
                  options={(['sell', 'skip', 'buy'] as const).map((c) => ({ id: c, label: CALL_WORDS[c] }))}
                  picked={answers.call}
                  right={rightCall(s.bias)}
                  onPick={(c) => answer({ call: c as Call })}
                  verdict={
                    answers.call && (
                      <>
                        {s.bias === 'neutral' ? 'No edge either way: skipping was the call.' : `The chart pointed ${s.bias === 'bullish' ? 'up, so buying' : 'down, so selling'} was the call.`}{' '}
                        <Outcome s={s} shown={shown} />
                      </>
                    )
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Next question, or the wrap-up once the call is made. */}
          {done(step) && !allDone && (
            <button
              type="button"
              onClick={() => setStepIndex((k) => k + 1)}
              className="mt-4 h-12 w-full rounded-2xl bg-up text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
            >
              Next: {STEP_NAME[steps[stepIndex + 1]]}
            </button>
          )}
          {allDone && (
            <div className="mt-4 rounded-2xl border border-edge bg-card p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] tracking-[0.08em] text-muted uppercase">This chart</span>
                <span className="font-mono text-[22px] leading-none">{Math.round(score.total * 100)}%</span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-soft">{s.story}</p>
              <button
                type="button"
                onClick={nextScenario}
                className="mt-4 h-12 w-full rounded-2xl bg-up text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
              >
                {runLength && scores.length >= runLength ? 'See your score' : 'Next chart'}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

interface QuestionProps {
  above?: ReactNode
  prompt: string
  options: { id: string; label: string }[]
  picked: string | undefined
  right: string
  onPick: (id: string) => void
  verdict: ReactNode
}

function Question({ above, prompt, options, picked, right, onPick, verdict }: QuestionProps) {
  // Keys 1 to 4 answer.
  useEffect(() => {
    if (picked) return
    function onKeyDown(event: KeyboardEvent) {
      const n = Number(event.key)
      if (n >= 1 && n <= options.length) {
        event.preventDefault()
        onPick(options[n - 1].id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
  return (
    <div>
      {above}
      <h3 className="text-[19px] leading-snug font-semibold tracking-tight">{prompt}</h3>
      <div className={`mt-3 grid gap-2 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-1'}`}>
        {options.map((o, k) => {
          const tone = !picked
            ? 'border-neutral-800 text-neutral-100 hover:border-neutral-500'
            : o.id === right
              ? 'border-up/60 bg-up/10 text-up'
              : o.id === picked
                ? 'border-down/60 bg-down/10 text-down'
                : 'border-neutral-900 text-dim'
          return (
            <button
              key={o.id}
              type="button"
              disabled={!!picked}
              onClick={() => onPick(o.id)}
              className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3.5 text-left text-[15px] font-medium transition-colors disabled:cursor-default ${tone}`}
            >
              {options.length > 3 && <kbd className="hidden font-mono text-[11px] opacity-60 sm:inline">{k + 1}</kbd>}
              <span className="flex-1">{o.label}</span>
              {picked && o.id === right && <span aria-hidden="true">✓</span>}
              {picked && o.id === picked && o.id !== right && <span aria-hidden="true">✗</span>}
            </button>
          )
        })}
      </div>
      {picked && (
        <p className={`mt-3 rounded-xl border px-3.5 py-2.5 text-[14px] leading-relaxed ${picked === right ? 'border-up/30 bg-up/[0.05] text-neutral-100' : 'border-down/30 bg-down/[0.05] text-neutral-100'}`} aria-live="polite">
          <span className={`font-semibold ${picked === right ? 'text-up' : 'text-down'}`}>{picked === right ? 'Right. ' : 'Not quite. '}</span>
          {verdict}
        </p>
      )}
    </div>
  )
}

interface LinesProps {
  count: number
  drawn: number
  tool: 'level' | 'trend'
  onTool: (t: 'level' | 'trend') => void
  onUndo: () => void
  onCheck: () => void
  result: ReturnType<typeof gradeLines> | null
}

function LinesStep({ count, drawn, tool, onTool, onUndo, onCheck, result }: LinesProps) {
  if (result) {
    const found = result.found.filter(Boolean).length
    const all = found === count
    return (
      <div>
        <h3 className="text-[19px] leading-snug font-semibold tracking-tight">Key lines</h3>
        <p className={`mt-3 rounded-xl border px-3.5 py-2.5 text-[14px] leading-relaxed text-neutral-100 ${all ? 'border-up/30 bg-up/[0.05]' : found ? 'border-amber/30 bg-amber/[0.05]' : 'border-down/30 bg-down/[0.05]'}`} aria-live="polite">
          <span className={`font-semibold ${all ? 'text-up' : found ? 'text-amber' : 'text-down'}`}>
            You found {found} of {count}.
          </span>{' '}
          The real ones are drawn now: <span style={{ color: LEARN.support }}>support in blue</span>,{' '}
          <span style={{ color: LEARN.resistance }}>resistance and necklines in amber</span>, yours in white.
          {result.stray.length > 0 && ` ${result.stray.length} of yours didn't sit on a key line (it's faded).`}
        </p>
      </div>
    )
  }
  return (
    <div>
      <h3 className="text-[19px] leading-snug font-semibold tracking-tight">Draw its key lines</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-soft">
        There {count === 1 ? 'is 1 line' : `are ${count} lines`} to find: the support, resistance, neckline, or trendlines that make the pattern. Ends snap to nearby highs and lows.
      </p>
      <div className="mt-3 flex gap-2">
        {(['level', 'trend'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTool(t)}
            aria-pressed={tool === t}
            className={`h-11 flex-1 rounded-xl border text-[14px] font-medium transition-colors ${tool === t ? 'border-neutral-300 bg-neutral-100 text-black' : 'border-neutral-800 text-soft hover:border-neutral-600'}`}
          >
            {t === 'level' ? 'Flat level' : 'Sloped line'}
          </button>
        ))}
        <button type="button" onClick={onUndo} disabled={!drawn} className="h-11 rounded-xl border border-neutral-800 px-3 text-[14px] text-soft hover:text-white disabled:opacity-35">
          Undo
        </button>
      </div>
      <p className="mt-2 text-[13px] text-muted">{tool === 'level' ? 'Tap or drag on the chart to place a flat line.' : 'Press on one point and drag to another.'}</p>
      <button
        type="button"
        onClick={onCheck}
        className="mt-3 h-12 w-full rounded-2xl bg-up text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
      >
        {drawn ? 'Check my lines' : "I can't find them: show me"}
      </button>
    </div>
  )
}

// How the next 30 days went, as they play out.
function Outcome({ s, shown }: { s: ReturnType<typeof makeScenario>; shown: number }) {
  if (shown < s.future.length) return <span className="text-muted">Playing out the next {s.future.length} days…</span>
  const from = s.candles[s.candles.length - 1].close
  const to = s.future[s.future.length - 1].close
  const pct = ((to - from) / from) * 100
  const way = pct > 0.5 ? 'rose' : pct < -0.5 ? 'fell' : 'went nowhere'
  const agreed = (s.bias === 'bullish' && pct > 0) || (s.bias === 'bearish' && pct < 0)
  return (
    <>
      Over the next {s.future.length} days price {way}
      {way !== 'went nowhere' && ` ${Math.abs(pct).toFixed(1)}%`}.
      {s.bias !== 'neutral' && !agreed && ' This one failed: good setups still lose now and then.'}
    </>
  )
}

// The last dozen candles up close, with the ones to name boxed: on the full
// chart they're too small to read.
function CloseUp({ candles, from, to }: { candles: Candle[]; from: number; to: number }) {
  const start = Math.max(0, from - 9)
  const shown = candles.slice(start, to + 1)
  return (
    <div className="mb-3 rounded-2xl border border-edge bg-[#07090c] px-1 py-1.5">
      <AnnotatedChart candles={shown} height={150} compact label="Close-up of the last candles">
        {(scale) => {
          const slice = candles.slice(from, to + 1)
          const top = scale.y(Math.max(...slice.map((c) => c.high))) - 6
          const bottom = scale.y(Math.min(...slice.map((c) => c.low))) + 6
          const left = scale.x(from - start) - scale.slot / 2 - 3
          return (
            <rect x={left} y={top} width={scale.x(to - start) + scale.slot / 2 + 3 - left} height={bottom - top} rx={5} fill="none" stroke="#f2f2f2" strokeWidth={1.5} strokeDasharray="4 3" />
          )
        }}
      </AnnotatedChart>
    </div>
  )
}
