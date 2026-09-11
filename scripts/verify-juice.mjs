// Development-only visual comparison and CPU/resource check. Never imported by the game.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const label = process.argv[2] || 'after';
const origin = process.env.GAME_URL || 'http://127.0.0.1:5173';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const reports = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1200, height: 800 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/juice-qa', route => route.fulfill({ contentType: 'text/html', body: '<style>body{margin:0}#scene{width:100vw;height:100vh;display:block}#meter{position:absolute;width:300px;height:130px;left:0;top:0;visibility:hidden}</style><canvas id="scene"></canvas><canvas id="meter"></canvas>' }));
    await page.goto(`${origin}/juice-qa`);
    await page.evaluate(async () => {
      const { Renderer } = await import('/src/render.ts'); const { Game } = await import('/src/game.ts');
      const renderer = new Renderer(document.querySelector('#scene'), document.querySelector('#meter'));
      await renderer.prepare(); const game = new Game(() => .8); game.start(); game.bands = 50; game.snapTime = 1;
      renderer.render(game, 1, false); renderer.burst(); game.phase = 'bursting';
      window.juiceQA = { renderer, game };
    });
    for (const time of [.12, .4, .9, 1.35, 2.2, 3.8]) {
      const info = await page.evaluate(time => {
        const { renderer, game } = window.juiceQA;
        game.phaseTime = time + (time > .24 ? .14 : 0);
        renderer.render(game, time + 2, false);
        const webgl = renderer.webgl.info;
        return { calls: webgl.render.calls, triangles: webgl.render.triangles, geometries: webgl.memory.geometries, textures: webgl.memory.textures, programs: webgl.programs.length };
      }, time);
      await page.screenshot({ path: `artifacts/juice-${label}-${viewport.width}-${time}.png` });
      reports.push({ viewport, time, ...info });
    }
    // Same absolute visual times with and without skipped frames, plus repeated rounds.
    const cpu = await page.evaluate(() => {
      const { renderer } = window.juiceQA; const timings = [];
      const particles = renderer.particles;
      const spray = particles.root.getObjectByName('JuiceParticles'), stains = particles.root.getObjectByName('JuiceOnTable');
      particles.reset(); particles.trigger(1.23); particles.update(.1, false);
      const dryBeforeLanding = Array.from({ length: stains.count }, (_, i) => stains.instanceMatrix.array[i * 16]).every(scale => scale === 0);
      particles.update(1.35, false);
      const finiteMatrices = [...spray.instanceMatrix.array, ...stains.instanceMatrix.array].every(Number.isFinite);
      const fullCount = spray.count;
      particles.update(1.35, true); const reducedCount = spray.count;
      particles.update(4, false);
      const landedCount = Array.from({ length: stains.count }, (_, i) => Math.hypot(...stains.instanceMatrix.array.slice(i * 16, i * 16 + 3))).filter(scale => scale > 0).length;
      const airborneAfterSettling = Array.from({ length: spray.count }, (_, i) => Math.hypot(...spray.instanceMatrix.array.slice(i * 16, i * 16 + 3))).some(scale => scale > 0);
      particles.reset(); const clearedCount = spray.count + stains.count;
      for (let round = 0; round < 15; round++) {
        renderer.particles.reset(); renderer.particles.trigger(1.23);
        for (let frame = 0; frame <= 240; frame++) {
          const start = performance.now(); renderer.particles.update(frame / 60, false);
          if (round > 1) timings.push(performance.now() - start);
        }
      }
      timings.sort((a, b) => a - b);
      renderer.reset(); const hiddenAfterReset = !renderer.particles.root.visible;
      renderer.dispose();
      return { dryBeforeLanding, finiteMatrices, fullCount, reducedCount, landedCount, airborneAfterSettling, clearedCount, updateMedianMs: timings[Math.floor(timings.length / 2)], updateP95Ms: timings[Math.floor(timings.length * .95)], hiddenAfterReset };
    });
    assert.equal(cpu.dryBeforeLanding, true); assert.equal(cpu.finiteMatrices, true);
    assert.ok(cpu.fullCount > cpu.reducedCount && cpu.reducedCount > 0);
    assert.ok(cpu.landedCount >= 100); assert.equal(cpu.airborneAfterSettling, false);
    assert.equal(cpu.clearedCount, 0); assert.equal(cpu.hiddenAfterReset, true); assert.deepEqual(errors, []);
    reports.push({ viewport, cpu, errors }); await page.close();
  }
  await writeFile(`artifacts/juice-${label}-report.json`, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports.filter(item => item.cpu || item.time === .12), null, 2));
} finally { await browser.close(); }
