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
- After a buy or sell, set your position size, stop loss, and take profit: drag the
  lines on the chart or type prices, then confirm
- On desktop: arrow keys (→ buy, ← sell, ↑ skip), Escape to back out of a trade,
  Enter for the next card

## Difficulty

Every card shows its difficulty before you decide:

- **Easy**: clean candles, textbook setups, big obvious signal candles
- **Medium**: the standard mix
- **Hard**: noisier candles, pattern lines that only roughly fit, quiet signal candles,
  the trickier setups (false breakouts, wedges, head and shoulders), and sometimes a
  decoy: a strong candle in the middle of a choppy range, where the right call is to skip

The Breakdown of a hard card explains what made it hard.

## Build status

1. ✅ Swipe card UI
2. ✅ Synthetic chart generator: 9 setups (plus a no-edge "chop" chart), each in a bullish and a bearish version
3. ✅ Trade setup panel (position size, draggable stop loss and take profit, live risk/reward) and a replay that closes at the stop or target
4. ✅ Breakdown: replay, markup drawn on the chart, decision graded separately from the outcome
5. ✅ Pattern detection: 31 candlestick patterns and 28 chart patterns, found from the raw candles alone (this is what will read real charts)
6. ⬜ Stats + Learn tabs + saving to localStorage
7. ⬜ Real historical data

## How a card works

1. `lib/generator.ts` picks a setup from `lib/setups.ts` (say, a bull flag), draws a
   price path through that setup's waypoints, and finishes it with real candlestick
   pattern candles from `lib/signalCandles.ts`. It also builds 30 hidden future candles
   that follow the setup 65% of the time, because good setups still fail.
2. Bearish charts are the bullish ones flipped upside down, so every pattern is only
   written once. The same trick halves `lib/candlePatterns.ts`.
3. After you set up the trade, `lib/trade.ts` replays it candle by candle and closes it
   at your stop or target (or at the last candle). `lib/analyze.ts` finds the candlestick
   patterns on the last candles, grades your decision against the setup (never against
   the result), and `lib/riskReview.ts` judges where you put your stop and target.
4. `pages/BreakdownView.tsx` replays the future candles, then `components/Markup.tsx`
   draws the patterns on the chart.
5. The pattern scanner (`lib/chartPatterns.ts`) reads the same candles with no answer
   key: it finds swing points (`lib/pivots.ts`), then looks for each chart pattern in
   them. The Breakdown shows what it found and whether it matched the pattern the
   generator built, and the tests grade it against thousands of generated charts.

## Where things live

| File | What it does |
| --- | --- |
| `src/App.tsx` | App shell: top bar (desktop), bottom tabs (phone), current page |
| `src/game/useGame.ts` | Balance, deck, history, and what happens when you swipe |
| `src/pages/SwipePage.tsx` | The card deck, buttons, arrow keys, and desktop session panel |
| `src/pages/TradeSetupView.tsx` | Position size, stop loss, take profit, risk/reward |
| `src/pages/BreakdownView.tsx` | Replay, result, grades, and explanation after each card |
| `src/components/SwipeCard.tsx` | One draggable card and the swipe physics |
| `src/components/CandleChart.tsx` | The black candlestick chart (TradingView Lightweight Charts) |
| `src/components/Markup.tsx` | Lines, boxes, and labels drawn on top of the chart |
| `src/components/TradeLines.tsx` | The draggable stop loss and take profit lines |
| `src/lib/candlePatterns.ts` | Detectors for 31 candlestick patterns |
| `src/lib/pivots.ts` | Finds swing highs and lows (a "zigzag") |
| `src/lib/chartPatterns.ts` | Detectors for 28 chart patterns, with meanings and common traps |
| `src/lib/setups.ts` | The chart setups the generator can build |
| `src/lib/generator.ts` | Builds random charts with a setup baked in |
| `src/lib/trade.ts` | Trade math and the replay that checks the stop and target |
| `src/lib/riskReview.ts` | Grades your stop and target placement |
| `src/lib/analyze.ts` | Grades a decision and writes the Breakdown text |

## Stack

Vite, React, TypeScript, Tailwind CSS, [Lightweight Charts™](https://www.tradingview.com/lightweight-charts/)
by TradingView, [Motion](https://motion.dev) (formerly Framer Motion) for the swipe
animations, and Vitest for tests.
