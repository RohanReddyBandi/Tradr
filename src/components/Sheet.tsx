import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'

interface Props {
  title: ReactNode
  onClose: () => void
  children: ReactNode
}

// A panel over the page: it slides up from the bottom on phones and sits in
// the middle on desktop. Escape or a tap outside closes it.
export function Sheet({ title, onClose, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  // The latest onClose, so the effect below runs once rather than on every render.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    // Capture phase, and stopped there, so the page's own Escape (like
    // "back to the card") doesn't fire as well.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      previous?.focus?.()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6">
      <motion.div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        aria-hidden="true"
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative flex max-h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-edge bg-card outline-none lg:max-h-[80vh] lg:rounded-3xl"
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-edge px-5 pt-4 pb-3">
          <div className="min-w-0 pt-1.5">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-soft transition-colors hover:bg-neutral-900 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </motion.div>
    </div>
  )
}
