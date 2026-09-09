import { BufferGeometry, Float32BufferAttribute } from 'three';

/** Fibrous tears and missing bites, in world-space around the squeezed waist. */
export function tornEdge(angle: number) {
  const bite = (center: number, width: number) => Math.exp((Math.cos(angle - center) - 1) / width);
  return .045 * Math.sin(angle * 7 + .3) + .027 * Math.sin(angle * 17 + 1.4)
    + .06 * Math.pow(Math.max(0, Math.sin(angle * 11 - .8)), 4)
    - .17 * bite(-.85, .023) - .13 * bite(1.4, .035) - .10 * bite(3.0, .025);
}
export function tornFleshHeight(radius: number, angle: number) {
  const x = radius * Math.cos(angle), z = radius * Math.sin(angle);
  const fibers = .035 * Math.sin(x * 31 + z * 17) + .024 * Math.sin(z * 39 - x * 12);
  const crater = -.15 * Math.exp(-radius * radius * 4);
  const crevice = -.07 * Math.pow(Math.max(0, Math.sin(angle * 3 + radius * 6)), 6) * (1 - radius);
  const blend = Math.pow(Math.min(radius, 1), 3);
  return (crater + fibers + crevice) * (1 - blend) + tornEdge(angle) * blend;
}

/** A triangulated uneven surface, not a flat circle. Plane XY becomes XZ after rotation. */
export function makeTornSurface(inner: number, outer: number, start = 0, length = Math.PI * 2) {
  const segments = Math.max(24, Math.round(96 * length / (Math.PI * 2))), rows = inner === 0 ? 12 : 3;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const r = inner + (outer - inner) * row / rows;
    for (let i = 0; i <= segments; i++) {
      const a = start + i / segments * length;
      const radius = r * (1 + .007 * Math.sin(-a * 5));
      const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
      positions.push(x, y, tornFleshHeight(r, -a)); uvs.push(.5 + x * .5, .5 + y * .5);
      if (row < rows && i < segments) {
        const p = row * (segments + 1) + i;
        indices.push(p, p + 1, p + segments + 1, p + 1, p + segments + 2, p + segments + 1);
      }
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}
