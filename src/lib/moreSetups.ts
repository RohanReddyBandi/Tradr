import type { ChartPoint, Finding, Shape } from '../types'
import { BREAKOUT_SIGNALS, REVERSAL_SIGNALS } from './signalCandles'
import { dot, either, highest, lastCandles, level, line, lineThrough, lowest, money, percent, type SetupRecipe, type Waypoint } from './setupKit'

// More chart setups for the generator, written the same way as setups.ts:
// each one in its bullish form around a price of 100 (the generator flips it
// for the bearish version). `end` is the last candle before the signal
// candles, and `R` is a typical candle's size.

// A chart-pattern finding, with the name picked for the direction.
function finding(id: string, bias: Finding['bias'], names: [string, string], meanings: [string, string], shapes: Shape[], labelAt?: ChartPoint): Finding {
  return { id, type: 'chart', bias, name: either(bias, ...names), meaning: either(bias, ...meanings), shapes, labelAt }
}

const vBottom: SetupRecipe = {
  key: 'vBottom',
  names: { bullish: 'V-bottom', bearish: 'V-top' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const bottomAt = end - rng.int(6, 8)
    const topAt = bottomAt - rng.int(8, 10)
    const top = 112
    const bottom = top * (1 - rng.range(0.14, 0.18))
    const back = bottom + (top - bottom) * rng.range(0.6, 0.72) // how far it has climbed back by the end

    return {
      waypoints: [
        { at: 0, price: top * rng.range(0.95, 0.99) },
        { at: topAt, price: top, touch: 'high' },
        { at: bottomAt, price: bottom, touch: 'low' },
        { at: end, price: back },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        const low = lowest(cs, bottomAt - 1, bottomAt + 1)
        return [
          finding(
            'vBottom',
            bias,
            ['V-bottom', 'V-top'],
            [
              'A steep drop straight into an equally steep rally, with almost no time spent at the bottom. Sellers ran out all at once.',
              'A steep rally straight into an equally steep drop, with almost no time spent at the top. Buyers ran out all at once.',
            ],
            [line(highest(cs, topAt - 1, topAt + 1), low), line(low, { index: last, price: cs[last].close }), dot(low, either(bias, 'Bottom', 'Top'), 'below')],
            { index: topAt, price: top + R * 1.8 },
          ),
        ]
      },
      prices: { top, bottom },
      counts: { fallDays: bottomAt - topAt, climbDays: end - bottomAt },
      target: top + (top - bottom) * 0.15,
      invalidation: bottom + (top - bottom) * 0.3,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price dropped ${percent(p.top, p.bottom)} in ${c.fallDays} days, from about ${money(p.top)} to ${money(p.bottom)}, then turned straight back up and won back most of it in ${c.climbDays} days: a V-bottom. The ${lastCandles(c.signal)} kept pushing higher. A turn that sharp means the sellers ran out all at once.`,
      `Price jumped ${percent(p.top, p.bottom)} in ${c.fallDays} days, from about ${money(p.top)} to ${money(p.bottom)}, then turned straight back down and gave back most of it in ${c.climbDays} days: a V-top. The ${lastCandles(c.signal)} kept pushing lower. A turn that sharp means the buyers ran out all at once.`,
    ),
}

const diamond: SetupRecipe = {
  key: 'diamond',
  names: { bullish: 'Diamond bottom', bearish: 'Diamond top' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    // Swings that spread out and then pull back in: [candles from the start,
    // distance from the middle, high or low]. `size` stretches the whole diamond.
    const size = rng.range(0.75, 0.9)
    const start = end - 41
    const shape: [number, number, 'high' | 'low'][] = [
      [-6, -3, 'low'],
      [0, 6.5, 'high'],
      [7, -8.5, 'low'],
      [14, 13.5, 'high'],
      [21, -13.5, 'low'],
      [28, 4.5, 'high'],
      [35, -5.5, 'low'],
    ]
    const at = (k: number) => start + shape[k][0]
    const price = (k: number) => 100 + shape[k][1] * size

    return {
      waypoints: [
        { at: 0, price: 100 + 22 * size },
        ...shape.map(([dx, dy, touch]): Waypoint => ({ at: start + dx, price: 100 + dy * size, touch })),
        { at: end, price: 100 + size },
      ],
      findings: (cs, bias) => {
        const pts = shape.map((_, k) => (shape[k][2] === 'high' ? highest(cs, at(k) - 1, at(k) + 1) : lowest(cs, at(k) - 1, at(k) + 1)))
        return [
          finding(
            'diamond',
            bias,
            ['Diamond bottom', 'Diamond top'],
            [
              'After a drop, the swings first spread out, then pulled back in, drawing a diamond. The wild swinging calmed down and buyers took over.',
              'After a rise, the swings first spread out, then pulled back in, drawing a diamond. The wild swinging calmed down and sellers took over.',
            ],
            [line(pts[1], pts[3]), line(pts[3], pts[5]), line(pts[2], pts[4]), line(pts[4], pts[6])],
            { index: at(3), price: price(3) + R * 1.8 },
          ),
        ]
      },
      prices: { top: price(3), bottom: price(4) },
      target: price(3),
      invalidation: price(6) - R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `After sliding lower, price started swinging wider and wider, out to ${money(p.top)} and down to ${money(p.bottom)}, then the swings tightened again. That diamond shape shows a fight that settled down, and the ${lastCandles(c.signal)} broke out above its upper right edge: a diamond bottom.`,
      `After climbing, price started swinging wider and wider, out to ${money(p.top)} and up to ${money(p.bottom)}, then the swings tightened again. That diamond shape shows a fight that settled down, and the ${lastCandles(c.signal)} broke down below its lower right edge: a diamond top.`,
    ),
}

const island: SetupRecipe = {
  key: 'island',
  names: { bullish: 'Island bottom', bearish: 'Island top' },
  signals: ['gapUp'], // the gap back up is the signal
  build(rng, end, R) {
    const days = rng.int(4, 6)
    const downAt = end - days + 1 // the first stranded candle
    const before = 100
    const island = before - rng.range(3.2, 4) * R

    return {
      waypoints: [
        { at: 0, price: before * rng.range(1.12, 1.16) },
        { at: downAt - 12, price: before * rng.range(1.04, 1.06) },
        { at: downAt - 1, price: before },
        { at: downAt, price: island, gap: true },
        { at: end, price: island + rng.range(-0.2, 0.2) * R, calm: true },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        const top = highest(cs, downAt, end)
        return [
          finding(
            'island',
            bias,
            ['Island bottom', 'Island top'],
            [
              'Price gapped down, sat stranded below the gap for a few days, then gapped back up. The candles in between are left alone like an island.',
              'Price gapped up, sat stranded above the gap for a few days, then gapped back down. The candles in between are left alone like an island.',
            ],
            [level(cs[downAt - 1].low, downAt - 4, last, 'Gap'), level(top.price, downAt - 1, end + 1, either(bias, 'Island', 'Island'))],
            { index: downAt - 6, price: before + R * 2.4 },
          ),
        ]
      },
      prices: { before, island },
      counts: { days },
      target: before + 3 * R,
      invalidation: island - R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price slid, then gapped down from about ${money(p.before)} to ${money(p.island)} and sat there for ${c.days} days. The last candle gapped straight back up, leaving those days stranded on an island. Everyone who sold into the gap down is now trapped below: an island bottom.`,
      `Price climbed, then gapped up from about ${money(p.before)} to ${money(p.island)} and sat there for ${c.days} days. The last candle gapped straight back down, leaving those days stranded on an island. Everyone who bought into the gap up is now trapped above: an island top.`,
    ),
}

const runawayGap: SetupRecipe = {
  key: 'runawayGap',
  names: { bullish: 'Runaway gap up', bearish: 'Runaway gap down' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const gapAt = end - rng.int(1, 2)
    const startAt = rng.int(8, 14)
    const slope = rng.range(0.7, 0.9) * R // how far the trend climbs per candle
    const trend = (i: number) => 100 + slope * (i - startAt)
    const jump = rng.range(2.4, 3) * R
    const dipAt = Math.round((startAt + gapAt) / 2)

    return {
      waypoints: [
        { at: 0, price: 100 + rng.range(-1, 1) * R },
        { at: startAt, price: 100, touch: 'low' },
        { at: dipAt - 3, price: trend(dipAt - 3) + R },
        { at: dipAt, price: trend(dipAt) - 1.5 * R },
        { at: gapAt - 1, price: trend(gapAt - 1) },
        { at: gapAt, price: trend(gapAt) + jump, gap: true },
        { at: end, price: trend(end) + jump },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          finding(
            'runawayGap',
            bias,
            ['Runaway gap up', 'Runaway gap down'],
            [
              'In the middle of a strong uptrend, price gapped up again. Buyers were so keen they skipped prices, which often means the trend has further to run.',
              'In the middle of a strong downtrend, price gapped down again. Sellers were so keen they skipped prices, which often means the trend has further to run.',
            ],
            [line({ index: startAt, price: cs[startAt].low }, { index: gapAt - 1, price: cs[gapAt - 1].close }, either(bias, 'Uptrend', 'Downtrend')), level(cs[gapAt - 1].high, gapAt - 1, last, 'Gap')],
            { index: startAt + 4, price: trend(startAt + 4) + R * 3 },
          ),
        ]
      },
      prices: { start: 100, before: trend(gapAt - 1) },
      counts: { days: gapAt - startAt },
      target: trend(end) + jump + 6 * R,
      invalidation: trend(gapAt - 1) - R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price had climbed steadily for ${c.days} days, from about ${money(p.start)} to ${money(p.before)}, and then gapped up again. A gap in the middle of a strong trend is a runaway gap: buyers are keen enough to skip prices, and the gap stayed open. The ${lastCandles(c.signal)} kept going.`,
      `Price had fallen steadily for ${c.days} days, from about ${money(p.start)} to ${money(p.before)}, and then gapped down again. A gap in the middle of a strong trend is a runaway gap: sellers are keen enough to skip prices, and the gap stayed open. The ${lastCandles(c.signal)} kept going.`,
    ),
}

const exhaustionGap: SetupRecipe = {
  key: 'exhaustionGap',
  names: { bullish: 'Exhaustion gap down', bearish: 'Exhaustion gap up' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const gapAt = end - rng.int(4, 5)
    const slideDays = rng.int(22, 26)
    const slideStart = gapAt - 1 - slideDays
    const before = 100
    const top = before + rng.range(0.5, 0.65) * R * slideDays
    const jump = rng.range(2.2, 2.8) * R

    return {
      waypoints: [
        { at: 0, price: top * rng.range(0.99, 1.01) },
        { at: slideStart, price: top },
        { at: gapAt - 1, price: before },
        { at: gapAt, price: before - jump, gap: true },
        { at: gapAt + 1, price: before - jump - 0.4 * R },
        { at: end, price: before + rng.range(0.8, 1.5) * R },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          finding(
            'exhaustionGap',
            bias,
            ['Exhaustion gap down', 'Exhaustion gap up'],
            [
              'After a long slide, price gapped down one last time, then climbed straight back and filled the gap. The final burst of selling ran out.',
              'After a long run up, price gapped up one last time, then fell straight back and filled the gap. The final burst of buying ran out.',
            ],
            [line({ index: slideStart, price: top }, { index: gapAt - 1, price: cs[gapAt - 1].close }, either(bias, 'Slide', 'Run up')), level(cs[gapAt - 1].low, gapAt - 1, last, 'Gap, now filled')],
            { index: slideStart + 3, price: top + R * 2 },
          ),
        ]
      },
      prices: { top, before },
      counts: { days: slideDays },
      target: before + 5 * R,
      invalidation: before - jump - R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price slid for ${c.days} days, from about ${money(p.top)} to ${money(p.before)}, then gapped down one more time. But instead of falling further, it climbed straight back and filled the gap. A last gap that gets filled this fast is an exhaustion gap: the sellers ran out, and the ${lastCandles(c.signal)} pushed higher.`,
      `Price climbed for ${c.days} days, from about ${money(p.top)} to ${money(p.before)}, then gapped up one more time. But instead of climbing further, it fell straight back and filled the gap. A last gap that gets filled this fast is an exhaustion gap: the buyers ran out, and the ${lastCandles(c.signal)} pushed lower.`,
    ),
}

// Swings back and forth around 100, up to `until`, starting at `from`.
function zigzag(rng: Parameters<SetupRecipe['build']>[0], from: number, until: number, half: number): Waypoint[] {
  const points: Waypoint[] = []
  let side = rng.chance(0.5) ? 1 : -1
  for (let i = from; i < until; i += rng.int(4, 6)) {
    points.push({ at: i, price: 100 + side * half * rng.range(0.65, 1) })
    side *= -1
  }
  return points
}

const squeeze: SetupRecipe = {
  key: 'squeeze',
  names: { bullish: 'Volatility squeeze', bearish: 'Volatility squeeze' },
  neutral: true,
  signals: ['doji', 'spinningTop'],
  build(rng, end, R) {
    const quietFrom = end - rng.int(9, 11)
    const half = rng.range(3, 3.8) * R

    return {
      waypoints: [
        { at: 0, price: 100 + rng.range(-1, 1) * R },
        ...zigzag(rng, rng.int(3, 5), quietFrom - 3, half),
        { at: quietFrom, price: 100 + rng.range(-0.5, 0.5) * R },
        { at: end, price: 100 + rng.range(-0.4, 0.4) * R, calm: true },
      ],
      findings: (cs) => {
        const last = cs.length - 1
        const top = highest(cs, quietFrom, last).price
        const bottom = lowest(cs, quietFrom, last).price
        return [
          {
            id: 'squeeze',
            type: 'chart',
            bias: 'neutral',
            name: 'Volatility squeeze',
            meaning: 'The candles shrank to a fraction of their usual size. Quiet stretches like this tend to end with a burst, but nothing says which way.',
            shapes: [level(top, quietFrom, last, 'Squeeze'), level(bottom, quietFrom, last)],
            labelAt: { index: quietFrom - 6, price: 100 + half + R * 1.6 },
          },
        ]
      },
      prices: { low: 100 - half, high: 100 + half },
      counts: { days: end - quietFrom },
      target: 100,
      invalidation: 100,
    }
  },
  story: (_bias, p, c) =>
    `Price had been swinging between about ${money(p.low)} and ${money(p.high)}, then went unusually quiet for the last ${c.days} days: tiny candles, no direction. A squeeze like this often ends with a big move, but nothing on the chart says which way. The right call is to wait for the break.`,
}

const megaphone: SetupRecipe = {
  key: 'megaphone',
  names: { bullish: 'Broadening formation', bearish: 'Broadening formation' },
  neutral: true,
  signals: ['doji', 'spinningTop', 'longLeggedDoji'],
  build(rng, end, R) {
    const step = rng.int(7, 8)
    const start = end - step * 6 - rng.int(1, 2)
    const grow = rng.range(0.9, 1.3) * R // how much wider each swing gets
    const swing = (k: number): Waypoint =>
      k % 2 === 0
        ? { at: start + k * step, price: 100 + 2 * R + (k / 2) * grow, touch: 'high' }
        : { at: start + k * step, price: 100 - 2.5 * R - ((k - 1) / 2) * grow, touch: 'low' }

    return {
      waypoints: [{ at: 0, price: 100 + rng.range(-1, 1) * R }, ...[0, 1, 2, 3, 4, 5].map(swing), { at: end, price: 100 + rng.range(-0.5, 0.5) * R }],
      findings: (cs) => {
        const last = cs.length - 1
        const highs = [0, 2, 4].map((k) => highest(cs, start + k * step - 1, start + k * step + 1))
        const lows = [1, 3, 5].map((k) => lowest(cs, start + k * step - 1, start + k * step + 1))
        const upper = lineThrough(highs[0], highs[2])
        const lower = lineThrough(lows[0], lows[2])
        return [
          {
            id: 'megaphone',
            type: 'chart',
            bias: 'neutral',
            name: 'Broadening formation',
            meaning: 'Each swing went higher and lower than the last, like a megaphone. Nobody is in control, and the swings keep getting bigger.',
            shapes: [
              line(highs[0], { index: last, price: upper(last) }),
              line(lows[0], { index: last, price: lower(last) }),
            ],
            labelAt: { index: start + 2, price: upper(start + 2) + R * 2 },
          },
        ]
      },
      prices: {},
      target: 100,
      invalidation: 100,
    }
  },
  story: () =>
    `The swings kept getting bigger: each rally went higher and each drop went lower than the one before, like a megaphone. That's a broadening formation, a sign that nobody is in control. With price back in the middle of it, there's no edge either way.`,
}

const broadeningWedge: SetupRecipe = {
  key: 'broadeningWedge',
  names: { bullish: 'Descending broadening wedge', bearish: 'Ascending broadening wedge' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const step = rng.int(6, 7)
    const start = end - step * 6 - 1
    // Both lines fall, the lower one faster, so they spread apart.
    const upper = (i: number) => 112 - 0.12 * R * (i - start)
    const lower = (i: number) => 112 - 2.5 * R - 0.34 * R * (i - start)
    const points: Waypoint[] = [0, 1, 2, 3, 4, 5].map((k) => {
      const at = start + k * step
      return k % 2 === 0 ? { at, price: upper(at), touch: 'high' } : { at, price: lower(at), touch: 'low' }
    })

    return {
      waypoints: [{ at: 0, price: upper(start) + rng.range(3, 5) * R }, ...points, { at: end, price: upper(end) - 0.4 * R }],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          finding(
            'broadeningWedge',
            bias,
            ['Descending broadening wedge', 'Ascending broadening wedge'],
            [
              'Both lines fell, but they spread apart: each drop went deeper while the bounces got bigger. The downtrend is losing its grip, and these usually break out upward.',
              'Both lines rose, but they spread apart: each rally went higher while the dips got deeper. The uptrend is losing its grip, and these usually break down.',
            ],
            [
              line({ index: start, price: upper(start) }, { index: last, price: upper(last) }),
              line({ index: start + step, price: lower(start + step) }, { index: last, price: lower(last) }),
            ],
            { index: start + 2, price: upper(start + 2) + R * 1.8 },
          ),
        ]
      },
      prices: {},
      target: upper(start),
      invalidation: upper(end) - 3 * R,
    }
  },
  story: (bias, _p, c) =>
    either(
      bias,
      `Price kept making lower highs and lower lows, but the lows fell faster than the highs, so the swings spread apart: a descending broadening wedge. The sellers were pushing harder and getting less for it. The ${lastCandles(c.signal)} broke out above the upper line.`,
      `Price kept making higher highs and higher lows, but the highs rose faster than the lows, so the swings spread apart: an ascending broadening wedge. The buyers were pushing harder and getting less for it. The ${lastCandles(c.signal)} broke down below the lower line.`,
    ),
}

