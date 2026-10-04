import type { Bias } from '../types'
import type { LibraryEntry } from '../lib/library'

const DOT: Record<Bias, string> = { bullish: 'bg-up', bearish: 'bg-down', neutral: 'bg-neutral-500' }

interface Props {
  entries: LibraryEntry[]
  groups: string[] // the order to list them in
  selected?: string | null // key of the chosen pattern
  done?: string[] // keys to tick (built or drawn already)
  onPick: (key: string) => void
}

// Patterns as tappable chips, grouped ("One candle", "Reversals", ...). The
// dot shows which way each one leans: green bullish, red bearish, grey neutral.
export function PatternPicker({ entries, groups, selected, done = [], onPick }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const inGroup = entries.filter((e) => e.group === group)
        if (inGroup.length === 0) return null
        return (
          <div key={group}>
            <h3 className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">{group}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {inGroup.map((e) => {
                const isSelected = selected === e.key
                return (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => onPick(e.key)}
                    aria-pressed={isSelected}
                    className={`flex min-h-10 items-center gap-2 rounded-full border px-3 text-[14px] transition-colors ${
                      isSelected ? 'border-neutral-300 bg-neutral-100 text-black' : 'border-neutral-800 text-neutral-200 hover:border-neutral-600'
                    }`}
                  >
                    <span className={`size-2 shrink-0 rounded-full ${DOT[e.bias]}`} aria-hidden="true" />
                    {e.name}
                    {done.includes(e.key) && (
                      <span className={isSelected ? 'text-black' : 'text-up'} aria-label="done">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
