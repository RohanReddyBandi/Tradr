import type { Candle, Difficulty } from '../types'
import type { Rng } from './random'
import type { Waypoint } from './setupKit'
import { CANDLE_RECIPES, SIGNAL_RECIPES, type Bar, type SignalKey } from './signalCandles'
import { findCandlePatterns } from './candlePatterns'

// What makes two cards with the same setup look different. Each card gets:
//   - a length: 45 to 90 visible candles, so the pattern fills more or less of the chart
//   - a backstory: the shape of the stretch before the pattern (a staircase,
//     a base, a spike, some chop...), which is most of what you see first
//   - a candle style: smooth, wicky, jumpy, or volatility that builds or fades
//   - often a candlestick pattern or two at earlier turning points, the way
//     real charts are full of hammers and engulfings that came and went
// None of it touches the pattern itself: backstories stay on their own side
// of the pattern's first key point, and planted candles stay out of the
// last stretch, where the decision happens.

// ---------------------------------------------------------------------------
// Length
// ---------------------------------------------------------------------------

// Easy cards stay fairly short, so the pattern fills the chart; hard ones can zoom out.
const LENGTHS: Record<Difficulty, number[]> = {
  easy: [45, 50, 55, 60, 60, 65],
  medium: [45, 50, 55, 60, 65, 70, 75, 80],
  hard: [50, 55, 60, 65, 70, 80, 90],
}
export const CHART_LENGTHS = [...new Set(Object.values(LENGTHS).flat())].sort((a, b) => a - b)

// ---------------------------------------------------------------------------
// Backstories
// ---------------------------------------------------------------------------

export const BACKSTORIES = ['drift', 'swing', 'staircase', 'baseFirst', 'baseLast', 'overshoot', 'zigzag', 'spike', 'grind', 'chop'] as const
export type Backstory = (typeof BACKSTORIES)[number]

export interface Turn {
  at: number
  kind: 'top' | 'bottom'
  room: number // how far a wick can poke past this turn and still stay clear of the pattern
  // The turn is one of the pattern's own swing points: the planted candles
  // must end up with exactly the same low (or high), so the pattern's lines still fit.
  exact?: boolean
}

