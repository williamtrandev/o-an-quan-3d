/**
 * Ô ăn quan rules (the common variant).
 *
 * The board is a ring of 12 cells. Cell 0 is the left quan (mandarin) cell, 1–5 are the
 * south player's dân (citizen) cells from left to right, 6 is the right quan cell and
 * 7–11 are the north player's cells from right to left. Stepping +1 goes anticlockwise
 * seen from above with south nearest the viewer.
 *
 * A turn: pick one of your non-empty cells and a direction, take all its stones and sow
 * one per cell. After the last stone:
 *  - next cell is a quan cell holding anything → the turn ends;
 *  - next cell holds stones → take them and keep sowing;
 *  - next cell is empty and the one after holds something → capture it, and keep
 *    capturing every second cell while the gaps stay empty (ăn dây);
 *  - two empty cells in a row → the turn ends.
 * A player whose five cells are all empty must put one stone back in each from their
 * captures, borrowing from the opponent when short. The game ends when both quan cells
 * are empty; each side then keeps the stones left on its own cells.
 */

export type Side = 'south' | 'north';
export type Direction = 1 | -1;

export const CELLS = 12;
export const QUAN_CELLS = [0, 6] as const;
/** Points for the big quan stone. */
export const QUAN_VALUE = 10;
export const STONES_PER_CELL = 5;
/** Safety net against pathological endless sowing. */
const MAX_PICKUPS = 400;

export interface Pile {
  stones: number;
  quan: number;
}

export interface GameState {
  /** Small stones in each cell. */
  cells: number[];
  /** Whether the big quan stone is still on cell 0 / cell 6. */
  quan: [boolean, boolean];
  captured: Record<Side, Pile>;
  /** Stones each side borrowed from the other to refill its cells. */
  debt: Record<Side, number>;
  turn: Side;
  over: boolean;
}

export interface Move {
  cell: number;
  dir: Direction;
}

/** Everything that happens during a move, in order, so the scene can animate it. */
export type GameEvent =
  | { type: 'pickup'; cell: number; count: number }
  | { type: 'drop'; cell: number }
  | { type: 'capture'; cell: number; stones: number; quan: number; side: Side }
  | { type: 'refill'; side: Side; cells: number[]; borrowed: number }
  | { type: 'sweep'; side: Side; cells: number[]; stones: number }
  | { type: 'end'; reason: 'quan' | 'empty' | 'stalled' };

export const opponent = (side: Side): Side => (side === 'south' ? 'north' : 'south');
export const isQuanCell = (cell: number): boolean => cell === 0 || cell === 6;
export const ownedCells = (side: Side): number[] =>
  side === 'south' ? [1, 2, 3, 4, 5] : [7, 8, 9, 10, 11];
export const ownerOf = (cell: number): Side | null =>
  isQuanCell(cell) ? null : cell < 6 ? 'south' : 'north';
export const step = (cell: number, dir: Direction): number => (cell + dir + CELLS) % CELLS;
const quanIndex = (cell: number): 0 | 1 => (cell === 0 ? 0 : 1);

export const initialState = (first: Side = 'south'): GameState => ({
  cells: Array.from({ length: CELLS }, (_, i) => (isQuanCell(i) ? 0 : STONES_PER_CELL)),
  quan: [true, true],
  captured: { south: { stones: 0, quan: 0 }, north: { stones: 0, quan: 0 } },
  debt: { south: 0, north: 0 },
  turn: first,
  over: false,
});

export const cloneState = (s: GameState): GameState => ({
  cells: [...s.cells],
  quan: [s.quan[0], s.quan[1]],
  captured: { south: { ...s.captured.south }, north: { ...s.captured.north } },
  debt: { ...s.debt },
  turn: s.turn,
  over: s.over,
});

/** Whether a cell holds nothing at all (no small stones, no quan). */
export const isEmpty = (s: GameState, cell: number): boolean =>
  s.cells[cell] === 0 && !(isQuanCell(cell) && s.quan[quanIndex(cell)]);

export const legalMoves = (s: GameState): Move[] => {
  if (s.over) return [];
  const moves: Move[] = [];
  for (const cell of ownedCells(s.turn)) {
    if ((s.cells[cell] ?? 0) > 0) moves.push({ cell, dir: 1 }, { cell, dir: -1 });
  }
  return moves;
};

export const isLegal = (s: GameState, move: Move): boolean =>
  !s.over &&
  ownerOf(move.cell) === s.turn &&
  (s.cells[move.cell] ?? 0) > 0 &&
  Math.abs(move.dir) === 1;

/** Points a side has banked: captured stones, quan, and the borrowing balance. */
export const score = (s: GameState, side: Side): number =>
  s.captured[side].stones +
  s.captured[side].quan * QUAN_VALUE -
  s.debt[side] +
  s.debt[opponent(side)];

