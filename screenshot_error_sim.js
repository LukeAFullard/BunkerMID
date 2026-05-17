const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Intercept Pyodide network requests and force a failure to simulate a hang/error
  await page.route('https://cdn.jsdelivr.net/pyodide/**', route => {
    route.abort('failed');
  });

  await page.goto('http://localhost:5173/BunkerMID/');

  await page.waitForTimeout(5000);

  const dropText = await page.evaluate(() => document.getElementById('drop-text').innerText);
  console.log('Drop text:', dropText);

  await browser.close();
})();
