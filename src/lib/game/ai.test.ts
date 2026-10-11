import { describe, expect, it } from 'vitest';
import { pickRandom } from '../util';
import { chooseMove, evaluate } from './ai';
import { applyMove, initialState, legalMoves, score, type GameState } from './rules';

const board = (cells: number[], extra: Partial<GameState> = {}): GameState => ({
  ...initialState(),
  cells,
  ...extra,
});

describe('ai', () => {
  it('always returns a legal move', () => {
    const s = initialState();
    for (const level of [1, 2, 3, 4] as const) {
      const move = chooseMove(s, level, () => 0.5);
      expect(legalMoves(s)).toContainEqual(move);
    }
  });

  it('takes a quan when it can', () => {
    // South's only stone is on cell 3: either direction reaches a quan across an empty
    // cell; giving the stones to north's side instead would be pointless.
    const s = board([0, 0, 0, 1, 0, 0, 0, 5, 5, 5, 5, 5]);
    const { events } = applyMove(
      s,
      chooseMove(s, 3, () => 0.99),
    );
    expect(events.some((e) => e.type === 'capture' && e.quan === 1)).toBe(true);
  });

  it('prefers positions where it is ahead', () => {
    const ahead = board(initialState().cells, {
      captured: { south: { stones: 5, quan: 0 }, north: { stones: 0, quan: 0 } },
    });
    expect(evaluate(ahead, 'south')).toBeGreaterThan(evaluate(ahead, 'north'));
  });

  it('beats a random player most of the time at the top level', () => {
    let seed = 3;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    let wins = 0;
    const games = 12;
    for (let g = 0; g < games; g++) {
      let s = initialState(g % 2 ? 'north' : 'south');
      for (let ply = 0; ply < 300 && !s.over; ply++) {
        const moves = legalMoves(s);
        const move = s.turn === 'south' ? chooseMove(s, 3, rand) : pickRandom(moves, rand);
        s = applyMove(s, move).state;
      }
      if (score(s, 'south') > score(s, 'north')) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(10);
  });
});
