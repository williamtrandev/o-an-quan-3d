import {
  BufferAttribute,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Color,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Vec = Vector3 | [number, number, number];

/** A geometry placed somewhere, to be baked into a merged geometry. */
export interface Placed {
  geometry: BufferGeometry;
  matrix: Matrix4;
  /** Vertex colour for this part; parts without one are white when others have one. */
  color?: Color;
}

const toVector = (v: Vec) => (Array.isArray(v) ? new Vector3(...v) : v);

/** Transform matrix from a position, an optional rotation (quaternion or Euler) and scale. */
export const place = (
  position: Vec,
  rotation?: Quaternion | Euler,
  scale: Vec | number = 1,
): Matrix4 =>
  new Matrix4().compose(
    toVector(position),
    rotation instanceof Euler
      ? new Quaternion().setFromEuler(rotation)
      : (rotation ?? new Quaternion()),
    typeof scale === 'number' ? new Vector3(scale, scale, scale) : toVector(scale),
  );

/**
 * Merges several placed geometries into one, so parts sharing a material draw in a single
 * call (and cast a single shadow) instead of one each. The inputs are left untouched.
 */
export const bake = (parts: Placed[]): BufferGeometry => {
  const colored = parts.some((part) => part.color);
  const prepared = parts.map(({ geometry, matrix, color }) => {
    // Mixed indexed and non-indexed inputs cannot be merged, so flatten them all.
    const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(copy.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') copy.deleteAttribute(name);
    }
    copy.morphAttributes = {};
    copy.clearGroups();
    if (colored) {
      const count = copy.getAttribute('position').count;
      const rgb = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        rgb[i * 3] = color?.r ?? 1;
        rgb[i * 3 + 1] = color?.g ?? 1;
        rgb[i * 3 + 2] = color?.b ?? 1;
      }
      copy.setAttribute('color', new BufferAttribute(rgb, 3));
    }
    return copy.applyMatrix4(matrix);
  });
  const merged = mergeGeometries(prepared);
  prepared.forEach((g) => g.dispose());
  if (!merged) throw new Error('bake: parts have incompatible attributes');
  return merged;
};
