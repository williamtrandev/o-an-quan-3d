'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import {
  CanvasTexture,
  ExtrudeGeometry,
  Path,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  Vector3,
  type Group,
  type MeshStandardMaterial,
} from 'three';
import { CELLS, isQuanCell, ownerOf, step, type Direction } from '@/lib/game/rules';
import {
  BOARD_THICKNESS,
  CELL,
  PIT,
  PIT_DEPTH,
  QUAN_R,
  RIM,
  TABLE_TOP_Y,
  BOARD_TOP_Y,
  cellCenter,
} from '@/lib/layout';
import { playSound } from '@/lib/sound';
import { canvas2d } from '@/lib/util';
import { anchors } from '@/lib/anchors';
import { useGame } from '@/lib/store';

const HALF_LEN = 2.5 * CELL;
const HALF_W = CELL + RIM;
const QUAN_PIT_R = QUAN_R - 0.24;

/** Stadium outline: a rectangle with half-disc caps, in shape space (y = -z). */
const stadium = <T extends Path>(path: T, halfLen: number, r: number): T => {
  path.moveTo(-halfLen, -r);
  path.lineTo(halfLen, -r);
  path.absarc(halfLen, 0, r, -Math.PI / 2, Math.PI / 2, false);
  path.lineTo(-halfLen, r);
  path.absarc(-halfLen, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  return path;
};

const roundedSquare = (path: Path, cx: number, cy: number, size: number, radius: number) => {
  const h = size / 2;
  path.moveTo(cx - h + radius, cy - h);
  path.lineTo(cx + h - radius, cy - h);
  path.quadraticCurveTo(cx + h, cy - h, cx + h, cy - h + radius);
  path.lineTo(cx + h, cy + h - radius);
  path.quadraticCurveTo(cx + h, cy + h, cx + h - radius, cy + h);
  path.lineTo(cx - h + radius, cy + h);
  path.quadraticCurveTo(cx - h, cy + h, cx - h, cy + h - radius);
  path.lineTo(cx - h, cy - h + radius);
  path.quadraticCurveTo(cx - h, cy - h, cx - h + radius, cy - h);
  return path;
};

/** Half-disc pit opening towards the board's end (`side` = -1 left, 1 right). */
const halfDisc = (path: Path, side: number, r: number) => {
  const x = side * (HALF_LEN + 0.08);
  // The arc starts the path; the straight edge closes it implicitly (no repeated points,
  // which would make degenerate triangles).
  if (side > 0) path.absarc(x, 0, r, -Math.PI / 2, Math.PI / 2, false);
  else path.absarc(x, 0, r, -Math.PI / 2, -(3 * Math.PI) / 2, true);
  return path;
};

/**
 * Replace zero-length normals (from degenerate triangles) with straight up: normalising
 * them in the shader gives NaN, which bloom then smears over the whole screen.
 */
const extrude = (...args: ConstructorParameters<typeof ExtrudeGeometry>) => {
  const geometry = new ExtrudeGeometry(...args);
  const normal = geometry.getAttribute('normal');
  for (let i = 0; i < normal.count; i++) {
    const l = normal.getX(i) ** 2 + normal.getY(i) ** 2 + normal.getZ(i) ** 2;
    if (!(l > 1e-8)) normal.setXYZ(i, 0, 0, 1);
  }
  return geometry;
};

/** The outline of a pit, for highlights and hit areas. */
const pitShape = (cell: number, grow = 0): Shape => {
  const shape = new Shape();
  if (isQuanCell(cell)) halfDisc(shape, cell === 0 ? -1 : 1, QUAN_PIT_R + grow);
  else {
    const [x, z] = cellCenter(cell);
    roundedSquare(shape, x, -z, PIT + grow * 2, 0.22 + grow);
  }
  return shape;
};

/** Procedural wood grain, so no texture files ship. */
const woodTexture = (base: string, dark: string) => {
  const { canvas, g } = canvas2d(512);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const y = (i / 90) * 512 + Math.sin(i * 7.3) * 6;
    g.strokeStyle = dark;
    g.globalAlpha = 0.08 + ((i * 37) % 10) / 60;
    g.lineWidth = 1 + ((i * 13) % 4);
    g.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const yy = y + Math.sin(x * 0.012 + i) * 5 + Math.sin(x * 0.05 + i * 2) * 1.5;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

/** The carved wooden board: a top layer with the pits cut through, over a darker base. */
function BoardBody() {
  const { top, base, grain, floorGrain } = useMemo(() => {
    const outer = stadium(new Shape(), HALF_LEN, HALF_W);
    for (let cell = 0; cell < CELLS; cell++) {
      const hole = new Path();
      if (isQuanCell(cell)) halfDisc(hole, cell === 0 ? -1 : 1, QUAN_PIT_R);
      else {
        const [x, z] = cellCenter(cell);
        roundedSquare(hole, x, -z, PIT, 0.22);
      }
      outer.holes.push(hole);
    }
    const top = extrude(outer, {
      depth: PIT_DEPTH - 0.04,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 3,
      curveSegments: 24,
    });
    const base = extrude(stadium(new Shape(), HALF_LEN, HALF_W), {
      depth: BOARD_THICKNESS - PIT_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 24,
    });
    const grain = woodTexture('#9a5e34', '#4a2812');
    grain.repeat.set(0.16, 0.16);
    const floorGrain = woodTexture('#5c3418', '#2a1408');
    floorGrain.repeat.set(0.2, 0.2);
    return { top, base, grain, floorGrain };
  }, []);

  return (
    <group rotation-x={-Math.PI / 2}>
      <mesh geometry={base} position-z={TABLE_TOP_Y + 0.03} castShadow receiveShadow>
        <meshStandardMaterial map={floorGrain} roughness={0.85} />
      </mesh>
      <mesh geometry={top} position-z={BOARD_TOP_Y - PIT_DEPTH + 0.04} castShadow receiveShadow>
        <meshStandardMaterial map={grain} roughness={0.55} metalness={0.02} />
      </mesh>
    </group>
  );
}

type Glow = 'none' | 'available' | 'hover' | 'selected' | 'hint' | 'last';
const GLOW_COLOR: Record<Exclude<Glow, 'none'>, string> = {
  available: '#ffd27a',
  hover: '#ffe9a8',
  selected: '#ffb703',
  hint: '#7cf0a8',
  last: '#9fd3ff',
};

/** A thin glowing ring around a pit. */
function PitGlow({ cell, glow }: { cell: number; glow: Glow }) {
  const geometry = useMemo(() => {
    const shape = pitShape(cell, 0.1);
    const inner = pitShape(cell, 0.02);
    shape.holes.push(inner);
    return extrude(shape, { depth: 0.015, bevelEnabled: false, curveSegments: 24 });
  }, [cell]);
  const material = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const m = material.current;
    if (!m) return;
    const pulse =
      glow === 'hint' || glow === 'selected' ? 0.65 + 0.35 * Math.sin(clock.elapsedTime * 5) : 1;
    const strength = { none: 0, available: 0.55, hover: 1.4, selected: 1.8, hint: 1.6, last: 0.7 }[
      glow
    ];
    m.opacity = glow === 'none' ? 0 : Math.min(1, 0.45 + strength * 0.4) * pulse;
    m.emissiveIntensity = strength * pulse * 1.6;
  });
  const color = glow === 'none' ? '#ffffff' : GLOW_COLOR[glow];
  return (
    <mesh
      geometry={geometry}
      rotation-x={-Math.PI / 2}
      position-y={BOARD_TOP_Y + 0.05}
      renderOrder={2}
    >
      <meshStandardMaterial
        ref={material}
        color={color}
        emissive={color}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Invisible slab over a pit that takes the pointer. */
function PitHit({
  cell,
  onOver,
  onOut,
  onTap,
}: {
  cell: number;
  onOver: () => void;
  onOut: () => void;
  onTap: () => void;
}) {
  const geometry = useMemo(
    () => extrude(pitShape(cell, 0.12), { depth: 0.6, bevelEnabled: false }),
    [cell],
  );
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <mesh
      geometry={geometry}
      rotation-x={-Math.PI / 2}
      position-y={BOARD_TOP_Y - PIT_DEPTH}
      onPointerOver={(e) => {
        e.stopPropagation();
        onOver();
      }}
      onPointerOut={onOut}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        e.stopPropagation();
        const d = down.current;
        // A drag that rotates the camera is not a tap.
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
        onTap();
      }}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}

