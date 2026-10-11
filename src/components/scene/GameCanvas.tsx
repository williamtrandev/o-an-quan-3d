'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import { Spherical, Vector3, type BufferGeometry, type Mesh, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Side } from '@/lib/game/rules';
import { BOARD_TOP_Y } from '@/lib/layout';
import { useSettings } from '@/lib/settings';
import { useGame } from '@/lib/store';
import { Board } from './Board';
import { Players } from './Players';
import { Stones } from './Stones';
import { Basket, OilLamp, Table } from './Table';
import { ATMOSPHERE, Village } from './Village';

const WOOD = '#8a5634';

export default function GameCanvas() {
  const time = useSettings((s) => s.time);
  const focus = useMemo(() => new Vector3(0, BOARD_TOP_Y, 0), []);
  const a = ATMOSPHERE[time];
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      frameloop="never"
      camera={{ fov: 45, near: 0.1, far: 400, position: [0, 12, 18] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-label="Bàn ô ăn quan 3D"
    >
      <FrameLimiter fps={60} />
      <NormalGuard />
      {process.env.NODE_ENV !== 'production' && <DevHandle />}
      <Village time={time} shadowMapSize={2048} />
      <Table wood={WOOD} />
      <Basket side="south" />
      <Basket side="north" />
      <OilLamp position={[-5.6, 3.9]} glow={a.lanterns} />
      <OilLamp position={[5.6, -3.9]} glow={a.lanterns} />
      <Board />
      <Stones focus={focus} />
      <Players focus={focus} wood={WOOD} />
      <CameraRig />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={a.bloom} luminanceThreshold={0.85} />
        <Vignette offset={0.28} darkness={0.5} />
      </EffectComposer>
    </Canvas>
  );
}

/** Renders at a fixed rate instead of the display's (a 120 Hz screen would double the work). */
function FrameLimiter({ fps }: { fps: number }) {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    const interval = 1000 / fps;
    let last = 0;
    let id = 0;
    const loop = (now: number) => {
      id = requestAnimationFrame(loop);
      if (now - last >= interval - 2) {
        last = Math.max(last + interval, now - interval);
        advance(now / 1000);
      }
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [fps, advance]);
  return null;
}

/**
 * Some geometry (drei's RoundedBox, extrusions with repeated points) has zero-length
 * normals; normalising them in a shader gives NaN, and bloom smears one NaN pixel over the
 * whole screen. Check each new geometry once and point bad normals straight up.
 */
function NormalGuard() {
  const seen = useMemo(() => new WeakSet<BufferGeometry>(), []);
  const frames = useRef(0);
  useFrame(({ scene }) => {
    // New meshes appear when characters or scenery change; a check twice a second is plenty.
    if (frames.current++ % 30 !== 0) return;
    scene.traverse((object) => {
      const geometry = (object as Mesh).geometry as BufferGeometry | undefined;
      if (!geometry || seen.has(geometry)) return;
      seen.add(geometry);
      const normal = geometry.getAttribute('normal');
      if (!normal) return;
      let fixed = false;
      for (let i = 0; i < normal.count; i++) {
        const l = normal.getX(i) ** 2 + normal.getY(i) ** 2 + normal.getZ(i) ** 2;
        if (!(l > 1e-8)) {
          normal.setXYZ(i, 0, 1, 0);
          fixed = true;
        }
      }
      if (fixed) normal.needsUpdate = true;
    });
  });
  return null;
}

/** `window.__oanquanThree()` in development, for browser scripts (tests, clip recorder). */
function DevHandle() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    Object.assign(window, { __oanquanThree: get });
    return () => {
      Reflect.deleteProperty(window, '__oanquanThree');
    };
  }, [get]);
  return null;
}

/**
 * Places the camera behind the player to move (landscape) or at the board's end (portrait,
 * so the long board runs up the screen), gliding there whenever the view changes.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const { width, height } = useThree((s) => s.size);
  const phase = useGame((s) => s.phase);
  const mode = useGame((s) => s.mode);
  const turn = useGame((s) => s.shown.turn);
  const goal = useRef<Spherical | null>(null);
  /** Point the camera orbits: lowered on phone menus so the table shows above the panel. */
  const lookAt = useRef(new Vector3());
  const lookGoal = useRef(new Vector3());

  const portrait = width / Math.max(1, height) < 0.85;
  // Whose side the camera sits on: the human against the machine, the mover in a local game.
  const viewer: Side = mode.kind === 'ai' ? mode.human : turn;

  useEffect(() => {
    const aspect = width / Math.max(1, height);
    if (phase === 'menu') {
      goal.current = portrait ? new Spherical(30, 1.02, 0.6) : new Spherical(24, 1.0, 0.6);
      lookGoal.current.set(0, portrait ? -9 : 0, 0);
      return;
    }
    lookGoal.current.set(0, 0, 0);
    if (portrait) {
      // From the end of the board; the viewer's row on the right.
      const theta = viewer === 'south' ? -Math.PI / 2 : Math.PI / 2;
      goal.current = new Spherical(Math.max(13, 11 / Math.max(aspect, 0.45)), 0.62, theta);
    } else {
      const theta = viewer === 'south' ? 0 : Math.PI;
      goal.current = new Spherical(Math.max(13.5, 17 / Math.min(aspect, 1.6) + 2), 0.82, theta);
    }
  }, [phase, viewer, portrait, width, height]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      goal.current = null;
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useFrame((_, delta) => {
    // Glide the orbit centre, keeping the camera's offset from it.
    if (lookAt.current.distanceToSquared(lookGoal.current) > 1e-6) {
      const before = lookAt.current.clone();
      lookAt.current.lerp(lookGoal.current, 1 - Math.exp(-delta * 3));
      camera.position.add(lookAt.current.clone().sub(before));
      if (controls) {
        controls.target.copy(lookAt.current);
        controls.update();
      }
    }
    const g = goal.current;
    if (!g) return;
    const current = new Spherical().setFromVector3(camera.position.clone().sub(lookAt.current));
    const k = 1 - Math.exp(-delta * 3);
    const dTheta = Math.atan2(Math.sin(g.theta - current.theta), Math.cos(g.theta - current.theta));
    current.radius += (g.radius - current.radius) * k;
    current.phi += (g.phi - current.phi) * k;
    current.theta += dTheta * k;
    camera.position.setFromSpherical(current).add(lookAt.current);
    camera.lookAt(lookAt.current);
    controls?.update();
    if (
      Math.abs(dTheta) < 0.001 &&
      Math.abs(g.phi - current.phi) < 0.001 &&
      Math.abs(g.radius - current.radius) < 0.01
    ) {
      goal.current = null;
    }
  });

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.6}
      minDistance={8}
      maxDistance={34}
      minPolarAngle={0.15}
      maxPolarAngle={1.25}
      autoRotate={phase === 'menu'}
      autoRotateSpeed={0.35}
    />
  );
}
