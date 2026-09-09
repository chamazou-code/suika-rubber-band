import { test, expect, Page } from '@playwright/test';
async function press(page:Page){await page.keyboard.press('Space');}
// Sample all state transitions at 20fps without forcing the CI software GPU to paint 60fps.
// Each tick stays within the game's 50ms cap; this still advances the real game loop.
async function advance(page:Page,ms:number){
  while(ms>0){const step=Math.min(50,ms);await page.clock.fastForward(step);ms-=step;}
}
async function spam(page:Page,count:number){
  await page.evaluate(count=>{for(let i=0;i<count;i++)document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));},count);
}
test('start, real input, spam lock, upward burst, result, retry and BEST persistence',async({page},testInfo)=>{
  test.setTimeout(process.env.CI ? 120_000 : 60_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Math.random=()=>.5;});
  await page.goto('./');
  await expect(page.locator('#game')).toHaveAttribute('data-render','ready',{timeout:20000});
  expect(await page.locator('#scene').evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
    return !!gl && !gl.isContextLost() && gl.getError() === gl.NO_ERROR;
  })).toBe(true);
  await page.clock.install({time:new Date('2026-09-09T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-09-09T00:00:01Z'));
  await page.clock.runFor(100);
  await expect(page.locator('#game')).toHaveAttribute('data-phase','ready');
  await page.screenshot({scale:'css',path:`artifacts/${testInfo.project.name}-ready.png`});
  const initial=await page.locator('#action').boundingBox();expect(initial!.width).toBeGreaterThan(160);expect(initial!.height).toBeGreaterThanOrEqual(42);
  await page.locator('#action').click();await expect(page.locator('#band-count')).toHaveText('0');
  await page.keyboard.down('Space');await page.keyboard.down('Space');await page.keyboard.up('Space');
  await expect(page.locator('#band-count')).toHaveText('1');
  await spam(page,20);
  await expect(page.locator('#band-count')).toHaveText('1');
  let attempts=1;
  while(await page.locator('#game').getAttribute('data-phase')==='playing' && attempts<71){
    await advance(page,320);await press(page);attempts++;
  }
  await expect(page.locator('#game')).toHaveAttribute('data-phase','cracking');
  const bands=Number(await page.locator('#band-count').textContent());expect(bands).toBeGreaterThan(10);expect(bands).toBeLessThan(55);
  await expect(page.locator('#action')).toBeDisabled();
  await spam(page,15);
  await expect(page.locator('#band-count')).toHaveText(String(bands));
  await advance(page,340);await page.screenshot({scale:'css',path:`artifacts/${testInfo.project.name}-upward.png`});
  await advance(page,380);await page.screenshot({scale:'css',path:`artifacts/${testInfo.project.name}-impact.png`});
  await advance(page,2400);await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#meter-visual')).toBeHidden();
  await expect(page.locator('#action-label')).toHaveText('TRY ANOTHER');
  await expect(page.locator('#result-count')).toHaveText(String(bands));
  await expect(page.locator('#best-count')).toHaveText(String(bands));
  await page.screenshot({scale:'css',path:`artifacts/${testInfo.project.name}-result.png`});
  await page.clock.fastForward(1800);await page.clock.runFor(50);
  await expect(page.locator('#game')).toHaveAttribute('data-phase','result');
  await page.screenshot({scale:'css',path:`artifacts/${testInfo.project.name}-settled.png`});
  await page.locator('#action').click();
  // Exercise any leftover timers without rendering 240 idle frames of the new round.
  await page.clock.fastForward(4000);
  await expect(page.locator('#band-count')).toHaveText('0');await expect(page.locator('#result')).toBeHidden();await expect(page.locator('#game')).toHaveAttribute('data-phase','playing');
  await expect(page.locator('#meter-visual')).toBeVisible();
  await expect(page.locator('#retry-message')).toBeHidden();
  await page.reload();await expect(page.locator('#game')).toHaveAttribute('data-phase','ready');
  expect(await page.evaluate(()=>localStorage.getItem('rubber-band-best'))).toBe(String(bands));
  expect(errors).toEqual([]);
});

test('WebGL context loss pauses input and restores the same round',async({page,browserName})=>{
  test.skip(browserName !== 'chromium','The WEBGL_lose_context simulation is checked in Chromium; normal WebKit rendering is covered above.');
  await page.goto('./');
  await expect(page.locator('#game')).toHaveAttribute('data-render','ready',{timeout:20000});
  await page.keyboard.press('Space');await page.keyboard.press('Space');
  await expect(page.locator('#band-count')).toHaveText('1');
  const contextControl=await page.evaluateHandle(()=>{
    const gl=(document.querySelector('#scene') as HTMLCanvasElement).getContext('webgl2')!;
    return gl.getExtension('WEBGL_lose_context')!;
  });
  await contextControl.evaluate(extension=>extension.loseContext());
  await expect(page.locator('#game')).toHaveAttribute('data-render','unavailable');
  await expect(page.locator('#render-error')).toBeVisible();await expect(page.locator('#action')).toBeDisabled();
  await page.keyboard.press('Space');await expect(page.locator('#band-count')).toHaveText('1');
  await contextControl.evaluate(extension=>extension.restoreContext());
  await contextControl.dispose();
  await expect(page.locator('#game')).toHaveAttribute('data-render','ready',{timeout:20000});
  await expect(page.locator('#render-error')).toBeHidden();await expect(page.locator('#game')).toHaveAttribute('data-phase','playing');
  await page.waitForTimeout(350);await page.keyboard.press('Space');await expect(page.locator('#band-count')).toHaveText('2');
});
test('320px and landscape fit; touch adds exactly one; mute is not a game input; reduced motion',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./');
  await expect(page.locator('#game')).toHaveAttribute('data-render','ready',{timeout:20000});
  for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(size);
    await expect(page.locator('#action')).toBeInViewport();
    const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight,bottom:document.querySelector('#action')!.getBoundingClientRect().bottom}));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
    await page.screenshot({scale:'css',path:`artifacts/${testInfo.project.name}-${size.width}.png`});
  }
  await page.setViewportSize({width:320,height:568});
  await page.locator('#sound').click();await expect(page.locator('#game')).toHaveAttribute('data-phase','ready');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');
  if(testInfo.project.use.hasTouch){
    await page.locator('#action').tap();await page.touchscreen.tap(150,200);
  }else {await page.locator('#action').click();await page.mouse.click(150,200);}
  await expect(page.locator('#band-count')).toHaveText('1');
  await page.locator('#sound').click();await expect(page.locator('#band-count')).toHaveText('1');
  expect(errors).toEqual([]);
});
test('blocked storage and held Space leave the game playable',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  await page.goto('./');await expect(page.locator('#game')).toHaveAttribute('data-render','ready',{timeout:20000});await page.keyboard.press('Space');
  await page.keyboard.down('Space');await page.waitForTimeout(900);await page.keyboard.down('Space');await page.keyboard.up('Space');
  await expect(page.locator('#band-count')).toHaveText('1');
  await expect(page.locator('body')).not.toContainText(/NaN|Infinity/);
});
