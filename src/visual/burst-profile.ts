import { Vector3 } from 'three';
import { clamp } from '../game';
import { seededRandom } from './textures';

const STYLES = [
  { kind: 'fountain', lift: 1.09, spread: .89, spin: .9, jetFraction: .62 },
  { kind: 'fan', lift: .97, spread: 1.1, spin: 1, jetFraction: .27 },
  { kind: 'tumble', lift: 1.02, spread: 1, spin: 1.45, jetFraction: .4 },
] as const;

/** Visual reward depends only on the final band count, never durability or hidden damage. */
export function createBurstProfile(bands: number, seed: number) {
  const t = clamp((Number.isFinite(bands) ? bands : 0) / 70);
  const random = seededRandom(seed), style = STYLES[Math.floor(random() * STYLES.length)];
  const power = .72 + t * .5, angle = random() * Math.PI * 2;
  const primaryDrops = Math.round(84 + t * 60);
  const balance = Math.sqrt(2 / (style.lift ** 2 + style.spread ** 2));
  return {
    seed: seed >>> 0, kind: style.kind, power,
    lift: power * style.lift * balance, spread: power * style.spread * balance,
    spin: (.8 + t * .6) * style.spin,
    splitTime: .34 - t * .07 + random() * .025,
    driftX: Math.cos(angle) * .65 * power, driftZ: Math.sin(angle) * .5 * power,
    tiltX: (random() - .5) * .8, tiltY: (random() - .5) * .9, tiltZ: (random() - .5) * .8,
    angle, jetFraction: style.jetFraction + (random() - .5) * .1,
    pulseGap: .04 + random() * .1,
    primaryDrops, secondaryDrops: Math.floor(primaryDrops / 3) * 2,
    fleshCount: Math.round(28 + t * 20), seedCount: Math.round(18 + t * 10), rindCount: Math.round(8 + t * 6),
    wetRadius: 2.15 + t * 1.6,
  };
}
export type BurstProfile = ReturnType<typeof createBurstProfile>;

let fallbackSequence = 0;
/** Fresh even after reload. Do not consume Math.random(), which belongs to the game rules. */
export function nextBurstSeed() {
  try { return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]; }
  catch { return (Date.now() ^ Math.floor(performance.now() * 1000) ^ Math.imul(++fallbackSequence, 2654435761)) >>> 0; }
}

/** Bound large pieces to the tabletop without changing their upward impulse. Air drag shortens this conservative path. */
export function containFragment(origin: Vector3, velocity: Vector3, radius: number) {
  const flight = (velocity.y + Math.sqrt(velocity.y ** 2 + 19.62 * Math.max(0, origin.y))) / 9.81;
  const travel = Math.hypot(velocity.x, velocity.z) * flight;
  const budget = Math.max(.1, radius - Math.hypot(origin.x, origin.z));
  if (travel > budget) { const scale = budget / travel; velocity.x *= scale; velocity.z *= scale; }
  return velocity;
}
