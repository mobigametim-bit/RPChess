import {
  FACTIONS,
  PIECE_LABELS,
  HERO_PROFILES,
  POLITICAL_PROFILES,
  RELIC_LABELS,
  heroProfile,
  politicalProfile,
  statusLabels,
  heroPanelMarkup
} from './register-02-codex.mjs?legacy=1';
import { heroAssets, politicalAssets } from './register-02-assets.mjs';

const PIECE_GLYPHS = Object.freeze({ pawn:'♙', knight:'♘', bishop:'♗', rook:'♖', queen:'♕', king:'♔', p:'♙', n:'♘', b:'♗', r:'♖', q:'♕', k:'♔' });
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function ensureCodexStyles(document) {
  if (!document || document.getElementById('rpu-codex-style-marker')) return;
  const marker = document.createElement('style'); marker.id = 'rpu-codex-style-marker'; marker.textContent = '.rpu-codex{}'; document.head.appendChild(marker);
}
function records(section, factionId) {
  const source = section === 'politics' ? Object.values(POLITICAL_PROFILES) : Object.values(HERO_PROFILES);
  return source.filter((entry) => factionId === 'all' || entry.factionId === factionId);
}
function profileAssets(section, profile) {
  return section === 'politics' ? politicalAssets(profile.id) : heroAssets(profile.id);
}
function codexMarkup(state = {}) {
  const section = state.section === 'politics' ? 'politics' : 'heroes';
  const factionId = state.factionId || 'all';
  const list = records(section, factionId);
  const selected = list.find((entry) => entry.id === state.selectedId) || list[0] || null;
  const cards = list.map((profile) => {
    const assets = profileAssets(section, profile);
    const active = selected?.id === profile.id;
    const meta = section === 'heroes' ? `${PIECE_GLYPHS[profile.pieceType] || '♙'} · ${profile.faction}` : profile.faction;
    return `<button class="rpu-codex-person${active ? ' is-selected' : ''}" data-rpu-person="${escapeAttribute(profile.id)}"><img src="${escapeAttribute(assets?.portrait || 'generated_assets/logo_main.png')}" alt=""><span><strong>${escapeHtml(profile.name)}</strong><small>${escapeHtml(meta)}</small></span></button>`;
  }).join('');
  const factions = ['all', ...Object.keys(FACTIONS)].map((id) => `<button class="rpu-filter-chip${id === factionId ? ' is-active' : ''}" data-rpu-faction="${escapeAttribute(id)}">${id === 'all' ? 'ВСЕ ФРАКЦИИ' : escapeHtml(FACTIONS[id].label).toUpperCase()}</button>`).join('');
  let detail = '<div class="rpu-codex-empty">НЕТ ДОСТУПНЫХ ЗАПИСЕЙ</div>';
  if (selected) {
    const assets = profileAssets(section, selected);
    if (section === 'heroes') detail = `<article class="rpu-person-detail"><div class="rpu-person-detail__hero"><img src="${escapeAttribute(assets?.portrait || '')}" alt="${escapeAttribute(selected.name)}"><div class="rpu-person-detail__badge"><img src="${escapeAttribute(assets?.pieceBadge || '')}" alt=""><span>${PIECE_GLYPHS[selected.pieceType] || '♙'}</span></div></div><span class="rpu-kicker">${escapeHtml(selected.faction).toUpperCase()}</span><h2>${escapeHtml(selected.name)}</h2><div class="rpu-person-detail__facts"><span>РОЛЬ <strong>${PIECE_GLYPHS[selected.pieceType] || '♙'} ${escapeHtml(PIECE_LABELS[selected.pieceType] || selected.pieceType)}</strong></span><span>ТИП <strong>ИМЕННОЙ ГЕРОЙ</strong></span></div><div class="rpu-person-detail__ability"><img src="${escapeAttribute(assets?.abilityIcon || '')}" alt=""><div><span class="rpu-kicker">КЛЮЧЕВАЯ СПОСОБНОСТЬ</span><p>${escapeHtml(selected.brief)}</p></div></div></article>`;
    else detail = `<article class="rpu-person-detail"><div class="rpu-person-detail__hero"><img src="${escapeAttribute(assets?.portrait || '')}" alt="${escapeAttribute(selected.name)}"></div><span class="rpu-kicker">ПОЛИТИЧЕСКАЯ ФИГУРА · ${escapeHtml(selected.faction).toUpperCase()}</span><h2>${escapeHtml(selected.name)}</h2><div class="rpu-person-detail__politics"><span class="rpu-kicker">ПОЛИТИЧЕСКАЯ РОЛЬ</span><p>${escapeHtml(selected.role)}</p></div></article>`;
  }
  return `<div class="rpu-codex" role="dialog" aria-modal="true" aria-labelledby="rpu-codex-title"><div class="rpu-codex__scrim" data-rpu-codex-close></div><section class="rpu-codex__window"><header class="rpu-codex__header"><div><span class="rpu-kicker">REGISTER 02 · ЛИЧНОСТИ МИРА</span><h1 id="rpu-codex-title">КОДЕКС ЛИЧНОСТЕЙ</h1></div><button class="rpu-close" data-rpu-codex-close aria-label="Закрыть">×</button></header><nav class="rpu-codex__tabs"><button class="${section === 'heroes' ? 'is-active' : ''}" data-rpu-section="heroes">ГЕРОИ · ${Object.keys(HERO_PROFILES).length}</button><button class="${section === 'politics' ? 'is-active' : ''}" data-rpu-section="politics">ПОЛИТИКА · ${Object.keys(POLITICAL_PROFILES).length}</button></nav><div class="rpu-codex__filters">${factions}</div><div class="rpu-codex__layout"><aside class="rpu-codex__catalog"><div class="rpu-codex__catalog-head"><span>КАТАЛОГ</span><strong>${list.length}</strong></div><div class="rpu-codex__people">${cards}</div></aside><main class="rpu-codex__detail">${detail}</main></div></section></div>`;
}
function openRegister02Codex(root, initialSection = 'heroes') {
  const document = root?.ownerDocument || globalThis.document;
  if (!document) return null;
  ensureCodexStyles(document);
  const state = { section: initialSection === 'politics' ? 'politics' : 'heroes', factionId:'all', selectedId:null };
  const host = document.createElement('div');
  const close = () => { document.removeEventListener('keydown', keydown); host.remove(); };
  const render = () => {
    host.innerHTML = codexMarkup(state);
    host.querySelectorAll('[data-rpu-codex-close]').forEach((button) => button.addEventListener('click', close));
    host.querySelectorAll('[data-rpu-section]').forEach((button) => button.addEventListener('click', () => { state.section = button.dataset.rpuSection; state.factionId='all'; state.selectedId=null; render(); }));
    host.querySelectorAll('[data-rpu-faction]').forEach((button) => button.addEventListener('click', () => { state.factionId = button.dataset.rpuFaction; state.selectedId=null; render(); }));
    host.querySelectorAll('[data-rpu-person]').forEach((button) => button.addEventListener('click', () => { state.selectedId = button.dataset.rpuPerson; render(); }));
  };
  const keydown = (event) => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', keydown);
  render(); document.body.appendChild(host); return host;
}
function installRegister02Codex(root, options = {}) {
  const document = root?.ownerDocument || globalThis.document;
  if (!root || !document) return null;
  const target = root.querySelector(options.target || '.rprs__hero-copy') || root.querySelector('header') || root;
  if (target.querySelector('[data-rpu-codex-launch]')) return target.querySelector('[data-rpu-codex-launch]');
  const button = document.createElement('button'); button.type='button'; button.className='rpa-button'; button.dataset.rpuCodexLaunch=''; button.textContent=String(options.label || 'ГЕРОИ').toUpperCase(); button.addEventListener('click', () => openRegister02Codex(root, options.section || 'heroes')); target.appendChild(button); return button;
}

export { FACTIONS, PIECE_LABELS, HERO_PROFILES, POLITICAL_PROFILES, RELIC_LABELS, heroProfile, politicalProfile, statusLabels, heroPanelMarkup, codexMarkup, ensureCodexStyles, openRegister02Codex, installRegister02Codex };
