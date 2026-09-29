import type { Difficulty } from '../types'

const LEVEL: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }
const LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

// Three little bars, like a signal meter: one filled for easy, three for hard.
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const level = LEVEL[difficulty]
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.08em] text-soft uppercase">
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`w-[3px] rounded-[1px] ${bar <= level ? (difficulty === 'hard' ? 'bg-amber' : 'bg-soft') : 'bg-neutral-700'}`}
            style={{ height: 4 + bar * 3 }}
          />
        ))}
      </span>
      {LABEL[difficulty]}
      <span className="sr-only"> difficulty</span>
    </span>
  )
}
