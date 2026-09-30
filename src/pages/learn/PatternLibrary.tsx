import { useEffect, useMemo, useState } from 'react'
import type { Bias } from '../../types'
import { GROUPS, LIBRARY, findEntry, type LibraryEntry } from '../../lib/library'
import { candleExample, chartExample } from '../../lib/examples'
import { followThrough } from '../../lib/lessons'
import { computeStats, type TradeRecord } from '../../lib/stats'
import { DRAWABLE, PRACTICE_CANDLES } from '../../lib/practice'
import { SvgChart } from '../../components/SvgChart'
import { ShapeLayer } from '../../components/ChartLayers'
import { shapePrices } from '../../components/chartScale'
import { STARTING_BALANCE } from '../../game/useGame'
import type { PracticeProgress } from '../../game/usePractice'
import type { PracticeMode } from '../PracticePage'
import { COLORS } from '../../theme'

interface Props {
  history: TradeRecord[]
  focus: string | null // a pattern name to jump to (from a Breakdown or Stats)
  progress: PracticeProgress
  onPractice: (mode: PracticeMode, key: string) => void
}

const BUILDABLE = new Set(PRACTICE_CANDLES.map((p) => p.key))
const DRAWABLE_KEYS = new Set(DRAWABLE.map((p) => p.key))

type Kind = 'chart' | 'candle'

const BIAS_STYLE: Record<Bias, string> = {
  bullish: 'border-up/30 text-up',
  bearish: 'border-down/30 text-down',
  neutral: 'border-neutral-700 text-soft',
}

