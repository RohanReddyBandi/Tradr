import type { ChartPoint, Shape } from '../types'
import { BREAKOUT_SIGNALS, REVERSAL_SIGNALS } from './signalCandles'
import { dot, either, highest, lastCandles, level, line, lineThrough, lowest, money, percent, type SetupRecipe, type Waypoint } from './setupKit'
import { MORE_SETUPS, MORE_SCANNER_MATCHES } from './moreSetups'

// The chart setups the generator can build. The shared pieces (the Waypoint
// and Blueprint types, drawing helpers) live in setupKit.ts; the newer setups
// are in moreSetups.ts. Every setup is written in its bullish form, around a
// price of 100, and flipped upside down for the bearish version.
export type { Blueprint, SetupRecipe, Waypoint } from './setupKit'
export { lastCandles } from './setupKit'

// ---------------------------------------------------------------------------
// The setups
// ---------------------------------------------------------------------------

const flag: SetupRecipe = {
  key: 'flag',
  names: { bullish: 'Bull flag', bearish: 'Bear flag' },
  signals: ['bullishMarubozu', 'threeWhiteSoldiers', 'risingThreeMethods'],
  build(rng, end) {
    const flagLength = rng.int(11, 15)
    const poleLength = rng.int(5, 7)
    const poleTop = end - flagLength
    const poleBottom = poleTop - poleLength
    const base = 100
    const top = base * (1 + rng.range(0.13, 0.18))
    const slope = -top * rng.range(0.0025, 0.0038) // the flag drifts down a little each day
    const width = top * rng.range(0.035, 0.045)
    const upper = (i: number) => top + slope * (i - poleTop)
    const lower = (i: number) => upper(i) - width

    const waypoints: Waypoint[] = [
      { at: 0, price: base * rng.range(0.93, 0.97) },
      { at: Math.round(poleBottom * 0.5), price: base * rng.range(0.98, 1.02) },
      { at: poleBottom, price: base, touch: 'low' },
      { at: poleTop, price: top, touch: 'high' },
    ]
    // Inside the flag, bounce between the two lines.
    let side: 'low' | 'high' = 'low'
    for (let i = poleTop + rng.int(3, 4); i < end - 2; i += rng.int(3, 4)) {
      waypoints.push({ at: i, price: side === 'low' ? lower(i) : upper(i), touch: side })
      side = side === 'low' ? 'high' : 'low'
    }
    waypoints.push({ at: end, price: upper(end) - width * 0.3 })

    return {
      waypoints,
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'flag',
            type: 'chart',
            bias,
            name: either(bias, 'Bull flag', 'Bear flag'),
            meaning: either(
              bias,
              'A sharp rally (the pole), then a tight channel drifting gently lower (the flag). Flags usually break out in the direction of the pole.',
              'A sharp drop (the pole), then a tight channel drifting gently higher (the flag). Flags usually break out in the direction of the pole.',
            ),
            shapes: [
              line({ index: poleBottom, price: cs[poleBottom].low }, { index: poleTop, price: cs[poleTop].high }, 'Pole'),
              line({ index: poleTop, price: upper(poleTop) }, { index: last, price: upper(last) }),
              line({ index: poleTop + 2, price: lower(poleTop + 2) }, { index: last, price: lower(last) }),
            ],
            labelAt: { index: poleTop + 5, price: upper(poleTop + 5) + width * 0.9 },
          },
        ]
      },
      prices: { start: base, top },
      counts: { poleDays: poleLength },
      target: upper(end) + (top - base) * 0.7,
      invalidation: lower(end) - width * 0.3,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price ripped ${percent(p.start, p.top)} higher in ${c.poleDays} days (the flagpole), then drifted down in a tight, orderly channel (the flag). A calm pullback after a burst like that usually means buyers are resting, not leaving. The ${lastCandles(c.signal)} pushed out through the top of the flag.`,
      `Price dropped ${percent(p.start, p.top)} in ${c.poleDays} days (the flagpole), then drifted up in a tight, orderly channel (the flag). A weak bounce after a drop like that usually means sellers are resting, not leaving. The ${lastCandles(c.signal)} broke down through the bottom of the flag.`,
    ),
}

const doubleBottom: SetupRecipe = {
  key: 'double',
  names: { bullish: 'Double bottom', bearish: 'Double top' },
  signals: REVERSAL_SIGNALS,
  build(rng, end, R) {
    const low = 100
    const neckAt = end - rng.int(9, 12)
    const firstLowAt = neckAt - rng.int(8, 11)
    const neck = low * (1 + rng.range(0.06, 0.085))
    const start = low * (1 + rng.range(0.15, 0.2))

    return {
      waypoints: [
        { at: 0, price: start },
        { at: Math.round(firstLowAt * 0.45), price: low + (start - low) * rng.range(0.45, 0.55) },
        { at: Math.round(firstLowAt * 0.65), price: low + (start - low) * rng.range(0.55, 0.65) }, // small bounce on the way down
        { at: firstLowAt, price: low, touch: 'low' },
        { at: neckAt, price: neck, touch: 'high' },
        { at: end - 6, price: low + (neck - low) * rng.range(0.55, 0.7) },
        { at: end, price: low * (1 + rng.range(0.008, 0.015)) },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        const first = lowest(cs, firstLowAt - 1, firstLowAt + 1)
        const second = lowest(cs, end + 1, last)
        const neckPoint = highest(cs, neckAt - 1, neckAt + 1)
        return [
          {
            id: 'double',
            type: 'chart',
            bias,
            name: either(bias, 'Double bottom', 'Double top'),
            meaning: either(
              bias,
              'Two lows at about the same price with a bounce in between. Buyers defended the same floor twice; a push above the middle peak (the neckline) confirms it.',
              'Two highs at about the same price with a dip in between. Sellers defended the same ceiling twice; a drop below the middle low (the neckline) confirms it.',
            ),
            shapes: [
              level(first.price, firstLowAt - 4, last, either(bias, 'Support', 'Resistance')),
              level(neckPoint.price, neckAt - 3, last, 'Neckline'),
              dot(first, either(bias, '1st low', '1st high'), 'below'),
              dot(second, either(bias, '2nd low', '2nd high'), 'below'),
            ],
            // Above the neckline, where there's open space (below the lows is crowded).
            labelAt: { index: Math.round((firstLowAt + neckAt) / 2), price: neckPoint.price + R * 1.8 },
          },
        ]
      },
      prices: { start, low, neck },
      target: neck + (neck - low) * 0.4,
      invalidation: low * 0.975,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price slid from about ${money(p.start)} to ${money(p.low)}, bounced ${percent(p.low, p.neck)} to ${money(p.neck)}, then came right back down to the same low. A floor that holds twice shows buyers defending it: a double bottom taking shape, with the second low forming on the ${lastCandles(c.signal)}.`,
      `Price climbed from about ${money(p.start)} to ${money(p.low)}, pulled back ${percent(p.low, p.neck)} to ${money(p.neck)}, then rallied right back to the same high. A ceiling that holds twice shows sellers defending it: a double top taking shape, with the second high forming on the ${lastCandles(c.signal)}.`,
    ),
}

