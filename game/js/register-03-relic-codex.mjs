import { RELIC_ROWS, relicProfile, relicAsset } from './register-03-relic-assets.mjs';

const COMPATIBILITY_LABELS = Object.freeze({
  pawn: 'Пешка', knight: 'Конь', bishop: 'Слон', rook: 'Ладья', queen: 'Ферзь', king: 'Король',
  hero: 'Герой', 'named hero': 'Именной герой', any: 'Любая фигура'
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function compatibilityLabel(value) {
  return COMPATIBILITY_LABELS[value] || String(value || '');
}

function relicIconMarkup(relicId, options = {}) {
  const profile = relicProfile(relicId);
  if (!profile) return '';
  const compact = options.compact !== false;
  const className = compact ? 'rp03-relic-chip rp03-relic-chip--compact' : 'rp03-relic-chip';
  return `<span class="${className}" data-rp03-relic="${escapeAttribute(profile.id)}" title="${escapeAttribute(profile.nameRu)}">
    <img src="${escapeAttribute(relicAsset(profile.id))}" alt="" loading="lazy">
    <span>${escapeHtml(profile.nameRu)}</span>
  </span>`;
}

function relicChipMarkup(relicIds = [], options = {}) {
  const ids = [...new Set((relicIds || []).map(String))];
  if (!ids.length) return '<span class="rp03-relic-empty">Нет</span>';
  return `<span class="rp03-relic-chips">${ids.map((id) => relicIconMarkup(id, options)).filter(Boolean).join('')}</span>`;
}

function filteredRelics(query = '', compatibility = 'all', priority = 'all') {
  const normalized = String(query || '').trim().toLocaleLowerCase('ru');
  return RELIC_ROWS.filter((record) => {
    if (compatibility !== 'all' && !record.compatibility.includes(compatibility)) return false;
    if (priority !== 'all' && record.priority !== priority) return false;
    if (!normalized) return true;
    return [record.id, record.slug, record.nameRu, record.nameEn, record.briefEn, ...record.compatibility]
      .join(' ')
      .toLocaleLowerCase('ru')
      .includes(normalized);
  });
}

function relicCardMarkup(record) {
  return `<article class="rp03-relic-card" data-rp03-compatibility="${escapeAttribute(record.compatibility.join(' '))}">
    <img src="${escapeAttribute(record.path)}" alt="${escapeAttribute(record.nameRu)}" loading="lazy">
    <div class="rp03-relic-card__body">
      <div class="rp03-relic-card__meta"><span>${escapeHtml(record.priority)}</span><span>${escapeHtml(record.status)}</span></div>
      <h3>${escapeHtml(record.nameRu)}</h3>
      <small>${escapeHtml(record.nameEn)}</small>
      <p>${escapeHtml(record.briefEn)}</p>
      <div class="rp03-relic-card__compatibility">${record.compatibility.map((value) => `<span>${escapeHtml(compatibilityLabel(value))}</span>`).join('')}</div>
    </div>
  </article>`;
}

function relicCodexMarkup(state = {}) {
  const query = state.query || '';
  const compatibility = state.compatibility || 'all';
  const priority = state.priority || 'all';
  const records = filteredRelics(query, compatibility, priority);
  const compatibilityValues = [...new Set(RELIC_ROWS.flatMap((record) => record.compatibility))].sort();
  return `<div class="rp03-codex" role="dialog" aria-modal="true" aria-labelledby="rp03-codex-title">
    <div class="rp03-codex__scrim" data-rp03-close></div>
    <section class="rp03-codex__window">
      <header class="rp03-codex__header">
        <div><div class="rp03-eyebrow">REGISTER 03 · ${RELIC_ROWS.length}/72</div><h2 id="rp03-codex-title">Кодекс реликвий</h2></div>
        <button type="button" class="rp03-codex__close" data-rp03-close aria-label="Закрыть">×</button>
      </header>
      <div class="rp03-codex__filters">
        <label>Поиск<input type="search" data-rp03-search value="${escapeAttribute(query)}" placeholder="Название или эффект"></label>
        <label>Совместимость<select data-rp03-compatibility><option value="all">Все</option>${compatibilityValues.map((value) => `<option value="${escapeAttribute(value)}" ${value === compatibility ? 'selected' : ''}>${escapeHtml(compatibilityLabel(value))}</option>`).join('')}</select></label>
        <label>Приоритет<select data-rp03-priority><option value="all">Все</option><option value="P0" ${priority === 'P0' ? 'selected' : ''}>P0</option><option value="P1" ${priority === 'P1' ? 'selected' : ''}>P1</option></select></label>
        <output>${records.length} реликв.</output>
      </div>
      <div class="rp03-codex__grid">${records.map(relicCardMarkup).join('') || '<p class="rp03-codex__empty">Ничего не найдено.</p>'}</div>
    </section>
  </div>`;
}

function ensureRegister03Styles(document) {
  if (!document || document.getElementById('rp03-relic-styles')) return;
  const style = document.createElement('style');
  style.id = 'rp03-relic-styles';
  style.textContent = `
    .rp03-relic-chips{display:flex;flex-wrap:wrap;gap:5px}.rp03-relic-chip{display:inline-flex;align-items:center;gap:7px;padding:5px 8px;border:1px solid #7a6435;border-radius:9px;background:#0d1727;color:#f1ddb0;line-height:1.15}.rp03-relic-chip img{width:34px;height:34px;object-fit:contain;flex:0 0 auto}.rp03-relic-chip--compact{padding:3px 5px;font-size:10px}.rp03-relic-chip--compact img{width:25px;height:25px}.rp03-relic-empty{color:#94a0b2}.rp03-codex-launch{padding:7px 11px;border:1px solid #9d8148;border-radius:999px;background:#151f31;color:#f7e7b0;font-weight:750;cursor:pointer}.rp03-codex-launch:hover{border-color:#f0c96e}.rp03-codex-launch:focus-visible{outline:3px solid #78c9ff;outline-offset:3px}
    .rp03-codex{position:fixed;z-index:1100;inset:0;display:grid;place-items:center;padding:22px;color:#f4ead6;font:15px/1.4 system-ui,sans-serif}.rp03-codex__scrim{position:absolute;inset:0;background:#02050be8;backdrop-filter:blur(8px)}.rp03-codex__window{position:relative;width:min(1360px,100%);max-height:94vh;display:grid;grid-template-rows:auto auto 1fr;overflow:hidden;border:1px solid #a98749;border-radius:20px;background:linear-gradient(145deg,#111b2c,#080e18);box-shadow:0 30px 100px #000}.rp03-codex__header{display:flex;justify-content:space-between;align-items:center;padding:19px 22px;border-bottom:1px solid #6f5b34}.rp03-codex__header h2,.rp03-relic-card h3{margin:0;font-family:Georgia,serif}.rp03-eyebrow{color:#e2bd67;font-size:11px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.rp03-codex__close{width:42px;height:42px;border:1px solid #7d6d4b;border-radius:50%;background:#1b2638;color:#fff;font-size:27px;cursor:pointer}.rp03-codex__filters{display:grid;grid-template-columns:minmax(220px,1fr) auto auto auto;gap:10px;align-items:end;padding:12px 22px}.rp03-codex__filters label{display:grid;gap:4px;color:#b9c5d6;font-size:12px}.rp03-codex__filters input,.rp03-codex__filters select{padding:9px 10px;border:1px solid #526782;border-radius:8px;background:#101b2b;color:#f4ead6}.rp03-codex__filters output{padding:9px;color:#e2bd67;font-weight:700}.rp03-codex__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:12px;overflow:auto;padding:4px 22px 24px}.rp03-relic-card{display:grid;grid-template-columns:92px minmax(0,1fr);gap:11px;padding:11px;border:1px solid #415472;border-radius:13px;background:linear-gradient(#16243a,#0d1624)}.rp03-relic-card>img{width:92px;height:92px;object-fit:contain;border-radius:10px;background:#091221}.rp03-relic-card__body{min-width:0}.rp03-relic-card h3{font-size:17px}.rp03-relic-card small{color:#9eabc0}.rp03-relic-card p{margin:6px 0;color:#bdc8d8;font-size:12px}.rp03-relic-card__meta,.rp03-relic-card__compatibility{display:flex;flex-wrap:wrap;gap:5px}.rp03-relic-card__meta span,.rp03-relic-card__compatibility span{padding:2px 5px;border:1px solid #5d6f89;border-radius:999px;color:#d8e0ed;font-size:9px}.rp03-relic-card__meta{margin-bottom:4px}.rp03-codex__empty{grid-column:1/-1;color:#b9c5d6}
    @media(max-width:760px){.rp03-codex{padding:7px}.rp03-codex__window{max-height:98vh;border-radius:12px}.rp03-codex__filters{grid-template-columns:1fr 1fr;padding:10px}.rp03-codex__grid{grid-template-columns:1fr;padding:4px 10px 16px}.rp03-relic-card{grid-template-columns:76px 1fr}.rp03-relic-card>img{width:76px;height:76px}}
  `;
  document.head.appendChild(style);
}

function openRegister03RelicCodex(root = globalThis.document?.body) {
  const document = root?.ownerDocument || globalThis.document;
  if (!document) return null;
  ensureRegister03Styles(document);
  const state = { query: '', compatibility: 'all', priority: 'all' };
  const host = document.createElement('div');
  let keydown = null;
  const close = () => {
    if (keydown) document.removeEventListener('keydown', keydown);
    host.remove();
  };
  const render = () => {
    host.innerHTML = relicCodexMarkup(state);
    host.querySelectorAll('[data-rp03-close]').forEach((button) => button.addEventListener('click', close));
    const search = host.querySelector('[data-rp03-search]');
    search?.addEventListener('input', (event) => { state.query = event.target.value; render(); host.querySelector('[data-rp03-search]')?.focus(); });
    host.querySelector('[data-rp03-compatibility]')?.addEventListener('change', (event) => { state.compatibility = event.target.value; render(); });
    host.querySelector('[data-rp03-priority]')?.addEventListener('change', (event) => { state.priority = event.target.value; render(); });
  };
  keydown = (event) => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', keydown);
  render();
  document.body.appendChild(host);
  host.querySelector('[data-rp03-search]')?.focus();
  return host;
}

function installRegister03RelicCodex(root, options = {}) {
  const document = root?.ownerDocument || globalThis.document;
  if (!root || !document) return null;
  ensureRegister03Styles(document);
  const target = root.querySelector(options.target || '.rpvs__resources') || root.querySelector('header') || root;
  if (target.querySelector('[data-rp03-codex-launch]')) return target.querySelector('[data-rp03-codex-launch]');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rp03-codex-launch';
  button.dataset.rp03CodexLaunch = '';
  button.textContent = options.label || `Реликвии · ${RELIC_ROWS.length}`;
  button.addEventListener('click', () => openRegister03RelicCodex(root));
  target.appendChild(button);
  return button;
}

function autoInstall() {
  const document = globalThis.document;
  if (!document) return;
  const install = () => {
    const root = document.querySelector('#app');
    if (root) installRegister03RelicCodex(root);
  };
  install();
  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') autoInstall();

export {
  COMPATIBILITY_LABELS,
  compatibilityLabel,
  relicIconMarkup,
  relicChipMarkup,
  filteredRelics,
  relicCardMarkup,
  relicCodexMarkup,
  ensureRegister03Styles,
  openRegister03RelicCodex,
  installRegister03RelicCodex
};
