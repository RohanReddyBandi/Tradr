# Tradr

A Tinder-style trading practice game. Swipe right to buy, left to sell, up to skip,
then watch the next 30 days play out and get a breakdown of whether your call made
sense. Fake money only.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). Run the tests with
`npm test`.

## Controls

- Drag the card right to **buy**, left to **sell**, up to **skip**
- Or use the Sell / Skip / Buy buttons
- On desktop: arrow keys (→ buy, ← sell, ↑ skip), then Enter for the next card

## Build status

1. ✅ Swipe card UI
2. ✅ Synthetic chart generator: 9 setups (plus a no-edge "chop" chart), each in a bullish and a bearish version
3. ⬜ Trade setup panel (position size, stop loss, take profit). For now every trade is 10% of your balance, held for 30 days
4. ✅ Breakdown: replay, markup drawn on the chart, decision graded separately from the outcome
5. 🟡 Pattern detection: every candlestick pattern is done and tested; chart-pattern detection (needed for real charts) is next
6. ⬜ Stats + Learn tabs + saving to localStorage
7. ⬜ Real historical data

## How a card works

1. `lib/generator.ts` picks a setup from `lib/setups.ts` (say, a bull flag), draws a
   price path through that setup's waypoints, and finishes it with real candlestick
   pattern candles from `lib/signalCandles.ts`. It also builds 30 hidden future candles
   that follow the setup 65% of the time, because good setups still fail.
2. Bearish charts are the bullish ones flipped upside down, so every pattern is only
   written once. The same trick halves `lib/candlePatterns.ts`.
3. After you swipe, `lib/analyze.ts` finds the candlestick patterns on the last candles,
   grades your decision against the setup (never against the result), and writes the
   explanation.
4. `pages/BreakdownView.tsx` replays the future candles, then `components/Markup.tsx`
   draws the patterns on the chart.

## Where things live

| File | What it does |
| --- | --- |
| `src/App.tsx` | App shell: top bar (desktop), bottom tabs (phone), current page |
| `src/game/useGame.ts` | Balance, deck, history, and what happens when you swipe |
| `src/pages/SwipePage.tsx` | The card deck, buttons, arrow keys, and desktop session panel |
| `src/pages/BreakdownView.tsx` | Replay, result, grades, and explanation after each card |
| `src/components/SwipeCard.tsx` | One draggable card and the swipe physics |
| `src/components/CandleChart.tsx` | The black candlestick chart (TradingView Lightweight Charts) |
| `src/components/Markup.tsx` | Lines, boxes, and labels drawn on top of the chart |
| `src/lib/candlePatterns.ts` | Detectors for 31 candlestick patterns |
| `src/lib/setups.ts` | The chart setups the generator can build |
| `src/lib/generator.ts` | Builds random charts with a setup baked in |
| `src/lib/analyze.ts` | Grades a decision and writes the Breakdown text |

## Stack

Vite, React, TypeScript, Tailwind CSS, [Lightweight Charts™](https://www.tradingview.com/lightweight-charts/)
by TradingView, [Motion](https://motion.dev) (formerly Framer Motion) for the swipe
animations, and Vitest for tests.
