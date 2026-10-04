import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { simulateRun, type Run } from '../../../lib/lessons'
import { useWidth } from '../../../components/chartScale'
import { formatMoney } from '../../../format'
import { COLORS, MONO_FONT } from '../../../theme'
import { Goals, Note, PillButton, PrimaryButton, Stage, type LessonProps } from './parts'

const TRADES = 50
const RATIOS = [1, 1.5, 2, 3]
const START = 10_000

// Pick a win rate and a risk : reward, run 50 trades risking 1% each, and
// see the equity curve and the streaks. Then run the same odds again.
export function LuckSimulator({ done, onDone }: LessonProps) {
  const reduceMotion = useReducedMotion()
  const [winRate, setWinRate] = useState(0.5)
  const [ratio, setRatio] = useState(2)
  const [run, setRun] = useState<Run | null>(null)
  const [shown, setShown] = useState(0)
  const [runs, setRuns] = useState(done ? 2 : 0)

  useEffect(() => {
    if (!run || shown >= TRADES) return
    const timer = setTimeout(() => setShown((n) => n + 1), 28)
    return () => clearTimeout(timer)
  }, [run, shown])

  useEffect(() => {
    if (runs >= 2 && !done) onDone()
  }, [runs, done, onDone])

  function go() {
    setRun(simulateRun(winRate, ratio, TRADES, Math.floor(Math.random() * 1e9)))
    setShown(reduceMotion ? TRADES : 0)
    setRuns((n) => n + 1)
  }

  const edge = winRate * ratio - (1 - winRate) // average result per trade, in multiples of what you risk
  const finished = run && shown >= TRADES
  const final = run ? run.balances[TRADES] : START
  const wins = run ? run.wins.filter(Boolean).length : 0

  return (
    <div className="flex flex-col gap-4">
      <Stage>
        <div className="grid gap-4 px-1 sm:grid-cols-2">
          <div>
            <label htmlFor="win-rate" className="flex items-baseline justify-between">
              <span className="text-[15px] text-soft">Win rate</span>
              <span className="text-[18px] tabular-nums" style={{ fontFamily: MONO_FONT }}>
                {Math.round(winRate * 100)}%
              </span>
            </label>
            <input
              id="win-rate"
              type="range"
              min={30}
              max={80}
              step={5}
              value={Math.round(winRate * 100)}
              onChange={(e) => setWinRate(Number(e.target.value) / 100)}
              className="mt-2 w-full accent-[#3ddc97]"
            />
          </div>
          <div>
            <div className="text-[15px] text-soft">Risk : reward</div>
            <div className="mt-2 flex gap-1.5" role="group" aria-label="Risk : reward">
              {RATIOS.map((r) => (
                <PillButton key={r} active={ratio === r} onClick={() => setRatio(r)}>
                  1 : {r}
                </PillButton>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 px-1 text-[13.5px] leading-relaxed text-muted">
          Each trade risks 1% of the balance. On average, these odds {edge >= 0 ? 'make' : 'lose'}{' '}
          <span className={edge >= 0 ? 'text-up' : 'text-down'}>{Math.abs(edge).toFixed(2)}%</span> a trade.
        </p>

        <Equity run={run} shown={shown} />
        {/* One square per trade: green won, red lost. */}
        <div className="mt-2 grid grid-cols-[repeat(25,minmax(0,1fr))] gap-[3px] px-1" aria-hidden="true">
          {Array.from({ length: TRADES }, (_, k) => (
            <div
              key={k}
              className={`aspect-square rounded-[2px] ${!run || k >= shown ? 'bg-neutral-800' : run.wins[k] ? 'bg-up' : 'bg-down'}`}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 px-1">
          <PrimaryButton onClick={go}>{run ? 'Run it again' : `Run ${TRADES} trades`}</PrimaryButton>
          {finished && (
            <span className="text-[14px] text-soft">
              {wins} wins, {TRADES - wins} losses · longest losing streak <span className="text-down">{run.longestLosing}</span>
            </span>
          )}
        </div>
      </Stage>

      {finished && (
        <Note tone={final >= START === edge >= 0 ? 'plain' : 'nudge'}>
          Ended at <span className="font-semibold">{formatMoney(final)}</span> ({final >= START ? '+' : '−'}
          {Math.abs((final / START - 1) * 100).toFixed(1)}%).{' '}
          {edge >= 0 && final < START
            ? 'A losing run with winning odds: that was bad luck, not a bad plan. Run it again.'
            : edge < 0 && final >= START
              ? 'A winning run with losing odds: that was luck, and over more trades it runs out.'
              : `Even so, there was a streak of ${run.longestLosing} losses in a row. Run it again: same odds, different luck.`}
        </Note>
      )}
      <Goals goals={[{ label: 'Run the same odds twice', met: runs >= 2 }]} />
    </div>
  )
}

function Equity({ run, shown }: { run: Run | null; shown: number }) {
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const height = 150
  const pad = 12
  const values = run ? run.balances : [START]
  const low = Math.min(START * 0.85, ...values)
  const high = Math.max(START * 1.15, ...values)
  const x = (k: number) => pad + (k / TRADES) * (width - pad * 2)
  const y = (v: number) => pad + ((high - v) / (high - low)) * (height - pad * 2)
  const drawn = values.slice(0, shown + 1)
  const last = drawn[drawn.length - 1]
  return (
    <div ref={box} className="mt-3 w-full">
      {width > 0 && (
        <svg width={width} height={height} className="block" role="img" aria-label={run ? `Balance after ${shown} trades: ${formatMoney(last)}` : 'Balance chart, empty until you run the trades'}>
          <line x1={pad} x2={width - pad} y1={y(START)} y2={y(START)} stroke={COLORS.grid} strokeDasharray="4 4" />
          <text x={width - pad} y={y(START) + 15} textAnchor="end" fontSize={10.5} fill={COLORS.axisText} fontFamily={MONO_FONT}>
            {formatMoney(START)}
          </text>
          {run && (
            <>
              <polyline
                points={drawn.map((v, k) => `${x(k)},${y(v)}`).join(' ')}
                fill="none"
                stroke={last >= START ? COLORS.up : COLORS.down}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <circle cx={x(drawn.length - 1)} cy={y(last)} r={3.5} fill={last >= START ? COLORS.up : COLORS.down} />
            </>
          )}
        </svg>
      )}
    </div>
  )
}
