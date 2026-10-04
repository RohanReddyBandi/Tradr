import type { Bias, Candle, ChartCard, Difficulty, Finding, Shape } from '../types'
import { makeRng, type Rng } from './random'
import { SETUPS, type Blueprint, type SetupRecipe, type Waypoint } from './setups'
import { averageTrueRange } from './trade'
import {
  BACKSTORIES,
  CANDLE_STYLES,
  CHART_LENGTHS,
  candleStyle,
  cycler,
  looksFor,
  plantPatterns,
  tellBackstory,
  type Backstory,
  type CandleStyle,
  type Turn,
} from './variety'
import {
  DECOY_SIGNALS,
  SIGNAL_RECIPES,
  STRONG_SIGNALS,
  SUBTLE_SIGNALS,
  type Bar,
  type SignalKey,
} from './signalCandles'

export const VISIBLE_CANDLES = 60 // what you see before deciding (real charts; generated ones vary, see variety.ts)
export const FUTURE_CANDLES = 30 // what plays out after

// How often a setup plays out the way it points (on average across all
// difficulties). Good setups still fail now and then, which is why the
// Breakdown grades the decision and the outcome separately. (Real markets are
// less kind; this is set so a good read gets rewarded about 4 times in 5.)
export const SETUP_WIN_RATE = 0.8

// What changes between difficulty levels.
interface DifficultySettings {
  share: number // how often cards come out at this level
  noise: number // how much price wiggles between the pattern's key points
  wicks: number // how long the wicks are
  winRate: number // textbook setups work a little more often than messy ones
  exactTouches: boolean // do pattern lines land exactly on the wicks?
}

export const DIFFICULTY: Record<Difficulty, DifficultySettings> = {
  easy: { share: 0.3, noise: 0.65, wicks: 0.8, winRate: 0.83, exactTouches: true },
  medium: { share: 0.4, noise: 1, wicks: 1, winRate: 0.8, exactTouches: true },
  hard: { share: 0.3, noise: 1.4, wicks: 1.25, winRate: 0.77, exactTouches: false },
}

// Setups that are clear enough for easy cards, and the trickier ones hard cards lean on.
export const EASY_SETUPS = [
  'flag', 'double', 'triple', 'support', 'triangle', 'rectangle', 'rangeBreakout', 'doubleBreakout', 'channelBounce', 'breakoutRetest', 'chop',
]
export const TRICKY_SETUPS = [
  'falseBreak', 'wedge', 'headShoulders', 'structure', 'symTriangle', 'pennant', 'cup', 'rounding', 'choch', 'diamond', 'island',
  'exhaustionGap', 'broadeningWedge', 'trendlineBreak', 'climax', 'fibPullback', 'megaphone', 'squeeze',
]

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
// `profile` scales the wiggle candle by candle (volatility that builds or fades).
export function pathThrough(waypoints: Waypoint[], rng: Rng, noise = 1, profile: (i: number) => number = () => 1): number[] {
  const closes: number[] = []
  for (let w = 0; w < waypoints.length - 1; w++) {
    const a = waypoints[w]
    const b = waypoints[w + 1]
    const steps = b.at - a.at
    const wiggle = b.calm ? noise * 0.2 : noise * (b.hush ?? 1) // quiet stretches barely wiggle

    const walk = [0]
    for (let k = 1; k <= steps; k++) walk.push(walk[k - 1] + rng.noise() * R * 0.9 * wiggle * profile(a.at + k))

    for (let k = w === 0 ? 0 : 1; k <= steps; k++) {
      const straight = a.price + ((b.price - a.price) * k) / steps
      const wiggle = walk[k] - (walk[steps] * k) / steps // zero at k = 0 and at k = steps
      closes[a.at + k] = straight + wiggle
    }
  }
  return closes
}

// Turn closing prices into full candles: each opens near the previous close,
// and gets random wicks above and below its body. `quiet` candles get tiny
// wicks; a candle in `gaps` opens near its own close, after an overnight jump.
// `jitter` is how far opens stray from the last close; `profile` scales each
// candle's size (volatility that builds or fades across the chart).
function barsFromCloses(
  closes: number[],
  firstOpen: number,
  rng: Rng,
  wicks = 1,
  quiet: number[] = [], // how big each candle is (1 normal, 0.3 in a calm stretch)
  gaps = new Set<number>(),
  jitter = 1,
  profile: (i: number) => number = () => 1,
): Bar[] {
  return closes.map((close, i) => {
    const size = (quiet[i] ?? 1) * profile(i)
    let open = (i === 0 ? firstOpen : closes[i - 1]) + rng.noise() * R * 0.08 * size * jitter
    if (gaps.has(i)) open = close + rng.noise() * R * 0.3
    const upper = R * (0.06 + rng.next() * 0.32) * wicks * size
    const lower = R * (0.06 + rng.next() * 0.32) * wicks * size
    return { open, close, high: Math.max(open, close) + upper, low: Math.min(open, close) - lower }
  })
}

