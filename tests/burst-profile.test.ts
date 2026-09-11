import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { containFragment, createBurstProfile, nextBurstSeed } from '../src/visual/burst-profile';
import { upperFlightPosition, UPPER_GRAVITY, UPPER_SPEED } from '../src/visual/upper-motion';

test('every added band raises launch energy and keeps spray capacity bounded for every burst style', () => {
  for (let seed = 1; seed <= 120; seed++) {
    let previous = createBurstProfile(0, seed);
    for (let bands = 1; bands <= 70; bands++) {
      const p = createBurstProfile(bands, seed);
      assert.ok(p.power > previous.power && p.lift > previous.lift && p.spread > previous.spread);
      assert.ok(p.wetRadius > previous.wetRadius && p.splitTime < previous.splitTime);
      assert.ok(p.primaryDrops >= previous.primaryDrops && p.fleshCount >= previous.fleshCount);
      assert.ok(p.primaryDrops <= 144 && p.secondaryDrops <= 96 && p.fleshCount <= 48 && p.seedCount <= 28 && p.rindCount <= 14);
      // Styles redistribute the same overall launch energy between height and width.
      assert.ok(Math.abs(p.lift ** 2 + p.spread ** 2 - 2 * p.power ** 2) < 1e-10);
      assert.ok(UPPER_SPEED * p.lift - UPPER_GRAVITY * p.splitTime - .45 > 0);
      previous = p;
    }
  }
});

test('the same band count supports distinct bursts while sharing one deterministic trajectory per burst', () => {
  const profiles = Array.from({ length: 100 }, (_, seed) => createBurstProfile(45, seed));
  assert.equal(new Set(profiles.map(p => p.kind)).size, 3);
  assert.equal(new Set(profiles.map(p => p.power)).size, 1);
  assert.ok(new Set(profiles.map(p => p.driftX)).size > 90);
  for (const p of profiles) {
    assert.deepEqual(p, createBurstProfile(45, p.seed));
    const position = upperFlightPosition(p.splitTime, 1.2, p, new Vector3());
    assert.ok(position.y > 1.2);
    const samePosition = upperFlightPosition(p.splitTime, 1.2, createBurstProfile(45, p.seed), new Vector3());
    assert.deepEqual(position, samePosition);
  }
});

test('visual randomness is freshly requested per explosion without consuming gameplay randomness', t => {
  let requests = 0;
  t.mock.method(Math, 'random', () => { throw new Error('visuals consumed gameplay randomness'); });
  t.mock.method(globalThis.crypto, 'getRandomValues', (values: Uint32Array) => { values[0] = 700 + ++requests; return values; });
  const first = createBurstProfile(40, nextBurstSeed()), second = createBurstProfile(40, nextBurstSeed());
  assert.equal(requests, 2); assert.equal(first.seed, 701); assert.equal(second.seed, 702);
  assert.notDeepEqual(first, second);
});

test('even a powerful fragment lands within its tabletop budget without reducing its upward launch', () => {
  for (let seed = 0; seed < 100; seed++) for (const bands of [10, 30, 50, 70]) {
    const p = createBurstProfile(bands, seed), origin = upperFlightPosition(p.splitTime, 1.23, p, new Vector3());
    const velocity = new Vector3(Math.cos(p.angle) * 4 * p.spread, 4 * p.lift, Math.sin(p.angle) * 4 * p.spread);
    const vy = velocity.y, radius = 2.6 + (p.power - .72) * 1.4;
    containFragment(origin, velocity, radius);
    const flight = (velocity.y + Math.sqrt(velocity.y ** 2 + 19.62 * origin.y)) / 9.81;
    assert.ok(Math.hypot(origin.x + velocity.x * flight, origin.z + velocity.z * flight) <= radius + 1e-8);
    assert.equal(velocity.y, vy);
  }
});

test('invalid counts cannot produce non-finite rendering parameters or exceed the particle pools', () => {
  for (const bands of [NaN, Infinity, -10, 999]) {
    const p = createBurstProfile(bands, 22);
    for (const value of Object.values(p)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
    assert.ok(p.primaryDrops >= 84 && p.primaryDrops <= 144);
  }
});
