(() => {
  const calls = [];
  const listeners = [];
  const supported = new Set([
    'VKWebAppInit',
    'VKWebAppGetConfig',
    'VKWebAppGetLaunchParams',
    'VKWebAppGetUserInfo'
  ]);

  const bridge = {
    __rpchessMock: true,
    calls,
    send(method, params = {}) {
      calls.push({ method, params });
      if (method === 'SetSupportedHandlers') {
        return Promise.resolve({ supportedHandlers: Array.from(supported) });
      }
      if (method === 'VKWebAppInit') return Promise.resolve({ result: true });
      return Promise.resolve({});
    },
    sendPromise(method, params = {}) {
      return this.send(method, params);
    },
    subscribe(listener) {
      if (typeof listener === 'function') listeners.push(listener);
    },
    unsubscribe(listener) {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
    supports(method) {
      return supported.has(method);
    },
    async supportsAsync(method) {
      return supported.has(method);
    },
    isWebView() {
      return false;
    },
    isIframe() {
      return false;
    },
    isEmbedded() {
      return false;
    },
    isStandalone() {
      return true;
    }
  };

  globalThis.vkBridge = bridge;
  globalThis.vkConnect = bridge;
})();
