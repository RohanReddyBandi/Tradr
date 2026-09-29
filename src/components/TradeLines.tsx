import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { Projector } from './CandleChart'
import type { Direction } from '../lib/trade'
import { COLORS } from '../theme'

type Level = 'stop' | 'target'

interface Props {
  project: Projector
  direction: Direction
  entry: number
  stop: number
  target: number
  range: { min: number; max: number } // prices the lines can be dragged between
  onChange: (level: Level, price: number) => void
}

const HANDLE_HEIGHT = 28 // px of grabbable area around each line

// The entry, stop loss, and take profit lines on the trade setup chart.
// Stop and target can be dragged with a finger or mouse, or moved with the
// arrow keys once focused.
export function TradeLines({ project, direction, entry, stop, target, range, onChange }: Props) {
  const layer = useRef<HTMLDivElement>(null)
  const { width, height } = project
  const y = (price: number) => project.y(price) ?? -100

  // Keep a level on its own side of the entry (a long's stop below it, and so
  // on), inside the chart, and rounded to the cent.
  function clampLevel(level: Level, price: number) {
    const tick = 0.01
    const below = (level === 'stop') === (direction === 'long') // should this level sit below the entry?
    let p = Math.min(Math.max(price, range.min), range.max)
    p = below ? Math.min(p, entry - tick) : Math.max(p, entry + tick)
    return Math.round(p * 100) / 100
  }

  function dragTo(level: Level, event: PointerEvent<HTMLDivElement>) {
    // Only while this handle "owns" the pointer (set on pointerdown).
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !layer.current) return
    const top = layer.current.getBoundingClientRect().top
    const price = project.toPrice(event.clientY - top)
    if (price !== null) onChange(level, clampLevel(level, price))
  }

  function nudge(level: Level, event: KeyboardEvent<HTMLDivElement>) {
    const step = Math.max(0.01, Math.round(entry * 0.001 * 100) / 100) * (event.shiftKey ? 10 : 1)
    const current = level === 'stop' ? stop : target
    if (event.key === 'ArrowUp') onChange(level, clampLevel(level, current + step))
    else if (event.key === 'ArrowDown') onChange(level, clampLevel(level, current - step))
    else return
    event.preventDefault()
  }

  const lines = [
    { level: 'target' as const, price: target, color: COLORS.up, tag: 'TP', name: 'Take profit' },
    { level: 'stop' as const, price: stop, color: COLORS.down, tag: 'SL', name: 'Stop loss' },
  ]
  const entryY = y(entry)

  return (
    <div ref={layer} className="absolute top-0 left-0" style={{ width, height }}>
      <svg width={width} height={height} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
        {lines.map((l) => (
          <g key={l.level}>
            <rect x={0} y={y(l.price) - 11} width={width} height={22} fill={l.color} opacity={0.07} />
            <line x1={0} y1={y(l.price)} x2={width} y2={y(l.price)} stroke={l.color} strokeWidth={1.5} strokeDasharray="6 5" />
          </g>
        ))}
        <line x1={0} y1={entryY} x2={width} y2={entryY} stroke="#d9d9d9" strokeWidth={1.5} />
      </svg>

      <Tag label="Entry" color="#d9d9d9" top={entryY} left={8} />

      {lines.map((l) => {
        const lineY = y(l.price)
        // Slide the tag over if it would sit on top of the Entry tag.
        const left = Math.abs(lineY - entryY) < 22 ? 72 : 8
        return (
          <div
            key={l.level}
            role="slider"
            tabIndex={0}
            aria-label={l.name}
            aria-valuenow={l.price}
            aria-valuetext={l.price.toFixed(2)}
            aria-valuemin={range.min}
            aria-valuemax={range.max}
            onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
            onPointerMove={(e) => dragTo(l.level, e)}
            onKeyDown={(e) => nudge(l.level, e)}
            className="pointer-events-auto absolute left-0 cursor-ns-resize touch-none rounded-sm"
            style={{ top: lineY - HANDLE_HEIGHT / 2, width, height: HANDLE_HEIGHT }}
          >
            <Tag label={l.tag} color={l.color} top={HANDLE_HEIGHT / 2} left={left} />
          </div>
        )
      })}
    </div>
  )
}

function Tag({ label, color, top, left }: { label: string; color: string; top: number; left: number }) {
  return (
    <span
      className="pointer-events-none absolute -translate-y-1/2 rounded-md border bg-base px-2 py-px text-[12px] leading-[18px] font-semibold"
      style={{ top, left, color, borderColor: color }}
    >
      {label}
    </span>
  )
}
