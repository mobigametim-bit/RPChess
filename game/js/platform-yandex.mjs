// The build flag is injected only by build:yandex. URL/referrer heuristics cannot
// accidentally turn a VK or standalone build into a Yandex build.
const isYandexLaunch = () => globalThis.RPChessBuild?.platform === 'yandex';
const YANDEX_SAVE_KEY = 'rpchess_v1';
const YANDEX_DATA_BUDGET = 195000;
let sdk = null;
let initPromise = null;
let playerPromise = null;
let hostListener = null;
let sdkPaused = false;
let adPaused = false;
let requestedGameplay = false;
let playing = false;
let readySent = false;

function syncActivity() {
  hostListener?.(!sdkPaused && !adPaused);
  const next = requestedGameplay && !sdkPaused && !adPaused;
  if (!sdk || next === playing) return;
  playing = next;
  const gameplay = sdk.features?.GameplayAPI;
  if (next) gameplay?.start?.();
  else gameplay?.stop?.();
}

async function loadSDK() {
  if (globalThis.YaGames?.init) return;
  if (!globalThis.document?.head) throw new Error('Yandex SDK requires a browser');
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/sdk.js';
    script.async = true;
    const finish = (error) => {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) { script.remove(); reject(error); }
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error('Yandex SDK loading timed out')), 15000);
    script.onload = () => finish(globalThis.YaGames?.init ? null : new Error('Yandex SDK is unavailable'));
    script.onerror = () => finish(new Error('Yandex SDK loading failed'));
    document.head.append(script);
  });
}

async function init() {
  if (!isYandexLaunch()) return false;
  if (sdk) return sdk;
  if (!initPromise) initPromise = (async () => {
    await loadSDK();
    const initialized = await globalThis.YaGames.init();
    if (!initialized) throw new Error('Yandex SDK initialization failed');
    sdk = initialized;
    sdk.on?.('game_api_pause', () => { sdkPaused = true; syncActivity(); });
    sdk.on?.('game_api_resume', () => { sdkPaused = false; syncActivity(); });
    try { await sdk.adv?.hideBannerAdv?.(); } catch {}
    syncActivity();
    return sdk;
  })().catch(error => { initPromise = null; throw error; });
  return initPromise;
}

async function player() {
  if (!playerPromise) playerPromise = (async () => (await init()).getPlayer())()
    .catch(error => { playerPromise = null; throw error; });
  return playerPromise;
}

async function encodeEnvelope(envelope) {
  const json = JSON.stringify(envelope);
  let stored = envelope;
  if (typeof globalThis.CompressionStream === 'function') {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const compressed = { format:'gzip-base64-v1', data:btoa(binary) };
    if (JSON.stringify(compressed).length < json.length) stored = compressed;
  }
  const size = new TextEncoder().encode(JSON.stringify({ [YANDEX_SAVE_KEY]:stored })).byteLength;
  if (size > YANDEX_DATA_BUDGET) throw new Error(`Yandex cloud save exceeds ${YANDEX_DATA_BUDGET} bytes`);
  return stored;
}

async function decodeEnvelope(stored) {
  if (stored?.format !== 'gzip-base64-v1') return stored;
  if (typeof stored.data !== 'string' || typeof globalThis.DecompressionStream !== 'function') {
    throw new Error('Yandex cloud save compression is unsupported');
  }
  const binary = atob(stored.data);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

const cloud = Object.freeze({
  get available() { return isYandexLaunch(); },
  async supported() { return Boolean(await player()); },
  async readEnvelope() {
    const data = await (await player()).getData([YANDEX_SAVE_KEY]);
    if (!data || typeof data !== 'object') throw new Error('Invalid Yandex cloud response');
    return decodeEnvelope(data[YANDEX_SAVE_KEY] ?? null);
  },
  async writeEnvelope(envelope) {
    // Compress and verify the budget before writing. A failed write must retain
    // the complete local save and the last readable cloud snapshot.
    const stored = await encodeEnvelope(envelope);
    await (await player()).setData({ [YANDEX_SAVE_KEY]:stored }, true);
    return true;
  }
});

const ads = Object.freeze({
  async supported(format) {
    const initialized = await init();
    return typeof (format === 'reward' ? initialized.adv?.showRewardedVideo
      : format === 'interstitial' ? initialized.adv?.showFullscreenAdv : null) === 'function';
  },
  async check(format) { return this.supported(format); },
  async show(format) {
    if (!await this.supported(format)) return Object.freeze({ status:'unavailable', format });
    if (adPaused) return Object.freeze({ status:'unavailable', format });
    return new Promise(resolve => {
      let rewarded = false;
      let settled = false;
      const finish = (status, error) => {
        if (settled) return;
        settled = true;
        adPaused = false;
        syncActivity();
        resolve(Object.freeze({ status:format === 'reward' && rewarded ? 'completed' : status, format, ...(error ? { error } : {}) }));
      };
      const callbacks = {
        onOpen() { adPaused = true; syncActivity(); },
        onRewarded() { if (!settled) rewarded = true; },
        onClose(wasShown) { finish(format === 'reward' ? 'closed' : wasShown ? 'completed' : 'unavailable'); },
        onError(error) { finish('error', error); },
        onOffline() { finish('unavailable'); }
      };
      adPaused = true;
      syncActivity();
      try {
        if (format === 'reward') sdk.adv.showRewardedVideo({ callbacks });
        else sdk.adv.showFullscreenAdv({ callbacks });
      } catch (error) { finish('error', error); }
    });
  }
});

const yandex = Object.freeze({
  init, cloud, ads,
  get language() { return sdk?.environment?.i18n?.lang === 'ru' ? 'ru' : 'en'; },
  get gameLink() {
    const id = String(sdk?.environment?.app?.id || '');
    return /^\d+$/.test(id) ? `https://yandex.ru/games/app/${id}` : 'https://yandex.ru/games/';
  },
  onHostActive(listener) { hostListener = listener; syncActivity(); },
  gameplay(active) { requestedGameplay = Boolean(active); syncActivity(); },
  ready() {
    if (readySent || !sdk) return;
    sdk.features?.LoadingAPI?.ready?.();
    readySent = true;
  }
});

export { isYandexLaunch, yandex, YANDEX_SAVE_KEY, YANDEX_DATA_BUDGET };
