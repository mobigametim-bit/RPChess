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
const aftermathResult = document.querySelector('[data-aftermath-result]');
const aftermathText = document.querySelector('[data-aftermath-text]');
const aftermathSurvivors = document.querySelector('[data-aftermath-survivors]');
const aftermathWounded = document.querySelector('[data-aftermath-wounded]');
const aftermathDead = document.querySelector('[data-aftermath-dead]');
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

function audio() { return globalThis.RPChessRebootAudio; }

function showOnly(target) {
  if (menu) menu.hidden = target !== 'menu';
  if (rosterScreen) rosterScreen.hidden = target !== 'roster';
  if (classicScreen) classicScreen.hidden = target !== 'classic';
  if (skirmishScreen) skirmishScreen.hidden = target !== 'skirmish';
  if (aftermathScreen) aftermathScreen.hidden = target !== 'aftermath';
  document.body.classList.toggle('skirmish-active', target === 'skirmish' || target === 'aftermath');
  if (target !== 'classic') document.body.classList.remove('classic-chess-active');
  window.scrollTo({ top: 0, behavior: 'auto' });
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
  clearTimeout(finalizeTimer);
  setNotice('');
  renderEncounter();
  renderComposition();
  showOnly('skirmish');
}

function returnToRoster() {
  audio()?.click?.();
  showOnly('menu');
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));
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
  clearTimeout(finalizeTimer);
  audio()?.click?.();
  skirmishScreen.hidden = true;
  document.body.classList.remove('skirmish-active');
  globalThis.RPChessClassicChess?.newGame(battlePlan.fen, {
    mode: 'ai',
    playerColor: 'w',
    aiElo: encounter.aiElo
  });
  const mode = document.querySelector('[data-game-mode]');
  if (mode) mode.textContent = `Стычка · ${encounter.label} · Тактика: ${encounter.tactic}`;
}

function showWoundToast(id) {
  if (!toast || !activeRun) return;
  const character = activeRun.roster.find((item) => item.id === id);
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
      identityBySquare.delete(capturedSquare);
      const character = activeRun?.roster.find((item) => item.id === id);
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
  const dead = chosen.filter((character) => character.status === 'dead');
  const victory = status?.type === 'checkmate' && status.winner === 'w';
  const defeat = status?.type === 'checkmate' && status.winner === 'b';
  if (aftermathResult) aftermathResult.textContent = victory ? 'ПОБЕДА' : defeat ? 'ПОРАЖЕНИЕ' : 'НИЧЬЯ';
  if (aftermathText) aftermathText.textContent = defeat
    ? 'Хранитель Клятвы погиб. Этот забег завершён.'
    : wounded.length
      ? 'Стычка окончена. Раненые бойцы больше не смогут участвовать до лечения.'
      : 'Стычка окончена. Отряд сохранил боеспособность.';
  renderCharacterList(aftermathSurvivors, survivors, 'Нет невредимых участников.');
  renderCharacterList(aftermathWounded, wounded, 'Никто не получил тяжёлых ранений.');
  renderCharacterList(aftermathDead, dead, 'В этой стычке никто не погиб.');
  if (aftermathButton) aftermathButton.textContent = activeRun.ended ? 'Главное меню' : 'Вернуться к отряду';
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
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
  if (classicScreen) classicScreen.hidden = true;
  renderAftermath(status);
  showOnly('aftermath');
}

function leaveAftermath() {
  audio()?.click?.();
  const ended = Boolean(activeRun?.ended);
  battlePlan = null;
  identityBySquare = new Map();
  capturedIds = new Set();
  processedMoves = 0;
  clearTimeout(finalizeTimer);
  finalizeTimer = null;
  if (ended) {
    showOnly('menu');
    globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'));
    return;
  }
  showOnly('menu');
  globalThis.dispatchEvent(new CustomEvent('rpchess:run-continue'));
}

startButton?.addEventListener('click', startBattle);
document.querySelector('[data-skirmish-back]')?.addEventListener('click', returnToRoster);
aftermathButton?.addEventListener('click', leaveAftermath);
addEventListener('rpchess:skirmish-open', openSkirmish);

if (board && typeof MutationObserver !== 'undefined') {
  new MutationObserver(syncBattleFromChess).observe(board, { childList: true, subtree: true });
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
