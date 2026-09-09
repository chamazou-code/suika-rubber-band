import {
  CircleGeometry, Color, DoubleSide, Group, IcosahedronGeometry, InstancedMesh,
  MeshStandardMaterial, Object3D, SphereGeometry, Vector3,
} from 'three';
import { clamp } from '../game';
import { makeSoftTexture, seededRandom } from './textures';
import { TableBody } from './physics';

interface Fragment { body: TableBody; size: number; delay: number }
interface Batch { mesh: InstancedMesh; fragments: Fragment[]; kind: 'juice' | 'flesh' | 'seed' | 'rind' }

export class Burst {
  readonly root = new Group();
  private batches: Batch[];
  private stains: InstancedMesh;
  private dummy = new Object3D();
  private round = 0;

  constructor() {
    this.root.name = 'BurstEffects';
    const juice = new MeshStandardMaterial({ color: '#f05e43', roughness: .26 });
    const flesh = new MeshStandardMaterial({ color: '#f05c4c', roughness: .61, flatShading: true });
    const rind = new MeshStandardMaterial({ color: '#58883c', roughness: .5, flatShading: true });
    const seed = new MeshStandardMaterial({ color: '#312015', roughness: .47 });
    const configs = [
      ['juice', 46, new SphereGeometry(1, 6, 4), juice],
      ['flesh', 24, new IcosahedronGeometry(1, 0), flesh],
      ['seed', 22, new SphereGeometry(1, 6, 4), seed],
      ['rind', 8, new IcosahedronGeometry(1, 0), rind],
    ] as const;
    this.batches = configs.map(([kind, count, geometry, material]) => {
      const mesh = new InstancedMesh(geometry, material, count);
      mesh.name = kind === 'juice' ? 'JuiceParticles' : kind === 'seed' ? 'Seeds' : kind === 'flesh' ? 'FleshChunks' : 'RindFragments';
      mesh.frustumCulled = false; mesh.castShadow = kind !== 'juice'; mesh.receiveShadow = true;
      this.root.add(mesh); return { mesh, fragments: [], kind };
    });
    this.stains = new InstancedMesh(new CircleGeometry(1, 16), new MeshStandardMaterial({ map: makeSoftTexture('juice'), transparent: true, opacity: .6, depthWrite: false, roughness: .4, side: DoubleSide }), 20);
    this.stains.name = 'JuiceOnTable'; this.stains.frustumCulled = false; this.stains.receiveShadow = true; this.root.add(this.stains);
    this.root.visible = false;
  }

  trigger(height: number) {
    this.root.visible = true;
    const random = seededRandom(++this.round * 451 + 937);
    for (const batch of this.batches) {
      batch.fragments = Array.from({ length: batch.mesh.instanceMatrix.count }, (_, i) => {
        const angle = random() * Math.PI * 2;
        const lateral = .35 + random() * (batch.kind === 'juice' ? 2.2 : 1.7);
        const vy = 4.2 + random() * 3.3;
        const size = batch.kind === 'seed' ? .023 + random() * .013 : batch.kind === 'juice' ? .016 + random() * .035 : .06 + random() * .075;
        const origin = new Vector3((random() - .5) * .56, height + random() * .1, (random() - .5) * .56);
        const body = new TableBody({ position: origin, velocity: new Vector3(Math.cos(angle) * lateral, vy, Math.sin(angle) * lateral),
          angularVelocity: new Vector3((random() - .5) * 12, (random() - .5) * 8, (random() - .5) * 10),
          support: [new Vector3(0, -size * .5, 0), new Vector3(size * .7, 0, 0), new Vector3(-size * .7, 0, 0), new Vector3(0, 0, size * .6), new Vector3(0, 0, -size * .6)],
          restitution: batch.kind === 'seed' ? .4 : batch.kind === 'juice' ? 0 : .12,
          friction: batch.kind === 'seed' ? 6 : 14, airDrag: batch.kind === 'juice' ? .65 : .12 });
        if (batch.kind === 'flesh') batch.mesh.setColorAt(i, new Color().setHSL(.01 + random() * .025, .74, .51 + random() * .13));
        return { body, size, delay: random() * .055 };
      });
      if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
    }
    for (let i = 0; i < 20; i++) {
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix(); this.stains.setMatrixAt(i, this.dummy.matrix);
    }
    this.stains.instanceMatrix.needsUpdate = true; this.stains.visible = false;
  }

  update(time: number, reduced: boolean) {
    if (!this.root.visible) return;
    this.stains.visible = true;
    for (const batch of this.batches) {
      batch.mesh.count = reduced ? Math.ceil(batch.fragments.length * .4) : batch.fragments.length;
      for (let i = 0; i < batch.mesh.count; i++) {
        const f = batch.fragments[i], age = time - f.delay;
        f.body.advance(Math.max(0, age)); const landed = f.body.contacts > 0;
        const fade = batch.kind === 'juice' ? 1 - clamp((age - 1.6) / .5) : 1;
        const size = age < 0 ? 0 : f.size * fade;
        this.dummy.position.copy(f.body.position); this.dummy.quaternion.copy(f.body.rotation);
        if (batch.kind === 'juice') this.dummy.scale.set(size * .6, size * (landed ? .2 : 1.7), size * .6);
        else if (batch.kind === 'seed') this.dummy.scale.set(size * .62, size * .35, size * 1.3);
        else this.dummy.scale.set(size, size * (landed ? .6 : .85), size * .74);
        this.dummy.updateMatrix(); batch.mesh.setMatrixAt(i, this.dummy.matrix);
        if (batch.kind === 'juice' && i < 20 && landed) {
          this.dummy.position.y = .012 + i * .0001;
          this.dummy.rotation.set(-Math.PI / 2, 0, i * 2.4);
          this.dummy.scale.set(f.size * 3.5, f.size * 2.4, 1);
          this.dummy.updateMatrix(); this.stains.setMatrixAt(i, this.dummy.matrix);
        }
      }
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    this.stains.instanceMatrix.needsUpdate = true;
  }
  reset() { this.root.visible = false; }
}
