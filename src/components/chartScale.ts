import { useEffect, useState, type RefObject } from 'react'
import type { Candle, Shape } from '../types'

// Turning chart positions into pixels for the plain SVG charts (ChartLayers.tsx).
// `x` turns a candle position into pixels, `y` a price.
export interface Scale {
  x: (index: number) => number
  y: (price: number) => number
  slot: number // horizontal room per candle, in pixels
}

// A price-to-pixel scale that fits the candles (and any extra prices) into a box.
export function fitScale(candles: Candle[], width: number, height: number, extra: number[] = [], pad = 8): Scale {
  const prices = [...candles.flatMap((c) => [c.low, c.high]), ...extra]
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const room = (max - min) * 0.06 || 1
  return priceScale(candles.length, width, height, min - room, max + room, pad)
}

// A scale with a fixed price range (so it doesn't jump while you drag).
// `count` is how many candle slots fit across; it can include a fraction of
// a slot of empty space.
export function priceScale(count: number, width: number, height: number, min: number, max: number, pad = 8): Scale {
  const slot = (width - pad * 2) / count
  return {
    slot,
    x: (index) => pad + (index + 0.5) * slot,
    y: (price) => pad + ((max - price) / (max - min)) * (height - pad * 2),
  }
}

// Every price a shape reaches, so a chart can make room for it.
export function shapePrices(shapes: Shape[]): number[] {
  return shapes.flatMap((s) => {
    if (s.kind === 'level') return [s.price]
    if (s.kind === 'line') return [s.from.price, s.to.price]
    return []
  })
}

// The width of an element in pixels, kept up to date as it resizes. Drawing
// at the real size keeps lines and handles the same size on every screen.
export function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
