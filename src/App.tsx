import { useState } from 'react'
import { MotionConfig } from 'motion/react'
import { TabBar, TopBar, type Tab } from './components/TabBar'
import { SwipePage } from './pages/SwipePage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { useGame } from './game/useGame'

export default function App() {
  const [tab, setTab] = useState<Tab>('swipe')
  const game = useGame()

  return (
    // reducedMotion="user": if the device asks for less motion, skip the
    // sliding and scaling animations.
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh flex-col">
        <TopBar active={tab} onChange={setTab} balance={game.balance} />

        {/* Phones: one column. Tablets: a slightly wider column with edges.
            Desktop: the full width, laid out by each page. */}
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col md:max-w-lg md:border-x md:border-edge lg:max-w-none lg:border-x-0">
          <main className="min-h-0 flex-1">
            {tab === 'swipe' && <SwipePage game={game} />}
            {tab === 'learn' && (
              <ComingSoonPage title="Learn">
                A library of every chart pattern, with example charts and the ones you miss most. Arrives in Phase 6.
              </ComingSoonPage>
            )}
            {tab === 'stats' && (
              <ComingSoonPage title="Stats">
                Balance, equity curve, win rate, average R, and decision accuracy. Arrives in Phase 6.
                <p className="mt-4 text-xs text-muted">
                  Charts by{' '}
                  <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline">
                    TradingView Lightweight Charts™
                  </a>
                </p>
              </ComingSoonPage>
            )}
          </main>
          <TabBar active={tab} onChange={setTab} />
        </div>
      </div>
    </MotionConfig>
  )
}
