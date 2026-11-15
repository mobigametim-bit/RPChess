import { playerNameForRun } from './player-identity-core.mjs';
import {calculateGloryV2,scoreFromCompletedRecord} from './glory-v2.mjs';
import { platform } from './platform.mjs';
import {normalizeCommanderId} from './commander-portraits.mjs';

const CHRONICLE_STORAGE_KEY = 'rpchess.reboot.v1.chronicle';
const CHRONICLE_SCHEMA_VERSION = 1;
const CHRONICLE_HISTORY_LIMIT = 20;

function resolveStorage(storage) {
  if (storage) return storage;
  return platform.storage.sync();
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
  const v2=scoreFromCompletedRecord(value);
  const scoreVersion=v2===null?1:2;
  const stats=Object.fromEntries(['goldEarned','skirmishWins','battleWins',
    'caravansDefended','puzzlesSolved','eventsResolved','heroesRecruited']
    .map(key=>[key,safeInteger(value.stats?.[key])]));
  return {
    runId:value.runId,
    scoreVersion,
    adventure:scoreVersion===2?safeInteger(value.adventure):0,
    kingdom:scoreVersion===2?safeInteger(value.kingdom):0,
    achievementCount:scoreVersion===2?safeInteger(value.achievementCount):0,
    day:safeInteger(value.day),
    territories:safeInteger(value.territories),
    outposts:safeInteger(value.outposts),
    settlements:safeInteger(value.settlements),
    endReason:typeof value.endReason==='string'?value.endReason.slice(0,70):'king_dead',
    stats,
    playerName,
    commanderId:normalizeCommanderId(value.commanderId),
    week,
    power,
    glory: scoreVersion===2?v2:gloryForRun(week,power),
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
  if (storage == null && typeof globalThis !== 'undefined' && typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    globalThis.dispatchEvent(new CustomEvent('rpchess:chronicle-updated', { detail:{ historySize:history.length } }));
  }
  return next;
}

function compareChronicleRecords(left,right) {
  if ((left?.glory||0)!==(right?.glory||0))return (right?.glory||0)-(left?.glory||0);
  if ((left?.adventure||0)!==(right?.adventure||0))return (right?.adventure||0)-(left?.adventure||0);
  if ((left?.achievementCount||0)!==(right?.achievementCount||0))
    return (right?.achievementCount||0)-(left?.achievementCount||0);
  if((left?.day||0)!==(right?.day||0))return (left?.day||0)-(right?.day||0);
  return (left?.completedAt||0)-(right?.completedAt||0);
}

function bestChronicleRun(chronicle) {
  const records = Array.isArray(chronicle?.history) ? chronicle.history.map(normalizeChronicleRecord).filter(record=>record?.scoreVersion===2) : [];
  return records.sort(compareChronicleRecords)[0] || null;
}

// An ongoing Journey may compete for Glory, without becoming a completed
// Chronicle entry. This is a ranking candidate only, not a run-end record.
function activeLeaderboardRecord(run, { power = 0 } = {}) {
  if (!run || run.ended || typeof run.id !== 'string' || !run.id) return null;
  if(run.gloryV2?.version!==2)return null;
  const week=safeInteger(run.journeyStep),normalizedPower=safeInteger(power);
  const score=calculateGloryV2(run,normalizedPower);
  return {
    runId:run.id,playerName:playerNameForRun(run),
    commanderId:normalizeCommanderId(run.commanderId),
    week,power:normalizedPower,scoreVersion:2,
    glory:score.glory,adventure:score.adventure,kingdom:score.kingdom,
    achievementCount:score.achievementCount,
    day:safeInteger(run.kingdomMap?.day||week+1),
    completedAt:0
  };
}

function bestLeaderboardRecord(chronicle, run, { power = 0 } = {}) {
  const candidates = [bestChronicleRun(chronicle), activeLeaderboardRecord(run, { power })].filter(Boolean);
  return candidates.sort(compareChronicleRecords)[0] || null;
}

function completedRunRecord(run, { power = 0, completedAt = Date.now() } = {}) {
  if (!run?.ended || typeof run.id !== 'string' || !run.id) return null;
  const week=safeInteger(run.journeyStep),normalizedPower=safeInteger(power);
  const hasV2=run.gloryV2?.version===2;
  const score=hasV2?calculateGloryV2(run,normalizedPower):null;
  const stats=run.runStats||{};
  const record={
    runId:run.id,playerName:playerNameForRun(run),
    commanderId:normalizeCommanderId(run.commanderId),
    week,power:normalizedPower,
    scoreVersion:hasV2?2:1,
    glory:score?.glory??gloryForRun(week,normalizedPower),
    completedAt:safeInteger(completedAt||run.updatedAt||Date.now())
  };
  if(hasV2)Object.assign(record,{
    adventure:score.adventure,kingdom:score.kingdom,
    achievementCount:score.achievementCount,
    territories:score.territories,outposts:score.outposts,settlements:score.settlements,
    day:safeInteger(run.kingdomMap?.day||week+1),
    endReason:typeof run.endReason==='string'?run.endReason:'king_dead',
    stats:{...Object.fromEntries(['goldEarned','skirmishWins','battleWins',
      'caravansDefended','puzzlesSolved','eventsResolved']
      .map(key=>[key,safeInteger(stats[key])])),
      heroesRecruited:(run.roster||[]).filter(c=>c?.id&&!c.isRunKing&&c.isStarter!==true).length}
  });
  return record;
}

function recordCompletedRun(run, { power = 0, storage = null, completedAt = null } = {}) {
  const record = completedRunRecord(run, { power, completedAt: completedAt ?? run?.updatedAt ?? Date.now() });
  const chronicle = readChronicle(storage);
  if (!record) return { chronicle, record: null, changed: false };
  const index = chronicle.history.findIndex((entry) => entry.runId === record.runId);
  if (index >= 0) {
    const existing=chronicle.history[index];
    // The result is fixed at the moment of death: later Arena/Tournament
    // Power changes must never rewrite the completed Journey's Glory.
    if(existing.scoreVersion===2||existing.scoreVersion===1&&record.scoreVersion===2)
      return {chronicle,record:existing,changed:false};
    const same = existing.playerName === record.playerName && existing.commanderId===record.commanderId && existing.week === record.week && existing.power === record.power && existing.glory === record.glory;
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
  const score=calculateGloryV2(run,power);
  return Object.freeze({
    playerName:playerNameForRun(run),
    commanderId:normalizeCommanderId(run.commanderId),
    week:safeInteger(run.journeyStep),
    day:safeInteger(run.kingdomMap?.day||safeInteger(run.journeyStep)+1),
    power:safeInteger(power),glory:score.glory,territories:score.territories,
    heroes:(run.roster||[]).filter(character=>character?.status!=='dead').length
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
  activeLeaderboardRecord,
  bestLeaderboardRecord,
  completedRunRecord,
  recordCompletedRun,
  activeRunSnapshot
};