const channel: SetupRecipe = {
  key: 'channel',
  names: { bullish: 'Descending channel breakout', bearish: 'Ascending channel breakdown' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const startAt = rng.int(3, 6)
    const top = 100 * rng.range(1.12, 1.16)
    const slope = -100 * rng.range(0.0035, 0.0045)
    const width = 100 * rng.range(0.06, 0.075)
    const upper = (i: number) => top + slope * (i - startAt)
    const lower = (i: number) => upper(i) - width
    const higherLowAt = end - rng.int(5, 7)

    // Bounce between the channel lines, ending on a touch of the top line...
    const touches: Waypoint[] = []
    let side: 'high' | 'low' = 'high'
    for (let i = startAt; i <= higherLowAt - 5; i += rng.int(5, 7)) {
      touches.push({ at: i, price: side === 'high' ? upper(i) : lower(i), touch: side })
      side = side === 'high' ? 'low' : 'high'
    }
    if (touches[touches.length - 1].touch === 'low') touches.pop()

    return {
      waypoints: [
        { at: 0, price: upper(0) - width * 0.4 },
        ...touches,
        // ...then a dip that stops well above the channel floor, and a push to the top line.
        { at: higherLowAt, price: lower(higherLowAt) + width * rng.range(0.3, 0.4), touch: 'low' },
        { at: end, price: upper(end) - width * 0.12 },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        const turn = lowest(cs, higherLowAt - 1, higherLowAt + 1)
        return [
          {
            id: 'channel',
            type: 'chart',
            bias,
            name: either(bias, 'Descending channel', 'Ascending channel'),
            meaning: either(
              bias,
              'Price stepped lower between two parallel lines, making lower highs and lower lows. A close above the top line breaks that rhythm.',
              'Price stepped higher between two parallel lines, making higher highs and higher lows. A close below the bottom line breaks that rhythm.',
            ),
            shapes: [
              line({ index: startAt, price: upper(startAt) }, { index: last, price: upper(last) }),
              line({ index: startAt, price: lower(startAt) }, { index: last, price: lower(last) }),
            ],
            labelAt: { index: startAt + 10, price: upper(startAt + 10) + R * 1.6 },
          },
          {
            id: 'turn',
            type: 'chart',
            bias,
            name: either(bias, 'Higher low', 'Lower high'),
            meaning: either(
              bias,
              'The last dip stopped well short of the channel floor. Sellers could no longer push price as low as before.',
              'The last rally stopped well short of the channel ceiling. Buyers could no longer push price as high as before.',
            ),
            shapes: [dot(turn, either(bias, 'Higher low', 'Lower high'), 'below')],
          },
        ]
      },
      prices: {},
      target: upper(end) + width * 1.2,
      invalidation: lower(higherLowAt) + width * 0.3 - R,
    }
  },
  story: (bias, _p, c) =>
    either(
      bias,
      `Price spent most of the window sliding down a channel, with lower highs and lower lows between two parallel lines. Then the last dip stopped short of the channel floor (a higher low), and the ${lastCandles(c.signal)} broke out above the top line.`,
      `Price spent most of the window climbing a channel, with higher highs and higher lows between two parallel lines. Then the last rally stopped short of the channel ceiling (a lower high), and the ${lastCandles(c.signal)} broke down through the bottom line.`,
    ),
}

const headAndShoulders: SetupRecipe = {
  key: 'headShoulders',
  names: { bullish: 'Inverse head and shoulders', bearish: 'Head and shoulders' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    // Place the swing points from the right edge backwards.
    const rightAt = end - rng.int(6, 8)
    const neck2At = rightAt - rng.int(5, 7)
    const headAt = neck2At - rng.int(5, 7)
    const neck1At = headAt - rng.int(5, 7)
    const leftAt = neck1At - rng.int(5, 7)
    const shoulder = 100
    const head = shoulder * (1 - rng.range(0.055, 0.08))
    const neck1 = shoulder * (1 + rng.range(0.065, 0.08))
    const neck2 = neck1 * (1 + rng.range(-0.008, 0.008))
    const right = shoulder * (1 + rng.range(-0.005, 0.015))
    const neckline = lineThrough({ index: neck1At, price: neck1 }, { index: neck2At, price: neck2 })

    return {
      waypoints: [
        { at: 0, price: shoulder * rng.range(1.1, 1.14) },
        { at: Math.round(leftAt * 0.5), price: shoulder * rng.range(1.04, 1.07) },
        { at: leftAt, price: shoulder, touch: 'low' },
        { at: neck1At, price: neck1, touch: 'high' },
        { at: headAt, price: head, touch: 'low' },
        { at: neck2At, price: neck2, touch: 'high' },
        { at: rightAt, price: right, touch: 'low' },
        { at: end, price: neckline(end) - R * 0.4 },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'headShoulders',
            type: 'chart',
            bias,
            name: either(bias, 'Inverse head and shoulders', 'Head and shoulders'),
            meaning: either(
              bias,
              'Three dips with the middle one deepest, like an upside-down head and shoulders. A close above the neckline signals the downtrend is over.',
              'Three peaks with the middle one highest. A close below the neckline signals the uptrend is over.',
            ),
            shapes: [
              line({ index: neck1At - 3, price: neckline(neck1At - 3) }, { index: last, price: neckline(last) }, 'Neckline'),
              dot(lowest(cs, leftAt - 1, leftAt + 1), 'Left shoulder', 'below'),
              dot(lowest(cs, headAt - 1, headAt + 1), 'Head', 'below'),
              dot(lowest(cs, rightAt - 1, rightAt + 1), 'Right shoulder', 'below'),
            ],
            labelAt: { index: headAt, price: neckline(headAt) + R * 1.8 },
          },
        ]
      },
      prices: { left: shoulder, head, right, neck: neck1 },
      target: neck2 + (neck2 - head) * 0.8,
      invalidation: right - R * 1.2,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price made three dips: one to about ${money(p.left)}, a deeper one to ${money(p.head)} (the head), then a shallower one to ${money(p.right)}. The rallies in between all stalled at the same line near ${money(p.neck)}, the neckline. That's an inverse head and shoulders, and the ${lastCandles(c.signal)} closed above the neckline.`,
      `Price made three peaks: one near ${money(p.left)}, a higher one at ${money(p.head)} (the head), then a lower one at ${money(p.right)}. The dips in between all stopped at the same line near ${money(p.neck)}, the neckline. That's a head and shoulders, and the ${lastCandles(c.signal)} closed below the neckline.`,
    ),
}

