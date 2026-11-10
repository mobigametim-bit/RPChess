import { RebootAudio } from './reboot-audio.mjs';
import { platform } from './platform.mjs';
import {
  availableLanguages,
  currentLanguage,
  localizeDocument,
  setLanguage,
  subscribe,
  t
} from './i18n.mjs';
import { installBrandLogos } from './brand-logo.mjs';

const platformReady = platform.init();
installBrandLogos();

// Reconcile VK cloud state before run-owned modules read local persistence. Standalone Web resolves
// immediately; VK failures are non-fatal and leave the local cache authoritative for this session.
// A genuine local/cloud run conflict blocks run bootstrap until the player explicitly chooses one.
const cloudReady = Promise.all([platformReady, import('./cloud-save.mjs')])
  .then(async ([, module]) => {
    // The VK GamePush test build migrates only completed meta statistics.
    // Do this before Chronicle/Rating/Run modules open their first screen.
    // Standalone Web and unchanged production use their previous boot paths.
    if (platform.profileEnabled) {
      // Unified RPChess profile is now the source for Web/PWA and VK opt-in.
      // Legacy VK Cloud is read-only for a verified one-time meta import.
      const profile = await import('./profile-client.mjs');
      return profile.bootstrapProfile();
    }
    if (platform.gamepush.enabled && platform.launch.isVK()) {
      const meta = await import('./gamepush-meta-sync.mjs');
      return meta.bootstrapGamePushMeta();
    }
    return module.bootstrapCloudSave();
  })
  .catch((error) => {
    console.error('[RPChess] Cloud Save bootstrap failed', error);
    return { status:'error', conflict:null };
  });
globalThis.RPChessCloudReady = cloudReady;

// The jester owns the first-visit hints. It loads after Cloud Save so synced
// tutorial flags are authoritative before any hint can be displayed.
const onboardingReady = cloudReady
  .then(() => import('./content/onboarding.mjs?v=20261111-goblin-18-v1'))
  .then((module) => {
    module.installOnboarding();
    return module;
  })
  .catch((error) => {
    console.error('[RPChess] Onboarding bootstrap failed', error);
    return null;
  });
globalThis.RPChessOnboardingReady = onboardingReady;

// Monetization installs before route modules so the interstitial gate can intercept semantic Travel
// transitions before scene owners. All VK ad calls stay behind platform.ads; standalone Web is a no-op.
const monetizationReady = cloudReady
  .then(() => import('./content/monetization.mjs'))
  .then((module) => {
    module.installMonetization();
    return module;
  })
  .catch((error) => {
    console.error('[RPChess] Monetization bootstrap failed', error);
    return null;
  });
globalThis.RPChessMonetizationReady = monetizationReady;