/** Moves the HTML anchored to scene points (see lib/anchors) to their screen positions. */
function AnchorProjector() {
  const v = useMemo(() => new Vector3(), []);
  const w = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const anchor of anchors.values()) {
      v.set(...anchor.at).project(camera);
      const hidden = v.z > 1;
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      anchor.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      anchor.el.style.visibility = hidden ? 'hidden' : 'visible';
      if (anchor.towards) {
        w.set(...anchor.towards).project(camera);
        const angle = Math.atan2(-(w.y - v.y) * size.height, (w.x - v.x) * size.width);
        anchor.el.style.setProperty('--angle', `${((angle * 180) / Math.PI).toFixed(1)}deg`);
      }
    }
  });
  return null;
}

export function Board() {
  const selected = useGame((s) => s.selected);
  const hint = useGame((s) => s.hint);
  const lastMove = useGame((s) => s.lastMove);
  const shown = useGame((s) => s.shown);
  const interactive = useGame(
    (s) => s.phase === 'playing' && s.queue.length === 0 && !s.thinking && !s.state.over,
  );
  const humanTurn = useGame((s) => s.mode.kind === 'local' || s.state.turn === s.mode.human);
  const select = useGame((s) => s.select);
  const [hover, setHover] = useState<number | null>(null);
  const canPlay = interactive && humanTurn;

  const playable = (cell: number) =>
    canPlay && ownerOf(cell) === shown.turn && (shown.cells[cell] ?? 0) > 0;

  const glowOf = (cell: number): Glow => {
    if (selected === cell) return 'selected';
    if (hint?.cell === cell && canPlay) return 'hint';
    if (playable(cell)) return hover === cell ? 'hover' : 'available';
    if (lastMove?.cell === cell && !canPlay) return 'last';
    return 'none';
  };

  return (
    <group>
      <BoardBody />
      {Array.from({ length: CELLS }, (_, cell) => (
        <PitGlow key={cell} cell={cell} glow={glowOf(cell)} />
      ))}
      {Array.from({ length: CELLS }, (_, cell) =>
        isQuanCell(cell) ? null : (
          <PitHit
            key={cell}
            cell={cell}
            onOver={() => {
              setHover(cell);
              if (playable(cell)) document.body.style.cursor = 'pointer';
            }}
            onOut={() => {
              setHover((h) => (h === cell ? null : h));
              document.body.style.cursor = '';
            }}
            onTap={() => {
              if (!playable(cell)) return;
              playSound('select');
              select(selected === cell ? null : cell);
            }}
          />
        ),
      )}
      <AnchorProjector />
      {hint && canPlay && selected === null && <HintArrow cell={hint.cell} dir={hint.dir} />}
    </group>
  );
}