const triangle: SetupRecipe = {
  key: 'triangle',
  names: { bullish: 'Ascending triangle', bearish: 'Descending triangle' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const ceiling = 110
    const touch3 = end - rng.int(4, 6)
    const touch2 = touch3 - rng.int(9, 11)
    const touch1 = touch2 - rng.int(9, 11)
    const low1At = touch1 + rng.int(4, 6)
    const low2At = touch2 + rng.int(4, 6)
    const low1 = ceiling * (1 - rng.range(0.075, 0.09))
    const low2 = ceiling * (1 - rng.range(0.04, 0.05))
    const rising = lineThrough({ index: low1At, price: low1 }, { index: low2At, price: low2 })

    return {
      waypoints: [
        { at: 0, price: ceiling * rng.range(0.84, 0.88) },
        { at: touch1 - 6, price: ceiling * rng.range(0.93, 0.95) },
        { at: touch1, price: ceiling, touch: 'high' },
        { at: low1At, price: low1, touch: 'low' },
        { at: touch2, price: ceiling, touch: 'high' },
        { at: low2At, price: low2, touch: 'low' },
        { at: touch3, price: ceiling, touch: 'high' },
        { at: touch3 + 2, price: (ceiling + rising(touch3 + 2)) / 2 },
        { at: end, price: ceiling - R * 0.45 },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'triangle',
            type: 'chart',
            bias,
            name: either(bias, 'Ascending triangle', 'Descending triangle'),
            meaning: either(
              bias,
              'A flat ceiling with rising lows underneath. Buyers keep paying more each time, and a close above the ceiling usually starts a move up.',
              'A flat floor with falling highs above it. Sellers keep accepting less each time, and a close below the floor usually starts a move down.',
            ),
            shapes: [
              level(ceiling, touch1 - 3, last, either(bias, 'Resistance', 'Support')),
              line({ index: low1At, price: rising(low1At) }, { index: last, price: rising(last) }),
            ],
            labelAt: { index: touch2, price: ceiling + R * 1.6 },
          },
        ]
      },
      prices: { ceiling, low1, low2 },
      target: ceiling + (ceiling - low1) * 0.8,
      invalidation: rising(end) - R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price hit a ceiling near ${money(p.ceiling)} three times, but each pullback bottomed out higher than the last: ${money(p.low1)}, then ${money(p.low2)}. Buyers kept paying more while sellers defended one price. That's an ascending triangle, and the ${lastCandles(c.signal)} closed above the ceiling.`,
      `Price hit a floor near ${money(p.ceiling)} three times, but each bounce topped out lower than the last: ${money(p.low1)}, then ${money(p.low2)}. Sellers kept accepting less while buyers defended one price. That's a descending triangle, and the ${lastCandles(c.signal)} closed below the floor.`,
    ),
}

const supportTest: SetupRecipe = {
  key: 'support',
  names: { bullish: 'Support bounce', bearish: 'Resistance rejection' },
  signals: REVERSAL_SIGNALS,
  build(rng, end) {
    const floor = 100
    const top = floor * (1 + rng.range(0.065, 0.085))
    const test2 = end - rng.int(15, 18)
    const test1 = test2 - rng.int(13, 16)

    return {
      waypoints: [
        { at: 0, price: floor * rng.range(1.02, 1.04) },
        { at: test1 - rng.int(5, 7), price: top * rng.range(0.99, 1) },
        { at: test1, price: floor, touch: 'low' },
        { at: Math.round((test1 + test2) / 2), price: top * rng.range(0.985, 1) },
        { at: test2, price: floor * 1.002, touch: 'low' },
        { at: test2 + rng.int(6, 8), price: top * rng.range(0.98, 0.995) },
        { at: end - 5, price: floor + (top - floor) * rng.range(0.45, 0.55) },
        { at: end, price: floor * (1 + rng.range(0.008, 0.013)) },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'support',
            type: 'chart',
            bias,
            name: either(bias, 'Support level', 'Resistance level'),
            meaning: either(
              bias,
              'A price where buyers stepped in before. The more times it holds, the more traders expect it to hold again.',
              'A price where sellers stepped in before. The more times it holds, the more traders expect it to hold again.',
            ),
            shapes: [
              level(floor, test1 - 4, last, either(bias, 'Support', 'Resistance')),
              dot(lowest(cs, test1 - 1, test1 + 1), either(bias, 'Bounce 1', 'Rejection 1'), 'below'),
              dot(lowest(cs, test2 - 1, test2 + 1), either(bias, 'Bounce 2', 'Rejection 2'), 'below'),
            ],
          },
        ]
      },
      prices: { floor },
      target: top * 0.99,
      invalidation: floor * 0.975,
    }
  },
  story: (bias, p) =>
    either(
      bias,
      `Price had bounced off ${money(p.floor)} twice already (the dots), which makes it support: a floor where buyers have stepped in before. The chart ends with price dropping back onto that floor for a third test.`,
      `Price had been turned away at ${money(p.floor)} twice already (the dots), which makes it resistance: a ceiling where sellers have stepped in before. The chart ends with price rallying back into that ceiling for a third test.`,
    ),
}

const wedge: SetupRecipe = {
  key: 'wedge',
  names: { bullish: 'Falling wedge', bearish: 'Rising wedge' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const startAt = rng.int(16, 22)
    const upperStart = 100 * rng.range(1.11, 1.13)
    const upperEnd = 100 * rng.range(1.005, 1.012)
    const lowerStart = 100 * rng.range(1.04, 1.05)
    const lowerEnd = 100 * rng.range(0.99, 0.995)
    const upper = lineThrough({ index: startAt, price: upperStart }, { index: end, price: upperEnd })
    const lower = lineThrough({ index: startAt + 3, price: lowerStart }, { index: end, price: lowerEnd })

    // Bounce between the two squeezing lines, ending on a touch of the bottom one.
    const touches: Waypoint[] = []
    let side: 'high' | 'low' = 'high'
    for (let i = startAt; i <= end - 5; i += rng.int(5, 7)) {
      touches.push({ at: i, price: side === 'high' ? upper(i) : lower(i), touch: side })
      side = side === 'high' ? 'low' : 'high'
    }
    if (touches[touches.length - 1].touch === 'high') touches.pop()

    return {
      waypoints: [
        { at: 0, price: 100 * rng.range(1.03, 1.05) },
        { at: Math.round(startAt * 0.5), price: 100 * rng.range(1.06, 1.08) },
        ...touches,
        { at: end, price: upper(end) - R * 0.3 },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'wedge',
            type: 'chart',
            bias,
            name: either(bias, 'Falling wedge', 'Rising wedge'),
            meaning: either(
              bias,
              'Two falling lines squeezing together. Each drop is smaller than the last, so sellers are running out of steam, and breaks above the top line are often sharp.',
              'Two rising lines squeezing together. Each rally is smaller than the last, so buyers are running out of steam, and breaks below the bottom line are often sharp.',
            ),
            shapes: [
              line({ index: startAt, price: upper(startAt) }, { index: last, price: upper(last) }),
              line({ index: startAt + 3, price: lower(startAt + 3) }, { index: last, price: lower(last) }),
            ],
            labelAt: { index: startAt + 5, price: upper(startAt + 5) + R * 1.6 },
          },
        ]
      },
      prices: {},
      target: upperEnd + (upperStart - upperEnd) * 0.6,
      invalidation: lower(end) - R,
    }
  },
  story: (bias, _p, c) =>
    either(
      bias,
      `Price drifted lower between two lines that kept squeezing together: a falling wedge. Each drop was smaller than the one before, a sign sellers were running out of energy. The ${lastCandles(c.signal)} broke out above the top line.`,
      `Price drifted higher between two lines that kept squeezing together: a rising wedge. Each rally was smaller than the one before, a sign buyers were running out of energy. The ${lastCandles(c.signal)} broke down below the bottom line.`,
    ),
}

