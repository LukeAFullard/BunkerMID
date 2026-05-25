const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

  await page.goto('http://localhost:8084/BunkerMID/');
  await page.waitForTimeout(10000); // 10 seconds to allow downloading AI extraction engine

  console.log("BODY:", await page.innerHTML('body'));
  await browser.close();
})();
