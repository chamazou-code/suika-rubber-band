import { test, expect, Page } from '@playwright/test';
async function press(page:Page){await page.keyboard.press('Space');}
test('start, real input, spam lock, upward burst, result, retry and BEST persistence',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Math.random=()=>.5;});
  await page.clock.install();await page.goto('/');await page.clock.runFor(100);
  await expect(page.locator('#game')).toHaveAttribute('data-phase','ready');
  await page.screenshot({path:`artifacts/${testInfo.project.name}-ready.png`});
  const initial=await page.locator('#action').boundingBox();expect(initial!.width).toBeGreaterThan(240);
  await page.locator('#action').click();await expect(page.locator('#band-count')).toHaveText('0');
  await page.keyboard.down('Space');await page.keyboard.down('Space');await page.keyboard.up('Space');
  await expect(page.locator('#band-count')).toHaveText('1');
  for(let i=0;i<20;i++)await press(page);
  await expect(page.locator('#band-count')).toHaveText('1');
  let attempts=1;
  while(await page.locator('#game').getAttribute('data-phase')==='playing' && attempts<71){
    await page.clock.runFor(320);await press(page);attempts++;
  }
  await expect(page.locator('#game')).toHaveAttribute('data-phase','cracking');
  const bands=Number(await page.locator('#band-count').textContent());expect(bands).toBeGreaterThan(10);expect(bands).toBeLessThan(55);
  await expect(page.locator('#action')).toBeDisabled();
  for(let i=0;i<15;i++)await press(page);
  await expect(page.locator('#band-count')).toHaveText(String(bands));
  await page.clock.runFor(340);await page.screenshot({path:`artifacts/${testInfo.project.name}-upward.png`});
  await page.clock.runFor(380);await page.screenshot({path:`artifacts/${testInfo.project.name}-impact.png`});
  await page.clock.runFor(2400);await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText(String(bands));
  await expect(page.locator('#best-count')).toHaveText(String(bands));
  await page.screenshot({path:`artifacts/${testInfo.project.name}-result.png`});
  await page.locator('#action').click();await page.clock.runFor(4000);
  await expect(page.locator('#band-count')).toHaveText('0');await expect(page.locator('#result')).toBeHidden();await expect(page.locator('#game')).toHaveAttribute('data-phase','playing');
  await page.reload();await expect(page.locator('#game')).toHaveAttribute('data-phase','ready');
  expect(await page.evaluate(()=>localStorage.getItem('rubber-band-best'))).toBe(String(bands));
  expect(errors).toEqual([]);
});
test('320px and landscape fit; touch adds exactly one; mute is not a game input; reduced motion',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(size);
    await expect(page.locator('#action')).toBeInViewport();
    const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight,bottom:document.querySelector('#action')!.getBoundingClientRect().bottom}));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
    await page.screenshot({path:`artifacts/${testInfo.project.name}-${size.width}.png`});
  }
  await page.setViewportSize({width:320,height:568});
  await page.locator('#sound').click();await expect(page.locator('#game')).toHaveAttribute('data-phase','ready');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');
  if(testInfo.project.use.hasTouch){
    await page.locator('#action').tap();await page.locator('#scene').tap();
  }else {await page.locator('#action').click();await page.locator('#scene').click();}
  await expect(page.locator('#band-count')).toHaveText('1');
  await page.locator('#sound').click();await expect(page.locator('#band-count')).toHaveText('1');
  expect(errors).toEqual([]);
});
test('blocked storage and held Space leave the game playable',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  await page.goto('/');await page.keyboard.press('Space');
  await page.keyboard.down('Space');await page.waitForTimeout(900);await page.keyboard.down('Space');await page.keyboard.up('Space');
  await expect(page.locator('#band-count')).toHaveText('1');
  await expect(page.locator('body')).not.toContainText(/NaN|Infinity/);
});
