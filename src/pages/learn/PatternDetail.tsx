import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { Bias } from '../../types'
import { entryByKey, type LibraryEntry } from '../../lib/library'
import { candleExample, chartExample } from '../../lib/examples'
import { CHART_PATTERNS } from '../../lib/chartPatterns'
import { SPOT, howToTrade } from '../../lib/spotting'
import { DRILL_ROUNDS, MASTERED, examplesOf, nonExamples, patternSize, type Specimen } from '../../lib/patternStudy'
import { PlayOut, SpecimenChart } from './PatternChart'
import { SpotDrill } from './SpotDrill'

const BIAS_STYLE: Record<Bias, string> = {
  bullish: 'border-up/30 text-up',
  bearish: 'border-down/30 text-down',
  neutral: 'border-neutral-700 text-soft',
}

interface Props {
  entry: LibraryEntry
  position: { index: number; count: number } // where it sits in the list you opened it from
  prev: LibraryEntry | null
  next: LibraryEntry | null
  drill: { best: number; runs: number } | undefined
  inTrades?: { seen: number; correct: number } // how you've read it on swipe cards
  practice: { label: string; done: boolean; onClick: () => void } | null // Build it / Draw it
  onOpen: (key: string) => void
  onBack: () => void
  onDrillDone: (score: number) => void
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31)

