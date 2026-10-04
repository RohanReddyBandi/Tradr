import { useState } from 'react'
import type { TradeRecord } from '../lib/stats'
import type { Practice } from '../game/usePractice'
import type { Learn } from '../game/useLearn'
import { PatternLibrary } from './learn/PatternLibrary'
import { ScenarioPractice } from './learn/ScenarioPractice'
import { ExitsLesson } from './learn/ExitsLesson'
import { EXITS_FOCUS } from '../lib/exits'

interface Props {
  history: TradeRecord[]
  focus: string | null // a pattern name to open (from a Breakdown or Stats), or EXITS_FOCUS for the exits lesson
  practice: Practice
  learn: Learn
}

// Learn is about reading charts: every pattern to study and master, mixed
// real-world scenarios where you don't know which pattern is coming, and the
// stop loss and take profit lesson.
export function LearnPage({ history, focus, practice, learn }: Props) {
  const [view, setView] = useState<'patterns' | 'mixed' | 'exits'>(focus === EXITS_FOCUS ? 'exits' : 'patterns')
  const { played, points } = learn.progress.mixed
  const show = (next: typeof view) => {
    setView(next)
    requestAnimationFrame(() => document.getElementById('learn-scroll')?.scrollTo({ top: 0 }))
  }

  return (
    <div id="learn-scroll" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pt-6 pb-12 md:max-w-2xl lg:max-w-[1240px] lg:px-10 lg:py-8">
        {view === 'exits' ? (
          <ExitsLesson progress={learn.progress.exits} onRoundDone={learn.recordExit} onRunDone={learn.recordExitRun} onBack={() => show('patterns')} />
        ) : view === 'mixed' ? (
          <>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-[28px] leading-tight font-bold tracking-tight">Practice scenarios</h1>
              {played > 0 && (
                <span className="font-mono text-[13px] text-muted">
                  {played} played · average {Math.round((points / played) * 100)}%
                </span>
              )}
            </div>
            <ScenarioPractice focus={null} runLength={null} onScenarioDone={learn.recordMixed} onExit={() => show('patterns')} exitLabel="Back to the patterns" />
          </>
        ) : (
          <>
            <PatternLibrary
              intro={
                <>
                  <h1 className="text-[28px] leading-tight font-bold tracking-tight">Learn</h1>
                  <p className="mt-2 mb-6 max-w-2xl text-[15px] leading-relaxed text-soft">
                    Every pattern Tradr uses, labelled the way traders mark up their charts. Open one to learn what to look for, see real examples
                    next to look-alikes that aren&rsquo;t it, and master it on real-world charts. Then learn where your stop loss and take profit go.
                  </p>
                </>
              }
              history={history}
              focus={focus}
              practice={practice}
              scenarios={learn.progress.scenarios}
              onRunDone={learn.recordRun}
              exits={learn.progress.exits}
              onMixed={() => show('mixed')}
              onExits={() => show('exits')}
            />
          </>
        )}
      </div>
    </div>
  )
}
