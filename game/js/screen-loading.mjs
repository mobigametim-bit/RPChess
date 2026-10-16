// Lightweight, independent loader: does not import the heavy run or localization bundles.
// The initial mask is present in HTML before any game module starts executing.
const overlay = document.querySelector('[data-game-loading]');
const logo = overlay?.querySelector('[data-game-loading-logo]');
const label = overlay?.querySelector('[data-game-loading-label]');
const app = document.querySelector('#app');
const loaded = new Set();
const failed = new Set();
const inflight = new Map();
const settledStyles = new WeakSet();
let generation = 0;
let bootFinished = false;
let lastScene = '';
let hideTimer = null;

function language() {
  return (globalThis.RPChessI18n?.currentLanguage?.() || document.documentElement.lang) === 'en' ? 'en' : 'ru';
}
function localize() {
  if (!overlay) return;
  const en = language() === 'en';
  const src = 'generated_assets/logo_' + (en ? 'en' : 'ru') + '.png';
  if (logo && logo.getAttribute('src') !== src) logo.setAttribute('src', src);
  if (label) label.textContent = en ? 'LOADING...' : 'ЗАГРУЗКА...';
  overlay.setAttribute('aria-label', en ? 'Loading game' : 'Загрузка игры');
}
function show() {
  if (!overlay) return;
  if (hideTimer) clearTimeout(hideTimer);
  overlay.hidden = false;
  overlay.classList.remove('is-hiding');
  localize();
}
function hide(token) {
  if (!overlay || token !== generation) return;
  overlay.classList.add('is-hiding');
  hideTimer = setTimeout(() => {
    if (token === generation) overlay.hidden = true;
    hideTimer = null;
  }, document.documentElement.dataset.reducedMotion === '1' ? 0 : 270);
}
function frame() { return new Promise((resolve) => requestAnimationFrame(resolve)); }
function visible(element) {
  if (!element?.getBoundingClientRect) return false;
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 &&
    box.bottom > 0 && box.right > 0 &&
    box.top < innerHeight && box.left < innerWidth &&
    getComputedStyle(element).visibility !== 'hidden';
}
function visibleScreens() {
  return [...(app?.children || [])].filter((node) =>
    node.tagName === 'MAIN' && !node.hidden && visible(node));
}
function mediaSources() {
  const sources = new Set();
  for (const screen of visibleScreens()) {
    // Prioritize viewport imagery, not thousands of portraits from hidden screens.
    const nodes = [screen, ...screen.querySelectorAll('*')].slice(0, 900);
    for (const node of nodes) {
      if (!visible(node)) continue;
      if (node.tagName === 'IMG') {
        const src = node.currentSrc || node.src;
        if (src) {
          if (node.complete && node.naturalWidth > 0) loaded.add(src);
          else sources.add(src);
        }
      }
      const bg = getComputedStyle(node).backgroundImage;
      if (bg && bg !== 'none') {
        for (const match of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          try { sources.add(new URL(match[1], document.baseURI).href); } catch {}
        }
      }
    }
  }
  return [...sources].filter((src) => !loaded.has(src) && !failed.has(src));
}
function pendingStyles() {
  return [...document.querySelectorAll('link[rel="stylesheet"]')].filter((link) => !link.disabled && !link.sheet && !settledStyles.has(link));
}
function awaitStylesheet(link) {
  if (link.sheet) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      settledStyles.add(link);
      clearTimeout(timer);
      link.removeEventListener('load', finish);
      link.removeEventListener('error', finish);
      resolve();
    };
    const timer = setTimeout(finish, 9000);
    link.addEventListener('load', finish, { once: true });
    link.addEventListener('error', finish, { once: true });
  });
}
function preload(src) {
  if (loaded.has(src) || failed.has(src)) return Promise.resolve();
  if (inflight.has(src)) return inflight.get(src);
  const promise = new Promise((resolve) => {
    const image = new Image();
    let finished = false;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (ok) loaded.add(src);
      else { failed.add(src); console.warn('[RPChess] Asset could not be loaded:', src); }
      resolve();
    };
    const timer = setTimeout(() => finish(false), 10000);
    image.onload = async () => {
      try { if (image.decode) await image.decode(); } catch {}
      finish(true);
    };
    image.onerror = () => finish(false);
    image.src = src;
  }).finally(() => inflight.delete(src));
  inflight.set(src, promise);
  return promise;
}
async function prepareScene(token) {
  for (let pass = 0; pass < 4 && token === generation; pass += 1) {
    await frame();
    if (token !== generation) return;
    const styles = pendingStyles();
    const media = mediaSources();
    if (!styles.length && !media.length) {
      await frame(); // Give the browser one paint/layout boundary after decoding.
      if (!pendingStyles().length && !mediaSources().length) break;
      continue;
    }
    await Promise.allSettled([...styles.map(awaitStylesheet), ...media.map(preload)]);
  }
  if (token === generation) hide(token);
}
function sceneKey() {
  return visibleScreens().map((screen) => screen.dataset.rebootFoundation !== undefined
    ? 'menu' : screen.className || screen.dataset.arenaScreen || screen.tagName).join('|');
}
function onSceneMutation(records) {
  const changed = records.some((record) =>
    record.type === 'attributes' && record.attributeName === 'hidden' &&
    record.target.parentElement === app && record.target.tagName === 'MAIN' ||
    record.type === 'childList' && [...record.addedNodes].some((node) =>
      node.nodeType === 1 && node.parentElement === app && node.tagName === 'MAIN'));
  if (!changed) return;
  queueMicrotask(() => {
    const key = sceneKey();
    if (key === lastScene) return;
    lastScene = key;
    if (!bootFinished || !key) return;
    const token = ++generation;
    // Do not flash the mask on cached, already complete transitions.
    if (!pendingStyles().length && !mediaSources().length) {
      // A cached destination can supersede a still-loading screen. Dismiss
      // the old mask rather than invalidating its token and leaving it stuck.
      hide(token);
      return;
    }
    show();
    prepareScene(token);
  });
}
// For interfaces that update their images without switching top-level <main>
// (Arena catalog / battle / rival dialog). Call synchronously after DOM updates,
// before the next paint. Do not show a mask when all visible art is cached.
function requestVisibleAssets(){
  if(!overlay||!bootFinished)return false;
  if(!pendingStyles().length&&!mediaSources().length)return false;
  const token=++generation;
  show();
  void prepareScene(token);
  return true;
}
globalThis.RPChessLoading=Object.freeze({requestVisibleAssets});

