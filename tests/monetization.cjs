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
  const resourcesSource = fs.readFileSync(path.join(root, 'game/js/resources-app.mjs'), 'utf8');
  const platformSource = fs.readFileSync(path.join(root, 'game/js/platform.mjs'), 'utf8');
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
    "resumeMapEncounter?.(choice)",
    'eligibleAfterStep:choice.step + 1',
    'REWARDED_INTERSTITIAL_COOLDOWN_MS = 60_000',
    'STARVATION_RESCUE_SUPPLIES = 5',
    "data-ad-double-gold",
    "data-starvation-rescue",
    'adRewardClaims',
    "status:'completed', granted:false",
    "status:'completed', granted:true",
    'function resetRescueActions()',
    'resetRescueActions();'
  ]) assert(source.includes(token), `Monetization contract missing ${token}`);
  assert(source.includes("reward.append(root)"), 'Double-gold offer must be placed inside the visible combat reward row');
  assert(source.includes("button.textContent = '×2'"), 'Double-gold control must use the compact ×2 label');
  assert(source.includes('scheduleDoubleGoldOffer(kind, count, attempts = 16)'), 'Double-gold offer must retry until the aftermath screen is visible');
  assert(source.includes("source:'rewarded-double-gold', kind, count"), 'Completed double-gold must re-render its victory offer state');
  assert(source.includes("button.disabled = true;\n    button.setAttribute('aria-disabled', 'true');"), 'Completed double-gold must leave the ×2 button inactive');
  assert(resourcesSource.includes('goldReward) || 0))\n    + Math.max(0, Math.floor(Number(record?.adBonusGold)'), 'Victory reward display must include the granted double-gold bonus');
  assert(resourcesSource.includes("monetization?.renderDoubleGoldOffer?.('skirmish', run.skirmishCount)"), 'Skirmish reward re-render must restore the ×2 offer');
  assert(resourcesSource.includes("monetization?.renderDoubleGoldOffer?.(kind,run[`${kind}Count`])"), 'Battle reward re-render must restore the ×2 offer');
  assert(skirmishCss.includes('grid-template-columns:52px minmax(0,1fr) auto'), 'Skirmish reward row must reserve a right-side ×2 button slot');
  assert(battleCss.includes('grid-template-columns:52px minmax(0,1fr) auto'), 'Battle reward row must reserve a right-side ×2 button slot');

  assert(!source.includes('VKWebAppShowNativeAds') && !source.includes('VKWebAppCheckNativeAds'), 'Gameplay monetization must not call VK Bridge directly');
  assert(platformSource.includes('const VK_AD_SHOW_TIMEOUT_MS = 180_000;'), 'Rewarded ads must have enough time to finish before the Bridge request expires');
  assert(platformSource.includes("sendVKRequest('VKWebAppShowNativeAds'") && platformSource.includes('timeoutMs:VK_AD_SHOW_TIMEOUT_MS'), 'Native ad show must use the dedicated long timeout');
  assert(starvationSource.includes('starvationVictimPreviousStatus: victim.status'), 'Starvation must preserve the victim status so rewarded rescue can restore it exactly');
  assert(foundation.includes("import('./content/monetization.mjs?v=20261111-polish-v1')"), 'Foundation must load the current monetization owner');
  assert(foundation.indexOf("import('./content/monetization.mjs?v=20261111-polish-v1')") < foundation.indexOf("import('./battle-route.mjs?v=20261111-polish-v1')"), 'Ad gate must register before route owners');
  assert(foundation.includes('bindStarvationRescue'), 'Starvation rescue must bind only after the Starvation owner exists');

  // Regression: a rewarded rescue must restore the casualty, pay exactly
  // one trip, then start the Kingdom Skirmish through beginEncounter().
  const persistence=await import(pathToFileURL(path.join(root,'game/js/run-persistence.mjs')).href);
  const core=await import(pathToFileURL(path.join(root,'game/js/kingdom-map-core.mjs')).href);
  const initial=persistence.createRun({id:'ad-rescue-kingdom',now:1000});
  const map=core.createKingdomMap(initial,500);
  const route=core.randomEncounter(initial,{x:1,y:0},500,
    {type:'skirmish',biome:'plains',landmark:null,raceTag:null,paths:{}});
  const entry=core.enterCell(map,{x:1,y:0},route);
  assert(entry.ok);
  const companion=initial.roster.find(c=>!c.isRunKing);
  const starving={...initial,supplies:0,kingdomMap:entry.map,
    roster:initial.roster.map(c=>c.id===companion.id?{...c,status:'dead'}:c),
    activeTravelChoice:{...route,supplyCostAtSelection:1,supplyPaid:0,
      starvationVictimId:companion.id,starvationVictimPreviousStatus:'healthy',
      starvationAcknowledged:false}};
  const rescueId=monetization.rescueReceiptId(starving.id,route.id);
  const rescued=monetization.applyStarvationRescue(starving,rescueId);
  assert.equal(rescued.supplies,4,'5 rewarded supplies pay the single already selected -1 trip');
  assert.equal(rescued.roster.find(c=>c.id===companion.id).status,'healthy');
  assert.equal(rescued.activeTravelChoice.starvationVictimId,undefined);
  assert.deepStrictEqual(monetization.applyStarvationRescue(rescued,rescueId),rescued,
    'same rewarded receipt cannot credit or resurrect twice');
  let entered=0;
  globalThis.RPChessTravelChoice={resumeMapEncounter(choice){
    entered++;assert.equal(choice.id,route.id);
    const begun=core.beginEncounter(rescued.kingdomMap,choice.kingdomCell);
    assert(begun.ok&&begun.map.cells[choice.kingdomCell].status==='in_progress',
      'rewarded Skirmish must advance the persisted map before launching combat');
    assert(!core.beginEncounter(begun.map,choice.kingdomCell).ok,
      'already started Skirmish cannot be started again');
    return true;
  }};
  assert(monetization.dispatchRescuedEncounter(rescued));
  assert.equal(entered,1,'rewarded rescue must invoke canonical encounter gate exactly once');
  delete globalThis.RPChessTravelChoice;

  // A mobile VK host can expose ShowNativeAds but omit CheckNativeAds and
  // SetSupportedHandlers. The rewarded tap must still reach the host directly.
  const bus = new EventTarget();
  globalThis.addEventListener = bus.addEventListener.bind(bus);
  globalThis.removeEventListener = bus.removeEventListener.bind(bus);
  globalThis.location.search = '?vk_app_id=54754579';
  const adsModule = await import(pathToFileURL(path.join(root, 'game/js/platform.mjs')).href);
  const calls = [];
  let adSuccess = true;
  globalThis.AndroidBridge = {
    VKWebAppShowNativeAds(serialized) {
      const params = JSON.parse(serialized);
      calls.push({ method:'VKWebAppShowNativeAds', format:params.ad_format });
      const response = new Event('VKWebAppEvent');
      response.detail = { type:'VKWebAppShowNativeAdsResult', data:{ request_id:params.request_id, result:adSuccess } };
      queueMicrotask(() => bus.dispatchEvent(response));
    }
  };
  assert.equal((await adsModule.ads.show('reward')).status,'completed','Mobile rewarded ad completion must be honored');
  adSuccess = false;
  assert.equal((await adsModule.ads.show('reward')).status,'error','No reward on a negative ad completion');
  assert.deepStrictEqual(calls,[
    {method:'VKWebAppShowNativeAds',format:'reward'},
    {method:'VKWebAppShowNativeAds',format:'reward'}
  ],'Rewarded ads must not wait for unsupported mobile capability/availability probes');
  delete globalThis.AndroidBridge;
  globalThis.location.search = '';
  assert.equal((await adsModule.ads.show('reward')).status,'unavailable','Standalone web never grants VK rewards');
  console.log('VK monetization cadence, cooldown, receipts, and direct mobile rewarded Bridge dispatch: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
