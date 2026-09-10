function unsupportedService() {
  return Object.freeze({ supported: false });
}

const capabilities = Object.freeze({
  bridge: false,
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
  storage: unsupportedService(),
  ads: unsupportedService(),
  payments: unsupportedService(),
  analytics: unsupportedService(),
  social: unsupportedService(),
  lifecycle: unsupportedService(),
  async init() {
    return Object.freeze({
      ok: true,
      kind: 'vk',
      integration: 'scaffold',
      bridgeReady: false
    });
  }
});

export default vkPlatform;
