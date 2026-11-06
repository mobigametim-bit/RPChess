import { gamepushSdk } from './gamepush-sdk.mjs';

const VK_CONNECT_VERSION = '2.15.12';
const VK_REQUEST_TIMEOUT_MS = 7000;
const VK_AD_SHOW_TIMEOUT_MS = 180_000;
const VK_AD_FORMATS = new Set(['reward', 'interstitial']);
// GamePush cutover v2 is a fresh local namespace. Legacy player data remains
// untouched and is not silently migrated from this origin or VK cloud.
const GAMEPUSH_SAVE_PREFIX = 'rpchess.gamepush.v2.';
const PROFILE_SAVE_PREFIX = 'rpchess.profile.v1.';
function rpchessProfileEnabled() {
  try {
    const query=new URLSearchParams(globalThis.location?.search||'');
    // Emergency rollback keeps the previous VK / local storage untouched.
    if(query.get('rpchess_profile')==='0')return false;
    if(query.get('rpchess_profile')==='1')return true;
    // The accepted Cloudflare preview stays active for installed PWAs.
    if(globalThis.location?.hostname==='rpchess-profile-game-preview.mobigametim.workers.dev')return true;
    // The official VK mobile WebView can use this exact app's VK Hosting
    // instead of the GitHub Pages iframe. Keep RPChess ID enabled on both
    // approved hosts; the server still requires a *signed* VK launch.
    const host=globalThis.location?.hostname||'';
    if(/^(?:(?:stage|prod)-)?app54754579(?:-[a-z0-9]+)?\.pages\.vk-apps\.(?:ru|com)$/i.test(host))return true;
    // Other portals remain isolated from this storage/identity rollout.
    return host==='mobigametim-bit.github.io'
      && /^\/RPChess(?:\/|$)/.test(globalThis.location?.pathname||'');
  } catch { return false; }
}

let activeProfileStore='';
function setProfileStorageIdentity(kind,id) {
  if(!['web','vk'].includes(kind)||!/^[0-9a-f-]{36}$/i.test(String(id)))return false;
  activeProfileStore='rpchess.profile.v1.'+kind+'.'+id+'.';
  try { globalThis.localStorage?.setItem('rpchess.profile.cached-id.'+kind,id); }catch{}
  return true;
}
function profileStoragePrefix() {
  if(activeProfileStore)return activeProfileStore;
  const kind=isVKLaunch()?'vk':'web';
  // Never expose the previous VK user's cached progress before verification.
  if(kind==='vk')return 'rpchess.profile.v1.vk.pending.';
  let id='';
  try { id=globalThis.localStorage?.getItem('rpchess.profile.cached-id.'+kind)||''; }catch{}
  return /^[0-9a-f-]{36}$/i.test(id)
    ? 'rpchess.profile.v1.'+kind+'.'+id+'.'
    : 'rpchess.profile.v1.'+kind+'.pending.';
}
function safeLocalStorage() {
  try { return globalThis.localStorage || null; }
  catch { return null; }
}

function parseLaunchParams(search = globalThis.location?.search || '') {
  try { return new URLSearchParams(search); }
  catch { return new URLSearchParams(); }
}

function referrerHost(referrer = globalThis.document?.referrer || '') {
  if (!referrer) return '';
  try { return new URL(referrer).hostname; }
  catch { return ''; }
}

function isVKLaunch() {
  const params = parseLaunchParams();
  return verifiedVKHost || params.has('vk_app_id')
    || /(^|\.)vk\.(com|ru)$/i.test(referrerHost())
    || Boolean(globalThis.AndroidBridge?.VKWebAppInit)
    || Boolean(globalThis.webkit?.messageHandlers?.VKWebAppInit?.postMessage)
    || Boolean(globalThis.ReactNativeWebView?.postMessage);
}

let verifiedVKHost = false;

