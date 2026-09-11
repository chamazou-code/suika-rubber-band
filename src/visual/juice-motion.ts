import { Vector3 } from 'three';

const GRAVITY = 9.81;
export const JUICE_SURFACE = .025;

/** Gravity + linear air drag, sampled directly. Drops do not need a rigid-body solver. */
export class JuiceFlight {
  readonly duration: number;
  readonly impact = new Vector3();
  constructor(readonly origin: Vector3, readonly launch: Vector3, readonly drag = .38) {
    let lo = 0, hi = 4;
    for (let i = 0; i < 24; i++) {
      const time = (lo + hi) / 2;
      if (this.height(time) > JUICE_SURFACE) lo = time; else hi = time;
    }
    this.duration = (lo + hi) / 2;
    this.sample(this.duration, this.impact);
    this.impact.y = JUICE_SURFACE;
  }
  private travel(time: number) { return -Math.expm1(-this.drag * time) / this.drag; }
  private height(time: number) {
    const travel = this.travel(time);
    return this.origin.y + this.launch.y * travel - GRAVITY * (time - travel) / this.drag;
  }
  sample(age: number, position: Vector3, velocity?: Vector3) {
    const time = Math.max(0, Math.min(this.duration, Number.isFinite(age) ? age : 0));
    const travel = this.travel(time), decay = Math.exp(-this.drag * time);
    position.set(this.origin.x + this.launch.x * travel, Math.max(JUICE_SURFACE, this.height(time)), this.origin.z + this.launch.z * travel);
    velocity?.set(this.launch.x * decay, this.launch.y * decay - GRAVITY * travel, this.launch.z * decay);
  }
}
