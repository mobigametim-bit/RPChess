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
import { kingAssets, doctrineAssets } from './register-01-assets.mjs';
import { heroAssets } from './register-02-assets.mjs';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function readLaunchOptions(location = globalThis.location) {
  const params = new URLSearchParams(location?.search || '');
  const seedInput = Number(params.get('seed'));
  const language = params.get('lang') === 'en' ? 'en' : 'ru';
  const profileInput = String(params.get('profile') || 'profile-1');
  return Object.freeze({
    seed: Number.isFinite(seedInput) && seedInput > 0 ? Math.floor(seedInput) : 9042,
    language,
    profileId: /^profile-[123]$/.test(profileInput) ? profileInput : 'profile-1',
    profileExplicit: params.has('profile'),
    aiProfile: ['apprentice', 'tactician', 'warlord'].includes(params.get('ai')) ? params.get('ai') : 'apprentice',
    forceNew: params.get('new') === '1',
    autoSave: params.get('autosave') !== '0'
  });
}

function resolveLocalStorage(explicit = undefined) {
  if (explicit !== undefined) return explicit;
  try { return globalThis.localStorage || null; } catch (_error) { return null; }
}

function profileCopy(language = 'ru') {
  if (language === 'en') return Object.freeze({
    title: 'Choose a profile',
    subtitle: 'Each slot keeps an independent campaign, checksum and recovery backup.',
    empty: 'Empty slot',
    unavailable: 'Storage unavailable',
    continue: 'Continue',
    start: 'Start campaign',
    fresh: 'New campaign',
    remove: 'Delete',
    act: 'Act',
    rewards: 'Rewards',
    revision: 'Save revision',
    warning: 'Local storage is unavailable. Progress will last only for this tab.',
    confirmFresh: 'Replace this profile with a new campaign?',
    confirmDelete: 'Delete this profile and its recovery backup?'
  });
  return Object.freeze({
    title: 'Выберите профиль',
    subtitle: 'Каждый слот хранит отдельный поход, контрольную сумму и резервную копию.',
    empty: 'Пустой слот',
    unavailable: 'Хранилище недоступно',
    continue: 'Продолжить',
    start: 'Начать поход',
    fresh: 'Новый поход',
    remove: 'Удалить',
    act: 'Акт',
    rewards: 'Наград',
    revision: 'Версия сохранения',
    warning: 'Локальное хранилище недоступно. Прогресс сохранится только до закрытия вкладки.',
    confirmFresh: 'Заменить этот профиль новым походом?',
    confirmDelete: 'Удалить профиль вместе с резервной копией?'
  });
}

function profileLocalizedValue(options, key, fallback) {
  if (!key) return fallback;
  const localization = options.localization || null;
  if (typeof localization === 'function') return localization(key) ?? fallback;
  if (localization && typeof localization.get === 'function') return localization.get(key) ?? fallback;
  return localization?.[key] ?? fallback;
}

function profileContentName(options, kind, id, explicitNameKey = null) {
  const record = options.registry?.get?.(kind, id) || null;
  const nameKey = record?.nameKey || explicitNameKey;
  return profileLocalizedValue(options, nameKey, id || '—');
}

function profileRuntimeStatus(status, language = 'ru') {
  const labels = language === 'en'
    ? { campaign: 'Campaign map', deployment: 'Deployment', event: 'Event', scenario: 'Battle', boss: 'Boss battle', boss_transition: 'Boss transition', reward: 'Reward', complete: 'Completed', failed: 'Defeated' }
    : { campaign: 'Карта похода', deployment: 'Расстановка', event: 'Событие', scenario: 'Бой', boss: 'Битва с боссом', boss_transition: 'Смена фазы босса', reward: 'Награда', complete: 'Поход завершён', failed: 'Поражение' };
  return labels[status] || status || labels.campaign;
}

