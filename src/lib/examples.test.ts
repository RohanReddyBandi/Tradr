import { describe, expect, it } from 'vitest'
import { CANDLE_PATTERNS, findCandlePatterns } from './candlePatterns'
import { CHART_PATTERNS, findChartPatterns } from './chartPatterns'
import { candleExample, chartExample } from './examples'

// The Learn tab should never show an example that the game itself wouldn't
// recognise as that pattern.
describe('Learn tab examples', () => {
  for (const p of CANDLE_PATTERNS) {
    it(`the ${p.name.toLowerCase()} example is a ${p.name.toLowerCase()}`, () => {
      const example = candleExample(p.key)
      expect(example).not.toBeNull()
      const last = example!.candles.length - 1
      const found = findCandlePatterns(example!.candles, [last]).map((m) => m.pattern.key)
      expect(found).toContain(p.key)
    })
  }

  for (const p of Object.values(CHART_PATTERNS)) {
    it(`the ${p.name.toLowerCase()} example is a ${p.name.toLowerCase()}`, () => {
      const example = chartExample(p.key)
      expect(example).not.toBeNull()
      expect(findChartPatterns(example!.candles).map((m) => m.pattern.key)).toContain(p.key)
      expect(example!.shapes.length).toBeGreaterThan(0)
    })
  }
})