const channelBounce: SetupRecipe = {
  key: 'channelBounce',
  names: { bullish: 'Ascending channel bounce', bearish: 'Descending channel rejection' },
  signals: REVERSAL_SIGNALS,
  build(rng, end, R) {
    const step = rng.int(6, 7)
    const start = end - step * 6
    const slope = 100 * rng.range(0.0035, 0.005)
    const width = rng.range(4.5, 5.5) * R
    const lower = (i: number) => 100 + slope * (i - start)
    const upper = (i: number) => lower(i) + width
    const touches: Waypoint[] = [0, 1, 2, 3, 4, 5].map((k) => {
      const at = start + k * step
      return k % 2 === 0 ? { at, price: lower(at), touch: 'low' } : { at, price: upper(at), touch: 'high' }
    })

    return {
      waypoints: [{ at: 0, price: lower(start) - rng.range(1, 3) * R }, ...touches, { at: end, price: lower(end) + 0.35 * R }],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          finding(
            'channelBounce',
            bias,
            ['Ascending channel', 'Descending channel'],
            [
              'Price climbed between two parallel rising lines, and just pulled back to the bottom one again. Buying near the bottom line has worked every time so far.',
              'Price fell between two parallel falling lines, and just bounced back to the top one again. Selling near the top line has worked every time so far.',
            ],
            [
              line({ index: start, price: lower(start) }, { index: last, price: lower(last) }),
              line({ index: start + step, price: upper(start + step) }, { index: last, price: upper(last) }),
            ],
            { index: start + 3, price: upper(start + 3) + R * 1.8 },
          ),
        ]
      },
      prices: { line: lower(end) },
      target: upper(end),
      invalidation: lower(end) - 1.5 * R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price was climbing inside a channel: two parallel rising lines, touched three times each. It just pulled back to the bottom line again, near ${money(p.line)}, and the ${lastCandles(c.signal)} show buyers stepping in there once more.`,
      `Price was falling inside a channel: two parallel falling lines, touched three times each. It just bounced back to the top line again, near ${money(p.line)}, and the ${lastCandles(c.signal)} show sellers stepping in there once more.`,
    ),
}

const breakoutRetest: SetupRecipe = {
  key: 'breakoutRetest',
  names: { bullish: 'Breakout retest', bearish: 'Breakdown retest' },
  signals: REVERSAL_SIGNALS,
  build(rng, end, R) {
    const ceiling = 104
    const first = end - rng.int(34, 38)
    const second = first + rng.int(9, 11)
    const breakAt = second + rng.int(8, 10)
    const peakAt = breakAt + rng.int(4, 5)
    const peak = ceiling + rng.range(4.5, 5.5) * R

    return {
      waypoints: [
        { at: 0, price: ceiling - rng.range(5, 7) * R },
        { at: first - 6, price: ceiling - 3 * R },
        { at: first, price: ceiling, touch: 'high' },
        { at: first + 5, price: ceiling - rng.range(3, 4) * R },
        { at: second, price: ceiling, touch: 'high' },
        { at: second + 4, price: ceiling - rng.range(2.5, 3.5) * R },
        { at: breakAt, price: ceiling + R },
        { at: peakAt, price: peak, touch: 'high' },
        { at: end, price: ceiling + 0.4 * R },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          finding(
            'breakoutRetest',
            bias,
            ['Breakout retest', 'Breakdown retest'],
            [
              'Price broke above a ceiling it had failed at twice, then came back down to test it from above. Old resistance often turns into new support.',
              'Price broke below a floor it had held at twice, then came back up to test it from below. Old support often turns into new resistance.',
            ],
            [
              level(ceiling, first - 3, last, either(bias, 'Old resistance, new support', 'Old support, new resistance')),
              dot(highest(cs, first - 1, first + 1), '', 'above'),
              dot(highest(cs, second - 1, second + 1), '', 'above'),
            ],
            { index: breakAt + 1, price: peak + R * 1.6 },
          ),
        ]
      },
      prices: { ceiling, peak },
      target: peak,
      invalidation: ceiling - 1.5 * R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price failed at ${money(p.ceiling)} twice, then broke through and ran to about ${money(p.peak)}. It has now come back down to ${money(p.ceiling)} to test it from above, and the ${lastCandles(c.signal)} show buyers defending it. When old resistance holds as new support, the breakout usually carries on.`,
      `Price held at ${money(p.ceiling)} twice, then broke through and fell to about ${money(p.peak)}. It has now come back up to ${money(p.ceiling)} to test it from below, and the ${lastCandles(c.signal)} show sellers defending it. When old support holds as new resistance, the breakdown usually carries on.`,
    ),
}

