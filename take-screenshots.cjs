const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  // Navigate
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle', timeout: 60000 });
  
  // Wait longer for React to hydrate
  await page.waitForTimeout(5000);
  
  // Check what's in #root
  const rootContent = await page.$eval('#root', el => el.innerHTML);
  console.log('Root content length:', rootContent.length);
  console.log('Root content preview:', rootContent.substring(0, 200));
  
  // Take screenshot anyway
  await page.screenshot({ path: 'screenshot-projects.png', fullPage: true });
  console.log('Screenshot done');
  
  await browser.close();
})();
