import { useEffect, useState } from 'react'
import { MASTERED } from '../lib/patternStudy'

// Learn tab progress (lessons finished, quiz score), saved in the browser
// separately from the game, like Practice progress. Same try/catch rules.

export interface LearnProgress {
  version: 1
  lessons: string[] // ids of the lessons you've finished
  quiz: { answered: number; correct: number; best: number } // best: longest streak of right answers
  // "Is it or isn't it?" drills, per pattern: your best score out of DRILL_ROUNDS, and how many you've done.
  drills: Record<string, { best: number; runs: number }>
}

const STORAGE_KEY = 'tradr:learn:v1'

const EMPTY: LearnProgress = { version: 1, lessons: [], quiz: { answered: 0, correct: 0, best: 0 }, drills: {} }

function load(): LearnProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as LearnProgress) : null
    // Saves from before the drills existed simply start with none.
    return saved?.version === 1 && Array.isArray(saved.lessons) && saved.quiz ? { ...saved, drills: saved.drills ?? {} } : EMPTY
  } catch {
    return EMPTY
  }
}

// Patterns you've mastered: a drill run with at least MASTERED right.
export const masteredKeys = (progress: LearnProgress) =>
  Object.entries(progress.drills)
    .filter(([, d]) => d.best >= MASTERED)
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
    finishLesson: (id: string) => setProgress((p) => (p.lessons.includes(id) ? p : { ...p, lessons: [...p.lessons, id] })),
    // `streak` is your run of right answers including this one (0 after a wrong one).
    recordAnswer: (correct: boolean, streak: number) =>
      setProgress((p) => ({
        ...p,
        quiz: { answered: p.quiz.answered + 1, correct: p.quiz.correct + (correct ? 1 : 0), best: Math.max(p.quiz.best, streak) },
      })),
    recordDrill: (key: string, score: number) =>
      setProgress((p) => {
        const before = p.drills[key] ?? { best: 0, runs: 0 }
        return { ...p, drills: { ...p.drills, [key]: { best: Math.max(before.best, score), runs: before.runs + 1 } } }
      }),
  }
}

export type Learn = ReturnType<typeof useLearn>
