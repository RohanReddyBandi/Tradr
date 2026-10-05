import { useRef, type ReactNode } from 'react'
import type { Candle } from '../types'
import type { Note, Role } from '../lib/annotate'
import type { Projector } from './CandleChart'
import { CandleLayer } from './ChartLayers'
import { useWidth, type Scale } from './chartScale'
import { COLORS, LEARN, MONO_FONT } from '../theme'

// The Learn tab's chart: candles in the textbook style, with a price axis,
// volume underneath, an optional glowing title, and annotations (support in
// blue, resistance in amber, numbered swing points, a target, a breakout
// arrow). Everything is plain SVG, sized to its container.

interface Props {
  candles: Candle[] // what's on screen
  slots?: number // candle positions across (room on the right for a replay)
  range?: { min: number; max: number } // fixed price range, so a replay doesn't jump
  notes?: Note[]
  volume?: number[] // one per candle (indexes match `candles`); omitted: no volume
  height: number
  title?: string // '' reserves the room without showing anything yet
  compact?: boolean // small thumbnails: no axis, quieter labels
  shadeFrom?: number // shade the replay zone from this candle position on
  label: string // for screen readers
  overlay?: (project: Projector) => ReactNode // drawing tools on top of the price area
  bodyWidth?: number // candle bodies this many pixels wide (default: 60% of a slot)
  children?: (scale: Scale, plotWidth: number) => ReactNode // extra SVG over the candles
}

const AXIS = 56 // px for the price labels on the right

const ROLE_COLOR: Record<Role, string> = {
  support: LEARN.support,
  resistance: LEARN.resistance,
  neckline: LEARN.resistance,
  trend: LEARN.support,
  pole: '#7a7a7a',
  target: LEARN.target,
}
const ROLE_DASH: Partial<Record<Role, string>> = { resistance: '8 6', neckline: '8 6', target: '2 5', pole: '3 4' }

// Round numbers for the price axis.
function ticks(min: number, max: number, count = 5) {
  const raw = (max - min) / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let p = Math.ceil(min / step) * step; p <= max; p += step) out.push(p)
  return out
}

export function AnnotatedChart({ candles, slots, range, notes = [], volume, height, title, compact, shadeFrom, label, overlay, bodyWidth, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const axis = compact ? 0 : AXIS
  const plot = Math.max(0, width - axis)
  const volumeBand = volume ? Math.round(height * (compact ? 0.14 : 0.16)) : 0
  const priceHeight = height - volumeBand
  // Room above and below the candles for the numbered markers and labels.
  // (An empty title still keeps its space, so a chart that gets its title later doesn't shift.)
  const top = title !== undefined ? (compact ? 26 : 62) : compact ? 18 : 24
  const bottom = compact ? 16 : 30
  const padX = compact ? 6 : 10

  // The price range: given, or every candle and annotated price with a little room.
  const prices = [
    ...candles.flatMap((c) => [c.low, c.high]),
    ...notes.flatMap((n) => (n.kind === 'hline' ? [n.price] : n.kind === 'line' ? [n.from.price, n.to.price] : [])),
  ]
  const lo = range?.min ?? Math.min(...prices)
  const hi = range?.max ?? Math.max(...prices)
  const room = range ? 0 : (hi - lo) * 0.05 || 1
  const min = lo - room
  const max = hi + room
  const count = slots ?? candles.length
  const slot = (plot - padX * 2) / Math.max(1, count)
  const scale: Scale = {
    slot,
    x: (i) => padX + (i + 0.5) * slot,
    y: (p) => top + ((max - p) / (max - min)) * (priceHeight - top - bottom),
    toPrice: (py) => max - ((py - top) / (priceHeight - top - bottom)) * (max - min),
    toIndex: (px) => (px - padX) / slot - 0.5,
  }
  const { x, y } = scale
  const project: Projector = { x, y, toPrice: scale.toPrice, toIndex: scale.toIndex, width: plot, height: priceHeight }
  const maxVolume = volume ? Math.max(...volume.slice(0, candles.length), 0.0001) : 1
  const fontSize = compact ? 9 : 11

  return (
    <div ref={box} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="block" role="img" aria-label={label}>
          {/* Grid and price axis */}
          {!compact &&
            ticks(min, max).map((p) => (
              <g key={p}>
                <line x1={0} x2={plot} y1={y(p)} y2={y(p)} stroke={COLORS.grid} strokeOpacity={0.55} />
                <text x={width - 6} y={y(p) + 4} textAnchor="end" fontSize={11} fontFamily={MONO_FONT} fill={COLORS.axisText}>
                  {p >= 1000 ? p.toFixed(0) : p.toFixed(2)}
                </text>
              </g>
            ))}

          {shadeFrom !== undefined && <rect x={x(shadeFrom - 0.5)} y={0} width={Math.max(0, plot - x(shadeFrom - 0.5))} height={height} fill="#ffffff" opacity={0.03} />}

          {/* Volume */}
          {volume &&
            candles.map((c, i) => {
              const h = (volume[i] / maxVolume) * (volumeBand - 4)
              return (
                <rect
                  key={i}
                  x={x(i) - Math.max(1, slot * 0.32)}
                  y={height - h}
                  width={Math.max(1.5, slot * 0.64)}
                  height={h}
                  fill={c.close >= c.open ? COLORS.up : COLORS.down}
                  opacity={0.4}
                />
              )
            })}

          <CandleLayer candles={candles} scale={scale} body={bodyWidth} />
          <NoteLayer notes={notes} scale={scale} plot={plot} height={height} compact={!!compact} fontSize={fontSize} candles={candles} />
          {children?.(scale, plot)}
        </svg>
      )}
      {title && width > 0 && (
        <div
          className={`pointer-events-none absolute inset-x-0 px-4 text-center font-bold tracking-[0.05em] text-[#e4e9f1]/90 uppercase ${compact ? 'top-1.5 text-[12px]' : 'top-3.5 text-[19px] lg:text-[23px]'}`}
          style={{ textShadow: '0 0 12px rgba(110,180,255,0.3)', width: plot }}
        >
          {title}
        </div>
      )}
      {overlay && width > 0 && <div className="pointer-events-none absolute inset-0">{overlay(project)}</div>}
    </div>
  )
}

