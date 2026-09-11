import {
  BufferGeometry, CatmullRomCurve3, CircleGeometry, Color, DoubleSide, Euler, Float32BufferAttribute,
  Group, IcosahedronGeometry, InstancedMesh, LineBasicMaterial, LineSegments, Mesh, MeshPhysicalMaterial,
  MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, TorusGeometry, TubeGeometry, Vector3,
} from 'three';
import { clamp, type Game } from '../game';
import { MelonSurface, melonHeight, melonRadius, releasedLowerBands } from './shape';
import { makeFleshTexture, makeRindTextures, seededRandom } from './textures';
import { makeTornSurface, tornFleshHeight } from './fracture';
import { TableBody } from './physics';
import { containFragment, createBurstProfile, type BurstProfile } from './burst-profile';
import { upperFlightPosition, UPPER_GRAVITY, UPPER_SEAMS, UPPER_SEGMENTS, UPPER_SPEED } from './upper-motion';

export class Watermelon {
  readonly root = new Group();
  readonly upper = new Group();
  readonly lower = new Group();
  readonly bands: InstancedMesh;
  private flyingBands: InstancedMesh;
  readonly rindMaterial: MeshPhysicalMaterial;
  readonly fleshMaterial: MeshStandardMaterial;
  private upperSurfaces = UPPER_SEAMS.slice(0, -1).map((start, i) => new MelonSurface(true, start, UPPER_SEAMS[i + 1] - start, UPPER_SEGMENTS));
  private lowerSurface = new MelonSurface(false);
  private sections: Group[] = [];
  private upperCuts: Group[] = [];
  private fractureFaces: { mesh: Mesh; phi: number }[] = [];
  private lowerCut: Group;
  private stem = new Group();
  private cracks: LineSegments;
  private dummy = new Object3D();
  private fractured = false;
  private relaxedBands = -1;
  private sectionBodies: { body: TableBody; center: Vector3 }[] = [];
  private releasedBands: { body: TableBody; radius: number }[] = [];
  private transformedCenter = new Vector3();
  private burstProfile = createBurstProfile(0, 0);
  private count = -1;
  private random = seededRandom(419);
  private ringDetails = Array.from({ length: 70 }, () => ({ tilt: (this.random() - .5) * .026, phase: this.random() * Math.PI * 2, offset: (this.random() - .5) * .004 }));

