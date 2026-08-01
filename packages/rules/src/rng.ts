/** Mulberry32 seeded RNG for deterministic combat on server */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function d20(rng: () => number): number {
  return 1 + Math.floor(rng() * 20);
}

export function dice(rng: () => number, n: number, sides: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += 1 + Math.floor(rng() * sides);
  return sum;
}

export function rollRange(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
