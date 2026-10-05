import type { ReactNode } from 'react'

// A plain bulleted list for the Learn pages' checklists.
export function Bullets({ points }: { points: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {points.map((point, k) => (
        <li key={k} className="flex gap-3 text-[16px] leading-relaxed text-neutral-100">
          <span aria-hidden="true" className="mt-[10px] size-1.5 shrink-0 rounded-full bg-neutral-500" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  )
}
