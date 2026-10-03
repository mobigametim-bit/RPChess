const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');

(async () => {
  globalThis.RPChessBuild = { platform:'yandex' };
  globalThis.location = { search:'?vk_app_id=54754579' };
  const events = new Map();
  const globalEvents = new EventTarget();
  globalThis.addEventListener = globalEvents.addEventListener.bind(globalEvents);
  globalThis.removeEventListener = globalEvents.removeEventListener.bind(globalEvents);
  globalThis.document = { referrer:'https://vk.com/', hidden:false, addEventListener() {} };
  let data = {};
  let writes = 0;
  let playerAttempts = 0;
  let initCalls = 0;
  let callbacks;
  const activity = [];
  globalThis.YaGames = { async init() {
    initCalls++;
    return {
      environment:{ i18n:{ lang:'en' }, app:{ id:'123456' } },
      on(name, listener) { events.set(name, listener); },
      features:{ LoadingAPI:{ ready() { activity.push('ready'); } }, GameplayAPI:{ start() { activity.push('start'); }, stop() { activity.push('stop'); } } },
      async getPlayer() {
        if (++playerAttempts === 1) throw new Error('Temporary Player failure');
        return { async getData() { return structuredClone(data); }, async setData(next, flush) { assert.equal(flush, true); writes++; data = structuredClone(next); } };
      },
      adv:{ async hideBannerAdv() { activity.push('hide'); },
        showRewardedVideo(input) { callbacks = input.callbacks; callbacks.onOpen(); },
        showFullscreenAdv(input) { callbacks = input.callbacks; callbacks.onOpen(); } }
    };
  } };
  const { platform } = await import('../game/js/platform.mjs');
  const { YANDEX_SAVE_KEY, YANDEX_DATA_BUDGET } = await import('../game/js/platform-yandex.mjs');
  assert.equal(platform.kind, 'yandex');
  assert.equal(platform.launch.isVK(), false);
  await Promise.all([platform.init(), platform.init()]);
  assert.equal(initCalls, 1);
  assert.equal(platform.language, 'en');
  assert.equal(platform.gameLink, 'https://yandex.ru/games/app/123456');
  const states = [];
  platform.lifecycle.subscribe(state => states.push(state.active));
  platform.gameplay(true);
  events.get('game_api_pause')();
  assert.equal(platform.lifecycle.isActive(), false);
  let resumed = false;
  const wait = platform.lifecycle.whenPlayable().then(() => { resumed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(resumed, false);
  events.get('game_api_resume')();
  await wait;
  assert.equal(resumed, true);
  platform.lifecycle.setGameplayActive(false);
  platform.gameplay(false);
  const starts = activity.filter(value => value === 'start').length;
  events.get('game_api_pause')(); events.get('game_api_resume')();
  assert.equal(activity.filter(value => value === 'start').length, starts, 'SDK resume must not start the main menu');
  for (const mode of ['rewarded','closed','error','late']) {
    callbacks = null;
    const result = platform.ads.show('reward');
    while (!callbacks) await new Promise(resolve => setImmediate(resolve));
    assert.equal(platform.lifecycle.isActive(), false);
    if (mode === 'rewarded') { callbacks.onRewarded(); callbacks.onRewarded(); callbacks.onClose(); callbacks.onError(new Error('duplicate')); }
    if (mode === 'closed') callbacks.onClose();
    if (mode === 'error') callbacks.onError(new Error('unavailable'));
    if (mode === 'late') { callbacks.onClose(); callbacks.onRewarded(); }
    assert.equal((await result).status, mode === 'rewarded' ? 'completed' : mode === 'error' ? 'error' : 'closed');
    assert.equal(platform.lifecycle.isActive(), true);
  }
  await assert.rejects(platform.storage.cloud.readEnvelope(), /Temporary Player/);
  assert.equal(await platform.storage.cloud.readEnvelope(), null);
  const envelope = { schemaVersion:1, revision:20, updatedAt:Date.now(), payload:{
    run:{ artifactInventory:{ 'vision.piercing':2, 'tactics.fork_master':3 } },
    ledger:Array.from({ length:5000 }, (_, index) => ({ id:index, text:'Артефакт, бой, событие и награда', gold:15 }))
  } };
  assert.ok(Buffer.byteLength(JSON.stringify(envelope)) > 200000);
  await platform.storage.cloud.writeEnvelope(envelope);
  assert.ok(Buffer.byteLength(JSON.stringify(data)) < YANDEX_DATA_BUDGET);
  assert.deepEqual(await platform.storage.cloud.readEnvelope(), envelope);
  const previous = structuredClone(data);
  await assert.rejects(platform.storage.cloud.writeEnvelope({ payload:{ random:randomBytes(230000).toString('base64') } }), /exceeds/);
  assert.deepEqual(data, previous);
  assert.equal(writes, 1);
  data = { [YANDEX_SAVE_KEY]:{ format:'gzip-base64-v1', data:'broken' } };
  await assert.rejects(platform.storage.cloud.readEnvelope());
  platform.ready(); platform.ready();
  assert.equal(activity.filter(value => value === 'ready').length, 1);
  assert.ok(activity.includes('hide'));
  console.log('PASS Yandex SDK lifecycle, ad receipts, retry, atomic lossless cloud transport and data budget');
})().catch(error => { console.error(error); process.exitCode = 1; });