// Make sure each gap really is a gap: the candle after it must not reach back
// to the candle before it. Wicks are trimmed to leave a clear space.
function openGaps(bars: Bar[], gaps: Set<number>) {
  for (const g of gaps) {
    const [prev, c] = [bars[g - 1], bars[g]]
    if (c.close > prev.close) c.low = Math.max(c.low, Math.min(c.open, c.close, prev.high + 0.3 * R))
    else c.high = Math.min(c.high, Math.max(c.open, c.close, prev.low - 0.3 * R))
  }
}

// How big each candle is (small inside a `calm` or `hush` stretch), and which open after a gap.
function quietAndGaps(waypoints: Waypoint[], count: number) {
  const quiet: number[] = Array(count).fill(1)
  const gaps = new Set<number>()
  waypoints.forEach((w, k) => {
    if (w.gap) gaps.add(w.at)
    const size = w.calm ? 0.3 : w.hush
    if (size !== undefined && k > 0) for (let i = waypoints[k - 1].at + 1; i <= w.at; i++) quiet[i] = size
  })
  return { quiet, gaps }
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
// through the invalidation level. A setup that works shouldn't first swing hard
// against you (a sensible stop would never get to see it work), so those paths
// are redrawn if they dip more than about one ATR below the entry.
function buildFuture(from: number, blueprint: Blueprint, bias: Bias, worked: boolean, rng: Rng, settings: DifficultySettings, atr: number): Bar[] {
  let bars: Bar[] = []
  for (let attempt = 0; attempt < 15; attempt++) {
    bars = futureAttempt(from, blueprint, bias, worked, rng, settings)
    if (bias === 'neutral' || !worked) return bars
    const firstDays = bars.slice(0, 12)
    if (Math.min(...firstDays.map((b) => b.low)) >= from - 1.1 * atr) return bars
  }
  return bars
}

function futureAttempt(from: number, blueprint: Blueprint, bias: Bias, worked: boolean, rng: Rng, settings: DifficultySettings): Bar[] {
  let goal: number
  if (bias === 'neutral') {
    goal = from * (1 + (rng.chance(0.5) ? 1 : -1) * rng.range(0.015, 0.05))
  } else if (worked) {
    goal = Math.min(Math.max(blueprint.target, from * 1.03), from * 1.14)
  } else {
    goal = Math.min(blueprint.invalidation, from * 0.985) * (1 - rng.range(0.01, 0.03))
  }

  const reachedAt = rng.int(9, 18)
  const start = worked && bias !== 'neutral' ? from + Math.abs(rng.noise()) * R * 0.4 : from + rng.noise() * R * 0.5
  const waypoints: Waypoint[] = [{ at: 0, price: start }]
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
    case 'curve':
      return { ...shape, points: shape.points.map((p) => ({ ...p, price: price(p.price) })) }
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

// Which setup to build, and which way. Normally picked at random; the
// dealer (below) passes one in so the deck doesn't repeat itself.
export interface SetupTicket {
  key: string
  bias: Bias
}

// How a card looks, apart from its setup: its length, the backstory before
// the pattern, and the style of its candles (see variety.ts). Picked at
// random unless the dealer passes them in.
export interface Look {
  length: number
  backstory: Backstory
  style: CandleStyle
  // The candlestick pattern to finish on (the Learn tab's scenarios ask for a
  // particular one). Drawn bullish, and flipped with the chart on bearish cards.
  signal?: SignalKey
}

// A blueprint that fits the chart: waypoints in order, from the first candle to `end`.
const blueprintFits = (waypoints: Waypoint[], end: number) =>
  waypoints[0].at === 0 && waypoints[waypoints.length - 1].at === end && waypoints.every((w, k) => k === 0 || w.at > waypoints[k - 1].at)

// Easy cards get a big, obvious signal candle; hard cards get a quiet one,
// as long as the setup allows it.
function pickSignal(rng: Rng, options: SignalKey[], difficulty: Difficulty): SignalKey {
  const preferred = difficulty === 'easy' ? STRONG_SIGNALS : difficulty === 'hard' ? SUBTLE_SIGNALS : options
  const fits = options.filter((k) => preferred.includes(k))
  return rng.pick(fits.length ? fits : options)
}

// Flip a signal candle upside down (they're built around 0, so this is a sign flip).
const flipBar = (b: Bar): Bar => ({ open: -b.open, close: -b.close, high: -b.low, low: -b.high })

// `difficulty` and `ticket` can be forced (the dealer and tests do); otherwise
// they're picked at random.
export function generateCard(
  number: number,
  seed: number = randomSeed(),
  forcedDifficulty?: Difficulty,
  ticket?: SetupTicket,
  look: Partial<Look> = {},
): ChartCard {
  const rng = makeRng(seed)
  const difficulty = forcedDifficulty ?? pickDifficulty(rng)
  const recipe = ticket ? SETUPS.find((s) => s.key === ticket.key)! : pickSetup(rng, difficulty)
  const bias: Bias = recipe.neutral ? 'neutral' : ticket ? ticket.bias : rng.chance(0.5) ? 'bullish' : 'bearish'

  // Each card also gets its own look: its length, the backstory before the
  // pattern, and the style of its candles, on top of a little extra
  // randomness in how much price wiggles and how long the wicks are.
  // A few setups only read right in some looks; anything else is swapped for one that works.
  const allowed = looksFor(recipe.key, difficulty)
  const choose = <T,>(wanted: T | undefined, options: readonly T[]) => (wanted !== undefined && options.includes(wanted) ? wanted : rng.pick(options))
  let visible = choose(look.length, allowed.lengths)
  const backstory = choose(look.backstory, allowed.backstories)
  const style = candleStyle(choose(look.style, allowed.styles))
  const base = DIFFICULTY[difficulty]
  const settings = { ...base, noise: base.noise * rng.range(0.85, 1.2) * style.noise, wicks: base.wicks * rng.range(0.75, 1.35) * style.wicks }
  const profile = (i: number) => style.profile(i, visible)

  // 1. Pick the candlestick pattern that finishes the setup. We need its
  //    length first so the price path stops just before it. Hard choppy
  //    charts often end on a decoy: a strong candle, bullish or bearish,
  //    from the middle of the range, where it means little.
  const decoy = !look.signal && recipe.key === 'chop' && difficulty === 'hard' && rng.chance(0.7)
  const signalKey = look.signal ?? (decoy ? rng.pick(DECOY_SIGNALS) : pickSignal(rng, recipe.signals, difficulty))
  let signal = SIGNAL_RECIPES[signalKey](R, rng)
  if (decoy && rng.chance(0.5)) signal = signal.map(flipBar)
  let end = visible - signal.length - 1

  // 2. Draw the setup. Touch waypoints aim the close a bit inside the line,
  //    then applyTouches puts the wick exactly on it. Hard cards skip that
  //    step and nudge each touch a little, so the lines only roughly fit.
  //    (A setup too long for a short chart gets the standard 60 candles.)
  let blueprint = recipe.build(rng, end, R)
  if (!blueprintFits(blueprint.waypoints, end)) {
    visible = VISIBLE_CANDLES
    end = visible - signal.length - 1
    blueprint = recipe.build(rng, end, R)
  }
  const aimed = blueprint.waypoints.map((w) => {
    let price = w.touch === 'high' ? w.price - 0.3 * R : w.touch === 'low' ? w.price + 0.3 * R : w.price
    if (w.touch && !settings.exactTouches) price += rng.range(-0.4, 0.4) * R
    return { ...w, price }
  })
  const story = tellBackstory(backstory, aimed, rng, R)
  const closes = pathThrough(story.waypoints, rng, settings.noise, profile)
  const { quiet, gaps } = quietAndGaps(story.waypoints, closes.length)
  const bars = barsFromCloses(closes, closes[0], rng, settings.wicks, quiet, gaps, style.jitter, profile)
  if (settings.exactTouches) applyTouches(bars, blueprint.waypoints)
  openGaps(bars, gaps)
  // Most charts also get a candlestick pattern or two at earlier turning
  // points, well before the decision: in the backstory, or on the pattern's
  // own earlier swing points (a hammer on a double bottom's first low).
  const swings: Turn[] = blueprint.waypoints
    .filter((w) => w.touch && w.at <= end - 12)
    .map((w) => ({ at: w.at, kind: w.touch === 'low' ? 'bottom' : 'top', room: Infinity, exact: true }))
  const keepAsIs = new Set([...gaps, ...quiet.flatMap((q, i) => (q < 0.5 ? [i] : []))])
  if (rng.chance(0.85)) plantPatterns(bars, [...story.turns, ...swings], rng.int(1, 3), rng, R, end - 10, keepAsIs)

  // 3. Add the signal candles, shifted to start from the last close. They're
  //    drawn for a normal chart; after a very fast move (or a very quiet
  //    stretch) they're resized to match, or they'd look tiny (or huge) and
  //    the pattern detector wouldn't count them.
  const recentSize = bars.slice(-10).reduce((sum, b) => sum + b.high - b.low, 0) / 10 / R
  if (recentSize > 1.3 || recentSize < 0.7) {
    const k = Math.min(2.2, Math.max(0.35, recentSize))
    signal = signal.map((b) => ({ open: b.open * k, high: b.high * k, low: b.low * k, close: b.close * k }))
  }
  const lastClose = bars[bars.length - 1].close
  for (const b of signal) {
    bars.push({ open: b.open + lastClose, high: b.high + lastClose, low: b.low + lastClose, close: b.close + lastClose })
  }

  // 4. Decide whether this one works out, and build what happens next.
  const worked = rng.chance(bias === 'neutral' ? 0.5 : settings.winRate)
  const atr = averageTrueRange(bars.map((b, i) => ({ ...b, time: i })))
  const futureBars = buildFuture(bars[bars.length - 1].close, blueprint, bias, worked, rng, settings, atr)

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
    future: futureBars.map((b, k) => toCandle(b, visible + k)),
    setup: {
      key: recipe.key,
      name,
      bias,
      story: recipe.story(bias, prices, counts),
      chartFindings: blueprint.findings(baseCandles, bias).map((f) => mapFinding(f, price, flip)),
    },
  }
}

// ---------------------------------------------------------------------------
// Dealing: no repeats until you've seen everything
// ---------------------------------------------------------------------------

// Every setup in both directions (no-edge setups twice, so skipping stays a
// regular part of the game), shuffled like a deck of cards.
function freshBag(random: () => number): SetupTicket[] {
  const tickets = SETUPS.flatMap((s): SetupTicket[] =>
    s.neutral
      ? [{ key: s.key, bias: 'neutral' }, { key: s.key, bias: 'neutral' }]
      : [{ key: s.key, bias: 'bullish' }, { key: s.key, bias: 'bearish' }],
  )
  // Fisher-Yates shuffle: swap each position with a random earlier one.
  for (let i = tickets.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[tickets[i], tickets[j]] = [tickets[j], tickets[i]]
  }
  return tickets
}

// Deals generated cards from a shuffled bag, so no setup comes up twice
// (in the same direction) until every one has had its turn. Easy cards need
// an easy setup, and most hard cards get a tricky one, so the dealer takes
// the next ticket that fits when the bag still has one.
export function makeDealer(random: () => number = Math.random) {
  let bag: SetupTicket[] = []
  // Looks come from bags too, so two cards in a row rarely share a length,
  // backstory, or candle style.
  const nextLength = cycler(CHART_LENGTHS, random)
  const nextBackstory = cycler(BACKSTORIES, random)
  const nextStyle = cycler(CANDLE_STYLES, random)
  return function deal(number: number): ChartCard {
    if (bag.length === 0) bag = freshBag(random)
    const roll = random()
    const difficulty: Difficulty = roll < DIFFICULTY.easy.share ? 'easy' : roll < DIFFICULTY.easy.share + DIFFICULTY.medium.share ? 'medium' : 'hard'
    const wanted = difficulty === 'easy' ? EASY_SETUPS : difficulty === 'hard' && random() < 0.6 ? [...TRICKY_SETUPS, 'chop'] : null

    let pick = bag.length - 1
    if (wanted) {
      for (let k = bag.length - 1; k >= 0; k--) {
        if (wanted.includes(bag[k].key)) {
          pick = k
          break
        }
      }
    }
    const [ticket] = bag.splice(pick, 1)
    const fits = difficulty !== 'easy' || EASY_SETUPS.includes(ticket.key)
    const look = { length: nextLength(), backstory: nextBackstory(), style: nextStyle() }
    return generateCard(number, Math.floor(random() * 2 ** 32), fits ? difficulty : 'medium', ticket, look)
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