/** A bobbing arrow over the suggested pit, and a second one pointing the suggested way. */
function HintArrow({ cell, dir }: { cell: number; dir: Direction }) {
  const ref = useRef<Group>(null);
  const [x, z] = cellCenter(cell);
  const [nx, nz] = cellCenter(step(cell, dir));
  const yaw = Math.atan2(-(nz - z), nx - x);
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.position.y = BOARD_TOP_Y + 1.05 + Math.sin(clock.elapsedTime * 4) * 0.12;
  });
  return (
    <group ref={ref} position={[x, BOARD_TOP_Y + 1.05, z]}>
      <mesh rotation-x={Math.PI}>
        <coneGeometry args={[0.2, 0.45, 16]} />
        <meshStandardMaterial
          color="#7cf0a8"
          emissive="#3fd17f"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      <group rotation-y={yaw} position-y={0.45}>
        <mesh position-x={0.25} rotation-z={-Math.PI / 2}>
          <coneGeometry args={[0.14, 0.32, 12]} />
          <meshStandardMaterial
            color="#7cf0a8"
            emissive="#3fd17f"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
        <mesh position-x={-0.05} rotation-z={-Math.PI / 2}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
          <meshStandardMaterial
            color="#7cf0a8"
            emissive="#3fd17f"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
