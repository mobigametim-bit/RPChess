import { PIECE_VALUES } from './roster-data.mjs';

const BATTLE_PIECE_COUNT = 16;
const BATTLE_ARMY_POINTS = 39;
const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const TYPE_CODE = Object.freeze({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' });
const SLOT_CAPACITY = Object.freeze({ king: 1, queen: 1, rook: 2, bishop: 2, knight: 2, pawn: 8 });
const TYPE_LABELS = Object.freeze({ pawn: 'Пешка', knight: 'Конь', bishop: 'Слон', rook: 'Ладья', queen: 'Ферзь', king: 'Король' });
const STANDARD_SLOTS = Object.freeze({
  w: Object.freeze({
    rook: Object.freeze(['a1', 'h1']),
    knight: Object.freeze(['b1', 'g1']),
    bishop: Object.freeze(['c1', 'f1']),
    queen: Object.freeze(['d1']),
    king: Object.freeze(['e1']),
    pawn: Object.freeze(['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2'])
  }),
  b: Object.freeze({
    rook: Object.freeze(['a8', 'h8']),
    knight: Object.freeze(['b8', 'g8']),
    bishop: Object.freeze(['c8', 'f8']),
    queen: Object.freeze(['d8']),
    king: Object.freeze(['e8']),
    pawn: Object.freeze(['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7'])
  })
});

const BATTLE_TIERS = Object.freeze({
  1: Object.freeze({ label: 'Пограничное войско', elo: 700, tactic: 'Неопытный' }),
  2: Object.freeze({ label: 'Армия Чёрного Утёса', elo: 1000, tactic: 'Осторожный' }),
  3: Object.freeze({ label: 'Железный гарнизон', elo: 1300, tactic: 'Уверенный' }),
  4: Object.freeze({ label: 'Королевская армия', elo: 1700, tactic: 'Опасный' }),
  5: Object.freeze({ label: 'Легион Чёрной Короны', elo: 2100, tactic: 'Безжалостный' })
});

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function hashSeed(input) {
  let hash = 2166136261;
  for (const char of String(input)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createBattleEncounter({ seed = 'rpchess-battle', stars = 2 } = {}) {
  const normalizedStars = clamp(Math.round(Number(stars) || 2), 1, 5);
  const tier = BATTLE_TIERS[normalizedStars];
  return Object.freeze({
    id: `battle-${hashSeed(seed).toString(36)}-${normalizedStars}`,
    seed: String(seed),
    stars: normalizedStars,
    label: tier.label,
    aiElo: tier.elo,
    tactic: tier.tactic,
    description: normalizedStars <= 2
      ? 'Впереди развёрнута полноценная армия. Победа решится по классическим шахматным правилам.'
      : normalizedStars === 3
        ? 'Опытный противник вывел полный комплект фигур и готов к открытому сражению.'
        : 'Сильная армия заняла поле. На доске не будет места для ошибки.'
  });
}

function selectedMembers(roster, selectedIds) {
  const selected = new Set(selectedIds || []);
  return (roster || []).filter((character) => selected.has(character.id));
}

function selectedTypeCounts(roster, selectedIds) {
  const counts = { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 };
  for (const character of selectedMembers(roster, selectedIds)) {
    if (Object.prototype.hasOwnProperty.call(counts, character.pieceType)) counts[character.pieceType] += 1;
  }
  return counts;
}

function validateBattleSelection(roster, selectedIds) {
  const ids = [...new Set(selectedIds || [])];
  const rosterById = new Map((roster || []).map((character) => [character.id, character]));
  const king = (roster || []).find((character) => character.isRunKing);
  if (!king) return { ok: false, reason: 'missing_king' };
  if (king.status !== 'healthy') return { ok: false, reason: 'king_unavailable' };
  if (!ids.includes(king.id)) return { ok: false, reason: 'king_required' };

  for (const id of ids) {
    const character = rosterById.get(id);
    if (!character) return { ok: false, reason: 'unknown_character', id };
    if (character.status !== 'healthy') return { ok: false, reason: 'character_unavailable', id };
    if (character.pieceType === 'king' && !character.isRunKing) return { ok: false, reason: 'invalid_king', id };
  }

  const members = selectedMembers(roster, ids);
  const typeCounts = selectedTypeCounts(roster, ids);
  for (const [pieceType, count] of Object.entries(typeCounts)) {
    if (count > SLOT_CAPACITY[pieceType]) {
      return { ok: false, reason: 'slot_limit', pieceType, count, capacity: SLOT_CAPACITY[pieceType], members, typeCounts };
    }
  }
  return { ok: true, members, typeCounts, count: members.length };
}

function defaultBattleSelection(roster) {
  const healthy = (roster || []).filter((character) => character.status === 'healthy');
  const king = healthy.find((character) => character.isRunKing);
  if (!king) return [];
  const selected = [king.id];
  const counts = { king: 1, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 };
  for (const character of healthy) {
    if (character.id === king.id || character.pieceType === 'king') continue;
    const capacity = SLOT_CAPACITY[character.pieceType] || 0;
    if ((counts[character.pieceType] || 0) >= capacity) continue;
    selected.push(character.id);
    counts[character.pieceType] = (counts[character.pieceType] || 0) + 1;
  }
  return selected;
}

function formationFor(color, roster = [], selectedIds = []) {
  const validation = color === 'w' ? validateBattleSelection(roster, selectedIds) : null;
  if (color === 'w' && !validation.ok) throw new Error(`Invalid Battle selection: ${validation.reason}`);
  const selected = color === 'w' ? validation.members : [];
  const byType = new Map();
  for (const type of Object.keys(SLOT_CAPACITY)) byType.set(type, selected.filter((character) => character.pieceType === type));

  const placements = [];
  for (const pieceType of ['rook', 'knight', 'bishop', 'queen', 'king', 'pawn']) {
    const characters = byType.get(pieceType) || [];
    const slots = STANDARD_SLOTS[color][pieceType];
    slots.forEach((square, index) => {
      const character = characters[index] || null;
      placements.push({
        id: character?.id || null,
        name: character?.name || `Временная фигура · ${TYPE_LABELS[pieceType]}`,
        pieceType,
        type: TYPE_CODE[pieceType],
        color,
        square,
        personalized: Boolean(character)
      });
    });
  }
  return placements;
}

function createBattlePlan({ roster, selectedIds, encounter } = {}) {
  const validation = validateBattleSelection(roster, selectedIds);
  if (!validation.ok) throw new Error(`Invalid Battle selection: ${validation.reason}`);
  const resolvedEncounter = encounter || createBattleEncounter();
  return {
    encounter: resolvedEncounter,
    selectedIds: validation.members.map((member) => member.id),
    participants: validation.members.map((member) => member.id),
    playerFormation: formationFor('w', roster, selectedIds),
    enemyFormation: formationFor('b'),
    fullArmyPieces: BATTLE_PIECE_COUNT,
    fullArmyPoints: BATTLE_ARMY_POINTS,
    fen: STANDARD_FEN
  };
}

function applyBattleOutcome(run, { capturedIds = [], status = null, playerColor = 'w', participantIds = [] } = {}) {
  const captured = new Set(capturedIds || []);
  const participants = [...new Set(participantIds || [])];
  const playerLostByMate = status?.type === 'checkmate' && status.winner && status.winner !== playerColor;
  let kingDied = false;
  const roster = (run?.roster || []).map((character) => {
    if (character.isRunKing && playerLostByMate) {
      kingDied = true;
      return { ...character, status: 'dead' };
    }
    if (!character.isRunKing && captured.has(character.id) && character.status === 'healthy') {
      return { ...character, status: 'wounded' };
    }
    return { ...character };
  });
  const woundedIds = roster
    .filter((character) => captured.has(character.id) && !character.isRunKing && character.status === 'wounded')
    .map((character) => character.id);
  return {
    ...run,
    roster,
    ended: Boolean(run?.ended || kingDied),
    endReason: kingDied ? 'king_dead' : (run?.endReason || null),
    lastBattle: {
      result: status?.type || 'unknown',
      winner: status?.winner || null,
      participants,
      woundedIds,
      kingDied
    }
  };
}

export {
  BATTLE_PIECE_COUNT,
  BATTLE_ARMY_POINTS,
  STANDARD_FEN,
  SLOT_CAPACITY,
  STANDARD_SLOTS,
  BATTLE_TIERS,
  createBattleEncounter,
  selectedTypeCounts,
  validateBattleSelection,
  defaultBattleSelection,
  formationFor,
  createBattlePlan,
  applyBattleOutcome
};
