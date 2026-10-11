import { Quaternion, Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);

/**
 * Two-bone IK: where the elbow goes so the hand reaches `target` (or as close as the arm
 * allows), bending towards `pole`. Returns the elbow and the reached hand position.
 */
export const solveTwoBone = (
  shoulder: Vector3,
  target: Vector3,
  upper: number,
  lower: number,
  pole: Vector3,
): { elbow: Vector3; hand: Vector3 } => {
  const toTarget = target.clone().sub(shoulder);
  const min = Math.abs(upper - lower) + 1e-3;
  const max = upper + lower - 1e-3;
  const distance = Math.min(max, Math.max(min, toTarget.length()));
  const dir = toTarget.lengthSq() > 1e-9 ? toTarget.normalize() : new Vector3(0, -1, 0);
  const hand = shoulder.clone().addScaledVector(dir, distance);

  // Law of cosines: distance from the shoulder to the elbow's projection on the arm line.
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));

  const bend = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (bend.lengthSq() < 1e-9) bend.set(1, 0, 0).addScaledVector(dir, -dir.x);
  bend.normalize();

  const elbow = shoulder.clone().addScaledVector(dir, along).addScaledVector(bend, height);
  return { elbow, hand };
};

/** Rotation that points a Y-aligned segment from `a` towards `b`. */
export const segmentRotation = (a: Vector3, b: Vector3): Quaternion =>
  new Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
