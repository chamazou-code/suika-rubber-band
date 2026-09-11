import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

// Deterministic, tileable value noise. Texture generation never consumes gameplay randomness.
export function seededRandom(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function noiseField(seed: number) {
  const random = seededRandom(seed);
  const values = Float32Array.from({ length: 128 * 128 }, random);
  return (x: number, y: number, period = 128) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let u = x - ix, v = y - iy;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const a = values[(iy & 127) * 128 + (ix & (period - 1))];
    const b = values[(iy & 127) * 128 + ((ix + 1) & (period - 1))];
    const c = values[((iy + 1) & 127) * 128 + (ix & (period - 1))];
    const d = values[((iy + 1) & 127) * 128 + ((ix + 1) & (period - 1))];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
}
const smooth = (a: number, b: number, n: number) => {
  const t = Math.max(0, Math.min(1, (n - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function canvas(width: number, height: number) {
  const element = document.createElement('canvas'); element.width = width; element.height = height;
  return element;
}
function texture(element: HTMLCanvasElement, color = false) {
  const map = new CanvasTexture(element);
  if (color) map.colorSpace = SRGBColorSpace;
  return map;
}

export function makeRindTextures() {
  const width = 1024, height = 512;
  const color = canvas(width, height), relief = canvas(width, height);
  const c = color.getContext('2d')!, r = relief.getContext('2d')!;
  const pixels = c.createImageData(width, height), surface = r.createImageData(width, height);
  const noise = noiseField(741);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const broad = noise(u * 32, v * 15, 32);
    const detail = noise(u * 128, v * 94);
    const grain = noise(u * 512, v * 420);
    const stripe = Math.sin(u * Math.PI * 24 + (broad - .5) * 2.2 + Math.sin(v * 19 + u * Math.PI * 4) * .32);
    const edge = smooth(-.22, .3, stripe + (detail - .5) * 1.25);
    const fleck = smooth(.54, .82, grain) * .25;
    const light = Math.min(1, edge * (.75 + detail * .25) + fleck);
    const i = (y * width + x) * 4;
    const mottling = (detail - .5) * 18 + (grain - .5) * 10;
    pixels.data[i] = 20 + light * 116 + mottling;
    pixels.data[i + 1] = 46 + light * 108 + mottling;
    pixels.data[i + 2] = 21 + light * 37 + mottling * .6;
    pixels.data[i + 3] = 255;
    const bump = 128 + (grain - .5) * 95 + (detail - .5) * 35;
    surface.data[i] = surface.data[i + 1] = surface.data[i + 2] = bump;
    surface.data[i + 3] = 255;
  }
  c.putImageData(pixels, 0, 0); r.putImageData(surface, 0, 0);
  const map = texture(color, true), bump = texture(relief);
  map.wrapS = bump.wrapS = RepeatWrapping;
  return { map, bump };
}

export function makeWoodTextures() {
  const size = 1024, color = canvas(size, size), relief = canvas(size, size);
  const c = color.getContext('2d')!, r = relief.getContext('2d')!;
  const image = c.createImageData(size, size), bump = r.createImageData(size, size);
  const noise = noiseField(131), random = seededRandom(620);
  const boards = Array.from({ length: 6 }, () => random() * 14 - 7);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const warp = noise(u * 8, v * 14) * 10 + noise(u * 32, v * 44) * 1.8;
    const dx = (u - .29) * 3.8, dy = (v - .42) * 16;
    const knot = Math.exp(-(dx * dx + dy * dy) * 4);
    const fiber = noise(u * 6, v * 650 + warp + knot * 19) * .7 + noise(u * 38, v * 1800) * .3;
    const knotRings = Math.sin(Math.hypot(dx, dy) * 32 + warp * .4) * knot;
    const grain = fiber + knotRings * .16;
    const fine = noise(u * 128, v * 120);
    const split = (v * 6) % 1;
    const seam = split < .007 ? -29 : split < .012 ? 10 : 0;
    const tone = grain * 10 + noise(u * 12, v * 90) * 15 + fine * 6 + boards[Math.floor(v * 6)] + seam - knot * 25;
    const i = (y * size + x) * 4;
    image.data[i] = 123 + tone; image.data[i + 1] = 85 + tone * .88; image.data[i + 2] = 54 + tone * .63; image.data[i + 3] = 255;
    const value = 120 + grain * 45 + fine * 22 + seam * 2;
    bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = value; bump.data[i + 3] = 255;
  }
  c.putImageData(image, 0, 0); r.putImageData(bump, 0, 0);
  const map = texture(color, true), height = texture(relief);
  for (const value of [map, height]) { value.wrapS = value.wrapT = RepeatWrapping; value.repeat.set(1.7, 1.5); value.anisotropy = 4; }
  return { map, bump: height };
}

export function makeFleshTexture() {
  const size = 512, element = canvas(size, size), context = element.getContext('2d')!;
  const image = context.createImageData(size, size), noise = noiseField(119);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x / size * 2 - 1, dy = y / size * 2 - 1;
    const radius = Math.hypot(dx, dy);
    const variation = noise(x * .12, y * .12) * 16 + noise(x * .65, y * .65) * 12;
    const veins = Math.pow(Math.abs(Math.sin(Math.atan2(dy, dx) * 3 + radius * 5)), 14) * 14;
    const i = (y * size + x) * 4;
    image.data[i] = 213 + variation; image.data[i + 1] = 51 + variation + veins; image.data[i + 2] = 48 + variation * .65 + veins; image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return texture(element, true);
}

export function makeSoftTexture(kind: 'shadow' | 'juice' | 'window') {
  const element = canvas(256, 256), c = element.getContext('2d')!;
  if (kind === 'window') {
    c.fillStyle = '#ffffff';
    for (let x = 0; x < 3; x++) for (let y = 0; y < 4; y++) c.fillRect(12 + x * 80, 10 + y * 60, 68, 49);
  } else if (kind === 'juice') {
    const random = seededRandom(733);
    const gradient = c.createRadialGradient(110, 104, 3, 128, 128, 118);
    gradient.addColorStop(0, '#ff927bcc'); gradient.addColorStop(.66, '#f77859bc'); gradient.addColorStop(1, '#ee704b60');
    c.fillStyle = gradient; c.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = i / 96 * Math.PI * 2;
      const radius = 70 + Math.sin(a * 5 + .8) * 11 + Math.sin(a * 9) * 6 + Math.pow(Math.max(0, Math.sin(a * 13)), 8) * 21;
      const x = 128 + Math.cos(a) * radius, y = 128 + Math.sin(a) * radius;
      if (!i) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.fill();
    // Small separated droplets around an uneven wet footprint, not a soft circular blob.
    c.fillStyle = '#fc8a6ac0';
    for (let i = 0; i < 19; i++) {
      const a = random() * Math.PI * 2, r = 91 + random() * 29;
      c.beginPath(); c.ellipse(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 1.5 + random() * 4, 1 + random() * 2.5, a, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = '#ffd7b957'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(117, 113, 40, 32, -.4, 3.35, 4.5); c.stroke();
  } else {
    const gradient = c.createRadialGradient(128, 128, 0, 128, 128, 124);
    gradient.addColorStop(0, '#00000090'); gradient.addColorStop(.35, '#00000050');
    gradient.addColorStop(1, '#00000000'); c.fillStyle = gradient; c.fillRect(0, 0, 256, 256);
  }
  return texture(element, true);
}
