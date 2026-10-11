import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { segmentRotation, solveTwoBone } from './rig';

describe('solveTwoBone', () => {
  const shoulder = new Vector3(0, 0, 0);
  const pole = new Vector3(0, 0, 1);

  it('reaches a target within range with bones of the right length', () => {
    const target = new Vector3(0.8, -0.6, 0);
    const { elbow, hand } = solveTwoBone(shoulder, target, 0.7, 0.7, pole);
    expect(hand.distanceTo(target)).toBeLessThan(1e-6);
    expect(elbow.distanceTo(shoulder)).toBeCloseTo(0.7);
    expect(elbow.distanceTo(hand)).toBeCloseTo(0.7);
    expect(elbow.z).toBeGreaterThan(0);
  });

  it('stretches towards a target that is too far', () => {
    const { hand } = solveTwoBone(shoulder, new Vector3(5, 0, 0), 0.7, 0.6, pole);
    expect(hand.length()).toBeCloseTo(1.3, 2);
    expect(hand.x).toBeGreaterThan(1.29);
  });

  it('copes with a pole parallel to the arm', () => {
    const { elbow } = solveTwoBone(shoulder, new Vector3(0, 0, 1), 0.7, 0.7, new Vector3(0, 0, 1));
    expect(Number.isFinite(elbow.x)).toBe(true);
  });
});

describe('segmentRotation', () => {
  it('turns +Y towards the segment direction', () => {
    const q = segmentRotation(new Vector3(0, 0, 0), new Vector3(1, 0, 0));
    const v = new Vector3(0, 1, 0).applyQuaternion(q);
    expect(v.x).toBeCloseTo(1);
  });
});