// Redraw the lead-in: the stretch from the first waypoint to the second
// (where the pattern's own points begin). It may wander past its starting
// price (a bigger move before the pattern), but never past the second
// waypoint, so it can't make a lower low under a support, a higher high
// over a breakout line, and so on.
export function tellBackstory(kind: Backstory, waypoints: Waypoint[], rng: Rng, R: number): { waypoints: Waypoint[]; turns: Turn[] } {
  const [first, next] = waypoints
  const unchanged = { waypoints, turns: [] }
  if (!next || kind === 'drift' || next.at < 12) return unchanged
  const A = first.price
  const B = next.price
  const T = next.at
  const move = Math.abs(B - A)
  const margin = 0.6 * R
  let u = Math.sign(B - A) // +1: rising into the pattern
  let lo: number
  let hi: number
  let extra: number
  if (move >= 2 * R) {
    extra = move >= 3 * R ? Math.min(8 * R, Math.max(2 * R, move * 0.6)) : 0.5 * R
    lo = u > 0 ? A - extra : B + margin
    hi = u > 0 ? B - margin : A + extra
  } else {
    // A flat lead-in (a long base): it can wander a little, but only on the
    // side away from the pattern's first key point (above a low, below a high).
    if (T < 20 || !['swing', 'zigzag', 'chop'].includes(kind)) return unchanged
    extra = 2 * R
    lo = next.touch === 'low' ? Math.max(A, B) : Math.min(A, B) - (next.touch ? extra : 1.2 * R)
    hi = next.touch === 'high' ? Math.min(A, B) : Math.max(A, B) + (next.touch ? extra : 1.2 * R)
    u = u || 1
  }
  const clamp = (p: number) => Math.min(hi, Math.max(lo, p))
  // Which edges of the band face the pattern (the other side is open space).
  const flatLead = move < 2 * R
  const guardTop = flatLead ? next.touch !== 'low' : u > 0
  const guardBottom = flatLead ? next.touch !== 'high' : u < 0
  const along = (f: number) => A + (B - A) * f // f of the way from A to B
  const at = (f: number) => Math.round(T * f)

  let points: Waypoint[] = []
  switch (kind) {
    case 'swing': {
      const f = rng.range(0.35, 0.65)
      points = [{ at: at(f), price: along(f) + (rng.chance(0.5) ? 1 : -1) * R * rng.range(1.5, 3.5) }]
      break
    }
    case 'staircase': {
      // Two or three pushes toward the pattern, each with a pullback.
      const steps = T >= 30 ? rng.int(2, 3) : 2
      for (let s = 1; s < steps + 1; s++) {
        const push = (s - 0.35) / steps
        const pull = (s - 0.1) / steps
        if (pull >= 0.92) break
        points.push({ at: at(push), price: along(Math.min(1, s / steps + 0.05)) })
        points.push({ at: at(pull), price: along((s - 0.55) / steps) })
      }
      break
    }
    case 'baseFirst': {
      // Sideways near the start for a while, quietly, then the move.
      const f = rng.range(0.35, 0.55)
      points = [
        { at: at(f * 0.5), price: along(0.04) + R * rng.range(-0.6, 0.6), hush: 0.55 },
        { at: at(f), price: along(0.08), hush: 0.55 },
      ]
      break
    }
    case 'baseLast': {
      // A quick move most of the way, then a quiet drift the rest.
      const f = rng.range(0.25, 0.4)
      points = [
        { at: at(f), price: along(rng.range(0.75, 0.88)) },
        { at: at(Math.min(0.9, f + rng.range(0.3, 0.45))), price: along(rng.range(0.8, 0.92)), hush: 0.55 },
      ]
      break
    }
    case 'overshoot': {
      // First the other way (a bigger move before this one), then back.
      const f = rng.range(0.2, 0.4)
      points = [{ at: at(f), price: A - u * extra * rng.range(0.6, 1) }]
      if (T >= 24) points.push({ at: at(f + 0.2), price: A - u * extra * rng.range(0.1, 0.4) })
      break
    }
    case 'zigzag': {
      const swings = T >= 30 ? rng.int(3, 4) : 2
      for (let s = 1; s <= swings; s++) {
        const f = s / (swings + 1)
        points.push({ at: at(f), price: along(f) + (s % 2 ? 1 : -1) * R * rng.range(1.2, 2.6) })
      }
      break
    }
    case 'spike': {
      // A sharp jump against the move for two or three days, then a fade.
      const f = rng.range(0.2, 0.55)
      const size = Math.max(extra, 2.5 * R) * rng.range(0.7, 1)
      points = [
        { at: at(f), price: along(f) },
        { at: at(f) + rng.int(2, 3), price: along(f) - u * size },
        { at: at(f) + rng.int(6, 8), price: along(f + 0.1) },
      ]
      break
    }
    case 'grind': {
      // The same move, but steadier: pinned to the straight line every few
      // candles, with smaller candles.
      for (let f = 0.2; f < 0.95; f += 0.2) points.push({ at: at(f), price: along(f), hush: 0.7 })
      break
    }
    case 'chop': {
      // Back and forth in a band before finally going.
      const swings = T >= 28 ? rng.int(4, 5) : 3
      const f0 = rng.range(0.05, 0.2)
      for (let s = 1; s <= swings; s++) {
        const f = f0 + ((0.75 - f0) * s) / swings
        points.push({ at: at(f), price: along(f0 + 0.05) + (s % 2 ? 1 : -1) * R * rng.range(1.2, 2.2) })
      }
      break
    }
  }

  // Keep the points in order, at least two candles apart, and inside the band.
  const kept: Waypoint[] = []
  let last = 0
  for (const p of points) {
    if (p.at - last < 2 || T - p.at < 2) continue
    kept.push({ ...p, price: clamp(p.price) })
    last = p.at
  }
  const all = [first, ...kept, next]
  const turns: Turn[] = []
  for (let k = 1; k < all.length - 1; k++) {
    const [a, p, b] = [all[k - 1].price, all[k].price, all[k + 1].price]
    // How much room a wick has beyond this turn before it reaches the pattern side of the band.
    // (Toward the pattern a wick may reach just past the band's edge, never further.)
    if (p > a && p > b) turns.push({ at: all[k].at, kind: 'top', room: guardTop ? hi + margin - p : Infinity })
    if (p < a && p < b) turns.push({ at: all[k].at, kind: 'bottom', room: guardBottom ? p - (lo - margin) : Infinity })
  }
  return { waypoints: [first, ...kept, ...waypoints.slice(1)], turns }
}

