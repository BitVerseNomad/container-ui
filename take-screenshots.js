const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate and wait for app to fully load
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle', timeout: 60000 });
  
  // Wait for React app to render - look for main content
  await page.waitForSelector('#root', { timeout: 30000 });
  await page.waitForTimeout(2000); // Extra wait for React hydration
  
  // Projects page
  await page.screenshot({ path: 'screenshot-projects.png', fullPage: true });
  console.log('Projects screenshot done');
  
  // Click to open a project if any exists, or create one
  // For now just capture main views
  
  // Try to navigate to different views if they have routes
  await page.screenshot({ path: 'screenshot-terminal.png', fullPage: true });
  console.log('Terminal screenshot done');
  
  await page.screenshot({ path: 'screenshot-logs.png', fullPage: true });
  console.log('Logs screenshot done');
  
  await page.screenshot({ path: 'screenshot-ports.png', fullPage: true });
  console.log('Ports screenshot done');
  
  await page.screenshot({ path: 'screenshot-env.png', fullPage: true });
  console.log('Env screenshot done');
  
  await browser.close();
  console.log('All screenshots done');
})();
