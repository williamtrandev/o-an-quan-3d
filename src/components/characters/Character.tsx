'use client';

import { Outlines, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  Matrix4,
  MeshStandardMaterial,
  MeshToonMaterial,
  Quaternion,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TextureLoader,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Group,
  type Mesh,
} from 'three';
import { BUILD_WIDTH, type Avatar } from '@/lib/avatar';
import { bake, place, type Placed } from '@/lib/bake';
import { toonRamp } from '@/lib/toon';
import { seededRandom } from '@/lib/random';
import { segmentRotation, solveTwoBone } from '@/lib/rig';

export type Activity = 'idle' | 'thinking' | 'won' | 'lost';

export interface Reach {
  target: Vector3;
  key: number;
}

interface CharacterProps {
  avatar: Avatar;
  activity: Activity;
  /** World point the character looks at. */
  focus: Vector3;
  /** World point to reach towards; a new `key` replays the gesture. */
  reach: Reach | null;
  /** How to draw the character when it stands between the camera and the board. */
  /** How to draw the character when it stands between the camera and the board. */
  occlusion: OwnAvatarMode;
  wood: string;
}

// Body layout at chibi scale, in the character's local space: origin on the chair seat,
// facing -Z (towards the board). The parent group scales it up.
const HIP_Y = 0.3;
const SHOULDER_Y = 1.32;
const HEAD_Y = 2.17;
const HEAD_R = 0.62;
const UPPER_ARM = 0.58;
const FOREARM = 0.6;
const GESTURE_TIME = 1.1;

/** Ink outline drawn around the main shapes for a cartoon look. */
const INK = '#2a1c18';
/** Outline width in drawing-buffer pixels (drei measures it in pixels, not world units). */
const OUTLINE = 2.5;

const FRONT = new Vector3(0, 0, -1);
const UP = new Vector3(0, 1, 0);

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

const OutlineContext = createContext(true);

/** Turns the characters' ink outlines on or off (they double the draw calls). */
/** How a character is drawn when it blocks the view of the board. */
export type OwnAvatarMode = 'show' | 'fade' | 'hide';

export function CharacterOutlines({ value, children }: { value: boolean; children: ReactNode }) {
  return <OutlineContext.Provider value={value}>{children}</OutlineContext.Provider>;
}

function Ink() {
  const enabled = useContext(OutlineContext);
  return enabled ? <Outlines name="outline" thickness={OUTLINE} color={INK} /> : null;
}

/** Bakes placed parts into one geometry, disposing the temporary source geometries. */
const bakeOnce = (parts: Placed[], sources: BufferGeometry[]) => {
  const merged = bake(parts);
  sources.forEach((g) => g.dispose());
  return merged;
};

/** Capsule spanning two points, as a placed part. */
const segment = (capsule: BufferGeometry, from: Vector3, to: Vector3): Placed => ({
  geometry: capsule,
  matrix: place(from.clone().add(to).multiplyScalar(0.5), segmentRotation(from, to)),
});

/** A point on the face (x, y on the front of the head) with -Z pointing out of the skin. */
const onFace = (x: number, y: number, lift = 0) => {
  const z = -Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - y * y));
  const normal = v(x, y, z).normalize();
  return {
    position: normal.clone().multiplyScalar(HEAD_R + lift),
    quaternion: new Quaternion().setFromUnitVectors(FRONT, normal),
  };
};

/** Direction on the head for a polar angle from the crown and an azimuth from the front. */
const headDirection = (polar: number, azimuth: number) =>
  v(Math.sin(polar) * Math.sin(azimuth), Math.cos(polar), -Math.sin(polar) * Math.cos(azimuth));

/** The chair, baked into a single mesh. */
function Chair({ wood }: { wood: string }) {
  const geometry = useMemo(() => {
    const seat = new BoxGeometry(1.5, 0.16, 1.4);
    const back = new BoxGeometry(1.35, 0.5, 0.1);
    const leg = new CylinderGeometry(0.07, 0.06, 1.6, 8);
    const post = new CylinderGeometry(0.07, 0.07, 1.45, 8);
    return bakeOnce(
      [
        { geometry: seat, matrix: place([0, -0.08, 0.05]) },
        { geometry: back, matrix: place([0, 1.05, 0.72]) },
        ...[
          [-0.6, -0.55],
          [0.6, -0.55],
          [-0.6, 0.65],
          [0.6, 0.65],
        ].map(([x = 0, z = 0]) => ({ geometry: leg, matrix: place([x, -0.95, z]) })),
        ...[-0.6, 0.6].map((x) => ({ geometry: post, matrix: place([x, 0.65, 0.7]) })),
      ],
      [seat, back, leg, post],
    );
  }, []);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: wood, roughness: 0.72 }),
    [wood],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}

