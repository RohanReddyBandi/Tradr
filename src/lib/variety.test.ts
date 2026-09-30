import { describe, expect, it } from 'vitest'
import { makeRng } from './random'
import { BACKSTORIES, CHART_LENGTHS, plantPatterns, tellBackstory } from './variety'
import { generateCard, makeDealer } from './generator'
import { findCandlePatterns } from './candlePatterns'
import type { Waypoint } from './setupKit'
import type { Bar } from './signalCandles'

const R = 1.2

describe('tellBackstory', () => {
  // Falling into a pattern that starts at 100 (a double bottom, say), and rising into one.
  const falling: Waypoint[] = [{ at: 0, price: 118 }, { at: 30, price: 104 }, { at: 40, price: 100, touch: 'low' }]
  const rising: Waypoint[] = [{ at: 0, price: 92 }, { at: 30, price: 104 }, { at: 40, price: 110, touch: 'high' }]

  it('never goes past the point where the pattern begins', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const kind of BACKSTORIES) {
        const down = tellBackstory(kind, falling, makeRng(seed), R).waypoints
        const up = tellBackstory(kind, rising, makeRng(seed), R).waypoints
        for (const w of down.filter((w) => w.at > 0 && w.at < 30)) expect(w.price).toBeGreaterThan(104)
        for (const w of up.filter((w) => w.at > 0 && w.at < 30)) expect(w.price).toBeLessThan(104)
        // The pattern's own points are untouched and still in order.
        expect(down.slice(-2)).toEqual(falling.slice(1))
        expect(down.every((w, k) => k === 0 || w.at > down[k - 1].at)).toBe(true)
      }
    }
  })

  it('draws different shapes', () => {
    const shapes = new Set(BACKSTORIES.map((kind) => JSON.stringify(tellBackstory(kind, falling, makeRng(3), R).waypoints.map((w) => w.at))))
    expect(shapes.size).toBeGreaterThanOrEqual(8)
  })

  it('leaves short lead-ins alone', () => {
    const short: Waypoint[] = [{ at: 0, price: 118 }, { at: 8, price: 104 }]
    expect(tellBackstory('zigzag', short, makeRng(1), R).waypoints).toEqual(short)
  })

  it('lets a flat base wander, but never past a key low or high', () => {
    const intoLow: Waypoint[] = [{ at: 0, price: 104.5 }, { at: 30, price: 104, touch: 'low' }]
    const intoHigh: Waypoint[] = [{ at: 0, price: 104.5 }, { at: 30, price: 104, touch: 'high' }]
    let wandered = 0
    for (let seed = 1; seed <= 100; seed++) {
      for (const kind of ['swing', 'zigzag', 'chop'] as const) {
        const low = tellBackstory(kind, intoLow, makeRng(seed), R).waypoints.slice(1, -1)
        const high = tellBackstory(kind, intoHigh, makeRng(seed), R).waypoints.slice(1, -1)
        for (const w of low) expect(w.price).toBeGreaterThanOrEqual(104.5)
        for (const w of high) expect(w.price).toBeLessThanOrEqual(104)
        if (low.length) wandered++
      }
    }
    expect(wandered).toBeGreaterThan(200)
  })
})

describe('plantPatterns', () => {
  it('puts real, detectable candlestick patterns on turning points', () => {
    let planted = 0
    for (let seed = 1; seed <= 40; seed++) {
      // A slide into a low at candle 20, then a climb.
      const bars: Bar[] = Array.from({ length: 40 }, (_, i) => {
        const close = i <= 20 ? 120 - i : 100 + (i - 20) * 0.8
        const open = i === 0 ? close : i <= 20 ? close + 1 : close - 0.8
        return { open, close, high: Math.max(open, close) + 0.3, low: Math.min(open, close) - 0.3 }
      })
      const n = plantPatterns(bars, [{ at: 20, kind: 'bottom', room: Infinity }], 1, makeRng(seed), R, 35)
      planted += n
      if (n) {
        const found = findCandlePatterns(bars.map((b, i) => ({ ...b, time: i })), [20])
        expect(found.some((m) => m.pattern.bias === 'bullish')).toBe(true)
      }
    }
    expect(planted).toBeGreaterThan(25)
  })
})

describe('variety across the deck', () => {
  it('uses every chart length', () => {
    const lengths = new Set(Array.from({ length: 400 }, (_, i) => generateCard(i, i * 104729 + 3).candles.length))
    expect([...lengths].sort((a, b) => a - b)).toEqual(CHART_LENGTHS)
  })

  it('almost never deals two cards that look alike', () => {
    const deal = makeDealer(makeRng(11).next)
    const cards = Array.from({ length: 300 }, (_, i) => deal(i + 1))
    // Same setup, same direction, same length, and the same path (every fifth close, to the nearest 1%) would look alike.
    const looks = new Set(
      cards.map((c) => {
        const first = c.candles[0].close
        const shape = c.candles.filter((_, i) => i % 5 === 0).map((x) => Math.round(((x.close - first) / first) * 100))
        return `${c.setup.key}:${c.setup.bias}:${c.candles.length}:${shape.join(',')}`
      }),
    )
    expect(looks.size).toBeGreaterThanOrEqual(298)
    // And back-to-back cards differ in length most of the time.
    const sameLength = cards.filter((c, i) => i > 0 && c.candles.length === cards[i - 1].candles.length).length
    expect(sameLength / cards.length).toBeLessThan(0.3)
  })
})
