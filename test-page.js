const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let foundError = false;
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
      foundError = true;
    }
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    foundError = true;
  });

  await page.goto('http://localhost:4173/BunkerMID/');
  await page.waitForTimeout(10000); // 10 seconds to allow downloading AI extraction engine

  const html = await page.innerHTML('body');
  if (html.includes('Drag and drop a file here')) {
    console.log("SUCCESS: Engine downloaded successfully.");
  } else {
    console.log("FAILURE: Engine did not download.");
  }
  await browser.close();
  if (foundError) process.exit(1);
})();