const rangeBreakout: SetupRecipe = {
  key: 'rangeBreakout',
  names: { bullish: 'Range breakout', bearish: 'Range breakdown' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const floor = 100
    const ceiling = floor * (1 + rng.range(0.05, 0.065))
    const start = rng.int(4, 7)
    const waypoints: Waypoint[] = [{ at: 0, price: (floor + ceiling) / 2 + rng.range(-1, 1) * R }]
    let side: 'high' | 'low' = rng.chance(0.5) ? 'high' : 'low'
    for (let i = start; i < end - 4; i += rng.int(6, 7)) {
      waypoints.push({ at: i, price: side === 'high' ? ceiling : floor, touch: side })
      side = side === 'high' ? 'low' : 'high'
    }
    waypoints.push({ at: end, price: ceiling - 0.45 * R })

    return {
      waypoints,
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          finding(
            'rangeBreakout',
            bias,
            ['Range breakout', 'Range breakdown'],
            [
              'Price bounced between the same floor and ceiling for weeks, with no trend. A close above the ceiling ends the range and often starts a trend.',
              'Price bounced between the same floor and ceiling for weeks, with no trend. A close below the floor ends the range and often starts a trend.',
            ],
            [level(ceiling, start - 2, last, either(bias, 'Ceiling', 'Floor')), level(floor, start - 2, last, either(bias, 'Floor', 'Ceiling'))],
            { index: start + 5, price: ceiling + R * 1.8 },
          ),
        ]
      },
      prices: { floor, ceiling },
      target: ceiling + (ceiling - floor),
      invalidation: ceiling - 1.5 * R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `For weeks price went nowhere, bouncing between about ${money(p.floor)} and ${money(p.ceiling)}. The ${lastCandles(c.signal)} finally closed above the ceiling. A breakout from a long, flat range often starts a new trend.`,
      `For weeks price went nowhere, bouncing between about ${money(p.ceiling)} and ${money(p.floor)}. The ${lastCandles(c.signal)} finally closed below the floor. A breakdown from a long, flat range often starts a new trend.`,
    ),
}

