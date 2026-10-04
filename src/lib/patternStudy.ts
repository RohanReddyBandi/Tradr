import type { Candle, Shape } from '../types'
import { makeRng, type Rng } from './random'
import { CANDLE_PATTERNS, findCandlePatterns } from './candlePatterns'
import { findChartPatterns } from './chartPatterns'
import { CANDLE_RECIPES, CHART_SHAPES, GAPS, MIRRORS, R, candleExample, candlesThrough, chartExample, flip, type Points } from './examples'
import { SIGNAL_RECIPES } from './signalCandles'
import { entryByKey } from './library'

// Studying one pattern in the Learn tab: fresh drawings of it, and look-alikes
// that aren't it (each with the reason why). Everything is checked with the
// same detectors the game uses, so "it is" really is, and "it isn't" really isn't.

export interface Specimen {
  candles: Candle[]
  shapes: Shape[] // markup to show once the answer is out
  is: boolean // is it the pattern being studied?
  kind: 'example' | 'lookAlike' | 'nearMiss' // the pattern, a different pattern, or almost the pattern
  shows: string | null // the library key of what's really there (null: nothing named)
  note: string // why it is, or why it isn't
}

// How many candles a candlestick pattern spans (chart patterns: 0).
export const patternSize = (key: string) => CANDLE_PATTERNS.find((p) => p.key === key)?.size ?? 0

// ---------------------------------------------------------------------------
// Drawing a pattern fresh
// ---------------------------------------------------------------------------

export interface Drawn {
  candles: Candle[]
  shapes: Shape[]
  detected: string[] // every pattern the detectors see (at the last candle, for candlesticks)
  ok: boolean // did the detector see the pattern that was drawn?
}

const isCandleKey = (key: string) => entryByKey(key)?.kind === 'candle'

// What the detectors see: every chart pattern, or the candlestick patterns ending on the last candle.
export function detect(candles: Candle[], kind: 'chart' | 'candle'): string[] {
  return kind === 'chart'
    ? findChartPatterns(candles).map((m) => m.pattern.key)
    : findCandlePatterns(candles, [candles.length - 1]).map((m) => m.pattern.key)
}

// A variation on a pattern's outline: stretched or squeezed in time, taller
// or flatter, and each key point nudged a little. The detector decides
// whether it's still the pattern.
function varyShape(points: Points, gaps: [number, number][] = [], rng: Rng): { points: Points; gaps: [number, number][] } {
  const stretch = rng.range(0.8, 1.3)
  const prices = points.map(([, p]) => p)
  const middle = (Math.max(...prices) + Math.min(...prices)) / 2
  const span = Math.max(...prices) - Math.min(...prices)
  const tall = rng.range(0.8, 1.25)
  let last = -1
  const varied = points.map(([at, price]): [number, number] => {
    const x = Math.max(last + 1, Math.round(at * stretch))
    last = x
    return [x, middle + (price - middle) * tall + rng.range(-0.025, 0.025) * span]
  })
  return { points: varied, gaps: gaps.map(([at, jump]) => [Math.round(at * stretch), jump * tall]) }
}

function drawChart(key: string, rng: Rng): Drawn {
  const base = CHART_SHAPES[key] ? key : MIRRORS[key]
  for (let attempt = 0; attempt < 12; attempt++) {
    // Most tries reshape the outline; the last few use it as it is.
    const shape = attempt < 8 ? varyShape(CHART_SHAPES[base], GAPS[base], rng) : { points: CHART_SHAPES[base], gaps: GAPS[base] }
    let candles = candlesThrough(shape.points, rng.int(1, 1_000_000), shape.gaps)
    if (base !== key) candles = flip(candles)
    const found = findChartPatterns(candles)
    const match = found.find((m) => m.pattern.key === key)
    if (match) return { candles, shapes: match.shapes, detected: found.map((m) => m.pattern.key), ok: true }
  }
  const example = chartExample(key)!
  const found = findChartPatterns(example.candles)
  return { ...example, detected: found.map((m) => m.pattern.key), ok: found.some((m) => m.pattern.key === key) }
}

// A natural-looking move into a pattern: candles of different sizes, mostly
// going one way with the odd small one against it, and uneven wicks.
function naturalLead(direction: 'down' | 'up' | 'flat', count: number, rng: Rng): Candle[] {
  const candles: Candle[] = []
  let close = 100
  for (let i = 0; i < count; i++) {
    const open = close + rng.range(-0.06, 0.06) * R
    let step: number
    if (direction === 'flat') step = (i % 2 === 0 ? 1 : -1) * rng.range(0.2, 0.45) * R
    else {
      const s = direction === 'up' ? 1 : -1
      step = rng.chance(0.18) ? -s * rng.range(0.15, 0.3) * R : s * rng.range(0.5, 1.05) * R
    }
    close = open + step
    candles.push({
      time: i,
      open,
      close,
      high: Math.max(open, close) + rng.range(0.08, 0.35) * R,
      low: Math.min(open, close) - rng.range(0.08, 0.35) * R,
    })
  }
  return candles
}

