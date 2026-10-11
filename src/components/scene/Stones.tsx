'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  Color,
  IcosahedronGeometry,
  type InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
  type Mesh,
} from 'three';
import { CELLS, isQuanCell, type GameEvent, type GameState, type Side } from '@/lib/game/rules';
import {
  HAND_Y,
  QUAN_STONE_R,
  SMALL_STONE_R,
  cellCenter,
  pilePosition,
  quanPosition,
  slotPosition,
} from '@/lib/layout';
import { playSound } from '@/lib/sound';
import { useSettings } from '@/lib/settings';
import { useGame } from '@/lib/store';

/** Every small stone ever on the board: 5 per citizen cell. */
const SMALL_COUNT = 50;
const PEBBLE_COLORS = [
  '#e3ddd0',
  '#c8bfae',
  '#a59988',
  '#8a7f72',
  '#efe9dc',
  '#b8a68c',
  '#6e665e',
  '#d4c7b0',
];

type Loc =
  | { kind: 'cell'; cell: number }
  | { kind: 'hand' }
  | { kind: 'pile'; side: Side }
  | { kind: 'spare' };

interface Stone {
  quan: boolean;
  loc: Loc;
  pos: Vector3;
  from: Vector3;
  to: Vector3;
  start: number;
  dur: number;
  arc: number;
  /** Sound to play when the flight lands. */
  land: 'drop' | null;
  spin: Quaternion;
}

/** Where stones are, and the flights between places. Plain mutable state, read every frame. */
class StoneModel {
  stones: Stone[] = [];
  cells: number[][] = [];
  hand: number[] = [];
  piles: Record<Side, number[]> = { south: [], north: [] };
  /** Where the hand floats, and its glide. */
  handPos = new Vector3(0, HAND_Y, 0);
  handFrom = new Vector3();
  handTo = new Vector3();
  handStart = 0;
  handDur = 0;
  /** Point the players look at. */
  focus = new Vector3();
  /** Actions scheduled for later in the current move. */
  private pending: { at: number; run: () => void }[] = [];

  stone(id: number): Stone {
    const s = this.stones[id];
    if (!s) throw new Error(`no stone ${id}`);
    return s;
  }

  cell(cell: number): number[] {
    const list = this.cells[cell];
    if (!list) throw new Error(`no cell ${cell}`);
    return list;
  }

  defer(at: number, run: () => void) {
    this.pending.push({ at, run });
  }

  constructor() {
    const random = (i: number) => {
      const x = Math.sin(i * 91.7 + 13.1) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < SMALL_COUNT + 2; i++) {
      const quan = i >= SMALL_COUNT;
      const spin = new Quaternion().setFromAxisAngle(
        new Vector3(random(i), random(i + 7), random(i + 3)).normalize(),
        random(i + 11) * Math.PI * 2,
      );
      this.stones.push({
        quan,
        loc: { kind: 'spare' },
        pos: new Vector3(0, -50, 0),
        from: new Vector3(),
        to: new Vector3(),
        start: 0,
        dur: 0,
        arc: 0,
        land: null,
        spin,
      });
    }
  }

