const playwright = require('playwright');
const serverlessChromium = require('@sparticuz/chromium');

const originalLaunch = playwright.chromium.launch.bind(playwright.chromium);
playwright.chromium.launch = async (options = {}) => {
  const executablePath = await serverlessChromium.executablePath();
  const args = [...new Set([...(serverlessChromium.args || []), ...((options && options.args) || [])])];
  return originalLaunch({ ...options, executablePath, args, headless: true });
};
