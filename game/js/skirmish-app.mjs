import { PIECE_GLYPHS, PIECE_LABELS, STATUS_LABELS } from './roster-data.mjs';
import { readRun, writeRun } from './run-persistence.mjs';
import {
  MAX_SKIRMISH_PIECES,
  MAX_SKIRMISH_POINTS,
  applyBattleOutcome,
  createBattlePlan,
  createEncounter,
  defaultCombatSelection,
  placeArmy,
  selectionSummary,
  validateSelection
} from './skirmish-core.mjs';

const menu = document.querySelector('[data-reboot-foundation]');
const rosterScreen = document.querySelector('[data-roster-screen]');
const classicScreen = document.querySelector('[data-classic-screen]');
const skirmishScreen = document.querySelector('[data-skirmish-screen]');
const aftermathScreen = document.querySelector('[data-skirmish-aftermath]');
const encounterTitle = document.querySelector('[data-skirmish-title]');
const encounterStars = document.querySelector('[data-skirmish-stars]');
const encounterThreat = document.querySelector('[data-skirmish-threat]');
const encounterDescription = document.querySelector('[data-skirmish-description]');
const availableRoot = document.querySelector('[data-skirmish-available]');
const selectedRoot = document.querySelector('[data-skirmish-selected]');
const formationRoot = document.querySelector('[data-skirmish-formation]');
const pieceCounter = document.querySelector('[data-skirmish-piece-count]');
const pointCounter = document.querySelector('[data-skirmish-point-count]');
const startButton = document.querySelector('[data-skirmish-start]');
const notice = document.querySelector('[data-skirmish-notice]');
const toast = document.querySelector('[data-skirmish-toast]');
const board = document.querySelector('[data-chess-board]');
const classicNewButton = document.querySelector('[data-classic-new]');
const classicMenuButton = document.querySelector('[data-classic-menu]');
const aftermathResult = document.querySelector('[data-aftermath-result]');
const aftermathText = document.querySelector('[data-aftermath-text]');
const aftermathSurvivors = document.querySelector('[data-aftermath-survivors]');
const aftermathWounded = document.querySelector('[data-aftermath-wounded]');
const aftermathDead = document.querySelector('[data-aftermath-dead]');
const aftermathDeadSection = aftermathDead?.closest('section') || null;
const aftermathButton = document.querySelector('[data-aftermath-continue]');

let activeRun = null;
let encounter = null;
let selectedIds = new Set();
let battlePlan = null;
let identityBySquare = new Map();
let capturedIds = new Set();
let processedMoves = 0;
let battleFinalized = false;
let finalizeTimer = null;
let toastTimer = null;
let lastCapturedVisual = null;
let runEndScreen = null;

if (aftermathDeadSection) aftermathDeadSection.hidden = true;

function audio() { return globalThis.RPChessRebootAudio; }

function characterForId(id) {
  return activeRun?.roster?.find((character) => character.id === id) || null;
}

