import { useEffect, useRef, useState } from 'react'
import { losingStreak, recoveryNeeded } from '../../../lib/lessons'
import { useWidth } from '../../../components/chartScale'
import { formatMoney } from '../../../format'
import { COLORS, MONO_FONT } from '../../../theme'
import { Goals, PillButton, Stage, type LessonProps } from './parts'

const RISKS = [0.01, 0.02, 0.05, 0.1, 0.25]
const START = 10_000
const STREAK = 10
const TRACK = 2 // the bars' full width is a 200% move

// Two small calculators: how big a gain it takes to undo a loss, and what a
// losing streak does at different amounts of risk per trade.
export function LossMath({ done, onDone }: LessonProps) {
  const [loss, setLoss] = useState(0.2)
  const [risk, setRisk] = useState(0.02)
  const [moved, setMoved] = useState(done)
  const [picked, setPicked] = useState(done)
  useEffect(() => {
    if (moved && picked && !done) onDone()
  }, [moved, picked, done, onDone])

  const back = recoveryNeeded(loss)
  const left = START * (1 - loss)
  const streak = losingStreak(START, risk, STREAK)
  const after = streak[streak.length - 1]

  return (
    <div className="flex flex-col gap-5">
      <Stage>
        <label htmlFor="loss" className="flex items-baseline justify-between gap-3 px-1">
          <span className="text-[15px] text-soft">Your account falls by</span>
          <span className="text-[22px] text-down tabular-nums" style={{ fontFamily: MONO_FONT }}>
            −{Math.round(loss * 100)}%
          </span>
        </label>
        <input
          id="loss"
          type="range"
          min={5}
          max={90}
          step={5}
          value={Math.round(loss * 100)}
          onChange={(e) => {
            setLoss(Number(e.target.value) / 100)
            setMoved(true)
          }}
          className="mt-3 w-full accent-[#ef5b52]"
        />
        <div className="mt-4 flex flex-col gap-3 px-1">
          <Bar label="The drop" share={loss} color="bg-down" value={`−${Math.round(loss * 100)}%`} />
          <Bar label="Gain needed to get back" share={back} color={back > 1 ? 'bg-amber' : 'bg-up'} value={`+${Math.round(back * 100)}%`} />
        </div>
        <p className="mt-4 px-1 text-[15px] leading-relaxed text-neutral-200">
          From {formatMoney(START)} down to {formatMoney(left)}, getting back takes {formatMoney(START - left)} of profit: a{' '}
          <span className="font-semibold">{Math.round(back * 100)}% gain</span> on what's left.
          {loss >= 0.5 && ' Past half, the climb back is longer than the fall.'}
        </p>
      </Stage>

      <Stage>
        <div className="px-1">
          <div className="text-[15px] text-soft">Money at risk on each trade</div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Risk per trade">
            {RISKS.map((r) => (
              <PillButton
                key={r}
                active={risk === r}
                onClick={() => {
                  setRisk(r)
                  setPicked(true)
                }}
              >
                {r * 100}%
              </PillButton>
            ))}
          </div>
        </div>
        <Sparkline values={streak} />
        <p className="mt-2 px-1 text-[15px] leading-relaxed text-neutral-200">
          Risking {risk * 100}% a trade, {STREAK} losses in a row take {formatMoney(START)} down to{' '}
          <span className="font-semibold">{formatMoney(after)}</span> ({Math.round((after / START - 1) * 100)}%).{' '}
          {risk <= 0.02
            ? "Painful, but you're still in the game."
            : risk >= 0.1
              ? `You'd need +${Math.round(recoveryNeeded(1 - after / START) * 100)}% just to get back to where you started.`
              : 'A streak like that happens to every trader eventually.'}
        </p>
      </Stage>

      <Goals
        goals={[
          { label: 'Move the slider', met: moved },
          { label: 'Try a different risk', met: picked },
        ]}
      />
    </div>
  )
}

function Bar({ label, share, color, value }: { label: string; share: number; color: string; value: string }) {
  const width = Math.min(1, share / TRACK)
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-neutral-100" style={{ fontFamily: MONO_FONT }}>
          {value}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 rounded-full bg-neutral-800">
        <div className={`relative h-full rounded-full transition-[width] duration-200 ${color}`} style={{ width: `${Math.max(1, width * 100)}%` }}>
          {share > TRACK && <span className="absolute -right-1 -top-[3px] text-[12px] leading-none text-amber">▸</span>}
        </div>
      </div>
    </div>
  )
}

// The balance after each loss in the streak.
function Sparkline({ values }: { values: number[] }) {
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const height = 110
  const pad = 10
  const x = (k: number) => pad + (k / (values.length - 1)) * (width - pad * 2)
  const y = (v: number) => pad + (1 - v / START) * (height - pad * 2)
  return (
    <div ref={box} className="mt-3 w-full">
      {width > 0 && (
        <svg width={width} height={height} className="block" role="img" aria-label={`Balance falling to ${formatMoney(values[values.length - 1])} over ${values.length - 1} losses`}>
          <line x1={pad} x2={width - pad} y1={y(START)} y2={y(START)} stroke={COLORS.grid} strokeDasharray="4 4" />
          <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke={COLORS.grid} />
          <polyline points={values.map((v, k) => `${x(k)},${y(v)}`).join(' ')} fill="none" stroke={COLORS.down} strokeWidth={2} strokeLinejoin="round" />
          {values.map((v, k) => (
            <circle key={k} cx={x(k)} cy={y(v)} r={2.5} fill={COLORS.down} />
          ))}
          <text x={width - pad} y={y(values[values.length - 1]) - 8} textAnchor="end" fontSize={11} fill={COLORS.axisText} fontFamily={MONO_FONT}>
            {formatMoney(values[values.length - 1])}
          </text>
        </svg>
      )}
    </div>
  )
}