type Mat = MeshToonMaterial | MeshStandardMaterial;

const useMaterials = (avatar: Avatar) =>
  useMemo(() => {
    const robot = avatar.kind === 'robot';
    const make = (color: Color | string): Mat =>
      robot
        ? new MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 })
        : new MeshToonMaterial({ color, gradientMap: toonRamp() });
    const flat = (color: string) => new MeshToonMaterial({ color, gradientMap: toonRamp() });
    const blush = flat('#ff7f8f');
    blush.transparent = true;
    blush.opacity = 0.5;
    blush.userData.baseOpacity = 0.5;
    return {
      skin: make(avatar.skin),
      hair: make(avatar.hair),
      top: make(avatar.top),
      trim: make(new Color(avatar.top).multiplyScalar(0.72)),
      bottom: make(avatar.bottom),
      shoes: make(avatar.shoes),
      sole: flat('#f4f1ec'),
      ink: flat('#24160f'),
      iris: flat('#6b4a36'),
      white: flat('#ffffff'),
      mouth: flat('#7a2a32'),
      tongue: flat('#ff8d9c'),
      blush,
      visor: new MeshStandardMaterial({ color: '#0b1220', roughness: 0.15, metalness: 0.4 }),
      glow: new MeshStandardMaterial({
        color: '#0b1220',
        emissive: avatar.hair,
        emissiveIntensity: 2.4,
      }),
    };
  }, [avatar]);

type Materials = ReturnType<typeof useMaterials>;

interface HairPart {
  geometry: BufferGeometry;
  position?: Vector3;
  quaternion?: Quaternion;
  scale?: [number, number, number];
}

/** An elongated lock of hair lying on the head, hanging towards the chin. */
const lock = (
  blob: BufferGeometry,
  polar: number,
  azimuth: number,
  length: number,
  width: number,
  tilt = 0,
): HairPart => {
  const normal = headDirection(polar, azimuth);
  const along = UP.clone().addScaledVector(normal, -normal.y).normalize();
  const side = new Vector3().crossVectors(along, normal).normalize();
  const quaternion = new Quaternion()
    .setFromRotationMatrix(new Matrix4().makeBasis(side, along, normal))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), tilt));
  return {
    geometry: blob,
    position: normal.multiplyScalar(HEAD_R * 1.03),
    quaternion,
    scale: [width, length, 0.1],
  };
};

