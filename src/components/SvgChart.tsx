import { useRef, type ReactNode } from 'react'
import type { Candle } from '../types'
import type { Projector } from './CandleChart'
import { CandleLayer } from './ChartLayers'
import { priceScale, useWidth, type Scale } from './chartScale'

// The price range to show: the one given, or every candle with a little room.
function fit(candles: Candle[], range?: { min: number; max: number }): [number, number] {
  if (range) return [range.min, range.max]
  const min = Math.min(...candles.map((c) => c.low))
  const max = Math.max(...candles.map((c) => c.high))
  const room = (max - min) * 0.06 || 1
  return [min - room, max + room]
}

interface Props {
  candles: Candle[]
  height: number
  label: string // describes the chart for screen readers
  slots?: number // candle positions across (more than candles.length leaves room on the right)
  range?: { min: number; max: number } // a fixed price range, so the chart doesn't jump
  dim?: (index: number) => boolean
  children?: (scale: Scale, width: number) => ReactNode // more SVG, drawn over the candles
  overlay?: (project: Projector) => ReactNode // HTML on top (draggable lines, drawing tools)
}

// A light candlestick chart in plain SVG that fills its container's width.
// The Learn lessons use it instead of the full chart library; `overlay`
// gets the same Projector as CandleChart's, so the trade setup's draggable
// lines and drawing tools work on it too.
export function SvgChart({ candles, height, label, slots, range, dim, children, overlay }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const scale = width > 0 ? priceScale(slots ?? candles.length, width, height, ...fit(candles, range)) : null
  const project: Projector | null = scale && {
    x: scale.x,
    y: scale.y,
    toPrice: scale.toPrice,
    toIndex: scale.toIndex,
    width,
    height,
  }

  return (
    <div ref={box} className="relative w-full" style={{ height }}>
      {scale && (
        <svg width={width} height={height} className="block" role="img" aria-label={label}>
          <CandleLayer candles={candles} scale={scale} dim={dim} />
          {children?.(scale, width)}
        </svg>
      )}
      {/* Like CandleChart's overlay: it ignores the mouse except where a drawing opts back in. */}
      {project && overlay && <div className="pointer-events-none absolute inset-0">{overlay(project)}</div>}
    </div>
  )
}
