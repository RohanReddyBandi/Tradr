import type { Candle } from '../types'

// A swing point: a local high or low that price clearly turned away from.
export interface Pivot {
  index: number
  price: number
  kind: 'high' | 'low'
  confirmed: boolean // false for the newest one: price may still be extending it
}

// Find the swing points with a "zigzag": follow price up until it falls at
// least `minMove` from its best high (that high becomes a pivot), then follow
// it down until it rises `minMove` from its lowest low, and so on. Wiggles
// smaller than `minMove` are ignored, which is what keeps noise out.
export function findPivots(candles: Candle[], minMove: number): Pivot[] {
  const pivots: Pivot[] = []
  if (candles.length === 0) return pivots

  let direction: 'up' | 'down' | null = null // which way the current leg is going
  let high = { index: 0, price: candles[0].high } // best high of the current leg
  let low = { index: 0, price: candles[0].low } // best low of the current leg

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]

    if (direction === null) {
      // Before the first swing we track both extremes until one side wins.
      if (c.high > high.price) high = { index: i, price: c.high }
      if (c.low < low.price) low = { index: i, price: c.low }
      if (high.price - low.price >= minMove) {
        if (high.index > low.index) {
          pivots.push({ ...low, kind: 'low', confirmed: true })
          direction = 'up'
        } else {
          pivots.push({ ...high, kind: 'high', confirmed: true })
          direction = 'down'
        }
      }
    } else if (direction === 'up') {
      if (c.high >= high.price) {
        high = { index: i, price: c.high } // the leg keeps climbing
      } else if (high.price - c.low >= minMove) {
        pivots.push({ ...high, kind: 'high', confirmed: true }) // it turned: that high was a swing high
        direction = 'down'
        low = { index: i, price: c.low }
      }
    } else {
      if (c.low <= low.price) {
        low = { index: i, price: c.low }
      } else if (c.high - low.price >= minMove) {
        pivots.push({ ...low, kind: 'low', confirmed: true })
        direction = 'up'
        high = { index: i, price: c.high }
      }
    }
  }

  // The leg still in progress ends at its best price so far. It isn't
  // confirmed, but patterns that finish on the latest candles need it.
  if (direction === 'up') pivots.push({ ...high, kind: 'high', confirmed: false })
  if (direction === 'down') pivots.push({ ...low, kind: 'low', confirmed: false })
  return pivots
}
