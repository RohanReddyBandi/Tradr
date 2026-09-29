import type { Bias, Candle, ChartCard, Difficulty, Finding, Shape } from '../types'
import { makeRng, type Rng } from './random'
import { SETUPS, type Blueprint, type SetupRecipe, type Waypoint } from './setups'
import {
  DECOY_SIGNALS,
  SIGNAL_RECIPES,
  STRONG_SIGNALS,
  SUBTLE_SIGNALS,
  type Bar,
  type SignalKey,
} from './signalCandles'

export const VISIBLE_CANDLES = 60 // what you see before deciding
export const FUTURE_CANDLES = 30 // what plays out after

// How often a setup plays out the way it points (on average across all
// difficulties). Good setups still fail sometimes, which is why the
// Breakdown grades the decision and the outcome separately.
export const SETUP_WIN_RATE = 0.65

// What changes between difficulty levels.
interface DifficultySettings {
  share: number // how often cards come out at this level
  noise: number // how much price wiggles between the pattern's key points
  wicks: number // how long the wicks are
  winRate: number // textbook setups work a little more often than messy ones
  exactTouches: boolean // do pattern lines land exactly on the wicks?
}

export const DIFFICULTY: Record<Difficulty, DifficultySettings> = {
  easy: { share: 0.3, noise: 0.65, wicks: 0.8, winRate: 0.7, exactTouches: true },
  medium: { share: 0.4, noise: 1, wicks: 1, winRate: 0.65, exactTouches: true },
  hard: { share: 0.3, noise: 1.4, wicks: 1.25, winRate: 0.6, exactTouches: false },
}

// Setups that are clear enough for easy cards, and the trickier ones hard cards lean on.
const EASY_SETUPS = ['flag', 'double', 'support', 'triangle', 'chop']
const TRICKY_SETUPS = ['falseBreak', 'wedge', 'headShoulders', 'structure']

// Charts are built around a price of 100, where a typical candle spans 1.2.
const R = 1.2

const DAY = 24 * 60 * 60
const START_TIME = Date.UTC(2024, 0, 2) / 1000

// ---------------------------------------------------------------------------
// Drawing price paths
// ---------------------------------------------------------------------------

// Make a list of closing prices that passes through every waypoint.
// Between two waypoints price moves in a straight line plus a random wiggle.
// The wiggle is a random walk bent so it starts and ends at zero (a
// "Brownian bridge"), which is how the path lands exactly on each waypoint.
export function pathThrough(waypoints: Waypoint[], rng: Rng, noise = 1): number[] {
  const closes: number[] = []
  for (let w = 0; w < waypoints.length - 1; w++) {
    const a = waypoints[w]
    const b = waypoints[w + 1]
    const steps = b.at - a.at

    const walk = [0]
    for (let k = 1; k <= steps; k++) walk.push(walk[k - 1] + rng.noise() * R * 0.9 * noise)

    for (let k = w === 0 ? 0 : 1; k <= steps; k++) {
      const straight = a.price + ((b.price - a.price) * k) / steps
      const wiggle = walk[k] - (walk[steps] * k) / steps // zero at k = 0 and at k = steps
      closes[a.at + k] = straight + wiggle
    }
  }
  return closes
}

// Turn closing prices into full candles: each opens near the previous close,
// and gets random wicks above and below its body.
function barsFromCloses(closes: number[], firstOpen: number, rng: Rng, wicks = 1): Bar[] {
  return closes.map((close, i) => {
    const open = (i === 0 ? firstOpen : closes[i - 1]) + rng.noise() * R * 0.08
    const upper = R * (0.06 + rng.next() * 0.32) * wicks
    const lower = R * (0.06 + rng.next() * 0.32) * wicks
    return { open, close, high: Math.max(open, close) + upper, low: Math.min(open, close) - lower }
  })
}

// For "touch" waypoints, make that candle's wick end exactly on the waypoint
// price and keep its neighbours' wicks just short of it. That gives a clean
// swing high or low for trendlines to rest on.
function applyTouches(bars: Bar[], waypoints: Waypoint[]) {
  for (const w of waypoints) {
    if (!w.touch) continue
    const c = bars[w.at]
    const neighbours = [w.at - 2, w.at - 1, w.at + 1, w.at + 2].map((j) => bars[j]).filter(Boolean)

    if (w.touch === 'high') {
      c.open = Math.min(c.open, w.price - 0.1 * R)
      c.close = Math.min(c.close, w.price - 0.1 * R)
      c.high = w.price
      c.low = Math.min(c.low, c.open, c.close)
      for (const n of neighbours) n.high = Math.max(n.open, n.close, Math.min(n.high, w.price - 0.08 * R))
    } else {
      c.open = Math.max(c.open, w.price + 0.1 * R)
      c.close = Math.max(c.close, w.price + 0.1 * R)
      c.low = w.price
      c.high = Math.max(c.high, c.open, c.close)
      for (const n of neighbours) n.low = Math.min(n.open, n.close, Math.max(n.low, w.price + 0.08 * R))
    }
  }
}