  /** Put every stone where `state` says, instantly. */
  layout(state: GameState) {
    this.cells = Array.from({ length: CELLS }, () => []);
    this.hand = [];
    this.piles = { south: [], north: [] };
    let next = 0;
    const take = () => next++;
    const quanIds = [SMALL_COUNT, SMALL_COUNT + 1];
    this.pending = [];
    for (const s of this.stones) s.loc = { kind: 'spare' };
    for (let cell = 0; cell < CELLS; cell++) {
      if (isQuanCell(cell) && state.quan[cell === 0 ? 0 : 1]) {
        const id = cell === 0 ? SMALL_COUNT : SMALL_COUNT + 1;
        this.stone(id).loc = { kind: 'cell', cell };
        this.cell(cell).push(id);
      }
      for (let k = 0; k < (state.cells[cell] ?? 0); k++) {
        const id = take();
        this.stone(id).loc = { kind: 'cell', cell };
        this.cell(cell).push(id);
      }
    }
    // Captured quan go to whoever took them; which physical one does not matter.
    const freeQuan = quanIds.filter((id) => this.stone(id).loc.kind === 'spare');
    for (const side of ['south', 'north'] as const) {
      for (let q = 0; q < state.captured[side].quan; q++) {
        const id = freeQuan.shift();
        if (id === undefined) break;
        this.stone(id).loc = { kind: 'pile', side };
        this.piles[side].push(id);
      }
      // Borrowed stones moved between piles, so a pile can show fewer than its count.
      for (let k = 0; k < Math.max(0, state.captured[side].stones) && next < SMALL_COUNT; k++) {
        const id = take();
        this.stone(id).loc = { kind: 'pile', side };
        this.piles[side].push(id);
      }
    }
    for (const s of this.stones) {
      s.dur = 0;
      if (s.loc.kind === 'spare') s.pos.set(0, -50, 0);
    }
    this.restAll();
  }

  /** Resting position of a stone in its current place. */
  target(id: number): Vector3 {
    const s = this.stone(id);
    const loc = s.loc;
    if (loc.kind === 'cell') {
      if (s.quan) return new Vector3(...quanPosition(loc.cell));
      const slot = this.cell(loc.cell)
        .filter((i) => !this.stone(i).quan)
        .indexOf(id);
      return new Vector3(...slotPosition(loc.cell, slot));
    }
    if (loc.kind === 'pile') {
      const list = this.piles[loc.side];
      const same = list.filter((i) => this.stone(i).quan === s.quan);
      return new Vector3(...pilePosition(loc.side, same.indexOf(id), s.quan));
    }
    if (loc.kind === 'hand') return this.handSlot(this.hand.indexOf(id));
    return new Vector3(0, -50, 0);
  }

  handSlot(k: number): Vector3 {
    const a = k * 2.39996;
    const r = 0.09 * Math.sqrt(k + 0.5) + 0.05;
    return new Vector3(
      this.handPos.x + Math.cos(a) * r,
      this.handPos.y + (k % 3) * 0.05,
      this.handPos.z + Math.sin(a) * r,
    );
  }

  restAll() {
    this.stones.forEach((s, id) => {
      if (s.loc.kind !== 'spare') s.pos.copy(this.target(id));
    });
  }

  /** Fly a stone from where it is to its (new) place. */
  fly(id: number, now: number, dur: number, arc: number, land: Stone['land'] = null) {
    const s = this.stone(id);
    s.from.copy(s.pos);
    s.to.copy(this.target(id));
    s.start = now;
    s.dur = dur;
    s.arc = arc;
    s.land = land;
  }

  remove(id: number) {
    const s = this.stone(id);
    const loc = s.loc;
    const drop = (list: number[]) => {
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
    };
    if (loc.kind === 'cell') drop(this.cell(loc.cell));
    else if (loc.kind === 'hand') drop(this.hand);
    else if (loc.kind === 'pile') drop(this.piles[loc.side]);
  }

  moveTo(id: number, loc: Loc) {
    this.remove(id);
    this.stone(id).loc = loc;
    if (loc.kind === 'cell') this.cell(loc.cell).push(id);
    else if (loc.kind === 'hand') this.hand.push(id);
    else if (loc.kind === 'pile') this.piles[loc.side].push(id);
  }

  glideHand(to: Vector3, now: number, dur: number) {
    this.handFrom.copy(this.handPos);
    this.handTo.copy(to);
    this.handStart = now;
    this.handDur = dur;
  }

