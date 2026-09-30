import { useEffect, useMemo, useState } from 'react'
import { pullbackChart, breakEvenWinRate } from '../../../lib/lessons'
import { averageTrueRange } from '../../../lib/trade'
import { reviewStopAndTarget } from '../../../lib/riskReview'
import { SvgChart } from '../../../components/SvgChart'
import { TradeLines } from '../../../components/TradeLines'
import { COLORS, MONO_FONT } from '../../../theme'
import { Goals, Note, Stage, type LessonProps } from './parts'

// A long setup to plan: drag the stop and target, and watch the risk :
// reward, the win rate it needs, and the same stop-and-target review the
// Breakdown gives.
export function RiskRewardLab({ done, onDone }: LessonProps) {
  const [seed] = useState(() => 1 + Math.floor(Math.random() * 500))
  const candles = useMemo(() => pullbackChart(seed), [seed])
  const entry = candles[candles.length - 1].close
  const atr = averageTrueRange(candles)
  const swing = Math.min(...candles.slice(-10).map((c) => c.low))
  const range = useMemo(() => {
    const prices = candles.flatMap((c) => [c.low, c.high])
    const low = Math.min(...prices)
    const high = Math.max(...prices)
    return { min: low - (high - low) * 0.12, max: high + (high - low) * 0.25 }
  }, [candles])
  // Start with the classic beginner's mistake: a tight stop and a small target.
  const [stop, setStop] = useState(() => Math.round((entry - 0.5 * atr) * 100) / 100)
  const [target, setTarget] = useState(() => Math.round((entry + 0.8 * atr) * 100) / 100)
  const [nailed, setNailed] = useState(done)

  const plan = { direction: 'long' as const, entry, size: 1000, stop, target }
  const review = reviewStopAndTarget(candles, plan)
  const ratio = (target - entry) / (entry - stop)
  const needed = breakEvenWinRate(ratio)
  const stopOk = review.stop === 'logical'
  const ratioOk = ratio >= 2
  if (stopOk && ratioOk && !nailed) setNailed(true)
  useEffect(() => {
    if (nailed && !done) onDone()
  }, [nailed, done, onDone])

  return (
    <div className="flex flex-col gap-4">
      <Stage>
        <SvgChart
          candles={candles}
          slots={candles.length + 8}
          range={range}
          height={300}
          label="A pullback in an uptrend, with a stop loss and take profit you can drag"
          overlay={(project) => (
            <TradeLines
              project={project}
              direction="long"
              entry={entry}
              stop={stop}
              target={target}
              range={range}
              onChange={(level, price) => (level === 'stop' ? setStop : setTarget)(price)}
            />
          )}
        >
          {(scale) => {
            const i = candles.length - 10 + candles.slice(-10).findIndex((c) => c.low === swing)
            return (
              <g>
                <circle cx={scale.x(i)} cy={scale.y(swing)} r={4} fill={COLORS.card} stroke={COLORS.chalk} strokeWidth={1.75} />
                <text x={scale.x(i)} y={scale.y(swing) + 17} textAnchor="middle" fontSize={11} fill="#cfcfcf">
                  Swing low
                </text>
              </g>
            )
          }}
        </SvgChart>
      </Stage>

      <div className="grid grid-cols-3 divide-x divide-edge rounded-2xl border border-edge bg-card py-3 text-center">
        <Stat label="Risk a share" value={`${(entry - stop).toFixed(2)}`} tone="text-down" />
        <Stat label="Reward a share" value={`${(target - entry).toFixed(2)}`} tone="text-up" />
        <Stat label="Risk : reward" value={`1 : ${ratio.toFixed(1)}`} tone="text-white" />
      </div>

      <div className="rounded-2xl border border-edge bg-card px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] text-soft">Win rate you need to break even</span>
          <span className="text-[20px] tabular-nums" style={{ fontFamily: MONO_FONT }}>
            {Math.round(needed * 100)}%
          </span>
        </div>
        {/* Ten trades: how many have to win just to come out even. */}
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {Array.from({ length: 10 }, (_, k) => {
            const fill = Math.min(1, Math.max(0, needed * 10 - k))
            return (
              <div key={k} className="h-3 flex-1 overflow-hidden rounded-sm bg-neutral-800">
                <div className="h-full bg-up transition-[width] duration-200" style={{ width: `${fill * 100}%` }} />
              </div>
            )
          })}
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
          At 1 : {ratio.toFixed(1)}, you have to win {Math.round(needed * 100)}% of your trades just to break even. The further your target is
          compared with your stop, the more often you can afford to be wrong.
        </p>
      </div>

      <Note tone={nailed ? 'good' : 'plain'}>{review.text}</Note>
      <Goals
        goals={[
          { label: 'Stop just under the swing low', met: stopOk },
          { label: 'Risk : reward of 1 : 2 or better', met: ratioOk },
        ]}
      />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-2">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={`mt-1 text-lg tabular-nums ${tone}`} style={{ fontFamily: MONO_FONT }}>
        {value}
      </div>
    </div>
  )
}
