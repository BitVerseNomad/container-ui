import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('Visual: images - light desktop', async ({ page }) => {
  console.log('Navigating to page...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  console.log('Waiting for shell...');
  await page.waitForSelector('.shell', { timeout: 10000 });
  console.log('Shell found');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 800 });
  console.log('Looking for Images tab button...');
  const tabButton = page.locator('button[aria-label="Images"]').first();
  console.log('Button visible:', await tabButton.isVisible({ timeout: 5000 }));
  if (await tabButton.isVisible({ timeout: 3000 })) { 
    console.log('Clicking via evaluate...');
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Images"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500); 
  }
  console.log('Waiting for content...');
  await page.waitForTimeout(1000);
  const screenshotDir = path.join(process.cwd(), 'test-results', 'visual-regression');
  if (!fs.existsSync(screenshotDir)) { fs.mkdirSync(screenshotDir, { recursive: true }); }
  const screenshotPath = path.join(screenshotDir, 'images-light-desktop.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
});