import { test, expect } from '@playwright/test';

test('BGM starts on interaction, effects sound, mute silences both and ON resumes one loop', async ({ page }, testInfo) => {
  const press = (id: string) => testInfo.project.use.hasTouch ? page.locator(id).tap() : page.locator(id).click();
  // Observe real audio output after the compressor, using a test-only analyser in the audio graph.
  await page.addInitScript(() => {
    if (!('audioSession' in navigator)) Object.defineProperty(navigator, 'audioSession', { value: { type: 'auto' } });
    const probe = { analyser: null as AnalyserNode | null, sources: [] as AudioBufferSourceNode[], gesture: false, createdWithGesture: false };
    for (const type of ['keydown', 'mousedown', 'pointerdown', 'pointerup', 'touchend']) document.addEventListener(type, event => {
      const pointer = event as PointerEvent;
      if (event.isTrusted && (type === 'keydown' || type === 'mousedown' || type === 'touchend' || type === 'pointerdown' && pointer.pointerType === 'mouse' || type === 'pointerup' && pointer.pointerType !== 'mouse')) probe.gesture = true;
    }, true);
    (window as unknown as { audioProbe: typeof probe }).audioProbe = probe;
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (...args: Parameters<AudioNode['connect']>) {
      if (args[0] instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser(); analyser.fftSize = 2048; probe.analyser = analyser; probe.createdWithGesture = probe.gesture;
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
  await press('#action');
  expect(await page.evaluate(() => (window as unknown as { audioProbe: { createdWithGesture: boolean } }).audioProbe.createdWithGesture)).toBe(true);
  await page.waitForTimeout(600); // The start chime has ended: measure the BGM itself.
  await expect.poll(async () => (await measure()).rms).toBeGreaterThan(.002);
  expect((await measure()).loops).toBe(1);
  expect(await page.evaluate(() => (navigator as unknown as { audioSession: { type: string } }).audioSession.type)).toBe('playback');
  await press('#action'); expect((await measure()).effects).toBeGreaterThan(0);
  const count = await page.locator('#band-count').textContent();
  await press('#sound'); await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => (navigator as unknown as { audioSession: { type: string } }).audioSession.type)).toBe('auto');
  await page.waitForTimeout(350); expect((await measure()).rms).toBeLessThan(.0001);
  const effectsBeforeMute = (await measure()).effects;
  await press('#action'); expect((await measure()).effects).toBe(effectsBeforeMute);
  expect((await measure()).rms).toBeLessThan(.0001);
  await press('#sound'); await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await measure()).rms).toBeGreaterThan(.002);
  expect((await measure()).loops).toBe(1); await expect(page.locator('#band-count')).toHaveText(String(Number(count) + 1));
  expect(await page.evaluate(() => (navigator as unknown as { audioSession: { type: string } }).audioSession.type)).toBe('playback');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate(() => (window as unknown as { audioProbe: { analyser: AnalyserNode } }).audioProbe.analyser.context.state)).toBe('suspended');
  await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate(() => (window as unknown as { audioProbe: { analyser: AnalyserNode } }).audioProbe.analyser.context.state)).toBe('running');
  await expect.poll(async () => (await measure()).rms).toBeGreaterThan(.002);
  expect((await measure()).loops).toBe(1);
  await expect(page).toHaveTitle('スイカ輪ゴムチャレンジ 🍉 | 無料ワンタップゲーム');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'スイカ輪ゴムチャレンジ 🍉');
});

test('a denied audio start stays visibly waiting and the sound button retries without adding a band', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const Context = window.AudioContext; let first = true;
    window.AudioContext = new Proxy(Context, { construct(target, args) {
      if (first) { first = false; throw new DOMException('User gesture required', 'NotAllowedError'); }
      return Reflect.construct(target, args);
    } });
  });
  const press = (id: string) => testInfo.project.use.hasTouch ? page.locator(id).tap() : page.locator(id).click();
  await page.goto('./'); await expect(page.locator('#game')).toHaveAttribute('data-render', 'ready', { timeout: 20000 });
  await press('#action'); await expect(page.locator('#game')).toHaveAttribute('data-phase', 'playing');
  await expect(page.locator('#game')).toHaveAttribute('data-sound', 'waiting');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#sound-hint')).toHaveText('TAP FOR SOUND');
  await press('#sound'); await expect(page.locator('#game')).toHaveAttribute('data-sound', 'on');
  await expect(page.locator('#band-count')).toHaveText('0');
});
