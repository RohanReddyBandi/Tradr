import { useMemo, useRef, useState } from 'react'
import type { Bias } from '../../types'
import { GROUPS, LIBRARY, entryByKey, findEntry, type LibraryEntry } from '../../lib/library'
import { candleExample, chartExample } from '../../lib/examples'
import { computeStats, type TradeRecord } from '../../lib/stats'
import { DRAWABLE, PRACTICE_CANDLES } from '../../lib/practice'
import { DRILL_ROUNDS, MASTERED } from '../../lib/patternStudy'
import { MiniChart } from '../../components/MiniChart'
import { STARTING_BALANCE } from '../../game/useGame'
import type { PracticeProgress } from '../../game/usePractice'
import type { LearnProgress } from '../../game/useLearn'
import type { PracticeMode } from '../PracticePage'
import { PatternDetail } from './PatternDetail'

interface Props {
  history: TradeRecord[]
  focus: string | null // a pattern name to open (from a Breakdown, Stats, or the quiz)
  progress: PracticeProgress
  drills: LearnProgress['drills']
  onDrillDone: (key: string, score: number) => void
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

// Every pattern Tradr knows, as cards to filter and search. Tap one to study
// it: examples, look-alikes that aren't it, and a drill to master it.
export function PatternLibrary({ history, focus, progress, drills, onDrillDone, onPractice }: Props) {
  const focused = focus ? findEntry(focus) : undefined
  const [kind, setKind] = useState<Kind>(focused?.kind ?? 'chart')
  const [group, setGroup] = useState<string | null>(null) // null shows every group
  const [search, setSearch] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(focused?.key ?? null)
  const listScroll = useRef(0) // where the list was scrolled to before a pattern opened
  const { patterns } = useMemo(() => computeStats(history, STARTING_BALANCE), [history])

  const scroller = () => document.getElementById('learn-scroll')

  function open(key: string) {
    if (!openKey) listScroll.current = scroller()?.scrollTop ?? 0
    setOpenKey(key)
    requestAnimationFrame(() => scroller()?.scrollTo({ top: 0 }))
  }

  function close() {
    setOpenKey(null)
    requestAnimationFrame(() => scroller()?.scrollTo({ top: listScroll.current }))
  }

  // Patterns you've seen at least twice on swipe cards and get right less than 60% of the time.
  const weakSpots = [...patterns.values()]
    .filter((p) => p.seen >= 2 && p.correct / p.seen < 0.6 && findEntry(p.name))
    .sort((a, b) => a.correct / a.seen - b.correct / b.seen)
    .slice(0, 6)

  // A search looks through every pattern, of both kinds.
  const query = search.trim().toLowerCase()
  const entries = query
    ? LIBRARY.filter((e) => e.name.toLowerCase().includes(query) || e.signals.toLowerCase().includes(query) || e.group.toLowerCase().includes(query))
    : LIBRARY.filter((e) => e.kind === kind && (!group || e.group === group))

  const practiceFor = (entry: LibraryEntry) =>
    entry.kind === 'candle' && BUILDABLE.has(entry.key)
      ? { label: 'Build it', done: progress.built.includes(entry.key), onClick: () => onPractice('build', entry.key) }
      : entry.kind === 'chart' && DRAWABLE_KEYS.has(entry.key)
        ? { label: 'Draw it', done: progress.drawn.includes(entry.key), onClick: () => onPractice('draw', entry.key) }
        : null

  const opened = openKey ? entryByKey(openKey) : undefined
  if (opened) {
    // Previous and next follow the list you opened it from (or its own kind, if it isn't in that list).
    const list = entries.some((e) => e.key === opened.key) ? entries : LIBRARY.filter((e) => e.kind === opened.kind)
    const index = list.findIndex((e) => e.key === opened.key)
    return (
      <PatternDetail
        key={opened.key}
        entry={opened}
        position={{ index, count: list.length }}
        prev={list[index - 1] ?? null}
        next={list[index + 1] ?? null}
        drill={drills[opened.key]}
        inTrades={patterns.get(opened.name)}
        practice={practiceFor(opened)}
        onOpen={open}
        onBack={close}
        onDrillDone={(score) => onDrillDone(opened.key, score)}
      />
    )
  }

  const mastered = LIBRARY.filter((e) => (drills[e.key]?.best ?? 0) >= MASTERED).length

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-edge bg-card px-4 py-3.5">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[22px] leading-none">{mastered}</span>
            <span className="text-[14px] text-soft">of {LIBRARY.length} patterns mastered</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-neutral-800" aria-hidden="true">
            <div className="h-full rounded-full bg-up transition-[width] duration-500" style={{ width: `${(mastered / LIBRARY.length) * 100}%` }} />
          </div>
        </div>
        <p className="max-w-sm text-[13.5px] leading-relaxed text-muted">
          Open a pattern to learn what to look for and see what is and isn't it, then pass its {DRILL_ROUNDS}-chart drill.
        </p>
      </div>

      {weakSpots.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">Your weak spots on swipe cards</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {weakSpots.map((p) => (
              <button
                key={p.name}
                onClick={() => open(findEntry(p.name)!.key)}
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <PatternCard key={entry.key} entry={entry} drill={drills[entry.key]} onOpen={() => open(entry.key)} />
        ))}
      </div>
    </div>
  )
}

function PatternCard({ entry, drill, onOpen }: { entry: LibraryEntry; drill?: { best: number }; onOpen: () => void }) {
  const example = useMemo(() => (entry.kind === 'candle' ? candleExample(entry.key) : chartExample(entry.key)), [entry])
  const mastered = (drill?.best ?? 0) >= MASTERED
  return (
    <button
      type="button"
      onClick={onOpen}
      id={`pattern-${entry.key}`}
      className={`group flex flex-col rounded-3xl border bg-card p-3.5 text-left transition-colors hover:border-neutral-600 ${mastered ? 'border-up/25' : 'border-edge'}`}
    >
      <div className="w-full rounded-2xl bg-base/60 px-1 py-2">
        {example && <MiniChart candles={example.candles} shapes={example.shapes} label={`Example of a ${entry.name.toLowerCase()}`} />}
      </div>
      <div className="mt-3 flex w-full items-start justify-between gap-3">
        <h3 className="text-[17px] leading-snug font-semibold tracking-tight">{entry.name}</h3>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${BIAS_STYLE[entry.bias]}`}>{entry.bias}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-soft">{entry.meaning}</p>
      <div className="mt-auto flex w-full items-center justify-between gap-3 pt-3">
        <span className="text-[13px]">
          {mastered ? (
            <span className="font-medium text-up">✓ Mastered</span>
          ) : drill ? (
            <span className="font-mono text-muted">
              Best {drill.best}/{DRILL_ROUNDS}
            </span>
          ) : (
            <span className="text-dim">Not practised yet</span>
          )}
        </span>
        <span className="text-[13.5px] font-medium text-soft transition-colors group-hover:text-white">
          Study <span aria-hidden="true">→</span>
        </span>
      </div>
    </button>
  )
}
