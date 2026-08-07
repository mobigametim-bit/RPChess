import { RELIC_ROWS, relicProfile, relicAsset } from './register-03-relic-assets.mjs';

const COMPATIBILITY_LABELS = Object.freeze({ pawn:'Пешка', knight:'Конь', bishop:'Слон', rook:'Ладья', queen:'Ферзь', king:'Король', hero:'Герой', 'named hero':'Именной герой', any:'Любая фигура' });
const COMPATIBILITY_GLYPHS = Object.freeze({ pawn:'♙', knight:'♘', bishop:'♗', rook:'♖', queen:'♕', king:'♔', hero:'★', 'named hero':'★', any:'♔ ♕ ♖ ♗ ♘ ♙' });
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function compatibilityLabel(value) { return COMPATIBILITY_LABELS[value] || String(value || ''); }
function relicIconMarkup(relicId, options = {}) {
  const profile = relicProfile(relicId); if (!profile) return '';
  const compact = options.compact !== false;
  return `<span class="rp03-relic-chip${compact ? ' rp03-relic-chip--compact' : ''}" data-rp03-relic="${escapeAttribute(profile.id)}" title="${escapeAttribute(profile.nameRu)}"><img src="${escapeAttribute(relicAsset(profile.id))}" alt=""><span>${escapeHtml(profile.nameRu)}</span></span>`;
}
function relicChipMarkup(relicIds = [], options = {}) {
  const ids = [...new Set((relicIds || []).map(String))];
  return ids.length ? `<span class="rp03-relic-chips">${ids.map((id) => relicIconMarkup(id, options)).filter(Boolean).join('')}</span>` : '<span class="rp03-relic-empty">Нет</span>';
}
function filteredRelics(query = '', compatibility = 'all', priority = 'all') {
  const normalized = String(query || '').trim().toLocaleLowerCase('ru');
  return RELIC_ROWS.filter((record) => {
    if (compatibility !== 'all' && !record.compatibility.includes(compatibility)) return false;
    if (priority !== 'all' && record.priority !== priority) return false;
    return !normalized || [record.id,record.slug,record.nameRu,record.nameEn,record.briefEn,...record.compatibility].join(' ').toLocaleLowerCase('ru').includes(normalized);
  });
}
function relicCardMarkup(record, selectedId = null) {
  return `<button class="rpu-relic-list-card${record.id === selectedId ? ' is-selected' : ''}" data-rpu-relic="${escapeAttribute(record.id)}"><img src="${escapeAttribute(record.path)}" alt=""><span><small>${escapeHtml(record.priority)} · ${record.compatibility.map(compatibilityLabel).join(', ')}</small><strong>${escapeHtml(record.nameRu)}</strong><em>${escapeHtml(record.nameEn)}</em></span></button>`;
}
function relicCodexMarkup(state = {}) {
  const query=state.query || ''; const compatibility=state.compatibility || 'all'; const priority=state.priority || 'all'; const records=filteredRelics(query,compatibility,priority); const selected=records.find((entry)=>entry.id===state.selectedId) || records[0] || null;
  const compatibilityValues=[...new Set(RELIC_ROWS.flatMap((record)=>record.compatibility))].sort();
  const detail = selected ? `<article class="rpu-relic-detail"><img class="rpu-relic-detail__art" src="${escapeAttribute(selected.path)}" alt="${escapeAttribute(selected.nameRu)}"><span class="rpu-kicker">${escapeHtml(selected.priority)} · ${escapeHtml(selected.status)}</span><h2>${escapeHtml(selected.nameRu)}</h2><small>${escapeHtml(selected.nameEn)}</small><section><span class="rpu-kicker">ЭФФЕКТ</span><p>${escapeHtml(selected.briefEn)}</p></section><section><span class="rpu-kicker">СОВМЕСТИМОСТЬ</span><div class="rpu-relic-compat">${selected.compatibility.map((value)=>`<span title="${escapeAttribute(compatibilityLabel(value))}">${escapeHtml(COMPATIBILITY_GLYPHS[value] || '◆')}<small>${escapeHtml(compatibilityLabel(value))}</small></span>`).join('')}</div></section><p class="rpu-relic-note">Реликвия отображается теми же данными в наградах, сервисах и карточках героев.</p></article>` : '<div class="rpu-codex-empty">НИЧЕГО НЕ НАЙДЕНО</div>';
  return `<div class="rpu-codex rpu-relic-codex" role="dialog" aria-modal="true" aria-labelledby="rpu-relic-title"><div class="rpu-codex__scrim" data-rpu-relic-close></div><section class="rpu-codex__window"><header class="rpu-codex__header"><div><span class="rpu-kicker">REGISTER 03 · ${RELIC_ROWS.length}/${RELIC_ROWS.length}</span><h1 id="rpu-relic-title">КОДЕКС РЕЛИКВИЙ</h1><p>Все найденные реликвии и их совместимость.</p></div><button class="rpu-close" data-rpu-relic-close aria-label="Закрыть">×</button></header><div class="rpu-relic-filters"><label><span>ПОИСК</span><input type="search" data-rpu-relic-search value="${escapeAttribute(query)}" placeholder="Название или эффект"></label><label><span>СОВМЕСТИМОСТЬ</span><select data-rpu-relic-compatibility><option value="all">ВСЕ ФИГУРЫ</option>${compatibilityValues.map((value)=>`<option value="${escapeAttribute(value)}" ${value===compatibility?'selected':''}>${escapeHtml(compatibilityLabel(value)).toUpperCase()}</option>`).join('')}</select></label><label><span>ПРИОРИТЕТ</span><select data-rpu-relic-priority><option value="all">ВСЕ</option><option value="P0" ${priority==='P0'?'selected':''}>P0</option><option value="P1" ${priority==='P1'?'selected':''}>P1</option></select></label><output>${records.length} НАЙДЕНО</output></div><div class="rpu-codex__layout"><aside class="rpu-codex__catalog"><div class="rpu-codex__catalog-head"><span>КАТАЛОГ</span><strong>${records.length}</strong></div><div class="rpu-relic-list">${records.map((record)=>relicCardMarkup(record,selected?.id)).join('')}</div></aside><main class="rpu-codex__detail">${detail}</main></div></section></div>`;
}
function ensureRegister03Styles(document) { if (!document || document.getElementById('rpu-relic-style-marker')) return; const marker=document.createElement('style'); marker.id='rpu-relic-style-marker'; marker.textContent='.rpu-relic-codex{}'; document.head.appendChild(marker); }
function openRegister03RelicCodex(root = globalThis.document?.body) {
  const document=root?.ownerDocument || globalThis.document; if(!document) return null; ensureRegister03Styles(document);
  const state={ query:'', compatibility:'all', priority:'all', selectedId:null }; const host=document.createElement('div');
  const close=()=>{ document.removeEventListener('keydown',keydown); host.remove(); };
  const render=()=>{ host.innerHTML=relicCodexMarkup(state); host.querySelectorAll('[data-rpu-relic-close]').forEach((button)=>button.addEventListener('click',close)); const search=host.querySelector('[data-rpu-relic-search]'); search?.addEventListener('input',(event)=>{ state.query=event.target.value; state.selectedId=null; render(); host.querySelector('[data-rpu-relic-search]')?.focus(); }); host.querySelector('[data-rpu-relic-compatibility]')?.addEventListener('change',(event)=>{ state.compatibility=event.target.value; state.selectedId=null; render(); }); host.querySelector('[data-rpu-relic-priority]')?.addEventListener('change',(event)=>{ state.priority=event.target.value; state.selectedId=null; render(); }); host.querySelectorAll('[data-rpu-relic]').forEach((button)=>button.addEventListener('click',()=>{ state.selectedId=button.dataset.rpuRelic; render(); })); };
  const keydown=(event)=>{ if(event.key==='Escape') close(); }; document.addEventListener('keydown',keydown); render(); document.body.appendChild(host); host.querySelector('[data-rpu-relic-search]')?.focus(); return host;
}
function installRegister03RelicCodex(root, options={}) { const document=root?.ownerDocument || globalThis.document; if(!root||!document) return null; const target=root.querySelector(options.target || 'header') || root; if(target.querySelector('[data-rpu-relic-launch]')) return target.querySelector('[data-rpu-relic-launch]'); const button=document.createElement('button'); button.type='button'; button.className='rpa-button'; button.dataset.rpuRelicLaunch=''; button.textContent=String(options.label || `РЕЛИКВИИ · ${RELIC_ROWS.length}`).toUpperCase(); button.addEventListener('click',()=>openRegister03RelicCodex(root)); target.appendChild(button); return button; }

export { COMPATIBILITY_LABELS, compatibilityLabel, relicIconMarkup, relicChipMarkup, filteredRelics, relicCardMarkup, relicCodexMarkup, ensureRegister03Styles, openRegister03RelicCodex, installRegister03RelicCodex };
