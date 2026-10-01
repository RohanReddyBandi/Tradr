import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { LibraryEntry } from '../../lib/library'
import { entryByKey } from '../../lib/library'
import { DRILL_ROUNDS, MASTERED, drillRounds, patternSize } from '../../lib/patternStudy'
import { SpecimenChart } from './PatternChart'

interface Props {
  entry: LibraryEntry
  best: number // your best score so far
  onFinish: (score: number) => void
  onClose: () => void
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31)

// "Is it or isn't it?": eight fresh charts, half of them the pattern and half
// look-alikes or near misses. Y or → for yes, N or ← for no, Enter for next.
export function SpotDrill({ entry, best, onFinish, onClose }: Props) {
  const [seed, setSeed] = useState(newSeed)
  const rounds = useMemo(() => drillRounds(entry.key, seed), [entry.key, seed])
  const [answers, setAnswers] = useState<boolean[]>([])
  const [round, setRound] = useState(0)
  const [finished, setFinished] = useState(false) // on the score screen
  const r = rounds[round]
  const answered = answers.length > round
  const last = round === rounds.length - 1
  const score = answers.filter((a, i) => a === rounds[i].is).length
  const name = entry.name.toLowerCase()
  const size = patternSize(entry.key)

  function answer(yes: boolean) {
    if (answered) return
    const all = [...answers, yes]
    setAnswers(all)
    if (all.length === rounds.length) onFinish(all.filter((a, i) => a === rounds[i].is).length)
  }

  function again() {
    setSeed(newSeed())
    setAnswers([])
    setRound(0)
    setFinished(false)
  }

  const next = () => (last ? setFinished(true) : setRound(round + 1))

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return
      const k = event.key.toLowerCase()
      if (!answered && (k === 'y' || k === 'arrowright')) answer(true)
      else if (!answered && (k === 'n' || k === 'arrowleft')) answer(false)
      else if (answered && !finished && (k === 'enter' || k === 'arrowright')) next()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (finished) {
    const mastered = score >= MASTERED
    return (
      <div className="rounded-3xl border border-edge bg-card p-6">
        <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Is it {article(name)} {name}?</div>
        <div className="mt-3 flex items-baseline gap-3">
          <span className={`font-mono text-[44px] leading-none ${mastered ? 'text-up' : score >= 5 ? 'text-amber' : 'text-down'}`}>
            {score}/{DRILL_ROUNDS}
          </span>
          <span className="text-[15px] text-soft">{mastered ? 'Mastered.' : `${MASTERED} or more to master it.`}</span>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-soft">
          {mastered
            ? `You can tell ${article(name)} ${name} from its look-alikes. It's marked mastered in the pattern list.`
            : `Best so far: ${Math.max(best, score)}/${DRILL_ROUNDS}. Read the checklist again, then try a fresh set.`}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={again} className="h-11 rounded-xl bg-up px-5 text-[15px] font-semibold text-black hover:bg-[#5fe6ab]">
            Eight more
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft hover:border-neutral-600 hover:text-white"
          >
            Back to the {name}
          </button>
        </div>
      </div>
    )
  }

  const right = answered && answers[round] === r.is
  const shows = r.shows ? entryByKey(r.shows) : undefined
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {rounds.map((x, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < answers.length ? (answers[i] === x.is ? 'bg-up' : 'bg-down') : i === round ? 'bg-neutral-500' : 'bg-neutral-800'
              }`}
            />
          ))}
        </div>
        <span className="font-mono text-[12px] text-muted">
          {round + 1}/{DRILL_ROUNDS}
        </span>
      </div>

      <h3 className="mt-4 text-[20px] leading-snug font-semibold tracking-tight">
        Is this {article(name)} {name}?
        {size > 0 && <span className="ml-2 text-[14px] font-normal text-muted">Judge the {size === 1 ? 'candle' : `${size} candles`} in the box.</span>}
      </h3>

      <div className="mt-3 rounded-3xl border border-edge bg-card px-2 py-3">
        <SpecimenChart
          key={`${seed}-${round}`}
          candles={r.candles}
          shapes={answered ? r.shapes : []}
          box={size}
          height={250}
          label={`Chart ${round + 1} of ${DRILL_ROUNDS}`}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!answered ? (
          <motion.div key="ask" className="mt-4 grid grid-cols-2 gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              type="button"
              onClick={() => answer(false)}
              className="h-14 rounded-2xl border border-neutral-800 text-[16px] font-semibold text-neutral-100 transition-colors hover:border-neutral-500"
            >
              No, it isn't
              <kbd className="ml-2 hidden rounded border border-neutral-700 px-1 font-mono text-[11px] text-muted sm:inline">N</kbd>
            </button>
            <button
              type="button"
              onClick={() => answer(true)}
              className="h-14 rounded-2xl border border-neutral-800 text-[16px] font-semibold text-neutral-100 transition-colors hover:border-neutral-500"
            >
              Yes, it is
              <kbd className="ml-2 hidden rounded border border-neutral-700 px-1 font-mono text-[11px] text-muted sm:inline">Y</kbd>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="told"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-4 rounded-2xl border p-4 ${right ? 'border-up/30 bg-up/[0.06]' : 'border-down/30 bg-down/[0.05]'}`}
            aria-live="polite"
          >
            <p className={`text-[16px] font-semibold ${right ? 'text-up' : 'text-down'}`}>
              {right ? 'Right. ' : 'Not quite. '}
              <span className="text-neutral-100">
                {r.is
                  ? `It is ${article(name)} ${name}.`
                  : r.kind === 'lookAlike' && shows
                    ? `It's ${article(shows.name)} ${shows.name.toLowerCase()}.`
                    : `It isn't ${article(name)} ${name}.`}
              </span>
            </p>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-soft">{r.is ? entry.meaning : why(r.note)}</p>
            <button
              type="button"
              onClick={next}
              className="mt-3 flex h-11 items-center gap-2 rounded-xl bg-up px-5 text-[15px] font-semibold text-black hover:bg-[#5fe6ab]"
            >
              {last ? 'See your score' : 'Next'}
              <kbd className="hidden rounded border border-black/20 px-1 font-mono text-[11px] font-medium lg:inline">Enter</kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

// The reason part of a note ("It's a hanging man, not a hammer. A hammer-shaped
// candle after a rise..." -> "A hammer-shaped candle after a rise..."): the
// heading above it already names the pattern.
function why(note: string) {
  const rest = note.replace(/^It's an? [^:.]+[:.] ?/, '')
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}
