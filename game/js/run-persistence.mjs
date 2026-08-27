import { createStarterRoster } from './roster-data.mjs';
import { STARTING_GOLD, STARTING_SUPPLIES, hydrateResources } from './resources-core.mjs';

const RUN_STORAGE_KEY = 'rpchess.reboot.v1.run';
const RUN_SCHEMA_VERSION = 1;
const TRAVEL_TYPES = new Set(['skirmish', 'battle', 'event', 'settlement', 'puzzle']);

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

function runId(now = Date.now()) {
  return `run-${Number(now).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isStoredTravelChoice(value) {
  if (!value || typeof value !== 'object') return false;
  if (!value.id || typeof value.id !== 'string') return false;
  if (!TRAVEL_TYPES.has(value.type)) return false;
  if (!Number.isInteger(value.step) || value.step < 1) return false;
  if (!Number.isInteger(value.stars) || value.stars < 1 || value.stars > 5) return false;
  if (!value.seed || typeof value.seed !== 'string') return false;
  if (!value.flavor || typeof value.flavor !== 'string') return false;
  if (!value.mechanicalHint || typeof value.mechanicalHint !== 'string') return false;
  if (value.combatCountAtSelection != null && (!Number.isInteger(value.combatCountAtSelection) || value.combatCountAtSelection < 0)) return false;
  if (value.supplyCostAtSelection != null && (!Number.isInteger(value.supplyCostAtSelection) || value.supplyCostAtSelection < 0)) return false;
  if (value.supplyPaid != null && (!Number.isInteger(value.supplyPaid) || value.supplyPaid < 0)) return false;
  return true;
}

function isResourceRewardState(value) {
  if (value == null) return true;
  if (!value || typeof value !== 'object') return false;
  if (!Number.isInteger(value.skirmishCount) || value.skirmishCount < 0) return false;
  if (!Number.isInteger(value.battleCount) || value.battleCount < 0) return false;
  return true;
}

function isValidRun(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.schemaVersion !== RUN_SCHEMA_VERSION) return false;
  if (!Array.isArray(value.roster) || value.roster.length < 1) return false;
  if (!value.id || !value.selectedCharacterId) return false;
  if (value.ended != null && typeof value.ended !== 'boolean') return false;
  if (!Number.isInteger(value.gold) || value.gold < 0) return false;
  if (!Number.isInteger(value.supplies) || value.supplies < 0) return false;
  if (!isResourceRewardState(value.resourceRewards)) return false;
  if (value.skirmishCount != null && (!Number.isInteger(value.skirmishCount) || value.skirmishCount < 0)) return false;
  if (value.battleCount != null && (!Number.isInteger(value.battleCount) || value.battleCount < 0)) return false;
  if (value.journeyStep != null && (!Number.isInteger(value.journeyStep) || value.journeyStep < 0)) return false;
  if (value.currentTravelChoices != null && (!Array.isArray(value.currentTravelChoices) || value.currentTravelChoices.length !== 3 || !value.currentTravelChoices.every(isStoredTravelChoice))) return false;
  if (value.activeTravelChoice != null && !isStoredTravelChoice(value.activeTravelChoice)) return false;
  const ids = new Set();
  let kingCount = 0;
  for (const character of value.roster) {
    if (!character || typeof character !== 'object' || !character.id || ids.has(character.id)) return false;
    ids.add(character.id);
    if (character.isRunKing) kingCount += 1;
    if (!['healthy', 'wounded', 'dead'].includes(character.status)) return false;
  }
  return kingCount === 1 && ids.has(value.selectedCharacterId);
}

function hydrateCurrentRosterCopy(run) {
  const currentTemplates = new Map(createStarterRoster().map((character) => [character.id, character]));
  const resources = hydrateResources(run);
  return {
    ...resources,
    resourceRewards: {
      skirmishCount: Number.isInteger(run.resourceRewards?.skirmishCount) ? run.resourceRewards.skirmishCount : 0,
      battleCount: Number.isInteger(run.resourceRewards?.battleCount) ? run.resourceRewards.battleCount : 0
    },
    ended: Boolean(run.ended),
    skirmishCount: Number.isInteger(run.skirmishCount) ? run.skirmishCount : 0,
    battleCount: Number.isInteger(run.battleCount) ? run.battleCount : 0,
    lastSkirmish: run.lastSkirmish || null,
    lastBattle: run.lastBattle || null,
    journeyStep: Number.isInteger(run.journeyStep) ? run.journeyStep : 0,
    currentTravelChoices: Array.isArray(run.currentTravelChoices) ? run.currentTravelChoices : null,
    activeTravelChoice: isStoredTravelChoice(run.activeTravelChoice) ? run.activeTravelChoice : null,
    roster: run.roster.map((character) => {
      const current = currentTemplates.get(character.id);
      if (!current) return character;
      return { ...character, ...current, status: character.status };
    })
  };
}

function createRun({ now = Date.now(), id = null } = {}) {
  const roster = createStarterRoster();
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    id: id || runId(now),
    createdAt: Number(now),
    updatedAt: Number(now),
    selectedCharacterId: roster[0].id,
    roster,
    gold: STARTING_GOLD,
    supplies: STARTING_SUPPLIES,
    resourceRewards: { skirmishCount: 0, battleCount: 0 },
    ended: false,
    endReason: null,
    skirmishCount: 0,
    lastSkirmish: null,
    battleCount: 0,
    lastBattle: null,
    journeyStep: 0,
    currentTravelChoices: null,
    activeTravelChoice: null
  };
}

function readRun(storage = null) {
  const target = resolveStorage(storage);
  if (!target) return null;
  try {
    const parsed = JSON.parse(target.getItem(RUN_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== RUN_SCHEMA_VERSION) return null;
    const hydrated = hydrateCurrentRosterCopy(parsed);
    return isValidRun(hydrated) ? hydrated : null;
  } catch {
    return null;
  }
}

function writeRun(run, storage = null, now = Date.now()) {
  const target = resolveStorage(storage);
  if (!target) return run;
  const next = { ...hydrateResources(run), updatedAt: Number(now) };
  if (!isValidRun(next)) throw new Error('Cannot persist invalid RPChess run state');
  target.setItem(RUN_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function clearRun(storage = null) {
  resolveStorage(storage)?.removeItem(RUN_STORAGE_KEY);
}

export { RUN_STORAGE_KEY, RUN_SCHEMA_VERSION, createRun, readRun, writeRun, clearRun, isValidRun, isStoredTravelChoice };
