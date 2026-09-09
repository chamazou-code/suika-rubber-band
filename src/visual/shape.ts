import { SphereGeometry } from 'three';
import { clamp } from '../game';
import { tornEdge } from './fracture';

export const pinchAt = (bands: number) => clamp((bands - 8) / 46) * .37;
export const melonHeight = (bands: number) => 1.13 + pinchAt(bands) * .23;
export function melonRadius(y: number, bands: number) {
  return 1.06 * Math.sqrt(Math.max(0, 1 - y * y)) * (1 - pinchAt(bands) * Math.exp(-Math.pow(y * 2.9, 2))) * (1 + y * .025);
}

/** One continuous surface split horizontally at the constricted waist. The pole stays on the table. */
export class MelonSurface {
  readonly geometry: SphereGeometry;
  private original: Float32Array;
  constructor(upper: boolean, phiStart = 0, phiLength = Math.PI * 2, segments = 64) {
    this.geometry = new SphereGeometry(1, segments, 28, phiStart, phiLength, upper ? 0 : Math.PI / 2, Math.PI / 2);
    const uv = this.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, phiStart / (Math.PI * 2) + uv.getX(i) * phiLength / (Math.PI * 2), uv.getY(i) * .5 + (upper ? .5 : 0));
    this.original = Float32Array.from(this.geometry.attributes.position.array);
    this.deform(0);
  }
  deform(bands: number, broken = false) {
    const position = this.geometry.attributes.position;
    const normal = this.geometry.attributes.normal;
    const height = melonHeight(bands);
    for (let i = 0; i < position.count; i++) {
      const x = this.original[i * 3], y = this.original[i * 3 + 1], z = this.original[i * 3 + 2];
      const phi = Math.atan2(z, x), cross = Math.hypot(x, z);
      const radius = melonRadius(y, bands) * (1 + .007 * Math.sin(phi * 5 + y * 6) * (1 - y * y));
      const unevenSeam = (broken ? tornEdge(phi) : Math.sin(phi * 11 + .7) * .014) * Math.pow(1 - Math.abs(y), 8);
      position.setXYZ(i, cross > .00001 ? x / cross * radius : 0, y * height + unevenSeam, cross > .00001 ? z / cross * radius : 0);
      if (Math.abs(y) > .9999) normal.setXYZ(i, 0, Math.sign(y), 0);
      else {
        // Shared analytic normals keep separately drawn rind sections visually seamless.
        const derivative = (melonRadius(y + .0001, bands) - melonRadius(y - .0001, bands)) / (.0002 * height);
        const length = Math.hypot(1, derivative);
        normal.setXYZ(i, Math.cos(phi) / length, -derivative / length, Math.sin(phi) / length);
      }
    }
    position.needsUpdate = normal.needsUpdate = true;
    this.geometry.computeBoundingSphere(); this.geometry.computeBoundingBox();
  }
}
