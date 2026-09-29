import type { Candle, Shape } from '../types'
import { CandleLayer, ShapeLayer } from './ChartLayers'
import { fitScale, shapePrices } from './chartScale'

interface Props {
  candles: Candle[]
  shapes: Shape[]
  label: string // describes the chart for screen readers
}

const W = 320
const H = 128

// A small, static candlestick chart drawn straight into SVG. The Learn tab
// shows dozens of these, which would be far too heavy with the full chart library.
export function MiniChart({ candles, shapes, label }: Props) {
  const scale = fitScale(candles, W, H, shapePrices(shapes))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
      <CandleLayer candles={candles} scale={scale} />
      <ShapeLayer shapes={shapes} candles={candles} scale={scale} />
    </svg>
  )
}