const falseBreak: SetupRecipe = {
  key: 'falseBreak',
  names: { bullish: 'False breakdown', bearish: 'False breakout' },
  signals: ['bullishEngulfing', 'threeOutsideUp'],
  build(rng, end, R) {
    const floor = 100
    const top = floor * (1 + rng.range(0.06, 0.08))
    const test2 = end - rng.int(13, 16)
    const test1 = test2 - rng.int(13, 16)

    return {
      waypoints: [
        { at: 0, price: top * rng.range(0.98, 1) },
        { at: test1, price: floor, touch: 'low' },
        { at: Math.round((test1 + test2) / 2), price: top * rng.range(0.985, 1) },
        { at: test2, price: floor * 1.002, touch: 'low' },
        { at: test2 + rng.int(5, 7), price: top * rng.range(0.98, 0.995) },
        { at: end - 3, price: floor * 1.008 },
        { at: end - 1, price: floor - R * 0.9 }, // slips below the floor...
        { at: end, price: floor - R * 0.15 },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        const breach = lowest(cs, end - 2, last)
        return [
          {
            id: 'support',
            type: 'chart',
            bias,
            name: either(bias, 'Support level', 'Resistance level'),
            meaning: either(
              bias,
              'A price where buyers stepped in twice before, so lots of traders were watching it.',
              'A price where sellers stepped in twice before, so lots of traders were watching it.',
            ),
            shapes: [
              level(floor, test1 - 4, last, either(bias, 'Support', 'Resistance')),
              dot(lowest(cs, test1 - 1, test1 + 1), either(bias, 'Bounce 1', 'Rejection 1'), 'below'),
              dot(lowest(cs, test2 - 1, test2 + 1), either(bias, 'Bounce 2', 'Rejection 2'), 'below'),
            ],
          },
          {
            id: 'falseBreak',
            type: 'chart',
            bias,
            name: either(bias, 'False breakdown', 'False breakout'),
            meaning: either(
              bias,
              'Price broke below support, then closed right back above it. Traders who sold the break are now trapped, and their exits can push price up.',
              'Price broke above resistance, then closed right back below it. Traders who bought the break are now trapped, and their exits can push price down.',
            ),
            shapes: [dot(breach, either(bias, 'Broke below', 'Broke above'), 'below')],
          },
        ]
      },
      prices: { floor },
      target: top * 0.995,
      invalidation: floor - R * 1.6,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price had bounced off ${money(p.floor)} twice, so plenty of traders were watching that floor. It finally broke below, but the ${lastCandles(c.signal)} closed right back above it. A break that fails that fast is a false breakdown: the sellers who jumped on it are now trapped.`,
      `Price had been turned away at ${money(p.floor)} twice, so plenty of traders were watching that ceiling. It finally broke above, but the ${lastCandles(c.signal)} closed right back below it. A break that fails that fast is a false breakout: the buyers who jumped on it are now trapped.`,
    ),
}

const structure: SetupRecipe = {
  key: 'structure',
  names: { bullish: 'Pullback in an uptrend', bearish: 'Bounce in a downtrend' },
  signals: REVERSAL_SIGNALS,
  build(rng, end, R) {
    // Six legs of 6-7 days, placed backwards from the right edge.
    const at: number[] = [end]
    for (let leg = 0; leg < 6; leg++) at.unshift(at[0] - rng.int(6, 7))
    const up = () => 1 + rng.range(0.055, 0.07)
    const down = () => 1 - rng.range(0.028, 0.038)
    const low1 = 100
    const high1 = low1 * up()
    const low2 = high1 * down()
    const high2 = low2 * up()
    const low3 = high2 * down()
    const high3 = low3 * up()
    const low4 = high3 * down()

    return {
      waypoints: [
        { at: 0, price: low1 * rng.range(1.02, 1.04) },
        { at: at[0], price: low1, touch: 'low' },
        { at: at[1], price: high1, touch: 'high' },
        { at: at[2], price: low2, touch: 'low' },
        { at: at[3], price: high2, touch: 'high' },
        { at: at[4], price: low3, touch: 'low' },
        { at: at[5], price: high3, touch: 'high' },
        { at: end, price: low4 * 1.004 },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        const swings = [
          lowest(cs, at[0] - 1, at[0] + 1),
          highest(cs, at[1] - 1, at[1] + 1),
          lowest(cs, at[2] - 1, at[2] + 1),
          highest(cs, at[3] - 1, at[3] + 1),
          lowest(cs, at[4] - 1, at[4] + 1),
          highest(cs, at[5] - 1, at[5] + 1),
          lowest(cs, end + 1, last),
        ]
        const labels =
          bias === 'bearish'
            ? ['High', 'Low', 'LH', 'LL', 'LH', 'LL', 'LH']
            : ['Low', 'High', 'HL', 'HH', 'HL', 'HH', 'HL']
        const shapes: Shape[] = []
        swings.forEach((point, k) => {
          if (k > 0) shapes.push(line(swings[k - 1], point))
          shapes.push(dot(point, labels[k], k % 2 === 0 ? 'below' : 'above'))
        })
        return [
          {
            id: 'structure',
            type: 'chart',
            bias,
            name: either(bias, 'Higher highs and higher lows', 'Lower highs and lower lows'),
            meaning: either(
              bias,
              'Each rally beat the last high and each dip held above the last low. That staircase is what an uptrend looks like, and dips in it tend to get bought.',
              'Each drop broke the last low and each bounce stalled below the last high. That staircase is what a downtrend looks like, and bounces in it tend to get sold.',
            ),
            shapes,
          },
        ]
      },
      prices: { low3, low4 },
      target: high3 * 1.02,
      invalidation: low3 - R,
    }
  },
  story: (bias, p) =>
    either(
      bias,
      `Price was climbing a staircase: every rally made a higher high (HH) and every dip held a higher low (HL). The latest dip pulled back to about ${money(p.low4)}, still above the last low at ${money(p.low3)}. Dips inside an uptrend are where buyers usually step back in.`,
      `Price was walking down a staircase: every drop made a lower low (LL) and every bounce stalled at a lower high (LH). The latest bounce rallied to about ${money(p.low4)}, still below the last high at ${money(p.low3)}. Bounces inside a downtrend are where sellers usually step back in.`,
    ),
}

const chop: SetupRecipe = {
  key: 'chop',
  names: { bullish: 'No clear setup', bearish: 'No clear setup' },
  neutral: true,
  signals: ['doji', 'spinningTop', 'longLeggedDoji'],
  build(rng, end, R) {
    const middle = 100
    const half = rng.range(2.6, 3.4)
    const waypoints: Waypoint[] = [{ at: 0, price: middle + rng.range(-1, 1) }]
    let side = rng.chance(0.5) ? 1 : -1
    for (let i = rng.int(3, 5); i < end - 3; i += rng.int(3, 6)) {
      waypoints.push({ at: i, price: middle + side * half * rng.range(0.6, 1) })
      side *= -1
    }
    waypoints.push({ at: end, price: middle + rng.range(-0.4, 0.4) })

    return {
      waypoints,
      findings: (cs) => {
        const last = cs.length - 1
        const top = highest(cs, 0, last).price
        const bottom = lowest(cs, 0, last).price
        return [
          {
            id: 'range',
            type: 'chart',
            bias: 'neutral',
            name: 'Choppy range',
            meaning: 'Price bounced between a ceiling and a floor with no trend. In the middle of a range, neither buying nor selling has an edge.',
            shapes: [level(top, 0, last, 'Range high'), level(bottom, 0, last, 'Range low')],
            labelAt: { index: 8, price: top + R * 1.4 },
          },
        ]
      },
      prices: { low: middle - half, high: middle + half },
      target: middle,
      invalidation: middle,
    }
  },
  story: (_bias, p, c) =>
    c.decoy
      ? `Price chopped sideways between about ${money(p.low)} and ${money(p.high)} for the whole window, with no trend and no clean pattern. The last candle was a big one, but it started from the middle of the range, not from a floor or a ceiling.`
      : `Price chopped sideways between about ${money(p.low)} and ${money(p.high)} for the whole window, with no trend and no clean pattern. The last candle closed near the middle of that range, where neither side has an edge.`,
}


const tripleBottom: SetupRecipe = {
  key: 'triple',
  names: { bullish: 'Triple bottom', bearish: 'Triple top' },
  signals: REVERSAL_SIGNALS,
  build(rng, end, R) {
    const low = 100
    const neck = low * (1 + rng.range(0.055, 0.075))
    const neck2At = end - rng.int(6, 7)
    const low2At = neck2At - rng.int(6, 8)
    const neck1At = low2At - rng.int(6, 8)
    const low1At = neck1At - rng.int(6, 8)
    const start = low * (1 + rng.range(0.14, 0.18))

    return {
      waypoints: [
        { at: 0, price: start },
        { at: Math.round(low1At * 0.5), price: low + (start - low) * rng.range(0.45, 0.6) },
        { at: low1At, price: low, touch: 'low' },
        { at: neck1At, price: neck, touch: 'high' },
        { at: low2At, price: low * (1 + rng.range(-0.004, 0.004)), touch: 'low' },
        { at: neck2At, price: neck * (1 + rng.range(-0.01, 0.005)), touch: 'high' },
        { at: end, price: low * (1 + rng.range(0.008, 0.014)) },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        const lows = [lowest(cs, low1At - 1, low1At + 1), lowest(cs, low2At - 1, low2At + 1), lowest(cs, end + 1, last)]
        const word = either(bias, 'low', 'high')
        return [
          {
            id: 'triple',
            type: 'chart',
            bias,
            name: either(bias, 'Triple bottom', 'Triple top'),
            meaning: either(
              bias,
              'Three lows at about the same price. A floor tested three times and still holding.',
              'Three highs at about the same price. A ceiling tested three times and still holding.',
            ),
            shapes: [
              level(lows[0].price, low1At - 4, last, either(bias, 'Support', 'Resistance')),
              level(neck, neck1At - 2, last, 'Neckline'),
              dot(lows[0], `1st ${word}`, 'below'),
              dot(lows[1], `2nd ${word}`, 'below'),
              dot(lows[2], `3rd ${word}`, 'below'),
            ],
            labelAt: { index: low2At, price: neck + R * 2.4 },
          },
        ]
      },
      prices: { low, neck },
      target: neck + (neck - low) * 0.5,
      invalidation: low * 0.975,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price fell to about ${money(p.low)} and has now come back to that same floor three times, bouncing to about ${money(p.neck)} in between. A floor that holds three times shows buyers defending it hard: a triple bottom, with the third low forming on the ${lastCandles(c.signal)}.`,
      `Price rallied to about ${money(p.low)} and has now come back to that same ceiling three times, dipping to about ${money(p.neck)} in between. A ceiling that holds three times shows sellers defending it hard: a triple top, with the third high forming on the ${lastCandles(c.signal)}.`,
    ),
}

const symmetricalTriangle: SetupRecipe = {
  key: 'symTriangle',
  names: { bullish: 'Symmetrical triangle breakout', bearish: 'Symmetrical triangle breakdown' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    // A rise into the triangle, then lower highs and higher lows squeezing
    // toward a point just past the right edge.
    const firstHigh = end - rng.int(30, 34)
    const apex = 104
    const upper = lineThrough({ index: firstHigh, price: 110 + rng.range(0, 1) }, { index: end + 6, price: apex + 0.8 })
    const lower = lineThrough({ index: firstHigh + 5, price: 97 - rng.range(0, 1) }, { index: end + 6, price: apex - 0.8 })

    const touches: Waypoint[] = []
    let side: 'high' | 'low' = 'high'
    for (let i = firstHigh; i <= end - 4; i += rng.int(5, 6)) {
      touches.push({ at: i, price: side === 'high' ? upper(i) : lower(i), touch: side })
      side = side === 'high' ? 'low' : 'high'
    }
    if (touches[touches.length - 1].touch === 'high') touches.pop()

    return {
      waypoints: [
        { at: 0, price: 100 * rng.range(0.88, 0.92) },
        { at: firstHigh - 8, price: 100 * rng.range(1.0, 1.03) },
        ...touches,
        { at: end, price: upper(end) - R * 0.3 },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'symTriangle',
            type: 'chart',
            bias,
            name: 'Symmetrical triangle',
            meaning: either(
              bias,
              'Lower highs and higher lows squeezing together after a rise. The squeeze usually breaks the way the move before it went, and this one broke up.',
              'Lower highs and higher lows squeezing together after a drop. The squeeze usually breaks the way the move before it went, and this one broke down.',
            ),
            shapes: [
              line({ index: firstHigh, price: upper(firstHigh) }, { index: last, price: upper(last) }),
              line({ index: firstHigh + 5, price: lower(firstHigh + 5) }, { index: last, price: lower(last) }),
            ],
            labelAt: { index: firstHigh + 4, price: upper(firstHigh + 4) + R * 1.6 },
          },
        ]
      },
      prices: {},
      target: upper(end) + (upper(firstHigh) - lower(firstHigh)) * 0.6,
      invalidation: lower(end) - R,
    }
  },
  story: (bias, _p, c) =>
    either(
      bias,
      `After a rise, price coiled into a symmetrical triangle: each high lower than the last and each low higher, squeezing toward a point. Squeezes like that usually break the way the move before them went, and the ${lastCandles(c.signal)} broke out above the top line.`,
      `After a drop, price coiled into a symmetrical triangle: each low higher than the last and each high lower, squeezing toward a point. Squeezes like that usually break the way the move before them went, and the ${lastCandles(c.signal)} broke down through the bottom line.`,
    ),
}

