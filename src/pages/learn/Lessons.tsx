import { useState, type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { LessonProps } from './lessons/parts'
import { CandleAnatomy } from './lessons/CandleAnatomy'
import { TrendSpotter } from './lessons/TrendSpotter'
import { LevelFinder } from './lessons/LevelFinder'
import { TrendlineDrawer } from './lessons/TrendlineDrawer'
import { ContextPicker } from './lessons/ContextPicker'
import { RiskRewardLab } from './lessons/RiskRewardLab'
import { LossMath } from './lessons/LossMath'
import { LuckSimulator } from './lessons/LuckSimulator'

interface Lesson {
  id: string
  title: string
  summary: string // one line, for the list
  intro: ReactNode
  takeaway: string
  Widget: ComponentType<LessonProps>
}

// The course, in order: each lesson builds on the ones before it.
const LESSONS: Lesson[] = [
  {
    id: 'candle',
    title: 'Reading a candle',
    summary: 'Open, high, low, close: what one day of trading looks like',
    intro: (
      <>
        <p>
          Each candle is one day. The thick <b>body</b> runs from where price opened to where it closed: green if it closed higher, red if it
          closed lower. The thin <b>wicks</b> reach the highest and lowest prices of the day.
        </p>
        <p>The body tells you who won the day. The wicks tell you where price went and got pushed back.</p>
      </>
    ),
    takeaway: 'A long wick is a rejection: price went there, and the other side pushed it straight back.',
    Widget: CandleAnatomy,
  },
  {
    id: 'trend',
    title: 'Trends: highs and lows',
    summary: 'Uptrend, downtrend, or range? Read the staircase',
    intro: (
      <>
        <p>
          A trend is a staircase. In an uptrend each rally beats the last high (a <b>higher high</b>) and each dip stops above the last low (a{' '}
          <b>higher low</b>). A downtrend is the same thing upside down. When the steps stop climbing or falling, it's a <b>range</b>.
        </p>
        <p>Call each chart, then see its swings labelled.</p>
      </>
    ),
    takeaway: 'Trade with the staircase. An uptrend is intact until price breaks below its last higher low.',
    Widget: TrendSpotter,
  },
  {
    id: 'levels',
    title: 'Support and resistance',
    summary: 'Floors, ceilings, and what happens when they break',
    intro: (
      <>
        <p>
          <b>Support</b> is a price where buyers keep stepping in: a floor. <b>Resistance</b> is a price where sellers keep showing up: a
          ceiling. The more times price turns at a level, the more traders watch it.
        </p>
        <p>Drag the line to the floor of this range. It counts the touches as you go.</p>
      </>
    ),
    takeaway: 'A broken floor often turns into a ceiling, and a broken ceiling into a floor.',
    Widget: LevelFinder,
  },
  {
    id: 'trendlines',
    title: 'Trendlines',
    summary: 'Draw a line under the dips and see if price respects it',
    intro: (
      <>
        <p>
          A trendline connects the dips of an uptrend (or the peaks of a downtrend). Two touches make a line; a third touch confirms it. A line
          that price keeps closing through isn't holding anything.
        </p>
        <p>Draw one under this uptrend: press on a dip and drag to a later one. It's graded the same way your drawings are after a trade.</p>
      </>
    ),
    takeaway: 'When price closes clearly below a rising trendline, the uptrend is in trouble.',
    Widget: TrendlineDrawer,
  },
  {
    id: 'context',
    title: 'Location beats the candle',
    summary: 'The same candle means different things in different places',
    intro: (
      <>
        <p>
          A hammer says buyers pushed back from the day's lows. At a floor after a drop, that's a real signal. In the middle of a range it's just
          noise: the next candle could go either way.
        </p>
        <p>Each round shows the same pattern twice. Pick the one you'd trade.</p>
      </>
    ),
    takeaway: 'Ask where a candle formed before asking what it is.',
    Widget: ContextPicker,
  },
  {
    id: 'risk',
    title: 'Stops, targets, and risk : reward',
    summary: 'Where to get out, and why the ratio matters',
    intro: (
      <>
        <p>
          Your <b>stop loss</b> is where the idea is proven wrong: for a long, just under the last swing low. Your <b>take profit</b> is where
          you'll collect. <b>Risk : reward</b> compares the two distances.
        </p>
        <p>This plan starts with a stop that's too tight and a target that's too close. Drag them somewhere better.</p>
      </>
    ),
    takeaway: 'With a target twice as far as your stop, you only need to win a third of your trades to break even.',
    Widget: RiskRewardLab,
  },
  {
    id: 'size',
    title: 'Position size and the maths of losing',
    summary: 'Why a 50% loss needs a 100% gain to undo',
    intro: (
      <>
        <p>
          Losses hurt more than gains help. Lose 10% and you need 11% to get back; lose 50% and you need 100%. That's why traders only risk a
          small slice of their account on each trade.
        </p>
      </>
    ),
    takeaway: 'Keep the risk on each trade small, so the losing streaks that always come can’t knock you out.',
    Widget: LossMath,
  },
  {
    id: 'luck',
    title: 'Good decisions still lose',
    summary: 'Win rates, streaks, and why one result proves nothing',
    intro: (
      <>
        <p>
          Even a real edge loses often, and losses come in streaks. Pick a win rate and a risk : reward, then run 50 trades. Then run the same
          odds again.
        </p>
      </>
    ),
    takeaway: 'Judge the decision, not the single result. That’s why Tradr grades your read separately from how the trade turned out.',
    Widget: LuckSimulator,
  },
]

interface Props {
  finished: string[]
  onFinish: (id: string) => void
}

const wide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

export function Lessons({ finished, onFinish }: Props) {
  // Desktop opens the first lesson you haven't finished; phones start on the list.
  const [openId, setOpenId] = useState<string | null>(() => (wide() ? (LESSONS.find((l) => !finished.includes(l.id)) ?? LESSONS[0]).id : null))
  const index = LESSONS.findIndex((l) => l.id === openId)
  const lesson = LESSONS[index]

  function open(id: string | null) {
    setOpenId(id)
    // Back to the top of the page (just the page's own scroll area: scrollIntoView would nudge the whole app).
    requestAnimationFrame(() => document.getElementById('learn-scroll')?.scrollTo({ top: 0 }))
  }

  return (
    <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Lessons" className={`${lesson ? 'hidden lg:block' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-neutral-800" aria-hidden="true">
            <div className="h-full rounded-full bg-up transition-[width] duration-500" style={{ width: `${(finished.length / LESSONS.length) * 100}%` }} />
          </div>
          <span className="font-mono text-[12px] text-muted">
            {LESSONS.filter((l) => finished.includes(l.id)).length}/{LESSONS.length} done
          </span>
        </div>
        <ol className="mt-4 flex flex-col gap-1.5">
          {LESSONS.map((l, k) => {
            const isDone = finished.includes(l.id)
            const isOpen = l.id === openId
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => open(l.id)}
                  aria-current={isOpen ? 'step' : undefined}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                    isOpen ? 'border-neutral-600 bg-neutral-900' : 'border-edge bg-card hover:border-neutral-700'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px] ${
                      isDone ? 'border-up bg-up text-black' : 'border-neutral-700 text-muted'
                    }`}
                    aria-hidden="true"
                  >
                    {isDone ? '✓' : k + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] leading-snug font-medium text-neutral-100">{l.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{l.summary}</span>
                  </span>
                  <span className="sr-only">{isDone ? '(finished)' : ''}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {lesson && (
          <motion.article
            key={lesson.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="min-w-0"
          >
            <button
              type="button"
              onClick={() => open(null)}
              className="-ml-1 mb-3 flex h-10 items-center gap-1.5 px-1 text-[14px] text-muted hover:text-white lg:hidden"
            >
              <span aria-hidden="true">←</span> All lessons
            </button>
            <div className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
              Lesson {index + 1} of {LESSONS.length}
              {finished.includes(lesson.id) && <span className="ml-2 text-up normal-case tracking-normal">✓ Finished</span>}
            </div>
            <h2 className="mt-1.5 text-[24px] leading-tight font-bold tracking-tight lg:text-[28px]">{lesson.title}</h2>
            <div className="mt-3 flex max-w-2xl flex-col gap-2.5 text-[15.5px] leading-relaxed text-neutral-200 [&_b]:font-semibold [&_b]:text-white">
              {lesson.intro}
            </div>

            <div className="mt-5 max-w-3xl">
              <lesson.Widget done={finished.includes(lesson.id)} onDone={() => onFinish(lesson.id)} />
            </div>

            <div className="mt-6 max-w-3xl rounded-2xl border-l-2 border-up bg-up/[0.05] py-3 pr-4 pl-4">
              <div className="text-[11px] font-semibold tracking-[0.08em] text-up uppercase">Key idea</div>
              <p className="mt-1 text-[15.5px] leading-relaxed text-neutral-100">{lesson.takeaway}</p>
            </div>

            <div className="mt-6 flex max-w-3xl items-center justify-between gap-3 border-t border-edge pt-4">
              {index > 0 ? (
                <button type="button" onClick={() => open(LESSONS[index - 1].id)} className="h-11 text-[15px] text-muted hover:text-white">
                  ← <span className="hidden sm:inline">{LESSONS[index - 1].title}</span>
                  <span className="sm:hidden">Back</span>
                </button>
              ) : (
                <span />
              )}
              {index < LESSONS.length - 1 && (
                <button
                  type="button"
                  onClick={() => open(LESSONS[index + 1].id)}
                  className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] font-medium text-neutral-100 transition-colors hover:border-neutral-600"
                >
                  <span className="hidden sm:inline">Next: {LESSONS[index + 1].title}</span>
                  <span className="sm:hidden">Next lesson</span> →
                </button>
              )}
            </div>
          </motion.article>
        )}
      </AnimatePresence>
    </div>
  )
}
