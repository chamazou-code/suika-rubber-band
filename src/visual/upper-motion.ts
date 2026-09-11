import { Vector3 } from 'three';
import type { BurstProfile } from './burst-profile';

// Unequal sections avoid the regular appearance of sliced wedges. Keep 72 rind segments total.
export const UPPER_SEAMS = [0, .78, 1.91, 2.78, 3.88, 5.07, Math.PI * 2];
export const UPPER_SEGMENTS = 12;
export const UPPER_SPEED = 6.1;
export const UPPER_GRAVITY = 9.81;

/** Shared by the rind and the pulp it sheds, keeping the breakup continuous. */
export function upperFlightPosition(time: number, height: number, profile: BurstProfile, target: Vector3) {
  return target.set(time * profile.driftX, height + UPPER_SPEED * profile.lift * time - UPPER_GRAVITY * .5 * time * time, time * profile.driftZ);
}
