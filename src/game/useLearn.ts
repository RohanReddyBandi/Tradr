import { useEffect, useState } from 'react'

// Learn tab progress (lessons finished, quiz score), saved in the browser
// separately from the game, like Practice progress. Same try/catch rules.

export interface LearnProgress {
  version: 1
  lessons: string[] // ids of the lessons you've finished
  quiz: { answered: number; correct: number; best: number } // best: longest streak of right answers
}

const STORAGE_KEY = 'tradr:learn:v1'

const EMPTY: LearnProgress = { version: 1, lessons: [], quiz: { answered: 0, correct: 0, best: 0 } }

function load(): LearnProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as LearnProgress) : null
    return saved?.version === 1 && Array.isArray(saved.lessons) && saved.quiz ? saved : EMPTY
  } catch {
    return EMPTY
  }
}

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
  }
}

export type Learn = ReturnType<typeof useLearn>
