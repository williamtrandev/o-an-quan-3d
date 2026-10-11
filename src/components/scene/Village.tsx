'use client';

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  type InstancedMesh,
  LatheGeometry,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Points,
} from 'three';
import { GROUND_Y } from '@/lib/layout';
import { seededRandom } from '@/lib/random';
import type { TimeOfDay } from '@/lib/settings';
import { canvas2d, pick } from '@/lib/util';

/** Colours and lights for each time of day. */
export const ATMOSPHERE: Record<
  TimeOfDay,
  {
    skyTop: string;
    skyHorizon: string;
    fog: string;
    sun: string;
    sunIntensity: number;
    sunPosition: [number, number, number];
    hemiSky: string;
    hemiGround: string;
    hemiIntensity: number;
    lanterns: number;
    bloom: number;
    exposure: number;
  }
> = {
  day: {
    skyTop: '#5fa8e8',
    skyHorizon: '#d9eefc',
    fog: '#cfe6f5',
    sun: '#fff4e0',
    sunIntensity: 3,
    sunPosition: [14, 26, 10],
    hemiSky: '#d8ecff',
    hemiGround: '#9a7a52',
    hemiIntensity: 1.2,
    lanterns: 0,
    bloom: 0.25,
    exposure: 1,
  },
  sunset: {
    skyTop: '#4d5a9c',
    skyHorizon: '#ffb37a',
    fog: '#f0b48a',
    sun: '#ffb070',
    sunIntensity: 3,
    sunPosition: [-20, 12, 8],
    hemiSky: '#ffe0c4',
    hemiGround: '#7a5236',
    hemiIntensity: 1.15,
    lanterns: 0.6,
    bloom: 0.45,
    exposure: 1,
  },
  night: {
    skyTop: '#060c22',
    skyHorizon: '#1d2c55',
    fog: '#141f3d',
    sun: '#9fb6ff',
    sunIntensity: 1,
    sunPosition: [12, 22, -16],
    hemiSky: '#5a70b0',
    hemiGround: '#3a2a1c',
    hemiIntensity: 0.85,
    lanterns: 2.2,
    bloom: 0.9,
    exposure: 1.05,
  },
};

const SKY_RADIUS = 160;