// ---------------------------------------------------------------------------
// Candle styles
// ---------------------------------------------------------------------------

export const CANDLE_STYLES = ['standard', 'smooth', 'wicky', 'jumpy', 'building', 'fading'] as const
export type CandleStyle = (typeof CANDLE_STYLES)[number]

export interface StyleSettings {
  noise: number // times the difficulty's wiggle
  wicks: number // times its wick length
  jitter: number // how far candles open from the last close
  profile: (i: number, count: number) => number // volatility across the chart (1 = normal)
}

const flat = () => 1

export function candleStyle(kind: CandleStyle): StyleSettings {
  switch (kind) {
    case 'smooth':
      return { noise: 0.8, wicks: 0.6, jitter: 0.6, profile: flat }
    case 'wicky':
      return { noise: 0.9, wicks: 1.55, jitter: 1, profile: flat }
    case 'jumpy':
      return { noise: 1.1, wicks: 1, jitter: 3, profile: flat }
    case 'building': // quiet early on, busier toward the decision
      return { noise: 1, wicks: 1, jitter: 1, profile: (i, n) => 0.65 + 0.6 * (i / n) }
    case 'fading': // busy early on, calmer toward the decision
      return { noise: 1, wicks: 1, jitter: 1, profile: (i, n) => 1.3 - 0.55 * (i / n) }
    default:
      return { noise: 1, wicks: 1, jitter: 1, profile: flat }
  }
}

// ---------------------------------------------------------------------------
// Candlestick patterns at earlier turning points
// ---------------------------------------------------------------------------

// Patterns that mark a low (they're flipped for a high).
const TURN_SIGNALS: SignalKey[] = [
  'hammer',
  'bullishEngulfing',
  'piercingLine',
  'morningStar',
  'tweezerBottom',
  'bullishHarami',
  'dragonflyDoji',
  'invertedHammer',
  'bullishHaramiCross',
  'morningDojiStar',
  'threeInsideUp',
  'bullishCounterattack',
]

// The library's name for a recipe drawn one way up or the other ("hammer"
// flipped is a shooting star).
function patternKey(recipe: SignalKey, flipped: boolean): string | undefined {
  return Object.entries(CANDLE_RECIPES).find(([, spec]) => spec.recipe === recipe && !!spec.flipped === flipped)?.[0]
}

const flipBar = (b: Bar): Bar => ({ open: -b.open, close: -b.close, high: -b.low, low: -b.high })