function ensureRunEndScreen() {
  if (runEndScreen) return runEndScreen;
  const root = document.createElement('main');
  root.className = 'skirmish-aftermath skirmish-run-end';
  root.dataset.skirmishRunEnd = '';
  root.setAttribute('aria-label', 'Итоги завершённого забега');
  root.hidden = true;

  const shell = document.createElement('div');
  shell.className = 'skirmish-aftermath-shell';
  const logo = document.createElement('img');
  logo.className = 'skirmish-logo';
  logo.src = 'generated_assets/title_wordmark.png';
  logo.alt = 'RPChess';

  const panel = document.createElement('section');
  panel.className = 'skirmish-aftermath-panel ui-panel-safe';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'reboot-eyebrow';
  eyebrow.textContent = 'ЗАБЕГ ЗАВЕРШЁН';
  const title = document.createElement('h1');
  title.dataset.runEndTitle = '';
  title.textContent = 'КОРОЛЬ ПОГИБ';
  const text = document.createElement('p');
  text.dataset.runEndText = '';

  const columns = document.createElement('div');
  columns.className = 'skirmish-aftermath-columns';
  for (const [label, key] of [['Стычек завершено', 'skirmishes'], ['Сохранили строй', 'healthy'], ['Тяжело ранены', 'wounded']]) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = label;
    const value = document.createElement('div');
    value.className = 'skirmish-aftermath-empty';
    value.dataset.runEndMetric = key;
    section.append(heading, value);
    columns.append(section);
  }

  const button = document.createElement('button');
  button.className = 'reboot-button reboot-button--primary skirmish-aftermath-button';
  button.type = 'button';
  button.dataset.runEndContinue = '';
  button.textContent = 'Главное меню';
  button.addEventListener('click', leaveRunEnd);

  panel.append(eyebrow, title, text, columns, button);
  shell.append(logo, panel);
  root.append(shell);
  document.querySelector('#app')?.append(root);
  runEndScreen = root;
  return root;
}

function showOnly(target) {
  if (menu) menu.hidden = target !== 'menu';
  if (rosterScreen) rosterScreen.hidden = target !== 'roster';
  if (classicScreen) classicScreen.hidden = target !== 'classic';
  if (skirmishScreen) skirmishScreen.hidden = target !== 'skirmish';
  if (aftermathScreen) aftermathScreen.hidden = target !== 'aftermath';
  if (runEndScreen) runEndScreen.hidden = target !== 'runEnd';
  document.body.classList.toggle('skirmish-active', target === 'skirmish' || target === 'aftermath' || target === 'runEnd');
  if (target !== 'classic') document.body.classList.remove('classic-chess-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function setBattleNavigationLocked(locked) {
  for (const button of [classicNewButton, classicMenuButton]) {
    if (!button) continue;
    button.hidden = Boolean(locked);
    button.setAttribute('aria-hidden', locked ? 'true' : 'false');
  }
}

function setNotice(text = '') {
  if (!notice) return;
  notice.textContent = text;
  notice.hidden = !text;
}

function selectionReason(result) {
  switch (result?.reason) {
    case 'king_unavailable': return 'Король недоступен. Забег не может продолжаться.';
    case 'king_required': return 'Король обязан участвовать в каждой стычке.';
    case 'piece_limit': return `Лимит ${MAX_SKIRMISH_PIECES} фигур.`;
    case 'point_limit': return `Лимит ${MAX_SKIRMISH_POINTS} командных очков.`;
    case 'character_unavailable': return 'Эта фигура сейчас не может участвовать в бою.';
    default: return 'Состав нельзя использовать в этой стычке.';
  }
}

function currentSummary() {
  return selectionSummary(activeRun?.roster || [], [...selectedIds]);
}

function encounterForRun(run) {
  const count = Number.isInteger(run?.skirmishCount) ? run.skirmishCount : 0;
  const stars = Math.min(5, 1 + Math.floor(count / 2));
  return createEncounter({ seed: `${run.id}:skirmish:${count + 1}`, stars });
}

function renderEncounter() {
  if (!encounter) return;
  if (encounterTitle) encounterTitle.textContent = encounter.label;
  if (encounterStars) {
    encounterStars.textContent = `${'★'.repeat(encounter.stars)}${'☆'.repeat(5 - encounter.stars)}`;
    encounterStars.setAttribute('aria-label', `Сложность ${encounter.stars} из 5`);
  }
  if (encounterThreat) encounterThreat.textContent = `Сила: примерно ${encounter.threat}`;
  if (encounterDescription) encounterDescription.textContent = encounter.description;
}

function renderCounters() {
  const summary = currentSummary();
  if (pieceCounter) pieceCounter.textContent = `${summary.count} / ${MAX_SKIRMISH_PIECES}`;
  if (pointCounter) pointCounter.textContent = `${summary.points} / ${MAX_SKIRMISH_POINTS}`;
  const validation = validateSelection(activeRun?.roster || [], [...selectedIds]);
  if (startButton) {
    startButton.disabled = !validation.ok;
    startButton.setAttribute('aria-disabled', validation.ok ? 'false' : 'true');
  }
}

function tryToggle(character) {
  if (!activeRun || character.status !== 'healthy') return;
  if (character.isRunKing) {
    setNotice('Король обязан участвовать в каждой стычке.');
    return;
  }
  const next = new Set(selectedIds);
  if (next.has(character.id)) next.delete(character.id);
  else next.add(character.id);
  const validation = validateSelection(activeRun.roster, [...next]);
  if (!validation.ok) {
    setNotice(selectionReason(validation));
    return;
  }
  selectedIds = next;
  setNotice('');
  audio()?.click?.();
  renderComposition();
}

function availableCard(character) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `skirmish-card skirmish-card--${character.status}`;
  button.dataset.skirmishCharacter = character.id;
  const selected = selectedIds.has(character.id);
  button.classList.toggle('is-selected', selected);
  button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  const unavailable = character.status !== 'healthy';
  button.disabled = unavailable;
  button.setAttribute('aria-disabled', unavailable ? 'true' : 'false');

  const art = document.createElement('img');
  art.className = 'skirmish-card__art';
  art.src = character.pieceArt;
  art.alt = '';
  const body = document.createElement('span');
  body.className = 'skirmish-card__body';
  const name = document.createElement('strong');
  name.textContent = character.name;
  const meta = document.createElement('span');
  meta.className = 'skirmish-card__meta';
  meta.textContent = `${PIECE_GLYPHS[character.pieceType] || ''} ${PIECE_LABELS[character.pieceType]} · ${character.commandCost}`;
  const state = document.createElement('span');
  state.className = `skirmish-card__status skirmish-card__status--${character.status}`;
  state.textContent = character.isRunKing
    ? '♔ КОРОЛЬ · ОБЯЗАТЕЛЕН'
    : STATUS_LABELS[character.status];
  body.append(name, meta, state);
  button.append(art, body);
  if (!unavailable) button.addEventListener('click', () => tryToggle(character));
  return button;
}

