import { useMemo, useRef, useState, type PointerEvent } from 'react'
import type { Candle } from '../../types'
import { DRAW_CANDLES, DRAW_PRICES, candlesFromDrawing, drawGuide, resample } from '../../lib/practice'
import { findChartPatterns, type ChartPatternMatch } from '../../lib/chartPatterns'
import { entryByKey } from '../../lib/library'
import { CandleLayer, ShapeLayer } from '../../components/ChartLayers'
import { priceScale, useWidth } from '../../components/chartScale'
import { COLORS } from '../../theme'

// Draw a chart pattern yourself, on its page in Learn: one stroke becomes
// candles, and the same scanner that reads the swipe cards says what it sees.

const COLUMNS = 120 // the pad remembers one height per column
const PAD = 12

interface Result {
  candles: Candle[]
  matches: ChartPatternMatch[]
}

export function DrawPad({ target, onDrawn, onNext }: { target: string; onDrawn: (key: string) => void; onNext: () => void }) {
  const entry = entryByKey(target)!
  const boxRef = useRef<HTMLDivElement>(null)
  const width = useWidth(boxRef)
  const height = width < 520 ? 300 : 420
  const scale = priceScale(DRAW_CANDLES, width, height, DRAW_PRICES.min, DRAW_PRICES.max, PAD)
  const toPrice = (py: number) => DRAW_PRICES.max - ((py - PAD) / (height - PAD * 2)) * (DRAW_PRICES.max - DRAW_PRICES.min)

  // The line being drawn. A ref holds the latest copy for the event handlers;
  // state holds the same thing for drawing it on screen.
  const blank = () => Array<number | null>(COLUMNS).fill(null)
  const pointsRef = useRef(blank())
  const [points, setPoints] = useState(blank)
  const lastRef = useRef<{ col: number; price: number } | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [guide, setGuide] = useState(false)
  const guidePrices = useMemo(() => drawGuide(target), [target])

  function where(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    // Columns use the same padding as the candles, so candle i sits over columns 2i and 2i + 1.
    const col = Math.min(COLUMNS - 1, Math.max(0, Math.floor(((event.clientX - rect.left - PAD) / (rect.width - PAD * 2)) * COLUMNS)))
    const price = Math.min(DRAW_PRICES.max, Math.max(DRAW_PRICES.min, toPrice(event.clientY - rect.top)))
    return { col, price }
  }

  function setLine(next: (number | null)[]) {
    pointsRef.current = next
    setPoints(next)
  }

  function start(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const p = where(event)
    const fresh = blank()
    fresh[p.col] = p.price
    lastRef.current = p
    setLine(fresh)
    setDrawing(true)
    setResult(null)
    setProblem(null)
  }

  // Record the pointer. A fast stroke can skip columns, so fill the ones in
  // between with a straight line from the previous point.
  function extend(event: PointerEvent<SVGSVGElement>) {
    if (!drawing) return
    const p = where(event)
    const prev = lastRef.current ?? p
    const next = [...pointsRef.current]
    const steps = Math.abs(p.col - prev.col)
    for (let s = 0; s <= steps; s++) {
      const col = prev.col + Math.sign(p.col - prev.col) * s
      next[col] = steps === 0 ? p.price : prev.price + ((p.price - prev.price) * s) / steps
    }
    lastRef.current = p
    setLine(next)
  }

  function finish() {
    if (!drawing) return
    setDrawing(false)
    const line = pointsRef.current
    const filled = line.flatMap((v, i) => (v === null ? [] : [i]))
    if (filled.length < COLUMNS * 0.5 || filled[0] > COLUMNS * 0.2 || filled[filled.length - 1] < COLUMNS * 0.9) {
      setProblem('Draw across the whole box, from the left edge to the right edge. Patterns are read at the newest candles, on the right.')
      return
    }
    const candles = candlesFromDrawing(resample(line)!)
    const matches = findChartPatterns(candles)
    setResult({ candles, matches })
    if (matches.some((m) => m.pattern.key === target)) onDrawn(target)
  }

  function clear() {
    setLine(blank())
    setResult(null)
    setProblem(null)
  }

  const hit = result?.matches.find((m) => m.pattern.key === target)
  const others = [...new Set((result?.matches ?? []).filter((m) => m.pattern.key !== target).map((m) => m.pattern.name))]
  const colX = (col: number) => PAD + ((col + 0.5) / COLUMNS) * (width - PAD * 2)
  const stroke = points
    .map((v, i) => (v === null ? null : `${colX(i)},${scale.y(v)}`))
    .filter(Boolean)
    .join(' ')
  const empty = points.every((v) => v === null)

  return (
    <>
      <div ref={boxRef} className="mt-4 overflow-hidden rounded-3xl border border-edge bg-card">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            className="block cursor-crosshair touch-none select-none"
            onPointerDown={start}
            onPointerMove={extend}
            onPointerUp={finish}
            onPointerCancel={finish}
            role="img"
            aria-label={`Drawing pad: draw a ${entry.name.toLowerCase()} from left to right`}
          >
            {[0.2, 0.4, 0.6, 0.8].map((f) => (
              <line key={f} x1={0} x2={width} y1={PAD + f * (height - PAD * 2)} y2={PAD + f * (height - PAD * 2)} stroke={COLORS.grid} strokeDasharray="6 6" />
            ))}
            {guide && (
              <polyline
                points={guidePrices.map((p, i) => `${scale.x(i)},${scale.y(p)}`).join(' ')}
                fill="none"
                stroke="#6b6b6b"
                strokeWidth={10}
                strokeOpacity={0.35}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {empty && !guide && (
              <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={15} fill={COLORS.axisText}>
                Draw here, left to right
              </text>
            )}
            {stroke && (
              <polyline
                points={stroke}
                fill="none"
                stroke="#f2f2f2"
                strokeOpacity={result ? 0.18 : 0.9}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {result && <CandleLayer candles={result.candles} scale={scale} />}
            {hit && <ShapeLayer shapes={hit.shapes} candles={result!.candles} scale={scale} color="#d4d4d4" />}
          </svg>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setGuide((g) => !g)}
          aria-pressed={guide}
          className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft transition-colors hover:border-neutral-600 hover:text-white"
        >
          {guide ? 'Hide the guide' : 'Show a guide to trace'}
        </button>
        <button
          onClick={clear}
          disabled={empty}
          className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft transition-colors hover:border-neutral-600 hover:text-white disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      {problem && <p className="mt-4 text-[15px] leading-relaxed text-amber">{problem}</p>}

      {hit ? (
        <div className="mt-4 rounded-3xl border border-up/30 bg-up/[0.06] p-5">
          <p className="text-[17px] font-semibold text-up">The scanner sees a {entry.name.toLowerCase()}.</p>
          <p className="mt-2 text-[15px] leading-relaxed text-soft">{entry.meaning}</p>
          {others.length > 0 && <p className="mt-2 text-sm text-muted">It also saw: {others.join(', ')}.</p>}
          <button onClick={onNext} className="mt-4 h-12 rounded-2xl bg-up px-6 text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]">
            Next pattern
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-edge bg-card p-5">
          {result && (
            <>
              <p className="text-[17px] font-semibold">Not a {entry.name.toLowerCase()} yet.</p>
              <p className="mt-1 text-[15px] text-soft">
                {others.length
                  ? `The scanner saw: ${others.join(', ')}.`
                  : "The scanner didn't see any pattern. It reads the newest candles, so finish the shape near the right edge."}{' '}
                Draw over it to try again.
              </p>
            </>
          )}
          <p className={`text-[15px] leading-relaxed text-soft ${result ? 'mt-4' : ''}`}>
            <span className="font-semibold text-neutral-100">What to draw: </span>
            {entry.meaning}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Draw it big, in one stroke: small wiggles don't count as swings. Your line becomes {DRAW_CANDLES} candles, and the same
            scanner that reads the swipe cards looks at them.
          </p>
        </div>
      )}
    </>
  )
}
