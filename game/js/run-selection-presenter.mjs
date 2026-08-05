import { validateRunSelectionSnapshot } from './run-selection-client.mjs';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function assetMarkup(path, label) {
  if (!path) return `<div class="rprs__fallback" aria-hidden="true">♟</div>`;
  return `<img class="rprs__art" src="${escapeHtml(path)}" alt="${escapeHtml(label)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'rprs__fallback',textContent:'♟'}))">`;
}

function kingCard(item) {
  return `
    <button class="rprs__card${item.selected ? ' is-selected' : ''}" data-select-king="${escapeHtml(item.id)}" aria-pressed="${item.selected}">
      ${assetMarkup(item.assets?.portrait, item.label)}
      <strong>${escapeHtml(item.label)}</strong>
    </button>`;
}

function doctrineCard(item) {
  return `
    <button class="rprs__card${item.selected ? ' is-selected' : ''}" data-select-doctrine="${escapeHtml(item.id)}" aria-pressed="${item.selected}" ${item.compatible ? '' : 'disabled'}>
      ${assetMarkup(item.assets?.emblem, item.label)}
      <strong>${escapeHtml(item.label)}</strong>
    </button>`;
}

function heroCard(item) {
  return `
    <button class="rprs__card${item.selected ? ' is-selected' : ''}" data-toggle-hero="${escapeHtml(item.id)}" aria-pressed="${item.selected}">
      ${assetMarkup(item.assets?.portrait, item.label)}
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.pieceType)}</span>
    </button>`;
}

function selectionMarkup(snapshot) {
  const selection = snapshot.selection;
  return `
    <main class="rprs" aria-busy="false">
      <header class="rprs__header">
        <div><small>Регион</small><h1>${escapeHtml(selection.region.label)}</h1></div>
        <div class="rprs__counter">Отряд: ${selection.selectedHeroIds.length}/${selection.heroLimit}</div>
      </header>
      <section aria-labelledby="rprs-kings"><h2 id="rprs-kings">Король</h2><div class="rprs__grid">${selection.kings.map(kingCard).join('')}</div></section>
      <section aria-labelledby="rprs-doctrines"><h2 id="rprs-doctrines">Доктрина</h2><div class="rprs__grid">${selection.doctrines.map(doctrineCard).join('')}</div></section>
      <section aria-labelledby="rprs-heroes"><h2 id="rprs-heroes">Именные герои</h2><div class="rprs__grid rprs__grid--heroes">${selection.heroes.map(heroCard).join('')}</div></section>
      <footer class="rprs__footer">
        <button class="rprs__launch" data-lock-selection ${selection.canLock ? '' : 'disabled'}>Начать поход</button>
      </footer>
    </main>`;
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

  render(snapshotInput) {
    const snapshot = validateRunSelectionSnapshot(snapshotInput);
    if (snapshot.status === 'ready') {
      this.root.innerHTML = `<div class="rprs__ready" role="status"><span>♛</span><strong>Поход подготовлен</strong></div>`;
      return;
    }
    this.root.innerHTML = selectionMarkup(snapshot);
    for (const button of this.root.querySelectorAll('[data-select-king]')) button.addEventListener('click', () => this.client.dispatch({ type: 'SelectKing', kingId: button.dataset.selectKing }).catch(() => {}));
    for (const button of this.root.querySelectorAll('[data-select-doctrine]')) button.addEventListener('click', () => this.client.dispatch({ type: 'SelectDoctrine', doctrineId: button.dataset.selectDoctrine }).catch(() => {}));
    for (const button of this.root.querySelectorAll('[data-toggle-hero]')) button.addEventListener('click', () => this.client.dispatch({ type: 'ToggleHero', heroId: button.dataset.toggleHero }).catch(() => {}));
    this.root.querySelector('[data-lock-selection]')?.addEventListener('click', () => this.client.dispatch({ type: 'LockSelection' }).catch(() => {}));
  }
}

export {
  escapeHtml,
  assetMarkup,
  kingCard,
  doctrineCard,
  heroCard,
  selectionMarkup,
  RunSelectionPresenter
};