// One pattern, in depth: what to look for, fresh examples of it, look-alikes
// that aren't it (and why), and an "Is it or isn't it?" drill to prove you can tell.
export function PatternDetail({ entry, position, prev, next, drill, inTrades, practice, onOpen, onBack, onDrillDone }: Props) {
  const [seed, setSeed] = useState(newSeed)
  const [drilling, setDrilling] = useState(false)
  const example = useMemo(() => (entry.kind === 'candle' ? candleExample(entry.key) : chartExample(entry.key)), [entry])
  const isIt = useMemo(() => examplesOf(entry.key, seed, 3), [entry.key, seed])
  const isnt = useMemo(() => nonExamples(entry.key, seed + 1).slice(0, 6), [entry.key, seed])
  const family = entry.kind === 'chart' ? (CHART_PATTERNS[entry.key]?.family ?? null) : null
  const size = patternSize(entry.key)
  const name = entry.name.toLowerCase()
  const best = drill?.best ?? 0
  const mastered = best >= MASTERED

  const scrollTop = () => requestAnimationFrame(() => document.getElementById('learn-scroll')?.scrollTo({ top: 0 }))

  return (
    <motion.article key={entry.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      {/* Back, and the patterns either side. */}
      <nav className="flex items-center justify-between gap-3" aria-label="Patterns">
        <button type="button" onClick={onBack} className="-ml-1 flex h-11 items-center gap-1.5 px-1 text-[15px] text-muted hover:text-white">
          <span aria-hidden="true">←</span> All patterns
        </button>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden font-mono text-[12px] text-muted sm:inline">
            {position.index + 1} of {position.count}
          </span>
          {[
            { to: prev, label: 'Previous', arrow: '‹' },
            { to: next, label: 'Next', arrow: '›' },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              disabled={!b.to}
              onClick={() => b.to && onOpen(b.to.key)}
              title={b.to ? b.to.name : undefined}
              aria-label={b.to ? `${b.label}: ${b.to.name}` : b.label}
              className="grid size-11 place-items-center rounded-xl border border-neutral-800 text-[20px] text-soft transition-colors hover:border-neutral-600 hover:text-white disabled:opacity-30"
            >
              {b.arrow}
            </button>
          ))}
        </div>
      </nav>

      <header className="mt-3">
        <div className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
          {entry.kind === 'chart' ? 'Chart pattern' : 'Candlestick'} · {entry.group}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-[30px] leading-tight font-bold tracking-tight lg:text-[36px]">{entry.name}</h2>
          <span className={`rounded-full border px-2.5 py-0.5 text-[13px] font-medium capitalize ${BIAS_STYLE[entry.bias]}`}>{entry.bias}</span>
          {mastered ? (
            <span className="rounded-full border border-up/40 bg-up/10 px-2.5 py-0.5 text-[13px] font-medium text-up">✓ Mastered</span>
          ) : drill ? (
            <span className="rounded-full border border-neutral-700 px-2.5 py-0.5 font-mono text-[12px] text-soft">
              Best {best}/{DRILL_ROUNDS}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[15px] text-muted">Usually signals: {entry.signals.toLowerCase()}</p>
      </header>

      {drilling ? (
        <div className="mt-6 max-w-3xl">
          <SpotDrill
            entry={entry}
            best={best}
            onFinish={onDrillDone}
            onClose={() => {
              setDrilling(false)
              scrollTop()
            }}
          />
        </div>
      ) : (
        <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
          <div className="min-w-0">
            {example && <PlayOut entry={entry} example={example} height={entry.kind === 'chart' ? 230 : 190} />}

            <Section title="How to spot it">
              <ol className="flex flex-col gap-2.5">
                {(SPOT[entry.key] ?? []).map((point, k) => (
                  <li key={k} className="flex gap-3 text-[16px] leading-relaxed text-neutral-100">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-neutral-700 font-mono text-[12px] text-soft">
                      {k + 1}
                    </span>
                    {point}
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="What it means">
              <p className="text-[16px] leading-relaxed text-neutral-200">{entry.meaning}</p>
            </Section>

            <Section title="The trap">
              <p className="rounded-2xl border-l-2 border-amber bg-amber/[0.05] py-2.5 pr-3 pl-4 text-[15.5px] leading-relaxed text-neutral-100">{entry.trap}</p>
            </Section>

            <Section title="How traders use it">
              <p className="text-[15.5px] leading-relaxed text-soft">{howToTrade(entry.kind, family, /continuation|momentum/i.test(entry.signals), entry.bias)}</p>
            </Section>

            <Section
              title={`It is ${article(name)} ${name}`}
              action={
                <button type="button" onClick={() => setSeed(newSeed())} className="h-9 rounded-lg px-2.5 text-[13px] text-muted hover:bg-neutral-900 hover:text-white">
                  New examples ↻
                </button>
              }
            >
              <p className="-mt-1 mb-3 text-[14px] text-muted">Drawn fresh each time, and each one checked by the same detector the game uses.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {isIt.map((s, k) => (
                  <SpecimenCard key={`${seed}-yes-${k}`} specimen={s} size={size} label={`Example ${k + 1}`} tone="good" />
                ))}
              </div>
            </Section>

            <Section title={`It isn't ${article(name)} ${name}`}>
              <p className="-mt-1 mb-3 text-[14px] text-muted">The ones that catch people out: look-alikes, and charts that are almost it.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {isnt.map((s, k) => (
                  <SpecimenCard key={`${seed}-no-${k}`} specimen={s} size={size} label={headingFor(s)} tone="bad" onOpen={s.kind === 'lookAlike' && s.shows ? () => onOpen(s.shows!) : undefined} />
                ))}
              </div>
            </Section>
          </div>

          {/* Practice: the drill, plus the Build or Draw drill for this pattern. */}
          <aside className="mt-8 lg:mt-0">
            <div className="flex flex-col gap-3 lg:sticky lg:top-0">
              <div className={`rounded-3xl border p-5 ${mastered ? 'border-up/30 bg-up/[0.05]' : 'border-edge bg-card'}`}>
                <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Practice</div>
                <h3 className="mt-1.5 text-[19px] leading-snug font-semibold">Is it or isn't it?</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-soft">
                  {DRILL_ROUNDS} fresh charts: some are {article(name)} {name}, some only look like one. Get {MASTERED} right to master it.
                </p>
                <div className="mt-3 flex gap-1" aria-hidden="true">
                  {Array.from({ length: DRILL_ROUNDS }, (_, k) => (
                    <div key={k} className={`h-1.5 flex-1 rounded-full ${k < best ? (mastered ? 'bg-up' : 'bg-amber') : 'bg-neutral-800'}`} />
                  ))}
                </div>
                <p className="mt-1.5 font-mono text-[12px] text-muted">
                  {drill ? `Best ${best}/${DRILL_ROUNDS} · ${drill.runs} ${drill.runs === 1 ? 'try' : 'tries'}` : 'Not tried yet'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDrilling(true)
                    scrollTop()
                  }}
                  className="mt-4 h-12 w-full rounded-2xl bg-up text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
                >
                  {drill ? 'Practise again' : 'Start practising'}
                </button>
              </div>

              {practice && (
                <button
                  type="button"
                  onClick={practice.onClick}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-edge bg-card px-4 text-left transition-colors hover:border-neutral-600"
                >
                  <span>
                    <span className="block text-[15px] font-medium text-neutral-100">
                      {practice.label}
                      {practice.done && <span className="ml-1.5 text-up">✓</span>}
                    </span>
                    <span className="block text-[13px] text-muted">
                      {entry.kind === 'candle' ? 'Drag candles into the shape yourself' : 'Draw the shape and see if the scanner agrees'}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-muted">
                    →
                  </span>
                </button>
              )}

              {inTrades && (
                <div className="rounded-2xl border border-edge bg-card px-4 py-3 text-[14px] text-soft">
                  On your swipe cards: <span className="font-mono text-neutral-100">{inTrades.correct}/{inTrades.seen}</span> read right when it showed up.
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </motion.article>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

function headingFor(s: Specimen) {
  if (s.kind === 'lookAlike' && s.shows) {
    const name = entryByKey(s.shows)?.name ?? s.shows
    return `${article(name)[0].toUpperCase()}${article(name).slice(1)} ${name.toLowerCase()}`
  }
  return 'Almost'
}

interface CardProps {
  specimen: Specimen
  size: number // candlesticks: how many candles the pattern spans (they get a box)
  label: string
  tone: 'good' | 'bad'
  onOpen?: () => void // look-alikes: open that pattern's page
}

function SpecimenCard({ specimen, size, label, tone, onOpen }: CardProps) {
  return (
    <figure className={`rounded-2xl border bg-card p-2.5 ${tone === 'good' ? 'border-up/20' : 'border-down/20'}`}>
      <div className="rounded-xl bg-base/60 px-1 py-1.5">
        <SpecimenChart candles={specimen.candles} shapes={specimen.shapes} box={specimen.shapes.length ? 0 : size} height={tone === 'good' ? 120 : 130} label={label} />
      </div>
      <figcaption className="px-1.5 pt-2 pb-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[14px] font-semibold ${tone === 'good' ? 'text-up' : 'text-down'}`}>
            <span aria-hidden="true">{tone === 'good' ? '✓ ' : '✗ '}</span>
            {label}
          </span>
          {onOpen && (
            <button type="button" onClick={onOpen} className="text-[12.5px] text-muted underline decoration-neutral-700 underline-offset-4 hover:text-white">
              Study it
            </button>
          )}
        </div>
        {tone === 'bad' && <p className="mt-1 text-[13.5px] leading-relaxed text-soft">{reason(specimen.note)}</p>}
      </figcaption>
    </figure>
  )
}

// The note without the "It's a hanging man, not a hammer." opening (the heading says it).
function reason(note: string) {
  const rest = note.replace(/^It's an? [^:.]+[:.] ?/, '')
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}
