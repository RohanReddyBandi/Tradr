import { useEffect, useMemo, useState } from 'react'
import type { Scale } from '../../components/chartScale'
import { AnnotatedChart } from '../../components/AnnotatedChart'
import { illustrativeVolume } from '../../lib/annotate'
import type { ChartSpot } from '../../lib/riskReview'
import { breakEven, dayOf, exitRange, outcomeWords, type LessonChart } from '../../lib/exits'
import { riskAndReward, type Direction, type TradeResult } from '../../lib/trade'
import { COLORS, LEARN, MONO_FONT } from '../../theme'
import { formatMoney, formatR, formatSignedMoney } from '../../format'

// The charts and widgets on the stop loss and take profit lesson.

interface LinesProps {
  scale: Scale
  plot: number // plot width
  from: number // the entry candle
  direction: Direction
  entry: number
  stop: number
  target: number
  compact?: boolean
  zones?: boolean // shade the risk (red) and reward (green) between the lines
  swing?: ChartSpot | null // the swing point the stop hides behind
  obstacle?: ChartSpot | null // the level the target stops short of
  ghost?: { stop: number; target: number } | null // the textbook levels, dotted, to compare
}

// Entry, stop loss, and take profit drawn the way a position tool draws them:
// two boxes from the entry onwards, red for what you risk and green for what
// you're aiming at, with the reward as a multiple of the risk.
export function ExitLines({ scale, plot, from, direction, entry, stop, target, compact, zones = true, swing, obstacle, ghost }: LinesProps) {
  const { x, y } = scale
  const x0 = x(from) - scale.slot / 2
  const long = direction === 'long'
  const risk = Math.abs(entry - stop)
  const ratio = risk > 0 ? Math.abs(target - entry) / risk : 0
  const fontSize = compact ? 9.5 : 11.5
  const right = plot - 6
  const top = (a: number, b: number) => Math.min(y(a), y(b))
  const tall = (a: number, b: number) => Math.abs(y(a) - y(b))
  // TP just inside its box (the line itself can sit right under resistance),
  // SL just outside its box, and Entry at the reward box's near corner.
  const below = (price: number) => y(price) + fontSize + 4
  const above = (price: number) => y(price) - 6
  const tpY = compact ? (long ? above(target) : below(target)) : long ? below(target) : above(target)
  const slY = long ? below(stop) : above(stop)
  const word = long ? { swing: 'Swing low', obstacle: 'Resistance' } : { swing: 'Swing high', obstacle: 'Support' }

  return (
    // Labels get a dark outline so they stay readable over the replay's candles.
    <g fontFamily={MONO_FONT} fontSize={fontSize} stroke="#07090c" strokeWidth={0} paintOrder="stroke" strokeLinejoin="round">
      {zones && (
        <>
          <rect x={x0} y={top(entry, target)} width={Math.max(0, plot - x0)} height={tall(entry, target)} fill={COLORS.up} opacity={0.1} />
          <rect x={x0} y={top(entry, stop)} width={Math.max(0, plot - x0)} height={tall(entry, stop)} fill={COLORS.down} opacity={0.1} />
        </>
      )}

      {obstacle && (
        <g>
          <line x1={x(obstacle.index)} x2={plot} y1={y(obstacle.price)} y2={y(obstacle.price)} stroke={LEARN.resistance} strokeWidth={1.25} strokeDasharray="8 6" opacity={0.85} />
          {!compact && (
            <text x={x0 - 6} y={long ? above(obstacle.price) : below(obstacle.price)} textAnchor="end" fill={LEARN.resistance} fontFamily="inherit" strokeWidth={3}>
              {word.obstacle}
            </text>
          )}
        </g>
      )}
      {swing && (
        <g>
          <line x1={x(swing.index)} x2={x(from)} y1={y(swing.price)} y2={y(swing.price)} stroke={LEARN.support} strokeWidth={1.25} strokeDasharray="2 4" />
          <circle cx={x(swing.index)} cy={y(swing.price)} r={compact ? 3 : 4.5} fill="none" stroke={LEARN.support} strokeWidth={1.75} />
          {!compact && (
            <text x={x(swing.index) - 9} y={y(swing.price) + 4} textAnchor="end" fill={LEARN.support} fontFamily="inherit" strokeWidth={3}>
              {word.swing}
            </text>
          )}
        </g>
      )}

      {ghost && (
        <g stroke="#e8e8e8" strokeWidth={1.25} strokeDasharray="2 4" opacity={0.75}>
          <line x1={x0} x2={plot} y1={y(ghost.stop)} y2={y(ghost.stop)} />
          <line x1={x0} x2={plot} y1={y(ghost.target)} y2={y(ghost.target)} />
        </g>
      )}

      <line x1={x0} x2={plot} y1={y(target)} y2={y(target)} stroke={COLORS.up} strokeWidth={1.5} strokeDasharray="6 5" />
      <line x1={x0} x2={plot} y1={y(stop)} y2={y(stop)} stroke={COLORS.down} strokeWidth={1.5} strokeDasharray="6 5" />
      <line x1={x0} x2={plot} y1={y(entry)} y2={y(entry)} stroke="#d9d9d9" strokeWidth={1.25} />

      <text x={right} y={tpY} textAnchor="end" fill={COLORS.up} fontFamily="inherit" strokeWidth={3}>
        {compact ? 'TP' : `TP ${target.toFixed(2)} · ${formatR(ratio)}`}
      </text>
      <text x={right} y={slY} textAnchor="end" fill={COLORS.down} fontFamily="inherit" strokeWidth={3}>
        {compact ? 'SL' : `SL ${stop.toFixed(2)} · ${formatR(-1)}`}
      </text>
      {!compact && (
        <text x={x0 + 6} y={long ? above(entry) : below(entry)} fill="#d9d9d9" fontFamily="inherit" strokeWidth={3}>
          Entry
        </text>
      )}
    </g>
  )
}