const pennant: SetupRecipe = {
  key: 'pennant',
  names: { bullish: 'Bullish pennant', bearish: 'Bearish pennant' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end) {
    // At least 11 candles, so the huge pole candles are out of the 10-candle
    // average the candle detectors compare the breakout against.
    const pennantLength = rng.int(11, 13)
    const poleLength = rng.int(5, 7)
    const poleTop = end - pennantLength
    const poleBottom = poleTop - poleLength
    const base = 100
    const top = base * (1 + rng.range(0.13, 0.18))
    const apex = top * 0.975
    // A falling top line and a rising bottom line that meet just past the edge.
    const upper = lineThrough({ index: poleTop, price: top }, { index: end + 3, price: apex + 0.5 })
    const lower = lineThrough({ index: poleTop + 3, price: top * 0.955 }, { index: end + 3, price: apex - 0.5 })

    const waypoints: Waypoint[] = [
      { at: 0, price: base * rng.range(0.93, 0.97) },
      { at: Math.round(poleBottom * 0.5), price: base * rng.range(0.98, 1.02) },
      { at: poleBottom, price: base, touch: 'low' },
      { at: poleTop, price: top, touch: 'high' },
    ]
    let side: 'low' | 'high' = 'low'
    for (let i = poleTop + 3; i < end - 1; i += 3) {
      waypoints.push({ at: i, price: side === 'low' ? lower(i) : upper(i), touch: side })
      side = side === 'low' ? 'high' : 'low'
    }
    waypoints.push({ at: end, price: upper(end) - 0.2 })

    return {
      waypoints,
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'pennant',
            type: 'chart',
            bias,
            name: either(bias, 'Bullish pennant', 'Bearish pennant'),
            meaning: either(
              bias,
              'A sharp rally, then a small triangle that squeezes tight. It usually breaks out upward, in the direction of the pole.',
              'A sharp drop, then a small triangle that squeezes tight. It usually breaks down, in the direction of the pole.',
            ),
            shapes: [
              line({ index: poleBottom, price: cs[poleBottom].low }, { index: poleTop, price: cs[poleTop].high }, 'Pole'),
              line({ index: poleTop, price: upper(poleTop) }, { index: last, price: upper(last) }),
              line({ index: poleTop + 3, price: lower(poleTop + 3) }, { index: last, price: lower(last) }),
            ],
            labelAt: { index: poleTop + 3, price: upper(poleTop + 3) + 2.4 },
          },
        ]
      },
      prices: { start: base, top },
      counts: { poleDays: poleLength },
      target: upper(end) + (top - base) * 0.7,
      invalidation: lower(end) - 1.5,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price ripped ${percent(p.start, p.top)} higher in ${c.poleDays} days (the pole), then paused in a small triangle that squeezed tighter and tighter (the pennant). A tight pause after a burst usually means the move isn't finished. The ${lastCandles(c.signal)} broke out above the pennant.`,
      `Price dropped ${percent(p.start, p.top)} in ${c.poleDays} days (the pole), then paused in a small triangle that squeezed tighter and tighter (the pennant). A tight pause after a drop usually means the move isn't finished. The ${lastCandles(c.signal)} broke down out of the pennant.`,
    ),
}

