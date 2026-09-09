// Development-only, late-game visual inspection. Nothing is added to the production game.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.route('**/qa-harness', route => route.fulfill({ contentType: 'text/html', body: '<style>body{margin:0}#scene{width:900px;height:900px}#meter{position:absolute;left:-9999px;width:300px;height:130px}</style><canvas id="scene"></canvas><canvas id="meter"></canvas>' }));
await page.goto('http://127.0.0.1:5173/qa-harness');
await page.evaluate(async () => {
  const { Renderer } = await import('/src/render.ts'), { Game } = await import('/src/game.ts');
  const renderer = new Renderer(document.querySelector('#scene'), document.querySelector('#meter'));
  await renderer.prepare(); const game = new Game(); game.start(); game.bands = 55; game.snapTime = 1;
  window.qa = { renderer, game }; renderer.render(game, 1, true);
});
await page.screenshot({ path: 'artifacts/lower-55-constricted.png' });
const samples = [];
for (const time of [.001, .24, .5, .84, 2.5]) {
  samples.push(await page.evaluate(time => {
    const { renderer, game } = window.qa;
    game.phase = 'bursting'; game.phaseTime = time;
    if (time === .001) renderer.burst(); renderer.render(game, 1 + time, true);
    const melon = renderer.watermelon, cut = melon.lower.getObjectByName('InteriorFlesh');
    return { time, opening: cut.scale.x, cutHeight: melon.root.position.y + cut.position.y, base: melon.root.position.y + melon.lowerSurface.geometry.boundingBox.min.y };
  }, time));
  await page.screenshot({ path: `artifacts/lower-release-${time}.png` });
}
await page.evaluate(() => { const { renderer, game } = window.qa; game.start(); renderer.reset(); renderer.render(game, 5, true); });
await page.screenshot({ path: 'artifacts/lower-release-retry.png' });
console.log(JSON.stringify(samples, null, 2)); await writeFile('artifacts/lower-release.json', JSON.stringify(samples, null, 2));
await page.evaluate(() => window.qa.renderer.dispose());
} finally { await browser.close(); }
