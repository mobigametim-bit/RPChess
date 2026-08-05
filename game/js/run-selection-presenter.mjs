import { validateRunSelectionSnapshot } from './run-selection-client.mjs';
import { regionAssets } from './register-01-assets.mjs';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function pieceSymbol(pieceType) {
  return Object.freeze({ pawn: '♙', knight: '♘', bishop: '♗', rook: '♖', queen: '♕', king: '♔' })[pieceType] || '♟';
}

function assetMarkup(path, label, fallback = '♟', modifier = '') {
  const classes = ['rprs__media', modifier].filter(Boolean).join(' ');
  const image = path
    ? `<img class="rprs__art" src="${escapeHtml(path)}" alt="${escapeHtml(label)}" data-rprs-image>`
    : '';
  return `<span class="${classes}" data-rprs-media><span class="rprs__fallback" aria-hidden="true">${escapeHtml(fallback)}</span>${image}</span>`;
}

function kingCard(item) {
  return `
    <button class="rprs__card${item.selected ? ' is-selected' : ''}" data-select-king="${escapeHtml(item.id)}" aria-pressed="${item.selected}">
      ${assetMarkup(item.assets?.portrait, item.label, '♚', 'rprs__media--portrait')}
      <strong>${escapeHtml(item.label)}</strong>
    </button>`;
}

function doctrineCard(item) {
  return `
    <button class="rprs__card${item.selected ? ' is-selected' : ''}" data-select-doctrine="${escapeHtml(item.id)}" aria-pressed="${item.selected}" ${item.compatible ? '' : 'disabled'}>
      ${assetMarkup(item.assets?.emblem, item.label, '✦', 'rprs__media--icon')}
      <strong>${escapeHtml(item.label)}</strong>
    </button>`;
}

function heroCard(item) {
  return `
    <button class="rprs__card${item.selected ? ' is-selected' : ''}" data-toggle-hero="${escapeHtml(item.id)}" aria-pressed="${item.selected}">
      ${assetMarkup(item.assets?.portrait, item.label, pieceSymbol(item.pieceType), 'rprs__media--portrait')}
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.pieceType)}</span>
    </button>`;
}

function selectionMarkup(snapshot) {
  const selection = snapshot.selection;
  const region = regionAssets(selection.region.id);
  return `
    <main class="rprs" aria-busy="false">
      <header class="rprs__hero">
        ${assetMarkup(region?.mapBanner, selection.region.label, '♜', 'rprs__media--banner')}
        <div class="rprs__hero-shade" aria-hidden="true"></div>
        <div class="rprs__hero-copy">
          ${assetMarkup(region?.crest, '', '♜', 'rprs__media--crest')}
          <div><small>Регион</small><h1>${escapeHtml(selection.region.label)}</h1></div>
          <div class="rprs__counter">Отряд: ${selection.selectedHeroIds.length}/${selection.heroLimit}</div>
        </div>
      </header>
      <div class="rprs__error" role="alert" aria-live="assertive" hidden></div>
      <section aria-labelledby="rprs-kings"><h2 id="rprs-kings">Король</h2><div class="rprs__grid">${selection.kings.map(kingCard).join('')}</div></section>
      <section aria-labelledby="rprs-doctrines"><h2 id="rprs-doctrines">Доктрина</h2><div class="rprs__grid">${selection.doctrines.map(doctrineCard).join('')}</div></section>
      <section aria-labelledby="rprs-heroes"><h2 id="rprs-heroes">Именные герои</h2><div class="rprs__grid rprs__grid--heroes">${selection.heroes.map(heroCard).join('')}</div></section>
      <footer class="rprs__footer">
        <button class="rprs__launch" data-lock-selection ${selection.canLock ? '' : 'disabled'}>Начать поход</button>
      </footer>
    </main>`;
}

function initializeAssetFallbacks(root) {
  for (const media of root.querySelectorAll('[data-rprs-media]')) {
    const image = media.querySelector('[data-rprs-image]');
    if (!image) {
      media.classList.add('is-error');
      continue;
    }
    const loaded = () => media.classList.add('is-loaded');
    const failed = () => media.classList.add('is-error');
    image.addEventListener('load', loaded, { once: true });
    image.addEventListener('error', failed, { once: true });
    if (image.complete) {
      if (image.naturalWidth > 0) loaded();
      else failed();
    }
  }
}

class RunSelectionPresenter {
  constructor(options = {}) {
    if (!options.root) throw new Error('RunSelectionPresenter requires root');
    if (!options.client) throw new Error('RunSelectionPresenter requires client');
    this.root = options.root;
    this.client = options.client;
    this.onReady = typeof options.onReady === 'function' ? options.onReady : null;
    this.client.addEventListener('snapshot', (event) => this.render(event.detail));
    this.client.addEventListener('pending', (event) => this.setPending(event.detail.pending));
    this.client.addEventListener('error', (event) => this.setError(event.detail.error));
    this.client.addEventListener('ready', (event) => this.onReady?.(event.detail));
  }

  mount(snapshot = this.client.getSnapshot()) {
    if (!snapshot) throw new Error('run selection snapshot is required');
    this.render(snapshot);
    return this;
  }

  setPending(pending) {
    const main = this.root.querySelector('.rprs');
    if (main) main.setAttribute('aria-busy', String(Boolean(pending)));
    for (const button of this.root.querySelectorAll('button')) button.toggleAttribute('data-pending', Boolean(pending));
  }

  setError(error) {
    const element = this.root.querySelector('.rprs__error');
    if (!element) return;
    element.hidden = !error;
    element.textContent = error ? String(error.message || error) : '';
  }

  render(snapshotInput) {
    const snapshot = validateRunSelectionSnapshot(snapshotInput);
    if (snapshot.status === 'ready') {
      this.root.innerHTML = `<div class="rprs__ready" role="status"><span>♛</span><strong>Поход подготовлен</strong></div>`;
      return;
    }
    this.root.innerHTML = selectionMarkup(snapshot);
    initializeAssetFallbacks(this.root);
    for (const button of this.root.querySelectorAll('[data-select-king]')) {
      button.addEventListener('click', () => this.client.dispatch({ type: 'SelectKing', kingId: button.dataset.selectKing }).catch(() => {}));
    }
    for (const button of this.root.querySelectorAll('[data-select-doctrine]')) {
      button.addEventListener('click', () => this.client.dispatch({ type: 'SelectDoctrine', doctrineId: button.dataset.selectDoctrine }).catch(() => {}));
    }
    for (const button of this.root.querySelectorAll('[data-toggle-hero]')) {
      button.addEventListener('click', () => this.client.dispatch({ type: 'ToggleHero', heroId: button.dataset.toggleHero }).catch(() => {}));
    }
    this.root.querySelector('[data-lock-selection]')?.addEventListener('click', () => this.client.dispatch({ type: 'LockSelection' }).catch(() => {}));
  }
}

export {
  escapeHtml,
  pieceSymbol,
  assetMarkup,
  kingCard,
  doctrineCard,
  heroCard,
  selectionMarkup,
  initializeAssetFallbacks,
  RunSelectionPresenter
};
