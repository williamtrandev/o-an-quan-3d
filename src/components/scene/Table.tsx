'use client';

import { useMemo } from 'react';
import { CanvasTexture, LatheGeometry, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three';
import type { Side } from '@/lib/game/rules';
import {
  GROUND_Y,
  PILE_CENTER,
  PILE_R,
  TABLE_HALF_X,
  TABLE_HALF_Z,
  TABLE_TOP_Y,
} from '@/lib/layout';
import { canvas2d } from '@/lib/util';

/** Low wooden table the board rests on. */
export function Table({ wood }: { wood: string }) {
  const thickness = 0.32;
  const top = TABLE_TOP_Y - thickness / 2;
  const legHeight = top - thickness / 2 - GROUND_Y;
  const cx = TABLE_HALF_X - 0.7;
  const cz = TABLE_HALF_Z - 0.7;
  return (
    <group>
      <mesh position-y={top} castShadow receiveShadow>
        <boxGeometry args={[TABLE_HALF_X * 2, thickness, TABLE_HALF_Z * 2]} />
        <meshStandardMaterial color={wood} roughness={0.72} />
      </mesh>
      {[
        [-cx, -cz],
        [cx, -cz],
        [-cx, cz],
        [cx, cz],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x ?? 0, top - thickness / 2 - legHeight / 2, z ?? 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.22, legHeight, 10]} />
          <meshStandardMaterial color={wood} roughness={0.78} />
        </mesh>
      ))}
    </group>
  );
}

/** Woven bamboo texture for the baskets. */
const weave = () => {
  const { canvas: c, g } = canvas2d(128);
  g.fillStyle = '#c9a063';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#a9793f' : '#dcb779';
      g.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(10, 2);
  t.colorSpace = SRGBColorSpace;
  return t;
};

/** A shallow woven basket (rổ) holding a player's captured stones. */
export function Basket({ side }: { side: Side }) {
  const { geometry, map } = useMemo(() => {
    const points = [
      new Vector2(0, 0),
      new Vector2(PILE_R * 0.75, 0.01),
      new Vector2(PILE_R * 0.98, 0.12),
      new Vector2(PILE_R * 1.1, 0.32),
      new Vector2(PILE_R * 1.06, 0.33),
      new Vector2(PILE_R * 0.94, 0.14),
      new Vector2(PILE_R * 0.72, 0.05),
      new Vector2(0, 0.04),
    ];
    return { geometry: new LatheGeometry(points, 40), map: weave() };
  }, []);
  const [x, z] = PILE_CENTER[side];
  return (
    <group position={[x, TABLE_TOP_Y + 0.005, z]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial map={map} roughness={0.9} side={2} />
      </mesh>
      <mesh position-y={0.33} rotation-x={Math.PI / 2}>
        <torusGeometry args={[PILE_R * 1.08, 0.035, 8, 48]} />
        <meshStandardMaterial color="#8a5a2b" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Small oil lamp (đèn dầu) on a corner of the table; lit at dusk and at night. */
export function OilLamp({ position, glow }: { position: [number, number]; glow: number }) {
  const body = useMemo(
    () =>
      new LatheGeometry(
        [0, 0.28, 0.3, 0.2, 0.09, 0.1, 0.16, 0.15, 0].map(
          (r, i) => new Vector2(r, [0, 0, 0.06, 0.2, 0.3, 0.34, 0.5, 0.9, 0.95][i] ?? 0),
        ),
        24,
      ),
    [],
  );
  const [x, z] = position;
  return (
    <group position={[x, TABLE_TOP_Y, z]}>
      <mesh geometry={body} castShadow>
        <meshStandardMaterial
          color="#9fb7a8"
          roughness={0.15}
          metalness={0.1}
          transparent
          opacity={0.75}
        />
      </mesh>
      <mesh position-y={0.62} scale={[1, 1.6, 1]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshStandardMaterial
          color="#ffd27a"
          emissive="#ffb347"
          emissiveIntensity={glow > 0 ? 3 : 0.2}
          toneMapped={false}
        />
      </mesh>
      {glow > 0 && (
        <pointLight
          position-y={0.75}
          color="#ffb35c"
          intensity={glow * 9}
          distance={11}
          decay={1.5}
          castShadow={false}
        />
      )}
    </group>
  );
}
