import { useState } from 'react'
import type { Practice } from '../game/usePractice'
import { MarkDrill } from './practice/MarkDrill'
import { BuildDrill } from './practice/BuildDrill'
import { DrawDrill } from './practice/DrawDrill'

export type PracticeMode = 'mark' | 'build' | 'draw'

// Where to open Practice: a drill, and optionally the pattern to start on.
export interface PracticeFocus {
  mode: PracticeMode
  key: string | null
}

const MODES: { id: PracticeMode; label: string; blurb: string }[] = [
  { id: 'mark', label: 'Mark', blurb: 'Name the candlestick patterns hidden in a chart.' },
  { id: 'build', label: 'Build', blurb: 'Drag candles into shape until the detector recognises the pattern.' },
  { id: 'draw', label: 'Draw', blurb: 'Draw a chart pattern and see whether the scanner agrees.' },
]

interface Props {
  practice: Practice
  focus: PracticeFocus | null
  onLearn: (patternName: string) => void
}

export function PracticePage({ practice, focus, onLearn }: Props) {
  const [mode, setMode] = useState<PracticeMode>(focus?.mode ?? 'mark')
  const { progress } = practice

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pt-6 pb-12 md:max-w-lg lg:max-w-[1240px] lg:px-10 lg:py-8">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Practice</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-soft">No trades and no balance: just you, the candles, and the same detectors that grade your swipes.</p>

        <div role="tablist" aria-label="Drill" className="mt-6 inline-grid grid-cols-3 gap-1 rounded-2xl border border-edge bg-card p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`h-11 rounded-xl px-5 text-[15px] font-medium transition-colors ${
                mode === m.id ? 'bg-neutral-800 text-white' : 'text-muted hover:text-soft'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[15px] text-muted">{MODES.find((m) => m.id === mode)!.blurb}</p>

        <div className="mt-6">
          {mode === 'mark' && <MarkDrill onResult={practice.recordMark} onLearn={onLearn} />}
          {mode === 'build' && (
            <BuildDrill built={progress.built} focus={focus?.mode === 'build' ? focus.key : null} onBuilt={practice.recordBuilt} />
          )}
          {mode === 'draw' && (
            <DrawDrill drawn={progress.drawn} focus={focus?.mode === 'draw' ? focus.key : null} onDrawn={practice.recordDrawn} />
          )}
        </div>
      </div>
    </div>
  )
}
