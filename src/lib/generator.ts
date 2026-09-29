import type { Bias, Candle, ChartCard, Finding, Shape } from '../types'
import { makeRng, type Rng } from './random'
import { SETUPS, type Blueprint, type Waypoint } from './setups'
import { SIGNAL_RECIPES, type Bar } from './signalCandles'

export const VISIBLE_CANDLES = 60 // what you see before deciding
export const FUTURE_CANDLES = 30 // what plays out after

// How often a setup plays out the way it points. Good setups still fail
// sometimes, which is why the Breakdown grades the decision and the outcome
// separately.
export const SETUP_WIN_RATE = 0.65

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
export function pathThrough(waypoints: Waypoint[], rng: Rng): number[] {
  const closes: number[] = []
  for (let w = 0; w < waypoints.length - 1; w++) {
    const a = waypoints[w]
    const b = waypoints[w + 1]
    const steps = b.at - a.at

    const walk = [0]
    for (let k = 1; k <= steps; k++) walk.push(walk[k - 1] + rng.noise() * R * 0.9)

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
function barsFromCloses(closes: number[], firstOpen: number, rng: Rng): Bar[] {
  return closes.map((close, i) => {
    const open = (i === 0 ? firstOpen : closes[i - 1]) + rng.noise() * R * 0.08
    const upper = R * (0.06 + rng.next() * 0.32)
    const lower = R * (0.06 + rng.next() * 0.32)
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
function buildFuture(from: number, blueprint: Blueprint, bias: Bias, worked: boolean, rng: Rng): Bar[] {
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

  return barsFromCloses(pathThrough(waypoints, rng), from, rng)
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

export function generateCard(number: number, seed: number = randomSeed()): ChartCard {
  const rng = makeRng(seed)
  const recipe = rng.pick(SETUPS)
  const bias: Bias = recipe.key === 'chop' ? 'neutral' : rng.chance(0.5) ? 'bullish' : 'bearish'

  // 1. Pick the candlestick pattern that finishes the setup. We need its
  //    length first so the price path stops just before it.
  const signal = SIGNAL_RECIPES[rng.pick(recipe.signals)](R, rng)
  const end = VISIBLE_CANDLES - signal.length - 1

  // 2. Draw the setup. Touch waypoints aim the close a bit inside the line,
  //    then applyTouches puts the wick exactly on it.
  const blueprint = recipe.build(rng, end, R)
  const aimed = blueprint.waypoints.map((w) => ({
    ...w,
    price: w.touch === 'high' ? w.price - 0.3 * R : w.touch === 'low' ? w.price + 0.3 * R : w.price,
  }))
  const closes = pathThrough(aimed, rng)
  const bars = barsFromCloses(closes, closes[0], rng)
  applyTouches(bars, blueprint.waypoints)

  // 3. Add the signal candles, shifted to start from the last close.
  const lastClose = bars[bars.length - 1].close
  for (const b of signal) {
    bars.push({ open: b.open + lastClose, high: b.high + lastClose, low: b.low + lastClose, close: b.close + lastClose })
  }

  // 4. Decide whether this one works out, and build what happens next.
  const worked = rng.chance(bias === 'neutral' ? 0.5 : SETUP_WIN_RATE)
  const futureBars = buildFuture(bars[bars.length - 1].close, blueprint, bias, worked, rng)

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
  const counts = { ...blueprint.counts, signal: signal.length }
  const prices = Object.fromEntries(Object.entries(blueprint.prices).map(([k, v]) => [k, price(v)]))

  return {
    id: `card-${number}-${seed}`,
    number,
    source: 'generated',
    candles: bars.map(toCandle),
    future: futureBars.map((b, k) => toCandle(b, VISIBLE_CANDLES + k)),
    setup: {
      key: recipe.key,
      name: bias === 'bearish' ? recipe.names.bearish : recipe.names.bullish,
      bias,
      story: recipe.story(bias, prices, counts),
      chartFindings: blueprint.findings(baseCandles, bias).map((f) => mapFinding(f, price, flip)),
    },
  }
}
