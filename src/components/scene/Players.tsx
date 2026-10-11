'use client';

import { useMemo } from 'react';
import { Vector3 } from 'three';
import { DEFAULT_AVATAR, GUEST_AVATAR, ROBOT_AVATAR, type Avatar } from '@/lib/avatar';
import { winner, type Side } from '@/lib/game/rules';
import { BOARD_TOP_Y, CHARACTER_SCALE, SEAT_Y, SEAT_Z, cellCenter } from '@/lib/layout';
import { useGame } from '@/lib/store';
import { Character, type Activity, type Reach } from '../characters/Character';

/** The two players seated on either side of the board. */
export function Players({ focus, wood }: { focus: Vector3; wood: string }) {
  const mode = useGame((s) => s.mode);
  const shown = useGame((s) => s.shown);
  const turn = useGame((s) => s.state.turn);
  const animating = useGame((s) => s.queue.length > 0);
  const lastMove = useGame((s) => s.lastMove);
  const plies = useGame((s) => s.history.length);

  const avatars: Record<Side, Avatar> = useMemo(() => {
    if (mode.kind === 'ai') {
      return mode.human === 'south'
        ? { south: DEFAULT_AVATAR, north: ROBOT_AVATAR }
        : { south: ROBOT_AVATAR, north: DEFAULT_AVATAR };
    }
    return { south: DEFAULT_AVATAR, north: GUEST_AVATAR };
  }, [mode]);

  const result = shown.over ? winner(shown) : null;
  const activity = (side: Side): Activity => {
    if (result) return result === 'draw' ? 'idle' : result === side ? 'won' : 'lost';
    return !animating && turn === side ? 'thinking' : 'idle';
  };

  // The player who just moved reaches for the pit they picked up from.
  const mover = plies > 0 ? useGame.getState().history.at(-1)?.state.turn : undefined;
  const reach = (side: Side): Reach | null => {
    if (!lastMove || mover !== side) return null;
    const [x, z] = cellCenter(lastMove.cell);
    return { target: new Vector3(x, BOARD_TOP_Y + 0.3, z), key: plies };
  };

  return (
    <>
      {(['south', 'north'] as const).map((side) => (
        <group
          key={side}
          position={[0, SEAT_Y, side === 'south' ? SEAT_Z : -SEAT_Z]}
          rotation-y={side === 'south' ? 0 : Math.PI}
          scale={CHARACTER_SCALE}
        >
          <Character
            avatar={avatars[side]}
            activity={activity(side)}
            focus={focus}
            reach={reach(side)}
            occlusion="fade"
            wood={wood}
          />
        </group>
      ))}
    </>
  );
}