// The lesson's big chart: the textbook exits on a real-looking setup, with
// the swing low under the stop and the resistance over the target. "Play it
// out" runs the next month to see which level got hit.
export function ExitsHero({ chart, height }: { chart: LessonChart; height: number }) {
  const { candles, future, plan, textbook } = chart
  const last = candles.length - 1
  const stopAt = Math.min(future.length, chart.result.exit.index + 6) // a few days past the exit, then stop
  const all = useMemo(() => [...candles, ...future.slice(0, stopAt)], [candles, future, stopAt])
  const volume = useMemo(() => illustrativeVolume(all, 31), [all])
  const range = useMemo(() => exitRange(all, [plan.stop, plan.target]), [all, plan])
  const [shown, setShown] = useState(0)
  const [started, setStarted] = useState(false)
  const played = shown >= stopAt
  const playing = started && !played

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setShown((n) => n + 1), 90)
    return () => clearTimeout(timer)
  }, [playing, shown])

  const { risk, reward } = riskAndReward(plan)
  const exited = shown > chart.result.exit.index

  return (
    <div className="rounded-3xl border border-edge bg-[#07090c] px-1.5 pt-2 pb-1.5">
      <AnnotatedChart
        candles={all.slice(0, candles.length + shown)}
        slots={candles.length + stopAt + 2}
        range={range}
        volume={volume}
        height={height}
        title="Stop loss & take profit"
        shadeFrom={shown ? candles.length : undefined}
        label={`A long trade with its stop loss just under the swing low and its take profit just under resistance${exited ? `. ${outcomeWords(chart.result)}` : ''}`}
      >
        {(scale, plot) => (
          <ExitLines
            scale={scale}
            plot={plot}
            from={last}
            direction={plan.direction}
            entry={plan.entry}
            stop={plan.stop}
            target={plan.target}
            swing={textbook.swing}
            obstacle={textbook.obstacle}
          />
        )}
      </AnnotatedChart>
      <div className="flex items-center justify-between gap-3 px-2 pt-1">
        <span className="text-[12.5px] text-muted" aria-live="polite">
          {exited ? (
            <span className={chart.result.pnl >= 0 ? 'text-up' : 'text-down'}>
              {outcomeWords(chart.result)}: {formatR(chart.result.r)}
            </span>
          ) : (
            `Risking ${formatMoney(risk)} to make ${formatMoney(reward)} on a ${formatMoney(plan.size)} position`
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            setShown(0)
            setStarted(!played)
          }}
          disabled={playing}
          className="h-9 shrink-0 rounded-lg px-2.5 text-[13px] font-medium text-soft transition-colors hover:bg-neutral-900 hover:text-white disabled:opacity-50"
        >
          {played ? 'Reset' : playing ? 'Playing…' : 'Play it out ▸'}
        </button>
      </div>
    </div>
  )
}

const TRAP_TITLE = { tight: 'Stop too tight', greedy: 'Target too greedy', wide: 'Stop too wide' } as const

