import { initializePlatform } from './platform.mjs';

const existing = globalThis.RPChessPlatformConfig && typeof globalThis.RPChessPlatformConfig === 'object'
  ? globalThis.RPChessPlatformConfig
  : {};
const parsedAppId = Number(existing.appId ?? existing.app_id ?? 0);
const config = Object.freeze({
  ...existing,
  kind: 'vk',
  appId: Number.isFinite(parsedAppId) && parsedAppId > 0 ? parsedAppId : null
});

globalThis.RPChessPlatformConfig = config;
const vkPlatformReady = initializePlatform({ config }).catch((error) => {
  console.error('[RPChess] VK platform bootstrap failed', error);
  return null;
});
globalThis.RPChessPlatformReady = vkPlatformReady;

export { vkPlatformReady };