// Travel Choice is part of the critical run shell. Its stylesheet must be available even if
// the wider route/content bootstrap fails and Roster has to use the direct Travel fallback.
if (!document.querySelector('[data-travel-choice-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/travel-choice.css?v=20260830-acceptance-2';
  link.dataset.travelChoiceCss = '';
  document.head.append(link);
}
if (!document.querySelector('[data-player-rating-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/player-rating.css?v=20261021-after-battle';
  link.dataset.playerRatingCss = '';
  document.head.append(link);
}

// Player Identity / Chronicle loads after the cloud reconciliation boundary so Continue/New Game
// observes the selected local/cloud state instead of racing VK Storage on startup.
const identityReady = cloudReady
  .then(() => import('./player-identity-chronicle.mjs'))
  .catch((error) => {
    console.error('[RPChess] Player Identity / Chronicle bootstrap failed', error);
    return null;
  });
globalThis.RPChessIdentityReady = identityReady;

// The read-only map attaches after the authoritative cloud-state reconciliation.
const menuReady=cloudReady
 .then(()=>import('./kingdom-menu-preview.mjs?v=20261111-npc-floor-v1'))
 .then(async module=>{module.install();await module.waitForTextures();})
 .catch(error=>console.error('[RPChess] Main-menu kingdom preview failed',error));
globalThis.RPChessMainMenuReady=menuReady;

// Route/content modules wait for the ad gate registration. Once Starvation exists, monetization
// replaces only the public starvation entry point with the optional rewarded-rescue gate.
const routeReady = Promise.all([cloudReady, monetizationReady])
  .then(async ([, monetization]) => {
    const route = await import('./battle-route.mjs');
    monetization?.bindStarvationRescue?.();
    monetization?.reconcileCompletedRewards?.();
    return route;
  })
  .catch((error) => {
    console.error('[RPChess] Route bootstrap failed', error);
    return null;
  });
globalThis.RPChessRouteReady = routeReady;

// Tell GamePush that the first interactive screen is ready, only in explicit SDK trial mode.
// Platform auth/saves and existing VK launch behavior are not switched by this preview.
Promise.all([routeReady, identityReady]).then(() => {
  if (platform.gamepush.enabled) void platform.gamepush.markReady();
});


const REBOOT_INIT_KEY = 'rpchess.reboot.v1.initialized';
const SETTINGS_KEY = 'rpchess.reboot.v1.settings';

function clearLegacySavesOnce() {
  const target = platform.storage.sync();
  if (!target || target.getItem(REBOOT_INIT_KEY) === '1') return;
  const remove = [];
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (key && key.startsWith('rpchess.') && !key.startsWith('rpchess.reboot.')) remove.push(key);
  }
  for (const key of remove) target.removeItem(key);
  target.setItem(REBOOT_INIT_KEY, '1');
}

function readSettings() {
  try {
    const value = JSON.parse(platform.storage.getItem(SETTINGS_KEY) || '{}');
    return {
      music: Number.isFinite(value.music) ? value.music : 20,
      sfx: Number.isFinite(value.sfx) ? value.sfx : 80,
      reducedMotion: Boolean(value.reducedMotion),
      simplePieces: value.simplePieces === true,
      language: currentLanguage()
    };
  } catch {
    return { music: 20, sfx: 80, reducedMotion: false, simplePieces:false, language: currentLanguage() };
  }
}

function writeSettings(settings) {
  platform.storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function openModal(modal, audio) {
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('reboot-modal-open');
  audio?.open();
  modal.querySelector('button, input, select')?.focus();
}

function closeModal(modal, audio) {
  if (!modal || modal.hasAttribute('data-modal-static')) return;
  modal.hidden = true;
  document.body.classList.remove('reboot-modal-open');
  audio?.close();
  if (modal.matches('[data-journey-choice-modal]')) {
    document.querySelector('[data-new-game][data-continue-run]')?.focus();
  }
}

clearLegacySavesOnce();

const settings = readSettings();
const audio = new RebootAudio(settings);
const settingsModal = document.querySelector('[data-settings-modal]');
const languageModal = document.querySelector('[data-language-modal]');
const journeyChoiceModal = document.querySelector('[data-journey-choice-modal]');
const journeyIcon = document.querySelector('[data-new-game][data-continue-run]');
const music = document.querySelector('[data-music-volume]');
const sfx = document.querySelector('[data-sfx-volume]');
const reducedMotion = document.querySelector('[data-reduced-motion]');
const simplePieces = document.querySelector('input[data-simple-pieces]');

if (music) music.value = String(settings.music);
if (sfx) sfx.value = String(settings.sfx);
if (reducedMotion) reducedMotion.checked = settings.reducedMotion;
if (simplePieces) simplePieces.checked = settings.simplePieces;
document.documentElement.dataset.reducedMotion = settings.reducedMotion ? '1' : '0';
document.documentElement.dataset.simplePieces = settings.simplePieces ? '1' : '0';

globalThis.RPChessRebootAudio = audio;
globalThis.RPChessPlatform = platform;
const unsubscribePlatformLifecycle = platform.lifecycle.subscribe(({ active }) => audio.setHostActive(active));
globalThis.RPChessOpenSettings = () => openModal(settingsModal, audio);

function syncLanguageUi() {
  const language = currentLanguage();
  const labels = new Map(availableLanguages().map((entry) => [entry.code, entry.label]));
  localizeDocument(document);
  document.querySelectorAll('[data-language-option]').forEach((button) => {
    const selected = button.dataset.languageOption === language;
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.classList.toggle('is-selected', selected);
    const marker = button.querySelector('[data-language-current]');
    if (marker) {
      marker.hidden = !selected;
      marker.textContent = t('language.current', { language: labels.get(language) || language });
    }
  });
}

syncLanguageUi();
subscribe((language) => {
  settings.language = language;
  syncLanguageUi();
});

function updateMainMenuIconLabels(){
  const en=currentLanguage()==='en';
  const labels={
    journey:en?'Journey':'Путешествие',arena:en?'Arena':'Арена',
    tournament:en?'Tournament':'Турнир',mentor:en?'Mentor training':'Наставник',
    settings:t('menu.settings'),language:t('menu.language')
  };
  for(const [role,selector] of Object.entries({
    journey:'[data-new-game][data-continue-run]',arena:'[data-arena-open]',
    tournament:'[data-tournament-open]',mentor:'[data-mentor-open]',
    settings:'.reboot-menu-actions [data-settings]',language:'.reboot-menu-actions [data-language]'
  })){
    const element=document.querySelector('.mm-menu-approved '+selector);
    if(!element)continue;
    element.setAttribute('aria-label',labels[role]);
    element.title=labels[role];
  }
  // The visible note changes immediately if the user switches RU/EN.
  const note=journeyChoiceModal?.querySelector('[data-journey-choice-note]');
  const resume=journeyChoiceModal?.querySelector('[data-journey-continue]');
  if(note&&resume)note.textContent=t(resume.disabled?'menu.journeyEmpty':'menu.journeyReplace');
}
updateMainMenuIconLabels();
subscribe(updateMainMenuIconLabels);
function activateAudio() { audio.activate(); }
document.addEventListener('pointerdown', activateAudio, { once: true, capture: true });
document.addEventListener('keydown', activateAudio, { once: true, capture: true });

// The icon opens two explicit choices; merely opening the dialog never
// alters a saved run. Cloud-state reconciliation always finishes first.
let journeyChoiceOpening = false;
journeyIcon?.addEventListener('click', async () => {
  if (!journeyChoiceModal || journeyChoiceOpening || !journeyChoiceModal.hidden) return;
  audio.click();
  journeyChoiceOpening = true;
  try {
    await cloudReady;
    const {readRun}=await import('./run-persistence.mjs');
    if (!journeyIcon.isConnected || document.querySelector('[data-reboot-foundation]')?.hidden) return;
    const active=Boolean(readRun()&&!readRun().ended);
    const resume=journeyChoiceModal.querySelector('[data-journey-continue]');
    resume.disabled=!active;
    resume.setAttribute('aria-disabled',String(!active));
    updateMainMenuIconLabels();
    openModal(journeyChoiceModal,audio);
    (active?resume:journeyChoiceModal.querySelector('[data-journey-new]'))?.focus();
  } catch(error) {
    console.error('[RPChess] Journey choice failed to open',error);
  } finally {
    journeyChoiceOpening=false;
  }
});
journeyChoiceModal?.querySelector('[data-journey-new]')?.addEventListener('click',async()=>{
  audio.click();
  closeModal(journeyChoiceModal,audio);
  const onboarding=await onboardingReady;
  onboarding?.activateOnboarding?.();
  const identity=await identityReady;
  identity?.openIdentityPrompt?.();
  onboarding?.showHint?.('identity');
});
journeyChoiceModal?.querySelector('[data-journey-continue]')?.addEventListener('click',async()=>{
  const {readRun}=await import('./run-persistence.mjs');
  if(!readRun()||readRun().ended){
    const resume=journeyChoiceModal.querySelector('[data-journey-continue]');
    resume.disabled=true;
    resume.setAttribute('aria-disabled','true');
    updateMainMenuIconLabels();
    return;
  }
  audio.click();
  closeModal(journeyChoiceModal,audio);
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));
});
// Keep keyboard focus inside the choice dialog; Escape and backdrop close
// through the shared modal handler, restoring focus to the Journey icon.
journeyChoiceModal?.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const buttons=[...journeyChoiceModal.querySelectorAll('button:not([disabled])')];
  const first=buttons[0],last=buttons[buttons.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});

