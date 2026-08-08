/**
 * Deterministic pseudo-randomness.
 *
 * Anything that must agree across devices — "today's run is Rush Hour for
 * everyone" — has to come from a seeded stream rather than `Math.random`,
 * which is why this exists separately from the helpers in `math.ts`.
 */

/** Mulberry32: small, fast, and good enough for picking from a table. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-style string hash, stable across platforms and app versions. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic pick from a table for a given seed string. */
export function pickSeeded<T>(items: readonly T[], seed: string): T {
  const roll = mulberry32(hashString(seed))();
  return items[Math.floor(roll * items.length) % items.length];
}
