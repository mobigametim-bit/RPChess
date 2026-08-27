import { PIECE_LABELS, PIECE_GLYPHS, STATUS_LABELS } from './roster-data.mjs';
import { createRun, readRun, writeRun } from './run-persistence.mjs';

const menu = document.querySelector('[data-reboot-foundation]');
const classicScreen = document.querySelector('[data-classic-screen]');
const rosterScreen = document.querySelector('[data-roster-screen]');
const continueButton = document.querySelector('[data-continue-run]');
const journeyButton = document.querySelector('[data-roster-travel]');
const rosterList = document.querySelector('[data-roster-list]');
const rosterDetail = document.querySelector('[data-roster-detail]');
const rosterCount = document.querySelector('[data-roster-count]');
const filterButtons = [...document.querySelectorAll('[data-roster-filter]')];

let activeRun = readRun();
let activeFilter = 'all';

function audio() { return globalThis.RPChessRebootAudio; }

function setScene(target) {
  if (menu) menu.hidden = target !== 'menu';
  if (classicScreen) classicScreen.hidden = target !== 'classic';
  if (rosterScreen) rosterScreen.hidden = target !== 'roster';
  document.body.classList.toggle('roster-active', target === 'roster');
  if (target === 'roster') window.scrollTo(0, 0);
}

function updateContinueState() {
  activeRun = readRun();
  if (!continueButton) return;
  const enabled = Boolean(activeRun);
  continueButton.disabled = !enabled;
  continueButton.setAttribute('aria-disabled', enabled ? 'false' : 'true');
}

function filteredRoster() {
  const roster = activeRun?.roster || [];
  if (activeFilter === 'all') return roster;
  if (activeFilter === 'healthy') return roster.filter((character) => character.status === 'healthy');
  if (activeFilter === 'wounded') return roster.filter((character) => character.status === 'wounded');
  if (activeFilter === 'dead') return roster.filter((character) => character.status === 'dead');
  return roster;
}

function selectedCharacter() {
  if (!activeRun) return null;
  return activeRun.roster.find((character) => character.id === activeRun.selectedCharacterId) || activeRun.roster[0] || null;
}

function statusNote(character) {
  if (character.status === 'wounded') return 'Не может участвовать в сражениях до лечения.';
  if (character.status === 'dead') return 'Погиб в текущем забеге и остаётся в памяти отряда.';
  return '';
}

function renderDetail() {
  if (!rosterDetail) return;
  const character = selectedCharacter();
  rosterDetail.replaceChildren();
  if (!character) return;

  const media = document.createElement('div');
  media.className = 'roster-detail__media';
  const portrait = document.createElement('img');
  portrait.className = 'roster-detail__portrait';
  portrait.src = character.portrait;
  portrait.alt = character.name;
  media.append(portrait);

  const body = document.createElement('div');
  body.className = 'roster-detail__body';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'roster-kicker';
  eyebrow.textContent = character.isRunKing ? 'КОРОЛЬ ОТРЯДА' : 'ИМЕННАЯ ФИГУРА';
  const title = document.createElement('h2');
  title.textContent = character.name;
  const facts = document.createElement('div');
  facts.className = 'roster-detail__facts';
  const role = document.createElement('span');
  role.innerHTML = `<strong>${PIECE_GLYPHS[character.pieceType] || ''} ${PIECE_LABELS[character.pieceType] || character.pieceType}</strong><small>${character.origin}</small>`;
  const cost = document.createElement('span');
  cost.innerHTML = `<small>КОМАНДНЫЕ ОЧКИ</small><strong>${character.commandCost}</strong>`;
  facts.append(role, cost);

  const status = document.createElement('div');
  status.className = `roster-status roster-status--${character.status}`;
  status.textContent = STATUS_LABELS[character.status] || character.status;
  const description = document.createElement('p');
  description.className = 'roster-detail__description';
  description.textContent = character.description;

  body.append(eyebrow, title, facts, status);
  const noteText = statusNote(character);
  if (noteText) {
    const note = document.createElement('p');
    note.className = 'roster-status-note';
    note.textContent = noteText;
    body.append(note);
  }
  body.append(description);
  rosterDetail.append(media, body);
}

