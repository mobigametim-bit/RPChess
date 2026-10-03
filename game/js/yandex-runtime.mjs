import { platform } from './platform.mjs';
import { currentLanguage, setLanguage, subscribe } from './i18n.mjs';

const SETTINGS_KEY = 'rpchess.reboot.v1.settings';
function selectLanguage() {
  let settings = {};
  try { settings = JSON.parse(platform.storage.getItem(SETTINGS_KEY) || '{}'); } catch {}
  const manual = ['ru', 'en'].includes(settings.language) && settings.languageSource !== 'portal';
  setLanguage(manual ? settings.language : platform.language, { source:manual ? 'manual' : 'portal' });
}

function localizeBrand() {
  document.title = currentLanguage() === 'en' ? 'Heroes of Check & Mate' : 'Герои Шаха и Мата';
  for (const logo of document.querySelectorAll('[data-brand-logo]')) logo.alt = document.title;
}

async function initializeYandex() {
  for (;;) {
    try { await platform.init(); break; }
    catch (error) {
      console.warn('[RPChess] Yandex SDK startup failed', error);
      const loading = document.querySelector('.yandex-loading');
      if (!loading) throw error;
      loading.querySelector('p').textContent = 'Не удалось загрузить игру / Unable to load the game';
      const retry = loading.querySelector('button');
      retry.hidden = false;
      await new Promise(resolve => retry.addEventListener('click', resolve, { once:true }));
      retry.hidden = true;
      loading.querySelector('p').textContent = 'Загрузка / Loading…';
    }
  }
  selectLanguage();
  localizeBrand();
  subscribe(localizeBrand);
}

const visible = selector => Boolean(document.querySelector(`${selector}:not([hidden])`));
function gameplayVisible() {
  if (visible('.reboot-modal') || visible('[data-combat-exit-dialog]') || visible('[data-arena-dialog]')) return false;
  if (visible('[data-classic-screen]')) return !globalThis.RPChessClassicChess?.snapshot()?.status?.over;
  if (visible('[data-arena-screen]') && visible('[data-arena-battle]')) return !globalThis.RPChessArena?.engine?.status()?.over;
  if (visible('[data-puzzle-screen]')) return !visible('[data-puzzle-outcome]');
  return false;
}

async function finishYandexStartup() {
  selectLanguage();
  localizeBrand();
  await document.fonts?.ready;
  await Promise.all([...document.querySelectorAll('[data-brand-logo]')].map(logo => logo.decode?.().catch(() => {})));
  // The attribute also belongs to <html>; never remove it via a generic query.
  document.querySelector('.yandex-loading')?.remove();
  document.documentElement.removeAttribute('data-yandex-loading');
  const pausedAnimations = new Set();
  const syncGameplay = () => {
    const active = gameplayVisible();
    platform.lifecycle.setGameplayActive(active);
    platform.gameplay(active && platform.lifecycle.isActive());
  };
  platform.lifecycle.subscribe(({ active }) => {
    document.documentElement.toggleAttribute('data-host-paused', !active);
    if (!active) {
      for (const animation of document.getAnimations?.() || []) {
        if (animation.playState === 'running') { pausedAnimations.add(animation); animation.pause(); }
      }
    } else {
      for (const animation of pausedAnimations) {
        if (animation.playState === 'paused') animation.play();
      }
      pausedAnimations.clear();
    }
    syncGameplay();
  });
  const observer = new MutationObserver(syncGameplay);
  observer.observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['hidden','class'] });
  for (const type of ['click','pointerdown','keydown','contextmenu','selectstart']) {
    document.addEventListener(type, event => {
      const editable = event.target?.closest?.('input,textarea,select,[contenteditable="true"]');
      if (!platform.lifecycle.isActive() || (!editable && ['contextmenu','selectstart'].includes(type))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, { capture:true });
  }
  syncGameplay();
  platform.ready();
  return true;
}

export { initializeYandex, finishYandexStartup };