function profileArmyMarkup(profile, options = {}) {
  const army = profile?.army;
  const language = options.language === 'en' ? 'en' : 'ru';
  if (!army) {
    const legacy = language === 'en'
      ? 'The roster will be restored when this legacy save is continued.'
      : 'Состав будет восстановлен при продолжении старого сохранения.';
    return `<p class="rpprofile__army-legacy">${legacy}</p>`;
  }
  const king = kingAssets(army.kingId);
  const doctrine = doctrineAssets(army.doctrineId);
  const kingName = profileContentName(options, 'king', army.kingId, army.kingNameKey);
  const doctrineName = profileContentName(options, 'doctrine', army.doctrineId);
  const copy = language === 'en'
    ? { army: 'Army', king: 'King', doctrine: 'Doctrine', heroes: 'Heroes', relics: 'Relics' }
    : { army: 'Армия', king: 'Король', doctrine: 'Доктрина', heroes: 'Герои', relics: 'Реликвии' };
  const heroes = (army.heroes || []).map((hero) => {
    const assets = heroAssets(hero.heroId);
    const name = profileContentName(options, 'hero', hero.heroId, hero.nameKey);
    const image = assets?.portrait
      ? `<img src="${escapeHtml(assets.portrait)}" alt="${escapeHtml(name)}">`
      : '<span class="rpprofile__hero-fallback">♟</span>';
    return `<figure class="rpprofile__hero" title="${escapeHtml(name)}">${image}<figcaption>${escapeHtml(name)}</figcaption></figure>`;
  }).join('');
  return `<section class="rpprofile__army" aria-label="${copy.army}">
    <div class="rpprofile__command">
      <div class="rpprofile__command-card">${king?.portrait ? `<img src="${escapeHtml(king.portrait)}" alt="${escapeHtml(kingName)}">` : ''}<span><small>${copy.king}</small><b>${escapeHtml(kingName)}</b></span></div>
      <div class="rpprofile__command-card">${doctrine?.emblem ? `<img src="${escapeHtml(doctrine.emblem)}" alt="${escapeHtml(doctrineName)}">` : ''}<span><small>${copy.doctrine}</small><b>${escapeHtml(doctrineName)}</b></span></div>
    </div>
    <div class="rpprofile__army-counts"><span>${copy.heroes}: ${army.heroCount}</span><span>${copy.relics}: ${army.relicCount}</span></div>
    <div class="rpprofile__heroes">${heroes}</div>
  </section>`;
}

function profileSelectionMarkup(profiles, options = {}) {
  const copy = profileCopy(options.language);
  const storageAvailable = options.storageAvailable !== false;
  const cards = profiles.map((profile, index) => {
    const number = index + 1;
    const available = Boolean(profile.available);
    const date = profile.savedAt ? new Date(profile.savedAt).toLocaleString(options.language === 'en' ? 'en-US' : 'ru-RU') : null;
    const status = !storageAvailable ? copy.unavailable : available ? `${copy.act} ${profile.act || 1}` : copy.empty;
    const army = available ? profileArmyMarkup(profile, options) : '';
    const details = available
      ? `<div class="rpprofile__facts"><span>${escapeHtml(profileRuntimeStatus(profile.runtimeStatus, options.language))}</span><span>${copy.rewards}: ${profile.rewardsClaimed}</span><span>${copy.revision}: ${profile.revision}</span>${date ? `<time>${escapeHtml(date)}</time>` : ''}</div>${army}`
      : `<p class="rpprofile__muted">${escapeHtml(status)}</p>`;
    const actions = available
      ? `<button class="rpprofile__primary" data-profile-action="continue" data-profile-id="${profile.profileId}">${copy.continue}</button><button data-profile-action="new" data-profile-id="${profile.profileId}">${copy.fresh}</button><button class="rpprofile__danger" data-profile-action="delete" data-profile-id="${profile.profileId}">${copy.remove}</button>`
      : `<button class="rpprofile__primary" data-profile-action="start" data-profile-id="${profile.profileId}">${copy.start}</button>`;
    const profileLabel = options.language === 'en' ? 'Profile' : 'Профиль';
    return `<article class="rpprofile__card"><div class="rpprofile__number">${number}</div><div><h2>${profileLabel} ${number}</h2><strong>${escapeHtml(status)}</strong>${details}</div><div class="rpprofile__actions">${actions}</div></article>`;
  }).join('');
  return `<main class="rpprofile"><section class="rpprofile__shell"><header><div class="rpprofile__crown">♚</div><div><h1>${copy.title}</h1><p>${copy.subtitle}</p></div></header>${storageAvailable ? '' : `<div class="rpprofile__warning" role="status">${copy.warning}</div>`}<div class="rpprofile__grid">${cards}</div></section></main>`;
}

