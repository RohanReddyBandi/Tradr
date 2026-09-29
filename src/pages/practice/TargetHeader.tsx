interface Props {
  verb: string // "Build" or "Draw"
  name: string
  done: number
  total: number
  picking: boolean
  onChange: () => void
  onRandom: () => void
}

// "Build a Hammer", with buttons to choose another pattern or get a random one,
// and how many you've done so far.
export function TargetHeader({ verb, name, done, total, picking, onChange, onRandom }: Props) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-[20px] leading-snug font-semibold tracking-tight">
          <span className="font-normal text-soft">{verb}: </span>
          {name}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onChange}
            aria-expanded={picking}
            className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft transition-colors hover:border-neutral-600 hover:text-white lg:hidden"
          >
            {picking ? 'Close list' : 'Choose'}
          </button>
          <button
            onClick={onRandom}
            className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft transition-colors hover:border-neutral-600 hover:text-white"
          >
            Random
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-neutral-800" aria-hidden="true">
          <div className="h-full rounded-full bg-up" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span className="font-mono text-[12px] text-muted">
          {done}/{total} done
        </span>
      </div>
    </div>
  )
}