// Desktop VK can embed the game without launch parameters or a referrer. Verify
// the parent bridge before enabling VK-only storage; a direct Pages tab stays local.
async function discoverVKHost({ timeoutMs = 1800 } = {}) {
  if (isVKLaunch()) return true;
  if (!globalThis.parent || globalThis.parent === globalThis || !globalThis.addEventListener) return false;
  const requestId = nextRequestId();
  return new Promise(resolve => {
    const finish = verified => {
      clearTimeout(timer);
      globalThis.removeEventListener?.('message', onMessage);
      if (verified) verifiedVKHost = true;
      resolve(verified);
    };
    const onMessage = event => {
      if (event.source !== globalThis.parent) return;
      let trusted = false;
      try { trusted = /(^|\.)vk\.(com|ru)$/i.test(new URL(event.origin).hostname); }
      catch { return; }
      if (!trusted) return;
      const payload = bridgePayload(event);
      if (payload?.data?.request_id !== requestId) return;
      if (payload.type !== 'SetSupportedHandlersResult' && payload.type !== 'VKWebAppStorageGetResult') return;
      finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    globalThis.addEventListener('message', onMessage);
    try {
      for (const [handler, params] of [
        ['SetSupportedHandlers', { request_id:requestId }],
        ['VKWebAppStorageGet', { request_id:requestId, keys:['rpchess_v1_cloud_manifest'] }]
      ]) globalThis.parent.postMessage({ handler, params, type:'vk-connect', connectVersion:VK_CONNECT_VERSION }, '*');
    } catch { finish(false); }
  });
}

let webFrameId;
let requestCounter = 0;
let bridgeListenerInstalled = false;
let supportedHandlers = null;
let supportedHandlersPromise = null;
const pendingRequests = new Map();

function nextRequestId() {
  requestCounter += 1;
  let entropy = '';
  try { entropy = globalThis.crypto?.randomUUID?.() || ''; }
  catch {}
  return `rpchess_${Date.now()}_${requestCounter}_${entropy || Math.random().toString(36).slice(2, 10)}`;
}

function bridgePayload(event) {
  let payload = event?.detail ?? event?.data ?? null;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); }
    catch { return null; }
  }
  return payload && typeof payload === 'object' ? payload : null;
}

function settleBridgeResponse(event) {
  if (event?.type === 'message' && globalThis.parent && globalThis.parent !== globalThis && event.source && event.source !== globalThis.parent) return;
  const payload = bridgePayload(event);
  if (!payload) return;
  if (payload.type === 'VKWebAppSettings' && (payload.frameId || payload.data?.frameId)) webFrameId = payload.frameId || payload.data.frameId;
  const data = payload.data;
  if (payload.type === 'SetSupportedHandlers' && Array.isArray(data?.supportedHandlers)) supportedHandlers = new Set(data.supportedHandlers);
  if (!data || typeof data !== 'object' || !data.request_id) return;
  const pending = pendingRequests.get(String(data.request_id));
  if (!pending) return;
  pendingRequests.delete(String(data.request_id));
  clearTimeout(pending.timer);
  const { request_id:requestId, ...response } = data;
  if (response.error_type) pending.reject(Object.assign(new Error(response.error_type), { data:response, requestId, method:pending.method }));
  else pending.resolve(response);
}

function installBridgeListener() {
  if (bridgeListenerInstalled) return;
  bridgeListenerInstalled = true;
  globalThis.addEventListener?.('message', settleBridgeResponse);
  globalThis.addEventListener?.('VKWebAppEvent', settleBridgeResponse);
  globalThis.document?.addEventListener?.('VKWebAppEvent', settleBridgeResponse);
}

