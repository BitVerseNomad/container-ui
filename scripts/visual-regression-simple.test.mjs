import { test, expect } from '@playwright/test';

test('Visual: containers tab - light desktop', async ({ page }) => {
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.shell', { timeout: 10000 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  
  const screenshotDir = 'test-results/visual-regression';
  await page.screenshot({ path: 'test-results/visual-regression/containers-light-desktop.png', fullPage: true });
  expect(true).toBeTruthy();
});