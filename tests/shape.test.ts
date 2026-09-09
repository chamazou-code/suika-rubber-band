import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MelonSurface, melonHeight, melonRadius, releasedLowerBands } from '../src/visual/shape';

test('released lower half opens and settles without lifting its base or retaining the constricted neck', () => {
  const lower = new MelonSurface(false), originalBands = 55, rootHeight = melonHeight(originalBands);
  let previous = originalBands;
  for (let step = 0; step <= 70; step++) {
    const shapeBands = releasedLowerBands(originalBands, step / 100);
    assert.ok(shapeBands <= previous); previous = shapeBands;
    const offset = melonHeight(shapeBands) - rootHeight;
    lower.deform(shapeBands, true, offset);
    assert.ok(Math.abs(lower.geometry.boundingBox!.min.y + rootHeight) < 1e-6);
  }
  assert.equal(releasedLowerBands(originalBands, 0), originalBands);
  assert.equal(releasedLowerBands(originalBands, .7), 0);
  assert.equal(releasedLowerBands(originalBands, 4), 0);
  assert.ok(melonRadius(0, 0) > melonRadius(0, originalBands) * 1.5);
  assert.ok(melonHeight(0) < rootHeight);
  lower.geometry.dispose();
});

test('pressure constricts the waist locally while preserving the shoulders and table contact', () => {
  const lower = new MelonSurface(false);
  let previous = melonRadius(0, 0);
  for (let bands = 0; bands <= 70; bands++) {
    const waist = melonRadius(0, bands);
    assert.ok(waist <= previous); previous = waist;
    assert.ok(Math.abs(melonRadius(.8, bands) - melonRadius(.8, 0)) < .005);
    lower.deform(bands);
    assert.ok(Math.abs(lower.geometry.boundingBox!.min.y + melonHeight(bands)) < 1e-6);
    for (const attr of ['position', 'normal']) for (const value of lower.geometry.attributes[attr].array) assert.ok(Number.isFinite(value));
  }
  assert.ok(melonRadius(0, 55) < melonRadius(0, 0) * .65);
  lower.geometry.dispose();
});

test('upper and lower surfaces share waist geometry, UVs and normals across deformation', () => {
  const upper = new MelonSurface(true), lower = new MelonSurface(false);
  for (const bands of [0, 10, 25, 40, 70]) {
    upper.deform(bands); lower.deform(bands);
    for (let i = 0; i <= 64; i++) for (const attr of ['position', 'normal', 'uv']) {
      const a = upper.geometry.attributes[attr], b = lower.geometry.attributes[attr];
      for (let k = 0; k < a.itemSize; k++) assert.ok(Math.abs(a.array[(28 * 65 + i) * a.itemSize + k] - b.array[i * b.itemSize + k]) < 1e-5);
    }
  }
  upper.geometry.dispose(); lower.geometry.dispose();
});

test('upper fracture sections form a continuous rind before the upward launch', () => {
  const a = new MelonSurface(true, 0, Math.PI * 2 / 3, 24), b = new MelonSurface(true, Math.PI * 2 / 3, Math.PI * 2 / 3, 24);
  for (const bands of [0, 35, 60]) {
    a.deform(bands); b.deform(bands);
    for (let row = 1; row <= 28; row++) for (const attr of ['position', 'normal', 'uv']) {
      const av = a.geometry.attributes[attr], bv = b.geometry.attributes[attr];
      for (let k = 0; k < av.itemSize; k++) assert.ok(Math.abs(av.array[(row * 25 + 24) * av.itemSize + k] - bv.array[row * 25 * bv.itemSize + k]) < 1e-5);
    }
  }
  a.geometry.dispose(); b.geometry.dispose();
});
