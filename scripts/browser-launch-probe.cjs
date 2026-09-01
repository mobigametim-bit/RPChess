const { chromium } = require('playwright');
const serverlessChromium = require('@sparticuz/chromium');

(async () => {
  const executablePath = await serverlessChromium.executablePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: serverlessChromium.args || []
  });
  console.log(`Serverless Chromium launch PASS: ${await browser.version()}`);
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
