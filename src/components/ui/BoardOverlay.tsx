'use client';

import { anchorRef } from '@/lib/anchors';
import { CELLS, isQuanCell, ownerOf, step, type Direction } from '@/lib/game/rules';
import { BOARD_TOP_Y, cellCenter } from '@/lib/layout';
import { useSettings } from '@/lib/settings';
import { useGame } from '@/lib/store';

/** Where a pit's count badge sits: just outside the pit, towards its owner. */
const badgeAt = (cell: number): [number, number, number] => {
  const [x, z] = cellCenter(cell);
  if (isQuanCell(cell)) return [x + (cell === 0 ? -0.75 : 0.75), BOARD_TOP_Y + 0.1, z + 1.05];
  return [x, BOARD_TOP_Y + 0.1, z + (z > 0 ? 0.98 : -0.98)];
};

function Counts() {
  const shown = useGame((s) => s.shown);
  const animating = useGame((s) => s.queue.length > 0);
  const visible = useSettings((s) => s.showCounts);
  const playing = useGame((s) => s.phase === 'playing');
  if (!visible || !playing) return null;
  return (
    <>
      {Array.from({ length: CELLS }, (_, cell) => {
        const quan = isQuanCell(cell) && shown.quan[cell === 0 ? 0 : 1];
        const n = shown.cells[cell] ?? 0;
        return (
          <span
            key={cell}
            ref={anchorRef(`count-${cell}`, badgeAt(cell))}
            className="count-badge absolute top-0 left-0"
            // Hidden until the projector has placed it.
            style={{ opacity: animating ? 0.35 : 1, visibility: 'hidden' }}
          >
            {quan && <b className="text-emerald-300">Quan</b>}
            {quan && n > 0 && <span className="opacity-60">+</span>}
            {(n > 0 || !quan) && n}
          </span>
        );
      })}
    </>
  );
}

/** Two arrows beside the selected pit; each points the way the stones would be sown. */
function DirectionPicker({ cell }: { cell: number }) {
  const play = useGame((s) => s.play);
  const [x, z] = cellCenter(cell);
  return (
    <>
      {([1, -1] as Direction[]).map((dir) => {
        const [nx, nz] = cellCenter(step(cell, dir));
        const len = Math.hypot(nx - x, nz - z) || 1;
        const at: [number, number, number] = [
          x + ((nx - x) / len) * 0.85,
          BOARD_TOP_Y + 0.55,
          z + ((nz - z) / len) * 0.85,
        ];
        return (
          // The wrapper is moved by the projector; the button keeps its own hover transform.
          <div
            key={`${cell}:${dir}`}
            ref={anchorRef(`dir${dir}`, at, [nx, BOARD_TOP_Y + 0.55, nz])}
            className="absolute top-0 left-0"
          >
            <button
              type="button"
              className="dir-button"
              aria-label={`Rải về phía ô ${step(cell, dir)}`}
              onClick={() => play({ cell, dir })}
            >
              <svg
                viewBox="0 0 24 24"
                width="26"
                height="26"
                style={{ transform: 'rotate(var(--angle, 0deg))' }}
              >
                <path
                  d="M4 12h13M12 5l7 7-7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        );
      })}
    </>
  );
}

/** HTML pinned over the board: stone counts and the sowing direction picker. */
export function BoardOverlay() {
  const selected = useGame((s) => s.selected);
  const canPlay = useGame(
    (s) =>
      s.phase === 'playing' &&
      s.queue.length === 0 &&
      !s.thinking &&
      !s.state.over &&
      (s.mode.kind === 'local' || s.state.turn === s.mode.human),
  );
  const turn = useGame((s) => s.state.turn);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden [&_button]:pointer-events-auto">
      <Counts />
      {selected !== null && canPlay && ownerOf(selected) === turn && (
        <DirectionPicker cell={selected} />
      )}
    </div>
  );
}