  /** Apply one game event; returns how long it takes (before speed). */
  apply(event: GameEvent, now: number, speed: number): number {
    const t = (x: number) => x / speed;
    const above = (cell: number) => {
      const [x, z] = cellCenter(cell);
      return new Vector3(x, HAND_Y, z);
    };
    switch (event.type) {
      case 'pickup': {
        this.glideHand(above(event.cell), now, t(0.18));
        this.handPos.copy(above(event.cell));
        const ids = [...this.cell(event.cell)].filter((i) => !this.stone(i).quan);
        ids.forEach((id) => this.moveTo(id, { kind: 'hand' }));
        ids.forEach((id, k) => this.fly(id, now + t(k * 0.012), t(0.3), 0.25));
        this.focus.copy(above(event.cell));
        playSound('pickup');
        return t(ids.length ? 0.34 : 0.12);
      }
      case 'drop': {
        const glide = t(0.1);
        this.glideHand(above(event.cell), now, glide);
        // Once the hand is over the cell, let one stone fall from it.
        this.defer(now + glide, () => {
          const id = this.hand.at(-1);
          if (id === undefined) return;
          this.moveTo(id, { kind: 'cell', cell: event.cell });
          this.fly(id, now + glide, t(0.13), 0.05, 'drop');
        });
        this.focus.copy(above(event.cell));
        return t(0.23);
      }
      case 'capture': {
        const ids = [...this.cell(event.cell)];
        ids.forEach((id) => this.moveTo(id, { kind: 'pile', side: event.side }));
        ids.forEach((id, k) => this.fly(id, now + t(k * 0.035), t(0.62), 1.4));
        playSound(event.quan ? 'quan' : 'capture');
        this.focus.copy(above(event.cell));
        return t(0.75 + ids.length * 0.02);
      }
      case 'sweep': {
        let k = 0;
        for (const cell of event.cells) {
          for (const id of [...this.cell(cell)]) {
            this.moveTo(id, { kind: 'pile', side: event.side });
            this.fly(id, now + t(k++ * 0.03), t(0.6), 1.2);
          }
        }
        playSound('capture');
        return t(0.8 + k * 0.02);
      }
      case 'refill': {
        const own = this.piles[event.side];
        const other = this.piles[event.side === 'south' ? 'north' : 'south'];
        event.cells.forEach((cell, k) => {
          const fromOther = k >= event.cells.length - event.borrowed;
          const source = fromOther ? other : own;
          const smalls = source.filter((i) => !this.stone(i).quan);
          const id = smalls.at(-1);
          if (id === undefined) return;
          this.moveTo(id, { kind: 'cell', cell });
          this.fly(id, now + t(k * 0.12), t(0.5), 0.9, 'drop');
        });
        return t(1.1);
      }
      case 'end':
        playSound('end');
        return t(0.3);
    }
  }

  /** Advance flights and the hand; returns whether anything is still moving. */
  update(now: number): boolean {
    let moving = this.pending.length > 0;
    if (moving) {
      const due = this.pending.filter((a) => a.at <= now);
      this.pending = this.pending.filter((a) => a.at > now);
      for (const action of due) action.run();
    }
    if (this.handDur > 0) {
      const k = Math.min(1, (now - this.handStart) / this.handDur);
      const e = k * k * (3 - 2 * k);
      this.handPos.lerpVectors(this.handFrom, this.handTo, e);
      if (k < 1) moving = true;
      else this.handDur = 0;
    }
    this.stones.forEach((s, id) => {
      if (s.loc.kind === 'spare') return;
      if (s.dur > 0) {
        const k = (now - s.start) / s.dur;
        if (k < 0) return void (moving = true);
        if (k >= 1) {
          s.dur = 0;
          s.pos.copy(s.loc.kind === 'hand' ? this.target(id) : s.to);
          if (s.land === 'drop') playSound('drop');
          return;
        }
        moving = true;
        const e = 1 - (1 - k) ** 2;
        // Hand stones chase the moving hand rather than a fixed point.
        const to = s.loc.kind === 'hand' ? this.target(id) : s.to;
        s.pos.lerpVectors(s.from, to, e);
        s.pos.y += Math.sin(Math.PI * k) * s.arc;
      } else if (s.loc.kind === 'hand') {
        s.pos.copy(this.target(id));
        s.pos.y += Math.sin(now * 6 + id) * 0.02;
      }
    });
    return moving;
  }
}

