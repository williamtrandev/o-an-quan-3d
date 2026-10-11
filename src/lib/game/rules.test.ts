import { describe, expect, it } from 'vitest';
import { pickRandom } from '../util';
import {
  applyMove,
  initialState,
  isLegal,
  legalMoves,
  score,
  totalValue,
  winner,
  type GameState,
} from './rules';

/** A state with the given small-stone layout (12 numbers) and options. */
const board = (cells: number[], extra: Partial<GameState> = {}): GameState => ({
  ...initialState(),
  cells,
  ...extra,
});

describe('initial position', () => {
  it('has five stones on every citizen cell and two quan', () => {
    const s = initialState();
    expect(s.cells).toEqual([0, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5]);
    expect(s.quan).toEqual([true, true]);
    expect(totalValue(s)).toBe(70);
  });

  it('lets south play any of its five cells in both directions', () => {
    const moves = legalMoves(initialState());
    expect(moves).toHaveLength(10);
    expect(moves.every((m) => m.cell >= 1 && m.cell <= 5)).toBe(true);
  });

  it('rejects the opponent cells, empty cells and quan cells', () => {
    const s = initialState();
    expect(isLegal(s, { cell: 7, dir: 1 })).toBe(false);
    expect(isLegal(s, { cell: 0, dir: 1 })).toBe(false);
    expect(isLegal(board([0, 0, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5]), { cell: 1, dir: 1 })).toBe(false);
    expect(() => applyMove(s, { cell: 8, dir: 1 })).toThrow();
  });
});

