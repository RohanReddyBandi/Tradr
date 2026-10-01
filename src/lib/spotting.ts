import type { Bias } from '../types'
import type { PatternFamily } from './chartPatterns'

// What to look for, in the order you'd check it, for every pattern in the
// library. Written to match what the detectors actually test, so a chart
// that ticks every box is one the game will call that pattern.

export const SPOT: Record<string, string[]> = {
  // --- Support and resistance -------------------------------------------
  supportLevel: [
    'Price has fallen to about the same price at least twice, and bounced each time',
    'The bounces start from a flat floor, not a rising or falling line',
    'Price is sitting on or just above that floor now',
  ],
  resistanceLevel: [
    'Price has risen to about the same price at least twice, and been pushed back each time',
    'The turns come from a flat ceiling, not a sloping line',
    'Price is sitting at or just under that ceiling now',
  ],
  bullishFibPullback: [
    'A strong rally first: the swing to measure',
    'A pullback that gives back about 38% to 62% of that rally',
    'Price turning back up from that zone',
  ],
  bearishFibPullback: [
    'A strong drop first: the swing to measure',
    'A bounce that wins back about 38% to 62% of that drop',
    'Price turning back down from that zone',
  ],

  // --- Breakouts ----------------------------------------------------------
  breakout: [
    'A ceiling that has stopped price more than once',
    'A candle that closes clearly above it, not just a wick poking through',
    'Best when the breaking candle is a strong one',
  ],
  breakdown: [
    'A floor that has held price more than once',
    'A candle that closes clearly below it, not just a wick poking through',
    'Best when the breaking candle is a strong one',
  ],
  falseBreakout: [
    'A ceiling that has stopped price more than once',
    'Price pokes above it for a candle or two',
    'Then closes back below it, trapping the buyers who chased the break',
  ],
  falseBreakdown: [
    'A floor that has held price more than once',
    'Price pokes below it for a candle or two',
    'Then closes back above it, trapping the sellers who chased the break',
  ],
  uptrendLineBreak: [
    'A rising trendline that price respected several times',
    'A clear close below it',
    "The uptrend's support is gone",
  ],
  downtrendLineBreak: [
    'A falling trendline that capped price several times',
    'A clear close above it',
    "The downtrend's ceiling is gone",
  ],

  // --- Trend structure ----------------------------------------------------
  higherHighsHigherLows: [
    'Each rally peaks above the one before (higher highs)',
    'Each dip stops above the one before (higher lows)',
    'At least two of each, like steps going up',
  ],
  lowerHighsLowerLows: [
    'Each drop goes below the one before (lower lows)',
    'Each bounce stalls below the one before (lower highs)',
    'At least two of each, like steps going down',
  ],
  bullishChangeOfCharacter: [
    'A downtrend: lower highs and lower lows',
    'Then price closes above the last lower high',
    "That first higher high says the sellers have lost control",
  ],
  bearishChangeOfCharacter: [
    'An uptrend: higher highs and higher lows',
    'Then price closes below the last higher low',
    'That first lower low says the buyers have lost control',
  ],

  // --- Channels and trendlines -------------------------------------------
  ascendingChannel: [
    'Two parallel lines sloping up: one under the dips, one over the peaks',
    'Price has touched each line at least twice',
    'It keeps bouncing between them',
  ],
  descendingChannel: [
    'Two parallel lines sloping down: one over the peaks, one under the dips',
    'Price has touched each line at least twice',
    'It keeps bouncing between them',
  ],
  horizontalChannel: [
    'A flat floor and a flat ceiling',
    'Price has touched each at least twice',
    'No higher highs or lower lows: just back and forth',
  ],
  bullishRectangle: [
    'A strong rally first',
    'Then a flat floor and a flat ceiling, each touched more than once',
    'A pause in the uptrend, not a turn',
  ],
  bearishRectangle: [
    'A strong drop first',
    'Then a flat floor and a flat ceiling, each touched more than once',
    'A pause in the downtrend, not a turn',
  ],
  risingTrendline: [
    'A rising line under at least three dips',
    'Closes stay above it: price respects it',
    'The steeper the line, the sooner it tends to break',
  ],
  fallingTrendline: [
    'A falling line over at least three peaks',
    'Closes stay below it: price respects it',
    'The steeper the line, the sooner it tends to break',
  ],

  // --- Reversals ------------------------------------------------------------
  doubleBottom: [
    'A drop into a low',
    'A bounce, then a second low at about the same price',
    'The peak between them is the neckline: a close above it confirms the turn',
  ],
  doubleTop: [
    'A rally into a high',
    'A dip, then a second high at about the same price',
    'The low between them is the neckline: a close below it confirms the turn',
  ],
  tripleBottom: [
    'Three lows at about the same price',
    'Bounces in between that reach a similar height',
    'A close above those bounce highs confirms the turn',
  ],
  tripleTop: [
    'Three highs at about the same price',
    'Dips in between that reach a similar depth',
    'A close below those dip lows confirms the turn',
  ],
  inverseHeadAndShoulders: [
    'Three lows: the middle one (the head) is the deepest',
    'The two outer lows (the shoulders) are about level with each other',
    'A line through the two bounce highs is the neckline: a close above it confirms',
  ],
  headAndShoulders: [
    'Three highs: the middle one (the head) is the highest',
    'The two outer highs (the shoulders) are about level with each other',
    'A line through the two dip lows is the neckline: a close below it confirms',
  ],
  cupAndHandle: [
    'A rounded, U-shaped dip that climbs back to the old high (the cup)',
    'A small, shallow pullback near the rim (the handle)',
    'The handle stays in the top half of the cup',
  ],
  invertedCupAndHandle: [
    'A rounded, upside-down U that falls back to the old low (the cup)',
    'A small, shallow bounce near the rim (the handle)',
    'The handle stays in the bottom half of the cup',
  ],
  roundingBottom: [
    'A slow, smooth curve: down, flat at the bottom, then up',
    'No sharp spike at the low',
    'It takes many candles: gradual, not sudden',
  ],
  roundingTop: [
    'A slow, smooth curve: up, flat at the top, then down',
    'No sharp spike at the high',
    'It takes many candles: gradual, not sudden',
  ],
  vBottom: [
    'A steep drop',
    'A sudden turn at one sharp low, with no time spent basing',
    'An equally steep climb straight back up',
  ],
  vTop: [
    'A steep rally',
    'A sudden turn at one sharp high, with no time spent topping',
    'An equally steep fall straight back down',
  ],
  diamondBottom: [
    'At the end of a fall, the swings first get wider (higher highs and lower lows)',
    'Then they get narrower (lower highs and higher lows)',
    'The outline looks like a diamond',
  ],
  diamondTop: [
    'At the end of a rally, the swings first get wider (higher highs and lower lows)',
    'Then they get narrower (lower highs and higher lows)',
    'The outline looks like a diamond',
  ],
  sellingClimax: [
    'A fall that suddenly speeds up: the fastest drop on the chart',
    'Big red candles, often a long lower wick right at the bottom',
    'Price snaps back up: the panic selling has run out',
  ],
  buyingClimax: [
    'A rally that suddenly speeds up: the fastest rise on the chart',
    'Big green candles, often a long upper wick right at the top',
    'Price snaps back down: the frenzied buying has run out',
  ],

  // --- Triangles and wedges ----------------------------------------------
  ascendingTriangle: [
    'A flat ceiling that price keeps hitting',
    'Rising lows underneath: buyers paying more each time',
    'The two lines squeeze together toward a point',
  ],
  descendingTriangle: [
    'A flat floor that price keeps hitting',
    'Falling highs on top: sellers taking less each time',
    'The two lines squeeze together toward a point',
  ],
  symmetricalTriangle: [
    'Lower highs on top',
    'Higher lows underneath',
    'Both lines slope toward each other and neither is flat: nobody is winning yet',
  ],
  risingWedge: [
    'Both lines slope up',
    'The lower line is steeper, so they squeeze together',
    'Each push higher gains less: buyers are tiring',
  ],
  fallingWedge: [
    'Both lines slope down',
    'The upper line is steeper, so they squeeze together',
    'Each push lower gains less: sellers are tiring',
  ],
  broadeningFormation: [
    'Each swing high is higher than the last, and each swing low is lower',
    'The two lines spread apart, like a megaphone',
    'Wilder and wilder swings, with no direction',
  ],
  ascendingBroadeningWedge: [
    'Both lines slope up',
    'But they spread apart: each swing is wider than the last',
    'An unstable rally that often ends in a fall',
  ],
  descendingBroadeningWedge: [
    'Both lines slope down',
    'But they spread apart: each swing is wider than the last',
    'Sellers are losing control, and it often turns up',
  ],
  volatilitySqueeze: [
    'Big swings early on',
    'Then the candles and swings get smaller and smaller',
    'Price coils in a tight range: a big move is coming, but not saying which way',
  ],

  // --- Flags and pennants --------------------------------------------------
  bullFlag: [
    'A sharp, fast rally first (the pole)',
    'Then a small, tidy channel drifting down or sideways (the flag)',
    'The flag is short and shallow compared with the pole',
  ],
  bearFlag: [
    'A sharp, fast drop first (the pole)',
    'Then a small, tidy channel drifting up or sideways (the flag)',
    'The flag is short and shallow compared with the pole',
  ],
  bullishPennant: [
    'A sharp, fast rally first (the pole)',
    'Then a small triangle: lower highs and higher lows squeezing together',
    'The pennant is small and short compared with the pole',
  ],
  bearishPennant: [
    'A sharp, fast drop first (the pole)',
    'Then a small triangle: lower highs and higher lows squeezing together',
    'The pennant is small and short compared with the pole',
  ],

  // --- Gaps -------------------------------------------------------------------
  islandBottom: [
    'A gap down',
    'A few candles trading on their own down there (the island)',
    'Then a gap back up, leaving the island stranded',
  ],
  islandTop: [
    'A gap up',
    'A few candles trading on their own up there (the island)',
    'Then a gap back down, leaving the island stranded',
  ],
  breakawayGapUp: [
    'A flat range or base first',
    'Price gaps up out of it: an empty space between two candles',
    'The gap leaves the range behind',
  ],
  breakawayGapDown: [
    'A flat range or base first',
    'Price gaps down out of it: an empty space between two candles',
    'The gap leaves the range behind',
  ],
  runawayGapUp: [
    'Already in a strong uptrend',
    'A gap up in the middle of the move',
    'The trend keeps going after it, often about as far again',
  ],
  runawayGapDown: [
    'Already in a strong downtrend',
    'A gap down in the middle of the move',
    'The trend keeps going after it, often about as far again',
  ],
  exhaustionGapDown: [
    'A long fall that speeds up',
    'One last gap down near the bottom',
    'Price climbs straight back and fills the gap: the last sellers are done',
  ],
  exhaustionGapUp: [
    'A long rally that speeds up',
    'One last gap up near the top',
    'Price falls straight back and fills the gap: the last buyers are done',
  ],

  // --- Candles: five ----------------------------------------------------------
  risingThreeMethods: [
    'A big green candle in an uptrend',
    'Three small candles drifting down, staying inside the big candle’s range',
    'Another big green candle that closes above the first',
  ],
  fallingThreeMethods: [
    'A big red candle in a downtrend',
    'Three small candles drifting up, staying inside the big candle’s range',
    'Another big red candle that closes below the first',
  ],

  // --- Candles: three ---------------------------------------------------------
  abandonedBabyBullish: [
    'A red candle after a fall',
    'A doji that gaps below it, touching nothing on either side',
    'A green candle that gaps back above the doji, leaving it stranded',
  ],
  abandonedBabyBearish: [
    'A green candle after a rise',
    'A doji that gaps above it, touching nothing on either side',
    'A red candle that gaps back below the doji, leaving it stranded',
  ],
  morningDojiStar: [
    'A big red candle after a fall',
    'A doji below its body (the star)',
    'A green candle closing past the middle of the red one',
  ],
  eveningDojiStar: [
    'A big green candle after a rise',
    'A doji above its body (the star)',
    'A red candle closing past the middle of the green one',
  ],
  morningStar: [
    'A big red candle after a fall',
    'A small candle below its body (the star), either colour',
    'A green candle closing past the middle of the red one',
  ],
  eveningStar: [
    'A big green candle after a rise',
    'A small candle above its body (the star), either colour',
    'A red candle closing past the middle of the green one',
  ],
  threeWhiteSoldiers: [
    'Three green candles in a row, with solid bodies',
    'Each opens inside the one before and closes higher',
    'Small upper wicks: they close near their highs',
  ],
  threeBlackCrows: [
    'Three red candles in a row, with solid bodies',
    'Each opens inside the one before and closes lower',
    'Small lower wicks: they close near their lows',
  ],
  threeInsideUp: [
    'A big red candle after a fall',
    'A small green candle inside its body (a bullish harami)',
    "A third candle that closes above the red candle's open",
  ],
  threeInsideDown: [
    'A big green candle after a rise',
    'A small red candle inside its body (a bearish harami)',
    "A third candle that closes below the green candle's open",
  ],
  threeOutsideUp: [
    'A red candle',
    'A green candle whose body swallows it (a bullish engulfing)',
    'A third green candle closing higher still',
  ],
  threeOutsideDown: [
    'A green candle',
    'A red candle whose body swallows it (a bearish engulfing)',
    'A third red candle closing lower still',
  ],

  // --- Candles: two -----------------------------------------------------------
  bullishKicker: [
    'A solid red candle',
    'The next candle gaps up above where the red one opened',
    'It is solid green and never trades back into the red candle',
  ],
  bearishKicker: [
    'A solid green candle',
    'The next candle gaps down below where the green one opened',
    'It is solid red and never trades back into the green candle',
  ],
  bullishCounterattack: [
    'A big red candle after a fall',
    'The next candle opens far below it',
    'Then rallies to close right where the red candle closed',
  ],
  bearishCounterattack: [
    'A big green candle after a rise',
    'The next candle opens far above it',
    'Then falls to close right where the green candle closed',
  ],
  bullishEngulfing: [
    'A red candle, and price was not rising into it',
    'A green candle that opens at or below the red close',
    'And closes at or above the red open: its body swallows the red one',
  ],
  bearishEngulfing: [
    'A green candle, and price was not falling into it',
    'A red candle that opens at or above the green close',
    'And closes at or below the green open: its body swallows the green one',
  ],
  piercingLine: [
    'A big red candle after a fall',
    'A green candle that opens below the red close',
    'And closes past the middle of the red body, but not above it',
  ],
  darkCloudCover: [
    'A big green candle after a rise',
    'A red candle that opens above the green close',
    'And closes past the middle of the green body, but not below it',
  ],
  bullishHaramiCross: [
    'A big red candle after a fall',
    'A doji next, tucked inside the red body',
    'The selling has stalled completely',
  ],
  bearishHaramiCross: [
    'A big green candle after a rise',
    'A doji next, tucked inside the green body',
    'The buying has stalled completely',
  ],
  bullishHarami: [
    'A big red candle after a fall',
    'A small green candle tucked inside the red body',
    'The second body is less than half the size of the first',
  ],
  bearishHarami: [
    'A big green candle after a rise',
    'A small red candle tucked inside the green body',
    'The second body is less than half the size of the first',
  ],
  tweezerBottom: [
    'A red candle after a fall',
    'A green candle right after it',
    'Both reach down to the same low',
  ],
  tweezerTop: [
    'A green candle after a rise',
    'A red candle right after it',
    'Both reach up to the same high',
  ],
  risingWindow: [
    'Two candles side by side',
    "The second one's low is above the first one's high",
    'A clear empty space between them: a gap up',
  ],
  fallingWindow: [
    'Two candles side by side',
    "The second one's high is below the first one's low",
    'A clear empty space between them: a gap down',
  ],
  insideBar: [
    'A big candle',
    'The next candle’s whole range, wicks included, fits inside it',
    'A pause before the next move, not a direction',
  ],

  // --- Candles: one -----------------------------------------------------------
  bullishMarubozu: [
    'A big green candle',
    'Little or no wicks: it opened at its low and closed at its high',
    'At least as big as the candles around it',
  ],
  bearishMarubozu: [
    'A big red candle',
    'Little or no wicks: it opened at its high and closed at its low',
    'At least as big as the candles around it',
  ],
  bullishBeltHold: [
    'Comes after a fall',
    'Opens right at its low: no lower wick',
    'Then climbs all day to a big green body',
  ],
  bearishBeltHold: [
    'Comes after a rise',
    'Opens right at its high: no upper wick',
    'Then falls all day to a big red body',
  ],
  hammer: [
    'Comes after a fall',
    'A small body near the top of the candle',
    'A lower wick at least twice the body, and little or no upper wick',
  ],
  shootingStar: [
    'Comes after a rise',
    'A small body near the bottom of the candle',
    'An upper wick at least twice the body, and little or no lower wick',
  ],
  invertedHammer: [
    'Comes after a fall',
    'A small body near the bottom of the candle',
    'A long upper wick, and little or no lower wick',
  ],
  hangingMan: [
    'Comes after a rise',
    'A small body near the top of the candle',
    'A long lower wick and little or no upper wick: a hammer’s shape in the wrong place',
  ],
  dragonflyDoji: [
    'Opens and closes at almost the same price, right at the top',
    'A long lower wick',
    'No upper wick to speak of: it looks like a T',
  ],
  gravestoneDoji: [
    'Opens and closes at almost the same price, right at the bottom',
    'A long upper wick',
    'No lower wick to speak of: an upside-down T',
  ],
  longLeggedDoji: [
    'Opens and closes at almost the same price',
    'Long wicks on both sides',
    'Bigger than the candles around it',
  ],
  doji: [
    'Opens and closes at almost the same price',
    'A body so thin it is nearly a line',
    'Wicks of any length',
  ],
  spinningTop: [
    'A small body, either colour',
    'Wicks on both sides, each longer than the body',
    'Neither buyers nor sellers won the day',
  ],
}

