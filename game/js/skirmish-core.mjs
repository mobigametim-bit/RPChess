import { PIECE_VALUES } from './roster-data.mjs';

const MAX_SKIRMISH_PIECES = 16;
const MAX_SKIRMISH_POINTS = 39;
const TYPE_CODE = Object.freeze({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' });
const CODE_TYPE = Object.freeze({ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' });
const FILES = 'abcdefgh';

const ENCOUNTER_TIERS = Object.freeze({
  1: Object.freeze({ label: 'Дорожный дозор', stars: 1, threat: '6–12', elo: 600, tactic: 'Неопытный' }),
  2: Object.freeze({ label: 'Засадный отряд', stars: 2, threat: '10–18', elo: 900, tactic: 'Осторожный' }),
  3: Object.freeze({ label: 'Закалённая стража', stars: 3, threat: '16–26', elo: 1200, tactic: 'Уверенный' }),
  4: Object.freeze({ label: 'Чёрная когорта', stars: 4, threat: '23–33', elo: 1600, tactic: 'Опасный' }),
  5: Object.freeze({ label: 'Королевская охота', stars: 5, threat: '31–39', elo: 2000, tactic: 'Безжалостный' })
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

function seededRandom(seed) {
  let value = hashSeed(seed) || 1;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function takeTravelEncounterOverride(expectedType) {
  if (typeof globalThis === 'undefined') return null;
  const override = globalThis.RPChessTravelEncounterOverride;
  if (!override || override.type !== expectedType || !override.seed) return null;
  try { delete globalThis.RPChessTravelEncounterOverride; } catch { globalThis.RPChessTravelEncounterOverride = null; }
  return override;
}

function createEncounter({ seed = 'rpchess-skirmish', stars = 2 } = {}) {
  const override = takeTravelEncounterOverride('skirmish');
  const resolvedSeed = override?.seed || seed;
  const resolvedStars = override?.stars ?? stars;
  const normalizedStars = clamp(Math.round(Number(resolvedStars) || 2), 1, 5);
  const tier = ENCOUNTER_TIERS[normalizedStars];
  return Object.freeze({
    id: `skirmish-${hashSeed(resolvedSeed).toString(36)}-${normalizedStars}`,
    seed: String(resolvedSeed),
    stars: normalizedStars,
    label: tier.label,
    threat: tier.threat,
    aiElo: tier.elo,
    tactic: tier.tactic,
    description: normalizedStars <= 2
      ? 'Небольшая вражеская группа перекрывает путь.'
      : normalizedStars === 3
        ? 'Опытный противник занял выгодную позицию впереди.'
        : 'Сильная армия ждёт открытого столкновения.'
  });
}

function selectionSummary(roster, selectedIds) {
  const selected = new Set(selectedIds || []);
  const members = (roster || []).filter((character) => selected.has(character.id));
  return {
    members,
    count: members.length,
    points: members.reduce((sum, character) => sum + (PIECE_VALUES[character.pieceType] ?? character.commandCost ?? 0), 0)
  };
}

function validateSelection(roster, selectedIds) {
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
  }
  const summary = selectionSummary(roster, ids);
  if (summary.count > MAX_SKIRMISH_PIECES) return { ok: false, reason: 'piece_limit', ...summary };
  if (summary.points > MAX_SKIRMISH_POINTS) return { ok: false, reason: 'point_limit', ...summary };
  return { ok: true, ...summary };
}

function defaultCombatSelection(roster) {
  const healthy = (roster || []).filter((character) => character.status === 'healthy');
  const king = healthy.find((character) => character.isRunKing);
  if (!king) return [];
  const selected = [king.id];
  let points = 0;
  for (const character of healthy) {
    if (character.id === king.id) continue;
    const cost = PIECE_VALUES[character.pieceType] ?? character.commandCost ?? 0;
    if (selected.length >= MAX_SKIRMISH_PIECES || points + cost > MAX_SKIRMISH_POINTS) continue;
    selected.push(character.id);
    points += cost;
  }
  return selected;
}

function slotsFor(color) {
  const home = color === 'w' ? '1' : '8';
  const front = color === 'w' ? '2' : '7';
  const mirror = (files) => color === 'w' ? files : [...files].reverse();
  return {
    king: [`e${home}`, `e${front}`],
    queen: [`d${home}`, `d${front}`, `c${home}`, `f${home}`],
    rook: mirror(['a', 'h', 'a', 'h']).map((file, index) => `${file}${index < 2 ? home : front}`),
    bishop: mirror(['c', 'f', 'c', 'f']).map((file, index) => `${file}${index < 2 ? home : front}`),
    knight: mirror(['b', 'g', 'b', 'g']).map((file, index) => `${file}${index < 2 ? home : front}`),
    pawn: mirror([...FILES]).map((file) => `${file}${front}`),
    fallback: [
      ...mirror([...FILES]).map((file) => `${file}${home}`),
      ...mirror([...FILES]).map((file) => `${file}${front}`)
    ]
  };
}

function placeArmy(army, color) {
  const slots = slotsFor(color);
  const occupied = new Set();
  const placements = [];
  const sorted = [...army].sort((a, b) => {
    if (a.pieceType === 'king') return -1;
    if (b.pieceType === 'king') return 1;
    return 0;
  });
  for (const member of sorted) {
    const type = member.pieceType || CODE_TYPE[member.type] || member.type;
    const candidates = [...(slots[type] || []), ...slots.fallback];
    const square = candidates.find((candidate) => !occupied.has(candidate));
    if (!square) throw new Error('Skirmish army does not fit into two starting ranks');
    occupied.add(square);
    placements.push({
      id: member.id || null,
      name: member.name || null,
      pieceType: type,
      type: TYPE_CODE[type] || member.type,
      color,
      square
    });
  }
  return placements;
}

function fenFromPlacements(placements, turn = 'w') {
  const board = new Map(placements.map((piece) => [piece.square, piece]));
  const ranks = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    let row = '';
    let empty = 0;
    for (const file of FILES) {
      const piece = board.get(`${file}${rank}`);
      if (!piece) { empty += 1; continue; }
      if (empty) { row += String(empty); empty = 0; }
      const code = TYPE_CODE[piece.pieceType] || piece.type;
      row += piece.color === 'w' ? code.toUpperCase() : code.toLowerCase();
    }
    if (empty) row += String(empty);
    ranks.push(row);
  }
  return `${ranks.join('/')} ${turn} - - 0 1`;
}

function generateEnemyArmy({ playerPoints = 0, playerCount = 1, encounter } = {}) {
  const resolved = encounter || createEncounter();
  const random = seededRandom(`${resolved.seed}:${resolved.stars}:${playerPoints}:${playerCount}`);
  const target = clamp(Math.round(Number(playerPoints || 0) * (0.72 + resolved.stars * 0.13) + resolved.stars * 2), 4, MAX_SKIRMISH_POINTS);
  const army = [{ id: 'enemy.king', name: 'Вражеский король', pieceType: 'king', commandCost: 0 }];
  let points = 0;
  const candidates = resolved.stars >= 4
    ? ['queen', 'rook', 'bishop', 'knight', 'pawn']
    : resolved.stars >= 2
      ? ['rook', 'bishop', 'knight', 'pawn', 'pawn']
      : ['bishop', 'knight', 'pawn', 'pawn', 'pawn'];

  let guard = 0;
  while (army.length < MAX_SKIRMISH_PIECES && points < target && guard < 200) {
    guard += 1;
    const affordable = candidates.filter((type) => points + PIECE_VALUES[type] <= target);
    if (!affordable.length) break;
    const type = affordable[Math.floor(random() * affordable.length)];
    const cost = PIECE_VALUES[type];
    army.push({ id: `enemy.${type}.${army.length}`, name: `Вражеский ${type}`, pieceType: type, commandCost: cost });
    points += cost;
  }
  return { army, points, target };
}

function createBattlePlan({ roster, selectedIds, encounter } = {}) {
  const validation = validateSelection(roster, selectedIds);
  if (!validation.ok) throw new Error(`Invalid Skirmish selection: ${validation.reason}`);
  const resolvedEncounter = encounter || createEncounter();
  const enemy = generateEnemyArmy({ playerPoints: validation.points, playerCount: validation.count, encounter: resolvedEncounter });
  const white = placeArmy(validation.members, 'w');
  const black = placeArmy(enemy.army, 'b');
  const placements = [...white, ...black];
  return {
    encounter: resolvedEncounter,
    selectedIds: validation.members.map((member) => member.id),
    playerPoints: validation.points,
    enemyPoints: enemy.points,
    playerFormation: white,
    enemyFormation: black,
    fen: fenFromPlacements(placements, 'w')
  };
}

function applyBattleOutcome(run, { capturedIds = [], status = null, playerColor = 'w' } = {}) {
  const captured = new Set(capturedIds || []);
  let kingDied = false;
  const playerLostByMate = status?.type === 'checkmate' && status.winner && status.winner !== playerColor;
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
  const woundedIds = roster.filter((character) => captured.has(character.id) && !character.isRunKing && character.status === 'wounded').map((character) => character.id);
  return {
    ...run,
    roster,
    ended: Boolean(run?.ended || kingDied),
    endReason: kingDied ? 'king_dead' : (run?.endReason || null),
    lastSkirmish: {
      result: status?.type || 'unknown',
      winner: status?.winner || null,
      woundedIds,
      kingDied
    }
  };
}

export {
  MAX_SKIRMISH_PIECES,
  MAX_SKIRMISH_POINTS,
  ENCOUNTER_TIERS,
  createEncounter,
  selectionSummary,
  validateSelection,
  defaultCombatSelection,
  placeArmy,
  fenFromPlacements,
  generateEnemyArmy,
  createBattlePlan,
  applyBattleOutcome
};
