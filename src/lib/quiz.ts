import type { Candle, Shape } from '../types'
import { makeRng, type Rng } from './random'
import { findCandlePatterns } from './candlePatterns'
import { findChartPatterns } from './chartPatterns'
import { CANDLE_RECIPES, CHART_SHAPES, GAPS, MIRRORS, R, candleExample, candlesThrough, chartExample, flip, leadIn } from './examples'
import { SIGNAL_RECIPES } from './signalCandles'
import { LIBRARY, entryByKey, type LibraryEntry } from './library'
import { PRACTICE_CANDLES } from './practice'

// The Learn tab's quiz: a chart you haven't seen before, four names, one right.
// Every chart is freshly drawn (a new random wiggle each time) and checked by
// the same detectors the game uses, so the right answer really is on it.

export type QuizKind = 'chart' | 'candle'

export interface QuizQuestion {
  key: string // the right answer (a library key)
  kind: QuizKind
  candles: Candle[]
  shapes: Shape[] // the pattern's markup, shown once you've answered
  box: { from: number; to: number } | null // candlestick questions: the candles to name
  options: string[] // four library keys, including the answer
}

// Chart patterns with an example shape to draw from.
const CHART_KEYS = LIBRARY.filter((e) => e.kind === 'chart' && (CHART_SHAPES[e.key] || MIRRORS[e.key])).map((e) => e.key)
const CANDLE_KEYS = PRACTICE_CANDLES.map((p) => p.key)

// A new drawing of a chart pattern, or the fixed Learn example if a few tries don't read right.
function drawChart(key: string, rng: Rng) {
  const base = CHART_SHAPES[key] ? key : MIRRORS[key]
  for (let attempt = 0; attempt < 8; attempt++) {
    let candles = candlesThrough(CHART_SHAPES[base], rng.int(1, 1_000_000), GAPS[base])
    if (base !== key) candles = flip(candles)
    const found = findChartPatterns(candles)
    const match = found.find((m) => m.pattern.key === key)
    if (match) return { candles, shapes: match.shapes, detected: found.map((m) => m.pattern.key) }
  }
  const example = chartExample(key)!
  return { ...example, detected: findChartPatterns(example.candles).map((m) => m.pattern.key) }
}

// A candlestick pattern after a lead-in of random length, drawn with a random recipe roll.
function drawCandle(key: string, rng: Rng) {
  const spec = CANDLE_RECIPES[key]
  for (let attempt = 0; attempt < 8; attempt++) {
    const candles = leadIn(spec.lead ?? 'down', rng.int(6, 10))
    const from = candles[candles.length - 1].close
    for (const b of SIGNAL_RECIPES[spec.recipe](R, rng)) {
      candles.push({ time: candles.length, open: b.open + from, high: b.high + from, low: b.low + from, close: b.close + from })
    }
    const drawn = spec.flipped ? flip(candles) : candles
    const last = drawn.length - 1
    const found = findCandlePatterns(drawn, [last])
    const match = found.find((m) => m.pattern.key === key)
    if (match) return { candles: drawn, shapes: [{ kind: 'candles', fromIndex: match.start, toIndex: match.end }] as Shape[], detected: found.map((m) => m.pattern.key) }
  }
  const example = candleExample(key)!
  return { ...example, detected: findCandlePatterns(example.candles, [example.candles.length - 1]).map((m) => m.pattern.key) }
}

// Three wrong answers: mostly from the same group (the harder ones to tell
// apart), plus one from anywhere else of the same kind. Anything the
// detectors also see on this chart is left out, so only one answer is right.
function distractors(entry: LibraryEntry, pool: string[], detected: string[], rng: Rng): string[] {
  const shuffle = <T,>(items: T[]) => items.map((v) => [rng.next(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v)
  const others = pool.filter((k) => k !== entry.key && !detected.includes(k))
  const sameGroup = shuffle(others.filter((k) => entryByKey(k)?.group === entry.group)).slice(0, 2)
  const rest = shuffle(others.filter((k) => !sameGroup.includes(k)))
  return [...sameGroup, ...rest].slice(0, 3)
}

export function makeQuestion(seed: number, kind: QuizKind | 'any' = 'any', not?: string): QuizQuestion {
  const rng = makeRng(seed)
  const which: QuizKind = kind === 'any' ? (rng.chance(0.5) ? 'chart' : 'candle') : kind
  const pool = which === 'chart' ? CHART_KEYS : CANDLE_KEYS
  let key = rng.pick(pool)
  if (key === not) key = pool[(pool.indexOf(key) + 1) % pool.length]
  const entry = entryByKey(key)!
  const { candles, shapes, detected } = which === 'chart' ? drawChart(key, rng) : drawCandle(key, rng)
  const box = which === 'candle' && shapes[0]?.kind === 'candles' ? { from: shapes[0].fromIndex, to: shapes[0].toIndex } : null
  const options = [key, ...distractors(entry, pool, detected, rng)]
    .map((k) => [rng.next(), k] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, k]) => k)
  return { key, kind: which, candles, shapes, box, options }
}
