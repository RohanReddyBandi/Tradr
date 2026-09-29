import { describe, expect, it } from 'vitest'
import { makeRealCard, type RealWindow } from './realCards'
import { analyze } from './analyze'
import { defaultPlan } from './trade'

// The data file isn't in the repo (run `npm run fetch-charts` to create it),
// so these tests only run when it's there. `eager` loads it right away.
const files = import.meta.glob<{ default: RealWindow[] }>('../data/realCharts.json', { eager: true })
const pool: RealWindow[] = Object.values(files)[0]?.default ?? []
const hasData = pool.length > 0

describe.skipIf(!hasData)('the saved real charts', () => {
  it('has plenty of 90-day windows from many tickers', () => {
    expect(pool.length).toBeGreaterThanOrEqual(200)
    expect(new Set(pool.map((w) => w.ticker)).size).toBeGreaterThanOrEqual(40)
  })

  it('contains only sensible candles', () => {
    for (const w of pool) {
      expect(w.bars).toHaveLength(90)
      expect(w.from < w.decision && w.decision < w.to).toBe(true)
      for (const [open, high, low, close] of w.bars) {
        expect(low).toBeGreaterThanOrEqual(5)
        expect(high).toBeGreaterThanOrEqual(Math.max(open, close))
        expect(low).toBeLessThanOrEqual(Math.min(open, close))
      }
    }
  })
})

describe.skipIf(!hasData)('makeRealCard', () => {
  const cards = pool.map((w, i) => makeRealCard(w, i + 1))

  it('splits each window into 60 candles to read and 30 to replay', () => {
    for (const card of cards) {
      expect(card.candles).toHaveLength(60)
      expect(card.future).toHaveLength(30)
      expect(card.source).toBe('real')
      expect(card.real?.ticker).toBeTruthy()
    }
  })

  it('finds a clear lean on a good share of real charts, but not all of them', () => {
    const directional = cards.filter((c) => c.setup.bias !== 'neutral').length / cards.length
    console.log(`real charts with a clear read: ${Math.round(directional * 100)}%`)
    expect(directional).toBeGreaterThan(0.25)
    expect(directional).toBeLessThan(0.95)
  })

  it('never labels a real chart easy', () => {
    expect(cards.every((c) => c.difficulty !== 'easy')).toBe(true)
  })

  it('can be played and graded like any other card', () => {
    const card = cards.find((c) => c.setup.bias === 'bullish')!
    const b = analyze(card, 'buy', defaultPlan(card.candles, 'long', 1000), 1000)
    expect(b.grade).toBe('good-read')
    expect(b.scanned).toEqual([]) // the scanner's read is already the findings
    expect(b.scannerAgrees).toBeNull()
    expect(b.chartText).toMatch(/real chart/)
  })
})