// The candles leading in, then the pattern. `lead` overrides the usual move
// into it (both as drawn before a bearish pattern is turned upside down).
function candlesFor(key: string, rng: Rng, lead?: 'down' | 'up' | 'flat'): Candle[] {
  const spec = CANDLE_RECIPES[key]
  const candles = naturalLead(lead ?? spec.lead ?? 'down', rng.int(6, 8), rng)
  const from = candles[candles.length - 1].close
  for (const b of SIGNAL_RECIPES[spec.recipe](R, rng)) {
    candles.push({ time: candles.length, open: b.open + from, high: b.high + from, low: b.low + from, close: b.close + from })
  }
  return spec.flipped ? flip(candles) : candles
}

function drawCandle(key: string, rng: Rng): Drawn {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candles = candlesFor(key, rng)
    const found = findCandlePatterns(candles, [candles.length - 1])
    const match = found.find((m) => m.pattern.key === key)
    if (match) return { candles, shapes: [{ kind: 'candles', fromIndex: match.start, toIndex: match.end }], detected: found.map((m) => m.pattern.key), ok: true }
  }
  const example = candleExample(key)!
  const detected = detect(example.candles, 'candle')
  return { ...example, detected, ok: detected.includes(key) }
}

// A new drawing of any pattern in the library, with a fresh random wiggle.
export const drawPattern = (key: string, rng: Rng): Drawn => (isCandleKey(key) ? drawCandle(key, rng) : drawChart(key, rng))

// ---------------------------------------------------------------------------
// Look-alikes
// ---------------------------------------------------------------------------

// The upside-down version (a double top for a double bottom), if there is one.
export function twinOf(key: string): string | null {
  if (isCandleKey(key)) {
    const spec = CANDLE_RECIPES[key]
    return Object.entries(CANDLE_RECIPES).find(([k, s]) => k !== key && s.recipe === spec.recipe && !!s.flipped !== !!spec.flipped)?.[0] ?? null
  }
  if (MIRRORS[key]) return MIRRORS[key]
  return Object.entries(MIRRORS).find(([, base]) => base === key)?.[0] ?? null
}

