import { test, expect } from '@playwright/test';

test('BGM starts on interaction, effects sound, mute silences both and ON resumes one loop', async ({ page }) => {
  // Observe real audio output after the compressor, using a test-only analyser in the audio graph.
  await page.addInitScript(() => {
    const probe = { analyser: null as AnalyserNode | null, sources: [] as AudioBufferSourceNode[] };
    (window as unknown as { audioProbe: typeof probe }).audioProbe = probe;
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (...args: Parameters<AudioNode['connect']>) {
      if (args[0] instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser(); analyser.fftSize = 2048; probe.analyser = analyser;
        connect.call(this, analyser); connect.call(analyser, args[0]); return args[0];
      }
      return connect.apply(this, args);
    } as AudioNode['connect'];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () { const source = create.call(this); probe.sources.push(source); return source; };
  });
  await page.goto('./'); await expect(page.locator('#game')).toHaveAttribute('data-render', 'ready', { timeout: 20000 });
  const measure = () => page.evaluate(() => {
    const probe = (window as unknown as { audioProbe: { analyser: AnalyserNode | null; sources: AudioBufferSourceNode[] } }).audioProbe;
    if (!probe.analyser) return { rms: 0, loops: 0, effects: 0 };
    const samples = new Float32Array(probe.analyser.fftSize); probe.analyser.getFloatTimeDomainData(samples);
    return { rms: Math.sqrt(samples.reduce((total, sample) => total + sample * sample, 0) / samples.length), loops: probe.sources.filter(source => source.loop).length, effects: probe.sources.filter(source => !source.loop).length };
  });
  expect(await measure()).toEqual({ rms: 0, loops: 0, effects: 0 });
  await page.locator('#action').click(); await page.waitForTimeout(600); // The start chime has ended: measure the BGM itself.
  await expect.poll(async () => (await measure()).rms).toBeGreaterThan(.002);
  expect((await measure()).loops).toBe(1);
  await page.locator('#action').click(); expect((await measure()).effects).toBeGreaterThan(0);
  const count = await page.locator('#band-count').textContent();
  await page.locator('#sound').click(); await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(350); expect((await measure()).rms).toBeLessThan(.0001);
  const effectsBeforeMute = (await measure()).effects;
  await page.locator('#action').click(); expect((await measure()).effects).toBe(effectsBeforeMute);
  expect((await measure()).rms).toBeLessThan(.0001);
  await page.locator('#sound').click(); await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await measure()).rms).toBeGreaterThan(.002);
  expect((await measure()).loops).toBe(1); await expect(page.locator('#band-count')).toHaveText(String(Number(count) + 1));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate(() => (window as unknown as { audioProbe: { analyser: AnalyserNode } }).audioProbe.analyser.context.state)).toBe('suspended');
  await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate(() => (window as unknown as { audioProbe: { analyser: AnalyserNode } }).audioProbe.analyser.context.state)).toBe('running');
  await expect.poll(async () => (await measure()).rms).toBeGreaterThan(.002);
  expect((await measure()).loops).toBe(1);
  await expect(page).toHaveTitle('スイカ輪ゴムチャレンジ 🍉 | 無料ワンタップゲーム');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'スイカ輪ゴムチャレンジ 🍉');
});
