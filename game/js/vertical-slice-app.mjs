import {
  RunSelectionClient,
  createRunSelectionTransport
} from './run-selection-client.mjs';
import { RunSelectionPresenter } from './run-selection-presenter.mjs';
import {
  RuntimeCommandClient,
  createLocalRuntimeTransport
} from './runtime-command-client.mjs';
import { VerticalSlicePresenter } from './vertical-slice-presenter.mjs';

function readLaunchOptions(location = globalThis.location) {
  const params = new URLSearchParams(location?.search || '');
  const seedInput = Number(params.get('seed'));
  const language = params.get('lang') === 'en' ? 'en' : 'ru';
  const profileInput = String(params.get('profile') || 'profile-1');
  return Object.freeze({
    seed: Number.isFinite(seedInput) && seedInput > 0 ? Math.floor(seedInput) : 9042,
    language,
    profileId: /^profile-[123]$/.test(profileInput) ? profileInput : 'profile-1',
    aiProfile: ['apprentice', 'tactician', 'warlord'].includes(params.get('ai')) ? params.get('ai') : 'apprentice',
    forceNew: params.get('new') === '1',
    autoSave: params.get('autosave') !== '0'
  });
}

function resolveLocalStorage(explicit = undefined) {
  if (explicit !== undefined) return explicit;
  try { return globalThis.localStorage || null; } catch (_error) { return null; }
}

function showFatal(root, error) {
  root.innerHTML = `
    <main class="rpboot" role="alert">
      <div class="rpboot__card">
        <div class="rpboot__sigil">♚</div>
        <h1>Не удалось запустить поход</h1>
        <p>${String(error?.message || error || 'Неизвестная ошибка').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[character])}</p>
        <button type="button" onclick="location.reload()">Повторить запуск</button>
      </div>
    </main>`;
}

function installBootstrapStyles(document) {
  if (document.getElementById('rpboot-styles')) return;
  const style = document.createElement('style');
  style.id = 'rpboot-styles';
  style.textContent = `
    html,body,#app{min-height:100%;margin:0}body{background:#080d16}
    .rpboot{min-height:100vh;display:grid;place-items:center;padding:24px;color:#f4ead7;background:radial-gradient(circle at top,#20304d,#080d16 66%);font-family:system-ui,sans-serif}
    .rpboot__card{max-width:580px;padding:28px;border:1px solid #8a7445;border-radius:18px;background:#101827;text-align:center;box-shadow:0 22px 70px #0009}.rpboot__sigil{font-size:72px;color:#e3bf68}.rpboot h1{font-family:Georgia,serif}.rpboot p{color:#c9d2df;white-space:pre-wrap}.rpboot button{padding:12px 20px;border:1px solid #e3bf68;border-radius:10px;background:#b18a36;color:#111;font-weight:800;cursor:pointer}
  `;
  document.head.appendChild(style);
}

function startVerticalSlice(options = {}) {
  const root = options.root || document.getElementById('app');
  if (!root) throw new Error('vertical slice root element is missing');
  installBootstrapStyles(root.ownerDocument || document);
  const runtimeApi = options.runtimeApi || globalThis.RPChessRuntime;
  if (!runtimeApi || typeof runtimeApi.createBrowserRunSelectionHost !== 'function') {
    throw new Error('production browser runtime bundle is unavailable');
  }
  const launchOptions = Object.freeze({
    ...readLaunchOptions(),
    ...(options.launchOptions || {}),
    storage: resolveLocalStorage(options.storage),
    deviceId: options.deviceId || 'rpchess-browser-v1'
  });
  const selectionHost = runtimeApi.createBrowserRunSelectionHost(launchOptions);
  let selectionClient = null;
  let selectionPresenter = null;
  let verticalPresenter = null;
  let runtimeClient = null;

  const mountRuntime = () => {
    const runtimeHost = selectionHost.getRuntimeHost();
    if (!runtimeHost) throw new Error('ready selection has no runtime host');
    root.replaceChildren();
    runtimeClient = new RuntimeCommandClient({
      transport: createLocalRuntimeTransport(runtimeHost),
      snapshot: runtimeHost.getSnapshot()
    });
    verticalPresenter = new VerticalSlicePresenter({ root, client: runtimeClient });
    globalThis.RPChessVerticalSlice = Object.freeze({
      launchOptions,
      selectionHost,
      runtimeHost,
      runtimeClient,
      presenter: verticalPresenter
    });
    return verticalPresenter;
  };

  const initial = selectionHost.getSnapshot();
  if (initial.status === 'ready') {
    mountRuntime();
  } else {
    selectionClient = new RunSelectionClient({
      transport: createRunSelectionTransport(selectionHost),
      snapshot: initial
    });
    selectionPresenter = new RunSelectionPresenter({
      root,
      client: selectionClient,
      onReady: () => {
        try { mountRuntime(); } catch (error) { showFatal(root, error); }
      }
    });
    selectionPresenter.mount();
  }
  return Object.freeze({
    launchOptions,
    selectionHost,
    getSelectionClient: () => selectionClient,
    getSelectionPresenter: () => selectionPresenter,
    getRuntimeClient: () => runtimeClient,
    getVerticalPresenter: () => verticalPresenter
  });
}

try {
  startVerticalSlice();try {
  startVerticalSlice();
} catch (error) {
  const root = document.getElementById('app') || document.body;
  installBootstrapStyles(document);
  showFatal(root, error);
}

export {
  readLaunchOptions,
  resolveLocalStorage,
  showFatal,
  installBootstrapStyles,
  startVerticalSlice
};
