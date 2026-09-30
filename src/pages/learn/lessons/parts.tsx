import type { ReactNode } from 'react'

// Small pieces the lesson widgets share.

export interface LessonProps {
  done: boolean
  onDone: () => void
}

// The lesson's goals as chips that tick themselves off.
export function Goals({ goals }: { goals: { label: string; met: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Goals">
      {goals.map((g) => (
        <li
          key={g.label}
          className={`flex min-h-9 items-center gap-2 rounded-full border px-3 text-[13.5px] transition-colors ${
            g.met ? 'border-up/40 bg-up/10 text-up' : 'border-neutral-800 text-soft'
          }`}
        >
          <span
            aria-hidden="true"
            className={`grid size-4 place-items-center rounded-full border text-[10px] leading-none ${g.met ? 'border-up bg-up text-black' : 'border-neutral-600'}`}
          >
            {g.met ? '✓' : ''}
          </span>
          {g.label}
          <span className="sr-only">{g.met ? '(done)' : '(not yet)'}</span>
        </li>
      ))}
    </ul>
  )
}

// A framed area for the widget itself.
export function Stage({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl border border-edge bg-card p-3 sm:p-4">{children}</div>
}

// Feedback under a widget: green when you got it, amber for a nudge, grey otherwise.
export function Note({ tone = 'plain', children }: { tone?: 'good' | 'nudge' | 'plain'; children: ReactNode }) {
  const style = { good: 'border-up/30 bg-up/[0.06] text-neutral-100', nudge: 'border-amber/30 bg-amber/[0.06] text-neutral-100', plain: 'border-edge bg-card text-soft' }[tone]
  return (
    <p aria-live="polite" className={`rounded-2xl border px-4 py-3 text-[15px] leading-relaxed ${style}`}>
      {children}
    </p>
  )
}

export function PillButton({ onClick, children, active, disabled }: { onClick: () => void; children: ReactNode; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`h-11 rounded-xl border px-4 text-[15px] font-medium transition-colors disabled:opacity-40 ${
        active ? 'border-neutral-300 bg-neutral-100 text-black' : 'border-neutral-800 text-soft hover:border-neutral-600 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-11 rounded-xl bg-up px-5 text-[15px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]">
      {children}
    </button>
  )
}
