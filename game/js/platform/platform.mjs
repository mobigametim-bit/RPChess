const PLATFORM_KINDS = Object.freeze({
  WEB: 'web',
  VK: 'vk'
});

const PLATFORM_SERVICES = Object.freeze([
  'storage',
  'ads',
  'payments',
  'analytics',
  'social',
  'lifecycle'
]);

function normalizePlatformKind(value) {
  return value === PLATFORM_KINDS.VK ? PLATFORM_KINDS.VK : PLATFORM_KINDS.WEB;
}

function readPlatformConfig(explicitConfig = null) {
  const source = explicitConfig && typeof explicitConfig === 'object'
    ? explicitConfig
    : (globalThis.RPChessPlatformConfig && typeof globalThis.RPChessPlatformConfig === 'object'
      ? globalThis.RPChessPlatformConfig
      : {});
  return Object.freeze({ ...source, kind: normalizePlatformKind(source.kind) });
}

function assertPlatformAdapter(adapter, expectedKind = null) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError('RPChess platform adapter must be an object');
  if (!Object.values(PLATFORM_KINDS).includes(adapter.kind)) throw new TypeError(`Unsupported RPChess platform kind: ${adapter.kind}`);
  if (expectedKind && adapter.kind !== expectedKind) throw new TypeError(`Expected ${expectedKind} platform adapter, got ${adapter.kind}`);
  if (typeof adapter.init !== 'function') throw new TypeError(`${adapter.kind} platform adapter must implement init()`);
  if (!adapter.capabilities || typeof adapter.capabilities !== 'object') throw new TypeError(`${adapter.kind} platform adapter must expose capabilities`);
  for (const service of PLATFORM_SERVICES) {
    if (!adapter[service] || typeof adapter[service] !== 'object') throw new TypeError(`${adapter.kind} platform adapter must expose ${service}`);
    if (typeof adapter[service].supported !== 'boolean') throw new TypeError(`${adapter.kind}.${service}.supported must be boolean`);
  }
  return adapter;
}

async function loadPlatformAdapter(config = readPlatformConfig()) {
  const kind = normalizePlatformKind(config.kind);
  const module = kind === PLATFORM_KINDS.VK
    ? await import('./vk-platform.mjs')
    : await import('./web-platform.mjs');
  return assertPlatformAdapter(module.default, kind);
}

let platformPromise = null;

function initializePlatform({ config: explicitConfig = null, force = false } = {}) {
  if (platformPromise && !force) return platformPromise;
  const config = readPlatformConfig(explicitConfig);
  platformPromise = loadPlatformAdapter(config).then(async (adapter) => {
    const initResult = await adapter.init(config);
    const runtime = Object.freeze({ ...adapter, config, initResult });
    globalThis.RPChessPlatform = runtime;
    if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
      globalThis.dispatchEvent(new CustomEvent('rpchess:platform-ready', {
        detail: { kind: runtime.kind, capabilities: runtime.capabilities, initResult }
      }));
    }
    return runtime;
  });
  globalThis.RPChessPlatformReady = platformPromise;
  return platformPromise;
}

function currentPlatform() {
  return globalThis.RPChessPlatform || null;
}

export {
  PLATFORM_KINDS,
  PLATFORM_SERVICES,
  normalizePlatformKind,
  readPlatformConfig,
  assertPlatformAdapter,
  loadPlatformAdapter,
  initializePlatform,
  currentPlatform
};