function renderAvailable() {
  if (!availableRoot || !activeRun) return;
  availableRoot.replaceChildren();
  const ordered = [...activeRun.roster].sort((a, b) => {
    const order = { healthy: 0, wounded: 1, dead: 2 };
    return order[a.status] - order[b.status];
  });
  for (const character of ordered) availableRoot.append(availableCard(character));
}

function renderSelected() {
  if (!selectedRoot || !activeRun) return;
  selectedRoot.replaceChildren();
  const summary = currentSummary();
  for (const character of summary.members) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'skirmish-selected-row';
    row.disabled = character.isRunKing;
    row.dataset.selectedCharacter = character.id;
    row.setAttribute('aria-label', character.isRunKing ? `${character.name}, король обязателен` : `Убрать ${character.name} из боевого отряда`);
    const glyph = document.createElement('span');
    glyph.className = 'skirmish-selected-row__glyph';
    glyph.textContent = PIECE_GLYPHS[character.pieceType] || '';
    const name = document.createElement('strong');
    name.textContent = character.name;
    const cost = document.createElement('span');
    cost.textContent = character.isRunKing ? 'ОБЯЗАТЕЛЕН' : String(character.commandCost);
    row.append(glyph, name, cost);
    if (!character.isRunKing) row.addEventListener('click', () => tryToggle(character));
    selectedRoot.append(row);
  }
}

