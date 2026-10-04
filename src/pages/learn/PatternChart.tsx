import { useEffect, useMemo, useState } from 'react'
import type { Bias, Candle, Shape } from '../../types'
import type { LibraryEntry } from '../../lib/library'
import type { PatternExample } from '../../lib/examples'
import { followThrough } from '../../lib/patternStudy'
import { annotate, illustrativeVolume } from '../../lib/annotate'
import { AnnotatedChart } from '../../components/AnnotatedChart'

// The Learn tab's charts, all in the textbook style: the big example on a
// pattern's page (which can play out to its target), and small thumbnails.

interface HeroProps {
  entry: LibraryEntry
  example: PatternExample
  height: number
}

// The example, titled and labelled, with room on the right. "Play it out"
// runs a typical follow-through toward the measured target.
export function HeroChart({ entry, example, height }: HeroProps) {
  const { candles, shapes } = example
  const last = candles.length - 1
  const { notes, target } = useMemo(() => annotate(shapes, candles, entry.bias, last, entry.kind === 'chart'), [shapes, candles, entry, last])
  const next = useMemo(() => followThrough(example, entry.bias, 5, target), [example, entry.bias, target])
  const all = useMemo(() => [...candles, ...next], [candles, next])
  const volume = useMemo(() => illustrativeVolume(all, entry.key.length * 97), [all, entry.key])
  const range = useMemo(() => {
    const prices = [...all.flatMap((c) => [c.low, c.high]), ...(target ? [target] : [])]
    const lo = Math.min(...prices)
    const hi = Math.max(...prices)
    return { min: lo - (hi - lo) * 0.06, max: hi + (hi - lo) * 0.08 }
  }, [all, target])
  const [shown, setShown] = useState(0)
  const [started, setStarted] = useState(false)
  const played = shown >= next.length
  const playing = started && !played

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setShown((n) => n + 1), 75)
    return () => clearTimeout(timer)
  }, [playing, shown])

  return (
    <div className="rounded-3xl border border-edge bg-[#07090c] px-1.5 pt-2 pb-1.5">
      <AnnotatedChart
        candles={all.slice(0, candles.length + shown)}
        slots={all.length}
        range={range}
        notes={notes}
        volume={volume}
        height={height}
        title={entry.name}
        shadeFrom={shown ? candles.length : undefined}
        label={`${entry.name}, labelled${shown ? ', then a typical follow-through' : ''}`}
      />
      <div className="flex items-center justify-between gap-3 px-2 pt-1">
        <span className="text-[12.5px] text-muted">{target ? 'Target: the pattern’s height, measured from the breakout' : ' '}</span>
        <button
          type="button"
          onClick={() => {
            setShown(0)
            setStarted(!played)
          }}
          disabled={playing}
          className="h-9 shrink-0 rounded-lg px-2.5 text-[13px] font-medium text-soft transition-colors hover:bg-neutral-900 hover:text-white disabled:opacity-50"
        >
          {played ? 'Reset' : playing ? 'Playing…' : 'Play it out ▸'}
        </button>
      </div>
    </div>
  )
}

interface ThumbProps {
  candles: Candle[]
  shapes: Shape[]
  bias: Bias
  height: number
  label: string
  box?: number // outline the last this-many candles (a question, not an answer)
  measure?: boolean // draw the target and breakout arrow
}

// A small labelled chart for cards and galleries.
export function Thumb({ candles, shapes, bias, height, label, box = 0, measure = false }: ThumbProps) {
  const { notes } = useMemo(() => annotate(shapes, candles, bias, candles.length - 1, measure), [shapes, candles, bias, measure])
  const volume = useMemo(() => illustrativeVolume(candles, candles.length * 31), [candles])
  return (
    <AnnotatedChart candles={candles} notes={notes.filter((n) => n.kind !== 'vline')} volume={volume} height={height} compact label={label}>
      {(scale) =>
        box > 0 && shapes.length === 0 ? (
          (() => {
            const slice = candles.slice(-box)
            const top = scale.y(Math.max(...slice.map((c) => c.high))) - 5
            const bottom = scale.y(Math.min(...slice.map((c) => c.low))) + 5
            const left = scale.x(candles.length - box) - scale.slot / 2 - 2
            return (
              <rect
                x={left}
                y={top}
                width={scale.x(candles.length - 1) + scale.slot / 2 + 2 - left}
                height={bottom - top}
                rx={4}
                fill="none"
                stroke="#e5e5e5"
                strokeWidth={1.25}
                strokeDasharray="3 3"
              />
            )
          })()
        ) : null
      }
    </AnnotatedChart>
  )
}
