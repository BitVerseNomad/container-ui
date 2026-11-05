import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TABS = [
  { name: 'containers', url: '/', tab: 'Containers' },
  { name: 'images', url: '/', tab: 'Images' },
  { name: 'volumes', url: '/', tab: 'Volumes' },
];

const CONFIG = { name: 'light-desktop', colorScheme: 'light', viewport: { width: 1280, height: 800 } };
const BASE_URL = 'http://localhost:4173';

for (const tab of TABS) {
  test(`Visual: ${tab.name} - ${CONFIG.name}`, async ({ page }) => {
    await page.goto(BASE_URL + tab.url, { waitUntil: 'networkidle' });
    await page.waitForSelector('.shell', { timeout: 10000 });
    await page.emulateMedia({ colorScheme: CONFIG.colorScheme });
    await page.setViewportSize(CONFIG.viewport);

    if (tab.tab !== 'Containers') {
      const tabButton = page.locator(`button[aria-label="${tab.tab}"]`).first();
      if (await tabButton.isVisible()) {
        await tabButton.click();
        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(1000);

    const screenshotDir = path.join(process.cwd(), 'test-results', 'visual-regression');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const screenshotPath = path.join(screenshotDir, `${tab.name}-${CONFIG.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBeTruthy();
  });
});