document.querySelectorAll('[data-settings]').forEach((button) => {
  button.addEventListener('click', () => {
    audio.click();
    openModal(settingsModal, audio);
  });
});

document.querySelectorAll('[data-language]').forEach((button) => {
  button.addEventListener('click', () => {
    audio.click();
    openModal(languageModal, audio);
  });
});

document.querySelectorAll('[data-language-option]').forEach((button) => {
  button.addEventListener('click', () => {
    audio.click();
    setLanguage(button.dataset.languageOption);
  });
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(button.closest('.reboot-modal'), audio));
});

document.querySelectorAll('.reboot-modal:not([data-modal-static])').forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(modal, audio);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const open = [...document.querySelectorAll('.reboot-modal:not([data-modal-static])')].find((modal) => !modal.hidden);
  if (open) closeModal(open, audio);
});

function saveSettings({ previewSfx = false } = {}) {
  settings.music = Number(music?.value ?? settings.music);
  settings.sfx = Number(sfx?.value ?? settings.sfx);
  settings.reducedMotion = Boolean(reducedMotion?.checked);
  settings.simplePieces = Boolean(simplePieces?.checked);
  writeSettings(settings);
  document.documentElement.dataset.reducedMotion = settings.reducedMotion ? '1' : '0';
  document.documentElement.dataset.simplePieces = settings.simplePieces ? '1' : '0';
  audio.applySettings(settings);
  if (previewSfx) audio.adjust();
}

music?.addEventListener('input', () => saveSettings());
sfx?.addEventListener('input', () => saveSettings({ previewSfx: true }));
reducedMotion?.addEventListener('change', () => {
  audio.click();
  saveSettings();
});
simplePieces?.addEventListener('change', () => {
  audio.click();
  saveSettings();
});

addEventListener('beforeunload', () => { unsubscribePlatformLifecycle(); audio.destroy(); }, { once: true });