if (overlay && app) {
  overlay.dataset.loaderInitialized = '1';
  localize();
  addEventListener('rpchess:language-changed', localize);
  // Watch only top-level scene roots, not every chess-piece DOM mutation.
  const watchedScreens = new WeakSet();
  const observer = new MutationObserver((records) => {
    for (const node of app.children) {
      if (node.tagName !== 'MAIN' || watchedScreens.has(node)) continue;
      watchedScreens.add(node);
      observer.observe(node, { attributes: true, attributeFilter: ['hidden'] });
    }
    onSceneMutation(records);
  });
  observer.observe(app, { childList: true });
  for (const node of app.children) {
    if (node.tagName !== 'MAIN') continue;
    watchedScreens.add(node);
    observer.observe(node, { attributes: true, attributeFilter: ['hidden'] });
  }
  let started = false;
  async function start() {
    if (started) return;
    started = true;
    const token = ++generation;
    lastScene = sceneKey();
    // Font and initial stylesheet loads are part of the visible-screen readiness contract.
    const fonts = document.fonts?.ready || Promise.resolve();
    await Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 10000))]);
    await prepareScene(token);
    bootFinished = true;
  }
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
  // If an asset or stylesheet permanently fails, never trap the user behind black.
  setTimeout(() => {
    if (!bootFinished) {
      console.warn('[RPChess] Startup loader safety timeout');
      bootFinished = true;
      hide(++generation);
    }
  }, 20000);
}
