import { useEffect, useState } from 'react'
import type { MarkResult } from '../lib/practice'

// Practice progress, saved in the browser separately from the trading game
// (resetting your balance doesn't wipe it). Same try/catch rules as useGame.

export interface PracticeProgress {
  version: 1
  built: string[] // candlestick patterns you've built
  drawn: string[] // chart patterns you've drawn
  mark: { charts: number; found: number; missed: number; wrong: number }
}

const STORAGE_KEY = 'tradr:practice:v1'

const EMPTY: PracticeProgress = { version: 1, built: [], drawn: [], mark: { charts: 0, found: 0, missed: 0, wrong: 0 } }

function load(): PracticeProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as PracticeProgress) : null
    return saved?.version === 1 && Array.isArray(saved.built) && Array.isArray(saved.drawn) && saved.mark ? saved : EMPTY
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
    recordMark: (result: MarkResult) =>
      setProgress((p) => ({
        ...p,
        mark: {
          charts: p.mark.charts + 1,
          found: p.mark.found + result.found.length,
          missed: p.mark.missed + result.missed.length,
          wrong: p.mark.wrong + result.wrong,
        },
      })),
  }
}

export type Practice = ReturnType<typeof usePractice>
