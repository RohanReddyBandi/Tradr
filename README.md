# Tradr

A Tinder-style trading practice game. Swipe right to buy, left to sell, up to skip,
then watch the next 30 days play out and get a breakdown of whether your call made
sense. Fake money only.

A **Learn** tab teaches every pattern, charts labelled the way traders mark them up, and
tests you on realistic charts where you call the trend, name the pattern, draw its lines,
read the signal candle, and make the call. It also teaches where a stop loss and take
profit go, with a drill to practice placing them (see "Learn" below).

## Run it

```bash
git clone https://github.com/RohanReddyBandi/Tradr.git
cd Tradr
npm install
npm run fetch-charts   # optional: downloads the real charts (see "Real charts")
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). Run the tests with
`npm test`. Without `npm run fetch-charts`, every card is a generated chart.

## Deploying

Tradr is a static site (no server), deployed on [Vercel](https://vercel.com):

1. Sign in to Vercel with GitHub, choose **Add New → Project**, and import this repo.
   Vercel detects Vite; the defaults (`npm run build`, output `dist`) are right.
2. Every push to `main` redeploys automatically.
3. For visitor stats, open the project's **Analytics** tab and enable Web Analytics.
   The app already includes Vercel's analytics component; it sends nothing until
   that's switched on, and nothing at all when running locally.

The deployed site uses generated charts only, since the real-chart data isn't in the repo.

## Controls

- Drag the card right to **buy**, left to **sell**, up to **skip**
- Or use the Sell / Skip / Buy buttons
- After a buy or sell, set your position size (10% of your balance by default), stop
  loss, and take profit: drag the lines on the chart or type prices, then confirm. The
  stop and target start parked far out at the chart's edges (at least 6 normal days'
  range from the entry), so where they go is always your call
- Before confirming you can also mark up the chart, like on a trading platform: draw
  trendlines and support/resistance levels (their ends snap to nearby highs and lows),
  tap candles to name their candlestick pattern, and name the chart pattern. It's
  optional; the Breakdown grades whatever you drew (see "Your markup" below)
- After the replay, the Breakdown shows the money you made or lost, and an accuracy
  score: how close your stop and target were to the best ones in hindsight
- On desktop: arrow keys (→ buy, ← sell, ↑ skip), Escape to back out of a trade,
  Enter for the next card

## Your markup

Anything you draw on the trade setup chart gets graded in the Breakdown, in its own
"Your markup" card, and stays on the replay chart in blue so you can watch it play out:

- **Lines and levels** are judged the way traders judge them: how many times price
  touched the line and turned (three touches is a line worth trusting, two is a start),
  and how often price closed through it. Trendlines carry on to the right. A line that
  sits on one of the chart's own lines (a neckline, a channel edge) counts as right, and
  the card says whether it held during the replay.
- **Named candles** are right if the candlestick detector sees that pattern on that
  candle (any candle inside a multi-candle pattern counts). If you named candles but not
  the signal at the decision point, the card points it out.
- **The chart pattern** is right if it's the one the chart was built with (or the
  scanner finds it, pointing the same way), and "close" if it's the same kind of pattern.

## Difficulty

Every card shows its difficulty before you decide:

- **Easy**: clean candles, textbook setups, big obvious signal candles
- **Medium**: the standard mix
- **Hard**: noisier candles, pattern lines that only roughly fit, quiet signal candles,
  the trickier setups (false breakouts, wedges, head and shoulders), and sometimes a
  decoy: a strong candle in the middle of a choppy range, where the right call is to skip

The Breakdown of a hard card explains what made it hard.

## Real charts

About a third of the cards are real price history. Before the trade they look exactly
like generated cards; afterwards the Breakdown reveals the stock and the dates.

- **Source:** Yahoo Finance's public chart endpoint
  (`query1.finance.yahoo.com/v8/finance/chart/<TICKER>`), which needs no API key.
  It's unofficial, so it may change without notice, and the data is for personal,
  educational use. Check Yahoo's terms before publishing the data file anywhere public.
- **Getting the data:** `npm run fetch-charts` downloads 15 years of daily prices for 45
  well-known tickers and saves 6 random 90-day windows each to
  `src/data/realCharts.json` (prices are split-adjusted; windows under $5 or with
  broken days are skipped). The app bundles that file, so it never calls Yahoo itself.
- **Not in the repo:** Yahoo's data isn't ours to redistribute, so the file is in
  `.gitignore`. Each copy of the app downloads its own; without it, the app simply
  deals generated charts only.
- **Grading:** a real chart has no built-in answer, so the pattern scanner reads it and
  its read is the answer key: bullish patterns add to a score, bearish ones subtract,
  and a weak or mixed score counts as "no clear setup".
- **Picked, like textbook examples:** trading with the scanner's read only pays off about
  40% of the time on these charts (real markets are harsh). To keep the game's odds the
  same as on generated cards, each real card is first given a kind (no edge 20% of the
  time; otherwise a read that paid off 80% of the time and one that didn't 20%), then an
  unused chart of that kind is dealt. The prices are untouched.

## Learn

Learn is all about the patterns, in one place:

- **The patterns**: every chart and candlestick pattern, searchable and filterable, drawn
  in a textbook style: support in blue, resistance and necklines in amber, numbered swing
  points, a measured-move target, a breakout arrow, and illustrative volume underneath
  (made up for Learn charts only; the swipe cards have no volume). Tap one to study it:
  - the labelled example, with **Play it out** to watch a typical move to the target
  - **How to spot it**: a short checklist, in the order you'd check it, written to match
    what the detector tests (`lib/spotting.ts`)
  - what it means, the trap that catches people, and how traders usually act on it
  - **It is**: three fresh drawings of it, each a little different, each checked by the detector
  - **It isn't**: the look-alikes people confuse it with (its upside-down twin, and the
    patterns it's often mistaken for), plus near misses: the same candles after the wrong
    move, the pattern before it's finished, a body too thick, swings too small, each with
    the reason and each checked
  - **Build one yourself** (candlesticks) or **Draw one yourself** (chart patterns)
  - **Find it in the wild**: practice on three full, realistic charts (the same kind the
    swipe cards use) with the pattern in them. Averaging 80% masters it.
- **Practice scenarios**: the same thing with any pattern and no hints.
- **Stop loss & take profit**: a lesson on placing exits (`lib/exits.ts`):
  - a labelled example: the stop just past the swing low, the target just short of
    resistance, drawn as risk and reward boxes, with **Play it out**
  - where each one goes and why, risk : reward, and the trap of moving your stop
  - **Why the ratio matters**: pick a ratio and a win rate and watch 100 trades play
    out, next to the win rate you'd need to break even
  - **Size the trade from the stop**: risk 0.5 to 2% of your balance and see how many
    shares that stop allows
  - **Where it goes wrong**: a stop too tight, a target too greedy, and a stop too wide,
    each on a chart where the mistake visibly cost money (fixed seeds, checked by tests)
  - **Place the exits**: a drill of five setups where you know the direction. The stop and
    target start far out; drag them into place, get graded on what you could know at the
    time (the same rules as the Breakdown's stop and target review), then watch the month
    play out next to the textbook levels

Each scenario is read the way a trader reads a chart, one question at a time
(`lib/scenarios.ts`):

1. **The trend**: up, down, or sideways (only asked when the chart has a clear answer)
2. **Its key lines**: draw them (flat levels or sloped lines, snapping to highs and lows);
   each real line counts as found if one of yours sits within 0.7 of a normal day's range
   of it. Then the real ones appear.
3. **The pattern**: four choices, with anything else the scanner sees on the chart left
   out. The pattern is drawn on the chart here (its lines, levels, and numbered swing
   points), and its name is written on it once you answer. Lines come first so that
   finding the structure is a real question, and naming it is the next one.
4. **The signal candle**: name the candles in the box, with a close-up
5. **Your call**: buy, sell, or skip. Then the next 30 days play out, and the chart is
   labelled in full. Your own lines are only shown on the lines question, next to the
   real ones, so the finished chart is just the answer.

Labels on Learn charts find a free spot along their line, so they never sit on a numbered
marker or another label.

## Saving

Your balance and history are saved in this browser (localStorage), so they survive a
reload. Reset on the Stats page starts over at $10,000. Learn progress (mastery, scenarios,
the exits drill, and what you've built and drawn) is saved separately and isn't cleared by Reset.

## Build status

1. ✅ Swipe card UI
2. ✅ Synthetic chart generator: 33 setups in a bullish and a bearish version, plus 3 no-edge charts (chop, a volatility squeeze, a broadening formation): 69 kinds of card, each drawn in varied lengths, backstories, and candle styles, with real candlestick patterns planted along the way
3. ✅ Trade setup panel (position size, draggable stop loss and take profit, live risk/reward) and a replay that closes at the stop or target
4. ✅ Breakdown: replay, markup drawn on the chart, decision graded separately from the outcome, and the best stop and target in hindsight with an accuracy score for yours
5. ✅ Pattern detection: 44 candlestick patterns and 58 chart patterns (including gaps, islands, diamonds, rounding and V bottoms, broadening formations, rectangles, trendlines and trendline breaks, climaxes, Fibonacci pullbacks, and changes of character), found from the raw candles alone
6. ✅ Stats (equity curve, win rate, average R, decision accuracy, skip stats, accuracy by difficulty and by pattern), a Learn tab with every pattern, and saving to localStorage
7. ✅ Real historical data: 270 real 90-day windows from 45 stocks and funds, mixed in with generated charts
8. ✅ Build a candlestick and draw a chart pattern yourself, on each pattern's page
9. ✅ Chart markup on the trade setup screen (trendlines, levels, named candles and patterns), graded in the Breakdown
10. ✅ Learn tab: a study page for every pattern in a labelled textbook chart style, and real-world scenario practice to master each one
11. ✅ Stop loss and take profit lesson and drill; the trade setup starts both levels far out so you place them yourself

## How a card works

1. `lib/generator.ts` picks a setup from `lib/setups.ts` or `lib/moreSetups.ts` (say, a
   bull flag), draws a price path through that setup's waypoints, and finishes it with
   real candlestick pattern candles from `lib/signalCandles.ts`. It also builds 30 hidden
   future candles that follow the setup 80% of the time, because good setups still fail
   now and then. Setups are dealt from a shuffled bag: none comes back (in the same
   direction) until every other one has had its turn.
2. Each card also gets its own look (`lib/variety.ts`), so the same setup never looks
   the same twice:
   - a length from 45 to 90 candles (easy cards stay short, so the pattern fills the chart)
   - a backstory for the stretch before the pattern: a plain drift, a swing, a staircase,
     a quiet base before or after the move, an overshoot, a zigzag, a spike, a steady
     grind, or chop. It never crosses the pattern's first key price, so it can't undercut
     a support or top a breakout line.
   - a candle style: standard, smooth, wicky, jumpy, or volatility that builds or fades
   - usually one to three real candlestick patterns at earlier turning points (a hammer
     on a double bottom's first low, a shooting star at a channel's top), each checked
     by the detector
   - signal candles drawn with random proportions, so two hammers aren't identical
   Lengths, backstories, and styles are dealt from shuffled bags as well. A few setups
   only read correctly in some looks (a climax must be the fastest move on the chart),
   so each setup has limits, found by checking the scanner still recognises it. That's
   about 190,000 combinations of setup, direction, length, backstory, style, and signal
   before any of the randomness inside each one.
3. Bearish charts are the bullish ones flipped upside down, so every pattern is only
   written once. The same trick halves `lib/candlePatterns.ts`.
4. After you set up the trade, `lib/trade.ts` replays it candle by candle and closes it
   at your stop or target (or at the last candle). `lib/analyze.ts` finds the candlestick
   patterns on the last candles, grades your decision against the setup (never against
   the result), and `lib/riskReview.ts` judges where you put your stop and target.
   `lib/bestLevels.ts` then works out, with hindsight, where they should have gone: the
   best target sits just inside the best price reached before the idea broke, and the best
   stop just past the deepest dip on the way there.
5. `pages/BreakdownView.tsx` replays the future candles, then `components/Markup.tsx`
   draws the patterns on the chart.
6. The pattern scanner (`lib/chartPatterns.ts`) reads the same candles with no answer
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
| `src/pages/MarkupTools.tsx`, `src/components/DrawingLayer.tsx` | The setup chart's drawing tools and your drawings |
| `src/lib/userMarkup.ts` | Grades your lines, levels, named candles, and named pattern |
| `src/pages/MarkupReviewCard.tsx` | The Breakdown's "Your markup" card |
| `src/pages/BreakdownView.tsx` | Replay, result, grades, and explanation after each card |
| `src/components/SwipeCard.tsx` | One draggable card and the swipe physics |
| `src/components/CandleChart.tsx` | The black candlestick chart (TradingView Lightweight Charts) |
| `src/components/Markup.tsx` | Lines, boxes, and labels drawn on top of the chart |
| `src/components/TradeLines.tsx` | The draggable stop loss and take profit lines |
| `src/lib/candlePatterns.ts` | Detectors for 44 candlestick patterns |
| `src/lib/pivots.ts` | Finds swing highs and lows (a "zigzag") |
| `src/lib/chartPatterns.ts` | Detectors for 58 chart patterns, with meanings and common traps |
| `src/lib/setups.ts`, `src/lib/moreSetups.ts` | The chart setups the generator can build |
| `src/lib/setupKit.ts` | The pieces setups are written with: waypoints, blueprints, drawing helpers |
| `src/lib/generator.ts` | Builds random charts with a setup baked in |
| `src/lib/variety.ts` | Each card's look: length, backstory, candle style, and planted candlestick patterns |
| `src/lib/trade.ts` | Trade math and the replay that checks the stop and target |
| `src/lib/riskReview.ts` | Grades your stop and target placement |
| `src/lib/bestLevels.ts` | The best stop and target in hindsight, and how accurate yours were |
| `src/lib/analyze.ts` | Grades a decision and writes the Breakdown text |
| `src/lib/stats.ts` | Works out the Stats page numbers from your history |
| `src/lib/realCards.ts` | Turns saved real price windows into cards |
| `scripts/fetch-real-charts.mjs` | Downloads the real price history (`npm run fetch-charts`) |
| `src/lib/library.ts`, `src/lib/examples.ts` | The Learn tab's pattern list and example charts |
| `src/pages/StatsPage.tsx`, `src/components/EquityChart.tsx` | Stats page and the equity curve |
| `src/pages/LearnPage.tsx`, `src/pages/learn/` | Learn tab: the pattern library, pattern pages, and scenarios |
| `src/pages/learn/BuildEditor.tsx`, `src/pages/learn/DrawPad.tsx` | Build a candlestick, or draw a chart pattern, yourself |
| `src/lib/spotting.ts`, `src/lib/patternStudy.ts` | Each pattern's spotting checklist, and its examples and look-alikes |
| `src/lib/scenarios.ts`, `src/pages/learn/ScenarioPractice.tsx` | Real-world practice: realistic charts, the questions, and grading |
| `src/lib/annotate.ts`, `src/components/AnnotatedChart.tsx` | The Learn chart style: labelled support, resistance, swing points, targets, volume |
| `src/pages/learn/PatternDetail.tsx` | A pattern's study page |
| `src/game/useLearn.ts` | Pattern mastery, scenario and exits-drill scores, saved in the browser |
| `src/lib/exits.ts`, `src/pages/learn/Exit*.tsx` | The stop loss and take profit lesson, its charts, and the drill |
| `src/components/MiniChart.tsx` | A small static candlestick chart |
| `src/lib/practice.ts` | Building and drawing: the starting candles, and turning a drawing into candles |
| `src/game/usePractice.ts` | The patterns you've built and drawn, saved in the browser |
| `src/components/ChartLayers.tsx`, `src/components/chartScale.ts` | Plain SVG candles and markup for the Learn charts |

## Stack

Vite, React, TypeScript, Tailwind CSS, [Lightweight Charts™](https://www.tradingview.com/lightweight-charts/)
by TradingView, [Motion](https://motion.dev) (formerly Framer Motion) for the swipe
animations, and Vitest for tests.
