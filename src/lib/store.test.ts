import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from './store';

describe('game store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGame.getState().start({ kind: 'local' });
  });
  afterEach(() => vi.useRealTimers());

  it('plays a legal move and queues its events', () => {
    expect(useGame.getState().play({ cell: 1, dir: 1 })).toBe(true);
    const s = useGame.getState();
    expect(s.queue.length).toBeGreaterThan(0);
    expect(s.state.turn).toBe('north');
    // The board keeps showing the old position until the animation is done.
    expect(s.shown.cells[1]).toBe(5);
  });

  it('refuses moves while animating, and illegal moves', () => {
    useGame.getState().play({ cell: 1, dir: 1 });
    expect(useGame.getState().play({ cell: 8, dir: 1 })).toBe(false);
    useGame.getState().animationDone();
    expect(useGame.getState().play({ cell: 2, dir: 1 })).toBe(false); // south's cell, north to move
    expect(useGame.getState().canInteract()).toBe(true);
  });

  it('lets the machine answer after the animation', () => {
    useGame.getState().start({ kind: 'ai', level: 1, human: 'south' });
    useGame.getState().play({ cell: 3, dir: -1 });
    useGame.getState().animationDone();
    expect(useGame.getState().thinking).toBe(true);
    expect(useGame.getState().canInteract()).toBe(false);
    vi.runAllTimers();
    const s = useGame.getState();
    expect(s.thinking).toBe(false);
    expect(s.history).toHaveLength(2);
    expect(s.queue.length).toBeGreaterThan(0);
  });

  it('undoes back to the human turn against the machine', () => {
    useGame.getState().start({ kind: 'ai', level: 1, human: 'south' });
    const before = useGame.getState().state;
    useGame.getState().play({ cell: 3, dir: -1 });
    useGame.getState().animationDone();
    vi.runAllTimers();
    useGame.getState().animationDone();
    useGame.getState().undo();
    expect(useGame.getState().state).toEqual(before);
    expect(useGame.getState().history).toHaveLength(0);
  });

  it('suggests a legal move', () => {
    useGame.getState().showHint();
    const hint = useGame.getState().hint;
    expect(hint && hint.cell >= 1 && hint.cell <= 5).toBe(true);
  });
});