// One classic mistake on its own chart, played out, with what the textbook
// exits would have done instead.
export function TrapCard({ chart }: { chart: LessonChart }) {
  const kind = chart.kind as keyof typeof TRAP_TITLE
  const { candles, future, plan, textbook, result, textbookResult } = chart
  const until = Math.min(future.length, Math.max(result.exit.index, textbookResult.exit.index) + 3)
  const all = useMemo(() => [...candles, ...future.slice(0, until)], [candles, future, until])
  const range = useMemo(() => exitRange(all, [plan.stop, plan.target, textbook.stop, textbook.target]), [all, plan, textbook])
  const volume = useMemo(() => illustrativeVolume(all, 17), [all])
  const money = (r: TradeResult) => formatSignedMoney(r.pnl)
  const did = (r: TradeResult) => (r.pnl >= 0 ? `made ${formatMoney(r.pnl)}` : `lost ${formatMoney(-r.pnl)}`)
  const ratio = riskAndReward(plan).reward / riskAndReward(plan).risk
  const swingWord = plan.direction === 'long' ? 'swing low' : 'swing high'
  const text = {
    tight: `Half a normal day's range from the entry is inside everyday noise. ${outcomeWords(result)} and ${did(result)}, then price went on to the target without it. The stop just past the ${swingWord} ${did(textbookResult)}.`,
    greedy: `The target sat further than price ever got, so it never filled: by the end the trade had ${did(result)}. The target just short of the next obstacle ${did(textbookResult)} on ${dayOf(textbookResult)}.`,
    wide: `This setup failed. A stop ${(Math.abs(plan.entry - plan.stop) / Math.abs(plan.entry - textbook.stop)).toFixed(1)}× further out ${did(result)} instead of ${formatMoney(-textbookResult.pnl)}, and it was only ever aiming for 1 : ${ratio.toFixed(1)}.`,
  }[kind]

  return (
    <figure className="rounded-2xl border border-down/20 bg-card p-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center sm:gap-2">
      <div className="rounded-xl bg-[#07090c] px-1 py-1.5">
        <AnnotatedChart
          candles={all}
          range={range}
          volume={volume}
          height={160}
          compact
          shadeFrom={candles.length}
          label={`${TRAP_TITLE[kind]}: ${outcomeWords(result)}`}
        >
          {(scale, plot) => (
            <ExitLines
              scale={scale}
              plot={plot}
              from={candles.length - 1}
              direction={plan.direction}
              entry={plan.entry}
              stop={plan.stop}
              target={plan.target}
              compact
              ghost={{ stop: textbook.stop, target: textbook.target }}
            />
          )}
        </AnnotatedChart>
      </div>
      <figcaption className="px-1.5 pt-2 pb-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-semibold text-down">
            <span aria-hidden="true">✗ </span>
            {TRAP_TITLE[kind]}
          </span>
          <span className={`font-mono text-[12.5px] ${result.pnl >= 0 ? 'text-up' : 'text-down'}`}>{money(result)}</span>
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-soft">{text}</p>
      </figcaption>
    </figure>
  )
}

// 100 evenly spread "coin flips" in a fixed shuffled order: a 45% win rate
// wins exactly 45 of the 100 trades (so the total matches the maths), the
// order still looks like real trading, and moving the slider only flips the
// trades it has to.
const FLIPS = (() => {
  const flips = Array.from({ length: 100 }, (_, i) => (i + 0.5) / 100)
  let state = 9
  for (let i = flips.length - 1; i > 0; i--) {
    state = (state * 16807) % 2147483647
    const j = state % (i + 1)
    ;[flips[i], flips[j]] = [flips[j], flips[i]]
  }
  return flips
})()

const RATIOS = [0.5, 1, 1.5, 2, 3]

