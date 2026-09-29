import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Logical,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '../types'
import { COLORS, MONO_FONT } from '../theme'

// Converts chart positions (candle index, price) to pixels, for drawing on top.
export interface Projector {
  x: (index: number) => number | null
  y: (price: number) => number | null
  toPrice: (y: number) => number | null // the other way: pixel height to price
  width: number // drawing area, not counting the price axis
  height: number
}

interface Props {
  candles: Candle[]
  // Total candle positions on the x-axis. Extra positions stay empty, which
  // makes room for the replay to fill in. Defaults to candles.length.
  slots?: number
  // Lock the price axis to this range so it doesn't jump around mid-replay.
  priceRange?: { min: number; max: number }
  // Anything to draw on top of the chart (the Breakdown markup).
  overlay?: (project: Projector) => ReactNode
  label?: string // describes the chart for screen readers
}

// A bare candlestick chart: black background, green/red candles, a dashed
// price grid, and nothing else. No dates, crosshair, or labels that could
// give hints.
export function CandleChart({ candles, slots, priceRange, overlay, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // The chart library's handles, once the chart exists.
  const [api, setApi] = useState<{ chart: IChartApi; series: ISeriesApi<'Candlestick'> } | null>(null)
  // Bumped whenever the chart moves or resizes, so the overlay redraws.
  const [, setLayoutVersion] = useState(0)

  // Create the chart once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      autoSize: true, // resize with the container
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' }, // the card shows through
        textColor: COLORS.axisText,
        fontFamily: MONO_FONT,
        fontSize: 11,
        attributionLogo: false, // credited on the Stats page instead
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: COLORS.grid, style: LineStyle.LargeDashed },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 },
        tickMarkDensity: 5, // fewer price labels (the default is 2.5)
        entireTextOnly: true, // skip labels that would be cut off at the edges
      },
      timeScale: { visible: false, rightOffset: 2, lockVisibleTimeRangeOnResize: true },
      crosshair: { mode: CrosshairMode.Hidden },
      // Cards are dragged with the finger, so the chart itself must not pan or zoom.
      handleScroll: false,
      handleScale: false,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      borderVisible: false,
      priceLineVisible: false, // no dotted line at the last price
      lastValueVisible: false, // no last-price tag on the axis
    })
    setApi({ chart, series })

    // The overlay's pixel positions are only right after the chart has laid
    // itself out, so redraw it a frame after any size change.
    const redraw = () => requestAnimationFrame(() => setLayoutVersion((v) => v + 1))
    chart.timeScale().subscribeSizeChange(redraw)
    const observer = new ResizeObserver(redraw)
    observer.observe(container)

    // Axis text is painted with whatever font is loaded right now; Geist Mono
    // may still be on its way, so repaint once it arrives.
    let removed = false
    document.fonts.load(`11px ${MONO_FONT}`).then(() => {
      if (!removed) chart.applyOptions({ layout: { fontFamily: MONO_FONT } })
    })

    return () => {
      removed = true
      observer.disconnect()
      chart.remove()
      setApi(null)
    }
  }, [])

  // Load (or reload) the candles.
  useEffect(() => {
    if (!api) return
    const { chart, series } = api

    series.applyOptions({
      autoscaleInfoProvider: priceRange
        ? () => ({ priceRange: { minValue: priceRange.min, maxValue: priceRange.max } })
        : undefined,
    })
    series.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })))
    if (slots) chart.timeScale().setVisibleLogicalRange({ from: -1, to: slots + 1 })
    else chart.timeScale().fitContent()
    requestAnimationFrame(() => setLayoutVersion((v) => v + 1))
  }, [api, candles, slots, priceRange])

  // The chart library only converts whole candle positions, so for in-between
  // spots (like the gap between two candles) we blend the two neighbours.
  function xAt(position: number) {
    if (!api) return null
    const toX = (i: number) => api.chart.timeScale().logicalToCoordinate(i as Logical)
    const left = Math.floor(position)
    const a = toX(left)
    const b = toX(left + 1)
    if (a === null || b === null) return a
    return a + (b - a) * (position - left)
  }

  const project: Projector | null =
    api && overlay
      ? {
          x: xAt,
          y: (price) => api.series.priceToCoordinate(price),
          toPrice: (y) => api.series.coordinateToPrice(y),
          // (Not timeScale().width(): the time axis is hidden, so that reports 0.)
          width: api.chart.paneSize(0).width,
          height: api.chart.paneSize(0).height,
        }
      : null

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} role="img" aria-label={label ?? `Candlestick chart of ${candles.length} daily candles`} className="h-full w-full" />
      {/* z-10 lifts the drawing above the chart's own canvases. It ignores the
          mouse except where a drawing opts back in (like the draggable lines). */}
      {project && project.width > 0 && <div className="pointer-events-none absolute inset-0 z-10">{overlay?.(project)}</div>}
    </div>
  )
}
