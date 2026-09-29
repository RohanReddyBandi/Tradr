// One bar of daily price data.
export interface Candle {
  time: number // seconds since 1970 (UTC); never shown before the trade
  open: number
  high: number
  low: number
  close: number
}

// What the user did with a card.
export type Decision = 'buy' | 'sell' | 'skip'

// Which way a pattern (or a whole setup) points.
export type Bias = 'bullish' | 'bearish' | 'neutral'

// A spot on the chart: which candle (by position, 0 = first) and what price.
export interface ChartPoint {
  index: number
  price: number
}

// Things we can draw on top of a chart in the Breakdown.
export type Shape =
  | { kind: 'line'; from: ChartPoint; to: ChartPoint; label?: string } // trendline, channel edge, neckline
  | { kind: 'level'; price: number; fromIndex: number; toIndex: number; label?: string } // support / resistance
  | { kind: 'dot'; at: ChartPoint; label: string; place: 'above' | 'below' } // a swing point, e.g. "Head"
  | { kind: 'curve'; points: ChartPoint[] } // a smooth curve, like the bottom of a cup
  | { kind: 'candles'; fromIndex: number; toIndex: number } // outline around exact candles

// One thing the chart was "saying": a chart pattern or a candlestick pattern.
export interface Finding {
  id: string
  name: string // e.g. "Bull flag" or "Bullish engulfing"
  type: 'chart' | 'candle'
  bias: Bias
  meaning: string // one or two plain-English sentences
  shapes: Shape[]
  labelAt?: ChartPoint // where the name goes on the chart (optional)
}

// The pattern the generator deliberately built into a chart.
export interface Setup {
  key: string // which recipe built it, e.g. "flag"
  name: string // e.g. "Bull flag"
  bias: Bias
  story: string // what the chart was doing, in plain English
  chartFindings: Finding[] // chart-pattern shapes to draw
}

// How hard a chart is to read. Shown on the card before you decide.
export type Difficulty = 'easy' | 'medium' | 'hard'

// Where a real chart came from. Hidden until after the trade.
export interface RealInfo {
  ticker: string
  name: string
  from: string // first visible day (YYYY-MM-DD)
  decision: string // the day you decided on
  to: string // last replayed day
}

// Everything needed to show one swipe card and grade it afterwards.
export interface ChartCard {
  id: string
  number: number // shown as "Card 14" in the card header
  source: 'generated' | 'real'
  real?: RealInfo // only for real charts
  difficulty: Difficulty
  difficultyNotes: string[] // for hard cards: what makes them hard
  candles: Candle[] // what you see before deciding
  future: Candle[] // the next candles, hidden until after you decide
  setup: Setup
}
