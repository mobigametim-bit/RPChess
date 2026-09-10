const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    const state = await page.evaluate(async () => {
      const platform = await globalThis.RPChessPlatformReady;
      return {
        config: globalThis.RPChessPlatformConfig,
        kind: platform?.kind,
        bridgeReady: platform?.initResult?.bridgeReady,
        initOk: platform?.initResult?.ok,
        mock: Boolean(globalThis.vkBridge?.__rpchessMock),
        calls: Array.isArray(globalThis.vkBridge?.calls) ? globalThis.vkBridge.calls : []
      };
    });
    assert.strictEqual(state.config.kind, 'vk');
    assert.strictEqual(state.config.appId, 54754579);
    assert.strictEqual(state.kind, 'vk');
    assert.strictEqual(state.initOk, true);
    assert.strictEqual(state.bridgeReady, true);
    assert.strictEqual(state.mock, true, 'VK browser smoke must run against deterministic Bridge mock');
    assert.strictEqual(state.calls[0]?.method, 'VKWebAppInit', 'VKWebAppInit must be first Bridge call');
    assert.strictEqual(await page.locator('[data-reboot-foundation]:not([hidden])').count(), 1, 'common main menu must remain usable after VK init');
    assert.deepStrictEqual(errors, [], `VK browser errors:\n${errors.join('\n')}`);
    console.log('VK build Bridge bootstrap + common menu browser smoke: PASS');
  } finally {
    await page.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
