// Prepare next-screen imagery behind an opaque, localized loading screen.
// Visual transitions never touch chess state, game rules or persistence.
import { brandLogoSrc } from './brand-logo.mjs';
import { currentLanguage, subscribe } from './i18n.mjs';

const READY_TIMEOUT_MS = 7000;
const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
let activeTransition = null;

function sceneImageUrls(roots = [], extra = []) {
  const urls = new Set();
  const add = (raw) => {
    if (typeof raw !== 'string') return;
    const path = raw.trim();
    if (path && !path.startsWith('data:') && !path.startsWith('blob:') && !path.startsWith('#')) urls.add(path);
  };
  for (const item of extra) add(item);
  for (const root of roots) {
    if (!root) continue;
    for (const element of [root, ...root.querySelectorAll('*')]) {
      if (element.tagName === 'IMG') add(element.getAttribute('src') || element.currentSrc);
      const style = element.getAttribute('style') || '';
      for (const match of style.matchAll(urlPattern)) add(match[1]);
      try {
        const background = getComputedStyle(element).backgroundImage;
        for (const match of background.matchAll(urlPattern)) add(match[1]);
      } catch {}
    }
  }
  return [...urls];
}

function preloadImage(source) {
  return new Promise(resolve => {
    const image = new Image();
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      image.onload = image.onerror = null;
      resolve();
    };
    image.onerror = done;
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().catch(() => {}).then(done);
      else done();
    };
    image.src = source;
    if (image.complete) {
      if (image.naturalWidth > 0 && typeof image.decode === 'function') image.decode().catch(() => {}).then(done);
      else if (image.naturalWidth === 0) done();
    }
  });
}

function prepareArt(urls, { timeoutMs = READY_TIMEOUT_MS } = {}) {
  const paths = [...new Set(urls.filter(url => typeof url === 'string' && url.trim()))];
  if (!paths.length) return Promise.resolve({ timedOut: false, count: 0 });
  return new Promise(resolve => {
    let finished = false;
    const finish = timedOut => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ timedOut, count: paths.length });
    };
    const timeout = setTimeout(() => finish(true), Math.max(0, timeoutMs));
    Promise.all(paths.map(preloadImage)).then(() => finish(false), () => finish(false));
  });
}

function ensureLoadingStyles() {
  if (document.querySelector('[data-scene-loading-style]')) return;
  const style = document.createElement('style');
  style.dataset.sceneLoadingStyle = '';
  style.textContent = [
    '.rpchess-scene-preparing{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(32px,7vh,76px);padding:30px;background:#000;color:#fff;pointer-events:auto;cursor:wait;}',
    '.rpchess-scene-preparing__logo{display:block;width:min(76vw,570px);max-height:42vh;object-fit:contain;}',
    '.rpchess-scene-preparing__label{font:400 clamp(22px,3.6vw,38px)/1.15 "BrahmsGotischCyr",Georgia,serif;letter-spacing:.09em;text-align:center;animation:rpchess-scene-blink 1.1s steps(2,end) infinite;}',
    '@keyframes rpchess-scene-blink{0%,49%{opacity:1}50%,100%{opacity:.12}}',
    '@media(prefers-reduced-motion:reduce){.rpchess-scene-preparing__label{animation:none}}'
  ].join('');
  document.head.append(style);
}

function makeOverlay() {
  ensureLoadingStyles();
  const root = document.createElement('div');
  root.className = 'rpchess-scene-preparing';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', 'Loading');
  const logo = document.createElement('img');
  logo.className = 'rpchess-scene-preparing__logo';
  logo.alt = '';
  logo.draggable = false;
  const label = document.createElement('span');
  label.className = 'rpchess-scene-preparing__label';
  const sync = () => {
    const en = currentLanguage() === 'en';
    logo.src = brandLogoSrc();
    label.textContent = en ? 'LOADING...' : 'ЗАГРУЗКА...';
    root.setAttribute('aria-label', en ? 'Loading' : 'Загрузка');
  };
  sync();
  const unsubscribe = subscribe(sync);
  root.append(logo, label);
  document.body.append(root);
  return { root, cleanup: () => { unsubscribe?.(); root.remove(); } };
}

// Keep the cover through the *final* DOM render, layout and decoding of visible
// assets. Even a cancelled/failed image must never strand the user in black.
function afterPaint() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame !== 'function') { resolve(); return; }
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function showPreparedScene({ roots = [], assets = [], enter, isCurrent = () => true, timeoutMs = READY_TIMEOUT_MS } = {}) {
  if (typeof enter !== 'function') throw new TypeError('enter is required');
  if (activeTransition) {
    activeTransition.cancelled = true;
    activeTransition.cleanup();
  }
  const overlay = makeOverlay();
  const transition = { cancelled: false, cleanup: overlay.cleanup };
  activeTransition = transition;
  const deadline = Date.now() + Math.max(0, timeoutMs);
  const remaining = () => Math.max(0, deadline - Date.now());
  try {
    const prepared = await prepareArt(sceneImageUrls(roots, [...assets, brandLogoSrc()]), { timeoutMs: remaining() });
    if (transition.cancelled || !isCurrent()) return { ...prepared, entered: false };
    // Transition and initial render are synchronous, but stay fully covered.
    enter();
    globalThis.dispatchEvent?.(new CustomEvent('rpchess:scene-revealed'));
    await afterPaint();
    if (transition.cancelled || !isCurrent()) return { ...prepared, entered: false };
    // CSS backgrounds and final personalized images may only be assigned after
    // the target scene becomes active. Decode those too under the cover.
    const finalArt = await prepareArt(sceneImageUrls(roots), { timeoutMs: remaining() });
    await afterPaint();
    return { timedOut: prepared.timedOut || finalArt.timedOut, count: prepared.count + finalArt.count, entered: true };
  } finally {
    overlay.cleanup();
    if (activeTransition === transition) activeTransition = null;
  }
}

export { sceneImageUrls, prepareArt, showPreparedScene };