function dispatchVK(method, params = {}) {
  try {
    if (globalThis.AndroidBridge?.[method]) {
      globalThis.AndroidBridge[method](JSON.stringify(params));
      return true;
    }
    if (globalThis.webkit?.messageHandlers?.[method]?.postMessage) {
      globalThis.webkit.messageHandlers[method].postMessage(params);
      return true;
    }
    if (globalThis.ReactNativeWebView?.postMessage) {
      globalThis.ReactNativeWebView.postMessage(JSON.stringify({ handler:method, params }));
      return true;
    }
    if (globalThis.parent && globalThis.parent !== globalThis) {
      globalThis.parent.postMessage({
        handler:method,
        params,
        type:'vk-connect',
        ...(webFrameId ? { webFrameId } : {}),
        connectVersion:VK_CONNECT_VERSION
      }, '*');
      return true;
    }
  } catch (error) {
    console.error(`[RPChess] VK bridge dispatch failed: ${method}`, error);
  }
  return false;
}

function sendVKRequest(method, params = {}, { timeoutMs = VK_REQUEST_TIMEOUT_MS } = {}) {
  if (!isVKLaunch()) return Promise.reject(new Error('VK bridge is unavailable outside a VK launch'));
  installBridgeListener();
  const requestId = nextRequestId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(Object.assign(new Error(`VK bridge request timed out: ${method}`), { method, reason:'timeout' }));
    }, Math.max(250, Number(timeoutMs) || VK_REQUEST_TIMEOUT_MS));
    pendingRequests.set(requestId, { resolve, reject, timer, method });
    if (!dispatchVK(method, { ...params, request_id:requestId })) {
      clearTimeout(timer);
      pendingRequests.delete(requestId);
      reject(Object.assign(new Error(`VK bridge dispatch unavailable: ${method}`), { method, reason:'unavailable' }));
    }
  });
}

function sendVKWebAppInit() {
  if (globalThis.__RPCHESS_VK_INIT_SENT) return true;
  if (!isVKLaunch()) return false;
  try {
    if (!dispatchVK('VKWebAppInit', {})) return false;
    globalThis.__RPCHESS_VK_INIT_SENT = true;
    globalThis.RPChessVKInitialized = true;
    return true;
  } catch (error) {
    console.error('[RPChess] VK host initialization failed', error);
    return false;
  }
}

function nativeMethodSupported(method) {
  if (globalThis.AndroidBridge) return typeof globalThis.AndroidBridge?.[method] === 'function';
  if (globalThis.webkit?.messageHandlers) return typeof globalThis.webkit?.messageHandlers?.[method]?.postMessage === 'function';
  return null;
}

async function supportedVKMethods({ refresh = false } = {}) {
  if (!isVKLaunch()) return new Set();
  if (!refresh && supportedHandlers) return new Set(supportedHandlers);
  if (!refresh && supportedHandlersPromise) return new Set(await supportedHandlersPromise);
  supportedHandlersPromise = (async () => {
    try {
      const response = await sendVKRequest('SetSupportedHandlers', {}, { timeoutMs:3000 });
      supportedHandlers = new Set(Array.isArray(response?.supportedHandlers) ? response.supportedHandlers : ['VKWebAppInit']);
    } catch {
      supportedHandlers = new Set(['VKWebAppInit']);
    } finally {
      supportedHandlersPromise = null;
    }
    return supportedHandlers;
  })();
  return new Set(await supportedHandlersPromise);
}

async function supportsVKMethod(method) {
  if (!isVKLaunch()) return false;
  const nativeSupport = nativeMethodSupported(method);
  if (nativeSupport !== null) return nativeSupport;
  const methods = await supportedVKMethods();
  return methods.has(method);
}