const cupAndHandle: SetupRecipe = {
  key: 'cup',
  names: { bullish: 'Cup and handle', bearish: 'Inverted cup and handle' },
  // The entry is at the bottom of the handle, so it ends on a buying candle.
  signals: ['hammer', 'bullishEngulfing', 'morningStar', 'piercingLine', 'tweezerBottom', 'threeInsideUp', 'dragonflyDoji', 'bullishHarami'],
  build(rng, end, R) {
    const rightRim = end - rng.int(6, 7)
    const span = rng.int(26, 32)
    const leftRim = rightRim - span
    const rim = 110
    const depth = rim * rng.range(0.1, 0.13)
    const bottom = rim - depth
    const middle = leftRim + span / 2
    // The cup is a U: a parabola from rim to bottom and back up.
    const cup = (i: number) => bottom + depth * ((i - middle) / (span / 2)) ** 2
    const handleLow = rim - depth * rng.range(0.3, 0.36)

    const waypoints: Waypoint[] = [
      { at: 0, price: rim * rng.range(0.88, 0.91) },
      { at: leftRim - 8, price: rim * rng.range(0.95, 0.97) },
      { at: leftRim, price: rim, touch: 'high' },
    ]
    for (let k = 1; k <= 5; k++) {
      const at = Math.round(leftRim + (span * k) / 6)
      waypoints.push({ at, price: cup(at) })
    }
    waypoints.push({ at: rightRim, price: rim * (1 + rng.range(-0.004, 0.004)), touch: 'high' })
    waypoints.push({ at: end, price: handleLow })

    return {
      waypoints,
      findings: (cs, bias) => {
        const last = cs.length - 1
        const handle = lowest(cs, rightRim + 1, last)
        const curve: ChartPoint[] = []
        for (let k = 0; k <= 16; k++) {
          const i = leftRim + (span * k) / 16
          curve.push({ index: i, price: cup(i) })
        }
        return [
          {
            id: 'cup',
            type: 'chart',
            bias,
            name: either(bias, 'Cup and handle', 'Inverted cup and handle'),
            meaning: either(
              bias,
              'A rounded U-shaped bottom back up to the old high (the cup), then a small dip (the handle). Buyers are soaking up the last sellers before a push higher.',
              'A rounded upside-down U back down to the old low (the cup), then a small bounce (the handle). Sellers are soaking up the last buyers before a push lower.',
            ),
            shapes: [
              { kind: 'curve', points: curve },
              level(rim, leftRim, last, 'Rim'),
              line({ index: rightRim, price: cs[rightRim].high }, handle, 'Handle'),
            ],
            labelAt: { index: Math.round(middle), price: rim + R * 1.8 },
          },
        ]
      },
      prices: { rim, bottom },
      target: rim + depth * 0.8,
      invalidation: handleLow - depth * 0.25,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price slid from about ${money(p.rim)} into a smooth, rounded bottom near ${money(p.bottom)}, then climbed all the way back: the cup. Then it dipped a little (the handle), and the ${lastCandles(c.signal)} show buyers stepping back in. A shallow handle after a round cup is buyers soaking up the last sellers.`,
      `Price climbed from about ${money(p.rim)} into a smooth, rounded top near ${money(p.bottom)}, then fell all the way back: an upside-down cup. Then it bounced a little (the handle), and the ${lastCandles(c.signal)} show sellers stepping back in. A shallow handle after a round top is sellers soaking up the last buyers.`,
    ),
}

const roundingBottom: SetupRecipe = {
  key: 'rounding',
  names: { bullish: 'Rounding bottom', bearish: 'Rounding top' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const span = rng.int(36, 44)
    const start = end - span
    const rim = 100
    const depth = rim * rng.range(0.1, 0.13)
    const bottom = rim - depth
    // The U is a parabola. Putting its lowest point a bit past the middle
    // means the right side has only climbed about two thirds of the way back.
    const bottomAt = start + span * rng.range(0.53, 0.56)
    const u = (i: number) => bottom + depth * ((i - bottomAt) / (bottomAt - start)) ** 2

    const waypoints: Waypoint[] = [{ at: 0, price: rim * rng.range(1.02, 1.05) }]
    for (let i = start; i < end; i += 5) waypoints.push({ at: i, price: u(i) })
    waypoints.push({ at: end, price: u(end) })

    return {
      waypoints,
      findings: (cs, bias) => {
        const last = cs.length - 1
        const curve: ChartPoint[] = []
        for (let k = 0; k <= 16; k++) {
          const i = start + ((end - start) * k) / 16
          curve.push({ index: i, price: u(i) - R * 0.8 })
        }
        return [
          {
            id: 'rounding',
            type: 'chart',
            bias,
            name: either(bias, 'Rounding bottom', 'Rounding top'),
            meaning: either(
              bias,
              'A long, smooth U: the selling faded, price went quiet at the bottom, then buyers slowly took over. Also called a saucer.',
              'A long, smooth upside-down U: the buying faded, price went quiet at the top, then sellers slowly took over.',
            ),
            shapes: [
              { kind: 'curve', points: curve },
              level(rim, start, last, 'Rim'),
              dot(lowest(cs, Math.round(bottomAt) - 3, Math.round(bottomAt) + 3), either(bias, 'Bottom', 'Top'), 'below'),
            ],
            labelAt: { index: Math.round(bottomAt), price: bottom - R * 2.6 },
          },
        ]
      },
      prices: { rim, bottom },
      target: rim + depth * 0.3,
      invalidation: u(end) - depth * 0.35,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price slid from about ${money(p.rim)} in a long, smooth curve, went quiet near ${money(p.bottom)}, then slowly started curling back up: a rounding bottom, or saucer. The ${lastCandles(c.signal)} pushed higher. A slow turn like this shows sellers giving up gradually, not all at once.`,
      `Price climbed from about ${money(p.rim)} in a long, smooth arc, went quiet near ${money(p.bottom)}, then slowly started rolling back over: a rounding top. The ${lastCandles(c.signal)} pushed lower. A slow turn like this shows buyers giving up gradually, not all at once.`,
    ),
}

const breakawayGap: SetupRecipe = {
  key: 'gap',
  names: { bullish: 'Breakaway gap up', bearish: 'Breakaway gap down' },
  // The gap itself is the signal: a rising window out of the top of the range.
  signals: ['risingWindow'],
  build(rng, end, R) {
    const baseStart = end - rng.int(18, 24)
    const floor = 100
    const ceiling = floor + rng.range(2.8, 3.6) * R

    // A slide into the range, then a quiet stretch bouncing between the edges.
    const waypoints: Waypoint[] = [
      { at: 0, price: floor * rng.range(1.08, 1.12) },
      { at: baseStart, price: floor, touch: 'low' },
    ]
    let side: 'high' | 'low' = 'high'
    for (let i = baseStart + rng.int(4, 5); i < end - 3; i += rng.int(4, 5)) {
      waypoints.push({ at: i, price: side === 'high' ? ceiling : floor, touch: side })
      side = side === 'high' ? 'low' : 'high'
    }
    waypoints.push({ at: end, price: ceiling - R * 0.3 })

    return {
      waypoints,
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'gap',
            type: 'chart',
            bias,
            name: either(bias, 'Breakaway gap up', 'Breakaway gap down'),
            meaning: either(
              bias,
              'After a quiet sideways stretch, price gapped up clean out of the range. Gaps like this often start a new trend.',
              'After a quiet sideways stretch, price gapped down clean out of the range. Gaps like this often start a new trend.',
            ),
            shapes: [level(ceiling, baseStart, last, either(bias, 'Range high', 'Range low')), level(floor, baseStart, last, either(bias, 'Range low', 'Range high'))],
            labelAt: { index: baseStart + 4, price: ceiling + R * 2.2 },
          },
        ]
      },
      prices: { floor, ceiling },
      counts: { days: end - baseStart },
      target: ceiling + (ceiling - floor) * 2,
      invalidation: ceiling - R,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price went quiet for ${c.days} days, stuck between about ${money(p.floor)} and ${money(p.ceiling)}. Then it gapped up: the last candle opened above the whole range and left an empty space on the chart. A gap out of a quiet range is a breakaway gap, and it often starts a new trend.`,
      `Price went quiet for ${c.days} days, stuck between about ${money(p.ceiling)} and ${money(p.floor)}. Then it gapped down: the last candle opened below the whole range and left an empty space on the chart. A gap out of a quiet range is a breakaway gap, and it often starts a new trend.`,
    ),
}

const trendlineBounce: SetupRecipe = {
  key: 'trendline',
  names: { bullish: 'Rising trendline bounce', bearish: 'Falling trendline rejection' },
  signals: REVERSAL_SIGNALS,
  build(rng, end, R) {
    const firstAt = rng.int(6, 10)
    const slope = 100 * rng.range(0.0035, 0.005) // how much the line rises per candle
    const trend = (i: number) => 100 + slope * (i - firstAt)
    const secondAt = firstAt + rng.int(11, 14)
    const thirdAt = secondAt + rng.int(11, 14)
    const lastHighAt = end - rng.int(6, 8)
    const rally = () => rng.range(0.06, 0.085)
    const lastHigh = trend(lastHighAt) * (1 + rally())

    return {
      waypoints: [
        { at: 0, price: trend(0) * rng.range(1.03, 1.05) },
        { at: firstAt, price: trend(firstAt), touch: 'low' },
        { at: Math.round((firstAt + secondAt) / 2), price: trend((firstAt + secondAt) / 2) * (1 + rally()), touch: 'high' },
        { at: secondAt, price: trend(secondAt), touch: 'low' },
        { at: Math.round((secondAt + thirdAt) / 2), price: trend((secondAt + thirdAt) / 2) * (1 + rally()), touch: 'high' },
        { at: thirdAt, price: trend(thirdAt), touch: 'low' },
        { at: lastHighAt, price: lastHigh, touch: 'high' },
        { at: end, price: trend(end) + R * 0.4 },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'trendline',
            type: 'chart',
            bias,
            name: either(bias, 'Rising trendline', 'Falling trendline'),
            meaning: either(
              bias,
              'A straight line through three rising lows. Each dip to it found buyers a little higher, and price just came back to it again.',
              'A straight line through three falling highs. Each bounce to it found sellers a little lower, and price just came back to it again.',
            ),
            shapes: [
              line({ index: firstAt, price: trend(firstAt) }, { index: last, price: trend(last) }, 'Trendline'),
              dot(lowest(cs, firstAt - 1, firstAt + 1), either(bias, 'Touch 1', 'Touch 1'), 'below'),
              dot(lowest(cs, secondAt - 1, secondAt + 1), 'Touch 2', 'below'),
              dot(lowest(cs, thirdAt - 1, thirdAt + 1), 'Touch 3', 'below'),
            ],
            labelAt: { index: firstAt + 4, price: trend(firstAt + 4) - R * 2.4 },
          },
        ]
      },
      prices: { line: trend(end), high: lastHigh },
      target: lastHigh * 1.01,
      invalidation: trend(end) - R * 1.5,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price had bounced off the same rising line three times, each dip holding a little higher than the last: a rising trendline. It then pulled back from about ${money(p.high)} to that line again, near ${money(p.line)}, and the ${lastCandles(c.signal)} show buyers defending it a fourth time.`,
      `Price had been turned away at the same falling line three times, each bounce stalling a little lower than the last: a falling trendline. It then bounced from about ${money(p.high)} up to that line again, near ${money(p.line)}, and the ${lastCandles(c.signal)} show sellers defending it a fourth time.`,
    ),
}

