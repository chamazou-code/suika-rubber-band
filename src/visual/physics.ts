import { Quaternion, Vector3 } from 'three';

/** Small fixed-step rigid-body solver for a horizontal tabletop. No external physics runtime. */
export interface BodyOptions {
  position: Vector3;
  velocity: Vector3;
  angularVelocity: Vector3;
  rotation?: Quaternion;
  support: Vector3[];
  restitution: number;
  friction: number;
  airDrag?: number;
}
export class TableBody {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly angularVelocity: Vector3;
  readonly rotation: Quaternion;
  readonly support: Vector3[];
  contacts = 0;
  private delta = new Quaternion();
  private point = new Vector3();
  private contact = new Vector3();
  private impulse = new Vector3();
  private age = 0;
  private accumulator = 0;
  private radiusSquared: number;
  constructor(private options: BodyOptions) {
    this.position = options.position.clone(); this.velocity = options.velocity.clone();
    this.angularVelocity = options.angularVelocity.clone(); this.rotation = options.rotation?.clone() ?? new Quaternion();
    this.support = options.support;
    this.radiusSquared = Math.max(.015, ...this.support.map(p => p.lengthSq()));
  }
  /** Absolute visual time makes hit-stop, 30fps rendering and skipped frames share the same path. */
  advance(time: number) {
    if (!Number.isFinite(time) || time <= this.age) return;
    this.accumulator += Math.min(time, 4) - this.age; this.age = Math.min(time, 4);
    const dt = 1 / 120;
    while (this.accumulator >= dt - 1e-9) { this.step(dt); this.accumulator -= dt; }
  }
  private step(dt: number) {
    this.velocity.y -= 9.81 * dt;
    this.velocity.multiplyScalar(Math.exp(-(this.options.airDrag ?? .16) * dt));
    this.position.addScaledVector(this.velocity, dt);
    const spin = this.angularVelocity.length();
    if (spin > .0001) {
      this.point.copy(this.angularVelocity).multiplyScalar(1 / spin);
      this.delta.setFromAxisAngle(this.point, spin * dt); this.rotation.premultiply(this.delta).normalize();
    }
    this.angularVelocity.multiplyScalar(Math.exp(-.22 * dt));
    let lowest = Infinity;
    for (const point of this.support) {
      this.point.copy(point).applyQuaternion(this.rotation);
      if (this.point.y < lowest) { lowest = this.point.y; this.contact.copy(this.point); }
    }
    if (this.position.y + lowest < .016) {
      this.position.y = .016 - lowest;
      const downward = Math.min(0, this.velocity.y);
      if (downward < -.25) this.contacts++;
      // Impact torque from an off-center contact makes heavy pieces tip and settle.
      const bounce = Math.abs(downward) > .45 ? this.options.restitution : 0;
      this.velocity.y = -downward * bounce;
      this.impulse.set(0, -downward * (1 + bounce), 0);
      this.point.crossVectors(this.contact, this.impulse).multiplyScalar(.23 / this.radiusSquared);
      this.angularVelocity.add(this.point).multiplyScalar(.82);
      const friction = Math.exp(-this.options.friction * dt);
      this.velocity.x *= friction; this.velocity.z *= friction;
      this.angularVelocity.multiplyScalar(friction);
    }
  }
}