// Win rate against risk : reward. The same win rate can make or lose money
// depending on the ratio; the break-even line shows how often you need to win.
export function RatioPlayground() {
  const [ratio, setRatio] = useState(2)
  const [winRate, setWinRate] = useState(0.45)
  const curve = useMemo(() => FLIPS.reduce((sums, u) => [...sums, sums[sums.length - 1] + (u < winRate ? ratio : -1)], [0]), [ratio, winRate])
  const final = curve[curve.length - 1]
  const needed = breakEven(ratio)
  const lo = Math.min(...curve, -10)
  const hi = Math.max(...curve, 10)
  const W = 320
  const H = 120
  const px = (i: number) => (i / (curve.length - 1)) * W
  const py = (v: number) => 8 + ((hi - v) / (hi - lo)) * (H - 16)
  const color = final >= 0 ? COLORS.up : COLORS.down

  return (
    <div className="rounded-2xl border border-edge bg-card p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-[13px] text-soft" id="ratio-label">
            Risk : reward
          </div>
          <div role="radiogroup" aria-labelledby="ratio-label" className="mt-2 grid grid-cols-5 gap-1 rounded-xl border border-edge p-1">
            {RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={ratio === r}
                onClick={() => setRatio(r)}
                className={`h-10 rounded-lg font-mono text-[13px] transition-colors ${ratio === r ? 'bg-neutral-800 text-white' : 'text-muted hover:text-soft'}`}
              >
                1:{r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="win-rate" className="flex items-baseline justify-between text-[13px] text-soft">
            How often you win <span className="font-mono text-white">{Math.round(winRate * 100)}%</span>
          </label>
          <input
            id="win-rate"
            type="range"
            min={0.2}
            max={0.8}
            step={0.05}
            value={winRate}
            onChange={(e) => setWinRate(Number(e.target.value))}
            className="mt-4 w-full accent-[#d9d9d9]"
          />
        </div>
      </div>

      <div className="mt-4 grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full" preserveAspectRatio="none" role="img" aria-label={`100 trades at 1 : ${ratio}, winning ${Math.round(winRate * 100)}%: ${formatR(final)} in total`}>
          <line x1={0} x2={W} y1={py(0)} y2={py(0)} stroke="#3a3a3a" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <polyline points={curve.map((v, i) => `${px(i)},${py(v)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="flex gap-6 sm:flex-col sm:gap-3 sm:text-right">
          <div>
            <div className={`font-mono text-[26px] leading-none ${final >= 0 ? 'text-up' : 'text-down'}`}>{formatR(final)}</div>
            <div className="mt-1 text-[12px] text-muted">after 100 trades</div>
          </div>
          <div>
            <div className="font-mono text-[26px] leading-none text-white">{Math.round(needed * 100)}%</div>
            <div className="mt-1 text-[12px] text-muted">wins needed to break even</div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-soft">
        {Math.abs(winRate - needed) < 0.01
          ? `At 1 : ${ratio}, winning ${Math.round(winRate * 100)}% of the time only breaks even.`
          : winRate > needed
          ? `Winning ${Math.round(winRate * 100)}% of the time at 1 : ${ratio} comes out ahead${winRate < 0.5 ? ', even though you lose more trades than you win' : ''}.`
          : `At 1 : ${ratio} you need to win more than ${Math.round(needed * 100)}% of the time. ${Math.round(winRate * 100)}% loses money, slowly but surely.`}{' '}
        <span className="text-muted">R is what you risk on each trade: a loss is −1R, a win is +{ratio}R.</span>
      </p>
    </div>
  )
}

const RISK_SHARES = [0.005, 0.01, 0.02]

// Position size, worked backwards from the stop: decide what you're willing
// to lose, then buy only as much as that stop allows.
export function SizeFromStop({ entry, stop, balance }: { entry: number; stop: number; balance: number }) {
  const [share, setShare] = useState(0.01)
  const budget = balance * share
  const perShare = Math.abs(entry - stop)
  const shares = Math.floor(budget / perShare)
  const position = shares * entry

  return (
    <div className="rounded-2xl border border-edge bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-[14px] text-soft">
        Risk
        <div role="radiogroup" aria-label="Share of your balance to risk" className="inline-grid grid-cols-3 gap-1 rounded-xl border border-edge p-1">
          {RISK_SHARES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={share === s}
              onClick={() => setShare(s)}
              className={`h-9 rounded-lg px-3 font-mono text-[13px] transition-colors ${share === s ? 'bg-neutral-800 text-white' : 'text-muted hover:text-soft'}`}
            >
              {s * 100}%
            </button>
          ))}
        </div>
        of a {formatMoney(balance)} balance
      </div>
      <ul className="mt-4 grid gap-2 font-mono text-[14px] sm:grid-cols-3">
        <Step label="You can lose" value={formatMoney(budget)} />
        <Step label="Each share risks" value={`${formatMoney(perShare)}`} note={`${entry.toFixed(2)} − ${stop.toFixed(2)}`} />
        <Step label="So buy" value={`${shares} shares`} note={`${formatMoney(position)}, ${Math.round((position / balance) * 100)}% of balance`} />
      </ul>
      <p className="mt-3 text-[14px] leading-relaxed text-soft">
        If the stop is hit you lose about {formatMoney(shares * perShare)}, whatever the chart. A wider stop means fewer shares, not more risk.
      </p>
    </div>
  )
}

function Step({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <li className="rounded-xl border border-edge px-3 py-2.5">
      <div className="font-sans text-[12px] text-muted">{label}</div>
      <div className="mt-1 text-[17px] text-white">{value}</div>
      {note && <div className="mt-0.5 text-[11.5px] text-muted">{note}</div>}
    </li>
  )
}