// The 30 candles after the decision. Most of the time price heads for the
// setup's target; otherwise it fakes that way for a day or two, then fails
// through the invalidation level.
function buildFuture(from: number, blueprint: Blueprint, bias: Bias, worked: boolean, rng: Rng, settings: DifficultySettings): Bar[] {
  let goal: number
  if (bias === 'neutral') {
    goal = from * (1 + (rng.chance(0.5) ? 1 : -1) * rng.range(0.015, 0.05))
  } else if (worked) {
    goal = Math.min(Math.max(blueprint.target, from * 1.03), from * 1.14)
  } else {
    goal = Math.min(blueprint.invalidation, from * 0.985) * (1 - rng.range(0.01, 0.03))
  }

  const reachedAt = rng.int(9, 18)
  const waypoints: Waypoint[] = [{ at: 0, price: from + rng.noise() * R * 0.5 }]
  if (bias !== 'neutral' && !worked) waypoints.push({ at: 2, price: from + R * rng.range(0.3, 0.8) }) // the fake-out
  waypoints.push({ at: reachedAt, price: goal })
  waypoints.push({ at: FUTURE_CANDLES - 1, price: goal * (1 + rng.range(-0.02, 0.02)) })

  return barsFromCloses(pathThrough(waypoints, rng, settings.noise), from, rng, settings.wicks)
}

// ---------------------------------------------------------------------------
// Flipping and scaling
// ---------------------------------------------------------------------------

// Every setup is built bullish around 100. Bearish charts are mirrored across
// 100 (so 110 becomes 90), then everything is scaled to a random price level.
type PriceMap = (price: number) => number

function mapShape(shape: Shape, price: PriceMap, flip: boolean): Shape {
  switch (shape.kind) {
    case 'line':
      return { ...shape, from: { ...shape.from, price: price(shape.from.price) }, to: { ...shape.to, price: price(shape.to.price) } }
    case 'level':
      return { ...shape, price: price(shape.price) }
    case 'dot': {
      const place = flip ? (shape.place === 'above' ? 'below' : 'above') : shape.place
      return { ...shape, at: { ...shape.at, price: price(shape.at.price) }, place }
    }
    case 'candles':
      return shape
  }
}

function mapFinding(finding: Finding, price: PriceMap, flip: boolean): Finding {
  return {
    ...finding,
    shapes: finding.shapes.map((s) => mapShape(s, price, flip)),
    labelAt: finding.labelAt && { ...finding.labelAt, price: price(finding.labelAt.price) },
  }
}

// ---------------------------------------------------------------------------
// Putting it together
// ---------------------------------------------------------------------------

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 32)
}

function pickDifficulty(rng: Rng): Difficulty {
  const roll = rng.next()
  if (roll < DIFFICULTY.easy.share) return 'easy'
  if (roll < DIFFICULTY.easy.share + DIFFICULTY.medium.share) return 'medium'
  return 'hard'
}

function pickSetup(rng: Rng, difficulty: Difficulty): SetupRecipe {
  if (difficulty === 'easy') return rng.pick(SETUPS.filter((s) => EASY_SETUPS.includes(s.key)))
  if (difficulty === 'hard' && rng.chance(0.7)) {
    return rng.pick(SETUPS.filter((s) => TRICKY_SETUPS.includes(s.key) || s.key === 'chop'))
  }
  return rng.pick(SETUPS)
}

// Easy cards get a big, obvious signal candle; hard cards get a quiet one,
// as long as the setup allows it.
function pickSignal(rng: Rng, options: SignalKey[], difficulty: Difficulty): SignalKey {
  const preferred = difficulty === 'easy' ? STRONG_SIGNALS : difficulty === 'hard' ? SUBTLE_SIGNALS : options
  const fits = options.filter((k) => preferred.includes(k))
  return rng.pick(fits.length ? fits : options)
}

// Flip a signal candle upside down (they're built around 0, so this is a sign flip).
const flipBar = (b: Bar): Bar => ({ open: -b.open, close: -b.close, high: -b.low, low: -b.high })