const capture = (s: GameState, cell: number, side: Side, events: GameEvent[]) => {
  const stones = s.cells[cell] ?? 0;
  let quan = 0;
  if (isQuanCell(cell) && s.quan[quanIndex(cell)]) {
    s.quan[quanIndex(cell)] = false;
    quan = 1;
  }
  s.cells[cell] = 0;
  s.captured[side].stones += stones;
  s.captured[side].quan += quan;
  events.push({ type: 'capture', cell, stones, quan, side });
};

const quanGone = (s: GameState) => QUAN_CELLS.every((c) => isEmpty(s, c));

/** The game is over: each side keeps what is left on its own cells. */
const finish = (s: GameState, reason: 'quan' | 'empty', events: GameEvent[]) => {
  for (const side of ['south', 'north'] as const) {
    const cells = ownedCells(side).filter((c) => (s.cells[c] ?? 0) > 0);
    const stones = cells.reduce((sum, c) => sum + (s.cells[c] ?? 0), 0);
    for (const c of cells) s.cells[c] = 0;
    s.captured[side].stones += stones;
    if (cells.length) events.push({ type: 'sweep', side, cells, stones });
  }
  s.over = true;
  events.push({ type: 'end', reason });
};

/**
 * Hand the turn to `side`, refilling its cells first if they are all empty. Ends the game
 * when the quan are gone or the side cannot refill even by borrowing.
 */
const beginTurn = (s: GameState, side: Side, events: GameEvent[]) => {
  s.turn = side;
  if (quanGone(s)) return finish(s, 'quan', events);
  const own = ownedCells(side);
  if (own.some((c) => (s.cells[c] ?? 0) > 0)) return;
  const have = s.captured[side].stones;
  const lend = s.captured[opponent(side)].stones;
  if (have + lend < own.length) return finish(s, 'empty', events);
  const fromOwn = Math.min(have, own.length);
  const borrowed = own.length - fromOwn;
  s.captured[side].stones -= fromOwn;
  s.captured[opponent(side)].stones -= borrowed;
  s.debt[side] += borrowed;
  for (const c of own) s.cells[c] = 1;
  events.push({ type: 'refill', side, cells: own, borrowed });
};

/** Play a move; returns the next state and the events to animate. Throws if illegal. */
export const applyMove = (
  state: GameState,
  move: Move,
): { state: GameState; events: GameEvent[] } => {
  if (!isLegal(state, move)) throw new Error(`illegal move ${move.cell}/${move.dir}`);
  const s = cloneState(state);
  const events: GameEvent[] = [];
  const mover = s.turn;

  let pos = move.cell;
  let hand = s.cells[pos] ?? 0;
  s.cells[pos] = 0;
  events.push({ type: 'pickup', cell: pos, count: hand });

  for (let pickups = 0; ; pickups++) {
    while (hand > 0) {
      pos = step(pos, move.dir);
      s.cells[pos] = (s.cells[pos] ?? 0) + 1;
      hand--;
      events.push({ type: 'drop', cell: pos });
    }
    const next = step(pos, move.dir);
    if (isQuanCell(next) && !isEmpty(s, next)) break;
    if (!isEmpty(s, next)) {
      if (pickups >= MAX_PICKUPS) {
        events.push({ type: 'end', reason: 'stalled' });
        break;
      }
      pos = next;
      hand = s.cells[pos] ?? 0;
      s.cells[pos] = 0;
      events.push({ type: 'pickup', cell: pos, count: hand });
      continue;
    }
    // `next` is empty: capture the cell after it, then every second cell across empty gaps.
    let target = step(next, move.dir);
    while (!isEmpty(s, target)) {
      capture(s, target, mover, events);
      const gap = step(target, move.dir);
      if (!isEmpty(s, gap)) break;
      target = step(gap, move.dir);
    }
    break;
  }

  beginTurn(s, opponent(mover), events);
  return { state: s, events };
};

/** Stones and quan still on the board plus everything captured (for invariant checks). */
export const totalValue = (s: GameState): number =>
  s.cells.reduce((a, b) => a + b, 0) +
  (s.quan[0] ? QUAN_VALUE : 0) +
  (s.quan[1] ? QUAN_VALUE : 0) +
  s.captured.south.stones +
  s.captured.north.stones +
  (s.captured.south.quan + s.captured.north.quan) * QUAN_VALUE;

export const winner = (s: GameState): Side | 'draw' | null => {
  if (!s.over) return null;
  const a = score(s, 'south');
  const b = score(s, 'north');
  return a === b ? 'draw' : a > b ? 'south' : 'north';
};
