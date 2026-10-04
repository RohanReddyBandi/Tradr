import { useState } from 'react'
import type { Practice } from '../game/usePractice'
import type { Learn } from '../game/useLearn'
import { LESSON_IDS } from '../lib/lessons'
import { MarkDrill } from './practice/MarkDrill'
import { Quiz } from './practice/Quiz'
import { Lessons } from './practice/Lessons'

type Mode = 'mark' | 'quiz' | 'basics'

interface Props {
  practice: Practice
  learn: Learn
  onLearn: (patternName: string) => void // open a pattern's page in Learn
}

// Practice: quick drills away from the trading game. (Building and drawing
// each pattern now lives on its page in Learn.)
export function PracticePage({ practice, learn, onLearn }: Props) {
  const [mode, setMode] = useState<Mode>('mark')
  const lessonsDone = learn.progress.lessons.filter((id) => LESSON_IDS.includes(id)).length
  const modes: { id: Mode; label: string; count?: string; blurb: string }[] = [
    { id: 'mark', label: 'Mark', blurb: 'Name the candlestick patterns hidden in a chart.' },
    {
      id: 'quiz',
      label: 'Quiz',
      count: learn.progress.quiz.best ? `best ${learn.progress.quiz.best}` : undefined,
      blurb: 'Name that pattern, across all of them. Every chart is new, and the answer is checked by the same detectors that grade your trades.',
    },
    {
      id: 'basics',
      label: 'Basics',
      count: `${lessonsDone}/${LESSON_IDS.length}`,
      blurb: 'The ideas behind the patterns: eight short lessons, from reading one candle to why good trades still lose.',
    },
  ]

  return (
    <div id="practice-scroll" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pt-6 pb-12 md:max-w-lg lg:max-w-[1240px] lg:px-10 lg:py-8">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Practice</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-soft">No trades and no balance: just you, the candles, and the same detectors that grade your swipes.</p>

        <div role="tablist" aria-label="Drill" className="mt-6 inline-grid grid-cols-3 gap-1 rounded-2xl border border-edge bg-card p-1">
          {modes.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`h-11 rounded-xl px-4 text-[15px] font-medium whitespace-nowrap transition-colors sm:px-5 ${
                mode === m.id ? 'bg-neutral-800 text-white' : 'text-muted hover:text-soft'
              }`}
            >
              {m.label}
              {m.count && <span className="ml-1.5 font-mono text-xs text-muted">{m.count}</span>}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[15px] text-muted">{modes.find((m) => m.id === mode)!.blurb}</p>

        <div className="mt-6">
          {mode === 'mark' && <MarkDrill onResult={practice.recordMark} onLearn={onLearn} />}
          {mode === 'quiz' && <Quiz quiz={learn.progress.quiz} onAnswer={learn.recordAnswer} onLearn={onLearn} />}
          {mode === 'basics' && <Lessons finished={learn.progress.lessons} onFinish={learn.finishLesson} />}
        </div>
      </div>
    </div>
  )
}
