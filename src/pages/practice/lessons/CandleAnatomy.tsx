import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Candle } from '../../../types'
import { adjustCandle, type Handle } from '../../../lib/practice'
import { candleGoals, candleParts, type CandleGoal } from '../../../lib/lessons'
import { priceScale, useWidth } from '../../../components/chartScale'
import { COLORS, MONO_FONT } from '../../../theme'
import { Goals, Note, Stage, type LessonProps } from './parts'

const RANGE = { min: 93, max: 107 }
const START: Candle = { time: 0, open: 99.5, high: 104, low: 97.5, close: 102.5 }
const HEIGHT = 300

const GOALS: { id: CandleGoal; label: string }[] = [
  { id: 'green', label: 'A green candle' },
  { id: 'red', label: 'A red candle' },
  { id: 'doji', label: 'A doji' },
  { id: 'hammer', label: 'A hammer' },
]

// One big candle with its four prices on drag handles, and its parts labelled.
export function CandleAnatomy({ done, onDone }: LessonProps) {
  const [candle, setCandle] = useState(START)
  const [dragging, setDragging] = useState<Handle | null>(null)
  const [met, setMet] = useState<CandleGoal[]>(done ? GOALS.map((g) => g.id) : [])
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)

  // Tick off each goal the first time the candle reaches it.
  const goals = candleGoals(candle)
  const reached = GOALS.filter((g) => goals[g.id] && !met.includes(g.id)).map((g) => g.id)
  if (reached.length) setMet([...met, ...reached])
  const allMet = met.length === GOALS.length
  useEffect(() => {
    if (allMet && !done) onDone()
  }, [allMet, done, onDone])

  const scale = priceScale(1, width, HEIGHT, RANGE.min, RANGE.max, 14)
  const y = scale.y
  const cx = Math.max(96, width * 0.36)
  const half = 22
  const color = candle.close >= candle.open ? COLORS.up : COLORS.down
  const top = y(Math.max(candle.open, candle.close))
  const bottom = y(Math.min(candle.open, candle.close))

  function move(which: Handle, price: number) {
    setCandle((c) => adjustCandle(c, which, Math.round(Math.min(RANGE.max - 0.2, Math.max(RANGE.min + 0.2, price)) * 20) / 20))
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragging) return
    const rect = event.currentTarget.getBoundingClientRect()
    move(dragging, scale.toPrice(event.clientY - rect.top))
  }

  function onKey(event: KeyboardEvent, which: Handle) {
    const step = event.shiftKey ? 1 : 0.25
    if (event.key === 'ArrowUp') move(which, candle[which] + step)
    else if (event.key === 'ArrowDown') move(which, candle[which] - step)
    else return
    event.preventDefault()
  }

  const handles: { which: Handle; x: number; label: string; anchor: 'end' | 'start' | 'middle'; lx: number; ly: number }[] = [
    { which: 'open', x: cx - half - 16, label: 'Open', anchor: 'end', lx: cx - half - 28, ly: y(candle.open) + 4 },
    { which: 'close', x: cx + half + 16, label: 'Close', anchor: 'start', lx: cx + half + 28, ly: y(candle.close) + 4 },
    { which: 'high', x: cx, label: 'High', anchor: 'middle', lx: cx, ly: y(candle.high) - 14 },
    { which: 'low', x: cx, label: 'Low', anchor: 'middle', lx: cx, ly: y(candle.low) + 24 },
  ]
  // Brackets naming the parts, on the right.
  const bx = Math.min(width - 96, cx + half + 84)
  const parts = [
    { name: 'Upper wick', from: y(candle.high), to: top, label: 0 },
    { name: 'Body', from: top, to: bottom, label: 0 },
    { name: 'Lower wick', from: bottom, to: y(candle.low), label: 0 },
  ].filter((p) => p.to - p.from > 3)
  // Labels sit mid-bracket, nudged apart so short parts don't stack their names.
  parts.forEach((p, k) => {
    p.label = Math.max((p.from + p.to) / 2 + 4, k > 0 ? parts[k - 1].label + 15 : -Infinity)
  })

  const { body, upper, lower, change } = candleParts(candle)
  const pct = `${Math.abs(change * 100).toFixed(1)}%`
  const verdict = goals.doji
    ? 'A draw: it closed almost exactly where it opened. That candle is a doji: nobody won the day.'
    : candle.close > candle.open
      ? `Buyers won the day: it closed ${pct} above where it opened, so it's green.`
      : `Sellers won the day: it closed ${pct} below where it opened, so it's red.`
  const wicks =
    lower >= 2 * body && lower > upper * 2
      ? ' The long lower wick means sellers pushed price down during the day, and buyers pushed it back up.'
      : upper >= 2 * body && upper > lower * 2
        ? ' The long upper wick means buyers pushed price up during the day, and sellers pushed it back down.'
        : ''

  return (
    <div className="flex flex-col gap-4">
      <Stage>
        <div ref={box} className="w-full">
          {width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              className="block touch-none select-none"
              onPointerMove={onPointerMove}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
              role="group"
              aria-label="A candle you can reshape by dragging its open, close, high, and low"
            >
              {/* The candle */}
              <line x1={cx} y1={y(candle.high)} x2={cx} y2={y(candle.low)} stroke={color} strokeWidth={2.5} />
              <rect x={cx - half} y={top} width={half * 2} height={Math.max(2, bottom - top)} rx={2} fill={color} />

              {/* The parts, bracketed */}
              {parts.map((p) => (
                <g key={p.name}>
                  <path d={`M ${bx - 5} ${p.from + 1} H ${bx} V ${p.to - 1} H ${bx - 5}`} fill="none" stroke="#5a5a5a" strokeWidth={1.25} />
                  <text x={bx + 8} y={p.label} fontSize={12} fill={COLORS.axisText}>
                    {p.name}
                  </text>
                </g>
              ))}

              {/* The four handles */}
              {handles.map((h) => {
                const hy = y(candle[h.which])
                return (
                  <g key={h.which}>
                    {(h.which === 'open' || h.which === 'close') && (
                      <line x1={h.which === 'open' ? cx - half : cx + half} y1={hy} x2={h.x} y2={hy} stroke="#f2f2f2" strokeWidth={1.5} />
                    )}
                    <text x={h.lx} y={h.ly} textAnchor={h.anchor} fontSize={11.5} fill={dragging === h.which ? '#ffffff' : COLORS.axisText}>
                      {h.label}
                    </text>
                    <circle cx={h.x} cy={hy} r={dragging === h.which ? 8.5 : 7} fill={COLORS.card} stroke="#f2f2f2" strokeWidth={2} pointerEvents="none" />
                    <circle
                      cx={h.x}
                      cy={hy}
                      r={18}
                      fill="transparent"
                      className="cursor-ns-resize"
                      role="slider"
                      tabIndex={0}
                      aria-label={h.label}
                      aria-valuenow={candle[h.which]}
                      aria-valuemin={RANGE.min}
                      aria-valuemax={RANGE.max}
                      onKeyDown={(e) => onKey(e, h.which)}
                      onPointerDown={(e) => {
                        e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId)
                        setDragging(h.which)
                      }}
                    />
                  </g>
                )
              })}
            </svg>
          )}
        </div>
        <dl className="mt-2 grid grid-cols-4 gap-2 border-t border-edge pt-3 text-center">
          {(['open', 'high', 'low', 'close'] as const).map((k) => (
            <div key={k}>
              <dt className="text-[11px] tracking-[0.08em] text-muted uppercase">{k}</dt>
              <dd className="mt-0.5 text-[15px] tabular-nums" style={{ fontFamily: MONO_FONT }}>
                {candle[k].toFixed(2)}
              </dd>
            </div>
          ))}
        </dl>
      </Stage>

      <Note tone={allMet ? 'good' : 'plain'}>
        {verdict}
        {wicks}
      </Note>

      <div>
        <p className="mb-2.5 text-sm text-muted">Drag the dots to make each of these:</p>
        <Goals goals={GOALS.map((g) => ({ label: g.label, met: met.includes(g.id) }))} />
        {!met.includes('hammer') && met.length >= 2 && (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Hammer hint: a small body near the top, a lower wick at least twice as long as the body, and almost no upper wick.
          </p>
        )}
      </div>
    </div>
  )
}