function cardFor(character) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `roster-card roster-card--${character.status}`;
  button.dataset.rosterCard = character.id;
  if (character.isRunKing) button.dataset.runKing = 'true';
  button.setAttribute('aria-pressed', activeRun?.selectedCharacterId === character.id ? 'true' : 'false');
  button.setAttribute('aria-label', `${character.name}, ${PIECE_LABELS[character.pieceType]}, ${STATUS_LABELS[character.status]}`);

  const artWrap = document.createElement('span');
  artWrap.className = 'roster-card__art-wrap';
  const art = document.createElement('img');
  art.className = 'roster-card__art';
  art.src = character.pieceArt;
  art.alt = '';
  art.loading = 'eager';
  artWrap.append(art);

  const glyph = document.createElement('span');
  glyph.className = 'roster-card__glyph';
  glyph.textContent = PIECE_GLYPHS[character.pieceType] || '';
  glyph.setAttribute('aria-hidden', 'true');
  const value = document.createElement('span');
  value.className = 'roster-card__value';
  value.textContent = String(character.commandCost);
  value.title = 'Командные очки';
  artWrap.append(glyph, value);

  const body = document.createElement('span');
  body.className = 'roster-card__body';
  const name = document.createElement('strong');
  name.className = 'roster-card__name';
  name.textContent = character.name;
  const meta = document.createElement('span');
  meta.className = 'roster-card__meta';
  meta.textContent = `${PIECE_LABELS[character.pieceType]} · ${character.origin}`;
  const status = document.createElement('span');
  status.className = `roster-status roster-status--${character.status}`;
  status.textContent = STATUS_LABELS[character.status];
  body.append(name, meta, status);

  button.append(artWrap, body);
  button.addEventListener('click', () => {
    audio()?.click();
    activeRun = writeRun({ ...activeRun, selectedCharacterId: character.id });
    renderRoster();
  });
  return button;
}

function renderFilters() {
  for (const button of filterButtons) {
    const filter = button.dataset.rosterFilter;
    const count = filter === 'all' ? (activeRun?.roster.length || 0) : (activeRun?.roster.filter((character) => character.status === filter).length || 0);
    button.classList.toggle('is-active', filter === activeFilter);
    button.setAttribute('aria-pressed', filter === activeFilter ? 'true' : 'false');
    const label = button.dataset.rosterFilterLabel || button.textContent.replace(/\s+\d+$/, '').trim();
    button.textContent = `${label} ${count}`;
  }
}

function renderRoster() {
  if (!activeRun || !rosterList) return;
  renderFilters();
  renderDetail();
  rosterList.replaceChildren();
  const list = filteredRoster();
  if (rosterCount) rosterCount.textContent = `${activeRun.roster.filter((character) => character.status !== 'dead').length} в строю`;
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'roster-empty';
    empty.textContent = activeFilter === 'dead' ? 'В этом забеге пока никто не погиб.' : 'Нет фигур с таким состоянием.';
    rosterList.append(empty);
    return;
  }
  for (const character of list) rosterList.append(cardFor(character));
}

function beginRun() {
  activeRun = writeRun(createRun());
  activeFilter = 'all';
  updateContinueState();
  setScene('roster');
  renderRoster();
}

function continueRun() {
  activeRun = readRun();
  if (!activeRun) {
    updateContinueState();
    return;
  }
  activeFilter = 'all';
  setScene('roster');
  renderRoster();
}

function beginJourney() {
  if (!activeRun) return;
  audio()?.click();
  setScene('menu');
  globalThis.dispatchEvent(new CustomEvent('rpchess:new-game', { detail: { source: 'roster' } }));
}

function returnToMenu() {
  audio()?.click();
  updateContinueState();
  setScene('menu');
}

filterButtons.forEach((button) => button.addEventListener('click', () => {
  audio()?.click();
  activeFilter = button.dataset.rosterFilter || 'all';
  renderRoster();
}));

document.querySelector('[data-roster-menu]')?.addEventListener('click', returnToMenu);
journeyButton?.addEventListener('click', beginJourney);
addEventListener('rpchess:run-new', beginRun);
addEventListener('rpchess:run-continue', continueRun);

updateContinueState();

globalThis.RPChessRoster = Object.freeze({
  get run() { return activeRun; },
  get filter() { return activeFilter; },
  render: renderRoster,
  beginRun,
  continueRun,
  beginJourney,
  returnToMenu
});
