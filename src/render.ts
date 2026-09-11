import {
  ACESFilmicToneMapping, BoxGeometry, Color, DirectionalLight, Fog, Group, HemisphereLight,
  InstancedMesh, LatheGeometry, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, PCFShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene,
  Texture, TorusGeometry, Vector2, Vector3, Vector4, WebGLRenderer, type WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clamp, FLIGHT_DURATION, Game, HIT_STOP } from './game';
import { Meter } from './meter';
import { Burst } from './visual/burst';
import { Watermelon } from './visual/watermelon';
import { makeSoftTexture, makeWoodTextures } from './visual/textures';

export class Renderer {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(35, 1, .1, 45);
  readonly webgl: WebGLRenderer;
  readonly watermelon: Watermelon;
  readonly particles: Burst;
  available = true;
  onAvailabilityChange?: (available: boolean) => void;
  private meter: Meter;
  private observer: ResizeObserver;
  private environment: WebGLRenderTarget;
  private light: DirectionalLight;
  private cameraHome = new Vector3();
  private lookAt = new Vector3(0, .58, 0);
  private events = new AbortController();
  private dirty = true;
  private wasAnimating = false;
  private previousPhase = '';
  private previousBands = -1;
  private lastDraw = -1;
  private frameTime = 1 / 60;
  private previousTime = 0;
  private samples = 0;
  private ratio: number;
  private disposed = false;
  private resultStarted = 0;