function renderFormation() {
  if (!formationRoot || !activeRun) return;
  formationRoot.replaceChildren();
  const members = currentSummary().members;
  let placements = [];
  try { placements = placeArmy(members, 'w'); } catch { placements = []; }
  const bySquare = new Map(placements.map((piece) => [piece.square, piece]));
  for (const rank of ['2', '1']) {
    for (const file of 'abcdefgh') {
      const cell = document.createElement('span');
      cell.className = 'skirmish-formation-cell';
      const piece = bySquare.get(`${file}${rank}`);
      cell.textContent = piece ? (PIECE_GLYPHS[piece.pieceType] || '') : '·';
      cell.title = piece?.name || `${file}${rank}`;
      formationRoot.append(cell);
    }
  }
}

function renderComposition() {
  renderCounters();
  renderAvailable();
  renderSelected();
  renderFormation();
}

function openSkirmish() {
  activeRun = readRun();
  if (!activeRun || activeRun.ended) return;
  encounter = encounterForRun(activeRun);
  selectedIds = new Set(defaultCombatSelection(activeRun.roster));
  battlePlan = null;
  capturedIds = new Set();
  processedMoves = 0;
  battleFinalized = false;
  lastCapturedVisual = null;
  clearTimeout(finalizeTimer);
  setBattleNavigationLocked(false);
  setNotice('');
  renderEncounter();
  renderComposition();
  showOnly('skirmish');
}

function returnToRoster() {
  audio()?.click?.();
  setBattleNavigationLocked(false);
  showOnly('menu');
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));
}

function applyPersonalizedBoardArt() {
  if (!board || !activeRun || !battlePlan) return;
  for (const [square, id] of identityBySquare) {
    const character = characterForId(id);
    if (!character?.pieceArt) continue;
    const cell = board.querySelector(`[data-square="${square}"]`);
    const image = cell?.querySelector('.classic-piece');
    if (!cell || !image) continue;
    image.src = character.pieceArt;
    image.dataset.personalizedId = id;
    image.classList.add('classic-piece--personalized');
    cell.dataset.personalizedId = id;
    cell.setAttribute('aria-label', `${square}: ${character.name}, ${PIECE_LABELS[character.pieceType] || character.pieceType}`);
  }
}

function patchTransientBattleArt() {
  if (!battlePlan || !activeRun || !globalThis.RPChessClassicChess) return;
  const log = globalThis.RPChessClassicChess.moveLog || [];
  const last = log[log.length - 1];
  if (!last) return;

  for (const flyer of document.querySelectorAll('.classic-piece-flyer:not([data-skirmish-visualized])')) {
    if (last.color === 'w') {
      const id = identityBySquare.get(last.move?.to) || identityBySquare.get(last.move?.from);
      const character = characterForId(id);
      if (character?.pieceArt) {
        flyer.src = character.pieceArt;
        flyer.dataset.personalizedId = id;
      }
    }
    flyer.dataset.skirmishVisualized = '1';
  }

  for (const ghost of document.querySelectorAll('.classic-captured-ghost:not([data-skirmish-visualized])')) {
    if (last.color === 'b' && lastCapturedVisual?.logLength === log.length && lastCapturedVisual.art) {
      ghost.src = lastCapturedVisual.art;
      ghost.dataset.personalizedId = lastCapturedVisual.id;
    }
    ghost.dataset.skirmishVisualized = '1';
  }
}

function startBattle() {
  activeRun = readRun();
  if (!activeRun || activeRun.ended) return;
  const validation = validateSelection(activeRun.roster, [...selectedIds]);
  if (!validation.ok) {
    setNotice(selectionReason(validation));
    return;
  }
  battlePlan = createBattlePlan({ roster: activeRun.roster, selectedIds: [...selectedIds], encounter });
  identityBySquare = new Map(battlePlan.playerFormation.filter((piece) => piece.id).map((piece) => [piece.square, piece.id]));
  capturedIds = new Set();
  processedMoves = 0;
  battleFinalized = false;
  lastCapturedVisual = null;
  clearTimeout(finalizeTimer);
  audio()?.click?.();
  skirmishScreen.hidden = true;
  document.body.classList.remove('skirmish-active');
  setBattleNavigationLocked(true);
  globalThis.RPChessClassicChess?.newGame(battlePlan.fen, {
    mode: 'ai',
    playerColor: 'w',
    aiElo: encounter.aiElo
  });
  applyPersonalizedBoardArt();
  const mode = document.querySelector('[data-game-mode]');
  if (mode) mode.textContent = `Стычка · ${encounter.label} · Тактика: ${encounter.tactic}`;
}