function showFatal(root, error) {
  root.innerHTML = `
    <main class="rpboot" role="alert">
      <div class="rpboot__card">
        <div class="rpboot__sigil">♚</div>
        <h1>Не удалось запустить поход</h1>
        <p>${escapeHtml(error?.message || error || 'Неизвестная ошибка')}</p>
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
    .rpboot{min-height:100vh;display:grid;place-items:center;padding:24px;color:#f4ead7;background:radial-gradient(circle at top,#20304d,#080d16 66%);font-family:system-ui,sans-serif}.rpboot__card{max-width:580px;padding:28px;border:1px solid #8a7445;border-radius:18px;background:#101827;text-align:center;box-shadow:0 22px 70px #0009}.rpboot__sigil{font-size:72px;color:#e3bf68}.rpboot h1{font-family:Georgia,serif}.rpboot p{color:#c9d2df;white-space:pre-wrap}.rpboot button{padding:12px 20px;border:1px solid #e3bf68;border-radius:10px;background:#b18a36;color:#111;font-weight:800;cursor:pointer}
    .rpprofile{min-height:100vh;display:grid;place-items:center;padding:28px;color:#f4ead7;background:linear-gradient(#080d16b8,#080d16f2),url('assets/regions/iron_marches/capital.jpg') center/cover fixed no-repeat;font-family:system-ui,sans-serif}.rpprofile__shell{width:min(1120px,100%);padding:26px;border:1px solid #8b7443;border-radius:22px;background:#09111ee8;box-shadow:0 24px 80px #000b;backdrop-filter:blur(8px)}.rpprofile header{display:flex;align-items:center;gap:18px;margin-bottom:24px}.rpprofile__crown{font-size:64px;color:#e3bf68}.rpprofile h1,.rpprofile h2{margin:0;font-family:Georgia,serif}.rpprofile header p{margin:.4em 0 0;color:#aebbd0}.rpprofile__warning{margin-bottom:18px;padding:12px;border:1px solid #b58b45;border-radius:10px;background:#4a3514}.rpprofile__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.rpprofile__card{display:grid;grid-template-columns:52px 1fr;gap:14px;min-height:260px;padding:17px;border:1px solid #50627e;border-radius:15px;background:linear-gradient(#17243a,#0e1726)}.rpprofile__number{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#09111e;color:#f0cc76;font:700 25px Georgia,serif}.rpprofile__muted,.rpprofile__facts{color:#aebbd0}.rpprofile__facts{display:grid;gap:5px;margin-top:12px;font-size:14px}.rpprofile__actions{grid-column:1/-1;display:grid;gap:8px;align-self:end}.rpprofile button{position:relative;padding:11px;border:1px solid #71839e;border-radius:9px;background:#1c2b43;color:#f4ead7;font-weight:750;cursor:pointer}.rpprofile button:hover{border-color:#83caff}.rpprofile button:focus-visible{outline:3px solid #83caff;outline-offset:3px}.rpprofile__primary{border-color:#d7b45d!important;background:linear-gradient(#765b24,#493710)!important}.rpprofile__danger{border-color:#985858!important;color:#ffdada!important}.rpprofile button:focus-visible::after{content:'';position:absolute;inset:-8px;pointer-events:none;background:url('assets/ui/focus_ring.png') center/100% 100% no-repeat}
    .rpprofile__army{grid-column:1/-1;margin-top:13px;padding-top:12px;border-top:1px solid #384a65}.rpprofile__command{display:grid;grid-template-columns:1fr 1fr;gap:7px}.rpprofile__command-card{display:flex;align-items:center;gap:7px;min-width:0;padding:7px;border-radius:9px;background:#0b1525}.rpprofile__command-card img{width:38px;height:38px;object-fit:contain;flex:0 0 auto}.rpprofile__command-card span{display:grid;min-width:0}.rpprofile__command-card small{color:#9dafc7}.rpprofile__command-card b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.rpprofile__army-counts{display:flex;justify-content:space-between;gap:8px;margin:9px 0 7px;color:#d9bf79;font-size:12px}.rpprofile__heroes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.rpprofile__hero{min-width:0;margin:0;text-align:center}.rpprofile__hero img,.rpprofile__hero-fallback{display:grid;place-items:center;width:100%;aspect-ratio:1;object-fit:cover;border:1px solid #526885;border-radius:8px;background:#09111e}.rpprofile__hero figcaption{overflow:hidden;margin-top:3px;color:#aebbd0;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.rpprofile__army-legacy{grid-column:1/-1;margin:12px 0 0;color:#d8bd79;font-size:12px}
    @media(max-width:850px){.rpprofile__grid{grid-template-columns:1fr}.rpprofile__card{min-height:190px}.rpprofile__heroes{grid-template-columns:repeat(6,minmax(0,1fr))}}@media(max-width:500px){.rpprofile{padding:12px}.rpprofile__shell{padding:17px}.rpprofile header{align-items:flex-start}.rpprofile__crown{font-size:45px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
  `;
  document.head.appendChild(style);
}

