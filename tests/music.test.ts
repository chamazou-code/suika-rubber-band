import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMusic } from '../src/music';

test('original BGM is a finite, audible loop without clipping or a seam click', () => {
  const samples = makeMusic();
  assert.ok(samples.length / 22050 > 17 && samples.length / 22050 < 18);
  let peak = 0, energy = 0;
  for (const value of samples) { assert.ok(Number.isFinite(value)); peak = Math.max(peak, Math.abs(value)); energy += value * value; }
  assert.ok(peak < .85, `peak ${peak}`);
  assert.ok(Math.sqrt(energy / samples.length) > .045);
  assert.ok(Math.abs(samples[0] - samples[samples.length - 1]) < .015);
});

test('BGM generation leaves game randomness untouched', () => {
  const original = Math.random;
  try { Math.random = () => { throw new Error('music must not consume game randomness'); }; assert.deepEqual(makeMusic(8000), makeMusic(8000)); }
  finally { Math.random = original; }
});
