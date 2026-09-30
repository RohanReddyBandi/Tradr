import { useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Analytics } from '@vercel/analytics/react'
import { TabBar, TopBar, type Tab } from './components/TabBar'
import { SwipePage } from './pages/SwipePage'
import { LearnPage } from './pages/LearnPage'
import { StatsPage } from './pages/StatsPage'
import { PracticePage, type PracticeFocus, type PracticeMode } from './pages/PracticePage'
import { useGame } from './game/useGame'
import { usePractice } from './game/usePractice'
import { useLearn } from './game/useLearn'

export default function App() {
  const [tab, setTab] = useState<Tab>('swipe')
  const [learnFocus, setLearnFocus] = useState<string | null>(null) // a pattern to open in Learn
  const [practiceFocus, setPracticeFocus] = useState<PracticeFocus | null>(null) // a drill to open in Practice
  const game = useGame()
  const practice = usePractice()
  const learn = useLearn()

  function changeTab(next: Tab) {
    setLearnFocus(null)
    setPracticeFocus(null)
    setTab(next)
  }

  function openLearn(patternName: string) {
    setLearnFocus(patternName)
    setTab('learn')
  }

  function openPractice(mode: PracticeMode, key: string) {
    setPracticeFocus({ mode, key })
    setTab('practice')
  }

  return (
    // reducedMotion="user": if the device asks for less motion, skip the
    // sliding and scaling animations.
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh flex-col">
        <TopBar active={tab} onChange={changeTab} balance={game.balance} />

        {/* Phones: one column. Tablets: a slightly wider column with edges.
            Desktop: the full width, laid out by each page. */}
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col md:max-w-lg md:border-x md:border-edge lg:max-w-none lg:border-x-0">
          <main className="min-h-0 flex-1">
            {tab === 'swipe' && <SwipePage game={game} onLearn={openLearn} />}
            {/* The key makes Learn start fresh (and jump) each time it opens on a pattern. */}
            {tab === 'learn' && (
              <LearnPage
                key={learnFocus ?? 'all'}
                history={game.history}
                focus={learnFocus}
                progress={practice.progress}
                learn={learn}
                onPractice={openPractice}
                onLearn={openLearn}
              />
            )}
            {tab === 'practice' && (
              <PracticePage
                key={practiceFocus ? `${practiceFocus.mode}-${practiceFocus.key}` : 'all'}
                practice={practice}
                focus={practiceFocus}
                onLearn={openLearn}
              />
            )}
            {tab === 'stats' && <StatsPage game={game} practice={practice.progress} learn={learn.progress} onPlay={() => changeTab('swipe')} onLearn={openLearn} />}
          </main>
          {/* The trade setup is a focused step with its own back button, so the phone tabs step aside. */}
          {!(tab === 'swipe' && game.pending) && <TabBar active={tab} onChange={changeTab} />}
        </div>
      </div>
      {/* Vercel Web Analytics: counts visits (no cookies) once it's switched on in
          the Vercel dashboard. It does nothing when running locally. */}
      <Analytics />
    </MotionConfig>
  )
}
