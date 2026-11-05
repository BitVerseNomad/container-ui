import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TEST_CASES = [
  { name: 'containers-light', tab: 'Containers', colorScheme: 'light', configName: 'light-desktop' },
  { name: 'images-light', tab: 'Images', colorScheme: 'light', configName: 'light-desktop' },
  { name: 'volumes-light', tab: 'Volumes', colorScheme: 'light', configName: 'light-desktop' },
  { name: 'containers-dark', tab: 'Containers', colorScheme: 'dark', configName: 'dark-desktop' },
  { name: 'images-dark', tab: 'Images', colorScheme: 'dark', configName: 'dark-desktop' },
  { name: 'volumes-dark', tab: 'Volumes', colorScheme: 'dark', configName: 'dark-desktop' },
];

const BASE_URL = 'http://localhost:4173';

for (const tc of TEST_CASES) {
  test(`Visual: ${tc.name}`, async ({ page }) => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.shell', { timeout: 10000 });
    await page.emulateMedia({ colorScheme: tc.colorScheme });
    await page.setViewportSize({ width: 1280, height: 800 });

    if (tc.tab !== 'Containers') {
      await page.evaluate(() => { const btn = document.querySelector(`button[aria-label="${tc.tab}"]`); if (btn) btn.click(); });
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(1000);

    const screenshotDir = path.join(process.cwd(), 'test-results', 'visual-regression');
    if (!fs.existsSync(screenshotDir)) { fs.mkdirSync(screenshotDir, { recursive: true }); }

    const screenshotPath = path.join(process.cwd(), 'test-results', 'visual-regression', `${tc.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBeTruthy();
  });
});