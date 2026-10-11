/** Deterministic pseudo-random number in [0, 1) for an integer seed. */
export const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

/** Seeded generator, so procedural scenery is laid out the same way on every render. */
export const seededRandom = (seed: number) => {
  let i = seed;
  return () => hash((i += 1));
};
