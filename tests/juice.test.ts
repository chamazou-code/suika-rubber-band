import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { JuiceFlight, JUICE_SURFACE } from '../src/visual/juice-motion';

test('juice rises, slows in air, and reaches the tabletop at its predicted impact', () => {
  const origin = new Vector3(.1, 1.2, -.2), launch = new Vector3(2, 6, -1);
  const flight = new JuiceFlight(origin, launch), position = new Vector3(), velocity = new Vector3();
  flight.sample(.15, position, velocity);
  assert.ok(position.y > origin.y); assert.ok(velocity.y > 0 && velocity.y < launch.y);
  assert.ok(velocity.x > 0 && velocity.x < launch.x);
  flight.sample(flight.duration - .001, position, velocity);
  assert.ok(position.y > JUICE_SURFACE && velocity.y < 0);
  flight.sample(flight.duration, position);
  assert.ok(position.distanceTo(flight.impact) < 1e-5);
  assert.equal(flight.impact.y, JUICE_SURFACE);
  assert.ok(flight.duration > 1 && flight.duration < 2);
  // Independent small-step integration of gravity and drag checks the analytic path.
  const numeric = origin.clone(), speed = launch.clone(), dt = 1 / 20000;
  for (let i = 0; i < 10000; i++) {
    speed.addScaledVector(speed, -.38 * dt); speed.y -= 9.81 * dt;
    numeric.addScaledVector(speed, dt);
  }
  flight.sample(.5, position);
  assert.ok(position.distanceTo(numeric) < .001);
});

test('hit-stop and skipped frames do not alter juice trajectories or leave droplets below the table', () => {
  const flight = new JuiceFlight(new Vector3(0, 1.23, 0), new Vector3(-2.1, 7.4, 2.2));
  const stepped = new Vector3(), direct = new Vector3();
  for (let frame = 0; frame <= 60; frame++) flight.sample(frame / 60, stepped);
  flight.sample(1, direct); assert.deepEqual(stepped, direct);
  for (let repeat = 0; repeat < 12; repeat++) flight.sample(1, stepped);
  assert.deepEqual(stepped, direct);
  flight.sample(4, stepped); assert.ok(stepped.distanceTo(flight.impact) < 1e-5);
  flight.sample(99, direct); assert.deepEqual(stepped, direct);
  for (const time of [-1, NaN, Infinity]) {
    flight.sample(time, stepped); assert.deepEqual(stepped, flight.origin);
  }
});

test('a landing splashlet leaves and returns to the tabletop instead of spawning in mid-air', () => {
  const parent = new JuiceFlight(new Vector3(0, 1.2, 0), new Vector3(1.7, 3.2, -.5));
  const origin = parent.impact.clone(); origin.y += .008;
  const secondary = new JuiceFlight(origin, new Vector3(1, 2, -.4), .85), position = new Vector3();
  secondary.sample(.1, position); assert.ok(position.y > JUICE_SURFACE && position.y < .25);
  assert.ok(secondary.duration > .3 && secondary.duration < .5);
  secondary.sample(secondary.duration + 1, position);
  assert.ok(position.distanceTo(secondary.impact) < 1e-5);
});
