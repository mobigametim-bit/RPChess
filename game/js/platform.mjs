const VK_CONNECT_VERSION = '2.15.12';

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

function sendVKWebAppInit() {
  if (globalThis.__RPCHESS_VK_INIT_SENT) return true;
  if (!isVKLaunch()) return false;
  const params = {};
  try {
    if (globalThis.AndroidBridge?.VKWebAppInit) {
      globalThis.AndroidBridge.VKWebAppInit(JSON.stringify(params));
    } else if (globalThis.webkit?.messageHandlers?.VKWebAppInit?.postMessage) {
      globalThis.webkit.messageHandlers.VKWebAppInit.postMessage(params);
    } else if (globalThis.ReactNativeWebView?.postMessage) {
      globalThis.ReactNativeWebView.postMessage(JSON.stringify({ handler:'VKWebAppInit', params }));
    } else if (globalThis.parent && globalThis.parent !== globalThis) {
      globalThis.parent.postMessage({
        handler:'VKWebAppInit',
        params,
        type:'vk-connect',
        connectVersion:VK_CONNECT_VERSION
      }, '*');
    } else {
      return false;
    }
    globalThis.__RPCHESS_VK_INIT_SENT = true;
    globalThis.RPChessVKInitialized = true;
    return true;
  } catch (error) {
    console.error('[RPChess] VK host initialization failed', error);
    return false;
  }
}

const storage = Object.freeze({
  sync() { return safeLocalStorage(); },
  getItem(key) { return safeLocalStorage()?.getItem(key) ?? null; },
  setItem(key, value) { safeLocalStorage()?.setItem(key, String(value)); },
  removeItem(key) { safeLocalStorage()?.removeItem(key); }
});

function createLifecycle() {
  const listeners = new Set();
  let installed = false;
  const active = () => !(globalThis.document?.hidden || globalThis.document?.visibilityState === 'hidden');
  const emit = (reason) => {
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
    globalThis.addEventListener?.('pagehide', () => emit('pagehide'));
    globalThis.addEventListener?.('pageshow', () => emit('pageshow'));
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

const platform = Object.freeze({
  get kind() { return isVKLaunch() ? 'vk' : 'web'; },
  launch,
  storage,
  lifecycle,
  init() { return sendVKWebAppInit(); },
  capabilities:Object.freeze({
    cloudStorage:false,
    ads:false,
    payments:false
  })
});

export { VK_CONNECT_VERSION, parseLaunchParams, isVKLaunch, sendVKWebAppInit, storage, lifecycle, platform };
