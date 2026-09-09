// Use the actual game renderer for the sharing image; no external image assets.
import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:process.env.CI ? undefined : 'chrome'});
const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173/');
await page.locator('#game[data-render="ready"]').waitFor();
await page.evaluate(()=>document.fonts.ready);
await page.screenshot({path:'public/social.png'});await browser.close();