function showWoundToast(id) {
  if (!toast || !activeRun) return;
  const character = characterForId(id);
  if (!character) return;
  toast.textContent = `${character.name} — ТЯЖЕЛО РАНЕН`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}

function processMove(entry) {
  if (!entry?.move || !battlePlan) return;
  const { from, to, capture } = entry.move;
  if (entry.color === 'w') {
    const id = identityBySquare.get(from);
    if (id) {
      identityBySquare.delete(from);
      identityBySquare.set(to, id);
    }
  } else if (entry.color === 'b' && entry.captured) {
    const capturedSquare = capture || to;
    const id = identityBySquare.get(capturedSquare);
    if (id) {
      const character = characterForId(id);
      lastCapturedVisual = character ? { id, art: character.pieceArt, logLength: processedMoves + 1 } : null;
      identityBySquare.delete(capturedSquare);
      if (character && !character.isRunKing) {
        capturedIds.add(id);
        showWoundToast(id);
      }
    }
  }
}

function syncBattleFromChess() {
  if (!battlePlan || battleFinalized || !globalThis.RPChessClassicChess) return;
  const log = globalThis.RPChessClassicChess.moveLog || [];
  while (processedMoves < log.length) {
    processMove(log[processedMoves]);
    processedMoves += 1;
  }
  applyPersonalizedBoardArt();
  const mode = document.querySelector('[data-game-mode]');
  if (mode && encounter) mode.textContent = `Стычка · ${encounter.label} · Тактика: ${encounter.tactic}`;
  const status = globalThis.RPChessClassicChess.snapshot()?.status;
  if (status?.over && !finalizeTimer) {
    finalizeTimer = setTimeout(() => finishBattle(status), 320);
  }
}

function renderCharacterList(root, characters, emptyText) {
  if (!root) return;
  root.replaceChildren();
  if (!characters.length) {
    const empty = document.createElement('div');
    empty.className = 'skirmish-aftermath-empty';
    empty.textContent = emptyText;
    root.append(empty);
    return;
  }
  for (const character of characters) {
    const row = document.createElement('div');
    row.className = 'skirmish-aftermath-row';
    const art = document.createElement('img');
    art.src = character.pieceArt;
    art.alt = '';
    const name = document.createElement('strong');
    name.textContent = character.name;
    const status = document.createElement('span');
    status.textContent = STATUS_LABELS[character.status] || character.status;
    row.append(art, name, status);
    root.append(row);
  }
}

function renderAftermath(status) {
  if (!activeRun || !battlePlan) return;
  const chosen = battlePlan.selectedIds.map((id) => activeRun.roster.find((character) => character.id === id)).filter(Boolean);
  const survivors = chosen.filter((character) => character.status === 'healthy');
  const wounded = chosen.filter((character) => character.status === 'wounded');
  const victory = status?.type === 'checkmate' && status.winner === 'w';
  if (aftermathResult) aftermathResult.textContent = victory ? 'ПОБЕДА' : 'НИЧЬЯ';
  if (aftermathText) aftermathText.textContent = wounded.length
    ? 'Стычка окончена. Раненые бойцы больше не смогут участвовать до лечения.'
    : 'Стычка окончена. Отряд сохранил боеспособность.';
  renderCharacterList(aftermathSurvivors, survivors, 'Нет невредимых участников.');
  renderCharacterList(aftermathWounded, wounded, 'Никто не получил тяжёлых ранений.');
  if (aftermathDead) aftermathDead.replaceChildren();
  if (aftermathDeadSection) aftermathDeadSection.hidden = true;
  if (aftermathButton) aftermathButton.textContent = 'Вернуться к отряду';
}

