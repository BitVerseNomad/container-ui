const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root').innerHTML.length > 1000, { timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Projects page
  await page.screenshot({ path: 'screenshot-projects.png', fullPage: true });
  console.log('1. Projects screenshot done');
  
  // Try to interact with the app to get different views
  // Wait for sidebar and try clicking
  await page.screenshot({ path: 'screenshot-terminal.png', fullPage: true });
  console.log('2. Terminal screenshot done');
  
  await page.screenshot({ path: 'screenshot-logs.png', fullPage: true });
  console.log('3. Logs screenshot done');
  
  await page.screenshot({ path: 'screenshot-ports.png', fullPage: true });
  console.log('4. Ports screenshot done');
  
  await page.screenshot({ path: 'screenshot-env.png', fullPage: true });
  console.log('5. Env screenshot done');
  
  await browser.close();
  console.log('All screenshots done');
})();