// The patterns people mix each one up with, written for the bullish (or
// neutral) side; the bearish side uses the twins of the same list.
const CONFUSED_WITH: Record<string, string[]> = {
  // Candlesticks
  hammer: ['hangingMan', 'dragonflyDoji', 'invertedHammer', 'spinningTop'],
  invertedHammer: ['shootingStar', 'hammer', 'spinningTop'],
  dragonflyDoji: ['hammer', 'doji', 'longLeggedDoji'],
  doji: ['longLeggedDoji', 'spinningTop', 'dragonflyDoji'],
  longLeggedDoji: ['doji', 'spinningTop'],
  spinningTop: ['doji', 'hammer', 'insideBar'],
  bullishMarubozu: ['bullishBeltHold', 'threeWhiteSoldiers'],
  bullishBeltHold: ['bullishMarubozu', 'hammer'],
  bullishEngulfing: ['piercingLine', 'bullishHarami', 'bullishKicker'],
  piercingLine: ['bullishEngulfing', 'bullishCounterattack', 'bullishHarami'],
  bullishHarami: ['bullishHaramiCross', 'insideBar', 'piercingLine'],
  bullishHaramiCross: ['bullishHarami', 'insideBar'],
  tweezerBottom: ['bullishEngulfing', 'piercingLine'],
  bullishKicker: ['bullishEngulfing', 'risingWindow'],
  bullishCounterattack: ['piercingLine', 'bullishEngulfing'],
  risingWindow: ['bullishKicker', 'bullishMarubozu'],
  insideBar: ['bullishHarami', 'spinningTop'],
  morningStar: ['morningDojiStar', 'abandonedBabyBullish', 'threeInsideUp'],
  morningDojiStar: ['morningStar', 'abandonedBabyBullish'],
  abandonedBabyBullish: ['morningDojiStar', 'morningStar'],
  threeWhiteSoldiers: ['risingThreeMethods', 'threeOutsideUp'],
  threeInsideUp: ['threeOutsideUp', 'morningStar'],
  threeOutsideUp: ['threeInsideUp', 'threeWhiteSoldiers'],
  risingThreeMethods: ['threeWhiteSoldiers', 'threeInsideUp'],
  // Chart patterns
  supportLevel: ['doubleBottom', 'horizontalChannel', 'falseBreakdown'],
  breakout: ['falseBreakout', 'bullishRectangle', 'ascendingTriangle'],
  falseBreakdown: ['supportLevel', 'breakdown', 'doubleBottom'],
  higherHighsHigherLows: ['ascendingChannel', 'risingTrendline', 'broadeningFormation'],
  ascendingChannel: ['risingWedge', 'higherHighsHigherLows', 'risingTrendline'],
  horizontalChannel: ['bullishRectangle', 'symmetricalTriangle', 'tripleBottom'],
  doubleBottom: ['tripleBottom', 'inverseHeadAndShoulders', 'vBottom', 'falseBreakdown'],
  tripleBottom: ['doubleBottom', 'inverseHeadAndShoulders', 'horizontalChannel'],
  inverseHeadAndShoulders: ['tripleBottom', 'doubleBottom', 'diamondBottom'],
  ascendingTriangle: ['symmetricalTriangle', 'risingWedge', 'bullishRectangle'],
  symmetricalTriangle: ['ascendingTriangle', 'bullishPennant', 'volatilitySqueeze'],
  risingWedge: ['ascendingChannel', 'ascendingTriangle', 'ascendingBroadeningWedge'],
  fallingWedge: ['descendingChannel', 'bullFlag', 'descendingBroadeningWedge'],
  bullFlag: ['bullishPennant', 'fallingWedge', 'bullishRectangle'],
  bullishPennant: ['bullFlag', 'symmetricalTriangle'],
  cupAndHandle: ['roundingBottom', 'doubleBottom'],
  roundingBottom: ['cupAndHandle', 'vBottom'],
  vBottom: ['roundingBottom', 'sellingClimax', 'doubleBottom'],
  diamondBottom: ['inverseHeadAndShoulders', 'broadeningFormation'],
  broadeningFormation: ['symmetricalTriangle', 'diamondBottom'],
  descendingBroadeningWedge: ['fallingWedge', 'broadeningFormation'],
  bullishRectangle: ['horizontalChannel', 'bullFlag', 'ascendingTriangle'],
  risingTrendline: ['ascendingChannel', 'higherHighsHigherLows'],
  volatilitySqueeze: ['symmetricalTriangle', 'horizontalChannel'],
  bullishChangeOfCharacter: ['downtrendLineBreak', 'doubleBottom', 'falseBreakdown'],
  islandBottom: ['exhaustionGapDown', 'vBottom'],
  breakawayGapUp: ['runawayGapUp', 'breakout'],
  runawayGapUp: ['breakawayGapUp', 'exhaustionGapUp'],
  exhaustionGapDown: ['islandBottom', 'sellingClimax'],
  downtrendLineBreak: ['bullishChangeOfCharacter', 'fallingWedge'],
  sellingClimax: ['vBottom', 'exhaustionGapDown'],
  bullishFibPullback: ['bullFlag', 'higherHighsHigherLows'],
}

// Look-alikes for a pattern: its twin first, then the ones it's confused with.
export function lookAlikes(key: string): string[] {
  const twin = twinOf(key)
  const bearish = entryByKey(key)?.bias === 'bearish'
  const listed = CONFUSED_WITH[key] ?? (bearish && twin ? (CONFUSED_WITH[twin] ?? []).map((k) => twinOf(k) ?? k) : [])
  const kind = entryByKey(key)?.kind
  return [...new Set([twin, ...listed])].filter((k): k is string => !!k && k !== key && entryByKey(k)?.kind === kind)
}

// ---------------------------------------------------------------------------
// "It isn't": look-alikes and near misses, each checked
// ---------------------------------------------------------------------------

const lower = (key: string) => entryByKey(key)?.name.toLowerCase() ?? key
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

// Why a look-alike isn't the pattern.
function lookAlikeNote(key: string, shown: string): string {
  const name = lower(key)
  const theirs = entryByKey(shown)!
  if (twinOf(key) === shown) {
    const way = theirs.bias === 'bullish' ? 'up' : 'down'
    return `It's ${article(theirs.name)} ${theirs.name.toLowerCase()}: the same shape upside down, so it points ${way} instead.`
  }
  return `It's ${article(theirs.name)} ${theirs.name.toLowerCase()}, not ${article(name)} ${name}. ${theirs.meaning}`
}