// Put up to `count` real candlestick patterns at turning points, ending on
// the turn. Each is checked with the detector and kept only if it reads as
// the pattern it was meant to be. `before` is the first candle that's off
// limits (the decision point's neighbourhood); `avoid` are candles that must
// stay as they are (gaps, quiet stretches). Returns how many went in.
export function plantPatterns(bars: Bar[], turns: Turn[], count: number, rng: Rng, R: number, before: number, avoid = new Set<number>()): number {
  let planted = 0
  const used: number[] = []
  const shuffled = turns.map((t) => [rng.next(), t] as const).sort((a, b) => a[0] - b[0]).map(([, t]) => t)
  for (const turn of shuffled) {
    if (planted >= count) break
    const recipe = rng.pick(TURN_SIGNALS)
    const top = turn.kind === 'top'
    let pattern = SIGNAL_RECIPES[recipe](R, rng)
    // Match the size of the candles around it.
    const around = bars.slice(Math.max(0, turn.at - 6), turn.at)
    const size = around.reduce((s, b) => s + b.high - b.low, 0) / Math.max(1, around.length) / R
    const k = Math.min(1.8, Math.max(0.6, size))
    pattern = pattern.map((b) => ({ open: b.open * k, high: b.high * k, low: b.low * k, close: b.close * k }))
    if (top) pattern = pattern.map(flipBar)

    const end = turn.at
    const start = end - pattern.length + 1
    if (start < 8 || end >= before || used.some((u) => Math.abs(u - end) < 8)) continue
    let blocked = false
    for (let i = start - 1; i <= end + 1; i++) if (avoid.has(i)) blocked = true
    if (blocked) continue
    const reach = top ? Math.max(...pattern.map((b) => b.high)) : -Math.min(...pattern.map((b) => b.low))
    if (!turn.exact && reach > turn.room) continue

    // Normally the pattern carries on from the last close. On one of the
    // pattern's own swing points it's placed so its extreme lands exactly on
    // the old one, and the candle before is bent to close where it starts.
    const saved = bars.slice(start - 1, end + 2).map((b) => ({ ...b }))
    const from = turn.exact ? (top ? bars[end].high - reach : bars[end].low + reach) : bars[start - 1].close
    if (turn.exact) {
      const prev = bars[start - 1]
      prev.close = from
      prev.high = Math.max(prev.high, prev.open, from)
      prev.low = Math.min(prev.low, prev.open, from)
    }
    pattern.forEach((b, j) => {
      bars[start + j] = { open: b.open + from, high: b.high + from, low: b.low + from, close: b.close + from }
    })
    // The candle after opens where the pattern closed.
    const after = bars[end + 1]
    if (after) {
      after.open = bars[end].close
      after.high = Math.max(after.high, after.open, after.close)
      after.low = Math.min(after.low, after.open, after.close)
    }

    const key = patternKey(recipe, top)
    const candles: Candle[] = bars.slice(0, end + 1).map((b, i) => ({ ...b, time: i }))
    if (key && findCandlePatterns(candles, [end]).some((m) => m.pattern.key === key)) {
      planted++
      used.push(end)
    } else {
      saved.forEach((b, j) => (bars[start - 1 + j] = b)) // didn't read right: put the original candles back
    }
  }
  return planted
}

// ---------------------------------------------------------------------------
// Limits: a few setups only read right in some looks
// ---------------------------------------------------------------------------

// Found by generating each setup in every look and checking the pattern
// scanner still sees it (the same check chartPatterns.test.ts makes).
interface Limits {
  lengths?: (length: number) => boolean
  backstories?: readonly Backstory[] // allowed ones (default: all)
  styles?: readonly CandleStyle[] // styles to avoid
}
const CALM_BACKSTORIES = ['drift', 'swing', 'staircase', 'baseFirst', 'grind'] as const

const LIMITS: Record<string, Limits> = {
  wedge: { lengths: (n) => n >= 50, styles: ['wicky'] },
  falseBreak: { lengths: (n) => n <= 60 },
  trendline: { lengths: (n) => n <= 75 },
  diamond: { lengths: (n) => n === 45 || n === 60 },
  broadeningWedge: { lengths: (n) => n >= 50, styles: ['wicky'] },
  channelBounce: { styles: ['wicky'] },
  trendlineBreak: { lengths: (n) => n <= 65 },
  climax: { backstories: CALM_BACKSTORIES }, // a climax has to be the fastest move on the chart
  doubleBreakout: { backstories: BACKSTORIES_EXCEPT('baseLast') },
  triangleBounce: { lengths: (n) => n >= 50, backstories: BACKSTORIES_EXCEPT('spike', 'chop') },
  fibPullback: { styles: ['wicky', 'building'] }, // long wicks blur where the swing ended
  cup: { styles: ['wicky'] },
}

function BACKSTORIES_EXCEPT(...not: Backstory[]) {
  return BACKSTORIES.filter((b) => !not.includes(b))
}

// The parts of a look this setup can use, for a card of this difficulty.
export function looksFor(setupKey: string, difficulty: Difficulty) {
  const limits = LIMITS[setupKey] ?? {}
  const lengths = LENGTHS[difficulty].filter((n) => limits.lengths?.(n) ?? true)
  return {
    lengths: lengths.length ? lengths : [60],
    backstories: limits.backstories ?? BACKSTORIES,
    styles: CANDLE_STYLES.filter((s) => !limits.styles?.includes(s)),
  }
}

// Hands out items from a shuffled bag, refilled when empty, so the same one
// doesn't come round again until the others have (the dealer uses it for looks).
export function cycler<T>(items: readonly T[], random: () => number): () => T {
  let bag: T[] = []
  return () => {
    if (bag.length === 0) {
      bag = [...items]
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j], bag[i]]
      }
    }
    return bag.pop()!
  }
}