// `difficulty` can be forced (for tests); normally it's picked at random.
export function generateCard(number: number, seed: number = randomSeed(), forcedDifficulty?: Difficulty): ChartCard {
  const rng = makeRng(seed)
  const difficulty = forcedDifficulty ?? pickDifficulty(rng)
  const settings = DIFFICULTY[difficulty]
  const recipe = pickSetup(rng, difficulty)
  const bias: Bias = recipe.key === 'chop' ? 'neutral' : rng.chance(0.5) ? 'bullish' : 'bearish'

  // 1. Pick the candlestick pattern that finishes the setup. We need its
  //    length first so the price path stops just before it. Hard choppy
  //    charts often end on a decoy: a strong candle, bullish or bearish,
  //    from the middle of the range, where it means little.
  const decoy = recipe.key === 'chop' && difficulty === 'hard' && rng.chance(0.7)
  const signalKey = decoy ? rng.pick(DECOY_SIGNALS) : pickSignal(rng, recipe.signals, difficulty)
  let signal = SIGNAL_RECIPES[signalKey](R, rng)
  if (decoy && rng.chance(0.5)) signal = signal.map(flipBar)
  const end = VISIBLE_CANDLES - signal.length - 1

  // 2. Draw the setup. Touch waypoints aim the close a bit inside the line,
  //    then applyTouches puts the wick exactly on it. Hard cards skip that
  //    step and nudge each touch a little, so the lines only roughly fit.
  const blueprint = recipe.build(rng, end, R)
  const aimed = blueprint.waypoints.map((w) => {
    let price = w.touch === 'high' ? w.price - 0.3 * R : w.touch === 'low' ? w.price + 0.3 * R : w.price
    if (w.touch && !settings.exactTouches) price += rng.range(-0.4, 0.4) * R
    return { ...w, price }
  })
  const closes = pathThrough(aimed, rng, settings.noise)
  const bars = barsFromCloses(closes, closes[0], rng, settings.wicks)
  if (settings.exactTouches) applyTouches(bars, blueprint.waypoints)

  // 3. Add the signal candles, shifted to start from the last close.
  const lastClose = bars[bars.length - 1].close
  for (const b of signal) {
    bars.push({ open: b.open + lastClose, high: b.high + lastClose, low: b.low + lastClose, close: b.close + lastClose })
  }

  // 4. Decide whether this one works out, and build what happens next.
  const worked = rng.chance(bias === 'neutral' ? 0.5 : settings.winRate)
  const futureBars = buildFuture(bars[bars.length - 1].close, blueprint, bias, worked, rng, settings)

  // 5. Mirror bearish charts and scale to a random price between about $18 and $300.
  const flip = bias === 'bearish'
  const scale = Math.exp(rng.range(Math.log(0.18), Math.log(3)))
  const price: PriceMap = (p) => Math.round((flip ? 200 - p : p) * scale * 100) / 100
  const toCandle = (b: Bar, i: number): Candle => ({
    time: START_TIME + i * DAY,
    open: price(b.open),
    close: price(b.close),
    high: price(flip ? b.low : b.high), // flipping turns wick tops into wick bottoms
    low: price(flip ? b.high : b.low),
  })

  const baseCandles = bars.map((b, i) => ({ ...b, time: START_TIME + i * DAY }))
  const counts = { ...blueprint.counts, signal: signal.length, decoy: decoy ? 1 : 0 }
  const name = bias === 'bearish' ? recipe.names.bearish : recipe.names.bullish
  const prices = Object.fromEntries(Object.entries(blueprint.prices).map(([k, v]) => [k, price(v)]))

  return {
    id: `card-${number}-${seed}`,
    number,
    source: 'generated',
    difficulty,
    difficultyNotes: difficulty === 'hard' ? hardNotes(recipe.key, name, signalKey, decoy) : [],
    candles: bars.map(toCandle),
    future: futureBars.map((b, k) => toCandle(b, VISIBLE_CANDLES + k)),
    setup: {
      key: recipe.key,
      name,
      bias,
      story: recipe.story(bias, prices, counts),
      chartFindings: blueprint.findings(baseCandles, bias).map((f) => mapFinding(f, price, flip)),
    },
  }
}

// What made a hard card hard, for the Breakdown to explain.
function hardNotes(setupKey: string, setupName: string, signal: SignalKey, decoy: boolean): string[] {
  const notes = ['the candles were noisier than usual', 'the pattern lines only roughly lined up with the wicks']
  if (decoy) notes.push('a big candle in the middle of the range was a decoy')
  else if (SUBTLE_SIGNALS.includes(signal)) notes.push('the signal candle was a quiet one')
  const article = /^[aeiou]/i.test(setupName) ? 'an' : 'a'
  if (TRICKY_SETUPS.includes(setupKey)) notes.push(`${article} ${setupName.toLowerCase()} is one of the harder setups to spot`)
  return notes
}
