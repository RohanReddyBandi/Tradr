import { useState } from 'react'
import type { TradeRecord } from '../lib/stats'
import type { Practice } from '../game/usePractice'
import type { Learn } from '../game/useLearn'
import { PatternLibrary } from './learn/PatternLibrary'
import { ScenarioPractice } from './learn/ScenarioPractice'

interface Props {
  history: TradeRecord[]
  focus: string | null // a pattern name to open (from a Breakdown or Stats)
  practice: Practice
  learn: Learn
}

// Learn is all about the patterns: every one to study and master, plus mixed
// real-world scenarios where you don't know which pattern is coming.
export function LearnPage({ history, focus, practice, learn }: Props) {
  const [mixed, setMixed] = useState(false)
  const { played, points } = learn.progress.mixed

  return (
    <div id="learn-scroll" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pt-6 pb-12 md:max-w-2xl lg:max-w-[1240px] lg:px-10 lg:py-8">
        {mixed ? (
          <>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-[28px] leading-tight font-bold tracking-tight">Practice scenarios</h1>
              {played > 0 && (
                <span className="font-mono text-[13px] text-muted">
                  {played} played · average {Math.round((points / played) * 100)}%
                </span>
              )}
            </div>
            <ScenarioPractice focus={null} runLength={null} onScenarioDone={learn.recordMixed} onExit={() => setMixed(false)} exitLabel="Back to the patterns" />
          </>
        ) : (
          <>
            <PatternLibrary
              intro={
                <>
                  <h1 className="text-[28px] leading-tight font-bold tracking-tight">Learn</h1>
                  <p className="mt-2 mb-6 max-w-2xl text-[15px] leading-relaxed text-soft">
                    Every pattern Tradr uses, labelled the way traders mark up their charts. Open one to learn what to look for, see real examples
                    next to look-alikes that aren&rsquo;t it, and master it on real-world charts.
                  </p>
                </>
              }
              history={history}
              focus={focus}
              practice={practice}
              scenarios={learn.progress.scenarios}
              onRunDone={learn.recordRun}
              onMixed={() => {
                setMixed(true)
                requestAnimationFrame(() => document.getElementById('learn-scroll')?.scrollTo({ top: 0 }))
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
