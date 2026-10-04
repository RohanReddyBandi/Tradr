import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { RANGE_SHOWN, rangeThenBreak } from '../../../lib/lessons'
import { lineVerdict, readLine } from '../../../lib/userMarkup'
import type { Projector } from '../../../components/CandleChart'
import { SvgChart } from '../../../components/SvgChart'
import { COLORS, MONO_FONT } from '../../../theme'
import { Goals, Note, PrimaryButton, Stage, type LessonProps } from './parts'

// Drag a line to the floor of a range. It counts the touches as you go;
// once you've found support, play the chart forward and watch the floor
// break and turn into a ceiling.
export function LevelFinder({ done, onDone }: LessonProps) {
  const [seed] = useState(() => 1 + Math.floor(Math.random() * 1000))
  const candles = useMemo(() => rangeThenBreak(seed), [seed])
  const range = useMemo(() => {
    const prices = candles.flatMap((c) => [c.low, c.high])
    return { min: Math.min(...prices) - 1.5, max: Math.max(...prices) + 1.5 }
  }, [candles])
  const [price, setPrice] = useState(105)
  const [shown, setShown] = useState(RANGE_SHOWN)
  const [started, setStarted] = useState(false) // pressed "Play it forward"

  const [found, setFound] = useState(done)

  const visible = candles.slice(0, RANGE_SHOWN)
  const reading = readLine(visible, { kind: 'level', price })
  const verdict = lineVerdict(reading)
  const holding = verdict === 'strong' || verdict === 'ok'
  const isFloor = holding && reading.role === 'support' && reading.touches.length >= 3
  if (isFloor && !found) setFound(true)
  const played = shown >= candles.length
  const playing = started && !played

  // The replay: one candle at a time.
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setShown((n) => n + 1), 90)
    return () => clearTimeout(timer)
  }, [playing, shown])

  useEffect(() => {
    if (played && !done) onDone()
  }, [played, done, onDone])

  let note: { tone: 'good' | 'nudge' | 'plain'; text: string }
  if (played) {
    note = {
      tone: 'good',
      text: 'Price broke the floor, came back up to it from underneath, and got turned away. The old floor became a ceiling. Traders call it a role reversal, and it happens all the time.',
    }
  } else if (isFloor) {
    note = { tone: 'good', text: `That's support: price came down to ${price.toFixed(2)} ${reading.touches.length} times and buyers stepped in every time. Now play it forward.` }
  } else if (holding && reading.role === 'resistance' && reading.touches.length >= 3) {
    note = { tone: 'nudge', text: "That's resistance: the ceiling, where sellers keep showing up. Now find the floor underneath." }
  } else if (verdict === 'cut') {
    note = { tone: 'plain', text: `Price closes straight through ${price.toFixed(2)} (${reading.crossings} times), so nothing is holding there. Try lower.` }
  } else {
    note = {
      tone: 'plain',
      text: reading.touches.length ? `${reading.touches.length} touch${reading.touches.length === 1 ? '' : 'es'} so far. Keep moving the line.` : 'Drag the line down to where price keeps bouncing.',
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Stage>
        <SvgChart candles={candles.slice(0, shown)} slots={candles.length} range={range} height={280} label="A range, with a line you can drag up and down" overlay={(project) => (
          <DragLevel project={project} price={price} range={range} locked={found} onChange={setPrice} label={played ? 'Old support, now resistance' : isFloor ? 'Support' : null} />
        )}>
          {(scale) => (
            <g>
              {shown === RANGE_SHOWN && (
                <text x={scale.x(RANGE_SHOWN + 8)} y={scale.y((range.min + range.max) / 2)} textAnchor="middle" fontSize={28} fill="#3a3a3a">
                  ?
                </text>
              )}
              {/* A ring on each touch. */}
              {!played &&
                verdict !== 'cut' &&
                reading.touches.map((i) => (
                  <circle
                    key={i}
                    cx={scale.x(i)}
                    cy={scale.y(reading.role === 'support' ? visible[i].low : visible[i].high)}
                    r={6}
                    fill="none"
                    stroke={COLORS.pen}
                    strokeWidth={1.5}
                  />
                ))}
            </g>
          )}
        </SvgChart>
      </Stage>

      <Note tone={note.tone}>{note.text}</Note>

      <div className="flex flex-wrap items-center gap-3">
        <Goals goals={[{ label: 'Find the floor (3 touches)', met: found }, { label: 'Watch the floor break', met: played }]} />
        {found && !played && !playing && <PrimaryButton onClick={() => setStarted(true)}>Play it forward</PrimaryButton>}
      </div>
    </div>
  )
}

interface DragProps {
  project: Projector
  price: number
  range: { min: number; max: number }
  locked: boolean // once you've found the floor, it stays put
  label: string | null
  onChange: (price: number) => void
}

// A horizontal line with a handle, dragged with a finger or mouse or moved with the arrow keys.
function DragLevel({ project, price, range, locked, label, onChange }: DragProps) {
  const layer = useRef<HTMLDivElement>(null)
  const y = project.y(price) ?? 0
  const set = (p: number) => onChange(Math.round(Math.min(range.max, Math.max(range.min, p)) * 20) / 20)

  function drag(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !layer.current) return
    const p = project.toPrice(event.clientY - layer.current.getBoundingClientRect().top)
    if (p !== null) set(p)
  }

  function nudge(event: KeyboardEvent) {
    const step = event.shiftKey ? 1 : 0.1
    if (event.key === 'ArrowUp') set(price + step)
    else if (event.key === 'ArrowDown') set(price - step)
    else return
    event.preventDefault()
  }

  return (
    <div ref={layer} className="absolute top-0 left-0" style={{ width: project.width, height: project.height }}>
      <svg width={project.width} height={project.height} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
        <line x1={0} y1={y} x2={project.width} y2={y} stroke={COLORS.pen} strokeWidth={1.75} strokeDasharray={locked ? undefined : '7 4'} />
      </svg>
      {label && (
        <span className="absolute left-2 -translate-y-full rounded-md bg-base/90 px-1.5 py-0.5 text-[11.5px] font-semibold text-pen" style={{ top: y - 3 }}>
          {label}
        </span>
      )}
      <div
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label="Level"
        aria-valuenow={price}
        aria-valuemin={range.min}
        aria-valuemax={range.max}
        aria-disabled={locked}
        onPointerDown={(e) => !locked && e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={drag}
        onKeyDown={(e) => !locked && nudge(e)}
        className={`absolute left-0 touch-none ${locked ? '' : 'pointer-events-auto cursor-ns-resize'}`}
        style={{ top: y - 16, width: project.width, height: 32 }}
      >
        {!locked && (
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-pen bg-base px-2 py-0.5 text-[11.5px] font-semibold text-pen"
            style={{ fontFamily: MONO_FONT }}
          >
            ↕ {price.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  )
}
