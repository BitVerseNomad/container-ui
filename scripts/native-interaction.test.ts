import { test, expect } from '@playwright/test';

test.describe('Native Tauri App - Real Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.shell', { timeout: 15000 });
  });

  test('App loads and shows sidebar with profile switcher', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible();
    
    const profileSwitcher = page.locator('[aria-label*="Switch profile"]').first();
    await expect(profileSwitcher).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ path: 'test-results/native/app-loaded.png', fullPage: true });
  });

  test('Can navigate to Images tab', async ({ page }) => {
    const imagesTab = page.locator('button[aria-label="Images"]').first();
    await expect(imagesTab).toBeVisible();
    
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Images"]');
      if (btn) btn.click();
    });
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/native/images-tab.png', fullPage: true });
  });

  test('Can navigate to Volumes tab', async ({ page }) => {
    const volumesTab = page.locator('button[aria-label="Volumes"]').first();
    await expect(volumesTab).toBeVisible();
    
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Volumes"]');
      if (btn) btn.click();
    });
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/native/volumes-tab.png', fullPage: true });
  });

  test('Can navigate to Networks tab', async ({ page }) => {
    const networksTab = page.locator('button[aria-label="Networks"]').first();
    await expect(networksTab).toBeVisible();
    
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Networks"]');
      if (btn) btn.click();
    });
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/native/networks-tab.png', fullPage: true });
  });

  test('Can navigate to Doctor tab', async ({ page }) => {
    const doctorTab = page.locator('button[aria-label="Doctor"]').first();
    await expect(doctorTab).toBeVisible();
    
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Doctor"]');
      if (btn) btn.click();
    });
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/native/doctor-tab.png', fullPage: true });
  });

  test('Can navigate to Profiles tab', async ({ page }) => {
    const profilesTab = page.locator('button[aria-label="Profiles"]').first();
    await expect(profilesTab).toBeVisible();
    
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Profiles"]');
      if (btn) btn.click();
    });
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/native/profiles-tab.png', fullPage: true });
  });

  test('Can open Onboarding modal (if not completed)', async ({ page }) => {
    const onboarding = page.locator('.onboarding-overlay');
    if (await onboarding.isVisible({ timeout: 2000 })) {
      await expect(onboarding).toBeVisible();
      await page.screenshot({ path: 'test-results/native/onboarding.png', fullPage: true });
      
      const nextBtn = page.locator('button:has-text("Começar a usar"), button:has-text("Próximo")').first();
      if (await nextBtn.isVisible({ timeout: 1000 })) {
        await nextBtn.click();
      }
    }
  });

  test('Can switch profile if multiple exist', async ({ page }) => {
    const profileSwitcher = page.locator('[aria-label*="Switch profile"]').first();
    await expect(profileSwitcher).toBeVisible({ timeout: 10000 });
    
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label*="Switch profile"]');
      if (btn) btn.click();
    });
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/native/profile-switcher.png', fullPage: true });
    
    await page.keyboard.press('Escape');
  });

  test.skip('Can open Command Palette with Cmd+K - not implemented yet', async ({ page }) => {
    await page.keyboard.press('Meta+KeyK');
    await page.waitForSelector('.command-palette-overlay', { timeout: 5000 });
    await expect(page.locator('.command-palette')).toBeVisible();
    await page.screenshot({ path: 'test-results/native/command-palette.png', fullPage: true });
    
    await page.keyboard.press('Escape');
    await page.waitForSelector('.command-palette-overlay', { state: 'hidden', timeout: 3000 });
  });

  test.skip('Can open Help Modal with Cmd+Shift+? - not implemented yet', async ({ page }) => {
    await page.keyboard.press('Meta+Shift+Slash');
    await page.waitForSelector('.help-modal-overlay', { timeout: 5000 });
    await expect(page.locator('.help-modal')).toBeVisible();
    await page.screenshot({ path: 'test-results/native/help-modal.png', fullPage: true });
    
    await page.keyboard.press('Escape');
    await page.waitForSelector('.help-modal-overlay', { state: 'hidden', timeout: 3000 });
  });
});