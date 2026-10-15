// Prepare only the art needed for the next scene while the current scene stays visible.
// All failures and slow networks resolve via a bounded timeout; game state is untouched.
const READY_TIMEOUT_MS = 3200;
const NOTICE_DELAY_MS = 450;
const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
let activeTransition = null;

function sceneImageUrls(roots = [], extra = []) {
  const urls = new Set();
  const add = (raw) => {
    if (typeof raw !== 'string') return;
    const path = raw.trim();
    if (path && !path.startsWith('data:') && !path.startsWith('blob:') && !path.startsWith('#'))
      urls.add(path);
  };
  for (const item of extra) add(item);
  for (const root of roots) {
    if (!root) continue;
    const elements = [root, ...root.querySelectorAll('*')];
    for (const element of elements) {
      if (element.tagName === 'IMG') add(element.currentSrc || element.getAttribute('src'));
      const style = element.getAttribute('style') || '';
      for (const match of style.matchAll(urlPattern)) add(match[1]);
      // Capture backgrounds supplied by CSS instead of explicit style properties.
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
      if (image.naturalWidth > 0 && typeof image.decode === 'function')
        image.decode().catch(() => {}).then(done);
      else done();
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

function makeOverlay() {
  const root = document.createElement('div');
  root.className = 'rpchess-scene-preparing';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  const label = document.createElement('span');
  label.className = 'rpchess-scene-preparing__label';
  label.textContent = document.documentElement.lang === 'en' ? 'Preparing…' : 'Подготовка…';
  root.append(label);
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:0 16px max(22px,env(safe-area-inset-bottom));background:transparent;pointer-events:auto;cursor:wait;';
  label.style.cssText = 'display:none;padding:10px 21px;border:1px solid rgba(226,183,99,.65);background:rgba(4,10,18,.96);color:#f5e2ad;font:600 14px/1.3 Georgia,serif;text-shadow:0 1px 2px #000;box-shadow:0 8px 30px #0008;';
  document.body.append(root);
  return { root, label };
}

// enter() remains synchronous to ensure no intermediate scene is painted.
async function showPreparedScene({ roots = [], assets = [], enter, isCurrent = () => true, timeoutMs = READY_TIMEOUT_MS } = {}) {
  if (typeof enter !== 'function') throw new TypeError('enter is required');
  if (activeTransition) {
    activeTransition.cancelled = true;
    activeTransition.cleanup();
  }
  const overlay = makeOverlay();
  const transition = { cancelled: false, cleanup: () => {} };
  activeTransition = transition;
  const notice = setTimeout(() => { overlay.label.style.display = 'block'; }, NOTICE_DELAY_MS);
  transition.cleanup = () => { clearTimeout(notice); overlay.root.remove(); };
  try {
    const urls = sceneImageUrls(roots, assets);
    const prepared = await prepareArt(urls, { timeoutMs });
    if (!transition.cancelled && isCurrent()) {
      enter();
      return { ...prepared, entered: true };
    }
    return { ...prepared, entered: false };
  } finally {
    transition.cleanup();
    if (activeTransition === transition) activeTransition = null;
  }
}

export { sceneImageUrls, prepareArt, showPreparedScene };
