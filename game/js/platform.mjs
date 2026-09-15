const VK_CONNECT_VERSION = '2.15.12';
const VK_REQUEST_TIMEOUT_MS = 7000;
const VK_AD_FORMATS = new Set(['reward', 'interstitial']);

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
  return params.has('vk_app_id')
    || /(^|\.)vk\.(com|ru)$/i.test(referrerHost())
    || Boolean(globalThis.AndroidBridge?.VKWebAppInit)
    || Boolean(globalThis.webkit?.messageHandlers?.VKWebAppInit?.postMessage)
    || Boolean(globalThis.ReactNativeWebView?.postMessage);
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

const localStorageAdapter = Object.freeze({
  sync() { return safeLocalStorage(); },
  getItem(key) { return safeLocalStorage()?.getItem(key) ?? null; },
  setItem(key, value) { safeLocalStorage()?.setItem(key, String(value)); },
  removeItem(key) { safeLocalStorage()?.removeItem(key); }
});

const cloudStorageAdapter = Object.freeze({
  get available() { return isVKLaunch(); },
  async supported() { return supportsVKMethod('VKWebAppStorageGet'); },
  async getItem(key) {
    if (!isVKLaunch()) return null;
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
    if (!isVKLaunch()) return false;
    try {
      const data = await sendVKRequest('VKWebAppStorageSet', { key:String(key), value:String(value) });
      return data?.result !== false;
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

const storage = Object.freeze({
  local:localStorageAdapter,
  cloud:cloudStorageAdapter,
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

const ads = Object.freeze({
  async supported(format) {
    return Boolean(normalizeAdFormat(format))
      && await supportsVKMethod('VKWebAppCheckNativeAds')
      && await supportsVKMethod('VKWebAppShowNativeAds');
  },
  async check(format) {
    const normalized = normalizeAdFormat(format);
    if (!normalized || !await this.supported(normalized)) return false;
    try {
      const response = await sendVKRequest('VKWebAppCheckNativeAds', { ad_format:normalized });
      return response?.result === true;
    } catch {
      return false;
    }
  },
  async show(format) {
    const normalized = normalizeAdFormat(format);
    if (!normalized || !await this.supported(normalized)) return Object.freeze({ status:'unavailable', format:normalized || String(format || '') });
    if (!await this.check(normalized)) return Object.freeze({ status:'unavailable', format:normalized });
    try {
      const response = await sendVKRequest('VKWebAppShowNativeAds', { ad_format:normalized });
      return Object.freeze({ status:response?.result === true ? 'completed' : 'error', format:normalized });
    } catch (error) {
      return Object.freeze({ status:adErrorStatus(error), format:normalized, error });
    }
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
  async wallPost({ message = '', attachments = '' } = {}) {
    if (!isVKLaunch()) return Object.freeze({ status:'unavailable' });
    try {
      const response = await sendVKRequest('VKWebAppShowWallPostBox', { message:String(message), attachments:String(attachments) });
      return Object.freeze({ status:'completed', postId:response?.post_id ?? null });
    } catch (error) {
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
  isVK:isVKLaunch
});

const bridge = Object.freeze({
  request:sendVKRequest,
  dispatch:dispatchVK,
  supports:supportsVKMethod,
  supportedMethods:supportedVKMethods
});

const capabilities = Object.freeze({
  get cloudStorage() { return isVKLaunch(); },
  get ads() { return isVKLaunch(); },
  get sharing() { return isVKLaunch(); },
  get leaderboard() { return isVKLaunch(); },
  payments:false
});

const platform = Object.freeze({
  get kind() { return isVKLaunch() ? 'vk' : 'web'; },
  launch,
  bridge,
  storage,
  ads,
  social,
  identity,
  lifecycle,
  init() { return sendVKWebAppInit(); },
  capabilities
});

export {
  VK_CONNECT_VERSION,
  VK_REQUEST_TIMEOUT_MS,
  VK_AD_FORMATS,
  parseLaunchParams,
  isVKLaunch,
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
