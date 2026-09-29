import { describe, expect, it } from 'vitest'
import type { Candle } from '../types'
import { findChartPatterns, pickChartPatterns } from './chartPatterns'
import { generateCard, pathThrough } from './generator'
import { makeRng } from './random'
import { SCANNER_MATCHES } from './setups'

// Candles that trace straight lines through [index, price] points, with no
// randomness: each candle opens at the last close and has small fixed wicks.
function shape(points: [number, number][]): Candle[] {
  const closes = pathThrough(points.map(([at, price]) => ({ at, price })), makeRng(1), 0)
  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1]
    return { time: i, open, close, high: Math.max(open, close) + 0.3, low: Math.min(open, close) - 0.3 }
  })
}

// The same shape upside down (a double bottom becomes a double top).
const mirror = (points: [number, number][]): [number, number][] => points.map(([i, p]) => [i, 200 - p])

const names = (candles: Candle[]) => findChartPatterns(candles).map((m) => m.pattern.name)

const SHAPES: [string, [number, number][]][] = [
  ['Double bottom', [[0, 130], [15, 100], [23, 115], [31, 100.5], [36, 108]]],
  ['Triple bottom', [[0, 140], [12, 100], [18, 112], [24, 100.3], [30, 112], [36, 100.2], [40, 107]]],
  ['Inverse head and shoulders', [[0, 125], [10, 100], [16, 110], [22, 92], [28, 110.5], [34, 100.5], [40, 112]]],
  ['Ascending triangle', [[0, 90], [10, 110], [16, 96], [22, 110], [28, 103], [34, 110], [38, 106]]],
  ['Symmetrical triangle', [[0, 105], [10, 120], [16, 90], [22, 114], [28, 97], [34, 109], [38, 104]]],
  ['Rising wedge', [[0, 96], [10, 110], [16, 104], [22, 116], [28, 112], [34, 119], [40, 113.5]]],
  ['Ascending channel', [[0, 100], [10, 112], [16, 108], [22, 118], [28, 114], [34, 124], [38, 120]]],
  ['Horizontal channel', [[0, 100], [8, 110], [16, 100.2], [24, 110.3], [32, 100.1], [40, 109.8], [44, 104]]],
  ['Bull flag', [[0, 98], [20, 100], [28, 125], [31, 120], [34, 123], [37, 118], [40, 121], [43, 117], [44, 122]]],
  ['Bullish pennant', [[0, 98], [20, 100], [28, 125], [31, 116], [34, 123], [37, 118], [40, 122], [42, 119.5], [43, 121], [44, 120.5]]],
  ['Cup and handle', [[0, 120], [4, 121], [10, 110], [16, 103], [22, 101], [28, 103], [34, 110], [40, 120.5], [44, 116], [46, 118]]],
  ['Higher highs and higher lows', [[0, 100], [6, 108], [10, 104], [16, 112], [20, 108], [26, 116], [30, 112], [34, 115]]],
  ['Support level', [[0, 110], [8, 100], [16, 110], [24, 100.3], [32, 110], [40, 101.5], [42, 101]]],
  ['Breakout', [[0, 100], [8, 110], [16, 100], [24, 110.2], [32, 101], [40, 109.8], [44, 106], [47, 109], [48, 113]]],
  ['False breakdown', [[0, 110], [8, 100], [16, 110], [24, 100.2], [32, 109], [40, 101], [44, 98], [45, 97.5], [46, 101.5]]],
]

// Each bullish shape, flipped upside down, should be found as its bearish twin.
const TWINS: Record<string, string> = {
  'Double bottom': 'Double top',
  'Triple bottom': 'Triple top',
  'Inverse head and shoulders': 'Head and shoulders',
  'Ascending triangle': 'Descending triangle',
  'Symmetrical triangle': 'Symmetrical triangle',
  'Rising wedge': 'Falling wedge',
  'Ascending channel': 'Descending channel',
  'Horizontal channel': 'Horizontal channel',
  'Bull flag': 'Bear flag',
  'Bullish pennant': 'Bearish pennant',
  'Cup and handle': 'Inverted cup and handle',
  'Higher highs and higher lows': 'Lower highs and lower lows',
  'Support level': 'Resistance level',
  Breakout: 'Breakdown',
  'False breakdown': 'False breakout',
}

describe('findChartPatterns on hand-drawn shapes', () => {
  for (const [name, points] of SHAPES) {
    it(`finds a ${name.toLowerCase()}`, () => expect(names(shape(points))).toContain(name))
    it(`finds its upside-down twin (${TWINS[name].toLowerCase()})`, () => expect(names(shape(mirror(points)))).toContain(TWINS[name]))
  }

  it('does not see a head and shoulders in a plain uptrend', () => {
    expect(names(shape([[0, 100], [40, 140]]))).not.toContain('Head and shoulders')
  })
})

describe('pickChartPatterns', () => {
  it('keeps one pattern per family and drops repeats', () => {
    const picked = pickChartPatterns(findChartPatterns(shape(SHAPES[6][1]))) // ascending channel
    const families = picked.map((m) => m.pattern.family)
    expect(new Set(families).size).toBe(families.length)
    expect(families).not.toContain('structure') // the channel already shows the trend
  })
})

// The generator knows which pattern it built, so it can grade the scanner.
describe('findChartPatterns on generated charts', () => {
  const EXPECTED = SCANNER_MATCHES

  const recall = (difficulty: 'easy' | 'medium' | 'hard') => {
    const hits: Record<string, [number, number]> = {}
    for (let i = 0; i < 1200; i++) {
      const card = generateCard(i + 1, i * 7919 + 17, difficulty)
      const expected = EXPECTED[card.setup.key]
      if (!expected) continue
      const matches = findChartPatterns(card.candles)
      const hit = matches.some((m) => expected.includes(m.pattern.key) && (m.bias === card.setup.bias || m.bias === 'neutral'))
      const [h, n] = hits[card.setup.key] ?? [0, 0]
      hits[card.setup.key] = [h + (hit ? 1 : 0), n + 1]
    }
    return Object.fromEntries(Object.entries(hits).map(([k, [h, n]]) => [k, Math.round((h / n) * 100)]))
  }

  it('recognises what the generator built on medium cards', () => {
    const scores = recall('medium')
    console.log('medium recall %', scores)
    for (const score of Object.values(scores)) expect(score).toBeGreaterThanOrEqual(60)
  })

  it('does a bit worse on hard cards, as it should', () => {
    const scores = recall('hard')
    console.log('hard recall %', scores)
    const average = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
    expect(average).toBeGreaterThanOrEqual(50)
  })
})
