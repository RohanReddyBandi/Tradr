import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
}

// Placeholder for the Learn and Stats tabs until Phase 6.
export function ComingSoonPage({ title, children }: Props) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col px-6 pt-6 lg:pt-12">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
      <div className="mt-6 rounded-3xl border border-edge bg-card p-5 text-[15px] leading-relaxed text-neutral-400">
        {children}
      </div>
    </div>
  )
}
