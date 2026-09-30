import type { ReactNode } from 'react'
import type { Candle } from '../types'
import type { Tool } from '../components/DrawingLayer'
import type { Drawing } from '../lib/userMarkup'
import { GROUPS, LIBRARY, entryByKey } from '../lib/library'
import { MiniChart } from '../components/MiniChart'
import { Sheet } from '../components/Sheet'
import { PatternPicker } from './practice/PatternPicker'

// The markup tools on the trade setup screen: the tool bar under the chart,
// the "Your read" panel listing what you've drawn, and the pickers for
// naming a candle or the chart pattern.

const CANDLE_ENTRIES = LIBRARY.filter((e) => e.kind === 'candle')
const CHART_ENTRIES = LIBRARY.filter((e) => e.kind === 'chart')

const TOOLS: { id: Tool; label: string; icon: ReactNode; hint: string }[] = [
  { id: 'trade', label: 'SL / TP', icon: <TradeToolIcon />, hint: 'Drag the SL and TP lines on the chart, or type a price.' },
  { id: 'trend', label: 'Trendline', icon: <TrendToolIcon />, hint: 'Drag from one point to another. The ends snap to nearby highs and lows.' },
  { id: 'level', label: 'Level', icon: <LevelToolIcon />, hint: 'Tap or drag to put a flat line on support or resistance.' },
  { id: 'candle', label: 'Candle', icon: <CandleToolIcon />, hint: 'Tap a candle to say which pattern it belongs to.' },
]

// One line under the tool bar saying how the current tool works.
export function ToolHint({ tool }: { tool: Tool }) {
  return <p className="text-sm text-muted">{TOOLS.find((t) => t.id === tool)!.hint}</p>
}

interface BarProps {
  tool: Tool
  onTool: (tool: Tool) => void
  canUndo: boolean
  onUndo: () => void
}

