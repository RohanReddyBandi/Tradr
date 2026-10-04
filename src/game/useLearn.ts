import { useEffect, useState } from 'react'
import { SCENARIO_MASTERY } from '../lib/scenarios'

// Learn tab progress (pattern mastery and scenarios), saved in the browser
// separately from the game. Same try/catch rules as useGame.

export interface LearnProgress {
  version: 1
  // Scenario practice on each pattern's page: your best average score (0 to 1) over a run, and how many runs.
  scenarios: Record<string, { best: number; runs: number }>
  mixed: { played: number; points: number } // mixed scenarios: how many, and the total of their scores
}

const STORAGE_KEY = 'tradr:learn:v1'

const EMPTY: LearnProgress = { version: 1, scenarios: {}, mixed: { played: 0, points: 0 } }

function load(): LearnProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as LearnProgress) : null
    // Saves from before scenarios existed simply start with none.
    return saved?.version === 1 ? { version: 1, scenarios: saved.scenarios ?? {}, mixed: saved.mixed ?? { played: 0, points: 0 } } : EMPTY
  } catch {
    return EMPTY
  }
}

// Patterns you've mastered: a run of scenarios averaging at least SCENARIO_MASTERY.
export const masteredKeys = (progress: LearnProgress) =>
  Object.entries(progress.scenarios)
    .filter(([, d]) => d.best >= SCENARIO_MASTERY)
    .map(([key]) => key)

export function useLearn() {
  const [progress, setProgress] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
      // Storage is full or blocked: keep learning, just without saving.
    }
  }, [progress])

  return {
    progress,
    recordRun: (key: string, average: number) =>
      setProgress((p) => {
        const before = p.scenarios[key] ?? { best: 0, runs: 0 }
        return { ...p, scenarios: { ...p.scenarios, [key]: { best: Math.max(before.best, average), runs: before.runs + 1 } } }
      }),
    recordMixed: (score: number) => setProgress((p) => ({ ...p, mixed: { played: p.mixed.played + 1, points: p.mixed.points + score } })),
  }
}

export type Learn = ReturnType<typeof useLearn>
