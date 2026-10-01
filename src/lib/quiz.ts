import type { Candle, Shape } from '../types'
import { makeRng, type Rng } from './random'
import { CHART_SHAPES, MIRRORS } from './examples'
import { LIBRARY, entryByKey, type LibraryEntry } from './library'
import { PRACTICE_CANDLES } from './practice'
import { drawPattern } from './patternStudy'

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
  const { candles, shapes, detected } = drawPattern(key, rng)
  const box = which === 'candle' && shapes[0]?.kind === 'candles' ? { from: shapes[0].fromIndex, to: shapes[0].toIndex } : null
  const options = [key, ...distractors(entry, pool, detected, rng)]
    .map((k) => [rng.next(), k] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, k]) => k)
  return { key, kind: which, candles, shapes, box, options }
}