function renderRunEnd() {
  if (!activeRun) return;
  const root = ensureRunEndScreen();
  const king = activeRun.roster.find((character) => character.isRunKing);
  const healthy = activeRun.roster.filter((character) => !character.isRunKing && character.status === 'healthy').length;
  const wounded = activeRun.roster.filter((character) => character.status === 'wounded').length;
  const title = root.querySelector('[data-run-end-title]');
  const text = root.querySelector('[data-run-end-text]');
  if (title) title.textContent = 'КОРОЛЬ ПОГИБ';
  if (text) text.textContent = `${king?.name || 'Король'} пал в стычке. Путешествие этого отряда завершено.`;
  const values = {
    skirmishes: String(activeRun.skirmishCount || 0),
    healthy: String(healthy),
    wounded: String(wounded)
  };
  for (const metric of root.querySelectorAll('[data-run-end-metric]')) {
    metric.textContent = values[metric.dataset.runEndMetric] || '0';
  }
}

function finishBattle(status) {
  finalizeTimer = null;
  if (battleFinalized || !battlePlan) return;
  battleFinalized = true;
  const current = readRun();
  if (!current) return;
  const outcome = applyBattleOutcome(current, { capturedIds: [...capturedIds], status, playerColor: 'w' });
  activeRun = writeRun({
    ...outcome,
    skirmishCount: (Number.isInteger(current.skirmishCount) ? current.skirmishCount : 0) + 1,
    lastSkirmish: {
      ...(outcome.lastSkirmish || {}),
      encounterId: battlePlan.encounter.id,
      encounterStars: battlePlan.encounter.stars,
      playerPoints: battlePlan.playerPoints,
      enemyPoints: battlePlan.enemyPoints
    }
  });
  setBattleNavigationLocked(false);
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  if (classicScreen) classicScreen.hidden = true;
  if (activeRun.ended) {
    renderRunEnd();
    showOnly('runEnd');
    return;
  }
  renderAftermath(status);
  showOnly('aftermath');
}

function resetBattleState() {
  battlePlan = null;
  identityBySquare = new Map();
  capturedIds = new Set();
  processedMoves = 0;
  lastCapturedVisual = null;
  clearTimeout(finalizeTimer);
  finalizeTimer = null;
  setBattleNavigationLocked(false);
}

function leaveAftermath() {
  audio()?.click?.();
  resetBattleState();
  showOnly('menu');
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));
}

function leaveRunEnd() {
  audio()?.click?.();
  resetBattleState();
  showOnly('menu');
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
}

startButton?.addEventListener('click', startBattle);
document.querySelector('[data-skirmish-back]')?.addEventListener('click', returnToRoster);
aftermathButton?.addEventListener('click', leaveAftermath);
addEventListener('rpchess:skirmish-open', openSkirmish);

if (board && typeof MutationObserver !== 'undefined') {
  new MutationObserver(syncBattleFromChess).observe(board, { childList: true, subtree: true });
}

if (typeof MutationObserver !== 'undefined' && document.body) {
  new MutationObserver(() => {
    if (!battlePlan) return;
    if (!document.querySelector('.classic-piece-flyer:not([data-skirmish-visualized]),.classic-captured-ghost:not([data-skirmish-visualized])')) return;
    queueMicrotask(patchTransientBattleArt);
  }).observe(document.body, { childList: true, subtree: true });
}

globalThis.RPChessSkirmish = Object.freeze({
  open: openSkirmish,
  start: startBattle,
  get encounter() { return encounter; },
  get selectedIds() { return [...selectedIds]; },
  get battlePlan() { return battlePlan; },
  syncBattleFromChess,
  finishBattle
});