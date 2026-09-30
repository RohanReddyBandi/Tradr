import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { swingLabels, trendChart, type TrendKind } from '../../../lib/lessons'
import { SvgChart } from '../../../components/SvgChart'
import { COLORS } from '../../../theme'
import { Note, PillButton, PrimaryButton, Stage, type LessonProps } from './parts'

const ROUNDS = 5
const CHOICES: { kind: TrendKind; label: string }[] = [
  { kind: 'up', label: 'Uptrend' },
  { kind: 'down', label: 'Downtrend' },
  { kind: 'range', label: 'Range' },
]
const EXPLAIN: Record<TrendKind, string> = {
  up: 'Each high beat the one before (HH) and each dip stopped above the last low (HL): a staircase going up.',
  down: 'Each low broke the one before (LL) and each bounce stalled below the last high (LH): a staircase going down.',
  range: 'The highs stopped at about the same price, and so did the lows. No staircase, just a range.',
}

// Five charts: call each one an uptrend, a downtrend, or a range, then see
// its swings labelled.
export function TrendSpotter({ done, onDone }: LessonProps) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6))
  const kinds = useMemo(() => {
    // Every kind at least once, in a shuffled order.
    const list: TrendKind[] = ['up', 'down', 'range', seed % 2 ? 'up' : 'down', seed % 3 ? 'range' : 'up']
    return list.map((k, i) => [((seed * (i + 7)) % 97) / 97, k] as const).sort((a, b) => a[0] - b[0]).map(([, k]) => k)
  }, [seed])
  const [round, setRound] = useState(0)
  const [answers, setAnswers] = useState<TrendKind[]>([])
  const answered = answers.length > round
  const finished = answers.length === ROUNDS && answered
  const kind = kinds[Math.min(round, ROUNDS - 1)]
  const candles = useMemo(() => trendChart(kind, seed + round), [kind, seed, round])
  const swings = useMemo(() => swingLabels(candles), [candles])
  // Extra room above and below for the swing labels.
  const range = useMemo(() => {
    const low = Math.min(...candles.map((c) => c.low))
    const high = Math.max(...candles.map((c) => c.high))
    return { min: low - (high - low) * 0.14, max: high + (high - low) * 0.12 }
  }, [candles])
  const score = answers.filter((a, i) => a === kinds[i]).length

  useEffect(() => {
    if (finished && !done) onDone()
  }, [finished, done, onDone])

  function again() {
    setSeed(Math.floor(Math.random() * 1e6))
    setRound(0)
    setAnswers([])
  }

  const right = answered && answers[round] === kind
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Chart {Math.min(round + 1, ROUNDS)} of {ROUNDS}
        </span>
        <span className="font-mono">{score} right</span>
      </div>
      <Stage>
        <SvgChart key={`${seed}-${round}`} candles={candles} range={range} height={250} label={`Chart ${round + 1}: which way is it going?`}>
          {(scale) =>
            answered && (
              <g>
                <motion.polyline
                  points={swings.map((s) => `${scale.x(s.index)},${scale.y(s.price)}`).join(' ')}
                  fill="none"
                  stroke={COLORS.chalk}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                />
                {swings.map((s, k) => {
                  const above = s.kind === 'high'
                  const good = s.label === 'HH' || s.label === 'HL'
                  const bad = s.label === 'LH' || s.label === 'LL'
                  return (
                    <motion.g key={k} initial={{ opacity: 0, y: above ? 4 : -4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * k }}>
                      <circle cx={scale.x(s.index)} cy={scale.y(s.price)} r={3.5} fill={COLORS.card} stroke={COLORS.chalk} strokeWidth={1.5} />
                      <text
                        x={scale.x(s.index)}
                        y={scale.y(s.price) + (above ? -9 : 18)}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={600}
                        fill={good ? COLORS.up : bad ? COLORS.down : '#cfcfcf'}
                      >
                        {s.label}
                      </text>
                    </motion.g>
                  )
                })}
              </g>
            )
          }
        </SvgChart>
      </Stage>

      {!answered ? (
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Your answer">
          {CHOICES.map((c) => (
            <PillButton key={c.kind} onClick={() => setAnswers([...answers, c.kind])}>
              {c.label}
            </PillButton>
          ))}
        </div>
      ) : (
        <>
          <Note tone={right ? 'good' : 'nudge'}>
            <span className="font-semibold">{right ? 'Right. ' : `It was ${kind === 'range' ? 'a range' : `a ${kind}trend`}. `}</span>
            {EXPLAIN[kind]}
          </Note>
          <div>
            {finished ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[15px] text-soft">
                  {score} of {ROUNDS} right.
                </span>
                <PrimaryButton onClick={again}>Five more</PrimaryButton>
              </div>
            ) : (
              <PrimaryButton onClick={() => setRound(round + 1)}>Next chart</PrimaryButton>
            )}
          </div>
        </>
      )}
    </div>
  )
}
