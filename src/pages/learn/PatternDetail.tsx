import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { Bias } from '../../types'
import { entryByKey, type LibraryEntry } from '../../lib/library'
import { candleExample, chartExample } from '../../lib/examples'
import { CHART_PATTERNS } from '../../lib/chartPatterns'
import { SPOT, howToTrade } from '../../lib/spotting'
import { examplesOf, nonExamples, patternSize, type Specimen } from '../../lib/patternStudy'
import { SCENARIO_MASTERY, SCENARIOS_PER_RUN } from '../../lib/scenarios'
import { PRACTICE_CANDLES, DRAWABLE } from '../../lib/practice'
import { HeroChart, Thumb } from './PatternChart'
import { ScenarioPractice } from './ScenarioPractice'
import { BuildEditor } from '../practice/BuildDrill'
import { DrawPad } from '../practice/DrawDrill'
import { LEARN } from '../../theme'

const BIAS_STYLE: Record<Bias, string> = {
  bullish: 'border-up/30 text-up',
  bearish: 'border-down/30 text-down',
  neutral: 'border-neutral-700 text-soft',
}

const BUILDABLE = new Set(PRACTICE_CANDLES.map((p) => p.key))
const DRAWABLE_KEYS = new Set(DRAWABLE.map((p) => p.key))

interface Props {
  entry: LibraryEntry
  position: { index: number; count: number } // where it sits in the list you opened it from
  prev: LibraryEntry | null
  next: LibraryEntry | null
  mastery: { best: number; runs: number } | undefined
  inTrades?: { seen: number; correct: number } // how you've read it on swipe cards
  made: boolean // built (candlesticks) or drawn (chart patterns) it yourself
  onMade: () => void
  onOpen: (key: string) => void
  onBack: () => void
  onRunDone: (average: number) => void
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31)
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

