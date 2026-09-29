import { useEffect, useMemo, useState } from 'react'
import type { Bias } from '../types'
import { LIBRARY, findEntry, type LibraryEntry } from '../lib/library'
import { candleExample, chartExample } from '../lib/examples'
import { computeStats, type TradeRecord } from '../lib/stats'
import { MiniChart } from '../components/MiniChart'
import { STARTING_BALANCE } from '../game/useGame'

interface Props {
  history: TradeRecord[]
  focus: string | null // a pattern name to jump to (from a Breakdown or Stats)
}

type Kind = 'chart' | 'candle'

const BIAS_STYLE: Record<Bias, string> = {
  bullish: 'border-up/30 text-up',
  bearish: 'border-down/30 text-down',
  neutral: 'border-neutral-700 text-soft',
}

export function LearnPage({ history, focus }: Props) {
  const focused = focus ? findEntry(focus) : undefined
  // Opening Learn on a pattern starts on its tab, highlighted, scrolled into view.
  const [kind, setKind] = useState<Kind>(focused?.kind ?? 'chart')
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
    setHighlight(entry.key)
    requestAnimationFrame(() => document.getElementById(`pattern-${entry.key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  const entries = LIBRARY.filter((e) => e.kind === kind)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pt-6 pb-12 md:max-w-2xl lg:max-w-[1240px] lg:px-10 lg:py-8">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Learn</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-soft">
          Every pattern Tradr uses: what it looks like, what it usually signals, and the trap that catches people.
        </p>

        {weakSpots.length > 0 && (
          <div className="mt-6">
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

        <div role="tablist" aria-label="Pattern type" className="mt-6 inline-grid grid-cols-2 gap-1 rounded-2xl border border-edge bg-card p-1">
          {(['chart', 'candle'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`h-11 rounded-xl px-4 text-[15px] font-medium transition-colors ${
                kind === k ? 'bg-neutral-800 text-white' : 'text-muted hover:text-soft'
              }`}
            >
              {k === 'chart' ? 'Chart patterns' : 'Candlesticks'}
              <span className="ml-1.5 font-mono text-xs text-muted">{LIBRARY.filter((e) => e.kind === k).length}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <PatternCard key={entry.key} entry={entry} highlighted={highlight === entry.key} record={patterns.get(entry.name)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PatternCard({ entry, highlighted, record }: { entry: LibraryEntry; highlighted: boolean; record?: { seen: number; correct: number } }) {
  const example = useMemo(() => (entry.kind === 'candle' ? candleExample(entry.key) : chartExample(entry.key)), [entry])
  return (
    <article
      id={`pattern-${entry.key}`}
      className={`scroll-mt-6 rounded-3xl border bg-card p-4 transition-colors ${highlighted ? 'border-neutral-400' : 'border-edge'}`}
    >
      <div className="rounded-2xl bg-base/60 px-1 py-2">
        {example && <MiniChart candles={example.candles} shapes={example.shapes} label={`Example of a ${entry.name.toLowerCase()}`} />}
      </div>
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
      {record && (
        <p className="mt-3 border-t border-edge pt-3 font-mono text-xs text-muted">
          You: {record.correct}/{record.seen} right
        </p>
      )}
    </article>
  )
}
