import { pickRandom } from '../util';
import {
  applyMove,
  legalMoves,
  opponent,
  ownedCells,
  score,
  type GameState,
  type Move,
  type Side,
} from './rules';

export const AI_LEVELS = [1, 2, 3, 4] as const;
export type AiLevel = (typeof AI_LEVELS)[number];

export const AI_LEVEL_LABEL: Record<AiLevel, string> = {
  1: 'Dễ',
  2: 'Vừa',
  3: 'Khó',
  4: 'Cao thủ',
};

interface LevelSettings {
  depth: number;
  /** Chance of playing a random move instead of the best one. */
  blunder: number;
}

const LEVELS: Record<AiLevel, LevelSettings> = {
  1: { depth: 1, blunder: 0.35 },
  2: { depth: 2, blunder: 0.1 },
  3: { depth: 4, blunder: 0 },
  4: { depth: 7, blunder: 0 },
};

const WIN = 10_000;

/** Stones still on a side's cells: they are worth something, since they end up its own. */
const onBoard = (s: GameState, side: Side) =>
  ownedCells(side).reduce((sum, c) => sum + (s.cells[c] ?? 0), 0);

/** Position value for `side`. */
export const evaluate = (s: GameState, side: Side): number => {
  const other = opponent(side);
  const diff = score(s, side) - score(s, other);
  if (s.over) return diff > 0 ? WIN + diff : diff < 0 ? -WIN + diff : 0;
  return diff + 0.4 * (onBoard(s, side) - onBoard(s, other));
};

/** Negamax with alpha-beta; returns the value for the side to move. */
const search = (s: GameState, depth: number, alpha: number, beta: number): number => {
  if (depth === 0 || s.over) return evaluate(s, s.turn);
  const children = legalMoves(s).map((m) => applyMove(s, m).state);
  // Try captures first: they prune the most.
  children.sort((a, b) => evaluate(b, s.turn) - evaluate(a, s.turn));
  let best = -Infinity;
  for (const child of children) {
    // The turn always passes to the opponent, so negate.
    const value = -search(child, depth - 1, -beta, -alpha);
    if (value > best) best = value;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return best;
};

/** The move the AI plays at `level`. `random` is injectable for tests. */
export const chooseMove = (
  s: GameState,
  level: AiLevel,
  random: () => number = Math.random,
): Move => {
  const moves = legalMoves(s);
  if (moves.length === 0) throw new Error('no legal moves');
  const { depth, blunder } = LEVELS[level];
  if (random() < blunder) return pickRandom(moves, random);
  let best: Move[] = [];
  let bestValue = -Infinity;
  for (const move of moves) {
    const child = applyMove(s, move).state;
    const value = -search(child, depth - 1, -Infinity, Infinity);
    if (value > bestValue + 1e-9) {
      bestValue = value;
      best = [move];
    } else if (Math.abs(value - bestValue) <= 1e-9) {
      best.push(move);
    }
  }
  // Vary between equally good moves so games do not repeat.
  return pickRandom(best, random);
};