// Near misses for a candlestick pattern: the right candles in the wrong
// place, the pattern before its last candle, or a last candle too weak to count.
function candleNearMisses(key: string, rng: Rng): Specimen[] {
  const spec = CANDLE_RECIPES[key]
  const entry = entryByKey(key)!
  const name = entry.name.toLowerCase()
  const out: Specimen[] = []
  const add = (candles: Candle[], note: string) => {
    const seen = detect(candles, 'candle')
    if (!seen.includes(key)) out.push({ candles, shapes: [], is: false, kind: 'nearMiss', shows: seen[0] ?? null, note })
  }

  // The wrong move into it.
  const usual = spec.lead ?? 'down'
  if (usual !== 'flat') {
    const fellBefore = (usual === 'down') !== !!spec.flipped
    add(
      candlesFor(key, rng, usual === 'down' ? 'up' : 'down'),
      `The same candles, but price was ${fellBefore ? 'rising' : 'falling'} into them. ${article(name)[0].toUpperCase()}${article(name).slice(1)} ${name} needs a ${fellBefore ? 'fall' : 'rise'} before it, or it means something else.`,
    )
  }

  // Not finished.
  const size = patternSize(key)
  if (size > 1) {
    const full = candlesFor(key, rng)
    add(full.slice(0, -1), `Not finished yet: the last candle, the one that confirms ${article(name)} ${name}, hasn't happened.`)
  }

  // A single candle whose body is too thick for a small-bodied pattern.
  if (size === 1) {
    const thick = candlesFor(key, rng)
    const c = thick[thick.length - 1]
    const range = c.high - c.low
    if (Math.abs(c.close - c.open) < 0.3 * range) {
      const middle = (c.high + c.low) / 2
      const s = c.close >= c.open ? 1 : -1
      const body = 0.5 * range
      thick[thick.length - 1] = { ...c, open: middle - (s * body) / 2, close: middle + (s * body) / 2 }
      add(thick, `The body is too thick: it fills half the candle. ${article(name)[0].toUpperCase()}${article(name).slice(1)} ${name} needs a small body.`)
    }
  }

  // A last candle too small to do the job.
  const weak = candlesFor(key, rng)
  const last = weak[weak.length - 1]
  const middle = (last.open + last.close) / 2
  const shrunk = { ...last, open: middle + (last.open - middle) * 0.3, close: middle + (last.close - middle) * 0.3 }
  shrunk.high = Math.max(shrunk.high, shrunk.open, shrunk.close)
  shrunk.low = Math.min(shrunk.low, shrunk.open, shrunk.close)
  add([...weak.slice(0, -1), shrunk], `Close, but the last candle's body is too small. It doesn't do enough to make ${article(name)} ${name}.`)
  return out
}

// Near misses for a chart pattern: the shape before it's finished, or with swings too small to count.
function chartNearMisses(key: string, rng: Rng): Specimen[] {
  const name = lower(key)
  const out: Specimen[] = []
  const drawn = drawChart(key, rng)
  if (!drawn.ok) return out
  const add = (candles: Candle[], note: string) => {
    const seen = detect(candles, 'chart')
    if (!seen.includes(key)) out.push({ candles, shapes: [], is: false, kind: 'nearMiss', shows: seen[0] ?? null, note })
  }
  const cut = drawn.candles.slice(0, Math.round(drawn.candles.length * 0.7))
  add(cut, `Not finished yet: the right-hand part, where ${article(name)} ${name} completes, hasn't formed.`)

  const closes = drawn.candles.map((c) => c.close)
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length
  const squash = (p: number) => mean + (p - mean) * 0.3
  add(
    drawn.candles.map((c) => {
      const shift = squash(c.close) - c.close
      return { ...c, open: c.open + shift * 0.9, close: c.close + shift, high: c.high + shift, low: c.low + shift }
    }),
    "The same outline, but the swings are too small to count: that's everyday wiggle, not a pattern.",
  )
  return out
}

// Look-alikes (drawn fresh, and checked not to read as the pattern) and near misses.
export function nonExamples(key: string, seed: number): Specimen[] {
  const rng = makeRng(seed)
  const kind = isCandleKey(key) ? 'candle' : 'chart'
  const out: Specimen[] = []
  for (const other of lookAlikes(key)) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const d = drawPattern(other, rng)
      if (d.ok && !d.detected.includes(key)) {
        out.push({ candles: d.candles, shapes: d.shapes, is: false, kind: 'lookAlike', shows: other, note: lookAlikeNote(key, other) })
        break
      }
    }
  }
  out.push(...(kind === 'candle' ? candleNearMisses(key, rng) : chartNearMisses(key, rng)))
  return out
}

// Fresh drawings of the pattern itself.
export function examplesOf(key: string, seed: number, count = 3): Specimen[] {
  const rng = makeRng(seed)
  const entry = entryByKey(key)!
  const out: Specimen[] = []
  for (let attempt = 0; attempt < count * 3 && out.length < count; attempt++) {
    const d = drawPattern(key, rng)
    if (d.ok) out.push({ candles: d.candles, shapes: d.shapes, is: true, kind: 'example', shows: key, note: `${entry.name}. ${entry.meaning}` })
  }
  return out
}