// Wrap the synchronous Web Storage contract (including length/key enumeration)
// instead of deleting the previous user's data. Browser reloads still persist v2.
function scopedGamePushStore(prefixOverride = GAMEPUSH_SAVE_PREFIX) {
  const raw = safeLocalStorage();
  if (!raw) return null;
  const prefix = prefixOverride;
  return {
    get length() {
      let count = 0;
      for (let index = 0; index < raw.length; index++)
        if (raw.key(index)?.startsWith(prefix)) count++;
      return count;
    },
    key(index) {
      if (!Number.isInteger(index) || index < 0) return null;
      let offset = 0;
      for (let i = 0; i < raw.length; i++) {
        const key = raw.key(i);
        if (!key?.startsWith(prefix)) continue;
        if (offset++ === index) return key.slice(prefix.length);
      }
      return null;
    },
    getItem(key) { return raw.getItem(prefix + String(key)); },
    setItem(key, value) { raw.setItem(prefix + String(key), String(value)); },
    removeItem(key) { raw.removeItem(prefix + String(key)); },
    clear() {
      // A scoped clear must never erase the old player's progress.
      for (let i = raw.length - 1; i >= 0; i--) {
        const key = raw.key(i);
        if (key?.startsWith(prefix)) raw.removeItem(key);
      }
    }
  };
}
function gameStore() {
  if (rpchessProfileEnabled()) return scopedGamePushStore(profileStoragePrefix());
  return gamepushSdk.enabled ? scopedGamePushStore() : safeLocalStorage();
}
const localStorageAdapter = Object.freeze({
  sync() { return gameStore(); },
  getItem(key) { return gameStore()?.getItem(key) ?? null; },
  setItem(key, value) { gameStore()?.setItem(key, String(value)); },
  removeItem(key) { gameStore()?.removeItem(key); }
});

const legacyCloudDisabled = () => gamepushSdk.enabled || rpchessProfileEnabled();
const cloudStorageAdapter = Object.freeze({
  get available() { return isVKLaunch() && !legacyCloudDisabled(); },
  async supported() { return !legacyCloudDisabled() && supportsVKMethod('VKWebAppStorageGet'); },
  async getItemStrict(key) {
    if (legacyCloudDisabled()) return null;
    const data = await sendVKRequest('VKWebAppStorageGet', { keys:[String(key)] });
    if (!Array.isArray(data?.keys)) throw new Error('Invalid VK cloud storage response');
    const entry = data.keys.find((item) => item?.key === String(key));
    return typeof entry?.value === 'string' && entry.value.length ? entry.value : null;
  },
  async getItemsStrict(keys) {
    if (legacyCloudDisabled()) return {};
    const normalized = [...new Set((keys || []).map((key) => String(key)).filter(Boolean))];
    if (!normalized.length) return {};
    const data = await sendVKRequest('VKWebAppStorageGet', { keys:normalized });
    if (!Array.isArray(data?.keys)) throw new Error('Invalid VK cloud storage response');
    return Object.fromEntries(data.keys.filter((entry) => entry && typeof entry.key === 'string').map((entry) => [entry.key, typeof entry.value === 'string' ? entry.value : '']));
  },
  async getItem(key) {
    if (legacyCloudDisabled() || !isVKLaunch()) return null;
    try {
      const data = await sendVKRequest('VKWebAppStorageGet', { keys:[String(key)] });
      const entry = Array.isArray(data?.keys) ? data.keys.find((item) => item?.key === String(key)) : null;
      return typeof entry?.value === 'string' && entry.value.length ? entry.value : null;
    } catch (error) {
      console.warn('[RPChess] VK cloud storage read failed', error);
      return null;
    }
  },
  async getItems(keys) {
    if (legacyCloudDisabled()) return {};
    const normalized = [...new Set((keys || []).map((key) => String(key)).filter(Boolean))];
    if (!isVKLaunch() || !normalized.length) return {};
    try {
      const data = await sendVKRequest('VKWebAppStorageGet', { keys:normalized });
      return Array.isArray(data?.keys)
        ? Object.fromEntries(data.keys.filter((entry) => entry && typeof entry.key === 'string').map((entry) => [entry.key, typeof entry.value === 'string' ? entry.value : '']))
        : {};
    } catch (error) {
      console.warn('[RPChess] VK cloud storage multi-read failed', error);
      return {};
    }
  },
  async setItem(key, value) {
    if (legacyCloudDisabled() || !isVKLaunch()) return false;
    try {
      const data = await sendVKRequest('VKWebAppStorageSet', { key:String(key), value:String(value) });
      return data?.result === true;
    } catch (error) {
      console.warn('[RPChess] VK cloud storage write failed', error);
      return false;
    }
  },
  async setItems(entries) {
    if (!entries || typeof entries !== 'object') return false;
    for (const [key, value] of Object.entries(entries)) {
      if (!await this.setItem(key, value)) return false;
    }
    return true;
  },
  async removeItem(key) {
    return this.setItem(key, '');
  }
});

