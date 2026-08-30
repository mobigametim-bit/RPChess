import { playerNameForRun } from './player-identity-core.mjs';

const CHRONICLE_STORAGE_KEY = 'rpchess.reboot.v1.chronicle';
const CHRONICLE_SCHEMA_VERSION = 1;
const CHRONICLE_HISTORY_LIMIT = 20;

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

function safeInteger(value) {
  const numeric = Number(value);
  return Math.max(0, Number.isFinite(numeric) ? Math.floor(numeric) : 0);
}

function gloryForRun(week, power) {
  return Math.floor(Math.sqrt(safeInteger(week) * safeInteger(power)) / 10);
}

function normalizeChronicleRecord(value) {
  if (!value || typeof value !== 'object' || typeof value.runId !== 'string' || !value.runId) return null;
  const week = safeInteger(value.week);
  const power = safeInteger(value.power);
  const playerName = typeof value.playerName === 'string' && value.playerName.trim() ? value.playerName.trim().slice(0, 24) : 'Воин';
  return {
    runId: value.runId,
    playerName,
    week,
    power,
    glory: gloryForRun(week, power),
    completedAt: safeInteger(value.completedAt)
  };
}

function emptyChronicle() {
  return { schemaVersion: CHRONICLE_SCHEMA_VERSION, history: [] };
}

function readChronicle(storage = null) {
  const target = resolveStorage(storage);
  if (!target) return emptyChronicle();
  try {
    const parsed = JSON.parse(target.getItem(CHRONICLE_STORAGE_KEY) || 'null');
    if (!parsed || parsed.schemaVersion !== CHRONICLE_SCHEMA_VERSION || !Array.isArray(parsed.history)) return emptyChronicle();
    const seen = new Set();
    const history = [];
    for (const raw of parsed.history) {
      const record = normalizeChronicleRecord(raw);
      if (!record || seen.has(record.runId)) continue;
      seen.add(record.runId);
      history.push(record);
    }
    return { schemaVersion: CHRONICLE_SCHEMA_VERSION, history: history.slice(-CHRONICLE_HISTORY_LIMIT) };
  } catch {
    return emptyChronicle();
  }
}

function writeChronicle(chronicle, storage = null) {
  const target = resolveStorage(storage);
  const history = (Array.isArray(chronicle?.history) ? chronicle.history : [])
    .map(normalizeChronicleRecord)
    .filter(Boolean)
    .slice(-CHRONICLE_HISTORY_LIMIT);
  const next = { schemaVersion: CHRONICLE_SCHEMA_VERSION, history };
  if (target) target.setItem(CHRONICLE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function compareChronicleRecords(left, right) {
  if ((left?.glory || 0) !== (right?.glory || 0)) return (right?.glory || 0) - (left?.glory || 0);
  if ((left?.week || 0) !== (right?.week || 0)) return (right?.week || 0) - (left?.week || 0);
  if ((left?.power || 0) !== (right?.power || 0)) return (right?.power || 0) - (left?.power || 0);
  return (right?.completedAt || 0) - (left?.completedAt || 0);
}

function bestChronicleRun(chronicle) {
  const records = Array.isArray(chronicle?.history) ? chronicle.history.map(normalizeChronicleRecord).filter(Boolean) : [];
  return records.sort(compareChronicleRecords)[0] || null;
}

function completedRunRecord(run, { power = 0, completedAt = Date.now() } = {}) {
  if (!run?.ended || typeof run.id !== 'string' || !run.id) return null;
  const week = safeInteger(run.journeyStep);
  const normalizedPower = safeInteger(power);
  return {
    runId: run.id,
    playerName: playerNameForRun(run),
    week,
    power: normalizedPower,
    glory: gloryForRun(week, normalizedPower),
    completedAt: safeInteger(completedAt || run.updatedAt || Date.now())
  };
}

function recordCompletedRun(run, { power = 0, storage = null, completedAt = null } = {}) {
  const record = completedRunRecord(run, { power, completedAt: completedAt ?? run?.updatedAt ?? Date.now() });
  const chronicle = readChronicle(storage);
  if (!record) return { chronicle, record: null, changed: false };
  const index = chronicle.history.findIndex((entry) => entry.runId === record.runId);
  if (index >= 0) {
    const existing = chronicle.history[index];
    const same = existing.playerName === record.playerName && existing.week === record.week && existing.power === record.power && existing.glory === record.glory;
    if (same) return { chronicle, record: existing, changed: false };
    const history = [...chronicle.history];
    history[index] = { ...record, completedAt: existing.completedAt || record.completedAt };
    const next = writeChronicle({ ...chronicle, history }, storage);
    return { chronicle: next, record: next.history.find((entry) => entry.runId === record.runId) || record, changed: true };
  }
  const next = writeChronicle({ ...chronicle, history: [...chronicle.history, record] }, storage);
  return { chronicle: next, record, changed: true };
}

function activeRunSnapshot(run, { power = 0 } = {}) {
  if (!run || run.ended) return null;
  return Object.freeze({
    playerName: playerNameForRun(run),
    week: safeInteger(run.journeyStep),
    power: safeInteger(power),
    heroes: (run.roster || []).filter((character) => character?.status !== 'dead').length
  });
}

export {
  CHRONICLE_STORAGE_KEY,
  CHRONICLE_SCHEMA_VERSION,
  CHRONICLE_HISTORY_LIMIT,
  gloryForRun,
  normalizeChronicleRecord,
  emptyChronicle,
  readChronicle,
  writeChronicle,
  compareChronicleRecords,
  bestChronicleRun,
  completedRunRecord,
  recordCompletedRun,
  activeRunSnapshot
};
