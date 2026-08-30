import { clampStars, difficultyForStars } from './encounter-difficulty.mjs';

const PLAYER_RATING_STORAGE_KEY = 'rpchess.reboot.v1.player-rating';
const PLAYER_RATING_SCHEMA_VERSION = 1;
const STARTING_POWER = 500;
const ELO_K = 32;
const RATING_RECEIPT_LIMIT = 2048;

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

function hashSeed(input) {
  let h = 2166136261;
  for (const c of String(input)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizePower(value) {
  const numeric = Number(value);
  return Math.max(0, Number.isFinite(numeric) ? Math.round(numeric) : STARTING_POWER);
}

function threatStarsForPower(power) {
  return clampStars(Math.floor((normalizePower(power) - 400) / 200) + 1);
}

function threatForPower(power) {
  const stars = threatStarsForPower(power);
  return Object.freeze({ ...difficultyForStars(stars), stars });
}

function expectedScore(power, opponentElo) {
  const player = normalizePower(power);
  const opponent = Math.max(0, Number.isFinite(Number(opponentElo)) ? Number(opponentElo) : 0);
  return 1 / (1 + Math.pow(10, (opponent - player) / 400));
}

function normalizeResult(result) {
  const numeric = Number(result);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function ratingDelta(power, opponentElo, result, k = ELO_K) {
  return Math.round(Math.max(1, Number(k) || ELO_K) * (normalizeResult(result) - expectedScore(power, opponentElo)));
}

function defaultRating() {
  return { schemaVersion:PLAYER_RATING_SCHEMA_VERSION, power:STARTING_POWER, receipts:[] };
}

function normalizeReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || typeof receipt.id !== 'string' || !receipt.id) return null;
  if (![0, 0.5, 1].includes(receipt.result)) return null;
  if (![receipt.before, receipt.after, receipt.delta, receipt.opponentElo].every(Number.isFinite)) return null;
  return {
    id:receipt.id,
    before:Math.round(receipt.before),
    after:Math.round(receipt.after),
    delta:Math.round(receipt.delta),
    opponentElo:Math.round(receipt.opponentElo),
    result:receipt.result
  };
}

function readPlayerRating(storage = null) {
  const target = resolveStorage(storage);
  if (!target) return defaultRating();
  try {
    const parsed = JSON.parse(target.getItem(PLAYER_RATING_STORAGE_KEY) || 'null');
    if (!parsed || parsed.schemaVersion !== PLAYER_RATING_SCHEMA_VERSION) return defaultRating();
    const receipts = Array.isArray(parsed.receipts) ? parsed.receipts.map(normalizeReceipt).filter(Boolean).slice(-RATING_RECEIPT_LIMIT) : [];
    return { schemaVersion:PLAYER_RATING_SCHEMA_VERSION, power:normalizePower(parsed.power), receipts };
  } catch {
    return defaultRating();
  }
}

function writePlayerRating(profile, storage = null) {
  const target = resolveStorage(storage);
  const next = {
    schemaVersion:PLAYER_RATING_SCHEMA_VERSION,
    power:normalizePower(profile?.power),
    receipts:(Array.isArray(profile?.receipts) ? profile.receipts.map(normalizeReceipt).filter(Boolean) : []).slice(-RATING_RECEIPT_LIMIT)
  };
  if (target) target.setItem(PLAYER_RATING_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function ratingReceipt(receiptId, storage = null) {
  if (!receiptId) return null;
  return readPlayerRating(storage).receipts.find((receipt) => receipt.id === receiptId) || null;
}

function settlePlayerRating({ receiptId, opponentElo, result, storage = null } = {}) {
  if (!receiptId || typeof receiptId !== 'string') throw new Error('Power settlement requires receiptId');
  const profile = readPlayerRating(storage);
  const existing = profile.receipts.find((receipt) => receipt.id === receiptId);
  if (existing) return { profile, receipt:existing, changed:false };
  const before = profile.power;
  const normalizedOpponent = Math.max(0, Math.round(Number(opponentElo) || 0));
  const normalizedResult = normalizeResult(result) >= 0.75 ? 1 : normalizeResult(result) >= 0.25 ? 0.5 : 0;
  const delta = ratingDelta(before, normalizedOpponent, normalizedResult);
  const after = Math.max(0, before + delta);
  const receipt = Object.freeze({ id:receiptId, before, after, delta, opponentElo:normalizedOpponent, result:normalizedResult });
  const next = writePlayerRating({ ...profile, power:after, receipts:[...profile.receipts, receipt] }, storage);
  if (typeof globalThis !== 'undefined' && typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    globalThis.dispatchEvent(new CustomEvent('rpchess:power-updated', { detail:{ power:after, receipt } }));
  }
  return { profile:next, receipt, changed:true };
}

function adaptiveEncounterStars(power, seed = 'rpchess-adaptive') {
  const base = threatStarsForPower(power);
  const roll = hashSeed(`${seed}:power-difficulty`) % 100;
  const offset = roll < 40 ? 0 : roll < 70 ? 1 : roll < 90 ? 2 : 3;
  return clampStars(base + offset);
}

function opponentEloForStars(stars) {
  return difficultyForStars(stars).elo;
}

function combatResultScore(status, playerColor = 'w') {
  if (status?.type === 'checkmate') return status.winner === playerColor ? 1 : 0;
  return 0.5;
}

function combatCountForKind(run, kind) {
  if (kind === 'skirmish') return Number.isInteger(run?.skirmishCount) ? run.skirmishCount : 0;
  if (kind === 'battle') return Number.isInteger(run?.battleCount) ? run.battleCount : 0;
  return null;
}

function ratedOutcomeKind(run) {
  const route = run?.activeTravelChoice;
  if (!route || route.difficultyModel !== 'power-v1') return null;

  if (route.type === 'skirmish' || route.type === 'battle') {
    if (!Number.isInteger(route.combatCountAtSelection)) return null;
    return combatCountForKind(run, route.type) > route.combatCountAtSelection ? route.type : null;
  }

  if (route.type === 'puzzle') {
    const state = run?.currentPuzzle;
    return state?.resolved === true && state.routeId === route.id ? 'puzzle' : null;
  }

  if (route.type === 'event') {
    const combat = run?.currentEvent?.combat;
    if (!combat || !['skirmish','battle'].includes(combat.type) || combat.started !== true || !Number.isInteger(combat.countAtStart)) return null;
    return combatCountForKind(run, combat.type) > combat.countAtStart ? combat.type : null;
  }

  return null;
}

export {
  PLAYER_RATING_STORAGE_KEY,
  PLAYER_RATING_SCHEMA_VERSION,
  STARTING_POWER,
  ELO_K,
  RATING_RECEIPT_LIMIT,
  normalizePower,
  threatStarsForPower,
  threatForPower,
  expectedScore,
  ratingDelta,
  readPlayerRating,
  writePlayerRating,
  ratingReceipt,
  settlePlayerRating,
  adaptiveEncounterStars,
  opponentEloForStars,
  combatResultScore,
  combatCountForKind,
  ratedOutcomeKind
};