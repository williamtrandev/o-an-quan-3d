/** Element `i` of a non-empty list, failing loudly instead of returning undefined. */
export const pick = <T>(list: readonly T[], i: number): T => {
  const value = list[i];
  if (value === undefined) throw new Error(`index ${i} out of range (${list.length})`);
  return value;
};

/** A random element of a non-empty list. */
export const pickRandom = <T>(list: readonly T[], random: () => number = Math.random): T =>
  pick(list, Math.min(list.length - 1, Math.floor(random() * list.length)));

/** 2D context of a fresh canvas, for procedural textures. */
export const canvas2d = (width: number, height = width) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas unavailable');
  return { canvas, g: context };
};
