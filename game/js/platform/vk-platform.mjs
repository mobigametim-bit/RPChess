const DEFAULT_INIT_TIMEOUT_MS = 4000;
const DEFAULT_METHOD_TIMEOUT_MS = 2500;

function unsupportedService(name) {
  return Object.freeze({
    name,
    supported: false,
    async available() {
      return false;
    }
  });
}

function currentBridge() {
  const bridge = globalThis.vkBridge;
  return bridge && typeof bridge.send === 'function' ? bridge : null;
}

function positiveTimeout(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeError(error) {
  if (!error) return null;
  return Object.freeze({
    name: String(error.name || 'Error'),
    message: String(error.message || error),
    code: error.code ? String(error.code) : null
  });
}

function withTimeout(value, timeoutMs, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${timeoutMs} ms`);
      error.code = 'RPCHESS_PLATFORM_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve(value), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function supportsMethod(method, { timeoutMs = DEFAULT_METHOD_TIMEOUT_MS } = {}) {
  const bridge = currentBridge();
  if (!bridge) return false;
  if (method === 'VKWebAppInit') return true;
  try {
    if (typeof bridge.supportsAsync === 'function') {
      return Boolean(await withTimeout(
        bridge.supportsAsync(method),
        positiveTimeout(timeoutMs, DEFAULT_METHOD_TIMEOUT_MS),
        `VK Bridge supportsAsync(${method})`
      ));
    }
    if (typeof bridge.supports === 'function') return Boolean(bridge.supports(method));
  } catch {
    return false;
  }
  return false;
}

async function sendOptional(method, params = {}, {
  timeoutMs = DEFAULT_METHOD_TIMEOUT_MS,
  requireSupport = true
} = {}) {
  const bridge = currentBridge();
  if (!bridge) {
    return Object.freeze({ ok: false, supported: false, reason: 'bridge-unavailable', data: null, error: null });
  }

  if (requireSupport && method !== 'VKWebAppInit') {
    const supported = await supportsMethod(method, { timeoutMs });
    if (!supported) {
      return Object.freeze({ ok: false, supported: false, reason: 'unsupported', data: null, error: null });
    }
  }

  try {
    const data = await withTimeout(
      bridge.send(method, params),
      positiveTimeout(timeoutMs, DEFAULT_METHOD_TIMEOUT_MS),
      `VK Bridge ${method}`
    );
    return Object.freeze({ ok: true, supported: true, reason: null, data: data ?? null, error: null });
  } catch (error) {
    return Object.freeze({
      ok: false,
      supported: true,
      reason: error?.code === 'RPCHESS_PLATFORM_TIMEOUT' ? 'timeout' : 'bridge-error',
      data: null,
      error: normalizeError(error)
    });
  }
}

const capabilities = Object.freeze({
  bridge: true,
  storage: false,
  ads: false,
  payments: false,
  analytics: false,
  social: false,
  lifecycle: false
});

const vkPlatform = Object.freeze({
  kind: 'vk',
  label: 'VK Games',
  capabilities,
  storage: unsupportedService('storage'),
  ads: unsupportedService('ads'),
  payments: unsupportedService('payments'),
  analytics: unsupportedService('analytics'),
  social: unsupportedService('social'),
  lifecycle: unsupportedService('lifecycle'),
  supportsMethod,
  sendOptional,
  async init(config = {}) {
    const appIdValue = Number(config.appId ?? config.app_id ?? 0);
    const appId = Number.isFinite(appIdValue) && appIdValue > 0 ? appIdValue : null;
    const timeoutMs = positiveTimeout(config.bridgeInitTimeoutMs, DEFAULT_INIT_TIMEOUT_MS);
    const result = await sendOptional('VKWebAppInit', {}, { timeoutMs, requireSupport: false });
    return Object.freeze({
      ok: result.ok,
      kind: 'vk',
      integration: 'vk-bridge',
      appId,
      bridgeReady: result.ok,
      reason: result.reason,
      error: result.error
    });
  }
});

export {
  DEFAULT_INIT_TIMEOUT_MS,
  DEFAULT_METHOD_TIMEOUT_MS,
  currentBridge,
  supportsMethod,
  sendOptional
};

export default vkPlatform;
