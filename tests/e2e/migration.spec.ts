import { test, expect } from '@playwright/test';

test('an old-site BEST survives the domain move and the imported score leaves the URL', async ({ page }) => {
  await page.goto('./?from=legacy#best=53');
  await expect(page.locator('#game')).toHaveAttribute('data-render', 'ready', { timeout: 20000 });
  await expect(page.locator('#hud-best')).toHaveText('53');
  expect(new URL(page.url()).hash).toBe('');
  expect(new URL(page.url()).search).toBe('?from=legacy');
  expect(await page.evaluate(() => localStorage.getItem('rubber-band-best'))).toBe('53');
  await page.goto('./#best=21');
  await expect(page.locator('#hud-best')).toHaveText('53');
  await page.reload();
  await expect(page.locator('#hud-best')).toHaveText('53');
});
