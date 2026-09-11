// Development-only real-renderer comparison. No QA state is exposed by the shipped UI.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const origin = process.env.GAME_URL || 'http://127.0.0.1:5173';
const report = [];
try {
  for (const width of [390, 1200]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 800 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/intensity-qa', route => route.fulfill({ contentType: 'text/html', body: '<style>body{margin:0}#scene{display:block;width:100vw;height:100vh}#meter{position:absolute;width:300px;height:130px;visibility:hidden}</style><canvas id="scene"></canvas><canvas id="meter"></canvas>' }));
    await page.goto(`${origin}/intensity-qa`);
    const variants = await page.evaluate(async () => {
      const { Renderer } = await import('/src/render.ts'), { Game } = await import('/src/game.ts');
      const { createBurstProfile } = await import('/src/visual/burst-profile.ts');
      const renderer = new Renderer(document.querySelector('#scene'), document.querySelector('#meter'));
      await renderer.prepare(); window.intensityQA = { renderer, game: new Game(() => .8), time: 1 };
      const seeds = {};
      for (let seed = 1; seed < 100; seed++) { const p = createBurstProfile(55, seed); seeds[p.kind] ??= seed; }
      return Object.values(seeds);
    });
    const cases = [15, 35, 55, 70].map(bands => ({ bands, seed: variants[0] }));
    cases.push(...variants.slice(1).map(seed => ({ bands: 55, seed })));
    const casesReport = [];
    for (const scenario of cases) {
      const start = await page.evaluate(({ bands, seed }) => {
        const qa = window.intensityQA, { renderer, game } = qa;
        game.start(); game.bands = bands; game.snapTime = 1; renderer.reset(); renderer.render(game, qa.time += 5, false);
        renderer.burst(bands, seed); game.phase = 'bursting'; game.phaseTime = .15;
        renderer.render(game, qa.time += .15, false);
        return { profile: renderer.burstProfile, upperY: renderer.watermelon.upper.position.y,
          sharedProfile: renderer.watermelon.burstProfile === renderer.burstProfile,
          programs: renderer.webgl.info.programs.length };
      }, scenario);
      assert.equal(start.sharedProfile, true); assert.ok(start.upperY > 0);
      // The large pieces inherit exactly the position/orientation of the upward-moving half.
      const seamJump = await page.evaluate(() => {
        const qa = window.intensityQA, { renderer, game } = qa, split = renderer.burstProfile.splitTime;
        game.phaseTime = split + .14; renderer.render(game, qa.time += .2, false);
        const before = renderer.watermelon.upper.children.map(section => section.matrixWorld.clone());
        game.phaseTime += 1e-7; renderer.render(game, qa.time += .05, false);
        return Math.max(...renderer.watermelon.upper.children.flatMap((section, i) => section.matrixWorld.elements.map((value, k) => Math.abs(value - before[i].elements[k]))));
      });
      assert.ok(seamJump < 1e-5, `discontinuous upper split: ${seamJump}`);
      for (const time of [.8, 1.6, 3.8]) {
        const frame = await page.evaluate(time => {
          const qa = window.intensityQA, { renderer, game } = qa;
          game.phaseTime = time + .14; renderer.render(game, qa.time += 1, false);
          const spray = renderer.particles.root.getObjectByName('JuiceParticles');
          const marks = renderer.particles.root.getObjectByName('JuiceOnTable');
          let finite = true; renderer.scene.traverse(mesh => { if (mesh.isInstancedMesh) finite &&= Array.from(mesh.instanceMatrix.array).every(Number.isFinite); });
          return { finite, sprayCount: spray.count, stainCount: marks.count,
            geometries: renderer.webgl.info.memory.geometries, textures: renderer.webgl.info.memory.textures, programs: renderer.webgl.info.programs.length };
        }, time);
        assert.ok(frame.finite); assert.ok(frame.sprayCount <= 240); assert.equal(frame.programs, start.programs);
        await page.screenshot({ path: `artifacts/intensity-${width}-${scenario.bands}-${start.profile.kind}-${time}.png` });
      }
      const final = await page.evaluate(() => {
        const qa = window.intensityQA, { renderer, game } = qa;
        renderer.particles.update(3.8, true);
        const reduced = renderer.particles.root.getObjectByName('JuiceParticles').count;
        game.start(); renderer.reset(); renderer.render(game, qa.time += 5, false);
        return { reduced, cleared: !renderer.particles.root.visible && renderer.particles.root.getObjectByName('JuiceOnTable').count === 0 };
      });
      assert.ok(final.reduced <= 48); assert.equal(final.cleared, true);
      casesReport.push({ ...scenario, kind: start.profile.kind, power: start.profile.power, upperY: start.upperY, primaryDrops: start.profile.primaryDrops, seamJump, reduced: final.reduced });
    }
    for (let i = 1; i < 4; i++) assert.ok(casesReport[i].upperY > casesReport[i - 1].upperY && casesReport[i].primaryDrops > casesReport[i - 1].primaryDrops);
    assert.equal(new Set(casesReport.map(c => c.kind)).size, 3); assert.deepEqual(errors, []);
    report.push({ width, cases: casesReport, errors });
    await page.evaluate(() => window.intensityQA.renderer.dispose()); await page.close();
  }
  await writeFile('artifacts/intensity-report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
