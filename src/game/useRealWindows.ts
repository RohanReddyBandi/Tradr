import { useEffect, useState } from 'react'
import { loadRealWindows, loadedRealWindows, type RealWindow } from '../lib/realCards'

// The real charts, loading them if they haven't been yet (null while loading,
// [] when this copy of Tradr has none).
export function useRealWindows() {
  const [windows, setWindows] = useState<RealWindow[] | null>(loadedRealWindows)
  useEffect(() => {
    if (windows !== null) return
    let live = true
    loadRealWindows()
      .then((w) => live && setWindows(w))
      .catch(() => live && setWindows([]))
    return () => {
      live = false
    }
  }, [windows])
  return windows
}
