import { isQuanCell, type Side } from './game/rules';

/**
 * World layout of the table, board, pits and stones. South sits at +Z, north at -Z; the
 * board's long axis runs along X with the left quan (cell 0) at -X.
 */

/** Top of the table (matches the seated characters' reach). */
export const TABLE_TOP_Y = -0.41;
export const TABLE_HALF_X = 6.6;
export const TABLE_HALF_Z = 5.3;

/** Side of a square citizen pit. */
export const CELL = 1.5;
/** Radius of the half-disc quan pits. */
export const QUAN_R = 1.5;
export const BOARD_THICKNESS = 0.42;
export const BOARD_TOP_Y = TABLE_TOP_Y + BOARD_THICKNESS;
export const PIT_DEPTH = 0.24;
export const PIT_FLOOR_Y = BOARD_TOP_Y - PIT_DEPTH;
/** Inner size of a square pit (the wood between pits is CELL - PIT). */
export const PIT = 1.22;
/** Rim of wood around the board's pits. */
export const RIM = 0.32;

export const SMALL_STONE_R = 0.11;
export const QUAN_STONE_R = 0.34;

/** Centre of a cell on the board surface, as [x, z]. */
export const cellCenter = (cell: number): [number, number] => {
  if (cell === 0) return [-(2.5 * CELL + QUAN_R * 0.42), 0];
  if (cell === 6) return [2.5 * CELL + QUAN_R * 0.42, 0];
  if (cell < 6) return [(cell - 3) * CELL, CELL / 2];
  return [(9 - cell) * CELL, -CELL / 2];
};

/** Where captured stones go: a basket in front of each player, to their right. */
export const PILE_CENTER: Record<Side, [number, number]> = {
  south: [3.9, 3.35],
  north: [-3.9, -3.35],
};
export const PILE_R = 0.95;

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Points spread evenly inside a unit disc (sunflower pattern). */
const disc = (k: number, n: number): [number, number] => {
  const r = Math.sqrt((k + 0.5) / n);
  const a = k * GOLDEN;
  return [Math.cos(a) * r, Math.sin(a) * r];
};

const PER_LAYER = 10;

/** Small deterministic jitter so piles look natural. */
const jitter = (k: number, salt: number) => {
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 0.06;
};

/**
 * Resting place of the `slot`-th small stone in a cell (1st, 2nd, … in arrival order):
 * spread over the pit floor, then stacked in layers.
 */
export const slotPosition = (cell: number, slot: number): [number, number, number] => {
  const [cx, cz] = cellCenter(cell);
  const layer = Math.floor(slot / PER_LAYER);
  const k = slot % PER_LAYER;
  const [u, v] = disc(k, PER_LAYER);
  const y = PIT_FLOOR_Y + SMALL_STONE_R * 0.9 + layer * SMALL_STONE_R * 1.3;
  if (isQuanCell(cell)) {
    // Around the big stone, in the half disc that opens away from the board.
    const out = cell === 0 ? -1 : 1;
    const a = (k / PER_LAYER) * Math.PI - Math.PI / 2 + layer * 0.3;
    const r = 0.62 + (k % 2) * 0.22;
    return [
      cx + out * Math.cos(a) * r * 0.75 + jitter(slot, 1),
      y,
      cz + Math.sin(a) * r + jitter(slot, 2),
    ];
  }
  const spread = PIT / 2 - SMALL_STONE_R * 1.6;
  return [cx + u * spread + jitter(slot, 1), y, cz + v * spread + jitter(slot, 2)];
};

/** The big quan stone sits in the middle of its pit. */
export const quanPosition = (cell: number): [number, number, number] => {
  const [cx, cz] = cellCenter(cell);
  return [cx, PIT_FLOOR_Y + QUAN_STONE_R * 0.7, cz];
};

/** Stones in a player's basket. Quan stones sit on top in the middle. */
export const pilePosition = (side: Side, slot: number, quan = false): [number, number, number] => {
  const [px, pz] = PILE_CENTER[side];
  const floor = TABLE_TOP_Y + 0.12;
  if (quan) return [px + (slot - 0.5) * 0.5, floor + 0.55, pz];
  const perLayer = 22;
  const layer = Math.floor(slot / perLayer);
  const [u, v] = disc(slot % perLayer, perLayer);
  const r = PILE_R * 0.78 - layer * 0.08;
  return [
    px + u * r + jitter(slot, 3),
    floor + SMALL_STONE_R + layer * SMALL_STONE_R * 1.2,
    pz + v * r + jitter(slot, 4),
  ];
};

/** Height the stones in hand float at while being sown. */
export const HAND_Y = BOARD_TOP_Y + 0.95;

/** Floor of the courtyard. */
export const GROUND_Y = -5.6;
/** Seated players (the chibi characters are modelled at this scale and seat height). */
export const CHARACTER_SCALE = 1.8;
export const SEAT_Y = -2.69;
export const SEAT_Z = 7.6;