const changeOfCharacter: SetupRecipe = {
  key: 'choch',
  names: { bullish: 'Bullish change of character', bearish: 'Bearish change of character' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    // A downtrend: high, low, lower high, lower low. Then a rally back up to
    // just under that lower high; the signal candles close above it.
    const lowerLowAt = end - rng.int(7, 9)
    const lowerHighAt = lowerLowAt - rng.int(6, 8)
    const lowAt = lowerHighAt - rng.int(6, 8)
    const highAt = lowAt - rng.int(6, 8)
    const high = 112
    const low = high * (1 - rng.range(0.1, 0.12))
    const lowerHigh = high * (1 - rng.range(0.035, 0.05))
    const lowerLow = low * (1 - rng.range(0.03, 0.045))

    return {
      waypoints: [
        { at: 0, price: high * rng.range(0.94, 0.97) },
        { at: highAt, price: high, touch: 'high' },
        { at: lowAt, price: low, touch: 'low' },
        { at: lowerHighAt, price: lowerHigh, touch: 'high' },
        { at: lowerLowAt, price: lowerLow, touch: 'low' },
        { at: end, price: lowerHigh - R * 0.6 },
      ],
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'choch',
            type: 'chart',
            bias,
            name: either(bias, 'Bullish change of character', 'Bearish change of character'),
            meaning: either(
              bias,
              'A downtrend of lower highs and lower lows, until price closed above the last lower high. That first break of the pattern is called a change of character (CHoCH).',
              'An uptrend of higher highs and higher lows, until price closed below the last higher low. That first break of the pattern is called a change of character (CHoCH).',
            ),
            shapes: [
              level(lowerHigh, lowerHighAt, last, either(bias, 'Last lower high', 'Last higher low')),
              dot(highest(cs, highAt - 1, highAt + 1), either(bias, 'High', 'Low'), 'above'),
              dot(highest(cs, lowerHighAt - 1, lowerHighAt + 1), either(bias, 'LH', 'HL'), 'above'),
              dot(lowest(cs, lowAt - 1, lowAt + 1), either(bias, 'Low', 'High'), 'below'),
              dot(lowest(cs, lowerLowAt - 1, lowerLowAt + 1), either(bias, 'LL', 'HH'), 'below'),
            ],
            labelAt: { index: highAt + 2, price: high + R * 2 },
          },
        ]
      },
      prices: { high, lowerHigh, lowerLow },
      target: high,
      invalidation: lowerLow + (lowerHigh - lowerLow) * 0.3,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `Price was in a downtrend: after the high near ${money(p.high)} it made a lower high at ${money(p.lowerHigh)} and a lower low at ${money(p.lowerLow)}. Then buyers pushed back, and the ${lastCandles(c.signal)} closed above that last lower high. That's the first crack in a downtrend, called a change of character.`,
      `Price was in an uptrend: after the low near ${money(p.high)} it made a higher low at ${money(p.lowerHigh)} and a higher high at ${money(p.lowerLow)}. Then sellers pushed back, and the ${lastCandles(c.signal)} closed below that last higher low. That's the first crack in an uptrend, called a change of character.`,
    ),
}

