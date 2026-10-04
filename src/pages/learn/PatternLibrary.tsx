import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { Bias } from '../../types'
import { GROUPS, LIBRARY, entryByKey, findEntry, type LibraryEntry } from '../../lib/library'
import { candleExample, chartExample } from '../../lib/examples'
import { computeStats, type TradeRecord } from '../../lib/stats'
import { SCENARIO_MASTERY } from '../../lib/scenarios'
import { STARTING_BALANCE } from '../../game/useGame'
import type { Practice } from '../../game/usePractice'
import type { LearnProgress } from '../../game/useLearn'
import { PatternDetail } from './PatternDetail'
import { Thumb } from './PatternChart'

interface Props {
  intro: ReactNode // the page heading, shown above the list (not on a pattern's page)
  history: TradeRecord[]
  focus: string | null // a pattern name to open (from a Breakdown or Stats)
  practice: Practice // what you've built and drawn
  scenarios: LearnProgress['scenarios']
  onRunDone: (key: string, average: number) => void
  exits: LearnProgress['exits']
  onMixed: () => void // open the mixed scenarios
  onExits: () => void // open the stop loss and take profit lesson
}

type Kind = 'chart' | 'candle'

const BIAS_STYLE: Record<Bias, string> = {
  bullish: 'border-up/30 text-up',
  bearish: 'border-down/30 text-down',
  neutral: 'border-neutral-700 text-soft',
}

// Every pattern Tradr knows, as cards to filter and search. Tap one to study
// it: examples, look-alikes that aren't it, and a drill to master it.
export function PatternLibrary({ intro, history, focus, practice, scenarios, exits, onRunDone, onMixed, onExits }: Props) {
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
        mastery={scenarios[opened.key]}
        inTrades={patterns.get(opened.name)}
        made={opened.kind === 'candle' ? practice.progress.built.includes(opened.key) : practice.progress.drawn.includes(opened.key)}
        onMade={() => (opened.kind === 'candle' ? practice.recordBuilt(opened.key) : practice.recordDrawn(opened.key))}
        onOpen={open}
        onBack={close}
        onRunDone={(average) => onRunDone(opened.key, average)}
      />
    )
  }

  const mastered = LIBRARY.filter((e) => (scenarios[e.key]?.best ?? 0) >= SCENARIO_MASTERY).length

  return (
    <div>
      {intro}
      <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-edge bg-card px-4 py-3.5">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[22px] leading-none">{mastered}</span>
            <span className="text-[14px] text-soft">of {LIBRARY.length} patterns mastered</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-neutral-800" aria-hidden="true">
            <div className="h-full rounded-full bg-up transition-[width] duration-500" style={{ width: `${(mastered / LIBRARY.length) * 100}%` }} />
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">Open a pattern to learn it, then master it on real-world charts.</p>
        </div>
        <button
          type="button"
          onClick={onMixed}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-up/30 bg-up/[0.06] px-5 py-4 text-left transition-colors hover:border-up/60"
        >
          <span>
            <span className="block text-[11px] font-semibold tracking-[0.08em] text-up uppercase">Practice scenarios</span>
            <span className="mt-1 block text-[17px] font-semibold text-white">Read a chart like a trader</span>
            <span className="mt-0.5 block text-[13.5px] leading-relaxed text-soft">
              Any pattern, no hints: call the trend, name the pattern, draw its lines, read the candles, make the call.
            </span>
          </span>
          <span aria-hidden="true" className="text-[22px] text-up transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
        <button
          type="button"
          onClick={onExits}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-edge bg-card px-5 py-4 text-left transition-colors hover:border-neutral-600"
        >
          <ExitsGlyph />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Lesson{exits.best > 0 && <span className="ml-1.5 font-mono tracking-normal normal-case">· best {Math.round(exits.best * 100)}%</span>}
            </span>
            <span className="mt-1 block text-[17px] font-semibold text-white">Stop loss & take profit</span>
            <span className="mt-0.5 block text-[13.5px] leading-relaxed text-soft">Where your exits go, why the ratio matters, and a drill to place them.</span>
          </span>
          <span aria-hidden="true" className="text-[22px] text-soft transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
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
        <label className="flex h-12 min-w-[240px] flex-1 items-center gap-2.5 rounded-2xl border border-edge bg-card px-4 transition-colors focus-within:border-neutral-600 sm:max-w-xs">
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
          <PatternCard key={entry.key} entry={entry} mastery={scenarios[entry.key]} onOpen={() => open(entry.key)} />
        ))}
      </div>
    </div>
  )
}

function PatternCard({ entry, mastery, onOpen }: { entry: LibraryEntry; mastery?: { best: number }; onOpen: () => void }) {
  const example = useMemo(() => (entry.kind === 'candle' ? candleExample(entry.key) : chartExample(entry.key)), [entry])
  const best = mastery?.best ?? 0
  const mastered = best >= SCENARIO_MASTERY
  return (
    <button
      type="button"
      onClick={onOpen}
      id={`pattern-${entry.key}`}
      className={`group flex flex-col overflow-hidden rounded-3xl border bg-card text-left transition-colors hover:border-neutral-600 ${mastered ? 'border-up/30' : 'border-edge'}`}
    >
      <div className="relative w-full bg-[#07090c] px-1.5 pt-7 pb-1.5">
        <span
          className="absolute inset-x-0 top-2 text-center text-[12.5px] font-bold tracking-[0.05em] text-[#e4e9f1]/90 uppercase"
          style={{ textShadow: '0 0 10px rgba(110,180,255,0.3)' }}
        >
          {entry.name}
        </span>
        {example && <Thumb candles={example.candles} shapes={example.shapes} bias={entry.bias} height={124} measure={entry.kind === 'chart'} label={`Example of a ${entry.name.toLowerCase()}`} />}
      </div>
      <div className="flex w-full flex-1 flex-col p-3.5">
        <div className="flex w-full items-center justify-between gap-3">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${BIAS_STYLE[entry.bias]}`}>{entry.bias}</span>
          <span className="text-[12.5px] text-muted">{entry.signals}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-soft">{entry.meaning}</p>
        <div className="mt-auto flex w-full items-center justify-between gap-3 pt-3">
          <span className="text-[13px]">
            {mastered ? (
              <span className="font-medium text-up">✓ Mastered</span>
            ) : mastery ? (
              <span className="font-mono text-muted">Best {Math.round(best * 100)}%</span>
            ) : (
              <span className="text-dim">Not practiced yet</span>
            )}
          </span>
          <span className="text-[13.5px] font-medium text-soft transition-colors group-hover:text-white">
            Study <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </button>
  )
}

// A tiny position tool: entry, with the take profit above and the stop below.
function ExitsGlyph() {
  return (
    <svg width="40" height="44" viewBox="0 0 40 44" aria-hidden="true" className="shrink-0">
      <rect x="2" y="4" width="36" height="20" rx="2" fill="#3ddc97" opacity="0.14" />
      <rect x="2" y="24" width="36" height="12" rx="2" fill="#ef5b52" opacity="0.14" />
      <line x1="2" x2="38" y1="4" y2="4" stroke="#3ddc97" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="2" x2="38" y1="36" y2="36" stroke="#ef5b52" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="2" x2="38" y1="24" y2="24" stroke="#d9d9d9" strokeWidth="1.5" />
    </svg>
  )
}