const trendlineBreak: SetupRecipe = {
  key: 'trendlineBreak',
  names: { bullish: 'Downtrend line break', bearish: 'Uptrend line break' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const start = rng.int(8, 12)
    const slope = 100 * rng.range(0.004, 0.0055) // how fast the line falls per candle
    const top = (i: number) => 115 - slope * (i - start)
    const second = start + rng.int(11, 13)
    const third = second + rng.int(11, 13)
    const dip = (at: number, depth: number): Waypoint => ({ at, price: top(at) - depth * R })

    return {
      waypoints: [
        { at: 0, price: top(start) - rng.range(2, 4) * R },
        { at: start, price: top(start), touch: 'high' },
        dip(start + 6, rng.range(5, 7)),
        { at: second, price: top(second), touch: 'high' },
        dip(second + 6, rng.range(5, 7)),
        { at: third, price: top(third), touch: 'high' },
        dip(third + 6, rng.range(4, 5.5)),
        { at: end, price: top(end) - 0.4 * R },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          finding(
            'trendlineBreak',
            bias,
            ['Downtrend line break', 'Uptrend line break'],
            [
              'A falling trendline had capped every bounce three times. Price just closed above it: the first real sign the downtrend is over.',
              'A rising trendline had caught every dip three times. Price just closed below it: the first real sign the uptrend is over.',
            ],
            [
              line({ index: start, price: top(start) }, { index: last, price: top(last) }, 'Trendline'),
              dot(highest(cs, start - 1, start + 1), '', 'above'),
              dot(highest(cs, second - 1, second + 1), '', 'above'),
              dot(highest(cs, third - 1, third + 1), '', 'above'),
            ],
            { index: start + 3, price: top(start + 3) + R * 1.8 },
          ),
        ]
      },
      prices: { line: top(end) },
      target: top(second),
      invalidation: top(end) - 3 * R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Every bounce for weeks had stopped at the same falling line: three touches, each lower than the last. The ${lastCandles(c.signal)} closed above that line near ${money(p.line)}. Breaking a trendline that has held three times is often the first sign a downtrend is over.`,
      `Every dip for weeks had stopped at the same rising line: three touches, each higher than the last. The ${lastCandles(c.signal)} closed below that line near ${money(p.line)}. Breaking a trendline that has held three times is often the first sign an uptrend is over.`,
    ),
}

const climax: SetupRecipe = {
  key: 'climax',
  names: { bullish: 'Selling climax', bearish: 'Buying climax' },
  signals: REVERSAL_SIGNALS,
  build(rng, end, R) {
    const panicFrom = end - 7
    const slow = rng.range(0.3, 0.4) * R // the steady slide, per candle
    const panic = rng.range(8, 10) * R // the fast drop at the end
    const before = 100

    return {
      waypoints: [
        { at: 0, price: before + slow * panicFrom },
        { at: Math.round(panicFrom / 2), price: before + (slow * panicFrom) / 2 + rng.range(-0.5, 1) * R },
        { at: panicFrom, price: before },
        { at: end, price: before - panic },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        const low = lowest(cs, end - 1, last)
        return [
          finding(
            'climax',
            bias,
            ['Selling climax', 'Buying climax'],
            [
              'A steady slide suddenly sped up into a panic drop, and then buyers pushed back. When everyone who wants out sells at once, there is often no one left to sell.',
              'A steady climb suddenly sped up into a frenzied spike, and then sellers pushed back. When everyone who wants in buys at once, there is often no one left to buy.',
            ],
            [
              line({ index: 0, price: cs[0].close }, { index: panicFrom, price: cs[panicFrom].close }, either(bias, 'Slide', 'Climb')),
              line({ index: panicFrom, price: cs[panicFrom].close }, low, either(bias, 'Panic', 'Frenzy')),
              dot(low, either(bias, 'Climax low', 'Climax high'), 'below'),
            ],
          ),
        ]
      },
      prices: { before, low: before - panic },
      counts: { days: end - panicFrom },
      target: before - panic * 0.35,
      invalidation: before - panic - R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price had been sliding slowly, then in the last ${c.days} days it collapsed from about ${money(p.before)} to ${money(p.low)}, far faster than before. A drop that speeds up like that is often panic selling, and the ${lastCandles(c.signal)} show buyers finally pushing back: a selling climax.`,
      `Price had been climbing slowly, then in the last ${c.days} days it shot up from about ${money(p.before)} to ${money(p.low)}, far faster than before. A rise that speeds up like that is often a buying frenzy, and the ${lastCandles(c.signal)} show sellers finally pushing back: a buying climax.`,
    ),
}

