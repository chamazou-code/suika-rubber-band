import {
  Color, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh,
  MeshStandardMaterial, Object3D, SphereGeometry, Vector3,
} from 'three';
import { seededRandom } from './textures';
import { TableBody } from './physics';
import { JuiceSpray } from './juice';
import { upperFlightPosition, UPPER_SPLIT_TIME } from './upper-motion';

interface Fragment { body: TableBody; size: number; delay: number }
interface Batch { mesh: InstancedMesh; fragments: Fragment[]; kind: 'flesh' | 'seed' | 'rind' }

export class Burst {
  readonly root = new Group();
  private batches: Batch[];
  private juice = new JuiceSpray();
  private dummy = new Object3D();
  private round = 0;

  constructor() {
    this.root.name = 'BurstEffects';
    const flesh = new MeshStandardMaterial({ color: '#f05c4c', roughness: .48, flatShading: true });
    const rind = new MeshStandardMaterial({ color: '#58883c', roughness: .5, flatShading: true });
    const seed = new MeshStandardMaterial({ color: '#312015', roughness: .47 });
    const configs = [
      ['flesh', 48, new IcosahedronGeometry(1, 0), flesh],
      ['seed', 28, new SphereGeometry(1, 6, 4), seed],
      ['rind', 14, new IcosahedronGeometry(1, 0), rind],
    ] as const;
    this.batches = configs.map(([kind, count, geometry, material]) => {
      const mesh = new InstancedMesh(geometry, material, count);
      // Allocate per-instance color before prepare(): no new shader on the first explosion.
      if (kind === 'flesh') for (let i = 0; i < count; i++) mesh.setColorAt(i, new Color(0xffffff));
      mesh.name = kind === 'seed' ? 'Seeds' : kind === 'flesh' ? 'FleshChunks' : 'RindFragments';
      mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      this.root.add(mesh); return { mesh, fragments: [], kind };
    });
    this.root.add(this.juice.root); this.root.visible = false;
  }

  trigger(height: number) {
    this.root.visible = true;
    const seed = ++this.round * 451 + 937, random = seededRandom(seed);
    this.juice.trigger(height, seed + 701);
    for (const batch of this.batches) {
      batch.fragments = Array.from({ length: batch.mesh.instanceMatrix.count }, (_, i) => {
        const angle = random() * Math.PI * 2;
        // The second wave follows the upper half into the air, then sheds pulp as it breaks up.
        const fromUpper = batch.kind !== 'seed' && i % 3 !== 0;
        const delay = fromUpper ? UPPER_SPLIT_TIME + random() * .07 : random() * .065;
        const lateral = .7 + random() * (fromUpper ? 2.45 : 1.8);
        const vy = fromUpper ? 1.3 + random() * 2.6 : 4.2 + random() * 3;
        const size = batch.kind === 'seed' ? .023 + random() * .013 : batch.kind === 'flesh' ? .065 + Math.pow(random(), 1.5) * .13 : .055 + random() * .085;
        const origin = fromUpper ? upperFlightPosition(delay, height, new Vector3()) : new Vector3(0, height, 0);
        origin.x += (random() - .5) * .9; origin.y += .08 + random() * .22; origin.z += (random() - .5) * .9;
        const body = new TableBody({ position: origin, velocity: new Vector3(Math.cos(angle) * lateral, vy, Math.sin(angle) * lateral),
          angularVelocity: new Vector3((random() - .5) * 17, (random() - .5) * 13, (random() - .5) * 15),
          support: [new Vector3(0, -size * .5, 0), new Vector3(size * .7, 0, 0), new Vector3(-size * .7, 0, 0), new Vector3(0, 0, size * .6), new Vector3(0, 0, -size * .6)],
          restitution: batch.kind === 'seed' ? .4 : .12,
          friction: batch.kind === 'seed' ? 6 : 14, airDrag: .2 });
        if (batch.kind === 'flesh') batch.mesh.setColorAt(i, new Color().setHSL(.01 + random() * .025, .74, .51 + random() * .13));
        return { body, size, delay };
      });
      if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
    }
  }

  update(time: number, reduced: boolean) {
    if (!this.root.visible) return;
    this.juice.update(time, reduced);
    for (const batch of this.batches) {
      batch.mesh.count = reduced ? Math.ceil(batch.fragments.length * .4) : batch.fragments.length;
      for (let i = 0; i < batch.mesh.count; i++) {
        const f = batch.fragments[i], age = time - f.delay;
        f.body.advance(Math.max(0, age)); const landed = f.body.contacts > 0;
        const size = age < 0 ? 0 : f.size;
        this.dummy.position.copy(f.body.position); this.dummy.quaternion.copy(f.body.rotation);
        if (batch.kind === 'seed') this.dummy.scale.set(size * .62, size * .35, size * 1.3);
        else this.dummy.scale.set(size, size * (landed ? .6 : .85), size * .74);
        this.dummy.updateMatrix(); batch.mesh.setMatrixAt(i, this.dummy.matrix);
      }
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  reset() { this.root.visible = false; this.juice.reset(); for (const batch of this.batches) batch.fragments = []; }
}
