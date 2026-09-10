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

const webPlatform = Object.freeze({
  kind: 'web',
  label: 'Web',
  capabilities,
  storage: unsupportedService(),
  ads: unsupportedService(),
  payments: unsupportedService(),
  analytics: unsupportedService(),
  social: unsupportedService(),
  lifecycle: unsupportedService(),
  async init() {
    return Object.freeze({ ok: true, kind: 'web', integration: 'browser-default' });
  }
});

export default webPlatform;
