import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Candle, ChartPoint } from '../types'
import type { Projector } from './CandleChart'
import type { Drawing } from '../lib/userMarkup'
import { entryByKey } from '../lib/library'
import { COLORS, MONO_FONT } from '../theme'

// Your own drawings on a chart: trendlines, levels, and named candles, in
// the pen color. DrawingLayer is the interactive version on the trade setup
// chart; DrawingShapes just draws them (the Breakdown uses it too).

export type Tool = 'trade' | 'trend' | 'level' | 'candle'

const SNAP = 14 // px: points this close to a candle's high or low jump onto it
const cents = (n: number) => Math.round(n * 100) / 100

interface ShapesProps {
  drawings: Drawing[]
  candles: Candle[]
  x: (index: number) => number
  y: (price: number) => number
  width: number
  status?: (k: number) => 'good' | 'bad' | null // graded drawings get a tick or a cross
  extendTo?: number // carry trendlines on, dashed, to this candle position (the replay)
  focus?: number | null // one drawing to highlight; the rest fade
  opacity?: number
}

export function DrawingShapes({ drawings, candles, x, y, width, status, extendTo, focus = null, opacity = 1 }: ShapesProps) {
  const slot = Math.abs(x(1) - x(0))
  const fade = (k: number) => (focus !== null && focus !== k ? 0.2 : 1) * opacity

  // Candle tags sit above their candle, stacked when they'd overlap.
  const placed: { left: number; right: number; lane: number }[] = []
  const tags = drawings.flatMap((d, k) => {
    if (d.kind !== 'candle' || !candles[d.index]) return []
    const mark = status?.(k)
    const text = `${mark === 'good' ? '✓ ' : mark === 'bad' ? '✗ ' : ''}${entryByKey(d.key)?.name ?? d.key}`
    const w = text.length * 6.2 + 14
    const left = Math.min(Math.max(x(d.index) - w / 2, 2), width - w - 2)
    let lane = 0
    while (placed.some((p) => p.lane === lane && left < p.right + 4 && left + w > p.left - 4)) lane++
    placed.push({ left, right: left + w, lane })
    return [{ k, d, text, w, left, lane, mark }]
  })

  return (
    <g>
      {drawings.map((d, k) => {
        if (d.kind === 'level') {
          const py = y(d.price)
          const label = d.price.toFixed(2)
          const w = label.length * 6.6 + 10
          return (
            <g key={k} opacity={fade(k) * (status?.(k) === 'bad' ? 0.5 : 1)}>
              <line x1={0} y1={py} x2={width} y2={py} stroke={COLORS.pen} strokeWidth={1.5} strokeDasharray="7 4" />
              <rect x={width - w - 2} y={py - 9} width={w} height={18} rx={4} fill={COLORS.base} stroke={COLORS.pen} strokeOpacity={0.6} />
              <text x={width - w / 2 - 2} y={py + 4} textAnchor="middle" fontSize={10.5} fontFamily={MONO_FONT} fill={COLORS.pen}>
                {label}
              </text>
            </g>
          )
        }
        if (d.kind === 'trend') {
          const [a, b] = d.from.index <= d.to.index ? [d.from, d.to] : [d.to, d.from]
          const slope = b.index === a.index ? 0 : (b.price - a.price) / (b.index - a.index)
          return (
            <g key={k} opacity={fade(k) * (status?.(k) === 'bad' ? 0.5 : 1)}>
              {extendTo !== undefined && extendTo > b.index && (
                <line
                  x1={x(b.index)}
                  y1={y(b.price)}
                  x2={x(extendTo)}
                  y2={y(b.price + slope * (extendTo - b.index))}
                  stroke={COLORS.pen}
                  strokeWidth={1.25}
                  strokeDasharray="3 4"
                  opacity={0.6}
                />
              )}
              <line x1={x(a.index)} y1={y(a.price)} x2={x(b.index)} y2={y(b.price)} stroke={COLORS.pen} strokeWidth={2} strokeLinecap="round" />
              <circle cx={x(a.index)} cy={y(a.price)} r={3.5} fill={COLORS.base} stroke={COLORS.pen} strokeWidth={1.5} />
              <circle cx={x(b.index)} cy={y(b.price)} r={3.5} fill={COLORS.base} stroke={COLORS.pen} strokeWidth={1.5} />
            </g>
          )
        }
        const c = candles[d.index]
        if (!c) return null
        return (
          <rect
            key={k}
            opacity={fade(k)}
            x={x(d.index) - slot / 2 - 1}
            y={y(c.high) - 4}
            width={slot + 2}
            height={y(c.low) - y(c.high) + 8}
            rx={3}
            fill={COLORS.pen}
            fillOpacity={0.1}
            stroke={COLORS.pen}
            strokeWidth={1.25}
            strokeDasharray="3 2"
          />
        )
      })}
      {tags.map(({ k, d, text, w, left, lane, mark }) => {
        if (d.kind !== 'candle') return null
        const bottom = y(candles[d.index].high) - 8 - lane * 21
        const color = mark === 'good' ? COLORS.up : mark === 'bad' ? COLORS.down : COLORS.pen
        return (
          <g key={`tag-${k}`} opacity={fade(k)}>
            <line x1={x(d.index)} y1={bottom} x2={x(d.index)} y2={y(candles[d.index].high) - 4} stroke={color} strokeOpacity={0.6} />
            <rect x={left} y={bottom - 18} width={w} height={18} rx={5} fill={COLORS.base} stroke={color} strokeOpacity={0.7} />
            <text x={left + w / 2} y={bottom - 5} textAnchor="middle" fontSize={11} fontWeight={500} fill={color}>
              {text}
            </text>
          </g>
        )
      })}
    </g>
  )
}

