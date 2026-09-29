import type { ReactNode } from 'react'
import { LearnIcon, LogoIcon, PracticeIcon, StatsIcon, SwipeIcon } from './icons'
import { formatMoney } from '../format'

export type Tab = 'swipe' | 'learn' | 'practice' | 'stats'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'swipe', label: 'Swipe', icon: <SwipeIcon /> },
  { id: 'learn', label: 'Learn', icon: <LearnIcon /> },
  { id: 'practice', label: 'Practice', icon: <PracticeIcon /> },
  { id: 'stats', label: 'Stats', icon: <StatsIcon /> },
]

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

// Phones and tablets: tabs along the bottom, where thumbs reach.
export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="flex border-t border-edge bg-base pb-[env(safe-area-inset-bottom)] lg:hidden">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
          className={`flex flex-1 flex-col items-center gap-1 py-3 text-[13px] font-medium transition-colors ${
            active === tab.id ? 'text-neutral-100' : 'text-dim hover:text-soft'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

// Desktop: logo, tabs, and balance across the top.
export function TopBar({ active, onChange, balance }: Props & { balance: number }) {
  return (
    <header className="hidden h-16 shrink-0 items-center border-b border-edge px-10 lg:flex">
      <div className="flex items-center gap-2.5">
        <LogoIcon />
        <span className="text-[22px] leading-none font-bold tracking-tight">Tradr</span>
      </div>
      <nav className="ml-12 flex h-full gap-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-current={active === tab.id ? 'page' : undefined}
            className={`-mb-px border-b-2 text-[15px] font-medium transition-colors ${
              active === tab.id ? 'border-neutral-100 text-neutral-100' : 'border-transparent text-dim hover:text-soft'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-baseline gap-3">
        <span className="text-[11px] tracking-[0.08em] text-muted uppercase">Paper balance</span>
        <span className="font-mono text-[17px] font-semibold">{formatMoney(balance)}</span>
      </div>
    </header>
  )
}
