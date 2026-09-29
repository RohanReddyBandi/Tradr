import type { Candle, Shape } from '../types'
import { COLORS } from '../theme'
import type { Scale } from './chartScale'

// Plain SVG chart pieces, shared by the Learn tab's small charts and the
// Practice drills. Positions come from a Scale (see chartScale.ts).

export function CandleLayer({ candles, scale, dim }: { candles: Candle[]; scale: Scale; dim?: (index: number) => boolean }) {
  const bodyWidth = Math.max(1.5, scale.slot * 0.6)
  return (
    <g>
      {candles.map((c, i) => {
        const color = c.close >= c.open ? COLORS.up : COLORS.down
        const top = scale.y(Math.max(c.open, c.close))
        const bottom = scale.y(Math.min(c.open, c.close))
        return (
          <g key={i} opacity={dim?.(i) ? 0.5 : 1}>
            <line x1={scale.x(i)} y1={scale.y(c.high)} x2={scale.x(i)} y2={scale.y(c.low)} stroke={color} strokeWidth={1} />
            <rect x={scale.x(i) - bodyWidth / 2} y={top} width={bodyWidth} height={Math.max(1, bottom - top)} fill={color} />
          </g>
        )
      })}
    </g>
  )
}

// Chart-pattern markup: grey lines, levels, dots, and curves; yellow candle boxes.
export function ShapeLayer({ shapes, candles, scale, color = COLORS.chalk }: { shapes: Shape[]; candles: Candle[]; scale: Scale; color?: string }) {
  const { x, y, slot } = scale
  return (
    <g>
      {shapes.map((s, k) => {
        switch (s.kind) {
          case 'line':
            return <line key={k} x1={x(s.from.index)} y1={y(s.from.price)} x2={x(s.to.index)} y2={y(s.to.price)} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.9} />
          case 'level':
            return <line key={k} x1={x(s.fromIndex)} y1={y(s.price)} x2={x(s.toIndex)} y2={y(s.price)} stroke={color} strokeWidth={1.25} strokeDasharray="5 4" />
          case 'dot':
            return <circle key={k} cx={x(s.at.index)} cy={y(s.at.price)} r={3} fill={COLORS.card} stroke={color} strokeWidth={1.5} />
          case 'curve':
            return (
              <path
                key={k}
                d={s.points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.index)} ${y(p.price)}`).join(' ')}
                fill="none"
                stroke={color}
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
    </g>
  )
}
