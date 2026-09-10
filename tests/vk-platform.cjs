const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const MODULE_URL = `${pathToFileURL(path.join(ROOT, 'game/js/platform/vk-platform.mjs')).href}?test=${Date.now()}`;

(async () => {
  const originalBridge = globalThis.vkBridge;
  try {
    const calls = [];
    globalThis.vkBridge = {
      async send(method, params = {}) {
        calls.push({ method, params });
        if (method === 'VKWebAppInit') return { result: true };
        return { ok: true };
      },
      async supportsAsync(method) {
        return method === 'VKWebAppGetUserInfo';
      }
    };

    const module = await import(MODULE_URL);
    const adapter = module.default;
    assert.strictEqual(adapter.kind, 'vk');
    assert.strictEqual(adapter.capabilities.bridge, true);
    for (const service of ['storage', 'ads', 'payments', 'analytics', 'social', 'lifecycle']) {
      assert.strictEqual(adapter[service].supported, false, `${service} must remain disabled until its dedicated integration stage`);
      assert.strictEqual(await adapter[service].available(), false);
    }

    const init = await adapter.init({ appId: 54754579, bridgeInitTimeoutMs: 100 });
    assert.strictEqual(init.ok, true);
    assert.strictEqual(init.bridgeReady, true);
    assert.strictEqual(init.appId, 54754579);
    assert.strictEqual(calls[0].method, 'VKWebAppInit', 'VKWebAppInit must be the first Bridge call');

    assert.strictEqual(await adapter.supportsMethod('VKWebAppGetUserInfo'), true);
    assert.strictEqual(await adapter.supportsMethod('VKWebAppShowNativeAds'), false);
    const callsBeforeUnsupported = calls.length;
    const unsupported = await adapter.sendOptional('VKWebAppShowNativeAds');
    assert.strictEqual(unsupported.ok, false);
    assert.strictEqual(unsupported.supported, false);
    assert.strictEqual(unsupported.reason, 'unsupported');
    assert.strictEqual(calls.length, callsBeforeUnsupported, 'unsupported optional method must not be sent');

    globalThis.vkBridge = {
      send() {
        return new Promise(() => {});
      },
      async supportsAsync() {
        return true;
      }
    };
    const timedOut = await adapter.init({ appId: 54754579, bridgeInitTimeoutMs: 10 });
    assert.strictEqual(timedOut.ok, false);
    assert.strictEqual(timedOut.bridgeReady, false);
    assert.strictEqual(timedOut.reason, 'timeout');

    delete globalThis.vkBridge;
    const unavailable = await adapter.init({ appId: 54754579, bridgeInitTimeoutMs: 10 });
    assert.strictEqual(unavailable.ok, false);
    assert.strictEqual(unavailable.bridgeReady, false);
    assert.strictEqual(unavailable.reason, 'bridge-unavailable');

    console.log('VK PlatformAdapter init/support/fallback contract: PASS');
  } finally {
    if (originalBridge === undefined) delete globalThis.vkBridge;
    else globalThis.vkBridge = originalBridge;
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
