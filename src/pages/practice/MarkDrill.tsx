import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { CandleMatch } from '../../lib/candlePatterns'
import { gradeMarks, makeMarkChart, type Mark, type MarkChart, type MarkResult } from '../../lib/practice'
import { GROUPS, LIBRARY, entryByKey } from '../../lib/library'
import { randomSeed } from '../../lib/generator'
import { CandleLayer } from '../../components/ChartLayers'
import { fitScale, useWidth, type Scale } from '../../components/chartScale'
import { COLORS, MONO_FONT } from '../../theme'
import { PatternPicker } from './PatternPicker'

const CANDLE_ENTRIES = LIBRARY.filter((e) => e.kind === 'candle')

// The chart has a strip above the candles for name tags, in up to three
// rows ("lanes") so neighbouring tags don't cover each other.
const LANE = 22
const LANES = 3
const TOP = LANE * LANES + 10
const BOTTOM = 22 // room for candle numbers underneath

const nameOf = (key: string) => entryByKey(key)?.name ?? key
const where = (m: CandleMatch) => (m.start === m.end ? `candle ${m.start + 1}` : `candles ${m.start + 1}–${m.end + 1}`)

interface Props {
  onResult: (result: MarkResult) => void
  onLearn: (patternName: string) => void
}

export function MarkDrill({ onResult, onLearn }: Props) {
  const [seed, setSeed] = useState(randomSeed)
  const chart = useMemo(() => makeMarkChart(seed), [seed])
  const [marks, setMarks] = useState<Mark[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<MarkResult | null>(null)
  const current = marks.find((m) => m.index === selected)

  function mark(key: string) {
    if (selected === null) return
    setMarks((ms) => [...ms.filter((m) => m.index !== selected), { index: selected, key }].sort((a, b) => a.index - b.index))
    setSelected(null)
  }

  function unmark(index: number) {
    setMarks((ms) => ms.filter((m) => m.index !== index))
    setSelected(null)
  }

  function check() {
    const graded = gradeMarks(chart, marks)
    setResult(graded)
    setSelected(null)
    onResult(graded)
  }

  function newChart() {
    setSeed(randomSeed())
    setMarks([])
    setSelected(null)
    setResult(null)
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] leading-snug font-semibold tracking-tight">Find the {chart.answers.length} candlestick patterns</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-soft">
              Tap a candle, then say what it is. Any candle inside a pattern counts.
            </p>
          </div>
          <button
            onClick={newChart}
            className="h-11 shrink-0 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft transition-colors hover:border-neutral-600 hover:text-white"
          >
            New chart
          </button>
        </div>
        <div className="mt-4 rounded-3xl border border-edge bg-card px-2 py-3">
          <MarkChartView chart={chart} marks={marks} selected={selected} result={result} onSelect={setSelected} />
        </div>
      </section>

      <aside className="mt-5 lg:mt-0">
        {result ? (
          <Results chart={chart} result={result} onNext={newChart} onLearn={onLearn} />
        ) : (
          <>
            <div className="rounded-3xl border border-edge bg-card p-4">
              {selected === null ? (
                <>
                  <p className="text-[15px] leading-relaxed text-soft">
                    Tap a candle to mark it<span className="hidden lg:inline">, or click the chart and use the arrow keys</span>.
                  </p>
                  {marks.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1">
                      {marks.map((m) => (
                        <li key={m.index} className="flex min-h-10 items-center justify-between gap-3 text-[15px]">
                          <button onClick={() => setSelected(m.index)} className="text-left hover:text-white">
                            <span className="font-mono text-[13px] text-muted">Candle {m.index + 1}</span>
                            <span className="ml-2 text-neutral-100">{nameOf(m.key)}</span>
                          </button>
                          <button onClick={() => unmark(m.index)} className="h-10 px-2 text-sm text-muted hover:text-down">
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[17px] font-semibold">
                      Candle {selected + 1}
                      <span className="ml-2 font-normal text-soft">What is it?</span>
                    </h3>
                    <button onClick={() => setSelected(null)} className="h-10 px-2 text-sm text-muted hover:text-white">
                      Cancel
                    </button>
                  </div>
                  <div className="mt-3">
                    <PatternPicker entries={CANDLE_ENTRIES} groups={GROUPS.candle} selected={current?.key} onPick={mark} />
                  </div>
                  {current && (
                    <button onClick={() => unmark(current.index)} className="mt-4 h-10 text-sm text-muted hover:text-down">
                      Remove this mark
                    </button>
                  )}
                </>
              )}
            </div>
            <button
              onClick={check}
              disabled={marks.length === 0}
              className="mt-4 h-12 w-full rounded-2xl bg-up text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab] disabled:bg-neutral-800 disabled:text-dim"
            >
              Check my marks
            </button>
          </>
        )}
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------

type Tone = 'neutral' | 'right' | 'wrong' | 'missed'
const TONE: Record<Tone, string> = { neutral: '#d4d4d4', right: COLORS.up, wrong: COLORS.down, missed: COLORS.marker }

interface Tag {
  x: number // the candle it points at
  anchorPrice: number // where the leader line ends (the top of that candle)
  text: string
  tone: Tone
}

// Put each tag in the first lane where it doesn't overlap the tag before it.
function layoutTags(tags: Tag[], width: number) {
  const laneEnds = Array<number>(LANES).fill(-Infinity)
  return [...tags]
    .sort((a, b) => a.x - b.x)
    .map((tag) => {
      const w = tag.text.length * 6.1 + 16 // roughly how wide the text is
      const left = Math.min(Math.max(tag.x - w / 2, 2), width - w - 2)
      let lane = laneEnds.findIndex((end) => left > end + 4)
      if (lane === -1) lane = laneEnds.indexOf(Math.min(...laneEnds))
      laneEnds[lane] = left + w
      return { ...tag, left, w, lane }
    })
}

interface ViewProps {
  chart: MarkChart
  marks: Mark[]
  selected: number | null
  result: MarkResult | null
  onSelect: (index: number | null) => void
}

function MarkChartView({ chart, marks, selected, result, onSelect }: ViewProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const width = useWidth(boxRef)
  const height = Math.round(Math.min(420, Math.max(290, width * 0.58)))
  const { candles } = chart
  const scale = width > 0 ? fitScale(candles, width, height - TOP - BOTTOM) : null

  function onKeyDown(event: KeyboardEvent) {
    if (result) return
    const last = candles.length - 1
    if (event.key === 'ArrowRight') onSelect(selected === null ? 0 : Math.min(last, selected + 1))
    else if (event.key === 'ArrowLeft') onSelect(selected === null ? last : Math.max(0, selected - 1))
    else if (event.key === 'Escape') onSelect(null)
    else return
    event.preventDefault()
  }

  return (
    <div ref={boxRef} className="w-full">
      {scale && (
        <svg
          width={width}
          height={height}
          className="block touch-manipulation"
          tabIndex={result ? -1 : 0}
          onKeyDown={onKeyDown}
          role="group"
          aria-label={`Chart of ${candles.length} candles. Use the left and right arrow keys to pick a candle.`}
        >
          <g transform={`translate(0, ${TOP})`}>
            {selected !== null && (
              <rect
                x={scale.x(selected) - scale.slot / 2}
                y={-6}
                width={scale.slot}
                height={height - TOP - BOTTOM + 12}
                rx={3}
                fill="#ffffff"
                opacity={0.08}
              />
            )}
            {result && <ResultBoxes chart={chart} result={result} scale={scale} />}
            <CandleLayer candles={candles} scale={scale} />
          </g>

          <TagLayer chart={chart} marks={marks} result={result} scale={scale} width={width} />

          {/* Candle numbers: every fifth one (unless it would crowd the selected one), and the selected one. */}
          {candles.map((_, i) =>
            i === selected || ((i + 1) % 5 === 0 && (selected === null || Math.abs(i - selected) > 1)) ? (
              <text
                key={i}
                x={scale.x(i)}
                y={height - 6}
                textAnchor="middle"
                fontSize={10.5}
                fontFamily={MONO_FONT}
                fill={i === selected ? '#f2f2f2' : COLORS.axisText}
              >
                {i + 1}
              </text>
            ) : null,
          )}

          {/* Tap targets: one full-height column per candle. */}
          {!result &&
            candles.map((_, i) => (
              <rect
                key={i}
                x={scale.x(i) - scale.slot / 2}
                y={0}
                width={scale.slot}
                height={height}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onSelect(i === selected ? null : i)}
              />
            ))}
        </svg>
      )}
    </div>
  )
}

function TagLayer({ chart, marks, result, scale, width }: { chart: MarkChart; marks: Mark[]; result: MarkResult | null; scale: Scale; width: number }) {
  const { candles } = chart
  const top = (from: number, to: number) => Math.max(...candles.slice(from, to + 1).map((c) => c.high))
  const tags: Tag[] = result
    ? [
        ...result.grades.map((g): Tag => ({
          x: scale.x(g.mark.index),
          anchorPrice: candles[g.mark.index].high,
          text: nameOf(g.mark.key),
          tone: g.correct ? 'right' : 'wrong',
        })),
        ...result.missed.map((m): Tag => ({
          x: (scale.x(m.start) + scale.x(m.end)) / 2,
          anchorPrice: top(m.start, m.end),
          text: m.pattern.name,
          tone: 'missed',
        })),
      ]
    : marks.map((m) => ({ x: scale.x(m.index), anchorPrice: candles[m.index].high, text: nameOf(m.key), tone: 'neutral' }))

  return (
    <g>
      {layoutTags(tags, width).map((t, k) => {
        const y = t.lane * LANE + 2
        const color = TONE[t.tone]
        return (
          <g key={k}>
            <line x1={t.x} y1={y + LANE - 4} x2={t.x} y2={TOP + scale.y(t.anchorPrice) - 4} stroke={color} strokeOpacity={0.5} strokeDasharray="2 3" />
            <rect x={t.left} y={y} width={t.w} height={LANE - 4} rx={5} fill={COLORS.base} stroke={color} strokeOpacity={0.6} />
            <text
              x={t.left + t.w / 2}
              y={y + LANE / 2 + 1}
              textAnchor="middle"
              fontSize={11}
              fontWeight={500}
              fill={color}
              textDecoration={t.tone === 'wrong' ? 'line-through' : undefined}
            >
              {t.text}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// After checking: a green box around each pattern you found, a dashed yellow
// one around each you missed.
function ResultBoxes({ chart, result, scale }: { chart: MarkChart; result: MarkResult; scale: Scale }) {
  const box = (m: CandleMatch, found: boolean) => {
    const slice = chart.candles.slice(m.start, m.end + 1)
    const top = scale.y(Math.max(...slice.map((c) => c.high))) - 5
    const bottom = scale.y(Math.min(...slice.map((c) => c.low))) + 5
    const left = scale.x(m.start) - scale.slot / 2 - 1
    const right = scale.x(m.end) + scale.slot / 2 + 1
    const color = found ? COLORS.up : COLORS.marker
    return (
      <rect
        key={`${m.pattern.key}-${m.start}`}
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        rx={4}
        fill={color}
        fillOpacity={0.08}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={found ? undefined : '4 3'}
      />
    )
  }
  return (
    <g>
      {result.found.map((m) => box(m, true))}
      {result.missed.map((m) => box(m, false))}
    </g>
  )
}

// ---------------------------------------------------------------------------
// The results
// ---------------------------------------------------------------------------

function Results({ chart, result, onNext, onLearn }: { chart: MarkChart; result: MarkResult; onNext: () => void; onLearn: (name: string) => void }) {
  const notes = result.grades.filter((g) => !g.correct || g.partOf)
  return (
    <div className="rounded-3xl border border-edge bg-card p-5">
      <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Result</div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="font-mono text-[36px] leading-none font-medium">
          {result.found.length}/{chart.answers.length}
        </span>
        <span className="text-[15px] text-soft">
          found{result.wrong > 0 && ` · ${result.wrong} wrong mark${result.wrong === 1 ? '' : 's'}`}
        </span>
      </div>

      <ul className="mt-4 divide-y divide-edge border-t border-edge">
        {chart.answers.map((a) => {
          const found = result.found.includes(a)
          return (
            <li key={`${a.pattern.key}-${a.start}`} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-medium">
                  <span className={found ? 'text-up' : 'text-marker'} aria-hidden="true">
                    {found ? '✓ ' : '○ '}
                  </span>
                  {a.pattern.name}
                </span>
                <span className="shrink-0 font-mono text-[12px] text-muted">{where(a)}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-soft">
                {found ? '' : 'Missed. '}
                {a.pattern.meaning}
              </p>
              <button onClick={() => onLearn(a.pattern.name)} className="mt-1 h-9 text-sm text-muted underline decoration-neutral-700 underline-offset-4 hover:text-white">
                Learn the {a.pattern.name.toLowerCase()}
              </button>
            </li>
          )
        })}
      </ul>

      {notes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2 border-t border-edge pt-4 text-sm leading-relaxed text-soft">
          {notes.map((g) => (
            <li key={g.mark.index}>
              {g.correct ? (
                <>
                  Candle {g.mark.index + 1} is a {nameOf(g.mark.key).toLowerCase()}, and it's part of a bigger pattern: the{' '}
                  {g.partOf!.pattern.name.toLowerCase()}.
                </>
              ) : (
                <>
                  <span className="text-down">Candle {g.mark.index + 1} isn't a {nameOf(g.mark.key).toLowerCase()}.</span>{' '}
                  {g.actually ? `It's part of the ${g.actually.pattern.name.toLowerCase()}.` : 'Nothing named forms there.'}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <button onClick={onNext} className="mt-5 h-12 w-full rounded-2xl bg-up text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]">
        Next chart
      </button>
    </div>
  )
}