// How traders usually act on it: when to get in, where the stop goes, and
// a typical target. Written per family, for the way the pattern leans.
// `continuation`: candlesticks that say the trend carries on (rather than turning).
export function howToTrade(kind: 'chart' | 'candle', family: PatternFamily | null, continuation: boolean, bias: Bias): string {
  const up = bias === 'bullish'
  const w = up
    ? { side: 'above', other: 'below', low: 'low', high: 'high', dir: 'up', buy: 'buy' }
    : { side: 'below', other: 'above', low: 'high', high: 'low', dir: 'down', buy: 'sell' }
  if (bias === 'neutral') {
    return kind === 'candle'
      ? 'On its own it says nothing about direction. Wait for the next candles to break out of its range, and trade that break, with a stop on the other side of the candle.'
      : 'It has no direction of its own. Traders wait for price to break out of it, trade the break, and put a stop back inside the pattern.'
  }
  if (kind === 'candle') {
    if (continuation)
      return `Mostly a sign the trend is carrying on. Traders ${w.buy} with the trend once it completes, with a stop just ${w.other} the pattern's ${w.low}, and look for the next ${w.high} as a first target.`
    return `Wait for the next candle to confirm it (closing ${w.side} the pattern), then ${w.buy}. The stop goes just ${w.other} the pattern's ${w.low}. It matters most at a ${up ? 'floor' : 'ceiling'} or after a long move ${up ? 'down' : 'up'}; in the middle of nowhere it means little.`
  }
  switch (family) {
    case 'reversal':
      return `Wait for confirmation: a close ${w.side} the neckline (or the last ${up ? 'bounce high' : 'dip low'}). The stop goes just ${w.other} the pattern's ${w.low}est point. A common target is the pattern's height, measured ${w.dir} from the breakout.`
    case 'flag':
      return `Get in when price breaks out of the flag in the pole's direction. The stop goes just ${w.other} the flag. A common target is the length of the pole again, measured from the breakout.`
    case 'triangle':
      return `Wait for a close ${w.side} the pattern's ${up ? 'upper' : 'lower'} line. The stop goes back inside the pattern. A common target is the pattern's widest height, measured from the breakout.`
    case 'channel':
      return `Trade with the slope: ${w.buy} near the ${up ? 'lower' : 'upper'} line, with a stop just ${w.other} it, and take profit near the opposite line. A close through the ${up ? 'lower' : 'upper'} line ends the idea.`
    case 'breakout':
      return `Get in on the close through the line, or on a retest of it from the other side. The stop goes back on the wrong side of the line. If price closes back through it, the break has failed.`
    case 'gap':
      return `Gaps that hold are strong signals; gaps that get filled quickly are traps. Traders ${w.buy} while the gap holds, with a stop on the far side of the gap.`
    case 'structure':
      return `Trade with the staircase: ${w.buy} on the ${up ? 'dips that make higher lows' : 'bounces that make lower highs'}. The trend is broken once price gets past the last ${up ? 'higher low' : 'lower high'}, so that's where the stop goes.`
    case 'level':
      return `${up ? 'Buy near the level' : 'Sell near the level'}, with a stop just ${w.other} it. If price closes well ${w.other} it, the idea is wrong: get out.`
    default:
      return ''
  }
}
