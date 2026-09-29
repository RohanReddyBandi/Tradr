import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Candle } from '../../types'
import { PRACTICE_CANDLES, buildTask, readBuild } from '../../lib/practice'
import { GROUPS, LIBRARY, entryByKey } from '../../lib/library'
import { candleExample } from '../../lib/examples'
import { CandleLayer } from '../../components/ChartLayers'
import { priceScale, useWidth } from '../../components/chartScale'
import { MiniChart } from '../../components/MiniChart'
import { COLORS } from '../../theme'
import { PatternPicker } from './PatternPicker'
import { TargetHeader } from './TargetHeader'

const CANDLE_ENTRIES = LIBRARY.filter((e) => e.kind === 'candle')

// A pattern you haven't built yet (or any, once you've built them all).
function pickNext(built: string[], not?: string) {
  const left = PRACTICE_CANDLES.filter((p) => !built.includes(p.key) && p.key !== not)
  const pool = left.length ? left : PRACTICE_CANDLES.filter((p) => p.key !== not)
  return pool[Math.floor(Math.random() * pool.length)].key
}

interface Props {
  built: string[]
  focus: string | null // a pattern to start on (from the Learn tab)
  onBuilt: (key: string) => void
}

export function BuildDrill({ built, focus, onBuilt }: Props) {
  // Start on the requested pattern, then the classic hammer, then a random one you haven't built.
  const [target, setTarget] = useState(() => focus ?? (built.includes('hammer') ? pickNext(built) : 'hammer'))
  const [picking, setPicking] = useState(false)
  const entry = entryByKey(target)!

  function choose(key: string) {
    setTarget(key)
    setPicking(false)
  }

  const picker = <PatternPicker entries={CANDLE_ENTRIES} groups={GROUPS.candle} selected={target} done={built} onPick={choose} />

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
      <section>
        <TargetHeader
          verb="Build"
          name={entry.name}
          done={built.length}
          total={PRACTICE_CANDLES.length}
          picking={picking}
          onChange={() => setPicking((p) => !p)}
          onRandom={() => choose(pickNext(built, target))}
        />
        {picking && <div className="mt-4 rounded-3xl border border-edge bg-card p-4 lg:hidden">{picker}</div>}
        {/* A new pattern gets a fresh editor (the key makes React start it over). */}
        <BuildEditor key={target} target={target} onBuilt={onBuilt} onNext={() => choose(pickNext(built, target))} />
      </section>
      <aside className="hidden lg:block">
        <div className="rounded-3xl border border-edge bg-card p-4">{picker}</div>
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

type Handle = 'high' | 'low' | 'open' | 'close'
const PAD = 12
const LABELS = 26 // room under the candles for "Before" / "Your candles"

// Move one price, keeping the candle valid: the wicks always reach at least
// as far as the body.
function adjust(c: Candle, which: Handle, price: number): Candle {
  const next = { ...c, [which]: price }
  if (which === 'high') next.high = Math.max(price, c.open, c.close)
  else if (which === 'low') next.low = Math.min(price, c.open, c.close)
  else {
    next.high = Math.max(c.high, next.open, next.close)
    next.low = Math.min(c.low, next.open, next.close)
  }
  return next
}

function BuildEditor({ target, onBuilt, onNext }: { target: string; onBuilt: (key: string) => void; onNext: () => void }) {
  const task = useMemo(() => buildTask(target), [target])
  const entry = entryByKey(target)!
  const [yours, setYours] = useState(task.start)
  const [active, setActive] = useState(task.start.length - 1) // which of your candles shows its handles
  const [dragging, setDragging] = useState<Handle | null>(null)
  const [touched, setTouched] = useState(false) // the reading only means something once you've moved a candle
  const [showExample, setShowExample] = useState(false)
  const example = useMemo(() => candleExample(target), [target])

  const boxRef = useRef<HTMLDivElement>(null)
  const width = useWidth(boxRef)
  const height = width < 520 ? 320 : 400
  const area = height - LABELS // the candle area's height
  const { context, range } = task
  const count = context.length + yours.length + 1.5 // empty room on the right for the handles and labels
  const scale = priceScale(count, width, area, range.min, range.max, PAD)
  const toPrice = (py: number) => range.max - ((py - PAD) / (area - PAD * 2)) * (range.max - range.min)

  const reading = readBuild(context, yours)
  const match = touched ? reading.find((m) => m.pattern.key === target) : undefined

  function update(next: Candle[]) {
    setYours(next)
    setTouched(true)
    if (readBuild(context, next).some((m) => m.pattern.key === target)) onBuilt(target)
  }

  function startOver() {
    setYours(task.start)
    setTouched(false)
  }

  function move(which: Handle, price: number) {
    const clamped = Math.min(range.max, Math.max(range.min, price))
    update(yours.map((c, k) => (k === active ? adjust(c, which, clamped) : c)))
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragging) return
    const rect = event.currentTarget.getBoundingClientRect()
    move(dragging, toPrice(event.clientY - rect.top))
  }

  // Arrow keys nudge a focused handle up or down.
  function onHandleKey(event: KeyboardEvent, which: Handle) {
    const step = (range.max - range.min) / 80
    if (event.key === 'ArrowUp') move(which, yours[active][which] + step)
    else if (event.key === 'ArrowDown') move(which, yours[active][which] - step)
    else return
    event.preventDefault()
  }

  const all = [...context, ...yours]
  const first = context.length
  const c = yours[active]
  const cx = scale.x(first + active)
  const bodyHalf = Math.max(4, scale.slot * 0.3)
  // Open and close sit out to the sides (like the ticks on a bar chart), high
  // and low on the wick ends. High and low come last so they're on top where
  // grab areas overlap.
  // On narrow screens the side labels shrink to O and C so they don't cover the next candle.
  const side = bodyHalf + 13
  const roomy = scale.slot >= 34
  const handles: { which: Handle; label: string; x: number; y: number; lx: number; ly: number; anchor: 'start' | 'middle' | 'end' }[] = [
    { which: 'open', label: roomy ? 'Open' : 'O', x: cx - side, y: scale.y(c.open), lx: cx - side - 11, ly: scale.y(c.open) + 4, anchor: 'end' },
    { which: 'close', label: roomy ? 'Close' : 'C', x: cx + side, y: scale.y(c.close), lx: cx + side + 11, ly: scale.y(c.close) + 4, anchor: 'start' },
    { which: 'high', label: 'High', x: cx, y: scale.y(c.high), lx: cx, ly: scale.y(c.high) - 13, anchor: 'middle' },
    { which: 'low', label: 'Low', x: cx, y: scale.y(c.low), lx: cx, ly: scale.y(c.low) + 22, anchor: 'middle' },
  ]
  // Near the top or bottom edge there's no room above/below, so the label goes beside the dot.
  for (const h of handles) {
    if (h.ly < 12 || h.ly > area - 4) Object.assign(h, { lx: h.x + 13, ly: h.y + 4, anchor: 'start' })
  }

  return (
    <>
      <div ref={boxRef} className="mt-4 rounded-3xl border border-edge bg-card">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            className="block touch-none select-none"
            onPointerMove={onPointerMove}
            onPointerUp={() => setDragging(null)}
            onPointerCancel={() => setDragging(null)}
            role="group"
            aria-label={`Candle editor: build a ${entry.name.toLowerCase()}`}
          >
            {/* The strip holding your candles. */}
            <rect
              x={scale.x(first) - scale.slot / 2 - 3}
              y={4}
              width={scale.slot * yours.length + 6}
              height={area - 8}
              rx={10}
              fill="#ffffff"
              fillOpacity={0.03}
              stroke="#2e2e2e"
              strokeDasharray="4 4"
            />
            <text x={scale.x(first / 2 - 0.5)} y={height - 9} textAnchor="middle" fontSize={11} fill={COLORS.axisText}>
              Before
            </text>
            <text x={scale.x(first + (yours.length - 1) / 2)} y={height - 9} textAnchor="middle" fontSize={11} fill="#d4d4d4">
              {yours.length === 1 ? 'Your candle' : 'Your candles'}
            </text>

            {/* Green box around the pattern once it's right. */}
            {match && (() => {
              const slice = all.slice(match.start, match.end + 1)
              const top = scale.y(Math.max(...slice.map((x) => x.high))) - 8
              const bottom = scale.y(Math.min(...slice.map((x) => x.low))) + 8
              return (
                <rect
                  x={scale.x(match.start) - scale.slot / 2 - 2}
                  y={top}
                  width={scale.slot * slice.length + 4}
                  height={bottom - top}
                  rx={6}
                  fill={COLORS.up}
                  fillOpacity={0.07}
                  stroke={COLORS.up}
                  strokeWidth={1.5}
                />
              )
            })()}

            <CandleLayer candles={all} scale={scale} dim={(i) => i < first} />

            {/* Tap one of your candles to edit it. */}
            {yours.map((_, k) => (
              <rect
                key={k}
                x={scale.x(first + k) - scale.slot / 2}
                y={0}
                width={scale.slot}
                height={area}
                fill="transparent"
                className={k === active ? '' : 'cursor-pointer'}
                onPointerDown={() => setActive(k)}
              />
            ))}

            {/* The four handles of the candle you're editing. */}
            {handles.map((h) => (
              <g key={h.which}>
                {(h.which === 'open' || h.which === 'close') && (
                  <line x1={h.which === 'open' ? cx - bodyHalf : cx + bodyHalf} y1={h.y} x2={h.x} y2={h.y} stroke="#f2f2f2" strokeWidth={1.5} />
                )}
                <text x={h.lx} y={h.ly} textAnchor={h.anchor} fontSize={10.5} fill={dragging === h.which ? '#ffffff' : COLORS.axisText}>
                  {h.label}
                </text>
                <circle cx={h.x} cy={h.y} r={dragging === h.which ? 8 : 6.5} fill={COLORS.card} stroke="#f2f2f2" strokeWidth={2} pointerEvents="none" />
                {/* A bigger invisible circle is what you actually grab. */}
                <circle
                  cx={h.x}
                  cy={h.y}
                  r={15}
                  fill="transparent"
                  className="cursor-ns-resize"
                  role="slider"
                  tabIndex={0}
                  aria-label={`${h.which} of your candle ${active + 1}`}
                  aria-valuenow={Math.round(c[h.which] * 100) / 100}
                  aria-valuemin={Math.round(range.min * 100) / 100}
                  aria-valuemax={Math.round(range.max * 100) / 100}
                  onKeyDown={(e) => onHandleKey(e, h.which)}
                  onPointerDown={(e) => {
                    e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId)
                    setDragging(h.which)
                  }}
                />
              </g>
            ))}
          </svg>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Drag the dots: top and bottom set the wicks, left (O) sets where the candle opened, right (C) where it closed.
        {yours.length > 1 && ' Tap one of your other candles to edit it.'}
      </p>

      {match ? (
        <div className="mt-4 rounded-3xl border border-up/30 bg-up/[0.06] p-5">
          <p className="text-[17px] font-semibold text-up">That's a {entry.name.toLowerCase()}.</p>
          <p className="mt-2 text-[15px] leading-relaxed text-soft">{entry.meaning}</p>
          <button onClick={onNext} className="mt-4 h-12 rounded-2xl bg-up px-6 text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]">
            Next pattern
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-edge bg-card p-5">
          {touched && (
            <>
              <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Right now it reads as</div>
              <p className="mt-1.5 mb-4 text-[17px] font-medium">
                {reading.length ? reading.map((m) => m.pattern.name).join(', ') : 'Nothing named yet'}
              </p>
            </>
          )}
          <p className="text-[15px] leading-relaxed text-soft">
            <span className="font-semibold text-neutral-100">What to build: </span>
            {entry.meaning}
          </p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setShowExample((s) => !s)}
          aria-expanded={showExample}
          className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft transition-colors hover:border-neutral-600 hover:text-white"
        >
          {showExample ? 'Hide example' : 'Show an example'}
        </button>
        <button
          onClick={startOver}
          className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft transition-colors hover:border-neutral-600 hover:text-white"
        >
          Start over
        </button>
      </div>
      {showExample && example && (
        <div className="mt-3 rounded-2xl border border-edge bg-base/60 px-1 py-2">
          <MiniChart candles={example.candles} shapes={example.shapes} label={`Example of a ${entry.name.toLowerCase()}`} />
        </div>
      )}
    </>
  )
}