// Only the migration module may access these narrowly scoped VK keys while
// GamePush replaces the old VK save adapter. VK Bridge verifies the signed
// session; a plain Web visitor cannot read or write another player's cloud.
const OLD_CLOUD_KEY = /^rpchess_v1_cloud_(?:manifest|[ab]_\d{1,3})$/;
const GP_META_CLOUD_KEY = /^rpchess_gp_v2_(?:manifest|[ab]_\d{1,3})$/;
function gpVkCloudAvailable() {
  return gamepushSdk.enabled && gamepushSdk.ready && gamepushSdk.loggedIn
    && /VK/i.test(gamepushSdk.platformType) && isVKLaunch();
}
function makeScopedVKCloud(keyPattern, writeEnabled, canAccess=gpVkCloudAvailable) {
  const assertKeys = keys => {
    if (!canAccess() || keys.some(key=>!keyPattern.test(String(key))))
      throw new Error('VK migration cloud scope unavailable');
  };
  const reader = {
    get available() { return canAccess(); },
    async getItemStrict(key) {
      assertKeys([key]);
      const data=await sendVKRequest('VKWebAppStorageGet',{keys:[String(key)]});
      if (!Array.isArray(data?.keys)) throw new Error('Malformed VK cloud read');
      const item=data.keys.find(entry=>entry?.key===String(key));
      return typeof item?.value==='string' && item.value.length ? item.value:null;
    },
    async getItemsStrict(keys) {
      const normalized=[...new Set((keys||[]).map(key=>String(key)))];
      assertKeys(normalized);
      if (!normalized.length) return {};
      const data=await sendVKRequest('VKWebAppStorageGet',{keys:normalized});
      if (!Array.isArray(data?.keys)) throw new Error('Malformed VK cloud read');
      return Object.fromEntries(data.keys.filter(entry=>typeof entry?.key==='string')
        .map(entry=>[entry.key,typeof entry.value==='string'?entry.value:'']));
    }
  };
  if (writeEnabled) reader.setItem=async (key,value) => {
    assertKeys([key]);
    const response=await sendVKRequest('VKWebAppStorageSet',{key:String(key),value:String(value)});
    return response?.result===true;
  };
  return Object.freeze(reader);
}
const legacyVKMetaReader = makeScopedVKCloud(OLD_CLOUD_KEY,false);
// Profile migration requires only the verified RPChess server session. It does
// NOT depend on GamePush working inside VK (the current SDK may reject userId).
const legacyVKProfileReader=makeScopedVKCloud(OLD_CLOUD_KEY,false,
  ()=>rpchessProfileEnabled()&&isVKLaunch());
// A previous GP preview may have its completed-statistics backup in its
// separate VK cloud namespace. Read-only recovery is permitted without GP SDK.
const previousGamePushMetaReader=makeScopedVKCloud(GP_META_CLOUD_KEY,false,
  ()=>rpchessProfileEnabled()&&isVKLaunch());
// GamePush v2 is a read-only recovery source once RPChess ID/D1 owns saves.
// Even an accidentally invoked old GP sync must not write its cloud namespace.
const gamepushVKMetaStore = makeScopedVKCloud(GP_META_CLOUD_KEY,true,
  ()=>!rpchessProfileEnabled()&&gpVkCloudAvailable());

