import { useState } from 'react'
import type { TradeRecord } from '../lib/stats'
import { LIBRARY } from '../lib/library'
import { LESSON_IDS } from '../lib/lessons'
import type { PracticeProgress } from '../game/usePractice'
import { masteredKeys, type Learn } from '../game/useLearn'
import type { PracticeMode } from './PracticePage'
import { Lessons } from './learn/Lessons'
import { PatternLibrary } from './learn/PatternLibrary'
import { Quiz } from './learn/Quiz'

type Section = 'patterns' | 'quiz' | 'lessons'

interface Props {
  history: TradeRecord[]
  focus: string | null // a pattern name to jump to (from a Breakdown or Stats)
  progress: PracticeProgress
  learn: Learn
  onPractice: (mode: PracticeMode, key: string) => void
  onLearn: (patternName: string) => void // open a pattern's card (from the quiz)
}

const BLURB: Record<Section, string> = {
  patterns: 'Learn to spot every pattern Tradr uses. Open one for what to look for, real examples next to look-alikes that aren’t it, and a drill to master it.',
  quiz: 'Name that pattern, across all of them. Every chart is new, and the answer is checked by the same detectors that grade your trades.',
  lessons: 'The basics behind the patterns: eight short lessons, from reading one candle to why good trades still lose.',
}

export function LearnPage({ history, focus, progress, learn, onPractice, onLearn }: Props) {
  // Learn opens on the patterns (and straight onto one, from a Breakdown or Stats).
  const [section, setSection] = useState<Section>('patterns')
  const lessonsDone = learn.progress.lessons.filter((id) => LESSON_IDS.includes(id)).length
  const mastered = masteredKeys(learn.progress).length

  const tabs: { id: Section; label: string; count: string }[] = [
    { id: 'patterns', label: 'Patterns', count: `${mastered}/${LIBRARY.length}` },
    { id: 'quiz', label: 'Quiz', count: learn.progress.quiz.best ? `best ${learn.progress.quiz.best}` : '' },
    { id: 'lessons', label: 'Basics', count: `${lessonsDone}/${LESSON_IDS.length}` },
  ]

  return (
    <div id="learn-scroll" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pt-6 pb-12 md:max-w-2xl lg:max-w-[1240px] lg:px-10 lg:py-8">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Learn</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-soft">{BLURB[section]}</p>

        <div role="tablist" aria-label="Learn" className="mt-6 inline-grid grid-cols-3 gap-1 rounded-2xl border border-edge bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={section === t.id}
              onClick={() => setSection(t.id)}
              className={`h-11 rounded-xl px-3 text-[15px] font-medium whitespace-nowrap transition-colors sm:px-5 ${
                section === t.id ? 'bg-neutral-800 text-white' : 'text-muted hover:text-soft'
              }`}
            >
              {t.label}
              {t.count && <span className="ml-1.5 font-mono text-xs text-muted">{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {section === 'patterns' && (
            <PatternLibrary
              history={history}
              focus={focus}
              progress={progress}
              drills={learn.progress.drills}
              onDrillDone={learn.recordDrill}
              onPractice={onPractice}
            />
          )}
          {section === 'quiz' && <Quiz quiz={learn.progress.quiz} onAnswer={learn.recordAnswer} onLearn={onLearn} />}
          {section === 'lessons' && <Lessons finished={learn.progress.lessons} onFinish={learn.finishLesson} />}
        </div>
      </div>
    </div>
  )
}
