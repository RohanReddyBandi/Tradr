import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { Candle } from '../../../types'
import { contextRound } from '../../../lib/lessons'
import { entryByKey } from '../../../lib/library'
import { SvgChart } from '../../../components/SvgChart'
import { COLORS } from '../../../theme'
import { Note, PrimaryButton, type LessonProps } from './parts'

const ROUNDS = ['hammer', 'bullishEngulfing', 'shootingStar'] as const

// Two charts ending in the same candlestick pattern: one at a level that's
// held before, one in the middle of a range. Which would you trade?
export function ContextPicker({ done, onDone }: LessonProps) {
  const [seed] = useState(() => 1 + Math.floor(Math.random() * 500))
  const [round, setRound] = useState(0)
  const [picks, setPicks] = useState<('good' | 'bad')[]>([])
  const r = useMemo(() => contextRound(ROUNDS[round], seed + round), [round, seed])
  const answered = picks.length > round
  const finished = answered && round === ROUNDS.length - 1
  const name = entryByKey(r.key)!.name
  const bearish = r.key === 'shootingStar'

  useEffect(() => {
    if (finished && !done) onDone()
  }, [finished, done, onDone])

  const charts = r.goodFirst ? (['good', 'bad'] as const) : (['bad', 'good'] as const)
  const right = answered && picks[round] === 'good'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Round {round + 1} of {ROUNDS.length}: two {name.toLowerCase()}s
        </span>
        <span className="font-mono">{picks.filter((p) => p === 'good').length} right</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {charts.map((which, k) => {
          const candles = which === 'good' ? r.good : r.bad
          const picked = picks[round] === which
          return (
            <div
              key={`${round}-${which}`}
              className={`rounded-3xl border bg-card p-3 transition-colors ${
                answered ? (which === 'good' ? 'border-up/40' : picked ? 'border-down/40' : 'border-edge') : 'border-edge'
              }`}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-[13px] font-semibold text-soft">Chart {k === 0 ? 'A' : 'B'}</span>
                {answered && (
                  <span className={`text-[12px] font-medium ${which === 'good' ? 'text-up' : 'text-muted'}`}>
                    {which === 'good' ? (bearish ? 'At resistance' : 'At support') : 'Middle of a range'}
                  </span>
                )}
              </div>
              <SvgChart candles={candles} height={170} label={`Chart ${k === 0 ? 'A' : 'B'}, ending in a ${name.toLowerCase()}`}>
                {(scale) => (
                  <g>
                    <PatternBox candles={candles} size={r.size} x={scale.x} y={scale.y} slot={scale.slot} />
                    {answered && which === 'good' && (
                      <motion.line
                        x1={0}
                        x2={scale.x(candles.length - 1) + scale.slot}
                        y1={scale.y(r.level)}
                        y2={scale.y(r.level)}
                        stroke={COLORS.chalk}
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      />
                    )}
                    {answered && which === 'bad' && <RangeLines candles={candles} y={scale.y} x={scale.x} />}
                  </g>
                )}
              </SvgChart>
              {!answered && (
                <button
                  type="button"
                  onClick={() => setPicks([...picks, which])}
                  className="mt-2 h-11 w-full rounded-xl border border-neutral-800 text-[15px] font-medium text-soft transition-colors hover:border-neutral-600 hover:text-white"
                >
                  Trade chart {k === 0 ? 'A' : 'B'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {answered && (
        <>
          <Note tone={right ? 'good' : 'nudge'}>
            <span className="font-semibold">{right ? 'Right. ' : 'The other one. '}</span>
            {bearish
              ? `The good ${name.toLowerCase()} came after a rally, right at a ceiling sellers had defended before, so it confirms something real. The other one is in the middle of a range, where there's no ceiling behind it and the next candle could go either way.`
              : `The good ${name.toLowerCase()} came after a drop, right on a floor buyers had defended before, so it confirms something real. The other one is in the middle of a range, with no floor under it: the same candle, but nothing behind it.`}
          </Note>
          <div>
            {finished ? (
              <span className="text-[15px] text-soft">
                {picks.filter((p) => p === 'good').length} of {ROUNDS.length} right. Where a candle forms matters more than what it looks like.
              </span>
            ) : (
              <PrimaryButton onClick={() => setRound(round + 1)}>Next round</PrimaryButton>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// The yellow box around the last candles (the pattern), as in the Breakdown.
function PatternBox({ candles, size, x, y, slot }: { candles: Candle[]; size: number; x: (i: number) => number; y: (p: number) => number; slot: number }) {
  const from = candles.length - size
  const slice = candles.slice(from)
  const top = y(Math.max(...slice.map((c) => c.high))) - 4
  const bottom = y(Math.min(...slice.map((c) => c.low))) + 4
  const left = x(from) - slot / 2 - 2
  return (
    <rect
      x={left}
      y={top}
      width={x(candles.length - 1) + slot / 2 + 2 - left}
      height={bottom - top}
      rx={4}
      fill={COLORS.marker}
      fillOpacity={0.08}
      stroke={COLORS.marker}
      strokeWidth={1.5}
    />
  )
}

// The top and bottom of the range the bad chart sits in the middle of.
function RangeLines({ candles, x, y }: { candles: Candle[]; x: (i: number) => number; y: (p: number) => number }) {
  const early = candles.slice(0, -3)
  const top = Math.max(...early.map((c) => c.high))
  const bottom = Math.min(...early.map((c) => c.low))
  const right = x(candles.length - 1) + 10
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <line x1={0} x2={right} y1={y(top)} y2={y(top)} stroke={COLORS.chalk} strokeWidth={1.25} strokeDasharray="4 4" />
      <line x1={0} x2={right} y1={y(bottom)} y2={y(bottom)} stroke={COLORS.chalk} strokeWidth={1.25} strokeDasharray="4 4" />
    </motion.g>
  )
}