  constructor(private canvas: HTMLCanvasElement, meterCanvas: HTMLCanvasElement) {
    this.webgl = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'default' });
    this.ratio = Math.min(devicePixelRatio || 1, matchMedia('(max-width: 600px)').matches ? 1.5 : 1.75);
    this.webgl.setPixelRatio(this.ratio);
    this.webgl.toneMapping = ACESFilmicToneMapping; this.webgl.toneMappingExposure = 1.05;
    this.webgl.shadowMap.enabled = true; this.webgl.shadowMap.type = PCFShadowMap;
    this.webgl.shadowMap.autoUpdate = false;
    this.scene.background = new Color('#8b867a'); this.scene.fog = new Fog('#8b867a', 13, 30);
    this.scene.add(new HemisphereLight('#fff1d4', '#8b8065', 1.45));
    this.light = new DirectionalLight('#fff0d0', 2.6); this.light.position.set(-3.5, 7, 4);
    this.light.castShadow = true; this.light.shadow.mapSize.set(1024, 1024);
    Object.assign(this.light.shadow.camera, { left: -4.5, right: 4.5, top: 5, bottom: -4, near: .5, far: 18 });
    this.light.shadow.normalBias = .023; this.light.shadow.bias = -.00015;
    this.scene.add(this.light);
    const fill = new DirectionalLight('#d9e5ed', .65); fill.position.set(4, 3, -4); this.scene.add(fill);
    this.environment = this.makeEnvironment();
    this.scene.environment = this.environment.texture; this.scene.environmentIntensity = .28;
    this.buildRoom();
    this.watermelon = new Watermelon(); this.scene.add(this.watermelon.root);
    this.particles = new Burst(); this.scene.add(this.particles.root);
    this.meter = new Meter(meterCanvas);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.observer.observe(meterCanvas);
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); if (this.disposed) return;
      this.available = false; this.onAvailabilityChange?.(false);
    }, { signal: this.events.signal });
    canvas.addEventListener('webglcontextrestored', async () => {
      if (this.disposed) return;
      try {
        // Render-target contents do not survive context loss; rebuild the reflected room too.
        this.environment.dispose(); this.environment = this.makeEnvironment();
        this.scene.environment = this.environment.texture; await this.prepare();
        if (this.disposed) return;
        this.available = true; this.dirty = true; this.resize(); this.onAvailabilityChange?.(true);
      } catch { this.available = false; this.onAvailabilityChange?.(false); }
    }, { signal: this.events.signal });
    this.resize();
  }

  private makeEnvironment() {
    const room = new RoomEnvironment(), pmrem = new PMREMGenerator(this.webgl);
    try { return pmrem.fromScene(room, .06, .1, 100, { size: 128 }); }
    finally { pmrem.dispose(); room.dispose(); }
  }

  async prepare() {
    // Precompile the fruit interior and all spray and fragment materials before the first tap.
    const hidden: Object3D[] = [];
    this.scene.traverse(object => { if (!object.visible) { hidden.push(object); object.visible = true; } });
    const viewport = this.webgl.getViewport(new Vector4());
    try {
      await this.webgl.compileAsync(this.scene, this.camera);
      if (this.disposed) return;
      // compileAsync covers surface shaders, but not the hidden fragments' shadow-depth variants.
      // A one-pixel viewport beneath the loading UI warms shadow shaders and particle buffers.
      // Keep the canvas target: a render target would compile different tone-mapping/color variants.
      this.webgl.setViewport(0, 0, 1, 1);
      this.webgl.shadowMap.needsUpdate = true; this.webgl.render(this.scene, this.camera);
    } finally {
      if (!this.disposed) this.webgl.setViewport(viewport);
      for (const object of hidden) object.visible = false;
    }
  }

  private buildRoom() {
    const wood = makeWoodTextures();
    const table = new Mesh(new BoxGeometry(12, .28, 10), new MeshStandardMaterial({ color: '#c3b39b', map: wood.map, bumpMap: wood.bump, bumpScale: .009, roughness: .83 }));
    table.name = 'OakTable'; table.position.set(0, -.14, -.7); table.receiveShadow = true; this.scene.add(table);
    const contact = new Mesh(new PlaneGeometry(2.7, 2.7), new MeshBasicMaterial({ map: makeSoftTexture('shadow'), transparent: true, opacity: .52, depthWrite: false }));
    contact.name = 'ContactShadow'; contact.rotation.x = -Math.PI / 2; contact.position.y = .005; this.scene.add(contact);
    const wall = new Mesh(new PlaneGeometry(32, 16), new MeshStandardMaterial({ color: '#91897a', roughness: 1 }));
    wall.position.set(0, 4, -6.2); wall.receiveShadow = true; this.scene.add(wall);
    const floor = new Mesh(new PlaneGeometry(45, 45), new MeshStandardMaterial({ color: '#8c8576', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2.5; floor.receiveShadow = true; this.scene.add(floor);
    const windowLight = new Mesh(new PlaneGeometry(4.2, 3.8), new MeshBasicMaterial({ map: makeSoftTexture('window'), color: '#ffe8bc', opacity: .055, transparent: true, depthWrite: false }));
    windowLight.rotation.z = -.35; windowLight.position.set(1.7, 2.5, -6.17); this.scene.add(windowLight);
    // A small ceramic dish and spare bands provide scale, without competing with the fruit.
    const props = new Group(); props.name = 'SpareBands'; props.position.set(2.85, .015, -1.25);
    const profile = [new Vector2(.0, .02), new Vector2(.23, .02), new Vector2(.40, .065), new Vector2(.48, .22), new Vector2(.50, .30), new Vector2(.47, .32), new Vector2(.43, .25), new Vector2(.36, .11), new Vector2(.20, .07), new Vector2(0, .07)];
    const dish = new Mesh(new LatheGeometry(profile, 40), new MeshStandardMaterial({ color: '#c5c1a8', roughness: .44 }));
    dish.castShadow = true; dish.receiveShadow = true; props.add(dish);
    const spare = new InstancedMesh(new TorusGeometry(.16, .012, 6, 40), new MeshStandardMaterial({ roughness: .82 }), 9);
    const dummy = new Object3D();
    for (let i = 0; i < 9; i++) {
      dummy.position.set(Math.sin(i * 5) * .17, .115 + i * .013, Math.cos(i * 3) * .14);
      dummy.rotation.set(Math.PI / 2 + Math.sin(i) * .15, Math.cos(i) * .1, i);
      dummy.updateMatrix(); spare.setMatrixAt(i, dummy.matrix); spare.setColorAt(i, new Color(['#d4b678', '#647e65', '#a96f4b'][i % 3]));
    }
    spare.castShadow = true; props.add(spare); this.scene.add(props);
    const loose = new Mesh(new TorusGeometry(.2, .013, 6, 48), new MeshStandardMaterial({ color: '#ceb071', roughness: .9 }));
    loose.rotation.set(Math.PI / 2, .04, -.6); loose.position.set(2.2, .016, -.24); loose.castShadow = true; this.scene.add(loose);
  }

  resize() {
    if (this.disposed) return;
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.webgl.setSize(bounds.width, bounds.height, false);
    this.camera.aspect = bounds.width / bounds.height;
    const verticalSpan = Math.max(4.65, 2.75 / this.camera.aspect);
    const distance = verticalSpan / (2 * Math.tan(this.camera.fov * Math.PI / 360));
    this.cameraHome.copy(new Vector3(.27, .59, .76).normalize().multiplyScalar(distance).add(this.lookAt));
    this.camera.position.copy(this.cameraHome); this.camera.lookAt(this.lookAt); this.camera.updateProjectionMatrix();
    if (bounds.width > bounds.height && bounds.height <= 560) this.camera.setViewOffset(bounds.width, bounds.height, bounds.width * .18, 0, bounds.width, bounds.height);
    else this.camera.clearViewOffset();
    this.meter.resize(); this.dirty = true;
  }
  reset() { this.particles.reset(); this.dirty = true; this.previousBands = -1; }
  burst() { this.particles.trigger(this.watermelon.root.position.y); this.dirty = true; }

  render(game: Game, time: number, reduced: boolean) {
    if (!this.available || this.disposed) return;
    this.meter.render(game);
    if (game.phase === 'result' && this.previousPhase !== 'result') this.resultStarted = time;
    const changed = this.previousBands !== game.bands || this.previousPhase !== game.phase;
    this.previousBands = game.bands; this.previousPhase = game.phase;
    if (changed) this.dirty = true;
    const settling = game.phase === 'result' && time - this.resultStarted < 1.6;
    const animation = game.snapTime < .42 || game.phase === 'cracking' || game.phase === 'bursting' || settling;
    const settle = this.wasAnimating && !animation; this.wasAnimating = animation;
    if (!this.dirty && !animation && !settle) return;
    // Under load, lower only the 3D resolution. The timing instrument keeps its own full-rate RAF.
    if (animation && this.previousTime) {
      const dt = time - this.previousTime;
      if (dt > 0 && dt < .2) { this.frameTime += (dt - this.frameTime) * .05; this.samples++; }
      if (this.samples > 100 && this.frameTime > .03 && this.ratio > 1) {
        this.ratio = Math.max(1, this.ratio - .25); this.webgl.setPixelRatio(this.ratio); this.resize(); this.samples = 0;
      }
    }
    this.previousTime = time;
    if (!this.dirty && animation && this.ratio <= 1 && time - this.lastDraw < 1 / 32) return;
    let visual = game.phaseTime;
    if (game.phase === 'bursting') visual -= clamp((visual - FLIGHT_DURATION) / HIT_STOP) * HIT_STOP;
    if (game.phase === 'result') visual = Math.min(4, game.phaseTime - HIT_STOP + time - this.resultStarted);
    this.camera.position.copy(this.cameraHome);
    if (!reduced && game.phase === 'bursting' && visual < .56) {
      const shake = .045 * (1 - visual / .56);
      this.camera.position.x += Math.sin(visual * 133) * shake; this.camera.position.y += Math.cos(visual * 157) * shake * .6;
    }
    this.camera.lookAt(this.lookAt);
    this.watermelon.update(game, time, visual, reduced); this.particles.update(visual, reduced);
    this.webgl.shadowMap.needsUpdate = true;
    this.webgl.render(this.scene, this.camera); this.dirty = false; this.lastDraw = time;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.observer.disconnect(); this.events.abort();
    const geometries = new Set<{ dispose(): void }>(), materials = new Set<Material>(), textures = new Set<Texture>();
    this.scene.traverse(object => {
      const mesh = object as Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
      if (object instanceof InstancedMesh) object.dispose();
    });
    for (const material of materials) for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    for (const item of [...geometries, ...textures, ...materials]) item.dispose();
    this.light.shadow.map?.dispose(); this.environment.dispose(); this.webgl.dispose(); this.webgl.forceContextLoss(); this.scene.clear();
  }
}
