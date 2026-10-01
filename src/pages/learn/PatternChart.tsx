import { useEffect, useMemo, useState } from 'react'
import type { Candle, Shape } from '../../types'
import type { LibraryEntry } from '../../lib/library'
import type { PatternExample } from '../../lib/examples'
import { followThrough } from '../../lib/lessons'
import { SvgChart } from '../../components/SvgChart'
import { ShapeLayer } from '../../components/ChartLayers'
import { shapePrices } from '../../components/chartScale'
import { COLORS } from '../../theme'

// Charts for studying a pattern: the example with room to play out what
// usually comes next, and plain "specimens" for the examples, look-alikes,
// and drill rounds.

interface PlayProps {
  entry: LibraryEntry
  example: PatternExample
  height: number
}

// The example chart, with room on the right for what usually comes next.
// "What happens next?" plays a typical follow-through into that space.
export function PlayOut({ entry, example, height }: PlayProps) {
  const next = useMemo(() => followThrough(example, entry.bias), [example, entry.bias])
  const all = useMemo(() => [...example.candles, ...next], [example, next])
  const range = useMemo(() => {
    const prices = [...all.flatMap((c) => [c.low, c.high]), ...shapePrices(example.shapes)]
    const low = Math.min(...prices)
    const high = Math.max(...prices)
    return { min: low - (high - low) * 0.06, max: high + (high - low) * 0.06 }
  }, [all, example.shapes])
  const [shown, setShown] = useState(0) // follow-through candles on screen
  const [started, setStarted] = useState(false)
  const played = shown >= next.length
  const playing = started && !played

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setShown((n) => n + 1), 70)
    return () => clearTimeout(timer)
  }, [playing, shown])

  const n = example.candles.length
  return (
    <div className="rounded-2xl bg-base/60 px-1 py-2">
      <SvgChart
        candles={all.slice(0, n + shown)}
        slots={all.length}
        range={range}
        height={height}
        label={`Example of a ${entry.name.toLowerCase()}${shown ? ', then a typical follow-through' : ''}`}
      >
        {(scale, width) => (
          <g>
            <ShapeLayer shapes={example.shapes} candles={example.candles} scale={scale} />
            <line x1={scale.x(n - 0.5)} x2={scale.x(n - 0.5)} y1={4} y2={height - 4} stroke="#3a3a3a" strokeDasharray="2 3" />
            {shown === 0 && (
              <text x={(scale.x(n - 0.5) + width) / 2} y={height / 2 + 8} textAnchor="middle" fontSize={height > 160 ? 30 : 22} fill="#3d3d3d">
                ?
              </text>
            )}
            {played && (
              <text x={width - 6} y={14} textAnchor="end" fontSize={10.5} fill={COLORS.axisText}>
                Typical follow-through
              </text>
            )}
          </g>
        )}
      </SvgChart>
      <div className="flex justify-end px-1 pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setShown(0)
            setStarted(!played) // play, or (once played) reset
          }}
          disabled={playing}
          className="h-9 rounded-lg px-2.5 text-[13px] text-muted transition-colors hover:bg-neutral-900 hover:text-white disabled:opacity-50"
        >
          {played ? 'Reset' : playing ? 'Playing…' : 'What happens next? ▸'}
        </button>
      </div>
    </div>
  )
}

interface SpecimenProps {
  candles: Candle[]
  shapes?: Shape[] // markup to draw (grey lines, yellow candle boxes)
  box?: number // candlestick drills: outline the last this-many candles, so you know which to judge
  height: number
  label: string
}

export function SpecimenChart({ candles, shapes = [], box = 0, height, label }: SpecimenProps) {
  return (
    <SvgChart candles={candles} height={height} label={label}>
      {(scale) => (
        <g>
          {box > 0 && shapes.length === 0 && (
            (() => {
              const slice = candles.slice(-box)
              const top = scale.y(Math.max(...slice.map((c) => c.high))) - 6
              const bottom = scale.y(Math.min(...slice.map((c) => c.low))) + 6
              const left = scale.x(candles.length - box) - scale.slot / 2 - 3
              return (
                <rect
                  x={left}
                  y={top}
                  width={scale.x(candles.length - 1) + scale.slot / 2 + 3 - left}
                  height={bottom - top}
                  rx={5}
                  fill="none"
                  stroke="#e5e5e5"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              )
            })()
          )}
          <ShapeLayer shapes={shapes} candles={candles} scale={scale} color="#d4d4d4" />
        </g>
      )}
    </SvgChart>
  )
}