interface LayerProps {
  notes: Note[]
  scale: Scale
  plot: number
  height: number
  compact: boolean
  fontSize: number
  candles: Candle[]
}

interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

// Draws the annotations. Lines, markers, and arrows go where their prices say;
// labels then look for a free spot along their line (above it first, then
// below), so they never sit on a numbered marker or on each other.
function NoteLayer({ notes, scale, plot, height, compact, fontSize, candles }: LayerProps) {
  const { x, y, slot } = scale
  const right = (to: number) => Math.min(plot - 2, x(to) + slot / 2)
  const caps = { fontSize, fontWeight: 700, letterSpacing: '0.06em' } as const
  const textWidth = (text: string) => text.length * fontSize * 0.72 + 6

  // Everything a label must keep clear of: markers, arrows, and labels already placed.
  const r = compact ? 6 : 9.5
  const markerY = (n: Extract<Note, { kind: 'marker' }>) => y(n.at.price) + (n.place === 'below' ? r + 7 : -(r + 7))
  const taken: Box[] = notes.flatMap((n): Box[] => {
    if (n.kind === 'marker') {
      const cx = x(n.at.index)
      const cy = markerY(n)
      return [{ left: cx - r - 2, right: cx + r + 2, top: cy - r - 2, bottom: cy + r + 2 }]
    }
    if (n.kind === 'arrow') {
      const cx = x(n.at.index) + Math.max(10, slot * 1.1)
      const tip = y(n.at.price)
      return [{ left: cx - 8, right: cx + 8, top: Math.min(tip, tip + (n.dir === 'up' ? 28 : -28)), bottom: Math.max(tip, tip + (n.dir === 'up' ? 28 : -28)) }]
    }
    return []
  })

  // Try each spot in turn; the first one that's clear (and on the chart) wins.
  function place(text: string, spots: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }[]) {
    const w = textWidth(text)
    for (const spot of spots) {
      const left = spot.anchor === 'middle' ? spot.x - w / 2 : spot.anchor === 'end' ? spot.x - w : spot.x
      const box = { left, right: left + w, top: spot.y - fontSize, bottom: spot.y + 3 }
      if (left < 2 || left + w > plot - 2 || box.top < 2) continue
      if (taken.some((t) => overlaps(t, box))) continue
      taken.push(box)
      return spot
    }
    return null // nowhere clear: leave the label off rather than pile it on top of something
  }

  const labels: ReactNode[] = []
  const shapes = notes.map((n, k) => {
    switch (n.kind) {
      case 'vline':
        return <line key={k} x1={x(n.index)} x2={x(n.index)} y1={0} y2={height} stroke={LEARN.now} strokeOpacity={0.55} strokeDasharray="4 5" />
      case 'curve':
        return (
          <polyline
            key={k}
            points={n.points.map((p) => `${x(p.index)},${y(p.price)}`).join(' ')}
            fill="none"
            stroke={COLORS.chalk}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.8}
          />
        )
      case 'hline': {
        const color = ROLE_COLOR[n.role]
        const target = n.role === 'target'
        const x1 = target ? 0 : x(n.from) - slot / 2
        const x2 = right(n.to)
        const py = y(n.price)
        const text = n.label?.toUpperCase()
        if (text && !compact) {
          const along = (f: number) => x1 + (x2 - x1) * f
          const spot = target
            ? place(text, [
                { x: x2 - 4, y: py - 7, anchor: 'end' },
                { x: x2 - 4, y: py + fontSize + 5, anchor: 'end' },
              ])
            : place(text, [
                ...[0.5, 0.3, 0.7, 0.15, 0.85].map((f) => ({ x: along(f), y: py - 7, anchor: 'middle' as const })),
                ...[0.5, 0.3, 0.7].map((f) => ({ x: along(f), y: py + fontSize + 5, anchor: 'middle' as const })),
              ])
          if (spot)
            labels.push(
              <text key={`l${k}`} x={spot.x} y={spot.y} textAnchor={spot.anchor} fill={color} opacity={target ? 0.8 : 1} stroke={COLORS.base} strokeWidth={3} paintOrder="stroke" {...caps} fontWeight={target ? 600 : 700}>
                {text}
              </text>,
            )
        }
        return (
          <line
            key={k}
            x1={x1}
            x2={x2}
            y1={py}
            y2={py}
            stroke={color}
            strokeWidth={target ? 1.4 : 2}
            strokeOpacity={target ? 0.65 : 1}
            strokeDasharray={ROLE_DASH[n.role]}
            strokeLinecap="round"
          />
        )
      }
      case 'line': {
        const color = ROLE_COLOR[n.role]
        const text = n.label?.toUpperCase()
        const [a, b] = n.from.index <= n.to.index ? [n.from, n.to] : [n.to, n.from]
        if (text && !compact) {
          const at = (f: number) => ({ px: x(a.index) + (x(b.index) - x(a.index)) * f, py: y(a.price) + (y(b.price) - y(a.price)) * f })
          const spot = place(
            text,
            [0.15, 0.4, 0.65, 0.85].flatMap((f) => {
              const { px, py } = at(f)
              return [
                { x: px, y: py - 8, anchor: 'middle' as const },
                { x: px, y: py + fontSize + 6, anchor: 'middle' as const },
              ]
            }),
          )
          if (spot)
            labels.push(
              <text key={`l${k}`} x={spot.x} y={spot.y} textAnchor={spot.anchor} fill={color} stroke={COLORS.base} strokeWidth={3} paintOrder="stroke" {...caps}>
                {text}
              </text>,
            )
        }
        return (
          <line
            key={k}
            x1={x(a.index)}
            y1={y(a.price)}
            x2={x(b.index)}
            y2={y(b.price)}
            stroke={color}
            strokeWidth={n.role === 'pole' ? 1.5 : 2}
            strokeDasharray={ROLE_DASH[n.role]}
            strokeLinecap="round"
          />
        )
      }
      case 'marker': {
        const cy = markerY(n)
        if (n.caption && !compact) {
          const below = n.place === 'below'
          const spot = place(n.caption.toUpperCase(), [
            { x: x(n.at.index), y: below ? cy + r + 12 : cy - r - 5, anchor: 'middle' },
            { x: x(n.at.index) + r + 4, y: cy + 4, anchor: 'start' },
            { x: x(n.at.index) - r - 4, y: cy + 4, anchor: 'end' },
          ])
          if (spot)
            labels.push(
              <text key={`l${k}`} x={spot.x} y={spot.y} textAnchor={spot.anchor} fill="#cfd8ea" stroke={COLORS.base} strokeWidth={3} paintOrder="stroke" {...caps} fontSize={fontSize - 1}>
                {n.caption.toUpperCase()}
              </text>,
            )
        }
        return (
          <g key={k}>
            <circle cx={x(n.at.index)} cy={cy} r={r} fill={LEARN.marker} stroke={COLORS.base} strokeWidth={1.5} />
            <text x={x(n.at.index)} y={cy + (compact ? 3 : 3.8)} textAnchor="middle" fontSize={compact ? 8 : 11} fontWeight={700} fill="#ffffff">
              {n.n}
            </text>
          </g>
        )
      }
      case 'box': {
        const slice = candles.slice(n.from, n.to + 1)
        if (!slice.length) return null
        const top = y(Math.max(...slice.map((c) => c.high))) - 5
        const bottom = y(Math.min(...slice.map((c) => c.low))) + 5
        const left = x(n.from) - slot / 2 - 2
        const boxRight = x(n.to) + slot / 2 + 2
        taken.push({ left, right: boxRight, top, bottom })
        if (n.label && !compact) {
          const middle = (left + boxRight) / 2
          const text = n.label.toUpperCase()
          // Opposite the numbered markers first (they sit under lows on bullish charts, over highs on bearish ones).
          const above = { x: middle, y: top - 7, anchor: 'middle' as const }
          const below = { x: middle, y: bottom + fontSize + 4, anchor: 'middle' as const }
          const spot = place(text, [
            ...(n.bias === 'bearish' ? [below, above] : [above, below]),
            { x: left - 6, y: (top + bottom) / 2 + 4, anchor: 'end' },
            { x: middle, y: top - 7 - fontSize - 6, anchor: 'middle' },
            { x: middle, y: bottom + 2 * fontSize + 10, anchor: 'middle' },
          ])
          if (spot)
            labels.push(
              <text key={`l${k}`} x={spot.x} y={spot.y} textAnchor={spot.anchor} fill={COLORS.marker} stroke={COLORS.base} strokeWidth={3} paintOrder="stroke" {...caps}>
                {text}
              </text>,
            )
        }
        return <rect key={k} x={left} y={top} width={boxRight - left} height={bottom - top} rx={4} fill={COLORS.marker} fillOpacity={0.08} stroke={COLORS.marker} strokeWidth={1.5} />
      }
      case 'tag': {
        // The pattern's name, in the chalk colour of the pattern's own markup.
        if (compact) return null
        const text = n.text.toUpperCase()
        const ax = x(n.at.index)
        const ay = y(n.at.price)
        const spot = place(text, [
          { x: ax, y: ay - 12, anchor: 'middle' },
          { x: ax, y: ay - 12 - fontSize - 8, anchor: 'middle' },
          { x: ax, y: ay + fontSize + 14, anchor: 'middle' },
          { x: ax - 40, y: ay - 12, anchor: 'middle' },
          { x: ax + 40, y: ay - 12, anchor: 'middle' },
        ])
        if (spot)
          labels.push(
            <text key={`l${k}`} x={spot.x} y={spot.y} textAnchor={spot.anchor} fill="#dcdcdc" stroke={COLORS.base} strokeWidth={3.5} paintOrder="stroke" {...caps} fontSize={fontSize + 1}>
              {text}
            </text>,
          )
        return null
      }
      case 'arrow': {
        const up = n.dir === 'up'
        const cx = x(n.at.index) + Math.max(10, slot * 1.1)
        const tip = y(n.at.price) + (up ? -2 : 2)
        const tail = tip + (up ? 26 : -26)
        const color = up ? COLORS.up : COLORS.down
        return (
          <path
            key={k}
            d={`M ${cx} ${tail} L ${cx} ${tip} M ${cx - 6} ${tip + (up ? 7 : -7)} L ${cx} ${tip} L ${cx + 6} ${tip + (up ? 7 : -7)}`}
            stroke={color}
            strokeWidth={compact ? 2 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )
      }
    }
  })

  // Labels last, so they sit on top of every line.
  return (
    <g>
      {shapes}
      {labels}
    </g>
  )
}