/** Gradient sky dome with a sun or moon disc. */
function Sky({ time }: { time: TimeOfDay }) {
  const a = ATMOSPHERE[time];
  const uniforms = useMemo(
    () => ({
      top: { value: new Color() },
      horizon: { value: new Color() },
      sunDir: { value: new Vector3() },
      sunColor: { value: new Color() },
      night: { value: 0 },
    }),
    [],
  );
  uniforms.top.value.set(a.skyTop);
  uniforms.horizon.value.set(a.skyHorizon);
  uniforms.sunDir.value.set(...a.sunPosition).normalize();
  uniforms.sunColor.value.set(time === 'night' ? '#f2f0dc' : a.sun);
  uniforms.night.value = time === 'night' ? 1 : 0;
  return (
    <mesh scale={SKY_RADIUS} renderOrder={-1}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`
          uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float night;
          varying vec3 vDir;
          void main(){
            float h = clamp(vDir.y, -0.2, 1.0);
            vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.55));
            float d = dot(normalize(vDir), sunDir);
            float disc = smoothstep(0.9985 - night * 0.0005, 0.9992, d);
            float glow = pow(max(d, 0.0), 24.0) * (0.55 - night * 0.3);
            col += sunColor * (disc * 1.6 + glow);
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

/** Red brick courtyard (sân gạch) as a procedural texture. */
const brickTexture = () => {
  const { canvas: c, g } = canvas2d(512);
  g.fillStyle = '#6e4a3a';
  g.fillRect(0, 0, 512, 512);
  const random = seededRandom(3);
  const size = 64;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const shade = 0.85 + random() * 0.25;
      g.fillStyle = `rgb(${Math.round(176 * shade)},${Math.round(92 * shade)},${Math.round(64 * shade)})`;
      g.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
      g.fillStyle = 'rgba(0,0,0,0.06)';
      g.fillRect(x * size + 3, y * size + size - 12, size - 6, 9);
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(9, 9);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

function Ground() {
  const bricks = useMemo(() => brickTexture(), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={GROUND_Y} receiveShadow>
        <circleGeometry args={[19, 64]} />
        <meshStandardMaterial map={bricks} roughness={0.92} />
      </mesh>
      {/* Grass and paddy fields beyond the courtyard. */}
      <mesh rotation-x={-Math.PI / 2} position-y={GROUND_Y - 0.02} receiveShadow>
        <circleGeometry args={[150, 64]} />
        <meshStandardMaterial color="#6f9a45" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, GROUND_Y - 0.01, 0]}>
        <ringGeometry args={[19, 19.6, 64]} />
        <meshStandardMaterial color="#8c6a50" roughness={1} />
      </mesh>
    </group>
  );
}

/** Instanced helper: place `count` copies with a function of the index. */
function useInstances(
  ref: RefObject<InstancedMesh | null>,
  count: number,
  place: (o: Object3D, i: number) => string | undefined,
) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    const color = new Color();
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      const c = place(o, i);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      if (c) mesh.setColorAt(i, color.set(c));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, count, place]);
}

/** Clumps of bamboo (lũy tre) around the courtyard. */
function Bamboo() {
  const clumps = useMemo(() => {
    const random = seededRandom(11);
    const list: { x: number; z: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + random() * 0.15;
      // Leave the view behind the south player open.
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.55)
        continue;
      const r = 25 + random() * 6;
      list.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
    }
    return list;
  }, []);
  const perClump = 12;
  const culms = useRef<InstancedMesh>(null);
  const leaves = useRef<InstancedMesh>(null);
  const culmCount = clumps.length * perClump;
  const leafCount = clumps.length * 34;

  const placeCulm = useMemo(() => {
    const random = seededRandom(21);
    return (o: Object3D, i: number) => {
      const c = pick(clumps, Math.floor(i / perClump));
      const h = 9 + random() * 7;
      o.position.set(c.x + (random() - 0.5) * 2.2, GROUND_Y + h / 2, c.z + (random() - 0.5) * 2.2);
      o.rotation.set((random() - 0.5) * 0.25, 0, (random() - 0.5) * 0.25);
      o.scale.set(1, h, 1);
      return random() > 0.3 ? '#7e9b3b' : '#a3a64a';
    };
  }, [clumps]);
  const placeLeaf = useMemo(() => {
    const random = seededRandom(31);
    return (o: Object3D, i: number) => {
      const c = pick(clumps, Math.floor(i / 34));
      const y = GROUND_Y + 6 + random() * 10;
      const spread = 1.2 + (y - GROUND_Y - 6) * 0.25;
      o.position.set(c.x + (random() - 0.5) * spread * 2, y, c.z + (random() - 0.5) * spread * 2);
      o.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      const s = 1.1 + random() * 1.3;
      o.scale.set(s * 1.6, s * 0.45, s);
      return random() > 0.5 ? '#3f6f2a' : '#5b8a34';
    };
  }, [clumps]);
  useInstances(culms, culmCount, placeCulm);
  useInstances(leaves, leafCount, placeLeaf);
  return (
    <group>
      <instancedMesh ref={culms} args={[undefined, undefined, culmCount]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 1, 6]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, leafCount]} castShadow>
        <icosahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
    </group>
  );
}

/** The old banyan tree (cây đa) at the corner of the courtyard. */
function Banyan() {
  const canopy = useRef<InstancedMesh>(null);
  const roots = useRef<InstancedMesh>(null);
  const place = useMemo(() => {
    const random = seededRandom(41);
    return (o: Object3D) => {
      const a = random() * Math.PI * 2;
      const r = random() * 7;
      o.position.set(Math.cos(a) * r, 11 + random() * 4 - r * 0.3, Math.sin(a) * r);
      const s = 2.4 + random() * 2.2;
      o.scale.set(s * 1.3, s * 0.8, s * 1.3);
      return random() > 0.5 ? '#2f5a26' : '#3c6b2c';
    };
  }, []);
  const placeRoot = useMemo(() => {
    const random = seededRandom(43);
    return (o: Object3D) => {
      const a = random() * Math.PI * 2;
      const r = 1.6 + random() * 4.5;
      const h = 9 + random() * 2;
      o.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      o.scale.set(1, h, 1);
      return '#6b5640';
    };
  }, []);
  useInstances(canopy, 26, place);
  useInstances(roots, 22, placeRoot);
  return (
    <group position={[-17, GROUND_Y, -13]}>
      <mesh position-y={5} castShadow>
        <cylinderGeometry args={[1.3, 2.2, 10, 12]} />
        <meshStandardMaterial color="#6e5741" roughness={0.95} />
      </mesh>
      {[0.6, 2.2, 4.1].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 2.2, 9.5, Math.sin(a) * 2.2]}
          rotation={[Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7]}
          castShadow
        >
          <cylinderGeometry args={[0.5, 0.8, 6, 8]} />
          <meshStandardMaterial color="#6e5741" roughness={0.95} />
        </mesh>
      ))}
      <instancedMesh ref={roots} args={[undefined, undefined, 22]}>
        <cylinderGeometry args={[0.07, 0.1, 1, 5]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh ref={canopy} args={[undefined, undefined, 26]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
    </group>
  );
}

/** The village communal house (đình) with its sweeping tiled roof. */
function Dinh() {
  const roof = useMemo(() => {
    // Profile of one roof slope with the eaves curling up at the end.
    const pts: Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new Vector2(t * 7.5, 4.2 - t * 4.2 + Math.pow(t, 6) * 1.6));
    }
    return roofSlope(pts);
  }, []);
  const pillars = [];
  for (let x = -9; x <= 9; x += 3) for (const z of [-3, 3]) pillars.push([x, z]);
  return (
    <group position={[4, GROUND_Y, -30]}>
      <mesh position-y={0.5} receiveShadow castShadow>
        <boxGeometry args={[22, 1, 10]} />
        <meshStandardMaterial color="#9b8a76" roughness={0.95} />
      </mesh>
      {pillars.map(([x, z], i) => (
        <mesh key={i} position={[x ?? 0, 3.5, z ?? 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.36, 5, 10]} />
          <meshStandardMaterial color="#7a2e22" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 3.5, -3]}>
        <boxGeometry args={[19, 5, 0.3]} />
        <meshStandardMaterial color="#5c3a28" roughness={0.8} />
      </mesh>
      {/* Two curved slopes meeting at the ridge, eaves curling up. */}
      {[1, -1].map((side) => (
        <mesh key={side} geometry={roof} position={[0, 6, 0]} scale={[1, 1, side]} castShadow>
          <meshStandardMaterial color="#4b3a33" roughness={0.85} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 10.3, 0]} castShadow>
        <boxGeometry args={[23, 0.5, 0.6]} />
        <meshStandardMaterial color="#5b463d" roughness={0.8} />
      </mesh>
      {/* Upturned ridge ends. */}
      {[-11.5, 11.5].map((x) => (
        <mesh key={x} position={[x, 10.9, 0]} rotation-z={x > 0 ? -0.5 : 0.5}>
          <coneGeometry args={[0.35, 1.6, 6]} />
          <meshStandardMaterial color="#5b463d" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** A roof slope 24 long following `profile` (x = distance from the ridge, y = height). */
const roofSlope = (profile: Vector2[]) => {
  const positions: number[] = [];
  const indices: number[] = [];
  const half = 12;
  profile.forEach((p) => positions.push(-half, p.y, p.x, half, p.y, p.x));
  for (let i = 0; i < profile.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
};

/** Rice-straw stacks and clay jars at the edge of the yard. */
function Props() {
  const jar = useMemo(
    () =>
      new LatheGeometry(
        [0, 0.3, 0.75, 0.95, 0.9, 0.6, 0.45, 0.5].map((r, i) => new Vector2(r, (i / 7) * 1.9)),
        20,
      ),
    [],
  );
  return (
    <group>
      {[
        [15, 9],
        [17.5, 5],
        [13, 13],
      ].map(([x, z], i) => (
        <group key={i} position={[x ?? 0, GROUND_Y, z ?? 0]}>
          <mesh position-y={1.6} castShadow>
            <sphereGeometry args={[2.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
            <meshStandardMaterial color="#d8b25c" roughness={1} />
          </mesh>
          <mesh position-y={0.8} castShadow>
            <cylinderGeometry args={[1.95, 2.1, 1.6, 16]} />
            <meshStandardMaterial color="#c9a14d" roughness={1} />
          </mesh>
          <mesh position-y={3.9}>
            <cylinderGeometry args={[0.06, 0.06, 1.4, 6]} />
            <meshStandardMaterial color="#5c4630" />
          </mesh>
        </group>
      ))}
      {[
        [-14, 8],
        [-15.5, 6.2],
        [-12.8, 9.6],
      ].map(([x, z], i) => (
        <mesh
          key={i}
          geometry={jar}
          position={[x ?? 0, GROUND_Y, z ?? 0]}
          scale={0.8 + i * 0.12}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#7b4a2c" roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

/** Strings of red lanterns over the yard; they glow at dusk and at night. */
function Lanterns({ glow }: { glow: number }) {
  const lanterns = useMemo(() => {
    const list: [number, number, number][] = [];
    const lines: [Vector3, Vector3][] = [
      [new Vector3(-16, 4.5, -12), new Vector3(16, 4.5, -12)],
      [new Vector3(-16, 4.5, -12), new Vector3(-16, 4.5, 10)],
      [new Vector3(16, 4.5, -12), new Vector3(16, 4.5, 10)],
    ];
    for (const [a, b] of lines) {
      const n = Math.round(a.distanceTo(b) / 2.6);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(Math.PI * t) * 1.4 + 0.6;
        list.push([p.x, p.y, p.z]);
      }
    }
    return { list, lines };
  }, []);
  return (
    <group>
      {[
        [-16, -12],
        [16, -12],
        [-16, 10],
        [16, 10],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x ?? 0, (GROUND_Y + 4.6) / 2, z ?? 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.15, 4.6 - GROUND_Y, 8]} />
          <meshStandardMaterial color="#5c4630" roughness={0.9} />
        </mesh>
      ))}
      {lanterns.list.map((p, i) => (
        <group key={i} position={p}>
          <mesh scale={[1, 1.25, 1]}>
            <sphereGeometry args={[0.38, 14, 10]} />
            <meshStandardMaterial
              color="#d8382c"
              emissive="#ff6a2a"
              emissiveIntensity={glow}
              roughness={0.6}
              toneMapped={glow < 0.1}
            />
          </mesh>
          <mesh position-y={0.52}>
            <cylinderGeometry args={[0.16, 0.16, 0.12, 10]} />
            <meshStandardMaterial color="#e2b23c" />
          </mesh>
        </group>
      ))}
      {glow > 0.1 &&
        [
          [-8, 2.5, -12],
          [8, 2.5, -12],
          [-16, 2.5, 0],
          [16, 2.5, 0],
        ].map((p, i) => (
          <pointLight
            key={i}
            position={p as [number, number, number]}
            color="#ff9a4a"
            intensity={glow * 18}
            distance={22}
            decay={1.6}
          />
        ))}
    </group>
  );
}

/** Distant hills on the horizon. */
function Hills({ color }: { color: string }) {
  const ref = useRef<InstancedMesh>(null);
  const place = useMemo(() => {
    const random = seededRandom(51);
    return (o: Object3D, i: number) => {
      const a = (i / 16) * Math.PI * 2 + random() * 0.3;
      const r = 95 + random() * 25;
      o.position.set(Math.cos(a) * r, GROUND_Y, Math.sin(a) * r);
      const s = 14 + random() * 16;
      o.scale.set(s * 1.8, s, s * 1.2);
      return undefined;
    };
  }, []);
  useInstances(ref, 16, place);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 16]}>
      <coneGeometry args={[1, 1, 7]} />
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </instancedMesh>
  );
}

/** Stars and fireflies at night. */
function NightSparkles() {
  const fireflies = useRef<Points>(null);
  const { stars, flies } = useMemo(() => {
    const random = seededRandom(61);
    const s: number[] = [];
    for (let i = 0; i < 700; i++) {
      const a = random() * Math.PI * 2;
      const e = Math.asin(random() * 0.95 + 0.05);
      s.push(Math.cos(a) * Math.cos(e) * 140, Math.sin(e) * 140, Math.sin(a) * Math.cos(e) * 140);
    }
    const f: number[] = [];
    for (let i = 0; i < 60; i++) {
      const a = random() * Math.PI * 2;
      const r = 12 + random() * 14;
      f.push(Math.cos(a) * r, GROUND_Y + 1 + random() * 5, Math.sin(a) * r);
    }
    return { stars: new Float32Array(s), flies: new Float32Array(f) };
  }, []);
  useFrame(({ clock }) => {
    const p = fireflies.current;
    if (!p) return;
    p.rotation.y = clock.elapsedTime * 0.02;
    p.position.y = Math.sin(clock.elapsedTime * 0.7) * 0.4;
  });
  return (
    <group>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={0.7} sizeAttenuation fog={false} />
      </points>
      <points ref={fireflies}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[flies, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#e8ff8a" size={0.25} sizeAttenuation toneMapped={false} />
      </points>
    </group>
  );
}

export function Village({ time, shadowMapSize }: { time: TimeOfDay; shadowMapSize: number }) {
  const a = ATMOSPHERE[time];
  return (
    <group>
      <fog attach="fog" args={[a.fog, 40, 150]} />
      <Sky time={time} />
      <hemisphereLight args={[a.hemiSky, a.hemiGround, a.hemiIntensity]} />
      <directionalLight
        position={a.sunPosition}
        color={a.sun}
        intensity={a.sunIntensity}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <Ground />
      <Bamboo />
      <Banyan />
      <Dinh />
      <Props />
      <Lanterns glow={a.lanterns} />
      <Hills color={time === 'night' ? '#1c2747' : time === 'sunset' ? '#7c6a8a' : '#8fb0a8'} />
      {time === 'night' && <NightSparkles />}
    </group>
  );
}
