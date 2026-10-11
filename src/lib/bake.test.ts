import {
  Box3,
  Color,
  BoxGeometry,
  CircleGeometry,
  Euler,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { describe, expect, it } from 'vitest';
import { bake, place } from './bake';

const triangles = (g: BufferGeometry) =>
  (g.index ? g.index.count : g.getAttribute('position').count) / 3;

const bounds = (g: BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox ?? new Box3();
};

describe('bake', () => {
  it('merges placed geometries into one, keeping every triangle', () => {
    const box = new BoxGeometry(1, 1, 1);
    const sphere = new SphereGeometry(1, 8, 6);
    const merged = bake([
      { geometry: box, matrix: place([0, 0, 0]) },
      { geometry: sphere, matrix: place([5, 0, 0], undefined, 0.5) },
    ]);
    expect(triangles(merged)).toBe(triangles(box) + triangles(sphere));
    expect(merged.groups).toHaveLength(0);
  });

  it('applies each part transform and leaves the inputs untouched', () => {
    const box = new BoxGeometry(1, 1, 1);
    const merged = bake([{ geometry: box, matrix: place([10, 0, 0], undefined, [2, 1, 1]) }]);
    expect(bounds(merged).min.x).toBeCloseTo(9);
    expect(bounds(merged).max.x).toBeCloseTo(11);
    expect(bounds(box).max.x).toBeCloseTo(0.5);
  });

  it('rotates normals with the part', () => {
    const disc = new CircleGeometry(1, 8); // faces +Z
    const merged = bake([{ geometry: disc, matrix: place([0, 0, 0], new Euler(0, Math.PI, 0)) }]);
    const normal = new Vector3().fromBufferAttribute(merged.getAttribute('normal'), 0);
    expect(normal.z).toBeCloseTo(-1);
  });

  it('paints each part with its vertex colour, white for parts without one', () => {
    const red = new Color(1, 0, 0);
    const merged = bake([
      { geometry: new BoxGeometry(1, 1, 1), matrix: place([0, 0, 0]), color: red },
      { geometry: new BoxGeometry(1, 1, 1), matrix: place([3, 0, 0]) },
    ]);
    const colors = merged.getAttribute('color');
    expect([colors.getX(0), colors.getY(0), colors.getZ(0)]).toEqual([1, 0, 0]);
    expect(colors.getY(colors.count - 1)).toBe(1);
  });
});
