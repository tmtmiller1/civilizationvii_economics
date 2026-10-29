// _prng.mjs - seeded generator for the property tests (mulberry32), so a failing case is replayed by its seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gen(seed) {
  const r = mulberry32(seed);
  return {
    next: r,
    int: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
    chance: (p) => r() < p,
    pick: (xs) => xs[Math.floor(r() * xs.length)],
  };
}