  constructor() {
    this.root.name = 'WatermelonRoot'; this.upper.name = 'WatermelonUpper'; this.lower.name = 'WatermelonLower';
    const skin = makeRindTextures();
    this.rindMaterial = new MeshPhysicalMaterial({ map: skin.map, bumpMap: skin.bump, bumpScale: .012, roughness: .43, metalness: 0, clearcoat: .32, clearcoatRoughness: .28, envMapIntensity: .65 });
    const fleshMap = makeFleshTexture();
    this.fleshMaterial = new MeshStandardMaterial({ map: fleshMap, bumpMap: fleshMap, bumpScale: .025, roughness: .49, side: DoubleSide });
    const lowerSkin = new Mesh(this.lowerSurface.geometry, this.rindMaterial); lowerSkin.castShadow = lowerSkin.receiveShadow = true; this.lower.add(lowerSkin);
    for (let i = 0; i < this.upperSurfaces.length; i++) {
      const section = new Group(); section.name = `UpperSection${i + 1}`;
      const mesh = new Mesh(this.upperSurfaces[i].geometry, this.rindMaterial); mesh.castShadow = mesh.receiveShadow = true;
      const start = UPPER_SEAMS[i], end = UPPER_SEAMS[i + 1], cut = this.makeCut(true, start + Math.PI, end - start);
      section.add(mesh, cut); this.upperCuts.push(cut);
      for (const phi of [start, end]) {
        const face = new Mesh(new BufferGeometry(), this.fleshMaterial); face.castShadow = face.receiveShadow = true;
        section.add(face); this.fractureFaces.push({ mesh: face, phi });
      }
      this.sections.push(section); this.upper.add(section);
    }
    this.lowerCut = this.makeCut(false); this.lower.add(this.lowerCut);
    this.root.add(this.upper, this.lower);

    const stemMaterial = new MeshStandardMaterial({ color: '#766042', roughness: .95 });
    const scar = new Mesh(new CircleGeometry(.058, 24), stemMaterial); scar.rotation.x = -Math.PI / 2; scar.position.y = .006;
    this.stem.add(scar);
    const stem = new Mesh(new TubeGeometry(new CatmullRomCurve3([new Vector3(), new Vector3(.015, .065, .007), new Vector3(-.025, .11, .012), new Vector3(-.07, .12, .016)]), 12, .019, 6, false), stemMaterial);
    stem.castShadow = true; this.stem.add(stem);
    const stemRing = new Mesh(new TorusGeometry(.052, .003, 5, 24), new MeshStandardMaterial({ color: '#a49c63', roughness: .8 }));
    stemRing.rotation.x = -Math.PI / 2; stemRing.position.y = .007; this.stem.add(stemRing); this.sections[0].add(this.stem);

    this.bands = new InstancedMesh(new TorusGeometry(1, .009, 6, 48), new MeshStandardMaterial({ roughness: .82 }), 70);
    this.bands.name = 'RubberBandSystem'; this.bands.frustumCulled = false; this.bands.castShadow = true; this.bands.receiveShadow = true;
    const palette = ['#d6ae69', '#ecd390', '#b95f41', '#ddbd79', '#347e80', '#d7af61', '#b4c0a1'];
    for (let i = 0; i < 70; i++) this.bands.setColorAt(i, new Color(palette[i % palette.length]));
    this.bands.count = 0; this.root.add(this.bands);
    this.flyingBands = new InstancedMesh(new TorusGeometry(1, .022, 6, 40), this.bands.material, 70);
    this.flyingBands.name = 'ReleasedRubberBands'; this.flyingBands.frustumCulled = false;
    this.flyingBands.castShadow = this.flyingBands.receiveShadow = true; this.flyingBands.visible = false;
    for (let i = 0; i < 70; i++) this.flyingBands.setColorAt(i, new Color(palette[i % palette.length]));
    this.root.add(this.flyingBands);

    this.cracks = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: '#b8bc75', transparent: true, opacity: .7 }));
    this.cracks.name = 'CrackLayer'; this.root.add(this.cracks);
    this.setCount(0);
  }

  private makeCut(upper: boolean, start = 0, length = Math.PI * 2) {
    const cut = new Group(); cut.name = 'InteriorFlesh';
    const white = new Mesh(makeTornSurface(.935, 1, start, length), new MeshStandardMaterial({ color: '#d9dda5', roughness: .88, side: DoubleSide }));
    const flesh = new Mesh(makeTornSurface(0, .935, start, length), this.fleshMaterial);
    for (const mesh of [white, flesh]) { mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true; cut.add(mesh); }
    const seedCount = upper ? 4 : 27;
    const seeds = new InstancedMesh(new SphereGeometry(1, 7, 5), new MeshStandardMaterial({ color: '#352519', roughness: .48 }), seedCount);
    const random = seededRandom(upper ? 340 : 349), dummy = new Object3D();
    for (let i = 0; i < seedCount; i++) {
      const a = start + random() * length, radius = .2 + Math.sqrt(random()) * .63, size = .7 + random() * .5;
      dummy.position.set(Math.cos(a) * radius, tornFleshHeight(radius, -a) + .015, -Math.sin(a) * radius); dummy.rotation.set(0, a + random() * 2, 0); dummy.scale.set(.015 * size, .01, .036 * size); dummy.updateMatrix(); seeds.setMatrixAt(i, dummy.matrix);
    }
    cut.add(seeds);
    if (!upper) {
      const pulp = new InstancedMesh(new IcosahedronGeometry(1, 0), new MeshStandardMaterial({ color: '#f56a58', roughness: .65, flatShading: true }), 25);
      pulp.name = 'TornPulp'; pulp.castShadow = pulp.receiveShadow = true;
      for (let i = 0; i < 25; i++) {
        const a = random() * Math.PI * 2, radius = .15 + random() * .76;
        dummy.position.set(Math.cos(a) * radius, tornFleshHeight(radius, a) + .012, Math.sin(a) * radius);
        dummy.rotation.set(random() * 3, a, random() * 2); dummy.scale.set(.035 + random() * .065, .025 + random() * .06, .025 + random() * .04);
        dummy.updateMatrix(); pulp.setMatrixAt(i, dummy.matrix); pulp.setColorAt(i, new Color().setHSL(.012 + random() * .018, .75, .54 + random() * .1));
      }
      cut.add(pulp);
    }
    return cut;
  }

  private setCount(count: number) {
    this.count = count;
    for (const surface of this.upperSurfaces) surface.deform(count);
    this.lowerSurface.deform(count);
    this.root.position.y = melonHeight(count); this.stem.position.y = melonHeight(count);
    const waist = melonRadius(0, count);
    this.lowerCut.position.y = 0;
    for (const cut of [this.lowerCut, ...this.upperCuts]) cut.scale.set(waist, 1, waist);
    for (const { mesh, phi } of this.fractureFaces) {
      const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
      const point = (row: number, step: number) => {
        const y = row / 28, radial = step / 4, radius = melonRadius(y, count) * .99;
        const rough = Math.sin(radial * Math.PI) * (.022 * Math.sin(row * 2.7 + phi * 5) + .018 * Math.cos(step * 8 + row));
        positions.push(-Math.cos(phi) * radius * radial + Math.sin(phi) * rough, y * melonHeight(count) * radial, Math.sin(phi) * radius * radial + Math.cos(phi) * rough);
        uvs.push(.5 + radius * radial * .42, .5 + y * radial * .48);
      };
      for (let row = 0; row <= 28; row++) for (let step = 0; step <= 4; step++) point(row, step);
      for (let row = 0; row < 28; row++) for (let step = 0; step < 4; step++) {
        const index = row * 5 + step;
        indices.push(index, index + 1, index + 6);
        if (step) indices.push(index, index + 6, index + 5);
      }
      mesh.geometry.dispose(); mesh.geometry = new BufferGeometry();
      mesh.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); mesh.geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); mesh.geometry.setIndex(indices);
      mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox();
    }
    this.bands.count = count;
    for (let i = 0; i < count; i++) this.setRing(i, 1);
    this.bands.instanceMatrix.needsUpdate = true;
    const vertices: number[] = [];
    if (count > 30) for (let branch = 0; branch < Math.min(5, 1 + Math.floor((count - 30) / 6)); branch++) {
      const phi = .45 + branch * 1.35;
      for (let i = 0; i < 7; i++) for (const k of [i, i + 1]) {
        const y = (branch % 2 ? -1 : 1) * (.19 + k * .026);
        const angle = phi + Math.sin(k * 2.1 + branch) * .024;
        const r = melonRadius(y, count) + .005;
        vertices.push(Math.cos(angle) * r, y * melonHeight(count), Math.sin(angle) * r);
      }
    }
    this.cracks.geometry.dispose();
    this.cracks.geometry = new BufferGeometry(); this.cracks.geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    this.cracks.visible = count > 30;
  }

  private setRing(i: number, snapTime: number) {
    const detail = this.ringDetails[i];
    const bundle = Math.min(.35, this.count * .0065);
    const y = this.count === 1 ? 0 : -bundle / 2 + i / (this.count - 1) * bundle + detail.offset;
    const stretch = i === this.count - 1 ? .3 * Math.exp(-snapTime * 20) * Math.cos(snapTime * 29) : 0;
    const radius = melonRadius(y / melonHeight(this.count), this.count) + .014;
    this.dummy.position.set(0, y + Math.max(0, stretch) * .35, 0);
    this.dummy.rotation.set(Math.PI / 2 + detail.tilt, detail.tilt * .5, detail.phase);
    this.dummy.scale.set(radius * (1 + stretch), radius * (1 + stretch), 1);
    this.dummy.updateMatrix(); this.bands.setMatrixAt(i, this.dummy.matrix);
  }

  setBurstProfile(profile: BurstProfile) { this.burstProfile = profile; }

  private release() {
    this.fractured = true;
    this.relaxedBands = -1;
    this.lowerSurface.deform(this.count, true);
    for (const surface of this.upperSurfaces) surface.deform(this.count, true);
    const profile = this.burstProfile, random = seededRandom(profile.seed ^ 599), height = melonHeight(this.count);
    const split = profile.splitTime;
    const rotation = new Quaternion().setFromEuler(new Euler(split * profile.tiltX, split * profile.tiltY, split * profile.tiltZ));
    this.sectionBodies = this.upperSurfaces.map((surface, i) => {
      const p = surface.geometry.attributes.position, support: Vector3[] = [];
      for (let row = 0; row <= 28; row += 4) for (let col = 0; col <= UPPER_SEGMENTS; col += 3) support.push(new Vector3().fromBufferAttribute(p, row * (UPPER_SEGMENTS + 1) + col));
      support.push(new Vector3());
      const center = support.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(support.length);
      for (const point of support) point.sub(center);
      const phi = (UPPER_SEAMS[i] + UPPER_SEAMS[i + 1]) * .5, spread = (2.05 + random() * .9) * profile.spread;
      const position = center.clone().applyQuaternion(rotation).add(upperFlightPosition(split, height, profile, new Vector3()));
      const body = new TableBody({ position, rotation, support,
        velocity: containFragment(position, new Vector3(profile.driftX - Math.cos(phi) * spread, UPPER_SPEED * profile.lift - UPPER_GRAVITY * split + (random() - .5) * .9, profile.driftZ + Math.sin(phi) * spread), 2.6 + (profile.power - .72) * 1.4),
        angularVelocity: new Vector3(1.1 + random() * 2.1, (random() - .5) * 3.4, (i % 2 ? -1 : 1) * (1.4 + random() * 1.6)).multiplyScalar(profile.spin),
        restitution: .15, friction: 10, airDrag: .15 });
      return { body, center };
    });
    this.releasedBands = Array.from({ length: this.count }, (_, i) => {
      const radius = .15 + random() * .10, angle = random() * Math.PI * 2;
      const speed = (1.8 + random() * 2.5) * Math.sqrt(profile.power), support = Array.from({ length: 12 }, (_, k) => new Vector3(Math.cos(k / 12 * Math.PI * 2) * radius, Math.sin(k / 12 * Math.PI * 2) * radius, 0));
      const origin = new Vector3(0, height + (i / Math.max(1, this.count - 1) - .5) * .35, 0);
      const body = new TableBody({ position: origin,
        rotation: new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, angle)), support,
        velocity: containFragment(origin, new Vector3(Math.cos(angle) * speed, (1.1 + random() * 3.1) * profile.lift, Math.sin(angle) * speed), profile.wetRadius),
        angularVelocity: new Vector3((random() - .5) * 14, (random() - .5) * 12, (random() - .5) * 14),
        restitution: .58, friction: 5.5, airDrag: .65 });
      return { body, radius };
    });
    this.flyingBands.count = this.count;
  }

  private animateReleasedBands(time: number) {
    const waist = melonRadius(0, this.count);
    for (let i = 0; i < this.releasedBands.length; i++) {
      const { body, radius } = this.releasedBands[i]; body.advance(time);
      const relax = (waist - radius) * Math.exp(-time * 20);
      const flutter = Math.sin(time * 29 + i) * .16 * Math.exp(-time * 2);
      this.dummy.position.copy(body.position); this.dummy.position.y -= melonHeight(this.count);
      this.dummy.quaternion.copy(body.rotation);
      this.dummy.scale.set((radius + relax) * (1 + flutter), (radius + relax) * (1 - flutter), .5);
      this.dummy.updateMatrix(); this.flyingBands.setMatrixAt(i, this.dummy.matrix);
    }
    this.flyingBands.instanceMatrix.needsUpdate = true;
  }

  private relaxLower(time: number) {
    const shapeBands = releasedLowerBands(this.count, time);
    if (shapeBands === this.relaxedBands) return;
    this.relaxedBands = shapeBands;
    // Recover the local waist, not the whole object's scale. Lower the cut as it widens.
    // The offset exactly cancels the height change at the bottom pole, keeping it on the table.
    const offset = melonHeight(shapeBands) - melonHeight(this.count);
    this.lowerSurface.deform(shapeBands, true, offset);
    const opening = melonRadius(0, shapeBands);
    this.lowerCut.scale.set(opening, 1, opening); this.lowerCut.position.y = offset;
  }

  update(game: Game, time: number, visualTime: number, reduced: boolean) {
    if (game.bands !== this.count) this.setCount(game.bands);
    const broken = game.phase === 'bursting' || game.phase === 'result';
    if (broken && !this.fractured) this.release();
    else if (!broken && this.fractured) {
      this.fractured = false; this.sectionBodies = []; this.releasedBands = [];
      this.lowerSurface.deform(this.count); for (const surface of this.upperSurfaces) surface.deform(this.count);
    }
    this.bands.visible = !broken; this.flyingBands.visible = broken;
    for (const cut of [this.lowerCut, ...this.upperCuts]) cut.visible = broken;
    for (const face of this.fractureFaces) face.mesh.visible = broken && visualTime > this.burstProfile.splitTime;
    this.cracks.visible = !broken && this.count > 30;
    this.upper.position.set(0, 0, 0); this.upper.rotation.set(0, 0, 0);
    for (const section of this.sections) { section.position.set(0, 0, 0); section.rotation.set(0, 0, 0); }
    this.root.rotation.set(0, 0, 0); this.root.scale.setScalar(1);
    this.root.position.y = melonHeight(this.count);
    if (broken) {
      this.relaxLower(visualTime);
      if (visualTime <= this.burstProfile.splitTime) {
        const t = visualTime;
        upperFlightPosition(t, 0, this.burstProfile, this.upper.position);
        this.upper.rotation.set(t * this.burstProfile.tiltX, t * this.burstProfile.tiltY, t * this.burstProfile.tiltZ);
      } else {
        const t = visualTime - this.burstProfile.splitTime;
        for (let i = 0; i < this.upperSurfaces.length; i++) {
          const section = this.sections[i], { body, center } = this.sectionBodies[i]; body.advance(t);
          this.transformedCenter.copy(center).applyQuaternion(body.rotation);
          section.position.copy(body.position).sub(this.transformedCenter); section.position.y -= melonHeight(this.count);
          section.quaternion.copy(body.rotation);
        }
      }
      this.animateReleasedBands(visualTime);
    } else {
      this.bands.rotation.set(0, 0, 0); this.bands.position.y = 0;
      if (!reduced) {
        const wobble = Math.sin(game.snapTime * 40) * Math.exp(-game.snapTime * 17) * .012;
        this.root.rotation.z = wobble;
        this.root.scale.set(1 + wobble * .5, 1 - wobble * .5, 1 + wobble * .5);
        if (game.phase === 'cracking') this.root.rotation.z += Math.sin(game.phaseTime * 135) * .014;
        else if (this.count > 35) this.root.rotation.z += Math.sin(time * 34) * clamp((this.count - 35) / 35) * .0015;
      }
    }
    if (this.count && game.snapTime < .4) {
      this.setRing(this.count - 1, reduced ? 1 : game.snapTime); this.bands.instanceMatrix.needsUpdate = true;
    }
  }
}
