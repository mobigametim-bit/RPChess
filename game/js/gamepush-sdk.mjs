// GamePush SDK trial integration. Public SDK credentials only; no admin/server secrets.
// VK production enabled on canonical Pages with valid-shaped launch params; explicit ?rpchess_gamepush=0 disables. Other platforms opt-in only.
// References: https://docs.gamepush.com/ru/docs/get-start/getting-started/
//             https://docs.gamepush.com/tutorials/game-with-own-backend/
const PROJECT_ID = 31247;
const PUBLIC_TOKEN = 'A1ICrqB9MTDpemB3MHjc2Y0nMPKx1MBs';
const SOURCES = Object.freeze([
  'https://gs.eponesh.com/sdk/game-score.js',
  'https://s3.gamepush.com/files/gs/sdk/game-score.js',
  'https://s3-eu.gamepush.com/sdk/game-score.js',
  'https://gamepush.com/sdk/game-score.js'
]);
const SCRIPT_TIMEOUT_MS = 6500;
const PLAYER_TIMEOUT_MS = 10000;

let sdk = null;
let state = 'disabled';
let pending = null;
let gameStartRequested = false;
let gameStartSent = false;
let lastAuthDiagnostic = null;
let failureCode = '';

function isEnabled() {
  try {
    const query=new URLSearchParams(globalThis.location?.search||'');
    if(query.get('rpchess_gamepush')==='0')return false; // Safe VK Bridge rollback.
    if(query.get('rpchess_gamepush')==='1')return true; // Isolated preview opt-in.
    // Turn on GamePush ONLY for real signed VK launches from the canonical
    // Pages release; other sites/standalone Web and Yandex remain unchanged.
    // SDK failure leaves the existing native VK ad path available.
    return globalThis.location?.hostname==='mobigametim-bit.github.io'
      && /^\/RPChess(?:\/|$)/.test(globalThis.location?.pathname||'')
      && query.get('vk_app_id')==='54754579'
      && /^[1-9]\d*$/.test(query.get('vk_user_id')||'')
      && Boolean(query.get('sign'));
  } catch {
    return false;
  }
}

// Public, non-sensitive diagnostic of launch context. Never expose IDs,
 // signed VK query values, SDK auth tokens, or the protected VK app key.
function safeDiagnostics() {
  const query=new URLSearchParams(globalThis.location?.search || '');
  const host=(() => {
    try { return new URL(globalThis.document?.referrer || '').hostname; }
    catch { return ''; }
  })();
  return Object.freeze({
    sdkStatus:state,
    platform:typeof sdk?.platform?.type==='string' ? sdk.platform.type : '',
    inIframe:globalThis.parent !== globalThis,
    vkAppParamPresent:query.has('vk_app_id'),
    vkUserParamPresent:query.has('vk_user_id'),
    vkSignParamPresent:query.has('sign'),
    vkReferrer:/^(.+\.)?vk\.(com|ru)$/i.test(host),
    playerIdPresent:Boolean(sdk?.player?.id),
    playerLoggedIn:sdk?.player?.isLoggedIn === true
  });
}

function notify(reason) {
  try {
    globalThis.dispatchEvent?.(new CustomEvent('rpchess:gamepush-status', {
      detail: { status:state, enabled:isEnabled(), reason }
    }));
  } catch {}
}

function withDeadline(promise, duration, name) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(name + ' timed out')), duration);
    })
  ]).finally(() => clearTimeout(timer));
}

function injectSdk(source) {
  return new Promise((resolve, reject) => {
    if (!globalThis.document?.head?.appendChild) {
      reject(new Error('Browser document is unavailable'));
      return;
    }
    const previousCallback = globalThis.onGPInit;
    const script = globalThis.document.createElement('script');
    let settled = false;
    const finish = (error, instance) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onerror = null;
      if (globalThis.onGPInit === callback) {
        if (typeof previousCallback === 'function') globalThis.onGPInit = previousCallback;
        else delete globalThis.onGPInit;
      }
      if (error) {
        script.remove?.();
        reject(error);
      } else resolve(instance);
    };
    const callback = instance => finish(null, instance);
    const timer = setTimeout(() => finish(new Error('GamePush script timeout')), SCRIPT_TIMEOUT_MS);
    script.async = true;
    script.src = source + '?projectId=' + PROJECT_ID
      + '&publicToken=' + encodeURIComponent(PUBLIC_TOKEN)
      + '&callback=onGPInit';
    script.onerror = () => finish(new Error('GamePush script unavailable'));
    globalThis.onGPInit = callback;
    globalThis.document.head.appendChild(script);
  });
}