// One pattern, in depth: the labelled example, what to look for, fresh
// examples next to look-alikes that aren't it, real-world scenarios to
// practice on, and a chance to build or draw it yourself.
export function PatternDetail({ entry, position, prev, next, mastery, inTrades, made, onMade, onOpen, onBack, onRunDone }: Props) {
  const [seed, setSeed] = useState(newSeed)
  const [practicing, setPracticing] = useState(false)
  const example = useMemo(() => (entry.kind === 'candle' ? candleExample(entry.key) : chartExample(entry.key)), [entry])
  const isIt = useMemo(() => examplesOf(entry.key, seed, 3), [entry.key, seed])
  const isnt = useMemo(() => nonExamples(entry.key, seed + 1).slice(0, 6), [entry.key, seed])
  const family = entry.kind === 'chart' ? (CHART_PATTERNS[entry.key]?.family ?? null) : null
  const size = patternSize(entry.key)
  const name = entry.name.toLowerCase()
  const best = mastery?.best ?? 0
  const mastered = best >= SCENARIO_MASTERY
  const canMake = entry.kind === 'candle' ? BUILDABLE.has(entry.key) : DRAWABLE_KEYS.has(entry.key)

  const scrollTop = () => requestAnimationFrame(() => document.getElementById('learn-scroll')?.scrollTo({ top: 0 }))

  if (practicing) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[26px] leading-tight font-bold tracking-tight">{entry.name}</h2>
          <span className="text-[15px] text-muted">Real-world practice</span>
        </div>
        <ScenarioPractice
          focus={entry.key}
          runLength={SCENARIOS_PER_RUN}
          onRunDone={onRunDone}
          onExit={() => {
            setPracticing(false)
            scrollTop()
          }}
          exitLabel={`Back to the ${name}`}
        />
      </motion.div>
    )
  }

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

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
          {entry.kind === 'chart' ? 'Chart pattern' : 'Candlestick'} · {entry.group}
        </span>
        <span className={`rounded-full border px-2.5 py-0.5 text-[12.5px] font-medium capitalize ${BIAS_STYLE[entry.bias]}`}>{entry.bias}</span>
        <span className="text-[13px] text-muted">· {entry.signals}</span>
        {mastered && <span className="rounded-full border border-up/40 bg-up/10 px-2.5 py-0.5 text-[12.5px] font-medium text-up">✓ Mastered</span>}
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0">
          {example && <HeroChart entry={entry} example={example} height={entry.kind === 'chart' ? 400 : 330} />}

          <Section title="How to spot it">
            <ol className="flex flex-col gap-3">
              {(SPOT[entry.key] ?? []).map((point, k) => (
                <li key={k} className="flex gap-3 text-[16px] leading-relaxed text-neutral-100">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: LEARN.marker }}>
                    {k + 1}
                  </span>
                  {point}
                </li>
              ))}
            </ol>
          </Section>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <InfoCard title="What it means">{entry.meaning}</InfoCard>
            <InfoCard title="The trap" tone="amber">
              {entry.trap}
            </InfoCard>
          </div>
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
            <div className="grid gap-3 sm:grid-cols-3">
              {isIt.map((s, k) => (
                <SpecimenCard key={`${seed}-yes-${k}`} specimen={s} bias={entry.bias} size={size} label={`Example ${k + 1}`} tone="good" />
              ))}
            </div>
          </Section>

          <Section title={`It isn't ${article(name)} ${name}`}>
            <p className="-mt-1 mb-3 text-[14px] text-muted">The ones that catch people out: look-alikes, and charts that are almost it.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {isnt.map((s, k) => (
                <SpecimenCard
                  key={`${seed}-no-${k}`}
                  specimen={s}
                  bias={s.shows ? (entryByKey(s.shows)?.bias ?? 'neutral') : 'neutral'}
                  size={size}
                  label={headingFor(s)}
                  tone="bad"
                  onOpen={s.kind === 'lookAlike' && s.shows ? () => onOpen(s.shows!) : undefined}
                />
              ))}
            </div>
          </Section>

          {canMake && (
            <Section title={entry.kind === 'candle' ? 'Build one yourself' : 'Draw one yourself'}>
              <p className="-mt-1 mb-1 text-[14px] text-muted">
                {entry.kind === 'candle'
                  ? 'Drag the candles into shape until the detector recognises it.'
                  : 'Draw the shape in one stroke. Your line becomes candles, and the scanner says what it sees.'}
                {made && <span className="ml-1.5 text-up">✓ Done before</span>}
              </p>
              {entry.kind === 'candle' ? (
                <BuildEditor key={entry.key} target={entry.key} onBuilt={onMade} onNext={() => next && onOpen(next.key)} />
              ) : (
                <DrawPad key={entry.key} target={entry.key} onDrawn={onMade} onNext={() => next && onOpen(next.key)} />
              )}
            </Section>
          )}
        </div>

        {/* Practice: real-world scenarios built around this pattern. */}
        <aside className="mt-8 lg:mt-0">
          <div className="flex flex-col gap-3 lg:sticky lg:top-0">
            <div className={`rounded-3xl border p-5 ${mastered ? 'border-up/30 bg-up/[0.05]' : 'border-edge bg-card'}`}>
              <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Practice</div>
              <h3 className="mt-1.5 text-[19px] leading-snug font-semibold">Find it in the wild</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-soft">
                {SCENARIOS_PER_RUN} full, realistic charts with {article(name)} {name} in them. Call the trend, name the pattern, draw its lines, read the
                signal candle, and make the call. Then watch what happened.
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-neutral-800" aria-hidden="true">
                <div className={`h-full rounded-full ${mastered ? 'bg-up' : 'bg-amber'}`} style={{ width: `${best * 100}%` }} />
              </div>
              <p className="mt-1.5 font-mono text-[12px] text-muted">
                {mastery ? `Best ${Math.round(best * 100)}% · master at ${Math.round(SCENARIO_MASTERY * 100)}%` : 'Not tried yet'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setPracticing(true)
                  scrollTop()
                }}
                className="mt-4 h-12 w-full rounded-2xl bg-up text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
              >
                {mastery ? 'Practice again' : 'Start practicing'}
              </button>
            </div>

            {inTrades && (
              <div className="rounded-2xl border border-edge bg-card px-4 py-3 text-[14px] text-soft">
                On your swipe cards: <span className="font-mono text-neutral-100">{inTrades.correct}/{inTrades.seen}</span> read right when it showed up.
              </div>
            )}
          </div>
        </aside>
      </div>
    </motion.article>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function InfoCard({ title, tone, children }: { title: string; tone?: 'amber'; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${tone === 'amber' ? 'border-amber/25 bg-amber/[0.05]' : 'border-edge bg-card'}`}>
      <div className={`text-[11px] font-semibold tracking-[0.08em] uppercase ${tone === 'amber' ? 'text-amber' : 'text-muted'}`}>{title}</div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-100">{children}</p>
    </div>
  )
}

function headingFor(s: Specimen) {
  if (s.kind === 'lookAlike' && s.shows) {
    const name = entryByKey(s.shows)?.name ?? s.shows
    return `${article(name)[0].toUpperCase()}${article(name).slice(1)} ${name.toLowerCase()}`
  }
  return 'Almost'
}

interface CardProps {
  specimen: Specimen
  bias: Bias
  size: number // candlesticks: how many candles the pattern spans (they get a box)
  label: string
  tone: 'good' | 'bad'
  onOpen?: () => void // look-alikes: open that pattern's page
}

function SpecimenCard({ specimen, bias, size, label, tone, onOpen }: CardProps) {
  return (
    <figure className={`rounded-2xl border bg-card p-2.5 ${tone === 'good' ? 'border-up/20' : 'border-down/20'}`}>
      <div className="rounded-xl bg-[#07090c] px-1 py-1.5">
        <Thumb candles={specimen.candles} shapes={specimen.shapes} bias={bias} box={size} height={tone === 'good' ? 130 : 140} label={label} />
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
