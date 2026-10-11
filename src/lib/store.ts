import { create } from 'zustand';
import { pick } from './util';
import { chooseMove, type AiLevel } from './game/ai';
import {
  applyMove,
  initialState,
  isLegal,
  opponent,
  type GameEvent,
  type GameState,
  type Move,
  type Side,
} from './game/rules';

export type Mode = { kind: 'ai'; level: AiLevel; human: Side } | { kind: 'local' };
export type Phase = 'menu' | 'playing';

interface Snapshot {
  state: GameState;
  lastMove: Move | null;
}

export interface GameStore {
  phase: Phase;
  mode: Mode;
  /** The rules state after the latest move (the board may still be animating towards it). */
  state: GameState;
  /** What the board shows when idle: updated once a move's animation has finished. */
  shown: GameState;
  /** Events of the move being animated; the scene consumes them in order. */
  queue: GameEvent[];
  /** Bumped whenever the board must be laid out from scratch (new game, undo). */
  layoutKey: number;
  lastMove: Move | null;
  selected: number | null;
  hint: Move | null;
  thinking: boolean;
  history: Snapshot[];

  start: (mode: Mode) => void;
  toMenu: () => void;
  select: (cell: number | null) => void;
  play: (move: Move) => boolean;
  /** Called by the scene when the queued events have all been animated. */
  animationDone: () => void;
  undo: () => void;
  showHint: () => void;
  canInteract: () => boolean;
  isHumanTurn: () => boolean;
}

const firstMover = (mode: Mode): Side => (mode.kind === 'ai' ? mode.human : 'south');

export const useGame = create<GameStore>((set, get) => ({
  phase: 'menu',
  mode: { kind: 'local' },
  state: initialState(),
  shown: initialState(),
  queue: [],
  layoutKey: 0,
  lastMove: null,
  selected: null,
  hint: null,
  thinking: false,
  history: [],

  start: (mode) => {
    const state = initialState(firstMover(mode));
    set((s) => ({
      phase: 'playing',
      mode,
      state,
      shown: state,
      queue: [],
      layoutKey: s.layoutKey + 1,
      lastMove: null,
      selected: null,
      hint: null,
      thinking: false,
      history: [],
    }));
  },

  toMenu: () => {
    const state = initialState();
    set((s) => ({
      phase: 'menu',
      state,
      shown: state,
      queue: [],
      layoutKey: s.layoutKey + 1,
      selected: null,
      hint: null,
      lastMove: null,
      history: [],
    }));
  },

  select: (cell) => set({ selected: cell }),

  play: (move) => {
    const { state, queue, lastMove } = get();
    if (queue.length > 0 || !isLegal(state, move)) return false;
    const result = applyMove(state, move);
    set((s) => ({
      state: result.state,
      queue: result.events,
      lastMove: move,
      selected: null,
      hint: null,
      thinking: false,
      history: [...s.history, { state, lastMove }],
    }));
    return true;
  },

  animationDone: () => {
    set((s) => ({ queue: [], shown: s.state }));
    const { state, mode } = get();
    if (state.over || mode.kind !== 'ai' || state.turn === mode.human) return;
    // The machine's turn: think briefly so the move does not feel instantaneous.
    set({ thinking: true });
    const level = mode.level;
    setTimeout(() => {
      const now = get();
      if (now.state !== state || now.phase !== 'playing') return;
      now.play(chooseMove(state, level));
    }, 550);
  },

  undo: () => {
    const { history, mode, queue } = get();
    if (queue.length > 0 || history.length === 0) return;
    // Against the machine, go back to the human's last turn.
    let back = history.length - 1;
    if (mode.kind === 'ai') {
      while (back > 0 && pick(history, back).state.turn !== mode.human) back--;
      if (pick(history, back).state.turn !== mode.human) return;
    }
    const snap = pick(history, back);
    set((s) => ({
      state: snap.state,
      shown: snap.state,
      lastMove: snap.lastMove,
      history: history.slice(0, back),
      layoutKey: s.layoutKey + 1,
      selected: null,
      hint: null,
      thinking: false,
    }));
  },

  showHint: () => {
    const { state } = get();
    if (!get().canInteract()) return;
    set({ hint: chooseMove(state, 3), selected: null });
  },

  canInteract: () => {
    const { phase, queue, state, thinking } = get();
    return (
      phase === 'playing' && queue.length === 0 && !state.over && !thinking && get().isHumanTurn()
    );
  },

  isHumanTurn: () => {
    const { mode, state } = get();
    return mode.kind === 'local' || state.turn === mode.human;
  },
}));

/** Name shown for a side in the current mode. */
export const sideName = (mode: Mode, side: Side): string => {
  if (mode.kind === 'local') return side === 'south' ? 'Người chơi 1' : 'Người chơi 2';
  return side === mode.human ? 'Bạn' : 'Máy';
};

export { opponent };

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  Object.assign(window, { __oanquan: useGame });
}
