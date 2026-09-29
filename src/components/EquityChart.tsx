import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { COLORS } from '../theme'
import { formatMoney } from '../format'

interface Props {
  equity: number[] // balance before any trade, then after each trade
  start: number // the starting balance (gains are green above it, red below)
}

const HEIGHT = 250
const PAD = { top: 14, right: 14, bottom: 28, left: 54 }

// "$10.4k"
const short = (n: number) => `$${(n / 1000).toFixed(1)}k`

// Round axis steps: 100, 200, 250, 500, 1000, ...
function niceStep(range: number) {
  const rough = range / 3
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough)
  return step ?? 10 * power
}

// A smooth curve through the points that never overshoots them (a
// "monotone cubic"), so a peak on the line is always a real balance.
function smoothPath(points: { x: number; y: number }[]) {
  const n = points.length
  if (n < 2) return ''
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    slope.push((points[i + 1].y - points[i].y) / dx[i])
  }
  // How steep the curve is at each point. Flat at peaks and dips (where the
  // slope changes sign), which is what stops it overshooting.
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0]
    if (i === n - 1) return slope[n - 2]
    if (slope[i - 1] * slope[i] <= 0) return 0
    return (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i])
  })
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3
    d += ` C ${points[i].x + third} ${points[i].y + tangent[i] * third}, ${points[i + 1].x - third} ${points[i + 1].y - tangent[i + 1] * third}, ${points[i + 1].x} ${points[i + 1].y}`
  }
  return d
}

// Your balance after each trade, with a crosshair and tooltip on hover (or
// with the arrow keys once the chart is focused).
export function EquityChart({ equity, start }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [active, setActive] = useState<number | null>(null) // which trade the crosshair is on

  // Measure the available width, and again whenever it changes.
  useEffect(() => {
    if (!box.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [])

  // The y-axis: round numbers a little beyond the lowest and highest balance.
  const low = Math.min(...equity, start)
  const high = Math.max(...equity, start)
  const step = niceStep(Math.max(high - low, 200))
  const yMin = Math.floor(low / step) * step
  const yMax = Math.ceil(high / step) * step
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + 1e-6; v += step) yTicks.push(v)

  const last = equity.length - 1
  const plotWidth = width - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (last === 0 ? 0 : (i / last) * plotWidth)
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin || 1)) * plotHeight

  // The x-axis: trade 1, a few in between, and the latest.
  const every = Math.max(1, Math.round(last / 4))
  const xTicks = [...new Set([1, ...Array.from({ length: 4 }, (_, k) => 1 + every * (k + 1)).filter((t) => t < last), last])].filter(
    (t) => t >= 1 && t <= last && (t === last || last - t >= every / 2),
  )

  const points = equity.map((v, i) => ({ x: x(i), y: y(v) }))

  function track(event: PointerEvent<SVGSVGElement>) {
    const left = event.currentTarget.getBoundingClientRect().left
    const i = Math.round(((event.clientX - left - PAD.left) / plotWidth) * last)
    setActive(Math.min(last, Math.max(0, i)))
  }

  function nudge(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const from = active ?? last
    setActive(Math.min(last, Math.max(0, from + (event.key === 'ArrowRight' ? 1 : -1))))
  }

  const shown = active ?? null
  const tooltipLeft = shown === null ? 0 : Math.min(Math.max(x(shown) + 12, PAD.left), width - 132)

  return (
    <div ref={box} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        tabIndex={0}
        role="img"
        aria-label={`Balance over ${last} trades, from ${formatMoney(equity[0])} to ${formatMoney(equity[last])}. Use the arrow keys to step through trades.`}
        onPointerMove={track}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(last)}
        onBlur={() => setActive(null)}
        onKeyDown={nudge}
        className="block touch-pan-y rounded-lg outline-offset-4"
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={COLORS.grid} strokeDasharray="4 4" />
            <text x={PAD.left - 10} y={y(v) + 4} textAnchor="end" fill={COLORS.axisText} fontSize={11} fontFamily="var(--font-mono)">
              {short(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={HEIGHT - 6} textAnchor="middle" fill={COLORS.axisText} fontSize={11} fontFamily="var(--font-mono)">
            {t}
          </text>
        ))}

        <path d={smoothPath(points)} fill="none" stroke={COLORS.equity} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* The latest balance, with a ring in the card color so it reads over the line. */}
        <circle cx={x(last)} cy={y(equity[last])} r={4} fill={COLORS.equity} stroke={COLORS.card} strokeWidth={2} />

        {shown !== null && (
          <g>
            <line x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#d9d9d9" strokeWidth={1} />
            <circle cx={x(shown)} cy={y(equity[shown])} r={5} fill={COLORS.equity} stroke="#f2f2f2" strokeWidth={2} />
          </g>
        )}
      </svg>

      {shown !== null && (
        <div
          className="pointer-events-none absolute rounded-xl border border-neutral-700 bg-base px-3 py-2"
          style={{ left: tooltipLeft, top: Math.max(0, y(equity[shown]) - 64) }}
        >
          <div className={`font-mono text-[15px] font-medium ${equity[shown] >= start ? 'text-up' : 'text-down'}`}>
            {formatMoney(equity[shown])}
          </div>
          <div className="text-xs text-muted">{shown === 0 ? 'Starting balance' : `After trade ${shown}`}</div>
        </div>
      )}

      {/* The same numbers as a table, for screen readers and anyone who wants them exact. */}
      <details className="mt-2 text-sm text-muted">
        <summary className="cursor-pointer select-none hover:text-soft">View as table</summary>
        <table className="mt-2 w-full max-w-sm font-mono text-[13px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-normal">Trade</th>
              <th className="py-1 text-right font-normal">Balance</th>
            </tr>
          </thead>
          <tbody>
            {equity.map((v, i) => (
              <tr key={i} className="border-t border-edge text-soft">
                <td className="py-1">{i === 0 ? 'Start' : i}</td>
                <td className="py-1 text-right tabular-nums">{formatMoney(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