const storage = Object.freeze({
  local:localStorageAdapter,
  cloud:cloudStorageAdapter,
  legacyVKMetaReader,
  legacyVKProfileReader,
  previousGamePushMetaReader,
  gamepushVKMetaStore,
  sync() { return localStorageAdapter.sync(); },
  getItem(key) { return localStorageAdapter.getItem(key); },
  setItem(key, value) { localStorageAdapter.setItem(key, value); },
  removeItem(key) { localStorageAdapter.removeItem(key); }
});

function normalizeAdFormat(format) {
  return VK_AD_FORMATS.has(format) ? format : null;
}

function adErrorStatus(error) {
  const text = `${error?.message || ''} ${error?.data?.error_reason || ''}`.toLowerCase();
  return /close|cancel|denied|user/.test(text) ? 'closed' : 'error';
}

// In VK the already-monetized native Bridge is a fallback ONLY after an
// opt-in GamePush SDK failed to initialize. Never mix both backends while the
// SDK is loading, ready, or has simply exhausted its ad inventory.
function confirmedVKAdHost() {
  if (!isVKLaunch()) return false;
  const native=Boolean(globalThis.AndroidBridge?.VKWebAppShowNativeAds
    || globalThis.webkit?.messageHandlers?.VKWebAppShowNativeAds?.postMessage
    || globalThis.ReactNativeWebView?.postMessage);
  return native || verifiedVKHost
    || /(^|\.)vk\.(com|ru)$/i.test(referrerHost());
}
function advertisingBackend() {
  if (!gamepushSdk.enabled) return 'vk-bridge';
  if (gamepushSdk.ready)
    return /^(?:VK(?:_|$)|YANDEX)/i.test(gamepushSdk.platformType) ? 'gamepush' : 'none';
  if (gamepushSdk.status === 'unavailable' && confirmedVKAdHost()) return 'vk-bridge';
  return 'none';
}
let adShowing=false;
async function nativeVKShow(normalized) {
  // The call must originate directly from a click. Checking ad availability
  // first consumes the user gesture on some VK mobile WebViews.
  try {
    const response=await sendVKRequest('VKWebAppShowNativeAds',
      { ad_format:normalized },{ timeoutMs:VK_AD_SHOW_TIMEOUT_MS });
    return Object.freeze({ status:response?.result === true ? 'completed' : 'error', format:normalized });
  } catch(error) {
    return Object.freeze({ status:adErrorStatus(error), format:normalized });
  }
}
const ads = Object.freeze({
  get backend() { return advertisingBackend(); },
  get diagnostics() { return Object.freeze({
    backend:advertisingBackend(),
    sdkStatus:gamepushSdk.status,
    vkHostConfirmed:confirmedVKAdHost(),
    rewardedAvailable:gamepushSdk.ready ? gamepushSdk.ads.check('reward') : null,
    fullscreenAvailable:gamepushSdk.ready ? gamepushSdk.ads.check('interstitial') : null
  }); },
  async supported(format) {
    const normalized=normalizeAdFormat(format);
    if(!normalized)return false;
    const backend=advertisingBackend();
    if(backend==='none')return false;
    if(backend==='gamepush')return gamepushSdk.ads.supported(normalized);
    // On native VK mobile, the CheckNativeAds capability can be missing even
    // when ShowNativeAds is fully functional. In fallback we never require it.
    if(gamepushSdk.enabled)return confirmedVKAdHost();
    return await supportsVKMethod('VKWebAppCheckNativeAds')
      && await supportsVKMethod('VKWebAppShowNativeAds');
  },
  async check(format) {
    const normalized=normalizeAdFormat(format);
    if(!normalized)return false;
    const backend=advertisingBackend();
    if(backend==='gamepush')return gamepushSdk.ads.check(normalized);
    if(backend!=='vk-bridge' || gamepushSdk.enabled && !confirmedVKAdHost())return false;
    // VK mobile may have ShowNativeAds without the optional CheckNativeAds
    // method; offer rescue if its native Show handler is explicitly available.
    if(gamepushSdk.enabled && nativeMethodSupported('VKWebAppCheckNativeAds')===false)
      return nativeMethodSupported('VKWebAppShowNativeAds')===true;
    if(!await this.supported(normalized))return false;
    try {
      const response=await sendVKRequest('VKWebAppCheckNativeAds', { ad_format:normalized });
      return response?.result===true;
    } catch { return false; }
  },
  async show(format) {
    const normalized=normalizeAdFormat(format);
    const backend=advertisingBackend();
    if(!normalized || adShowing || backend==='none'
      || backend==='vk-bridge' && (!isVKLaunch() || gamepushSdk.enabled && !confirmedVKAdHost()))
      return Object.freeze({ status:'unavailable', format:normalized || String(format || '') });
    adShowing=true;
    try {
      // Exactly one backend is chosen BEFORE dispatch, so a close/error never
      // retries the same tap using another provider or grants a duplicate.
      if(backend==='gamepush')return await gamepushSdk.ads.show(normalized);
      return await nativeVKShow(normalized);
    } finally { adShowing=false; }
  }
});

