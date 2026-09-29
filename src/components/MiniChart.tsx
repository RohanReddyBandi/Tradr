import type { Candle, Shape } from '../types'
import { COLORS } from '../theme'

interface Props {
  candles: Candle[]
  shapes: Shape[]
  label: string // describes the chart for screen readers
}

const W = 320
const H = 128
const PAD = 8

// A small, static candlestick chart drawn straight into SVG. The Learn tab
// shows dozens of these, which would be far too heavy with the full chart library.
export function MiniChart({ candles, shapes, label }: Props) {
  // The price range to fit: every candle plus anything drawn on top.
  const prices = candles.flatMap((c) => [c.low, c.high])
  for (const s of shapes) {
    if (s.kind === 'level') prices.push(s.price)
    if (s.kind === 'line') prices.push(s.from.price, s.to.price)
  }
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const pad = (max - min) * 0.06

  const slot = (W - PAD * 2) / candles.length // horizontal room per candle
  const x = (index: number) => PAD + (index + 0.5) * slot
  const y = (price: number) => PAD + ((max + pad - price) / (max - min + pad * 2)) * (H - PAD * 2)
  const bodyWidth = Math.max(1.5, slot * 0.6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
      {candles.map((c, i) => {
        const color = c.close >= c.open ? COLORS.up : COLORS.down
        const top = y(Math.max(c.open, c.close))
        const bottom = y(Math.min(c.open, c.close))
        return (
          <g key={i}>
            <line x1={x(i)} y1={y(c.high)} x2={x(i)} y2={y(c.low)} stroke={color} strokeWidth={1} />
            <rect x={x(i) - bodyWidth / 2} y={top} width={bodyWidth} height={Math.max(1, bottom - top)} fill={color} />
          </g>
        )
      })}

      {shapes.map((s, k) => {
        switch (s.kind) {
          case 'line':
            return <line key={k} x1={x(s.from.index)} y1={y(s.from.price)} x2={x(s.to.index)} y2={y(s.to.price)} stroke={COLORS.chalk} strokeWidth={2} strokeLinecap="round" opacity={0.9} />
          case 'level':
            return <line key={k} x1={x(s.fromIndex)} y1={y(s.price)} x2={x(s.toIndex)} y2={y(s.price)} stroke={COLORS.chalk} strokeWidth={1.25} strokeDasharray="5 4" />
          case 'dot':
            return <circle key={k} cx={x(s.at.index)} cy={y(s.at.price)} r={3} fill={COLORS.card} stroke={COLORS.chalk} strokeWidth={1.5} />
          case 'curve':
            return (
              <path
                key={k}
                d={s.points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.index)} ${y(p.price)}`).join(' ')}
                fill="none"
                stroke={COLORS.chalk}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            )
          case 'candles': {
            const slice = candles.slice(s.fromIndex, s.toIndex + 1)
            const top = y(Math.max(...slice.map((c) => c.high))) - 4
            const bottom = y(Math.min(...slice.map((c) => c.low))) + 4
            const left = x(s.fromIndex) - slot / 2 - 2
            const right = x(s.toIndex) + slot / 2 + 2
            return <rect key={k} x={left} y={top} width={right - left} height={bottom - top} rx={4} fill={COLORS.marker} fillOpacity={0.08} stroke={COLORS.marker} strokeWidth={1.5} />
          }
        }
      })}
    </svg>
  )
}
