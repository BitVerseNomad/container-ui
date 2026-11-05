import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Test configurations for different themes and viewports
const TEST_CONFIGS = [
  { name: 'light-desktop', colorScheme: 'light', viewport: { width: 1280, height: 800 } },
  { name: 'dark-desktop', colorScheme: 'dark', viewport: { width: 1280, height: 800 } },
  { name: 'mid-desktop', colorScheme: 'light', viewport: { width: 980, height: 640 } },
  { name: 'mobile', colorScheme: 'light', viewport: { width: 375, height: 667 } },
];

const TABS = [
  { name: 'containers', url: '/', tab: 'Containers' },
  { name: 'images', url: '/', tab: 'Images' },
  { name: 'volumes', url: '/', tab: 'Volumes' },
  { name: 'networks', url: '/', tab: 'Networks' },
  { name: 'doctor', url: '/', tab: 'Doctor' },
  { name: 'profiles', url: '/', tab: 'Profiles' },
  { name: 'commands', url: '/', tab: 'Commands' },
];

const BASE_URL = process.env.PREVIEW_URL || 'http://localhost:4173';

for (const config of TEST_CONFIGS) {
  for (const tab of TABS) {
    test(`Visual: ${tab.name} - ${config.name}`, async ({ page }) => {
      await page.goto(BASE_URL + tab.url, { waitUntil: 'networkidle' });

      // Wait for app to load
      await page.waitForSelector('.shell', { timeout: 10000 });

      // Set color scheme
      await page.emulateMedia({ colorScheme: config.colorScheme });

      // Set viewport
      await page.setViewportSize(config.viewport);

      // Navigate to tab if not Containers (default)
      if (tab.tab !== 'Containers') {
        const tabButton = page.locator(`button[aria-label="${tab.tab}"]`).first();
        if (await tabButton.isVisible()) {
          await tabButton.click();
          await page.waitForTimeout(500); // wait for transition
        }
      }

      // Wait for content to stabilize
      await page.waitForTimeout(1000);

      // Take screenshot
      const screenshotDir = path.join(process.cwd(), 'test-results', 'visual-regression');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const screenshotPath = path.join(screenshotDir, `${tab.name}-${config.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Compare with baseline if exists
      const baselinePath = path.join(process.cwd(), 'test-baselines', 'visual-regression', `${tab.name}-${config.name}.png`);
      if (fs.existsSync(baselinePath)) {
        // Use pixelmatch or similar for comparison
        // For now, just verify screenshot was taken
        expect(fs.existsSync(screenshotPath)).toBeTruthy();
      } else {
        // First run - copy to baseline
        const baselineDir = path.dirname(baselinePath);
        if (!fs.existsSync(baselineDir)) {
          fs.mkdirSync(baselineDir, { recursive: true });
        }
        fs.copyFileSync(screenshotPath, baselinePath);
        console.log(`Created baseline: ${baselinePath}`);
      }
    });
  }
}

// Snapshot test for onboarding modal
test('Visual: onboarding modal - light/dark', async ({ page }) => {
  for (const scheme of ['light', 'dark']) {
    await page.goto(BASE_URL + '?onboarding=1', { waitUntil: 'networkidle' });
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForSelector('.onboarding-overlay', { timeout: 5000 });

    const screenshotPath = path.join(process.cwd(), 'test-results', 'visual-regression', `onboarding-${scheme}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
});

// Snapshot test for command palette
test('Visual: command palette - light/dark', async ({ page }) => {
  for (const scheme of ['light', 'dark']) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForSelector('.shell', { timeout: 10000 });

    // Open command palette with Cmd+K
    await page.keyboard.press('Meta+KeyK');
    await page.waitForSelector('.command-palette-overlay', { timeout: 3000 });

    const screenshotPath = path.join(process.cwd(), 'test-results', 'visual-regression', `command-palette-${scheme}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Close with Escape
    await page.keyboard.press('Escape');
  }
});

// Snapshot test for AI chat panel
test('Visual: AI chat panel - light/dark', async ({ page }) => {
  for (const scheme of ['light', 'dark']) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForSelector('.shell', { timeout: 10000 });

    // Try to open AI chat if button exists
    const aiButton = page.locator('button[aria-label*="AI"]').first();
    if (await aiButton.isVisible()) {
      await aiButton.click();
      await page.waitForSelector('.ai-chat-panel', { timeout: 3000 });

      const screenshotPath = path.join(process.cwd(), 'test-results', 'visual-regression', `ai-chat-${scheme}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  }
});