import type { Bias } from '../types'
import { CANDLE_PATTERNS } from './candlePatterns'
import { CHART_PATTERNS } from './chartPatterns'

// Every pattern in one list, for the Learn tab.
export interface LibraryEntry {
  key: string
  name: string
  kind: 'chart' | 'candle'
  bias: Bias
  signals: string
  meaning: string
  trap: string
}

export const LIBRARY: LibraryEntry[] = [
  ...Object.values(CHART_PATTERNS).map((p): LibraryEntry => ({
    key: p.key,
    name: p.name,
    kind: 'chart',
    bias: p.bias,
    signals: p.signals,
    meaning: p.meaning,
    trap: p.trap,
  })),
  ...CANDLE_PATTERNS.map((p): LibraryEntry => ({
    key: p.key,
    name: p.name,
    kind: 'candle',
    bias: p.bias,
    signals: p.signals,
    meaning: p.meaning,
    trap: p.trap,
  })),
]

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
