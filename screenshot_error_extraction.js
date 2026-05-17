const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  await page.goto('http://localhost:4173/BunkerMID/');

  try {
    await page.waitForFunction(() => {
      return document.getElementById('drop-text').innerText === 'Drag and drop a file here, or click to select';
    }, { timeout: 15000 });
    console.log("Ready state reached");
  } catch (e) {
    console.log("Wait for ready timed out.");
    const dropText = await page.evaluate(() => document.getElementById('drop-text').innerText);
    console.log('Final drop text:', dropText);
  }

  await browser.close();
})();