function startVerticalSlice(options = {}) {
  const root = options.root || document.getElementById('app');
  if (!root) throw new Error('vertical slice root element is missing');
  installBootstrapStyles(root.ownerDocument || document);
  const runtimeApi = options.runtimeApi || globalThis.RPChessRuntime;
  if (!runtimeApi || typeof runtimeApi.createBrowserRunSelectionHost !== 'function') throw new Error('production browser runtime bundle is unavailable');
  const baseOptions = Object.freeze({
    ...readLaunchOptions(),
    ...(options.launchOptions || {}),
    storage: resolveLocalStorage(options.storage),
    deviceId: options.deviceId || 'rpchess-browser-v1'
  });
  let selectionHost = null;
  let selectionClient = null;
  let selectionPresenter = null;
  let runtimeClient = null;
  let verticalPresenter = null;

  const mountProfile = (profileId, forceNew = false) => {
    selectionPresenter?.client?.removeEventListener?.('snapshot', selectionPresenter.onSnapshot);
    selectionHost = runtimeApi.createBrowserRunSelectionHost({ ...baseOptions, profileId, forceNew });
    const mountRuntime = () => {
      const runtimeHost = selectionHost.getRuntimeHost();
      if (!runtimeHost) throw new Error('ready selection has no runtime host');
      root.replaceChildren();
      runtimeClient = new RuntimeCommandClient({ transport: createLocalRuntimeTransport(runtimeHost), snapshot: runtimeHost.getSnapshot() });
      verticalPresenter = new VerticalSlicePresenter({ root, client: runtimeClient });
      globalThis.RPChessVerticalSlice = Object.freeze({ baseOptions, selectionHost, runtimeHost, runtimeClient, presenter: verticalPresenter });
    };
    const initial = selectionHost.getSnapshot();
    if (initial.status === 'ready') mountRuntime();
    else {
      selectionClient = new RunSelectionClient({ transport: createRunSelectionTransport(selectionHost), snapshot: initial });
      selectionPresenter = new RunSelectionPresenter({ root, client: selectionClient, onReady: () => {
        try { mountRuntime(); } catch (error) { showFatal(root, error); }
      } });
      selectionPresenter.mount();
    }
  };

  const showProfiles = () => {
    const bundle = runtimeApi.createBrowserProductionBundle();
    const store = runtimeApi.createBrowserProfileStore({ storage: baseOptions.storage, deviceId: baseOptions.deviceId });
    const validation = { contentRegistry: bundle.registry, combatProfiles: bundle.combatProfiles };
    const profiles = runtimeApi.listBrowserProfiles(store, validation);
    root.innerHTML = profileSelectionMarkup(profiles, {
      language: baseOptions.language,
      storageAvailable: Boolean(store),
      registry: bundle.registry,
      localization: bundle.localization?.[baseOptions.language] || null
    });
    const copy = profileCopy(baseOptions.language);
    for (const button of root.querySelectorAll('[data-profile-action]')) {
      button.addEventListener('click', () => {
        const profileId = button.dataset.profileId;
        const action = button.dataset.profileAction;
        if (action === 'continue' || action === 'start') mountProfile(profileId, false);
        else if (action === 'new') {
          if (globalThis.confirm?.(copy.confirmFresh) !== false) mountProfile(profileId, true);
        } else if (action === 'delete') {
          if (globalThis.confirm?.(copy.confirmDelete) === false) return;
          runtimeApi.deleteBrowserProfile(store, profileId);
          showProfiles();
        }
      });
    }
  };

  if (baseOptions.profileExplicit || options.skipProfileSelection === true) mountProfile(baseOptions.profileId, baseOptions.forceNew);
  else showProfiles();

  return Object.freeze({
    baseOptions,
    showProfiles,
    mountProfile,
    getSelectionHost: () => selectionHost,
    getSelectionClient: () => selectionClient,
    getSelectionPresenter: () => selectionPresenter,
    getRuntimeClient: () => runtimeClient,
    getVerticalPresenter: () => verticalPresenter
  });
}

if (typeof document !== 'undefined') {
  try {
    startVerticalSlice();
  } catch (error) {
    const root = document.getElementById('app') || document.body;
    installBootstrapStyles(document);
    showFatal(root, error);
  }
}

export {
  escapeHtml,
  readLaunchOptions,
  resolveLocalStorage,
  profileCopy,
  profileLocalizedValue,
  profileContentName,
  profileRuntimeStatus,
  profileArmyMarkup,
  profileSelectionMarkup,
  showFatal,
  installBootstrapStyles,
  startVerticalSlice
};
