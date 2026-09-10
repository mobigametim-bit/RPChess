const assert = require('assert');
const { chromium } = require('playwright');

const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const testAudioUnlockRetry = process.env.RPCHESS_AUDIO_UNLOCK_RETRY === '1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));

  if (testAudioUnlockRetry) {
    await page.addInitScript(() => {
      const probe = globalThis.__RPChessAudioUnlockProbe = { playCalls: 0 };
      class ProbeAudio {
        constructor(src = '') {
          this.src = src;
          this.preload = '';
          this.loop = false;
          this.volume = 1;
          this.muted = false;
          this.paused = true;
          this.listeners = new Map();
        }
        addEventListener(name, listener) {
          const listeners = this.listeners.get(name) || [];
          listeners.push(listener);
          this.listeners.set(name, listeners);
        }
        load() {}
        pause() { this.paused = true; }
        play() {
          probe.playCalls += 1;
          if (probe.playCalls === 1) {
            this.paused = true;
            return Promise.reject(new DOMException('Autoplay blocked for deterministic mobile regression', 'NotAllowedError'));
          }
          this.paused = false;
          return Promise.resolve();
        }
      }
      globalThis.Audio = ProbeAudio;
    });
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    const state = await page.evaluate(async () => {
      const platform = await globalThis.RPChessPlatformReady;
      return {
        config: globalThis.RPChessPlatformConfig,
        kind: platform?.kind,
        bridgeReady: platform?.initResult?.bridgeReady,
        initOk: platform?.initResult?.ok,
        reason: platform?.initResult?.reason,
        mock: Boolean(globalThis.vkBridge?.__rpchessMock),
        mockMode: globalThis.vkBridge?.__rpchessMockMode || globalThis.RPChessPlatformConfig?.bridgeMockMode || null,
        calls: Array.isArray(globalThis.vkBridge?.calls) ? globalThis.vkBridge.calls : []
      };
    });
    assert.strictEqual(state.config.kind, 'vk');
    assert.strictEqual(state.config.appId, 54754579);
    assert.strictEqual(state.kind, 'vk');
    assert.strictEqual(state.mock, true, 'VK browser smoke must run against deterministic Bridge mock');
    assert.strictEqual(state.calls[0]?.method, 'VKWebAppInit', 'VKWebAppInit must be first Bridge call');
    assert.strictEqual(await page.locator('[data-reboot-foundation]:not([hidden])').count(), 1, 'common main menu must remain usable after VK init attempt');

    if (state.mockMode === 'init-failure') {
      assert.strictEqual(state.initOk, false, 'deterministic Bridge failure must be reported without crashing gameplay');
      assert.strictEqual(state.bridgeReady, false);
      assert.strictEqual(state.reason, 'bridge-error');
      console.log('VK build Bridge failure fallback + common menu browser smoke: PASS');
    } else {
      assert.strictEqual(state.initOk, true);
      assert.strictEqual(state.bridgeReady, true);
      assert.strictEqual(state.mockMode, 'success');
      console.log('VK build Bridge bootstrap + common menu browser smoke: PASS');
    }

    if (testAudioUnlockRetry) {
      await page.mouse.click(12, 12);
      await page.waitForFunction(() => globalThis.RPChessRebootAudio?.musicPlaybackUnlocked === true);
      const audioState = await page.evaluate(() => ({
        playCalls: globalThis.__RPChessAudioUnlockProbe?.playCalls || 0,
        unlocked: globalThis.RPChessRebootAudio?.musicPlaybackUnlocked,
        lastError: globalThis.RPChessRebootAudio?.lastMusicPlayError || null,
        paused: globalThis.RPChessRebootAudio?.music?.paused
      }));
      assert(audioState.playCalls >= 2, `blocked first mobile play() must be retried from the same/later gesture; calls=${audioState.playCalls}`);
      assert.strictEqual(audioState.unlocked, true);
      assert.strictEqual(audioState.lastError, null);
      assert.strictEqual(audioState.paused, false);
      console.log('VK mobile music user-gesture retry regression: PASS');
    }

    assert.deepStrictEqual(errors, [], `VK browser errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