function Hair({ avatar, material }: { avatar: Avatar; material: Mat }) {
  const parts = useMemo(() => {
    const style = avatar.hairStyle;
    if (avatar.kind === 'robot' || style === 'bald') return [];
    const blob = new SphereGeometry(1, 18, 14);
    const list: HairPart[] = [
      // Crown and the back of the head.
      {
        geometry: new SphereGeometry(
          HEAD_R * (style === 'buzz' ? 1.025 : 1.07),
          36,
          18,
          0,
          Math.PI * 2,
          0,
          style === 'buzz' ? 1.12 : 1.02,
        ),
      },
      {
        geometry: new SphereGeometry(
          HEAD_R * (style === 'buzz' ? 1.02 : 1.06),
          36,
          18,
          -0.25,
          Math.PI + 0.5,
          0.25,
          { short: 2.2, long: 2.4, bun: 2.15, curly: 2.2, buzz: 2.0 }[style],
        ),
      },
    ];
    if (style === 'buzz') return list;

    if (style === 'curly') {
      const random = seededRandom(17);
      for (let i = 0; i < 34; i++) {
        const polar = 0.2 + random() * 1.7;
        const azimuth = random() * Math.PI * 2 - Math.PI;
        if (polar > 0.95 && Math.abs(azimuth) < 1.2) continue; // keep the face clear
        list.push({
          geometry: blob,
          position: headDirection(polar, azimuth).multiplyScalar(HEAD_R * 1.08),
          scale: Array(3).fill(0.17 + random() * 0.06) as [number, number, number],
        });
      }
      for (let i = 0; i < 6; i++) {
        list.push({
          geometry: blob,
          position: headDirection(0.95, -0.95 + i * 0.38).multiplyScalar(HEAD_R * 1.06),
          scale: [0.15, 0.14, 0.15],
        });
      }
      return list;
    }

    // Fringe across the forehead, with locks of alternating length.
    const swept = style === 'bun' ? 0.45 : 0;
    const fringe = style === 'bun' ? 5 : 6;
    for (let i = 0; i < fringe; i++) {
      const azimuth = -0.85 + (1.7 * i) / (fringe - 1);
      list.push(lock(blob, 0.92, azimuth, i % 2 ? 0.25 : 0.3, 0.2, swept - azimuth * 0.15));
    }
    // Side locks in front of the ears.
    for (const side of [-1, 1]) {
      list.push(
        style === 'long'
          ? lock(blob, 1.5, side * 1.5, 0.55, 0.17, side * 0.05)
          : lock(blob, 1.25, side * 1.52, 0.26, 0.15, side * 0.1),
      );
    }
    if (style === 'long') {
      list.push({
        geometry: new CapsuleGeometry(0.48, 0.75, 8, 20),
        position: v(0, -0.7, 0.3),
        scale: [1.2, 1, 0.55],
      });
    }
    if (style === 'bun') {
      list.push({
        geometry: blob,
        position: headDirection(0.55, Math.PI).multiplyScalar(HEAD_R * 1.25),
        scale: [0.27, 0.25, 0.27],
      });
    }
    return list;
  }, [avatar.hairStyle, avatar.kind]);
  // All locks share the hair material, so they draw (and outline) as a single mesh.
  const geometry = useMemo(
    () =>
      parts.length
        ? bakeOnce(
            parts.map((part) => ({
              geometry: part.geometry,
              matrix: place(part.position ?? [0, 0, 0], part.quaternion, part.scale ?? 1),
            })),
            [...new Set(parts.map((p) => p.geometry))],
          )
        : null,
    [parts],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;
  return (
    <mesh key={avatar.hairStyle} geometry={geometry} material={material} castShadow>
      <Ink />
    </mesh>
  );
}

const pawnShape = () => {
  const shape = new Shape();
  shape.moveTo(-0.065, -0.075);
  shape.lineTo(0.065, -0.075);
  shape.lineTo(0.05, -0.05);
  shape.lineTo(0.025, -0.04);
  shape.lineTo(0.018, 0.015);
  shape.lineTo(0.035, 0.022);
  shape.lineTo(-0.035, 0.022);
  shape.lineTo(-0.018, 0.015);
  shape.lineTo(-0.025, -0.04);
  shape.lineTo(-0.05, -0.05);
  shape.closePath();
  return shape;
};

const EYE_X = 0.215;
const EYE_Y = -0.07;

function Face({
  avatar,
  materials,
  activity,
}: {
  avatar: Avatar;
  materials: Materials;
  activity: Activity;
}) {
  const eyes = useRef<(Group | null)[]>([]);
  const offset = useMemo(
    () => [...avatar.name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 7,
    [avatar.name],
  );
  useFrame(({ clock }) => {
    // Blink every few seconds: close and reopen within 0.16 s.
    const phase = (clock.elapsedTime + offset) % 4.3;
    const open = phase < 0.16 ? Math.max(0.08, Math.abs(phase / 0.08 - 1)) : 1;
    const lid = activity === 'lost' ? 0.7 : 1;
    for (const eye of eyes.current) if (eye) eye.scale.y = open * lid;
  });

  const texture = useMemo(() => {
    if (!avatar.useFace || !avatar.face) return null;
    const t = new TextureLoader().load(avatar.face);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [avatar.face, avatar.useFace]);
  const decal = useMemo(
    () =>
      texture
        ? new MeshStandardMaterial({
            map: texture,
            transparent: true,
            roughness: 0.8,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
          })
        : null,
    [texture],
  );
  useEffect(
    () => () => {
      texture?.dispose();
      decal?.dispose();
    },
    [texture, decal],
  );
  const geometries = useMemo(
    () => ({
      decal: new SphereGeometry(
        HEAD_R * 1.012,
        32,
        24,
        (3 * Math.PI) / 2 - 0.95,
        1.9,
        Math.PI / 2 - 0.8,
        1.5,
      ),
      blob: new SphereGeometry(1, 20, 14),
      arc: new TorusGeometry(1, 0.17, 8, 24, Math.PI),
      ring: new TorusGeometry(1, 0.35, 8, 20),
      disc: new CircleGeometry(1, 24),
      half: new CircleGeometry(1, 24, Math.PI, Math.PI),
      brow: new CapsuleGeometry(0.022, 0.1, 4, 8),
    }),
    [],
  );
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries]);

  // Both eyes, brows, cheeks and ears are baked per material, so the face costs a handful
  // of draw calls instead of two dozen. The eyes are baked around their own height so a
  // single vertical scale blinks both.
  const face = useMemo(() => {
    const { blob, arc, disc, brow } = geometries;
    const eyeHeight = onFace(EYE_X, EYE_Y, -0.005).position.y;
    const pivot = new Matrix4().makeTranslation(0, -eyeHeight, 0);
    const eyePart = (side: number, geometry: BufferGeometry, local: Matrix4): Placed => {
      const frame = onFace(side * EYE_X, EYE_Y, -0.005);
      return {
        geometry,
        matrix: pivot.clone().multiply(place(frame.position, frame.quaternion)).multiply(local),
      };
    };
    const onBoth = (make: (side: number) => Placed) => [make(-1), make(1)];
    const surface = (
      x: number,
      y: number,
      lift: number,
      geometry: BufferGeometry,
      local: Matrix4,
    ) => {
      const frame = onFace(x, y, lift);
      return { geometry, matrix: place(frame.position, frame.quaternion).multiply(local) };
    };
    const browAngle = { idle: 0, thinking: 0.32, won: -0.1, lost: -0.35 }[activity];
    const browLift = activity === 'won' ? 0.04 : 0;
    const happy = activity === 'won';
    return {
      eyeHeight,
      ink: bake(
        happy
          ? onBoth((side) => eyePart(side, arc, place([0, 0, 0], undefined, [0.08, 0.08, 0.2])))
          : [
              ...onBoth((side) =>
                eyePart(side, blob, place([0, 0, 0], undefined, [0.088, 0.125, 0.035])),
              ),
              // Upper lash line.
              ...onBoth((side) =>
                eyePart(side, arc, place([0, 0.005, -0.022], undefined, [0.1, 0.13, 0.2])),
              ),
            ],
      ),
      iris: happy
        ? null
        : bake(
            onBoth((side) =>
              eyePart(side, blob, place([0, -0.04, -0.006], undefined, [0.06, 0.06, 0.032])),
            ),
          ),
      shine: happy
        ? null
        : bake([
            ...onBoth((side) =>
              eyePart(side, blob, place([side * -0.028, 0.042, -0.03], undefined, 0.032)),
            ),
            ...onBoth((side) =>
              eyePart(side, blob, place([side * 0.03, -0.055, -0.026], undefined, 0.016)),
            ),
          ]),
      brows: bake(
        onBoth((side) =>
          surface(
            side * EYE_X,
            0.115 + browLift,
            0.01,
            brow,
            place([0, 0, 0], new Euler(0, 0, Math.PI / 2 + side * browAngle)),
          ),
        ),
      ),
      blush: bake(
        onBoth((side) =>
          surface(
            side * 0.34,
            -0.18,
            0.004,
            disc,
            place([0, 0, 0], new Euler(0, Math.PI, 0), [0.085, 0.055, 1]),
          ),
        ),
      ),
      ears: bake(
        onBoth((side) => ({
          geometry: blob,
          matrix: place([side * HEAD_R * 0.97, -0.06, 0.03], undefined, [0.07, 0.13, 0.1]),
        })),
      ),
    };
  }, [geometries, activity]);
  useEffect(
    () => () =>
      [face.ink, face.iris, face.shine, face.brows, face.blush, face.ears].forEach((g) =>
        g?.dispose(),
      ),
    [face],
  );

  if (avatar.kind === 'robot') {
    const happy = activity === 'won';
    return (
      <group>
        <RoundedBox
          args={[1.08, 0.58, 0.14]}
          radius={0.07}
          position={[0, -0.02, -0.56]}
          material={materials.visor}
        />
        {[-1, 1].map((side, i) => (
          <group
            key={side}
            ref={(g) => {
              eyes.current[i] = g;
            }}
            position={[side * 0.24, 0.0, -0.64]}
          >
            {happy ? (
              <mesh geometry={geometries.arc} material={materials.glow} scale={[0.1, 0.1, 0.15]} />
            ) : (
              <mesh
                geometry={geometries.blob}
                material={materials.glow}
                scale={[0.09, activity === 'thinking' ? 0.05 : 0.12, 0.03]}
              />
            )}
          </group>
        ))}
        <mesh position={[0, 0.78, 0]} material={materials.ink}>
          <cylinderGeometry args={[0.035, 0.035, 0.36, 8]} />
        </mesh>
        <mesh position={[0, 1.0, 0]} material={materials.glow}>
          <sphereGeometry args={[0.1, 14, 12]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.68, 0, 0]}
            rotation-z={Math.PI / 2}
            material={materials.trim}
          >
            <cylinderGeometry args={[0.16, 0.16, 0.12, 20]} />
            <Ink />
          </mesh>
        ))}
      </group>
    );
  }

  if (decal) {
    return <mesh geometry={geometries.decal} material={decal} />;
  }

  return (
    <group>
      <group
        ref={(g) => {
          eyes.current[0] = g;
        }}
        position={[0, face.eyeHeight, 0]}
      >
        <mesh geometry={face.ink} material={materials.ink} />
        {face.iris && <mesh geometry={face.iris} material={materials.iris} />}
        {face.shine && <mesh geometry={face.shine} material={materials.white} />}
      </group>
      <mesh geometry={face.brows} material={materials.hair} />
      <mesh geometry={face.blush} material={materials.blush} />
      <mesh geometry={face.ears} material={materials.skin}>
        <Ink />
      </mesh>
      <group {...onFace(0, -0.16)}>
        <mesh geometry={geometries.blob} material={materials.skin} scale={[0.035, 0.028, 0.03]} />
      </group>
      <group {...onFace(0, -0.26, 0.002)}>
        {activity === 'won' ? (
          <>
            <mesh
              geometry={geometries.half}
              material={materials.mouth}
              rotation-y={Math.PI}
              scale={[0.1, 0.09, 1]}
            />
            <mesh
              geometry={geometries.disc}
              material={materials.tongue}
              position={[0, -0.06, -0.002]}
              rotation-y={Math.PI}
              scale={[0.05, 0.025, 1]}
            />
          </>
        ) : activity === 'thinking' ? (
          <mesh geometry={geometries.ring} material={materials.ink} scale={[0.028, 0.024, 0.1]} />
        ) : activity === 'lost' ? (
          <mesh
            geometry={geometries.arc}
            material={materials.ink}
            position={[0, -0.03, 0]}
            scale={[0.065, 0.045, 0.2]}
          />
        ) : (
          <mesh
            geometry={geometries.arc}
            material={materials.ink}
            rotation-z={Math.PI}
            scale={[0.075, 0.06, 0.2]}
          />
        )}
      </group>
    </group>
  );
}

