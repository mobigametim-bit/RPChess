function normalizeAudioBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeAudioAssetPath(value) {
  return String(value || '').trim().replace(/^(?:\.\/)+/, '').replace(/^\/+/, '');
}

function audioAssetUrl(assetPath) {
  const relative = normalizeAudioAssetPath(assetPath);
  const baseUrl = normalizeAudioBaseUrl(globalThis.RPChessPlatformConfig?.audioBaseUrl);
  return baseUrl && relative ? `${baseUrl}/${relative}` : relative;
}

export { audioAssetUrl, normalizeAudioAssetPath, normalizeAudioBaseUrl };
