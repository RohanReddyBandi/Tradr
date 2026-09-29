import { GRADE_LABEL, isGoodGrade } from '../lib/analyze'
import type { TradeRecord } from '../lib/stats'
import { formatR, formatSignedMoney } from '../format'

const DECISION_LABEL = { buy: 'Bought', sell: 'Sold', skip: 'Skipped' }

interface Props {
  history: TradeRecord[] // newest first
  totalPnl: number
}

// Desktop sidebar next to the card: your recent calls and how each was graded.
export function SessionPanel({ history, totalPnl }: Props) {
  const goodReads = history.filter((r) => isGoodGrade(r.grade)).length

  return (
    <aside className="flex min-h-0 flex-1 flex-col rounded-3xl border border-edge bg-card">
      <div className="px-5 pt-5">
        <h2 className="text-[11px] tracking-[0.08em] text-muted uppercase">Your calls</h2>
        <div className="mt-3 flex gap-8">
          <div>
            <div className="font-mono text-2xl leading-none">{history.length ? `${goodReads}/${history.length}` : '0'}</div>
            <div className="mt-1.5 text-xs text-muted">good reads</div>
          </div>
          <div>
            <div className={`font-mono text-2xl leading-none ${totalPnl > 0 ? 'text-up' : totalPnl < 0 ? 'text-down' : ''}`}>
              {formatSignedMoney(totalPnl)}
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
        {history.slice(0, 50).map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 border-b border-edge px-5 py-3.5">
            <div className="min-w-0">
              <div className="truncate text-sm text-neutral-200">
                Card {r.cardNumber} · {r.setupName}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                <span className="capitalize">{r.difficulty}</span> · {DECISION_LABEL[r.decision]} ·{' '}
                <span className={isGoodGrade(r.grade) ? 'text-up' : 'text-amber'}>{GRADE_LABEL[r.grade]}</span>
              </div>
            </div>
            <div className="shrink-0 text-right font-mono">
              <div className={`text-sm ${r.pnl > 0 ? 'text-up' : r.pnl < 0 ? 'text-down' : 'text-muted'}`}>
                {r.r === null ? '—' : formatSignedMoney(r.pnl)}
              </div>
              {r.r !== null && <div className="mt-0.5 text-xs text-muted">{formatR(r.r)}</div>}
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