const rectangle: SetupRecipe = {
  key: 'rectangle',
  names: { bullish: 'Bullish rectangle', bearish: 'Bearish rectangle' },
  signals: BREAKOUT_SIGNALS,
  build(rng, end, R) {
    const rangeStart = end - rng.int(24, 30)
    const ceiling = 110
    const floor = ceiling * (1 - rng.range(0.05, 0.065))

    // A rally into the range, then bounces between a flat floor and ceiling.
    const waypoints: Waypoint[] = [
      { at: 0, price: ceiling * rng.range(0.85, 0.88) },
      { at: rangeStart, price: ceiling, touch: 'high' },
    ]
    let side: 'high' | 'low' = 'low'
    for (let i = rangeStart + rng.int(5, 6); i < end - 4; i += rng.int(5, 6)) {
      waypoints.push({ at: i, price: side === 'high' ? ceiling : floor, touch: side })
      side = side === 'high' ? 'low' : 'high'
    }
    waypoints.push({ at: end, price: ceiling - R * 0.45 })

    return {
      waypoints,
      findings: (cs, bias) => {
        const last = cs.length - 1
        return [
          {
            id: 'rectangle',
            type: 'chart',
            bias,
            name: either(bias, 'Bullish rectangle', 'Bearish rectangle'),
            meaning: either(
              bias,
              'An uptrend paused in a flat range with a clear floor and ceiling. Buyers were resting, and a close above the ceiling usually restarts the trend.',
              'A downtrend paused in a flat range with a clear floor and ceiling. Sellers were resting, and a close below the floor usually restarts the trend.',
            ),
            shapes: [
              level(ceiling, rangeStart - 2, last, either(bias, 'Ceiling', 'Floor')),
              level(floor, rangeStart - 2, last, either(bias, 'Floor', 'Ceiling')),
            ],
            labelAt: { index: rangeStart + 6, price: ceiling + R * 1.8 },
          },
        ]
      },
      prices: { ceiling, floor },
      target: ceiling + (ceiling - floor) * 1.2,
      invalidation: ceiling - R * 1.5,
    }
  },
  story: (bias, p, c) =>
    either(
      bias,
      `After a strong climb, price paused in a flat range between ${money(p.floor)} and ${money(p.ceiling)}, bouncing between the same floor and ceiling: a bullish rectangle. The ${lastCandles(c.signal)} closed above the ceiling, which usually restarts the uptrend.`,
      `After a steady slide, price paused in a flat range between ${money(p.ceiling)} and ${money(p.floor)}, bouncing between the same floor and ceiling: a bearish rectangle. The ${lastCandles(c.signal)} closed below the floor, which usually restarts the downtrend.`,
    ),
}

export const SETUPS: SetupRecipe[] = [
  flag,
  doubleBottom,
  channel,
  headAndShoulders,
  triangle,
  supportTest,
  wedge,
  falseBreak,
  structure,
  tripleBottom,
  symmetricalTriangle,
  pennant,
  cupAndHandle,
  roundingBottom,
  breakawayGap,
  trendlineBounce,
  changeOfCharacter,
  rectangle,
  ...MORE_SETUPS,
  chop,
]

// Which patterns the scanner (chartPatterns.ts) should report for each setup.
// Used to check the scanner against charts where we know the answer.
export const SCANNER_MATCHES: Record<string, string[]> = {
  flag: ['bullFlag', 'bearFlag', 'bullishPennant', 'bearishPennant'],
  double: ['doubleBottom', 'doubleTop', 'tripleBottom', 'tripleTop'],
  channel: ['ascendingChannel', 'descendingChannel', 'breakout', 'breakdown'],
  headShoulders: ['inverseHeadAndShoulders', 'headAndShoulders'],
  triangle: ['ascendingTriangle', 'descendingTriangle', 'breakout', 'breakdown'],
  support: ['supportLevel', 'resistanceLevel', 'doubleBottom', 'doubleTop', 'tripleBottom', 'tripleTop'],
  wedge: ['fallingWedge', 'risingWedge', 'breakout', 'breakdown'],
  falseBreak: ['falseBreakdown', 'falseBreakout'],
  structure: ['higherHighsHigherLows', 'lowerHighsLowerLows', 'ascendingChannel', 'descendingChannel'],
  triple: ['tripleBottom', 'tripleTop', 'doubleBottom', 'doubleTop', 'supportLevel', 'resistanceLevel'],
  symTriangle: ['symmetricalTriangle', 'breakout', 'breakdown'],
  pennant: ['bullishPennant', 'bearishPennant', 'bullFlag', 'bearFlag'],
  cup: ['cupAndHandle', 'invertedCupAndHandle'],
  rounding: ['roundingBottom', 'roundingTop', 'cupAndHandle', 'invertedCupAndHandle'],
  gap: ['breakawayGapUp', 'breakawayGapDown', 'breakout', 'breakdown'],
  trendline: ['risingTrendline', 'fallingTrendline', 'ascendingChannel', 'descendingChannel', 'higherHighsHigherLows', 'lowerHighsLowerLows'],
  choch: ['bullishChangeOfCharacter', 'bearishChangeOfCharacter', 'breakout', 'breakdown'],
  rectangle: ['bullishRectangle', 'bearishRectangle', 'horizontalChannel', 'breakout', 'breakdown'],
  ...MORE_SCANNER_MATCHES,
}
