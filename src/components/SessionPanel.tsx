import type { Review } from '../game/useGame'
import { GRADE_LABEL, isGoodGrade } from '../lib/analyze'
import { formatSignedMoney } from '../format'

const DECISION_LABEL = { buy: 'Bought', sell: 'Sold', skip: 'Skipped' }

interface Props {
  history: Review[] // newest first
  sessionPnl: number
}

// Desktop sidebar next to the card: every call so far, and how it was graded.
export function SessionPanel({ history, sessionPnl }: Props) {
  const goodReads = history.filter((r) => isGoodGrade(r.breakdown.grade)).length

  return (
    <aside className="flex min-h-0 flex-1 flex-col rounded-3xl border border-edge bg-card">
      <div className="px-5 pt-5">
        <h2 className="text-[11px] tracking-[0.08em] text-muted uppercase">This session</h2>
        <div className="mt-3 flex gap-8">
          <div>
            <div className="font-mono text-2xl leading-none">{history.length ? `${goodReads}/${history.length}` : '0'}</div>
            <div className="mt-1.5 text-xs text-muted">good reads</div>
          </div>
          <div>
            <div className={`font-mono text-2xl leading-none ${sessionPnl > 0 ? 'text-up' : sessionPnl < 0 ? 'text-down' : ''}`}>
              {formatSignedMoney(sessionPnl)}
            </div>
            <div className="mt-1.5 text-xs text-muted">profit and loss</div>
          </div>
        </div>
      </div>

      <ol className="mt-5 min-h-0 flex-1 overflow-y-auto border-t border-edge">
        {history.length === 0 && (
          <li className="px-5 py-5 text-sm leading-relaxed text-muted">
            Each call you make shows up here with its grade. Read the chart on the left, then swipe or use the arrow keys.
          </li>
        )}
        {history.map(({ card, breakdown: b }) => (
          <li key={card.id} className="flex items-start justify-between gap-3 border-b border-edge px-5 py-3.5">
            <div className="min-w-0">
              <div className="truncate text-sm text-neutral-200">
                Card {card.number} · {card.setup.name}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {DECISION_LABEL[b.decision]} ·{' '}
                <span className={isGoodGrade(b.grade) ? 'text-up' : 'text-amber'}>{GRADE_LABEL[b.grade]}</span>
              </div>
            </div>
            <div className={`shrink-0 font-mono text-sm ${b.pnl > 0 ? 'text-up' : b.pnl < 0 ? 'text-down' : 'text-muted'}`}>
              {b.decision === 'skip' ? '—' : formatSignedMoney(b.pnl)}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-4 px-5 py-4 text-xs text-muted">
        <Key>←</Key> Sell
        <Key>↑</Key> Skip
        <Key>→</Key> Buy
      </div>
    </aside>
  )
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="-mr-2 inline-flex size-6 items-center justify-center rounded-md border border-neutral-700 font-mono text-[12px] text-soft">
      {children}
    </kbd>
  )
}
