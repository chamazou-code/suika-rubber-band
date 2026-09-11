import { Color, DynamicDrawUsage, Group, InstancedMesh, MeshStandardMaterial, Object3D, PlaneGeometry, SphereGeometry, Vector3 } from 'three';
import { clamp } from '../game';
import { makeSoftTexture, seededRandom } from './textures';
import { JuiceFlight, JUICE_SURFACE } from './juice-motion';
import type { BurstProfile } from './burst-profile';

export const PRIMARY_DROPS = 144, SECONDARY_DROPS = 96;
interface Drop { flight: JuiceFlight; delay: number; size: number; spread: number; angle: number }

/** One instanced spray and one instanced wet splatter layer, allocated once. */
export class JuiceSpray {
  readonly root = new Group();
  private drops: Drop[] = [];
  private primaryCount = 0;
  private spray: InstancedMesh;
  private stains: InstancedMesh;
  private dummy = new Object3D();
  private velocity = new Vector3();
  private up = new Vector3(0, 1, 0);

  constructor() {
    this.root.name = 'JuiceSpray';
    this.spray = new InstancedMesh(new SphereGeometry(1, 6, 4), new MeshStandardMaterial({ color: '#ec6245', roughness: .2 }), PRIMARY_DROPS + SECONDARY_DROPS);
    this.spray.name = 'JuiceParticles'; this.spray.frustumCulled = false;
    this.stains = new InstancedMesh(new PlaneGeometry(2, 2), new MeshStandardMaterial({
      color: '#f06442', map: makeSoftTexture('juice'), transparent: true, opacity: .72, depthWrite: false, roughness: .24,
    }), PRIMARY_DROPS);
    this.stains.name = 'JuiceOnTable'; this.stains.frustumCulled = false; this.stains.receiveShadow = true;
    this.spray.instanceMatrix.setUsage(DynamicDrawUsage); this.stains.instanceMatrix.setUsage(DynamicDrawUsage);
    const color = new Color();
    // Allocate the color attribute before shader warm-up, not on the first explosion.
    for (let i = 0; i < PRIMARY_DROPS + SECONDARY_DROPS; i++) {
      this.spray.setColorAt(i, color.setHSL(.019 + (i % 5) * .004, .86, .57 + (i % 3) * .035));
    }
    this.root.add(this.spray, this.stains); this.root.visible = false;
  }

  trigger(height: number, profile: BurstProfile) {
    const random = seededRandom(profile.seed ^ 1638);
    this.primaryCount = profile.primaryDrops;
    this.drops.length = 0;
    for (let i = 0; i < this.primaryCount; i++) {
      const angle = profile.angle + random() * Math.PI * 2;
      // A tall central jet mixed with a lower outward fan; every drop launches upward.
      const tall = random() < profile.jetFraction;
      const lateral = (tall ? .6 + random() * 1.55 : 1.5 + random() * 2.1) * profile.spread;
      const launch = new Vector3(Math.cos(angle) * lateral, (tall ? 5.9 + random() * 1.7 : 2.8 + random() * 2.6) * profile.lift, Math.sin(angle) * lateral);
      const origin = new Vector3((random() - .5) * .72, height + random() * .13, (random() - .5) * .72);
      const flight = new JuiceFlight(origin, launch);
      const radius = Math.hypot(flight.impact.x, flight.impact.z);
      if (radius > profile.wetRadius) {
        // Keep the wet marks on the actual tabletop, including on the camera side.
        const scale = profile.wetRadius / radius;
        origin.x *= scale; origin.z *= scale; launch.x *= scale; launch.z *= scale;
        flight.impact.x *= scale; flight.impact.z *= scale;
      }
      const size = .026 + Math.pow(random(), 1.5) * .065;
      this.drops.push({ flight, size, delay: random() * .06 + (i % 3 === 0 ? profile.pulseGap : 0), spread: size * (3.1 + random() * 1.8), angle });
    }
    // Landing positions/times come from the original drops, so splashlets never spawn in mid-air.
    for (let i = 0; i < profile.secondaryDrops; i++) {
      const parent = this.drops[Math.floor(i / 2) * 3 + 1];
      const angle = parent.angle + (random() - .5) * 2.8, speed = (.8 + random() * 1.1) * Math.sqrt(profile.power);
      const origin = parent.flight.impact.clone(); origin.y += .008;
      const flight = new JuiceFlight(origin, new Vector3(Math.cos(angle) * speed, (1 + random() * 1.65) * Math.sqrt(profile.power), Math.sin(angle) * speed), .85);
      this.drops.push({ flight, delay: parent.delay + parent.flight.duration, size: parent.size * (.32 + random() * .23), spread: 0, angle });
    }
    this.root.visible = true;
    this.update(0, false);
  }

  update(time: number, reduced: boolean) {
    if (!this.root.visible) return;
    const primaryCount = reduced ? Math.ceil(this.primaryCount / 3) : this.primaryCount;
    this.spray.count = reduced ? primaryCount : this.drops.length;
    this.stains.count = primaryCount;
    for (let i = 0; i < this.spray.count; i++) {
      const drop = this.drops[i], age = time - drop.delay;
      if (age < 0 || age >= drop.flight.duration) this.dummy.scale.setScalar(0);
      else {
        drop.flight.sample(age, this.dummy.position, this.velocity);
        const stretch = 1.25 + Math.min(1.6, this.velocity.length() * .15);
        this.dummy.quaternion.setFromUnitVectors(this.up, this.velocity.normalize());
        this.dummy.scale.set(drop.size * .65, drop.size * stretch, drop.size * .65);
      }
      this.dummy.updateMatrix(); this.spray.setMatrixAt(i, this.dummy.matrix);
      if (i < primaryCount) {
        const afterImpact = age - drop.flight.duration;
        const spread = drop.spread * (1 - Math.pow(1 - clamp(afterImpact / .2), 3));
        this.dummy.position.copy(drop.flight.impact); this.dummy.position.y = JUICE_SURFACE + i * .00002;
        this.dummy.rotation.set(-Math.PI / 2, 0, -drop.angle);
        this.dummy.scale.set(spread * 1.3, spread * .83, 1);
        this.dummy.updateMatrix(); this.stains.setMatrixAt(i, this.dummy.matrix);
      }
    }
    this.spray.instanceMatrix.needsUpdate = true; this.stains.instanceMatrix.needsUpdate = true;
  }
  reset() { this.root.visible = false; this.drops.length = 0; this.primaryCount = 0; this.spray.count = this.stains.count = 0; }
}
