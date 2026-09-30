import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { makeQuestion, type QuizKind } from '../../lib/quiz'
import { entryByKey } from '../../lib/library'
import { SvgChart } from '../../components/SvgChart'
import { ShapeLayer } from '../../components/ChartLayers'
import type { LearnProgress } from '../../game/useLearn'
import { COLORS } from '../../theme'

const KINDS: { id: QuizKind | 'any'; label: string }[] = [
  { id: 'any', label: 'Everything' },
  { id: 'chart', label: 'Chart patterns' },
  { id: 'candle', label: 'Candlesticks' },
]

interface Props {
  quiz: LearnProgress['quiz']
  onAnswer: (correct: boolean, streak: number) => void
  onLearn: (patternName: string) => void
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31)

// Name that pattern: a freshly drawn chart and four names. Keys 1 to 4
// answer, Enter moves on.
export function Quiz({ quiz, onAnswer, onLearn }: Props) {
  const [kind, setKind] = useState<QuizKind | 'any'>('any')
  const [seed, setSeed] = useState(newSeed)
  const [previous, setPrevious] = useState<string | undefined>(undefined)
  const question = useMemo(() => makeQuestion(seed, kind, previous), [seed, kind, previous])
  const [picked, setPicked] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const answer = entryByKey(question.key)!
  const right = picked === question.key

  function pick(key: string) {
    if (picked) return
    const correct = key === question.key
    const next = correct ? streak + 1 : 0
    setPicked(key)
    setStreak(next)
    onAnswer(correct, next)
  }

  function nextQuestion() {
    setPrevious(question.key)
    setSeed(newSeed())
    setPicked(null)
  }

  function changeKind(k: QuizKind | 'any') {
    setKind(k)
    setPicked(null)
    setSeed(newSeed())
  }

  // 1-4 to answer, Enter (or →) for the next one.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return
      const n = Number(event.key)
      if (!picked && n >= 1 && n <= 4) pick(question.options[n - 1])
      else if (picked && (event.key === 'Enter' || event.key === 'ArrowRight')) nextQuestion()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const boxed = question.box
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quiz on">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => changeKind(k.id)}
                aria-pressed={kind === k.id}
                className={`min-h-10 rounded-full border px-3.5 text-[14px] transition-colors ${
                  kind === k.id ? 'border-neutral-300 bg-neutral-100 text-black' : 'border-neutral-800 text-soft hover:border-neutral-600'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <Streak streak={streak} />
        </div>

        <h2 className="mt-5 text-[20px] leading-snug font-semibold tracking-tight">
          {boxed ? 'Name the candles in the box' : "What's this chart pattern?"}
        </h2>

        <div className="mt-3 rounded-3xl border border-edge bg-card px-2 py-3">
          <SvgChart key={seed} candles={question.candles} height={260} label={boxed ? 'A chart with candles boxed to name' : 'A chart pattern to name'}>
            {(scale) => (
              <g>
                {boxed && !picked && (
                  <rect
                    x={scale.x(boxed.from) - scale.slot / 2 - 3}
                    y={scale.y(Math.max(...question.candles.slice(boxed.from, boxed.to + 1).map((c) => c.high))) - 6}
                    width={scale.slot * (boxed.to - boxed.from + 1) + 6}
                    height={
                      scale.y(Math.min(...question.candles.slice(boxed.from, boxed.to + 1).map((c) => c.low))) -
                      scale.y(Math.max(...question.candles.slice(boxed.from, boxed.to + 1).map((c) => c.high))) +
                      12
                    }
                    rx={5}
                    fill="none"
                    stroke="#e5e5e5"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                )}
                {picked && <ShapeLayer shapes={question.shapes} candles={question.candles} scale={scale} color="#d4d4d4" />}
              </g>
            )}
          </SvgChart>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Answers">
          {question.options.map((key, k) => {
            const entry = entryByKey(key)!
            const isAnswer = key === question.key
            const isPicked = key === picked
            const tone = !picked
              ? 'border-neutral-800 text-neutral-100 hover:border-neutral-500'
              : isAnswer
                ? 'border-up/60 bg-up/10 text-up'
                : isPicked
                  ? 'border-down/60 bg-down/10 text-down'
                  : 'border-neutral-900 text-dim'
            return (
              <button
                key={key}
                type="button"
                onClick={() => pick(key)}
                disabled={!!picked}
                className={`flex min-h-13 items-center gap-3 rounded-2xl border px-4 py-2.5 text-left text-[15.5px] font-medium transition-colors disabled:cursor-default ${tone}`}
              >
                <kbd className="hidden size-6 shrink-0 place-items-center rounded-md border border-current/30 font-mono text-[11px] opacity-70 sm:grid">{k + 1}</kbd>
                <span className="min-w-0 flex-1">{entry.name}</span>
                {picked && isAnswer && <span aria-label="right answer">✓</span>}
                {picked && isPicked && !isAnswer && <span aria-label="your answer, wrong">✗</span>}
              </button>
            )
          })}
        </div>
      </section>

      <aside className="mt-5 lg:mt-12" aria-live="polite">
        {picked ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl border p-5 ${right ? 'border-up/30 bg-up/[0.06]' : 'border-down/30 bg-down/[0.05]'}`}>
            <p className={`text-[18px] font-semibold ${right ? 'text-up' : 'text-down'}`}>{right ? 'Right.' : `It's a ${answer.name.toLowerCase()}.`}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-200">{answer.meaning}</p>
            {!right && picked && (
              <p className="mt-2 text-sm leading-relaxed text-soft">
                <span className="text-muted">You said {entryByKey(picked)!.name.toLowerCase()}: </span>
                {entryByKey(picked)!.meaning}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={nextQuestion}
                className="flex h-11 items-center gap-2 rounded-xl bg-up px-5 text-[15px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
              >
                Next
                <kbd className="hidden rounded border border-black/20 px-1 font-mono text-[11px] font-medium lg:inline">Enter</kbd>
              </button>
              <button
                type="button"
                onClick={() => onLearn(answer.name)}
                className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft transition-colors hover:border-neutral-600 hover:text-white"
              >
                Learn it
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="rounded-3xl border border-dashed border-neutral-800 p-5 text-[15px] leading-relaxed text-muted">
            Every chart is drawn fresh, then checked by the same pattern detectors that grade the game, so the right answer is really there.
            {boxed ? ' Look at the move into the box as well as the candles in it: the same shape means different things after a rise and after a fall.' : ' Patterns are read at the newest candles, on the right.'}
          </div>
        )}

        <dl className="mt-4 grid grid-cols-3 divide-x divide-edge rounded-2xl border border-edge bg-card py-3 text-center">
          <Tally label="Answered" value={`${quiz.answered}`} />
          <Tally label="Right" value={quiz.answered ? `${Math.round((quiz.correct / quiz.answered) * 100)}%` : '—'} />
          <Tally label="Best streak" value={`${quiz.best}`} />
        </dl>
      </aside>
    </div>
  )
}

// The current run of right answers, with a little pop every five.
function Streak({ streak }: { streak: number }) {
  const milestone = streak > 0 && streak % 5 === 0
  return (
    <div className="flex items-center gap-2 text-[14px] text-soft" aria-live="polite">
      <span>Streak</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={streak}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className={`grid h-8 min-w-8 place-items-center rounded-full border px-2 font-mono text-[15px] ${
            milestone ? 'border-up bg-up text-black' : streak > 0 ? 'border-up/40 text-up' : 'border-neutral-800 text-muted'
          }`}
          style={milestone ? { boxShadow: `0 0 0 4px ${COLORS.up}22` } : undefined}
        >
          {streak}
        </motion.span>
      </AnimatePresence>
      {milestone && <span className="text-up">{streak} in a row</span>}
    </div>
  )
}

function Tally({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-[17px]">{value}</dd>
    </div>
  )
}
