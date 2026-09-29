// A seeded random number generator. The same seed always gives the same
// sequence, so a chart can be rebuilt exactly from its seed (handy for tests).
// This is "mulberry32", a tiny, well-known generator.
export function makeRng(seed: number) {
  let state = seed >>> 0
  function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 // 0 <= n < 1
  }

  return {
    next,
    // A number between min and max.
    range: (min: number, max: number) => min + next() * (max - min),
    // A whole number from min to max, inclusive.
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    // true with the given probability (0 to 1).
    chance: (probability: number) => next() < probability,
    // A random item from a list.
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    // Roughly bell-curve shaped noise around 0 (sum of uniforms).
    noise: () => next() + next() + next() - 1.5,
  }
}

export type Rng = ReturnType<typeof makeRng>