const highTightFlag: SetupRecipe = {
  key: 'highTightFlag',
  names: { bullish: 'High and tight flag', bearish: 'Low and tight flag' },
  signals: ['bullishMarubozu', 'threeWhiteSoldiers', 'risingWindow', 'gapUp'],
  build(rng, end, R) {
    const flagLength = rng.int(5, 7)
    const poleLength = rng.int(6, 8)
    const poleTop = end - flagLength
    const poleBottom = poleTop - poleLength
    const base = 100
    const top = base * (1 + rng.range(0.22, 0.3))
    const pole = top - base

    return {
      waypoints: [
        { at: 0, price: base * rng.range(0.96, 0.99) },
        { at: poleBottom, price: base, touch: 'low' },
        { at: poleTop, price: top, touch: 'high' },
        { at: poleTop + rng.int(2, 3), price: top - pole * rng.range(0.15, 0.22) },
        { at: end, price: top - pole * rng.range(0.06, 0.1) },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        const flagLow = lowest(cs, poleTop + 1, end)
        return [
          finding(
            'highTightFlag',
            bias,
            ['High and tight flag', 'Low and tight flag'],
            [
              'A huge, fast rally (the pole), then only a short, shallow pause near the top. Buyers barely let go, which is why these often keep going.',
              'A huge, fast drop (the pole), then only a short, shallow pause near the bottom. Sellers barely let go, which is why these often keep going.',
            ],
            [
              line({ index: poleBottom, price: cs[poleBottom].low }, { index: poleTop, price: cs[poleTop].high }, 'Pole'),
              level(cs[poleTop].high, poleTop, last),
              level(flagLow.price, poleTop + 1, last, 'Flag'),
            ],
            { index: poleBottom + 1, price: top + R * 1.6 },
          ),
        ]
      },
      prices: { base, top },
      counts: { poleDays: poleLength, flagDays: flagLength },
      target: top + pole * 0.5,
      invalidation: top - pole * 0.35,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price rocketed ${percent(p.base, p.top)} in just ${c.poleDays} days, then paused for only ${c.flagDays} days and barely gave any of it back. That's a high and tight flag, one of the strongest continuation patterns, and the ${lastCandles(c.signal)} broke out of the pause.`,
      `Price plunged ${percent(p.base, p.top)} in just ${c.poleDays} days, then paused for only ${c.flagDays} days and barely won any of it back. That's a low and tight flag, one of the strongest continuation patterns, and the ${lastCandles(c.signal)} broke down out of the pause.`,
    ),
}

const doubleBreakout: SetupRecipe = {
  key: 'doubleBreakout',
  names: { bullish: 'Double bottom breakout', bearish: 'Double top breakdown' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const low = 100
    const secondAt = end - rng.int(6, 7)
    const neckAt = secondAt - rng.int(8, 10)
    const firstAt = neckAt - rng.int(8, 10)
    const neck = low * (1 + rng.range(0.06, 0.08))
    const start = low * (1 + rng.range(0.14, 0.18))

    return {
      waypoints: [
        { at: 0, price: start },
        { at: firstAt, price: low, touch: 'low' },
        { at: neckAt, price: neck, touch: 'high' },
        { at: secondAt, price: low * 1.003, touch: 'low' },
        { at: end, price: neck - 0.4 * R },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          finding(
            'doubleBreakout',
            bias,
            ['Double bottom', 'Double top'],
            [
              'Two lows at the same price with a bounce in between, and now a close above the middle peak (the neckline). That close is what confirms a double bottom.',
              'Two highs at the same price with a dip in between, and now a close below the middle low (the neckline). That close is what confirms a double top.',
            ],
            [
              level(low, firstAt - 3, last, either(bias, 'Support', 'Resistance')),
              level(highest(cs, neckAt - 1, neckAt + 1).price, neckAt - 3, last, 'Neckline'),
              dot(lowest(cs, firstAt - 1, firstAt + 1), either(bias, '1st low', '1st high'), 'below'),
              dot(lowest(cs, secondAt - 1, secondAt + 1), either(bias, '2nd low', '2nd high'), 'below'),
            ],
            { index: Math.round((firstAt + neckAt) / 2), price: neck + R * 1.8 },
          ),
        ]
      },
      prices: { low, neck },
      target: neck + (neck - low),
      invalidation: neck - 2 * R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price bottomed at about ${money(p.low)} twice, with a bounce to ${money(p.neck)} in between. The ${lastCandles(c.signal)} then closed above that ${money(p.neck)} neckline, which is what confirms a double bottom. The usual target is the height of the pattern again, above the neckline.`,
      `Price topped at about ${money(p.low)} twice, with a dip to ${money(p.neck)} in between. The ${lastCandles(c.signal)} then closed below that ${money(p.neck)} neckline, which is what confirms a double top. The usual target is the height of the pattern again, below the neckline.`,
    ),
}

const triangleBounce: SetupRecipe = {
  key: 'triangleBounce',
  names: { bullish: 'Ascending triangle bounce', bearish: 'Descending triangle rejection' },
  signals: REVERSAL_SIGNALS,
  build(rng, end, R) {
    const ceiling = 110
    const third = end - rng.int(6, 7) // the last touch of the ceiling
    const second = third - rng.int(9, 11)
    const first = second - rng.int(9, 11)
    const low1At = first + rng.int(4, 6)
    const low2At = second + rng.int(4, 6)
    const low1 = ceiling * (1 - rng.range(0.08, 0.09))
    const low2 = ceiling * (1 - rng.range(0.06, 0.065))
    const rising = lineThrough({ index: low1At, price: low1 }, { index: low2At, price: low2 })

    return {
      waypoints: [
        { at: 0, price: ceiling * rng.range(0.85, 0.88) },
        { at: first - 6, price: ceiling * rng.range(0.93, 0.95) },
        { at: first, price: ceiling, touch: 'high' },
        { at: low1At, price: low1, touch: 'low' },
        { at: second, price: ceiling, touch: 'high' },
        { at: low2At, price: low2, touch: 'low' },
        { at: third, price: ceiling, touch: 'high' },
        // The line keeps rising under the signal candles, so aim a little above where it will be.
        { at: end, price: rising(end + 3) + 0.4 * R },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          finding(
            'triangleBounce',
            bias,
            ['Ascending triangle', 'Descending triangle'],
            [
              'A flat ceiling with rising lows under it. Price just dipped to the rising line again: buyers have stepped in there, higher each time.',
              'A flat floor with falling highs above it. Price just bounced to the falling line again: sellers have stepped in there, lower each time.',
            ],
            [level(ceiling, first - 3, last, either(bias, 'Ceiling', 'Floor')), line({ index: low1At, price: rising(low1At) }, { index: last, price: rising(last) })],
            { index: second, price: ceiling + R * 1.6 },
          ),
        ]
      },
      prices: { ceiling, line: rising(end) },
      target: ceiling,
      invalidation: rising(end) - 1.5 * R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price kept hitting a ceiling near ${money(p.ceiling)}, but every pullback bottomed out higher than the last: an ascending triangle. It just pulled back to that rising line again, near ${money(p.line)}, and the ${lastCandles(c.signal)} show buyers stepping in once more.`,
      `Price kept hitting a floor near ${money(p.ceiling)}, but every bounce topped out lower than the last: a descending triangle. It just bounced up to that falling line again, near ${money(p.line)}, and the ${lastCandles(c.signal)} show sellers stepping in once more.`,
    ),
}

const fibPullback: SetupRecipe = {
  key: 'fibPullback',
  names: { bullish: 'Bullish Fibonacci pullback', bearish: 'Bearish Fibonacci pullback' },
  signals: REVERSAL_SIGNALS,
  build(rng, end) {
    const topAt = end - rng.int(7, 9)
    const baseAt = topAt - rng.int(10, 13)
    const base = 100
    const top = base * (1 + rng.range(0.13, 0.17))
    const move = top - base
    const giveBack = rng.range(0.5, 0.58)

    return {
      waypoints: [
        { at: 0, price: base * rng.range(1.01, 1.05) },
        { at: baseAt, price: base, touch: 'low' },
        { at: Math.round((baseAt + topAt) / 2), price: base + move * rng.range(0.45, 0.6) },
        { at: topAt, price: top, touch: 'high' },
        { at: end, price: top - move * giveBack },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        const zone = (share: number, label: string) => level(top - move * share, topAt, last, label)
        return [
          finding(
            'fibPullback',
            bias,
            ['Bullish Fibonacci pullback', 'Bearish Fibonacci pullback'],
            [
              'After a strong move up, price gave back about half of it, into the 38 to 62 percent zone where traders expect the uptrend to pick up again.',
              'After a strong move down, price won back about half of it, into the 38 to 62 percent zone where traders expect the downtrend to pick up again.',
            ],
            [
              line({ index: baseAt, price: cs[baseAt].low }, { index: topAt, price: cs[topAt].high }, either(bias, 'Move up', 'Move down')),
              zone(0.382, '38%'),
              zone(0.5, '50%'),
              zone(0.618, '62%'),
            ],
          ),
        ]
      },
      prices: { base, top, dip: top - move * giveBack },
      target: top,
      invalidation: base + move * 0.25,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price rallied from about ${money(p.base)} to ${money(p.top)}, then pulled back to ${money(p.dip)}, giving back roughly half the move. Traders watch the 38 to 62 percent pullback zone (from the Fibonacci ratios) for the trend to resume, and the ${lastCandles(c.signal)} show buyers stepping in there.`,
      `Price dropped from about ${money(p.base)} to ${money(p.top)}, then bounced to ${money(p.dip)}, winning back roughly half the move. Traders watch the 38 to 62 percent zone (from the Fibonacci ratios) for the trend to resume, and the ${lastCandles(c.signal)} show sellers stepping in there.`,
    ),
}

export const MORE_SETUPS: SetupRecipe[] = [
  vBottom,
  diamond,
  island,
  runawayGap,
  exhaustionGap,
  squeeze,
  megaphone,
  broadeningWedge,
  channelBounce,
  breakoutRetest,
  rangeBreakout,
  trendlineBreak,
  climax,
  highTightFlag,
  doubleBreakout,
  triangleBounce,
  fibPullback,
]

// Which patterns the scanner should report for each of these setups (see SCANNER_MATCHES).
export const MORE_SCANNER_MATCHES: Record<string, string[]> = {
  vBottom: ['vBottom', 'vTop', 'sellingClimax', 'buyingClimax', 'bullishChangeOfCharacter', 'bearishChangeOfCharacter'],
  diamond: ['diamondBottom', 'diamondTop'],
  island: ['islandBottom', 'islandTop'],
  runawayGap: ['runawayGapUp', 'runawayGapDown', 'breakawayGapUp', 'breakawayGapDown'],
  exhaustionGap: ['exhaustionGapDown', 'exhaustionGapUp', 'islandBottom', 'islandTop'],
  squeeze: ['volatilitySqueeze'],
  megaphone: ['broadeningFormation'],
  broadeningWedge: ['descendingBroadeningWedge', 'ascendingBroadeningWedge', 'breakout', 'breakdown'],
  channelBounce: ['ascendingChannel', 'descendingChannel', 'higherHighsHigherLows', 'lowerHighsLowerLows', 'risingTrendline', 'fallingTrendline'],
  breakoutRetest: ['supportLevel', 'resistanceLevel', 'higherHighsHigherLows', 'lowerHighsLowerLows', 'bullishFibPullback', 'bearishFibPullback'],
  rangeBreakout: ['horizontalChannel', 'breakout', 'breakdown', 'bullishRectangle', 'bearishRectangle'],
  trendlineBreak: ['downtrendLineBreak', 'uptrendLineBreak', 'breakout', 'breakdown', 'bullishChangeOfCharacter', 'bearishChangeOfCharacter'],
  climax: ['sellingClimax', 'buyingClimax'],
  highTightFlag: ['bullFlag', 'bearFlag', 'bullishPennant', 'bearishPennant'],
  doubleBreakout: ['doubleBottom', 'doubleTop', 'tripleBottom', 'tripleTop', 'breakout', 'breakdown'],
  triangleBounce: ['ascendingTriangle', 'descendingTriangle', 'risingTrendline', 'fallingTrendline'],
  fibPullback: ['bullishFibPullback', 'bearishFibPullback'],
}
