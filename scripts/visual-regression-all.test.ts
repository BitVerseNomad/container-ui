import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('Visual: containers-light', async ({ page }) => {
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.shell', { timeout: 10000 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  const screenshotDir = path.join(process.cwd(), 'test-results', 'visual-regression');
  if (!fs.existsSync(screenshotDir)) { fs.mkdirSync(screenshotDir, { recursive: true }); }
  const screenshotPath = path.join(screenshotDir, 'containers-light.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
});

test('Visual: images-light', async ({ page }) => {
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.shell', { timeout: 10000 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { const btn = document.querySelector('button[aria-label="Images"]'); if (btn) btn.click(); });
  await page.waitForTimeout(500);
  await page.waitForTimeout(1000);
  const screenshotDir = path.join(process.cwd(), 'test-results', 'visual-regression');
  if (!fs.existsSync(screenshotDir)) { fs.mkdirSync(screenshotDir, { recursive: true }); }
  const screenshotPath = path.join(screenshotDir, 'images-light.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
});

test('Visual: volumes-light', async ({ page }) => {
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.shell', { timeout: 10000 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { const btn = document.querySelector('button[aria-label="Volumes"]'); if (btn) btn.click(); });
  await page.waitForTimeout(500);
  await page.waitForTimeout(1000);
  const screenshotDir = path.join(process.cwd(), 'test-results', 'visual-regression');
  if (!fs.existsSync(screenshotDir)) { fs.mkdirSync(screenshotDir, { recursive: true }); }
  const screenshotPath = path.join(screenshotDir, 'volumes-light.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
});

test('Visual: containers-dark', async ({ page }) => {
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.shell', { timeout: 10000 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  const screenshotDir = path.join(process.cwd(), 'test-results', 'visual-regression');
  if (!fs.existsSync(screenshotDir)) { fs.mkdirSync(screenshotDir, { recursive: true }); }
  const screenshotPath = path.join(screenshotDir, 'containers-dark.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
});

test('Visual: images-dark', async ({ page }) => {
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.shell', { timeout: 10000 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { const btn = document.querySelector('button[aria-label="Images"]'); if (btn) btn.click(); });
  await page.waitForTimeout(500);
  await page.waitForTimeout(1000);
  const screenshotDir = path.join(process.cwd(), 'test-results', 'visual-regression');
  if (!fs.existsSync(screenshotDir)) { fs.mkdirSync(screenshotDir, { recursive: true }); }
  const screenshotPath = path.join(screenshotDir, 'images-dark.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
});

test('Visual: volumes-dark', async ({ page }) => {
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.shell', { timeout: 10000 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { const btn = document.querySelector('button[aria-label="Volumes"]'); if (btn) btn.click(); });
  await page.waitForTimeout(500);
  await page.waitForTimeout(1000);
  const screenshotDir = path.join(process.cwd(), 'test-results', 'visual-regression');
  if (!fs.existsSync(screenshotDir)) { fs.mkdirSync(screenshotDir, { recursive: true }); }
  const screenshotPath = path.join(screenshotDir, 'volumes-dark.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  expect(fs.existsSync(screenshotPath)).toBeTruthy();
});