describe('sowing', () => {
  it('drops one stone per cell and stops before a quan', () => {
    // Cell 4 has 1 stone: drops on 5; the next cell is the right quan → turn ends.
    const s = board([0, 0, 0, 0, 1, 0, 0, 5, 5, 5, 5, 5]);
    const { state, events } = applyMove(s, { cell: 4, dir: 1 });
    expect(state.cells.slice(0, 7)).toEqual([0, 0, 0, 0, 0, 1, 0]);
    expect(events.filter((e) => e.type === 'drop')).toHaveLength(1);
    expect(state.turn).toBe('north');
  });

  it('picks up the next cell and keeps sowing', () => {
    // 2 → drops on 3, 4; next (5) has 2 → pick it up, drop on quan 6 and on 7;
    // then 8 and 9 are empty → the turn ends.
    const s = board([0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 0]);
    const { events } = applyMove(s, { cell: 2, dir: 1 });
    const pickups = events.filter((e) => e.type === 'pickup').map((e) => e.cell);
    expect(pickups.slice(0, 2)).toEqual([2, 5]);
  });

  it('sows into quan cells and wraps around the ring', () => {
    const s = board([0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    // Anticlockwise from 1: -1 → 0 (quan), 11, 10.
    const { state } = applyMove(s, { cell: 1, dir: -1 });
    expect(state.cells[0]).toBe(1);
    expect(state.cells[11]).toBe(2);
  });
});

describe('capturing', () => {
  it('captures the cell after an empty one', () => {
    // 1 stone on 2 → drops on 3; 4 is empty; 5 has 3 stones → captured.
    const s = board([0, 0, 1, 0, 0, 3, 0, 5, 5, 5, 5, 5]);
    const { state, events } = applyMove(s, { cell: 2, dir: 1 });
    expect(state.cells[5]).toBe(0);
    expect(state.captured.south.stones).toBe(3);
    expect(events.some((e) => e.type === 'capture' && e.cell === 5)).toBe(true);
  });

  it('captures a quan with the stones on it', () => {
    // 1 stone on 3 → drops on 4; 5 is empty; 6 (the right quan, with 2 stones) is taken.
    const s = board([0, 0, 0, 1, 0, 0, 2, 5, 5, 5, 5, 5]);
    const { state } = applyMove(s, { cell: 3, dir: 1 });
    expect(state.quan[1]).toBe(false);
    expect(state.cells[6]).toBe(0);
    expect(state.captured.south).toEqual({ stones: 2, quan: 1 });
    expect(score(state, 'south')).toBe(12);
  });

  it('chains captures across empty gaps (ăn dây)', () => {
    // From 1 (1 stone) → 2; 3 empty → capture 4; 5 empty → capture 6 (quan).
    const s = board([0, 1, 0, 0, 2, 0, 0, 5, 5, 5, 5, 5]);
    const { state, events } = applyMove(s, { cell: 1, dir: 1 });
    const captured = events.filter((e) => e.type === 'capture').map((e) => e.cell);
    expect(captured).toEqual([4, 6]);
    expect(state.captured.south).toEqual({ stones: 2, quan: 1 });
  });

  it('ends the turn on two empty cells in a row', () => {
    const s = board([0, 1, 0, 0, 0, 2, 0, 5, 5, 5, 5, 5]);
    const { state, events } = applyMove(s, { cell: 1, dir: 1 });
    expect(events.some((e) => e.type === 'capture')).toBe(false);
    expect(state.cells[5]).toBe(2);
  });

  it('treats an emptied quan cell like any empty cell', () => {
    // Right quan gone and empty: 4 (1 stone) → drops on 5; 6 is empty → capture 7.
    const s = board([0, 0, 0, 0, 1, 0, 0, 4, 5, 5, 5, 5], { quan: [true, false] });
    const { state } = applyMove(s, { cell: 4, dir: 1 });
    expect(state.cells[7]).toBe(0);
    expect(state.captured.south.stones).toBe(4);
  });
});

describe('refilling and the end of the game', () => {
  it('refills an empty side from its captures', () => {
    // North has no stones on its cells: after south's move north must refill.
    const s = board([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], {
      captured: { south: { stones: 0, quan: 0 }, north: { stones: 7, quan: 0 } },
    });
    const { state, events } = applyMove(s, { cell: 4, dir: 1 });
    expect(state.cells.slice(7)).toEqual([1, 1, 1, 1, 1]);
    expect(state.captured.north.stones).toBe(2);
    expect(events.at(-1)).toMatchObject({ type: 'refill', side: 'north', borrowed: 0 });
  });

  it('borrows from the opponent when short, and settles the debt in the score', () => {
    const s = board([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], {
      captured: { south: { stones: 10, quan: 0 }, north: { stones: 2, quan: 0 } },
    });
    const { state } = applyMove(s, { cell: 4, dir: 1 });
    expect(state.debt.north).toBe(3);
    expect(state.captured.south.stones).toBe(7);
    expect(score(state, 'south')).toBe(10);
    expect(score(state, 'north')).toBe(-3);
  });

  it('ends when both quan are gone; each side keeps its own stones', () => {
    // Capturing the right quan while the left one is already gone ends the game.
    const s = board([0, 0, 0, 1, 0, 0, 0, 2, 3, 0, 0, 0], {
      quan: [false, true],
    });
    const { state, events } = applyMove(s, { cell: 3, dir: 1 });
    expect(state.over).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'end', reason: 'quan' });
    expect(state.captured.north.stones).toBe(5);
    // South: the quan (10) + the stone left on cell 4; north: 5 stones.
    expect(score(state, 'south')).toBe(11);
    expect(winner(state)).toBe('south');
    expect(legalMoves(state)).toEqual([]);
  });

  it('keeps the total value constant over random games', () => {
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let game = 0; game < 200; game++) {
      let s = initialState(game % 2 ? 'north' : 'south');
      for (let ply = 0; ply < 400 && !s.over; ply++) {
        const moves = legalMoves(s);
        expect(moves.length).toBeGreaterThan(0);
        s = applyMove(s, pickRandom(moves, rand)).state;
        expect(totalValue(s)).toBe(70);
        expect(s.cells.every((n) => n >= 0)).toBe(true);
      }
      if (s.over) expect(score(s, 'south') + score(s, 'north')).toBe(70);
    }
  });
});