const social = Object.freeze({
  async shareLink(link) {
    if (!link || !await supportsVKMethod('VKWebAppShare')) return Object.freeze({ status:'unavailable' });
    try {
      const response = await sendVKRequest('VKWebAppShare', { link:String(link) });
      return Object.freeze({ status:'completed', response });
    } catch (error) {
      return Object.freeze({ status:adErrorStatus(error) === 'closed' ? 'closed' : 'error', error });
    }
  },
  async showStory({ blob = '', link = '' } = {}) {
    if (!isVKLaunch()) return Object.freeze({ status:'unavailable' });
    // GamePush only owns ads/player lifecycle; VK stories still use VK Bridge.
    // Initialize that host lazily on the user's sharing gesture.
    sendVKWebAppInit();
    if (!/^data:image\/(?:png|jpeg);base64,[a-z\d+/=]+$/i.test(blob)) return Object.freeze({ status:'error', reason:'invalid-image' });
    const payload = {
      background_type:'image',
      blob,
      locked:true,
      ...(link ? { attachment:{ type:'url', text:'play', url:String(link) } } : {})
    };
    try {
      // VK mobile/web may keep the story editor open without responding on close.
      // Do not claim the story was published based on this API's response alone.
      const response = await sendVKRequest('VKWebAppShowStoryBox', payload, { timeoutMs:120_000 });
      return Object.freeze({ status:'completed', response });
    } catch (error) {
      if (error?.reason === 'timeout') return Object.freeze({ status:'no-response', error });
      return Object.freeze({ status:adErrorStatus(error) === 'closed' ? 'closed' : 'error', error });
    }
  },
  async copyText(text) {
    if (!await supportsVKMethod('VKWebAppCopyText')) return false;
    try { return (await sendVKRequest('VKWebAppCopyText', { text:String(text) }))?.result === true; }
    catch { return false; }
  }
});

const identity = Object.freeze({
  async getUserInfo() {
    if (!await supportsVKMethod('VKWebAppGetUserInfo')) return null;
    try { return await sendVKRequest('VKWebAppGetUserInfo'); }
    catch { return null; }
  }
});