/** One of the two big quan stones. */
function QuanStone({
  meshRef,
  geometry,
  color,
}: {
  meshRef: RefObject<Mesh | null>;
  geometry: IcosahedronGeometry;
  color: string;
}) {
  return (
    <mesh ref={meshRef} geometry={geometry} scale={[1, 0.72, 0.9]} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.25}
        metalness={0.05}
        emissive="#0d2a20"
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

const dummy = new Object3D();
const matrix = new Matrix4();
const SCALE = new Vector3(1, 0.68, 0.86);

/** The stones and the animation of every move. */
export function Stones({ focus }: { focus?: Vector3 }) {
  const model = useMemo(() => new StoneModel(), []);
  const small = useRef<InstancedMesh>(null);
  const quanA = useRef<Mesh>(null);
  const quanB = useRef<Mesh>(null);
  const layoutKey = useGame((s) => s.layoutKey);
  const queue = useGame((s) => s.queue);
  const speed = useSettings((s) => s.speed);

  // Lay out from scratch on a new game or undo.
  useEffect(() => {
    model.layout(useGame.getState().shown);
  }, [model, layoutKey]);

  // Per-stone colours.
  useEffect(() => {
    const mesh = small.current;
    if (!mesh) return;
    const color = new Color();
    for (let i = 0; i < SMALL_COUNT; i++) {
      mesh.setColorAt(
        i,
        color
          .set(PEBBLE_COLORS[i % PEBBLE_COLORS.length] ?? '#ccc')
          .offsetHSL(0, 0, ((i * 7) % 5) * 0.012 - 0.02),
      );
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  const player = useRef<{ events: GameEvent[]; index: number; next: number; done: boolean } | null>(
    null,
  );
  useEffect(() => {
    player.current = queue.length ? { events: queue, index: 0, next: 0, done: false } : null;
  }, [queue]);

  const geometry = useMemo(() => new IcosahedronGeometry(SMALL_STONE_R, 2), []);
  const quanGeometry = useMemo(() => new IcosahedronGeometry(QUAN_STONE_R, 3), []);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const p = player.current;
    if (p && !p.done) {
      if (p.next === 0) p.next = now;
      for (let e = p.events[p.index]; e && now >= p.next; e = p.events[p.index]) {
        p.next += model.apply(e, now, speed);
        p.index++;
      }
    }
    const moving = model.update(now);
    if (p && !p.done && p.index >= p.events.length && now >= p.next && !moving) {
      p.done = true;
      useGame.getState().animationDone();
    }
    if (focus) focus.lerp(model.focus.lengthSq() ? model.focus : focus, 0.15);

    const mesh = small.current;
    if (mesh) {
      for (let i = 0; i < SMALL_COUNT; i++) {
        const s = model.stone(i);
        dummy.position.copy(s.pos);
        dummy.quaternion.copy(s.spin);
        dummy.scale.copy(SCALE);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    [quanA.current, quanB.current].forEach((m, k) => {
      if (!m) return;
      const s = model.stone(SMALL_COUNT + k);
      m.position.copy(s.pos);
      m.visible = s.loc.kind !== 'spare';
    });
    matrix.identity();
  });

  return (
    <group>
      <instancedMesh
        ref={small}
        args={[geometry, undefined, SMALL_COUNT]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <meshStandardMaterial roughness={0.42} metalness={0.02} />
      </instancedMesh>
      <QuanStone meshRef={quanA} geometry={quanGeometry} color="#36705e" />
      <QuanStone meshRef={quanB} geometry={quanGeometry} color="#2f6f5b" />
    </group>
  );
}
