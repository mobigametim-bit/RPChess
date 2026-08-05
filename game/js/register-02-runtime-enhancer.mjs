import { VerticalSlicePresenter } from './vertical-slice-presenter-register-02.mjs';
import {
  heroProfile,
  installRegister02Codex,
  ensureCodexStyles
} from './register-02-codex.mjs';

const ENHANCED = Symbol.for('rpchess.register02.enhanced');

function enrichSelection(root) {
  if (!root?.querySelector) return false;
  const cards = [...root.querySelectorAll('[data-toggle-hero]')];
  if (!cards.length) return false;
  ensureCodexStyles(root.ownerDocument);
  for (const card of cards) {
    const profile = heroProfile(card.dataset.toggleHero);
    if (!profile || card.querySelector('.rp02-selection-brief')) continue;
    const brief = root.ownerDocument.createElement('span');
    brief.className = 'rp02-selection-brief';
    brief.textContent = profile.brief;
    card.appendChild(brief);
  }
  installRegister02Codex(root, { target: '.rprs__hero-copy', label: 'Кодекс героев' });
  return true;
}

function upgradeRuntimePresenter(scope = globalThis) {
  const presenter = scope.RPChessVerticalSlice?.presenter;
  if (!presenter || presenter[ENHANCED]) return false;
  Object.setPrototypeOf(presenter, VerticalSlicePresenter.prototype);
  Object.defineProperty(presenter, ENHANCED, { value: true, configurable: false });
  presenter.installStyles();
  const snapshot = presenter.lastSnapshot || presenter.client?.getSnapshot?.();
  if (snapshot) presenter.render(snapshot);
  scope.RPChessRegister02 = Object.freeze({ presenter, upgradedAt: Date.now() });
  return true;
}

function startRegister02Enhancer(options = {}) {
  const document = options.document || globalThis.document;
  const root = options.root || document?.getElementById('app');
  if (!document || !root) return null;
  ensureCodexStyles(document);
  const refresh = () => {
    enrichSelection(root);
    upgradeRuntimePresenter(options.scope || globalThis);
  };
  const observer = new MutationObserver(refresh);
  observer.observe(root, { childList: true, subtree: true });
  const timer = setInterval(refresh, 250);
  refresh();
  return Object.freeze({
    refresh,
    stop() {
      observer.disconnect();
      clearInterval(timer);
    }
  });
}

if (typeof document !== 'undefined') startRegister02Enhancer();

export {
  ENHANCED,
  enrichSelection,
  upgradeRuntimePresenter,
  startRegister02Enhancer
};
