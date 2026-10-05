import { useEffect, useState } from 'react'
import { isTextList } from './saved'

// The patterns you've built and drawn yourself on their Learn pages, saved in
// the browser separately from the trading game (resetting your balance
// doesn't wipe it). Same try/catch rules as useGame.

export interface PracticeProgress {
  version: 1
  built: string[] // candlestick patterns you've built
  drawn: string[] // chart patterns you've drawn
}

const STORAGE_KEY = 'tradr:practice:v1'

const EMPTY: PracticeProgress = { version: 1, built: [], drawn: [] }

function load(): PracticeProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as Partial<PracticeProgress> | null) : null
    return saved?.version === 1 && isTextList(saved.built) && isTextList(saved.drawn) ? { version: 1, built: saved.built, drawn: saved.drawn } : EMPTY
  } catch {
    return EMPTY
  }
}

export function usePractice() {
  const [progress, setProgress] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
      // Storage is full or blocked: keep practicing, just without saving.
    }
  }, [progress])

  return {
    progress,
    // Returning the same object when nothing changed tells React to skip the update.
    recordBuilt: (key: string) => setProgress((p) => (p.built.includes(key) ? p : { ...p, built: [...p.built, key] })),
    recordDrawn: (key: string) => setProgress((p) => (p.drawn.includes(key) ? p : { ...p, drawn: [...p.drawn, key] })),
  }
}

export type Practice = ReturnType<typeof usePractice>