// Every pattern Tradr knows, as cards you can filter, search, and play forward.
export function PatternLibrary({ history, focus, progress, onPractice }: Props) {
  const focused = focus ? findEntry(focus) : undefined
  // Opening Learn on a pattern starts on its tab, highlighted, scrolled into view.
  const [kind, setKind] = useState<Kind>(focused?.kind ?? 'chart')
  const [group, setGroup] = useState<string | null>(null) // null shows every group
  const [search, setSearch] = useState('')
  const [highlight, setHighlight] = useState<string | null>(focused?.key ?? null)
  const { patterns } = useMemo(() => computeStats(history, STARTING_BALANCE), [history])

  useEffect(() => {
    if (focused) requestAnimationFrame(() => document.getElementById(`pattern-${focused.key}`)?.scrollIntoView({ block: 'center' }))
  }, [focused])

  // Patterns you've seen at least twice and get right less than 60% of the time.
  const weakSpots = [...patterns.values()]
    .filter((p) => p.seen >= 2 && p.correct / p.seen < 0.6 && findEntry(p.name))
    .sort((a, b) => a.correct / a.seen - b.correct / b.seen)
    .slice(0, 6)

  function jumpTo(name: string) {
    const entry = findEntry(name)
    if (!entry) return
    setKind(entry.kind)
    setGroup(null)
    setSearch('')
    setHighlight(entry.key)
    requestAnimationFrame(() => document.getElementById(`pattern-${entry.key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  // A search looks through every pattern, of both kinds.
  const query = search.trim().toLowerCase()
  const entries = query
    ? LIBRARY.filter((e) => e.name.toLowerCase().includes(query) || e.signals.toLowerCase().includes(query))
    : LIBRARY.filter((e) => e.kind === kind && (!group || e.group === group))

  return (
    <div>
      {weakSpots.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">Your weak spots</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {weakSpots.map((p) => (
              <button
                key={p.name}
                onClick={() => jumpTo(p.name)}
                className="flex min-h-11 items-center gap-2 rounded-full border border-amber/30 bg-amber/[0.06] px-4 text-[15px] text-neutral-100 hover:border-amber/60"
              >
                {p.name}
                <span className="font-mono text-xs text-muted">
                  {p.correct}/{p.seen}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Pattern type" className={`inline-grid grid-cols-2 gap-1 rounded-2xl border border-edge bg-card p-1 ${query ? 'opacity-50' : ''}`}>
          {(['chart', 'candle'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={!query && kind === k}
              onClick={() => {
                setKind(k)
                setGroup(null)
                setSearch('')
              }}
              className={`h-11 rounded-xl px-4 text-[15px] font-medium transition-colors ${
                !query && kind === k ? 'bg-neutral-800 text-white' : 'text-muted hover:text-soft'
              }`}
            >
              {k === 'chart' ? 'Chart patterns' : 'Candlesticks'}
              <span className="ml-1.5 font-mono text-xs text-muted">{LIBRARY.filter((e) => e.kind === k).length}</span>
            </button>
          ))}
        </div>
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-edge bg-card px-4 focus-within:border-neutral-500 sm:max-w-xs">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0 text-muted" aria-hidden="true">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3.5 3.5" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Search patterns</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search, e.g. flag or reversal"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-dim"
          />
        </label>
      </div>

      {/* Narrow the list down to one group, e.g. just the gaps. */}
      {!query && (
        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {[null, ...GROUPS[kind]].map((g) => (
            <button
              key={g ?? 'all'}
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
              className={`min-h-10 rounded-full border px-3.5 text-[14px] transition-colors ${
                group === g ? 'border-neutral-300 bg-neutral-100 text-black' : 'border-neutral-800 text-soft hover:border-neutral-600'
              }`}
            >
              {g ?? 'All'}
            </button>
          ))}
        </div>
      )}
      {query && (
        <p className="mt-4 text-[14px] text-muted" aria-live="polite">
          {entries.length ? `${entries.length} pattern${entries.length === 1 ? '' : 's'} match “${search.trim()}”` : `Nothing matches “${search.trim()}”.`}
        </p>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const practice =
            entry.kind === 'candle' && BUILDABLE.has(entry.key)
              ? { label: 'Build it', mode: 'build' as const, done: progress.built.includes(entry.key) }
              : entry.kind === 'chart' && DRAWABLE_KEYS.has(entry.key)
                ? { label: 'Draw it', mode: 'draw' as const, done: progress.drawn.includes(entry.key) }
                : null
          return (
            <PatternCard
              key={entry.key}
              entry={entry}
              highlighted={highlight === entry.key}
              record={patterns.get(entry.name)}
              practice={practice && { ...practice, onClick: () => onPractice(practice.mode, entry.key) }}
            />
          )
        })}
      </div>
    </div>
  )
}

interface CardProps {
  entry: LibraryEntry
  highlighted: boolean
  record?: { seen: number; correct: number }
  practice: { label: string; done: boolean; onClick: () => void } | null // "Build it" / "Draw it"
}

function PatternCard({ entry, highlighted, record, practice }: CardProps) {
  const example = useMemo(() => (entry.kind === 'candle' ? candleExample(entry.key) : chartExample(entry.key)), [entry])
  return (
    <article
      id={`pattern-${entry.key}`}
      className={`scroll-mt-6 rounded-3xl border bg-card p-4 transition-colors ${highlighted ? 'border-neutral-400' : 'border-edge'}`}
    >
      {example && <PlayOut entry={entry} example={example} />}
      <div className="mt-4 flex items-start justify-between gap-3">
        <h3 className="text-[18px] leading-snug font-semibold tracking-tight">{entry.name}</h3>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${BIAS_STYLE[entry.bias]}`}>{entry.bias}</span>
      </div>
      <p className="mt-1 text-sm text-muted">Usually signals: {entry.signals.toLowerCase()}</p>
      <p className="mt-3 text-[15px] leading-relaxed text-neutral-200">{entry.meaning}</p>
      <p className="mt-3 text-sm leading-relaxed text-soft">
        <span className="font-semibold text-amber">The trap: </span>
        {entry.trap}
      </p>
      {(record || practice) && (
        <div className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-edge pt-3">
          <span className="font-mono text-xs text-muted">{record && `You: ${record.correct}/${record.seen} right`}</span>
          {practice && (
            <button
              onClick={practice.onClick}
              className="h-10 shrink-0 rounded-xl border border-neutral-800 px-3.5 text-sm text-soft transition-colors hover:border-neutral-600 hover:text-white"
            >
              {practice.label}
              {practice.done && <span className="ml-1.5 text-up">✓</span>}
            </button>
          )}
        </div>
      )}
    </article>
  )
}

// The example chart, with room on the right for what usually comes next.
// "What happens next?" plays a typical follow-through into that space.
function PlayOut({ entry, example }: { entry: LibraryEntry; example: NonNullable<ReturnType<typeof chartExample>> }) {
  const next = useMemo(() => followThrough(example, entry.bias), [example, entry.bias])
  const all = useMemo(() => [...example.candles, ...next], [example, next])
  const range = useMemo(() => {
    const prices = [...all.flatMap((c) => [c.low, c.high]), ...shapePrices(example.shapes)]
    const low = Math.min(...prices)
    const high = Math.max(...prices)
    return { min: low - (high - low) * 0.06, max: high + (high - low) * 0.06 }
  }, [all, example.shapes])
  const [shown, setShown] = useState(0) // follow-through candles on screen
  const [started, setStarted] = useState(false)
  const played = shown >= next.length
  const playing = started && !played

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setShown((n) => n + 1), 70)
    return () => clearTimeout(timer)
  }, [playing, shown])

  const n = example.candles.length
  return (
    <div className="rounded-2xl bg-base/60 px-1 py-2">
      <SvgChart
        candles={all.slice(0, n + shown)}
        slots={all.length}
        range={range}
        height={128}
        label={`Example of a ${entry.name.toLowerCase()}${shown ? ', then a typical follow-through' : ''}`}
      >
        {(scale, width) => (
          <g>
            <ShapeLayer shapes={example.shapes} candles={example.candles} scale={scale} />
            <line x1={scale.x(n - 0.5)} x2={scale.x(n - 0.5)} y1={4} y2={124} stroke="#3a3a3a" strokeDasharray="2 3" />
            {shown === 0 && (
              <text x={(scale.x(n - 0.5) + width) / 2} y={72} textAnchor="middle" fontSize={22} fill="#3d3d3d">
                ?
              </text>
            )}
            {played && (
              <text x={width - 6} y={14} textAnchor="end" fontSize={10} fill={COLORS.axisText}>
                Typical follow-through
              </text>
            )}
          </g>
        )}
      </SvgChart>
      <div className="flex justify-end px-1 pt-1">
        <button
          type="button"
          onClick={() => {
            setShown(0)
            setStarted(!played) // play, or (once played) reset
          }}
          disabled={playing}
          className="h-9 rounded-lg px-2.5 text-[13px] text-muted transition-colors hover:bg-neutral-900 hover:text-white disabled:opacity-50"
        >
          {played ? 'Reset' : playing ? 'Playing…' : 'What happens next? ▸'}
        </button>
      </div>
    </div>
  )
}
