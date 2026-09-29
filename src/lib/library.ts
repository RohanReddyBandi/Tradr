import type { Bias } from '../types'
import { CANDLE_PATTERNS } from './candlePatterns'
import { CHART_PATTERNS, type PatternFamily } from './chartPatterns'

// Every pattern in one list, for the Learn tab and the Practice drills.
export interface LibraryEntry {
  key: string
  name: string
  kind: 'chart' | 'candle'
  group: string // e.g. "Reversals" or "Two candles", for filtering and pickers
  bias: Bias
  signals: string
  meaning: string
  trap: string
}

// Group names, in the order they're listed.
const FAMILY_GROUP: Record<PatternFamily, string> = {
  reversal: 'Reversals',
  flag: 'Flags and pennants',
  triangle: 'Triangles and wedges',
  channel: 'Channels and trendlines',
  breakout: 'Breakouts',
  gap: 'Gaps',
  structure: 'Trend structure',
  level: 'Support and resistance',
}
const SIZE_GROUP: Record<number, string> = { 1: 'One candle', 2: 'Two candles', 3: 'Three candles', 5: 'Five candles' }

export const GROUPS = {
  chart: Object.values(FAMILY_GROUP),
  candle: Object.values(SIZE_GROUP),
}

export const LIBRARY: LibraryEntry[] = [
  ...Object.values(CHART_PATTERNS).map((p): LibraryEntry => ({
    key: p.key,
    name: p.name,
    kind: 'chart',
    group: FAMILY_GROUP[p.family],
    bias: p.bias,
    signals: p.signals,
    meaning: p.meaning,
    trap: p.trap,
  })),
  ...CANDLE_PATTERNS.map((p): LibraryEntry => ({
    key: p.key,
    name: p.name,
    kind: 'candle',
    group: SIZE_GROUP[p.size],
    bias: p.bias,
    signals: p.signals,
    meaning: p.meaning,
    trap: p.trap,
  })),
]

export const entryByKey = (key: string) => LIBRARY.find((e) => e.key === key)

// A few Breakdown names are covered by a Learn entry under another name.
const ALIASES: Record<string, string> = {
  'choppy range': 'horizontal channel',
  'higher low': 'higher highs and higher lows',
  'lower high': 'lower highs and lower lows',
}

// Look a pattern up by the name shown in a Breakdown ("Bull flag").
export function findEntry(name: string) {
  const wanted = ALIASES[name.toLowerCase()] ?? name.toLowerCase()
  return LIBRARY.find((e) => e.name.toLowerCase() === wanted)
}