/** Rounded, slightly pear-shaped torso, built as a lathe around the body axis. */
const torsoProfile = [
  [0, -0.06],
  [0.28, -0.05],
  [0.4, 0.02],
  [0.46, 0.18],
  [0.48, 0.4],
  [0.46, 0.62],
  [0.42, 0.8],
  [0.34, 0.94],
  [0.22, 1.03],
  [0.12, 1.07],
  [0, 1.08],
].map(([r, y]) => new Vector2(r, y));

/**
 * A chibi character sitting on a chair at the table, breathing, blinking, following the
 * game with its eyes, reaching when it moves, and celebrating or sulking at the end.
 */
export function Character({ avatar, activity, focus, reach, occlusion, wood }: CharacterProps) {
  const materials = useMaterials(avatar);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const bodyMeshes = useRef<Group>(null);
  const head = useRef<Group>(null);
  const arms = {
    left: { upper: useRef<Mesh>(null), fore: useRef<Mesh>(null), hand: useRef<Mesh>(null) },
    right: { upper: useRef<Mesh>(null), fore: useRef<Mesh>(null), hand: useRef<Mesh>(null) },
  };
  const gesture = useRef({ key: -1, time: GESTURE_TIME, target: new Vector3() });
  const hands = useRef({ left: v(-0.42, 1.3, -1.15), right: v(0.42, 1.3, -1.15) });
  const opacity = useRef(1);
  const outlined = useRef(true);
  /** Materials the current opacity was last written to (they are rebuilt when the avatar changes). */
  const faded = useRef<Mat[] | null>(null);

  const width = BUILD_WIDTH[avatar.build];
  const legs = useMemo(
    () =>
      [-1, 1].map((side) => ({
        hip: v(side * 0.2 * width, HIP_Y, -0.05),
        knee: v(side * 0.25, HIP_Y, -0.82),
        ankle: v(side * 0.25, -1.36, -0.92),
        shoe: v(side * 0.25, -1.47, -1.06),
      })),
    [width],
  );
  const geometry = useMemo(
    () => ({
      torso: new LatheGeometry(torsoProfile, 32),
      upper: new CapsuleGeometry(0.155, UPPER_ARM, 6, 14),
      fore: new CapsuleGeometry(0.12, FOREARM, 6, 14),
      hand: new SphereGeometry(0.165, 18, 14),
      shoe: new SphereGeometry(1, 20, 14),
      badge: new CircleGeometry(0.12, 28),
      pawn: (() => {
        const body = new ShapeGeometry(pawnShape());
        const top = new CircleGeometry(0.03, 16);
        return bakeOnce(
          [
            { geometry: body, matrix: place([0, 0, 0]) },
            { geometry: top, matrix: place([0, 0.045, 0]) },
          ],
          [body, top],
        );
      })(),
    }),
    [],
  );
  useEffect(() => () => Object.values(geometry).forEach((g) => g.dispose()), [geometry]);
  // Static parts sharing a material are baked together: one draw call (and shadow) each.
  const baked = useMemo(() => {
    const limbs: BufferGeometry[] = [];
    const limb = (from: Vector3, to: Vector3, radius: number) => {
      const capsule = new CapsuleGeometry(radius, from.distanceTo(to), 6, 14);
      limbs.push(capsule);
      return segment(capsule, from, to);
    };
    const hips = new CapsuleGeometry(0.34, 0.45, 8, 16);
    const blob = new SphereGeometry(1, 20, 14);
    const hem = new TorusGeometry(0.36, 0.06, 10, 32);
    const collar = new TorusGeometry(0.15, 0.06, 10, 24);
    return {
      bottom: bake([
        {
          geometry: hips,
          matrix: place([0, HIP_Y, 0.02], new Euler(0, 0, Math.PI / 2), [1, width, 1]),
        },
        ...legs.flatMap((leg) => [
          limb(leg.hip, leg.knee, 0.22 * width),
          limb(leg.knee, leg.ankle, 0.18),
        ]),
      ]),
      shoes: bake(
        legs.map((leg) => ({
          geometry: blob,
          matrix: place(leg.shoe, undefined, [0.21, 0.16, 0.31]),
        })),
      ),
      soles: bake(
        legs.map((leg) => ({
          geometry: blob,
          matrix: place([leg.shoe.x, leg.shoe.y - 0.09, leg.shoe.z], undefined, [0.22, 0.05, 0.32]),
        })),
      ),
      trim: bakeOnce(
        [
          {
            geometry: hem,
            matrix: place([0, 0, 0], new Euler(Math.PI / 2, 0, 0), [width, 0.8, 1]),
          },
          { geometry: collar, matrix: place([0, 1.04, 0], new Euler(Math.PI / 2, 0, 0)) },
        ],
        [...limbs, hips, blob, hem, collar],
      ),
    };
  }, [legs, width]);
  useEffect(() => () => Object.values(baked).forEach((g) => g.dispose()), [baked]);
  const allMaterials = useMemo(() => Object.values(materials), [materials]);

  useFrame(({ clock, camera }, delta) => {
    const group = root.current;
    const upper = body.current;
    if (!group || !upper) return;
    const t = clock.elapsedTime;
    const k = 1 - Math.exp(-delta * 7);

    // Fade out when standing between the camera and the board.
    const seat = group.getWorldPosition(new Vector3());
    const seatAngle = Math.atan2(seat.x, seat.z);
    const cameraAngle = Math.atan2(camera.position.x, camera.position.z);
    const diff = Math.abs(
      Math.atan2(Math.sin(cameraAngle - seatAngle), Math.cos(cameraAngle - seatAngle)),
    );
    const horizontal = Math.hypot(camera.position.x, camera.position.z);
    const blocking = diff < 0.75 && horizontal > seat.length() * 0.6;
    const wanted = occlusion === 'show' || !blocking ? 1 : occlusion === 'fade' ? 0.2 : 0;
    const previous = opacity.current;
    opacity.current += (wanted - opacity.current) * (1 - Math.exp(-delta * 6));
    if (
      Math.abs(previous - opacity.current) > 0.001 ||
      (wanted === 1 && previous !== 1) ||
      faded.current !== allMaterials
    ) {
      if (Math.abs(1 - opacity.current) < 0.005) opacity.current = 1;
      faded.current = allMaterials;
      for (const material of allMaterials) {
        const base = (material.userData.baseOpacity as number | undefined) ?? 1;
        const transparent = opacity.current < 1 || base < 1;
        // three.js compiles opaque materials with alpha forced to 1, so switching
        // transparency needs a shader rebuild.
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.opacity = base * opacity.current;
        material.depthWrite = opacity.current > 0.6;
      }
    }
    group.visible = opacity.current > 0.02;
    // Outlines are opaque shells, so drop them while the character is see-through
    // (checked every frame then, as remounted parts bring new outlines).
    if (outlined.current !== opacity.current > 0.99 || opacity.current <= 0.99) {
      outlined.current = opacity.current > 0.99;
      group.traverse((object) => {
        if (object.name === 'outline') object.visible = outlined.current;
      });
    }

    // Gesture towards a moved piece.
    if (reach && reach.key !== gesture.current.key) {
      gesture.current = {
        key: reach.key,
        time: 0,
        target: group.worldToLocal(reach.target.clone()),
      };
    }
    gesture.current.time = Math.min(GESTURE_TIME, gesture.current.time + delta);
    const g = Math.sin((gesture.current.time / GESTURE_TIME) * Math.PI);

    // Body: breathing, lean and bounce.
    const lean = { idle: 0.06, thinking: 0.12, won: -0.06, lost: 0.22 }[activity] + g * 0.22;
    upper.rotation.x += (-lean - upper.rotation.x) * k;
    const bounce = activity === 'won' ? Math.abs(Math.sin(t * 6)) * 0.1 : 0;
    upper.position.y = HIP_Y + bounce;
    bodyMeshes.current?.scale.set(1, 1 + Math.sin(t * 1.7) * 0.015, 1);

    // Head follows the focus point.
    const neck = head.current;
    if (neck) {
      const local = upper.worldToLocal(focus.clone()).sub(neck.position);
      let yaw = Math.atan2(-local.x, -local.z);
      let pitch = Math.atan2(local.y, Math.hypot(local.x, local.z));
      yaw = Math.max(-0.8, Math.min(0.8, yaw)) + Math.sin(t * 0.5) * 0.04;
      pitch = Math.max(-0.45, Math.min(0.35, pitch));
      if (activity === 'lost') pitch = -0.45;
      if (activity === 'won') pitch = 0.3;
      const tilt = activity === 'thinking' ? 0.16 : 0;
      neck.rotation.y += (yaw - neck.rotation.y) * k;
      neck.rotation.x += (pitch - neck.rotation.x) * k;
      neck.rotation.z += (tilt - neck.rotation.z) * k;
    }

    // Hands: rest on the table, chin when thinking, up when winning, reach when moving.
    const rest = (side: number) =>
      v(side * 0.42, 1.3 + Math.max(0, Math.sin(t * 2.3 + side)) * 0.03, -1.15);
    const targets = {
      left: rest(-1),
      right: activity === 'thinking' ? v(0.2, 1.52, -0.62) : rest(1),
    };
    if (activity === 'won') {
      targets.left = v(-1.0 + Math.sin(t * 8) * 0.12, 2.6, -0.05);
      targets.right = v(1.0 - Math.sin(t * 8) * 0.12, 2.6, -0.05);
    } else if (activity === 'lost') {
      targets.left = v(-0.28, 1.25, -0.95);
      targets.right = v(0.28, 1.25, -0.95);
    }
    if (g > 0.001) {
      const side = gesture.current.target.x >= 0 ? 'right' : 'left';
      targets[side] = targets[side].clone().lerp(gesture.current.target, g);
    }
    hands.current.left.lerp(targets.left, k);
    hands.current.right.lerp(targets.right, k);

    for (const [side, sign] of [
      ['left', -1],
      ['right', 1],
    ] as const) {
      const shoulder = v(sign * 0.46 * width, SHOULDER_Y - HIP_Y, -0.02);
      const target = upper.worldToLocal(group.localToWorld(hands.current[side].clone()));
      const { elbow, hand } = solveTwoBone(
        shoulder,
        target,
        UPPER_ARM,
        FOREARM,
        v(sign, -0.8, 0.6),
      );
      const parts = arms[side];
      parts.upper.current?.position.copy(shoulder).add(elbow).multiplyScalar(0.5);
      parts.upper.current?.quaternion.copy(segmentRotation(shoulder, elbow));
      parts.fore.current?.position.copy(elbow).add(hand).multiplyScalar(0.5);
      parts.fore.current?.quaternion.copy(segmentRotation(elbow, hand));
      parts.hand.current?.position.copy(hand);
    }
  });

  const robot = avatar.kind === 'robot';

  return (
    <group ref={root}>
      <Chair wood={wood} />
      <mesh geometry={baked.bottom} material={materials.bottom} castShadow>
        <Ink />
      </mesh>
      <mesh geometry={baked.shoes} material={materials.shoes} castShadow>
        <Ink />
      </mesh>
      <mesh geometry={baked.soles} material={robot ? materials.trim : materials.sole} />

      <group ref={body} position={[0, HIP_Y, 0]}>
        <group ref={bodyMeshes}>
          {robot ? (
            <RoundedBox
              args={[1.05 * width, 1.15, 0.8]}
              radius={0.26}
              position={[0, 0.55, 0]}
              material={materials.top}
              castShadow
            >
              <Ink />
            </RoundedBox>
          ) : (
            <>
              <mesh
                geometry={geometry.torso}
                material={materials.top}
                scale={[width, 1, 0.8]}
                castShadow
              >
                <Ink />
              </mesh>
              {/* Hem and collar */}
              <mesh geometry={baked.trim} material={materials.trim} />
            </>
          )}
          {/* Chest badge: a pawn for people, a light for the robot. */}
          <group position={[0, 0.6, robot ? -0.41 : -0.395]} rotation-y={Math.PI}>
            {robot ? (
              <mesh geometry={geometry.badge} material={materials.glow} />
            ) : (
              <>
                <mesh geometry={geometry.badge} material={materials.white} />
                <mesh geometry={geometry.pawn} material={materials.ink} position-z={0.004} />
              </>
            )}
          </group>
          <mesh position={[0, 1.13, 0]} material={materials.skin}>
            <cylinderGeometry args={[0.12, 0.13, 0.2, 14]} />
          </mesh>
        </group>

        <group ref={head} position={[0, HEAD_Y - HIP_Y, -0.02]} rotation-order="YXZ">
          {robot ? (
            <RoundedBox args={[1.28, 1.1, 1.14]} radius={0.26} material={materials.skin} castShadow>
              <Ink />
            </RoundedBox>
          ) : (
            <mesh material={materials.skin} castShadow>
              <sphereGeometry args={[HEAD_R, 40, 28]} />
              <Ink />
            </mesh>
          )}
          <Face avatar={avatar} materials={materials} activity={activity} />
          <Hair avatar={avatar} material={materials.hair} />
        </group>

        {(['left', 'right'] as const).map((side) => (
          <group key={side}>
            <mesh
              ref={arms[side].upper}
              geometry={geometry.upper}
              material={materials.top}
              castShadow
            >
              <Ink />
            </mesh>
            <mesh
              ref={arms[side].fore}
              geometry={geometry.fore}
              material={robot ? materials.top : materials.skin}
              castShadow
            >
              <Ink />
            </mesh>
            <mesh
              ref={arms[side].hand}
              geometry={geometry.hand}
              material={robot ? materials.trim : materials.skin}
              castShadow
            >
              <Ink />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