export function ToolBar({ tool, onTool, canUndo, onUndo }: BarProps) {
  return (
    <div className="flex items-center gap-2">
      <div role="radiogroup" aria-label="Chart tool" className="grid flex-1 grid-cols-4 gap-1 rounded-2xl border border-edge bg-card p-1">
        {TOOLS.map((t) => {
          const on = tool === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onTool(t.id)}
              className={`flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11.5px] leading-none font-medium transition-colors ${
                on ? (t.id === 'trade' ? 'bg-neutral-800 text-white' : 'bg-pen/15 text-pen') : 'text-muted hover:text-soft'
              }`}
            >
              {t.icon}
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo the last drawing"
        className="grid size-12 shrink-0 place-items-center rounded-2xl border border-edge bg-card text-soft transition-colors hover:text-white disabled:opacity-35"
      >
        <UndoIcon />
      </button>
    </div>
  )
}

const drawingName = (d: Drawing) =>
  d.kind === 'trend' ? 'Trendline' : d.kind === 'level' ? `Level at ${d.price.toFixed(2)}` : `Candle ${d.index + 1}`

interface ReadProps {
  drawings: Drawing[]
  pattern: string | null
  onNamePattern: () => void
  onClearPattern: () => void
  onRename: (index: number) => void // reopen the picker for a named candle
  onRemove: (k: number) => void
}

// Everything you've marked up, with a way to take each one back.
export function YourRead({ drawings, pattern, onNamePattern, onClearPattern, onRename, onRemove }: ReadProps) {
  return (
    <section className="rounded-2xl border border-edge bg-card px-4 py-3.5" aria-label="Your read">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] tracking-[0.08em] text-muted uppercase">Your read</h2>
        <span className="text-[12px] text-muted">Optional · graded after the replay</span>
      </div>

      <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
        <span className="text-[15px] text-soft">Chart pattern</span>
        {pattern ? (
          <span className="flex items-center gap-1 rounded-full border border-pen/40 bg-pen/10 py-1 pr-1 pl-3 text-[14px] text-pen">
            <button type="button" onClick={onNamePattern} className="hover:text-white">
              {entryByKey(pattern)?.name ?? pattern}
            </button>
            <button type="button" onClick={onClearPattern} aria-label="Clear the pattern" className="grid size-7 place-items-center rounded-full hover:bg-pen/20">
              <SmallCross />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={onNamePattern}
            className="h-10 rounded-xl border border-neutral-800 px-3.5 text-[14px] text-soft transition-colors hover:border-neutral-600 hover:text-white"
          >
            Name it
          </button>
        )}
      </div>

      {drawings.length > 0 ? (
        <ul className="mt-1 divide-y divide-edge border-t border-edge">
          {drawings.map((d, k) => (
            <li key={k} className="flex min-h-11 items-center justify-between gap-3 text-[14px]">
              {d.kind === 'candle' ? (
                <button type="button" onClick={() => onRename(d.index)} className="text-left hover:text-white">
                  <span className="font-mono text-[12.5px] text-muted">{drawingName(d)}</span>
                  <span className="ml-2 text-pen">{entryByKey(d.key)?.name ?? d.key}</span>
                </button>
              ) : (
                <span className="text-neutral-200">
                  <span className="mr-2 inline-block h-0.5 w-3 rounded-full bg-pen align-middle" aria-hidden="true" />
                  {drawingName(d)}
                </span>
              )}
              <button type="button" onClick={() => onRemove(k)} aria-label={`Remove ${drawingName(d).toLowerCase()}`} className="-mr-2 grid size-10 place-items-center rounded-full text-muted hover:text-down">
                <SmallCross />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Draw trendlines and levels, or name the candles, with the tools under the chart.</p>
      )}
    </section>
  )
}

interface CandleSheetProps {
  candles: Candle[]
  index: number
  current: string | null
  onPick: (key: string) => void
  onRemove: () => void
  onClose: () => void
}

// "Candle 58: what is it?" A close-up of the candle, then every candlestick pattern.
export function CandleSheet({ candles, index, current, onPick, onRemove, onClose }: CandleSheetProps) {
  const from = Math.max(0, index - 8)
  const to = Math.min(candles.length - 1, index + 2)
  const closeUp = candles.slice(from, to + 1)
  return (
    <Sheet
      onClose={onClose}
      title={
        <h2 className="text-[18px] leading-snug font-semibold">
          Candle {index + 1}
          <span className="ml-2 font-normal text-soft">What is it part of?</span>
        </h2>
      }
    >
      <div className="rounded-2xl bg-base/60 px-1 py-2">
        <MiniChart candles={closeUp} shapes={[{ kind: 'candles', fromIndex: index - from, toIndex: index - from }]} label={`Close-up of candle ${index + 1}`} />
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">For patterns of two or more candles, any candle inside the pattern counts.</p>
      <div className="mt-4">
        <PatternPicker entries={CANDLE_ENTRIES} groups={GROUPS.candle} selected={current} onPick={onPick} />
      </div>
      {current && (
        <button type="button" onClick={onRemove} className="mt-4 h-10 text-sm text-muted hover:text-down">
          Remove this name
        </button>
      )}
    </Sheet>
  )
}

interface PatternSheetProps {
  current: string | null
  onPick: (key: string) => void
  onClose: () => void
}

export function PatternSheet({ current, onPick, onClose }: PatternSheetProps) {
  return (
    <Sheet onClose={onClose} title={<h2 className="text-[18px] leading-snug font-semibold">Which chart pattern is it?</h2>}>
      <p className="text-[13px] leading-relaxed text-muted">Pick the pattern you're trading. The dot shows which way each one leans.</p>
      <div className="mt-4">
        <PatternPicker entries={CHART_ENTRIES} groups={GROUPS.chart} selected={current} onPick={onPick} />
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function TradeToolIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M1.5 4h13M1.5 12h13" strokeDasharray="2.5 2" />
      <path d="M8 6v4M6.5 7.2L8 5.8l1.5 1.4M6.5 8.8L8 10.2l1.5-1.4" />
    </svg>
  )
}

function TrendToolIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M3.5 12.5l9-9" />
      <circle cx="3" cy="13" r="1.6" />
      <circle cx="13" cy="3" r="1.6" />
    </svg>
  )
}

function LevelToolIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M1.5 10h13" strokeDasharray="3 2" />
      <path d="M3 7l2.5-3 2.5 3 2.5-3L13 7" />
    </svg>
  )
}

function CandleToolIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 1.5v2.5M6 12v2.5" />
      <rect x="3.75" y="4" width="4.5" height="8" rx="1" />
      <path d="M10.5 6.5h4M10.5 9.5h3" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4.5L3.5 8 7 11.5" />
      <path d="M3.5 8h8a5 5 0 010 10H9" />
    </svg>
  )
}

function SmallCross() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 3l6 6M9 3L3 9" />
    </svg>
  )
}
