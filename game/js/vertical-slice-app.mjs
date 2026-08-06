import {
  RuntimeCommandClient,
  createLocalRuntimeTransport
} from './runtime-command-client.mjs';
import { VerticalSlicePresenter } from './vertical-slice-presenter.mjs';
import { kingAssets, doctrineAssets } from './register-01-assets.mjs';
import { heroAssets } from './register-02-assets.mjs';
import { openRegister02Codex } from './register-02-codex.mjs';
import { openRegister03RelicCodex } from './register-03-relic-codex.mjs';
import {
  COMMANDERS,
  commanderById,
  unlockedCommanders,
  sceneArt
} from './approved-shell-data.mjs';
import {
  SETTINGS_KEY,
  readAudioSettings,
  VerticalSliceAudio
} from './vertical-slice-audio.mjs';

const PROGRESS_KEY = 'rpchess.approved-shell.progress.v1';
const SHELL_SETTINGS_KEY = SETTINGS_KEY;

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

function safeRead(storage, key, fallback) {
  try {
    const value = storage?.getItem?.(key);
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function safeWrite(storage, key, value) {
  try { storage?.setItem?.(key, JSON.stringify(value)); return true; } catch (_error) { return false; }
}

function readShellProgress(storage) {
  const raw = safeRead(storage, PROGRESS_KEY, {});
  return Object.freeze({
    unlockPoints: Math.max(0, Number(raw.unlockPoints || 0)),
    victories: Math.max(0, Number(raw.victories || 0)),
    discoveries: Math.max(0, Number(raw.discoveries || 0)),
    milestones: Object.freeze({ ...(raw.milestones || {}) }),
    lastProfileId: /^profile-[123]$/.test(raw.lastProfileId) ? raw.lastProfileId : 'profile-1',
    lastCommanderId: COMMANDERS.some((item) => item.id === raw.lastCommanderId) ? raw.lastCommanderId : 'warlord'
  });
}

function writeShellProgress(storage, progress) {
  return safeWrite(storage, PROGRESS_KEY, progress);
}

function addDiscovery(storage, progress, milestone, amount = 1) {
  if (!milestone || progress.milestones?.[milestone]) return progress;
  const next = {
    ...progress,
    unlockPoints: progress.unlockPoints + amount,
    discoveries: progress.discoveries + amount,
    milestones: { ...progress.milestones, [milestone]: true }
  };
  writeShellProgress(storage, next);
  return Object.freeze(next);
}

function profileCopy(language = 'ru') {
  if (language === 'en') return Object.freeze({
    title: 'Choose a campaign profile',
    subtitle: 'Each profile is an independent chronicle with its own autosave and recovery copy.',
    empty: 'Empty chronicle', unavailable: 'Storage unavailable', continue: 'Continue campaign', start: 'Begin here', fresh: 'Start over', remove: 'Delete', act: 'Act', rewards: 'Rewards', revision: 'Save', warning: 'Local storage is unavailable. Progress will last only for this tab.', confirmFresh: 'Replace this chronicle with a new campaign?', confirmDelete: 'Delete this chronicle and its recovery copy?'
  });
  return Object.freeze({
    title: 'Выберите хронику похода',
    subtitle: 'Каждый профиль — отдельная история с автосохранением и резервной копией.',
    empty: 'Пустая хроника', unavailable: 'Хранилище недоступно', continue: 'Продолжить поход', start: 'Начать здесь', fresh: 'Начать заново', remove: 'Удалить', act: 'Акт', rewards: 'Награды', revision: 'Сохранение', warning: 'Локальное хранилище недоступно. Прогресс сохранится только до закрытия вкладки.', confirmFresh: 'Заменить эту хронику новым походом?', confirmDelete: 'Удалить хронику вместе с резервной копией?'
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
    ? { campaign: 'Campaign map', deployment: 'Deployment', event: 'Story event', scenario: 'Battle', boss: 'Boss battle', boss_transition: 'Boss phase', reward: 'Reward', complete: 'Campaign completed', failed: 'Campaign lost' }
    : { campaign: 'Карта похода', deployment: 'Расстановка', event: 'Сюжетное событие', scenario: 'Бой', boss: 'Битва с боссом', boss_transition: 'Фаза босса', reward: 'Награда', complete: 'Поход завершён', failed: 'Поход проигран' };
  return labels[status] || status || labels.campaign;
}

function profileArmyMarkup(profile, options = {}) {
  const army = profile?.army;
  const language = options.language === 'en' ? 'en' : 'ru';
  if (!army) return `<p class="rpprofile__army-legacy">${language === 'en' ? 'The army will be restored when this legacy save is continued.' : 'Армия будет восстановлена при продолжении старого сохранения.'}</p>`;
  const king = kingAssets(army.kingId);
  const doctrine = doctrineAssets(army.doctrineId);
  const kingName = profileContentName(options, 'king', army.kingId, army.kingNameKey);
  const doctrineName = profileContentName(options, 'doctrine', army.doctrineId);
  const hero = army.heroes?.[0] || null;
  const heroAsset = hero ? heroAssets(hero.heroId) : null;
  const heroName = hero ? profileContentName(options, 'hero', hero.heroId, hero.nameKey) : (language === 'en' ? 'No commander' : 'Командир не выбран');
  return `<section class="rpprofile__army" aria-label="${language === 'en' ? 'Army' : 'Армия'}">
    <div class="rpprofile__command">
      <div class="rpprofile__command-card">${heroAsset?.portrait ? `<img src="${escapeHtml(heroAsset.portrait)}" alt="">` : ''}<span><small>${language === 'en' ? 'Commander' : 'Командир'}</small><b>${escapeHtml(heroName)}</b></span></div>
      <div class="rpprofile__command-card">${king?.portrait ? `<img src="${escapeHtml(king.portrait)}" alt="">` : ''}<span><small>${language === 'en' ? 'Crown' : 'Корона'}</small><b>${escapeHtml(kingName)}</b></span></div>
      <div class="rpprofile__command-card">${doctrine?.emblem ? `<img src="${escapeHtml(doctrine.emblem)}" alt="">` : ''}<span><small>${language === 'en' ? 'Doctrine' : 'Доктрина'}</small><b>${escapeHtml(doctrineName)}</b></span></div>
    </div>
  </section>`;
}

function profileSelectionMarkup(profiles, options = {}) {
  const copy = profileCopy(options.language);
  const storageAvailable = options.storageAvailable !== false;
  const cards = profiles.map((profile, index) => {
    const number = index + 1;
    const available = Boolean(profile.available);
    const primaryAction = available ? 'continue' : 'start';
    const status = !storageAvailable ? copy.unavailable : available ? `${copy.act} ${profile.act || 1} · ${profileRuntimeStatus(profile.runtimeStatus, options.language)}` : copy.empty;
    const details = available
      ? `<div class="rpprofile__facts"><span>${copy.rewards}: ${profile.rewardsClaimed}</span><span>${copy.revision}: ${profile.revision}</span></div>${profileArmyMarkup(profile, options)}`
      : `<p class="rpprofile__muted">${escapeHtml(options.language === 'en' ? 'Click the chronicle to begin a new campaign.' : 'Щёлкните по хронике, чтобы начать новый поход.')}</p>`;
    const secondary = available
      ? `<button class="rpa-button" data-profile-action="new" data-profile-id="${profile.profileId}">${copy.fresh}</button><button class="rpa-button rpa-button--danger" data-profile-action="delete" data-profile-id="${profile.profileId}">${copy.remove}</button>`
      : '';
    return `<article class="rpprofile__card rpa-profile-card rpa-panel rpa-panel--frame" data-profile-primary="${primaryAction}" data-profile-id="${profile.profileId}" role="button" tabindex="0" aria-label="${escapeHtml((options.language === 'en' ? 'Chronicle ' : 'Хроника ') + number + ': ' + status)}">
      <div class="rpprofile__number">${number}</div>
      <div class="rpprofile__summary"><h2>${options.language === 'en' ? 'Chronicle' : 'Хроника'} ${number}</h2><strong>${escapeHtml(status)}</strong>${details}</div>
      <div class="rpprofile__actions rpa-profile-card__actions"><button class="rpa-button rpa-button--primary" data-profile-action="${primaryAction}" data-profile-id="${profile.profileId}">${available ? copy.continue : copy.start}</button>${secondary}</div>
    </article>`;
  }).join('');
  return `<main class="rpprofile rpa-subscreen" style="background-image:url('${sceneArt('codex')}')"><section class="rpa-subscreen__content"><header class="rpa-screen-header"><div><div class="rpa-eyebrow">RPCHESS · ХРОНИКИ</div><h1>${copy.title}</h1><p>${copy.subtitle}</p></div><button class="rpa-button" data-shell-action="menu">← ${options.language === 'en' ? 'Main menu' : 'Главное меню'}</button></header>${storageAvailable ? '' : `<div class="rpprofile__warning" role="status">${copy.warning}</div>`}<div class="rpprofile__grid rpa-profile-list">${cards}</div></section></main>`;
}

function menuMarkup(profiles, progress, language = 'ru') {
  const active = profiles.filter((profile) => profile.available).sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))[0] || null;
  const unlocked = unlockedCommanders(progress).length;
  return `<main class="rpa-menu rpa-menu--prototype">
    <div class="rpa-menu__layout">
      <section class="rpa-menu__main rpa-menu__main--open">
        <div class="rpa-menu__eyebrow">FANTASY TACTICAL CHESS ROGUELITE</div>
        <img class="rpa-wordmark" src="generated_assets/title_wordmark.png" alt="RPChess">
        <div class="rpa-menu__actions">
          ${active ? `<button class="rpa-button rpa-button--primary" data-shell-action="continue" data-profile-id="${active.profileId}">${language === 'en' ? 'Continue campaign' : 'Продолжить поход'}<small>${profileRuntimeStatus(active.runtimeStatus, language)} · ${language === 'en' ? 'Act' : 'Акт'} ${active.act || 1}</small></button>` : ''}
          <button class="rpa-button rpa-button--primary" data-shell-action="profiles">${language === 'en' ? 'New campaign' : 'Новый поход'}<small>${language === 'en' ? 'Choose a chronicle and commander' : 'Выбрать хронику и командира'}</small></button>
          <div class="rpa-menu__secondary"><button class="rpa-button" data-shell-action="chronicle">${language === 'en' ? 'Chronicle' : 'Хроника'}</button><button class="rpa-button" data-shell-action="codex">${language === 'en' ? 'Heroes' : 'Герои'}</button><button class="rpa-button" data-shell-action="relics">${language === 'en' ? 'Relics' : 'Реликвии'}</button><button class="rpa-button" data-shell-action="settings">${language === 'en' ? 'Settings' : 'Настройки'}</button></div>
        </div>
      </section>
      <aside class="rpa-menu__status rpa-panel rpa-panel--frame">
        <img src="generated_assets/logo_main.png" alt="" class="rpa-menu__crest">
        <h2>${language === 'en' ? 'Your war council' : 'Ваш военный совет'}</h2>
        <div class="rpa-menu__stats"><div><span>${language === 'en' ? 'Commanders' : 'Командиры'}</span><strong>${unlocked}/${COMMANDERS.length}</strong></div><div><span>${language === 'en' ? 'Discoveries' : 'Открытия'}</span><strong>${progress.discoveries}</strong></div><div><span>${language === 'en' ? 'Victories' : 'Победы'}</span><strong>${progress.victories}</strong></div></div>
        <div class="rpa-onboarding"><div><strong>1</strong><span>${language === 'en' ? 'Choose one commander. Others unlock through discoveries.' : 'Выберите одного командира. Остальные открываются через находки и решения.'}</span></div><div><strong>2</strong><span>${language === 'en' ? 'Travel, resolve events and fight on a living board.' : 'Путешествуйте, принимайте решения и сражайтесь на живой доске.'}</span></div><div><strong>3</strong><span>${language === 'en' ? 'Reach the Iron Regent and defeat both phases.' : 'Доберитесь до Железного Регента и победите обе фазы.'}</span></div></div>
      </aside>
    </div>
  </main>`;
}

function commanderSelectionMarkup(profileId, progress, selectedCommanderId, bundle, language = 'ru') {
  const selected = commanderById(selectedCommanderId);
  const king = kingAssets(selected.kingId);
  const doctrine = doctrineAssets(selected.doctrineId);
  const cards = COMMANDERS.map((commander) => {
    const locked = progress.unlockPoints < commander.unlock;
    return `<button class="rpa-commander" data-commander-id="${commander.id}" aria-pressed="${commander.id === selected.id}" ${locked ? 'disabled' : ''}>
      <span class="rpa-commander__art" style="background-image:linear-gradient(#0001,#0008),url('${commander.portrait}')"></span>
      <span class="rpa-commander__copy"><h3>${escapeHtml(language === 'en' ? commander.nameEn : commander.name)}</h3><p>${escapeHtml(language === 'en' ? commander.descriptionEn : commander.description)}</p><span class="rpa-commander__hero">${language === 'en' ? 'Named hero' : 'Именной герой'}: ${escapeHtml(commander.heroName)}</span>${locked ? `<span class="rpa-lock">${language === 'en' ? `Requires ${commander.unlock} discoveries · ${progress.unlockPoints}/${commander.unlock}` : `Нужно открытий: ${commander.unlock} · сейчас ${progress.unlockPoints}/${commander.unlock}`}</span>` : ''}</span>
    </button>`;
  }).join('');
  const hero = bundle.registry.get('hero', selected.heroId);
  const heroName = profileLocalizedValue({ localization: bundle.localization?.[language] }, hero?.nameKey, selected.heroName);
  return `<main class="rpa-subscreen" style="background-image:url('${sceneArt('campaign')}')"><section class="rpa-subscreen__content"><header class="rpa-screen-header"><div><div class="rpa-eyebrow">${language === 'en' ? 'NEW CAMPAIGN' : 'НОВЫЙ ПОХОД'}</div><h1>${language === 'en' ? 'Choose who leads the army' : 'Выберите, за кого играть'}</h1><p>${language === 'en' ? 'Only one named commander joins at the start. New leaders unlock through events, services, shops and completed campaigns.' : 'В начале похода доступен один именной командир. Новые лидеры открываются через события, услуги, лавки и завершённые походы.'}</p></div><button class="rpa-button" data-shell-action="profiles">← ${language === 'en' ? 'Profiles' : 'Профили'}</button></header><div class="rpa-commander-layout"><div class="rpa-commander-grid">${cards}</div><aside class="rpa-launch rpa-panel rpa-panel--frame" data-commander-preview><div class="rpa-launch__portrait" data-preview-portrait style="background-image:linear-gradient(#0001,#000c),url('${selected.portrait}')"></div><div class="rpa-launch__body"><div class="rpa-eyebrow">${language === 'en' ? 'STARTING COMMANDER' : 'СТАРТОВЫЙ КОМАНДИР'}</div><h2 data-preview-name>${escapeHtml(language === 'en' ? selected.nameEn : selected.name)}</h2><p data-preview-hero>${escapeHtml(heroName)}</p><div class="rpa-loadout"><div><img data-preview-king src="${king?.portrait || ''}" alt=""><span><small>${language === 'en' ? 'King' : 'Король'}</small><strong>${language === 'en' ? 'Oathkeeper' : 'Хранитель Клятвы'}</strong></span></div><div><img data-preview-doctrine src="${doctrine?.emblem || ''}" alt=""><span><small>${language === 'en' ? 'Doctrine' : 'Доктрина'}</small><strong>${language === 'en' ? 'Fortress' : 'Крепость'}</strong></span></div></div><label class="rpa-field">${language === 'en' ? 'World seed' : 'Предначертание мира'}<input inputmode="numeric" data-world-seed value="9042" maxlength="10"></label><button class="rpa-button rpa-button--primary" data-launch-commander data-profile-id="${profileId}">${language === 'en' ? 'Begin campaign' : 'Начать поход'}</button></div></aside></div></section></main>`;
}

function settingsMarkup(settings, language = 'ru') {
  return `<main class="rpa-subscreen" style="background-image:url('${sceneArt('settings')}')"><section class="rpa-subscreen__content"><header class="rpa-screen-header"><div><div class="rpa-eyebrow">RPCHESS</div><h1>${language === 'en' ? 'Settings' : 'Настройки'}</h1><p>${language === 'en' ? 'Sound and interface comfort are saved in this browser.' : 'Звук и комфорт интерфейса сохраняются в этом браузере.'}</p></div><button class="rpa-button" data-shell-action="menu">← ${language === 'en' ? 'Main menu' : 'Главное меню'}</button></header><form class="rpa-panel rpa-settings-grid" data-settings-form><label class="rpa-setting"><strong>${language === 'en' ? 'Master volume' : 'Общая громкость'}</strong><input type="range" min="0" max="1" step="0.05" name="masterVolume" value="${settings.masterVolume}"><small>${language === 'en' ? 'Controls all game audio.' : 'Управляет всей громкостью игры.'}</small></label><label class="rpa-setting"><strong>${language === 'en' ? 'Music' : 'Музыка'}</strong><input type="range" min="0" max="1" step="0.05" name="musicVolume" value="${settings.musicVolume}"><small>${language === 'en' ? 'Campaign soundtrack.' : 'Музыкальное сопровождение похода.'}</small></label><label class="rpa-setting"><strong>${language === 'en' ? 'Effects' : 'Звуковые эффекты'}</strong><input type="range" min="0" max="1" step="0.05" name="sfxVolume" value="${settings.sfxVolume}"><small>${language === 'en' ? 'Moves, captures, abilities and fanfares.' : 'Ходы, взятия, способности и фанфары.'}</small></label><label class="rpa-setting"><strong>${language === 'en' ? 'Interface scale' : 'Масштаб интерфейса'}</strong><input type="range" min="0.85" max="1.25" step="0.05" name="uiScale" value="${settings.uiScale || 1}"><small>${language === 'en' ? 'Increase text and control size.' : 'Увеличивает текст и элементы управления.'}</small></label><label class="rpa-setting"><strong>${language === 'en' ? 'Reduced motion' : 'Уменьшить анимацию'}</strong><input type="checkbox" name="reduceMotion" ${settings.reduceMotion ? 'checked' : ''}><small>${language === 'en' ? 'Reduces animated effects.' : 'Сокращает анимированные эффекты.'}</small></label><div class="rpa-setting"><button class="rpa-button rpa-button--primary" type="submit">${language === 'en' ? 'Save settings' : 'Сохранить настройки'}</button></div></form></section></main>`;
}

function chronicleMarkup(progress, language = 'ru') {
  const items = COMMANDERS.map((commander) => {
    const unlocked = progress.unlockPoints >= commander.unlock;
    const status = unlocked
      ? (language === 'en' ? `Available · ${commander.heroName}` : `Доступен · ${commander.heroName}`)
      : (language === 'en' ? `Locked: ${progress.unlockPoints}/${commander.unlock} discoveries` : `Закрыт: ${progress.unlockPoints}/${commander.unlock} открытий`);
    const body = `<img src="${commander.portrait}" alt=""><span class="rpa-chronicle-card__copy"><span class="rpa-eyebrow">${unlocked ? (language === 'en' ? 'AVAILABLE COMMANDER' : 'ДОСТУПНЫЙ КОМАНДИР') : (language === 'en' ? 'LOCKED' : 'ЗАКРЫТО')}</span><strong>${escapeHtml(language === 'en' ? commander.nameEn : commander.name)}</strong><small>${escapeHtml(status)}</small><span>${escapeHtml(language === 'en' ? commander.descriptionEn : commander.description)}</span></span>${unlocked ? `<span class="rpa-chronicle-card__action">${language === 'en' ? 'Choose' : 'Выбрать'} →</span>` : `<span class="rpa-lock">${escapeHtml(status)}</span>`}`;
    return unlocked
      ? `<button class="rpa-chronicle-card" data-chronicle-commander="${commander.id}">${body}</button>`
      : `<article class="rpa-chronicle-card is-locked" aria-disabled="true">${body}</article>`;
  }).join('');
  return `<main class="rpa-subscreen" style="background-image:url('${sceneArt('achievements')}')"><section class="rpa-subscreen__content"><header class="rpa-screen-header"><div><div class="rpa-eyebrow">${language === 'en' ? 'CHRONICLE' : 'ХРОНИКА'}</div><h1>${language === 'en' ? 'Commanders and discoveries' : 'Командиры и открытия'}</h1><p>${language === 'en' ? 'Choose an unlocked commander or review the next discovery goal.' : 'Выберите открытого командира или посмотрите условие следующего открытия.'}</p></div><button class="rpa-button" data-shell-action="menu">← ${language === 'en' ? 'Main menu' : 'Главное меню'}</button></header><div class="rpa-menu__stats rpa-chronicle-stats"><div><span>${language === 'en' ? 'Discoveries' : 'Открытия'}</span><strong>${progress.discoveries}</strong></div><div><span>${language === 'en' ? 'Victories' : 'Победы'}</span><strong>${progress.victories}</strong></div><div><span>${language === 'en' ? 'Commanders' : 'Командиры'}</span><strong>${unlockedCommanders(progress).length}/${COMMANDERS.length}</strong></div></div><div class="rpa-chronicle-list">${items}</div></section></main>`;
}

function showFatal(root, error) {
  root.innerHTML = `<main class="rpa-menu"><section class="rpa-panel rpa-menu__status" role="alert"><img src="generated_assets/logo_main.png" alt="" style="width:96px"><h2>Не удалось запустить поход</h2><p>${escapeHtml(error?.message || error || 'Неизвестная ошибка')}</p><button class="rpa-button rpa-button--primary" type="button" onclick="location.reload()">Повторить запуск</button></section></main>`;
}

function installBootstrapStyles(document) {
  document.documentElement.style.setProperty('--rpa-ui-scale', '1');
}

function startVerticalSlice(options = {}) {
  const root = options.root || document.getElementById('app');
  if (!root) throw new Error('vertical slice root element is missing');
  installBootstrapStyles(root.ownerDocument || document);
  const runtimeApi = options.runtimeApi || globalThis.RPChessRuntime;
  if (!runtimeApi || typeof runtimeApi.createBrowserRunSelectionHost !== 'function') throw new Error('production browser runtime bundle is unavailable');
  const baseOptions = Object.freeze({ ...readLaunchOptions(), ...(options.launchOptions || {}), storage: resolveLocalStorage(options.storage), deviceId: options.deviceId || 'rpchess-browser-v2' });
  const bundle = runtimeApi.createBrowserProductionBundle();
  const store = runtimeApi.createBrowserProfileStore({ storage: baseOptions.storage, deviceId: baseOptions.deviceId });
  const validation = { contentRegistry: bundle.registry, combatProfiles: bundle.combatProfiles };
  let progress = readShellProgress(baseOptions.storage);
  let selectedCommanderId = progress.lastCommanderId;
  let currentProfileId = progress.lastProfileId;
  let selectionHost = null;
  let runtimeClient = null;
  let verticalPresenter = null;
  let audio = new VerticalSliceAudio({ storage: baseOptions.storage });
  let previousRuntimeSnapshot = null;

  const shellSettings = () => ({ ...readAudioSettings(baseOptions.storage), ...safeRead(baseOptions.storage, SHELL_SETTINGS_KEY, {}), uiScale: Number(safeRead(baseOptions.storage, SHELL_SETTINGS_KEY, {}).uiScale || 1), reduceMotion: Boolean(safeRead(baseOptions.storage, SHELL_SETTINGS_KEY, {}).reduceMotion) });
  const applySettings = () => {
    const settings = shellSettings();
    document.documentElement.style.setProperty('--rpa-ui-scale', String(settings.uiScale || 1));
    document.documentElement.style.fontSize = `${Math.round(16 * (settings.uiScale || 1))}px`;
    document.body.classList.toggle('reduce-motion', settings.reduceMotion);
    audio.applySettings(settings);
  };
  applySettings();

  const destroyRuntimeView = () => {
    verticalPresenter?.destroy?.();
    verticalPresenter = null;
    runtimeClient = null;
    selectionHost = null;
    previousRuntimeSnapshot = null;
  };

  const profiles = () => runtimeApi.listBrowserProfiles(store, validation);
  const renderMenu = () => { destroyRuntimeView(); root.innerHTML = menuMarkup(profiles(), progress, baseOptions.language); bindShell(); };
  const renderProfiles = () => { destroyRuntimeView(); root.innerHTML = profileSelectionMarkup(profiles(), { language: baseOptions.language, storageAvailable: Boolean(store), registry: bundle.registry, localization: bundle.localization?.[baseOptions.language] || null }); bindShell(); };
  const renderCommanderSelection = (profileId) => { currentProfileId = profileId; root.innerHTML = commanderSelectionMarkup(profileId, progress, selectedCommanderId, bundle, baseOptions.language); bindShell(); };
  const renderSettings = () => { destroyRuntimeView(); root.innerHTML = settingsMarkup(shellSettings(), baseOptions.language); bindShell(); };
  const renderChronicle = () => { destroyRuntimeView(); root.innerHTML = chronicleMarkup(progress, baseOptions.language); bindShell(); };

  const observeProgress = (snapshot) => {
    audio.observe(snapshot);
    const nodeType = snapshot.currentNode?.type;
    const nodeId = snapshot.currentNode?.id || snapshot.currentNode?.contentId || snapshot.transcriptLength;
    if (snapshot.status === 'reward' && previousRuntimeSnapshot?.status !== 'reward' && ['event', 'service', 'shop', 'treasure'].includes(nodeType)) {
      progress = addDiscovery(baseOptions.storage, progress, `${currentProfileId}:discovery:${nodeId}`, 1);
    }
    if (snapshot.status === 'complete' && previousRuntimeSnapshot?.status !== 'complete') {
      const milestone = `${currentProfileId}:victory:${snapshot.seed}`;
      if (!progress.milestones?.[milestone]) {
        const next = addDiscovery(baseOptions.storage, progress, milestone, 1);
        progress = Object.freeze({ ...next, victories: next.victories + 1 });
        writeShellProgress(baseOptions.storage, progress);
      }
    }
    previousRuntimeSnapshot = snapshot;
  };

  const mountRuntime = () => {
    const runtimeHost = selectionHost.getRuntimeHost();
    if (!runtimeHost) throw new Error('ready selection has no runtime host');
    root.replaceChildren();
    runtimeClient = new RuntimeCommandClient({ transport: createLocalRuntimeTransport(runtimeHost), snapshot: runtimeHost.getSnapshot() });
    runtimeClient.addEventListener('snapshot', (event) => observeProgress(event.detail));
    verticalPresenter = new VerticalSlicePresenter({ root, client: runtimeClient });
    observeProgress(runtimeHost.getSnapshot());
    globalThis.RPChessVerticalSlice = Object.freeze({ baseOptions, selectionHost, runtimeHost, runtimeClient, presenter: verticalPresenter, audio, showMenu: renderMenu });
  };

  const mountProfile = (profileId, forceNew = false, commanderId = null, seed = baseOptions.seed) => {
    currentProfileId = profileId;
    progress = Object.freeze({ ...progress, lastProfileId: profileId, lastCommanderId: commanderId || progress.lastCommanderId });
    writeShellProgress(baseOptions.storage, progress);
    selectionHost = runtimeApi.createBrowserRunSelectionHost({ ...baseOptions, stageB: true, seed, profileId, forceNew, heroLimit: 1, minimumHeroes: 1, availableHeroIds: unlockedCommanders(progress).map((commander) => commander.heroId) });
    const initial = selectionHost.getSnapshot();
    if (initial.status === 'ready') { mountRuntime(); return; }
    if (!commanderId) { renderCommanderSelection(profileId); return; }
    const commander = commanderById(commanderId);
    const launch = async () => {
      await selectionHost.dispatch({ type: 'SelectKing', kingId: commander.kingId });
      await selectionHost.dispatch({ type: 'SelectDoctrine', doctrineId: commander.doctrineId });
      await selectionHost.dispatch({ type: 'ToggleHero', heroId: commander.heroId });
      await selectionHost.dispatch({ type: 'LockSelection' });
      mountRuntime();
    };
    launch().catch((error) => showFatal(root, error));
  };

  const bindShell = () => {
    root.querySelectorAll('[data-shell-action]').forEach((button) => button.addEventListener('click', () => {
      audio.activate(); audio.click();
      const action = button.dataset.shellAction;
      if (action === 'menu') renderMenu();
      else if (action === 'profiles') renderProfiles();
      else if (action === 'settings') renderSettings();
      else if (action === 'chronicle') renderChronicle();
      else if (action === 'codex') openRegister02Codex(root);
      else if (action === 'relics') openRegister03RelicCodex(root);
      else if (action === 'continue') mountProfile(button.dataset.profileId || progress.lastProfileId, false);
    }));
    root.querySelectorAll('[data-profile-action]').forEach((button) => button.addEventListener('click', () => {
      audio.activate(); audio.click();
      const profileId = button.dataset.profileId;
      const action = button.dataset.profileAction;
      const copy = profileCopy(baseOptions.language);
      if (action === 'continue') mountProfile(profileId, false);
      else if (action === 'start') renderCommanderSelection(profileId);
      else if (action === 'new' && globalThis.confirm?.(copy.confirmFresh) !== false) renderCommanderSelection(profileId);
      else if (action === 'delete' && globalThis.confirm?.(copy.confirmDelete) !== false) { runtimeApi.deleteBrowserProfile(store, profileId); renderProfiles(); }
    }));
    root.querySelectorAll('[data-commander-id]').forEach((button) => button.addEventListener('click', () => {
      selectedCommanderId = button.dataset.commanderId;
      audio.activate(); audio.click();
      root.querySelectorAll('[data-commander-id]').forEach((card) => card.setAttribute('aria-pressed', String(card === button)));
      const commander = commanderById(selectedCommanderId);
      const preview = root.querySelector('[data-commander-preview]');
      if (!preview || !commander) return;
      const hero = bundle.registry.get('hero', commander.heroId);
      const heroName = profileLocalizedValue({ localization: bundle.localization?.[baseOptions.language] }, hero?.nameKey, commander.heroName);
      const king = kingAssets(commander.kingId);
      const doctrine = doctrineAssets(commander.doctrineId);
      const portrait = preview.querySelector('[data-preview-portrait]');
      if (portrait) portrait.style.backgroundImage = `linear-gradient(#0001,#000c),url('${commander.portrait}')`;
      const name = preview.querySelector('[data-preview-name]'); if (name) name.textContent = baseOptions.language === 'en' ? commander.nameEn : commander.name;
      const heroCopy = preview.querySelector('[data-preview-hero]'); if (heroCopy) heroCopy.textContent = heroName;
      const kingImage = preview.querySelector('[data-preview-king]'); if (kingImage) kingImage.src = king?.portrait || '';
      const doctrineImage = preview.querySelector('[data-preview-doctrine]'); if (doctrineImage) doctrineImage.src = doctrine?.emblem || '';
    }));
    root.querySelectorAll('[data-chronicle-commander]').forEach((button) => button.addEventListener('click', () => {
      selectedCommanderId = button.dataset.chronicleCommander;
      progress = Object.freeze({ ...progress, lastCommanderId: selectedCommanderId });
      writeShellProgress(baseOptions.storage, progress);
      audio.activate(); audio.click();
      renderProfiles();
    }));
    root.querySelectorAll('[data-profile-primary]').forEach((card) => {
      const activate = (event) => {
        if (event.target.closest('button')) return;
        const action = card.dataset.profilePrimary;
        const profileId = card.dataset.profileId;
        audio.activate(); audio.click();
        if (action === 'continue') mountProfile(profileId, false);
        else renderCommanderSelection(profileId);
      };
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event); } });
    });
    root.querySelector('[data-launch-commander]')?.addEventListener('click', () => {
      audio.activate(); audio.ability();
      const seedInput = Number(root.querySelector('[data-world-seed]')?.value);
      mountProfile(currentProfileId, true, selectedCommanderId, Number.isFinite(seedInput) && seedInput > 0 ? Math.floor(seedInput) : baseOptions.seed);
    });
    root.querySelector('[data-settings-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const settings = { masterVolume: Number(form.get('masterVolume')), musicVolume: Number(form.get('musicVolume')), sfxVolume: Number(form.get('sfxVolume')), uiScale: Number(form.get('uiScale')), reduceMotion: form.get('reduceMotion') === 'on' };
      safeWrite(baseOptions.storage, SHELL_SETTINGS_KEY, settings); applySettings(); audio.click(); renderMenu();
    });
  };

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-runtime-menu]')) { event.preventDefault(); renderMenu(); }
  });
  document.addEventListener('pointerdown', () => audio.activate(), { once: true });
  document.addEventListener('keydown', () => audio.activate(), { once: true });

  if (baseOptions.profileExplicit) mountProfile(baseOptions.profileId, baseOptions.forceNew, baseOptions.forceNew ? selectedCommanderId : null);
  else renderMenu();

  return Object.freeze({ baseOptions, showProfiles: renderProfiles, showMenu: renderMenu, mountProfile, getSelectionHost: () => selectionHost, getSelectionClient: () => null, getSelectionPresenter: () => null, getRuntimeClient: () => runtimeClient, getVerticalPresenter: () => verticalPresenter, getProgress: () => progress });
}

if (typeof document !== 'undefined') {
  try { startVerticalSlice(); }
  catch (error) { const root = document.getElementById('app') || document.body; installBootstrapStyles(document); showFatal(root, error); }
}

export {
  PROGRESS_KEY,
  escapeHtml,
  readLaunchOptions,
  resolveLocalStorage,
  readShellProgress,
  writeShellProgress,
  addDiscovery,
  profileCopy,
  profileLocalizedValue,
  profileContentName,
  profileRuntimeStatus,
  profileArmyMarkup,
  profileSelectionMarkup,
  menuMarkup,
  commanderSelectionMarkup,
  settingsMarkup,
  chronicleMarkup,
  showFatal,
  installBootstrapStyles,
  startVerticalSlice
};