async function boot() {
  state = 'loading';
  lastAuthDiagnostic = null;
  failureCode = '';
  notify('start');
  try {
    let instance = null;
    for (const source of SOURCES) {
      try {
        instance = await injectSdk(source);
        if (instance) break;
      } catch {
        // Try the next official CDN mirror. A failed CDN must not prevent play.
      }
    }
    if (!instance?.player?.ready) throw new Error('GamePush SDK or player readiness missing');
    sdk = instance;
    await withDeadline(instance.player.ready, PLAYER_TIMEOUT_MS, 'GamePush player');
    // A VK iframe may load the SDK while its platform-auth request has failed.
    // Do not mark that as ready or run migration/gameStart without a VK player.
    const d=safeDiagnostics();
    const launchedFromVK=d.vkAppParamPresent || d.vkUserParamPresent || d.vkReferrer
      || /^VK/i.test(d.platform);
    if (launchedFromVK && (!/^VK/i.test(d.platform)
      || !d.playerIdPresent || !d.playerLoggedIn)) {
      throw new Error('VK GamePush player identity is unavailable');
    }
    sdk.on?.('pause', () => {
      globalThis.dispatchEvent?.(new Event('rpchess:gamepush-pause'));
    });
    sdk.on?.('resume', () => {
      globalThis.dispatchEvent?.(new Event('rpchess:gamepush-resume'));
    });
    state = 'ready';
    notify('player-ready');
    if (gameStartRequested) void markReady();
    return true;
  } catch (error) {
    lastAuthDiagnostic = safeDiagnostics();
    // SDK diagnostics can contain signed parameters or raw player data.
    // Only publish a coarse error class in logs, events and support reports.
    const reason=String(error?.message||'');
    failureCode=/user.?id not found|invalid player data|identity is unavailable/i.test(reason)
      ? 'vk-player-auth'
      : /timeout|timed out/i.test(reason) ? 'timeout'
      : /script|missing/i.test(reason) ? 'sdk-load' : 'sdk-unavailable';
    sdk = null;
    state = 'unavailable';
    notify(failureCode);
    console.warn('[RPChess] GamePush trial unavailable; local game remains playable');
    return false;
  }
}

async function init() {
  if (!isEnabled()) return false;
  if (!pending) pending = boot();
  return pending;
}

async function markReady() {
  gameStartRequested = true;
  if (state !== 'ready' || !sdk || gameStartSent) return false;
  if (typeof sdk.gameStart !== 'function') return false;
  gameStartSent = true;
  try {
    await sdk.gameStart();
    return true;
  } catch {
    return false;
  }
}

function adsAvailable(format) {
  if (state !== 'ready') return false;
  if (format === 'reward') return sdk?.ads?.isRewardedAvailable === true;
  if (format === 'interstitial') return sdk?.ads?.isFullscreenAvailable === true;
  return false;
}

async function showAd(format) {
  if (!adsAvailable(format)) return Object.freeze({ status:'unavailable', format });
  try {
    if (format === 'reward') {
      // Only a strict true may unlock a rewarded action. No rewards on close/error.
      const success = await sdk.ads.showRewardedVideo();
      return Object.freeze({ status:success === true ? 'completed' : 'closed', format });
    }
    await sdk.ads.showFullscreen();
    return Object.freeze({ status:'completed', format });
  } catch (error) {
    return Object.freeze({ status:'error', format });
  }
}

const gamepushSdk = Object.freeze({
  get enabled() { return isEnabled(); },
  get ready() { return state === 'ready'; },
  get status() { return state; },
  get failureCode() { return failureCode; },
  get projectId() { return PROJECT_ID; },
  // SDK-supplied platform/player values are UI hints, not server authority.
  // Never trust playerId without verifying player.authToken on Cloudflare.
  get platformType() { return state === 'ready' ? String(sdk?.platform?.type || '') : ''; },
  get playerId() { return state === 'ready' ? sdk?.player?.id ?? null : null; },
  get loggedIn() { return state === 'ready' && sdk?.player?.isLoggedIn === true; },
  get diagnostics() {
    const live=safeDiagnostics();
    return Object.freeze({ ...live, failureCode,
      platform:live.platform || lastAuthDiagnostic?.platform || '',
      playerIdPresent:live.playerIdPresent || lastAuthDiagnostic?.playerIdPresent || false,
      playerLoggedIn:live.playerLoggedIn || lastAuthDiagnostic?.playerLoggedIn || false
    });
  },
  init,
  markReady,
  ads:Object.freeze({
    supported:adsAvailable,
    check:adsAvailable,
    show:showAd
  })
});

export { gamepushSdk };
