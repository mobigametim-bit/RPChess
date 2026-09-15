const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
}

(async () => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.location = { search:'' };
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'game/js/content/monetization.mjs'), 'utf8');
  const skirmishCss = fs.readFileSync(path.join(root, 'game/css/player-rating.css'), 'utf8');
  const battleCss = fs.readFileSync(path.join(root, 'game/css/playtest-fixes.css'), 'utf8');
  const starvationSource = fs.readFileSync(path.join(root, 'game/js/starvation-core.mjs'), 'utf8');
  const foundation = fs.readFileSync(path.join(root, 'game/js/reboot-foundation.mjs'), 'utf8');
  const monetization = await import(`${pathToFileURL(path.join(root, 'game/js/content/monetization.mjs')).href}?test=${Date.now()}`);

  for (let step = 1; step <= 20; step += 1) {
    assert.strictEqual(monetization.dueInterstitial(step), step % 5 === 0, `step ${step} interstitial cadence mismatch`);
  }
  assert.strictEqual(monetization.dueInterstitial(0), false);
  assert.strictEqual(monetization.dueInterstitial(-5), false);
  assert.strictEqual(monetization.interstitialReceiptId('run-a', 5), 'interstitial:run-a:5');
  assert.strictEqual(monetization.rescueReceiptId('run-a', 'route-1'), 'rescue:run-a:route-1');
  assert.strictEqual(monetization.doubleGoldReceiptId('run-a', 'battle', 2, 48), 'double-gold:run-a:battle:2:48');

  let state = monetization.writeMonetizationState({
    schemaVersion:1,
    lastRewardedAt:1000,
    pendingInterstitial:{ runId:'run-a', step:5, eligibleAfterStep:6, createdAt:1000 },
    receipts:{
      'double-gold:run-a:battle:2:48':{ id:'double-gold:run-a:battle:2:48', type:'double-gold', status:'completed', granted:true, updatedAt:1100 }
    }
  });
  assert.strictEqual(state.pendingInterstitial.step, 5);
  assert.strictEqual(state.receipts['double-gold:run-a:battle:2:48'].granted, true);
  state = monetization.readMonetizationState();
  assert.strictEqual(state.lastRewardedAt, 1000);
  assert.strictEqual(monetization.rewardedCooldownRemaining(state, 30_000), 31_000, 'rewarded cooldown must be 60 seconds');
  assert.strictEqual(monetization.rewardedCooldownRemaining(state, 61_000), 0);

  for (const token of [
    "platform.ads.show('interstitial')",
    "platform.ads.show('reward')",
    "platform.ads.check('reward')",
    'event.stopImmediatePropagation',
    "source:'travel-choice'",
    'eligibleAfterStep:choice.step + 1',
    'REWARDED_INTERSTITIAL_COOLDOWN_MS = 60_000',
    'STARVATION_RESCUE_SUPPLIES = 5',
    "data-ad-double-gold",
    "data-starvation-rescue",
    'adRewardClaims',
    "status:'completed', granted:false",
    "status:'completed', granted:true"
  ]) assert(source.includes(token), `Monetization contract missing ${token}`);
  assert(source.includes("reward.append(root)"), 'Double-gold offer must be placed inside the visible combat reward row');
  assert(source.includes("button.textContent = '×2'"), 'Double-gold control must use the compact ×2 label');
  assert(source.includes('scheduleDoubleGoldOffer(kind, count, attempts = 4)'), 'Double-gold offer must retry until the aftermath screen is visible');
  assert(skirmishCss.includes('grid-template-columns:52px minmax(0,1fr) auto'), 'Skirmish reward row must reserve a right-side ×2 button slot');
  assert(battleCss.includes('grid-template-columns:52px minmax(0,1fr) auto'), 'Battle reward row must reserve a right-side ×2 button slot');

  assert(!source.includes('VKWebAppShowNativeAds') && !source.includes('VKWebAppCheckNativeAds'), 'Gameplay monetization must not call VK Bridge directly');
  assert(starvationSource.includes('starvationVictimPreviousStatus: victim.status'), 'Starvation must preserve the victim status so rewarded rescue can restore it exactly');
  assert(foundation.includes("import('./content/monetization.mjs')"), 'Foundation must load the monetization owner');
  assert(foundation.indexOf("import('./content/monetization.mjs')") < foundation.indexOf("import('./battle-route.mjs')"), 'Ad gate must register before route owners');
  assert(foundation.includes('bindStarvationRescue'), 'Starvation rescue must bind only after the Starvation owner exists');

  console.log('VK monetization cadence, cooldown, receipt persistence, rewarded priority and platform-boundary contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
