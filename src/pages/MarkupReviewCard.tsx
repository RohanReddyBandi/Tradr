import type { ReactNode } from 'react'
import type { MarkupReview } from '../lib/userMarkup'

interface Props {
  review: MarkupReview
  onFocus: (drawing: number | null) => void // highlight one of your drawings on the chart
  onLearn: (patternName: string) => void
}

type Verdict = 'right' | 'close' | 'wrong'
const VERDICT: Record<Verdict, { mark: string; label: string; tone: string }> = {
  right: { mark: '✓', label: 'Right', tone: 'text-up' },
  close: { mark: '≈', label: 'Close', tone: 'text-amber' },
  wrong: { mark: '✗', label: 'Wrong', tone: 'text-down' },
}

// "Your markup": each thing you drew or named on the setup chart, with a tick
// or a cross and a sentence on why. Hovering a row highlights it on the chart.
export function MarkupReviewCard({ review, onFocus, onLearn }: Props) {
  const { pattern, lines, candles, missedSignals, right, total } = review
  const share = total ? right / total : 0
  return (
    <div className="rounded-2xl border border-pen/25 bg-pen/[0.05] px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] tracking-[0.08em] text-muted uppercase">Your markup</span>
        <span className="font-mono text-[13px] text-soft">
          <span className={`text-[22px] leading-none font-medium tabular-nums ${share >= 0.7 ? 'text-up' : share >= 0.4 ? 'text-amber' : 'text-down'}`}>
            {right}/{total}
          </span>{' '}
          right
        </span>
      </div>

      <ul className="mt-2 divide-y divide-pen/15">
        {pattern && (
          <Row
            verdict={pattern.verdict}
            title={
              <>
                <span className="text-muted">Pattern</span> <span className="text-neutral-100">{pattern.name}</span>
              </>
            }
          >
            {pattern.verdict === 'right'
              ? pattern.answer && pattern.answer.toLowerCase() !== pattern.name.toLowerCase()
                ? `The chart was built as a ${pattern.answer.toLowerCase()}, and the scanner sees your ${pattern.name.toLowerCase()} in it too.`
                : 'That was the pattern on this chart.'
              : pattern.verdict === 'close'
                ? `It was a ${pattern.answer!.toLowerCase()}: the same kind of pattern, but not quite this one.`
                : pattern.answer
                  ? `It was a ${pattern.answer.toLowerCase()}.`
                  : `The scanner doesn't see a ${pattern.name.toLowerCase()} here.`}
            {pattern.verdict !== 'right' && pattern.answer && (
              <button
                onClick={() => onLearn(pattern.answer!)}
                className="ml-1.5 text-muted underline decoration-neutral-700 underline-offset-4 hover:text-white"
              >
                Learn it
              </button>
            )}
          </Row>
        )}

        {lines.map((l) => (
          <Row key={l.drawing} verdict={l.good ? 'right' : 'wrong'} title={<span className="text-neutral-100">{l.title}</span>} onFocus={(on) => onFocus(on ? l.drawing : null)}>
            {l.text}
          </Row>
        ))}

        {candles.map((c) => (
          <Row
            key={c.drawing}
            verdict={c.correct ? 'right' : 'wrong'}
            title={
              <>
                <span className="font-mono text-[12.5px] text-muted">Candle {c.index + 1}</span> <span className="text-neutral-100">{c.name}</span>
              </>
            }
            onFocus={(on) => onFocus(on ? c.drawing : null)}
          >
            {c.correct ? 'The detector sees it there too.' : c.actually ? `It's part of a ${c.actually.toLowerCase()}.` : 'Nothing named forms on that candle.'}
          </Row>
        ))}
      </ul>

      {missedSignals.length > 0 && (
        <p className="mt-2 border-t border-pen/15 pt-2.5 text-[13px] leading-relaxed text-soft">
          <span className="text-marker">Unnamed signal: </span>
          the {missedSignals.map((n) => n.toLowerCase()).join(' and the ')} at the decision point (the yellow box). Of all the candles, that's the one to name first.
        </p>
      )}
    </div>
  )
}

function Row({ verdict, title, children, onFocus }: { verdict: Verdict; title: ReactNode; children: ReactNode; onFocus?: (on: boolean) => void }) {
  const v = VERDICT[verdict]
  return (
    <li className="py-2.5" onMouseEnter={() => onFocus?.(true)} onMouseLeave={() => onFocus?.(false)}>
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="min-w-0">{title}</span>
        <span className={`shrink-0 text-[13px] font-medium ${v.tone}`}>
          <span aria-hidden="true">{v.mark} </span>
          {v.label}
        </span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-soft">{children}</p>
    </li>
  )
}