function createLifecycle() {
  const listeners = new Set();
  let installed = false;
  let pageActive = true;
  const documentActive = () => !(globalThis.document?.hidden || globalThis.document?.visibilityState === 'hidden');
  const active = () => pageActive && documentActive();
  const emit = (reason, forcedActive = null) => {
    if (forcedActive !== null) pageActive = Boolean(forcedActive);
    const state = Object.freeze({ active:active(), reason });
    for (const listener of listeners) {
      try { listener(state); }
      catch (error) { console.error('[RPChess] lifecycle listener failed', error); }
    }
  };
  const install = () => {
    if (installed || !globalThis.document?.addEventListener) return;
    installed = true;
    globalThis.document.addEventListener('visibilitychange', () => emit('visibilitychange'));
    globalThis.addEventListener?.('pagehide', () => emit('pagehide', false));
    globalThis.addEventListener?.('pageshow', () => emit('pageshow', true));
    globalThis.addEventListener?.('rpchess:gamepush-pause', () => emit('gamepush-pause', false));
    globalThis.addEventListener?.('rpchess:gamepush-resume', () => emit('gamepush-resume', true));
  };
  return Object.freeze({
    isActive:active,
    subscribe(listener, { immediate = true } = {}) {
      if (typeof listener !== 'function') return () => {};
      install();
      listeners.add(listener);
      if (immediate) listener(Object.freeze({ active:active(), reason:'subscribe' }));
      return () => listeners.delete(listener);
    }
  });
}

const lifecycle = createLifecycle();
const launch = Object.freeze({
  params() { return Object.fromEntries(parseLaunchParams().entries()); },
  isVK:isVKLaunch,
  isYandex() { return gamepushSdk.enabled && /YANDEX/i.test(gamepushSdk.platformType); }
});

const bridge = Object.freeze({
  request:sendVKRequest,
  dispatch:dispatchVK,
  supports:supportsVKMethod,
  supportedMethods:supportedVKMethods
});

const capabilities = Object.freeze({
  // Avoid promising native VK functionality when GamePush has replaced Bridge.
  get cloudStorage() { return isVKLaunch() && !legacyCloudDisabled(); },
  get ads() { return gamepushSdk.enabled ? advertisingBackend()!=='none' : isVKLaunch(); },
  get sharing() { return isVKLaunch(); }, // VK Story/Share remain via Bridge.
  get leaderboard() { return rpchessProfileEnabled() || isVKLaunch() && !gamepushSdk.enabled; },
  payments:false
});

const platform = Object.freeze({
  get kind() {
    if (gamepushSdk.enabled && gamepushSdk.ready) {
      if (/YANDEX/i.test(gamepushSdk.platformType)) return 'yandex';
      if (/^VK(?:_|$)|VK_GAMES/i.test(gamepushSdk.platformType)) return 'vk';
    }
    return isVKLaunch() ? 'vk' : 'web';
  },
  launch,
  bridge,
  storage,
  ads,
  social,
  identity,
  lifecycle,
  gamepush:gamepushSdk,
  get profileEnabled() { return rpchessProfileEnabled(); },
  setProfileStorageIdentity,
  async init() {
    // GamePush opt-in owns platform initialization on Web, VK and Yandex test
    // builds. No parallel VK Bridge init, ad call or legacy VK cloud restore.
    // Do not block the menu if a test origin has not been configured yet.
    if (gamepushSdk.enabled) {
      // Native VK is not initialized concurrently with a healthy GamePush SDK.
      // If SDK player auth fails (e.g. VK userId not found), restore the
      // existing ad mechanism without changing RPChess ID/D1 persistence.
      void gamepushSdk.init().then(ready=>{
        if(!ready && confirmedVKAdHost())sendVKWebAppInit();
      }).catch(()=>{});
      return true;
    }
    return await discoverVKHost() ? sendVKWebAppInit() : false;
  },
  capabilities
});

export {
  VK_CONNECT_VERSION,
  VK_REQUEST_TIMEOUT_MS,
  VK_AD_FORMATS,
  parseLaunchParams,
  isVKLaunch,
  discoverVKHost,
  dispatchVK,
  sendVKRequest,
  sendVKWebAppInit,
  supportedVKMethods,
  supportsVKMethod,
  storage,
  cloudStorageAdapter,
  ads,
  social,
  identity,
  lifecycle,
  platform
};