interface LayerProps {
  project: Projector
  candles: Candle[]
  slots: number // candle positions across the chart, including the empty ones on the right
  tool: Tool
  drawings: Drawing[]
  selected: number | null // the candle being named right now
  onAdd: (drawing: Drawing) => void
  onPickCandle: (index: number) => void
}

// The trade setup chart's drawing surface. With the trendline tool you drag
// from one point to another; with the level tool you tap (or drag) a height;
// with the candle tool you tap a candle to name it. Points jump onto a
// nearby high or low, like the magnet in charting apps.
export function DrawingLayer({ project, candles, slots, tool, drawings, selected, onAdd, onPickCandle }: LayerProps) {
  const { width, height } = project
  const x = (i: number) => project.x(i) ?? -100
  const y = (p: number) => project.y(p) ?? -100

  // The drawing in progress. A ref keeps the latest copy for pointerup.
  const [draft, setDraftState] = useState<Drawing | null>(null)
  const draftRef = useRef<Drawing | null>(null)
  const setDraft = (d: Drawing | null) => {
    draftRef.current = d
    setDraftState(d)
  }
  const [ring, setRing] = useState<ChartPoint | null>(null) // where the magnet caught
  const [cursor, setCursor] = useState<number | null>(null) // keyboard: the candle you're on
  const start = useRef<{ x: number; y: number } | null>(null)

  function locate(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    const index = project.toIndex(px)
    const price = project.toPrice(py)
    if (index === null || price === null) return null
    let snap: ChartPoint | null = null
    let nearest = SNAP
    for (let i = Math.round(index) - 2; i <= Math.round(index) + 2; i++) {
      const c = candles[i]
      if (!c) continue
      for (const p of [c.high, c.low]) {
        const d = Math.hypot(x(i) - px, y(p) - py)
        if (d < nearest) {
          nearest = d
          snap = { index: i, price: p }
        }
      }
    }
    return {
      point: snap ?? { index: Math.min(slots - 1, Math.max(0, Math.round(index))), price: cents(price) },
      snapped: snap !== null,
      candle: Math.round(index),
      px,
      py,
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const at = locate(event)
    if (!at) return
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { x: at.px, y: at.py }
    if (tool === 'trend') setDraft({ kind: 'trend', from: at.point, to: at.point })
    if (tool === 'level') setDraft({ kind: 'level', price: at.point.price })
    setRing(tool !== 'candle' && at.snapped ? at.point : null)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (tool === 'candle') return
    const at = locate(event)
    if (!at) return
    setRing(at.snapped ? at.point : null)
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const d = draftRef.current
    if (d?.kind === 'trend') setDraft({ ...d, to: at.point })
    if (d?.kind === 'level') setDraft({ kind: 'level', price: at.point.price })
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const at = locate(event)
    const d = draftRef.current
    const moved = at && start.current ? Math.hypot(at.px - start.current.x, at.py - start.current.y) : 0
    if (tool === 'candle' && at && moved < 12 && at.candle >= 0 && at.candle < candles.length) onPickCandle(at.candle)
    if (d?.kind === 'trend' && Math.abs(d.to.index - d.from.index) >= 2) onAdd(d)
    if (d?.kind === 'level') onAdd(d)
    setDraft(null)
    start.current = null
    if (event.pointerType !== 'mouse') setRing(null)
  }

  function cancel() {
    setDraft(null)
    start.current = null
    setRing(null)
  }

  // Keyboard, for the candle tool: arrows move along the candles, Enter names one.
  function onKeyDown(event: KeyboardEvent) {
    if (tool !== 'candle') return
    const last = candles.length - 1
    if (event.key === 'ArrowRight') setCursor((c) => (c === null ? last : Math.min(last, c + 1)))
    else if (event.key === 'ArrowLeft') setCursor((c) => (c === null ? last : Math.max(0, c - 1)))
    else if (event.key === 'Enter' && cursor !== null) onPickCandle(cursor)
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  const highlight = selected ?? (tool === 'candle' ? cursor : null)
  const slot = Math.abs(x(1) - x(0))

  return (
    <div className="absolute top-0 left-0" style={{ width, height }}>
      <svg width={width} height={height} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {highlight !== null && candles[highlight] && (
          <rect x={x(highlight) - slot / 2} y={0} width={slot} height={height} fill="#ffffff" opacity={0.08} />
        )}
        <DrawingShapes drawings={drawings} candles={candles} x={x} y={y} width={width} extendTo={slots - 1} />
        {draft && <DrawingShapes drawings={[draft]} candles={candles} x={x} y={y} width={width} extendTo={slots - 1} opacity={0.75} />}
        {ring && <circle cx={x(ring.index)} cy={y(ring.price)} r={7} fill="none" stroke={COLORS.pen} strokeWidth={1.5} />}
      </svg>
      {tool !== 'trade' && (
        <div
          className={`pointer-events-auto absolute inset-0 touch-none select-none ${tool === 'candle' ? 'cursor-pointer' : 'cursor-crosshair'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={cancel}
          onPointerLeave={(e) => e.pointerType === 'mouse' && !draftRef.current && setRing(null)}
          onKeyDown={onKeyDown}
          tabIndex={tool === 'candle' ? 0 : -1}
          role={tool === 'candle' ? 'group' : undefined}
          aria-label={tool === 'candle' ? 'Chart: use the left and right arrow keys to pick a candle, then Enter to name it' : undefined}
        />
      )}
    </div>
  )
}
