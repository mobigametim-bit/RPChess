'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ALLOWED_STATUSES = new Set(['IMPLEMENTED', 'PARTIAL', 'DECLARATIVE', 'BLOCKED_BY_DESIGN']);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameSet(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateEvidence(record) {
  for (const evidence of record.evidence || []) {
    const file = path.join(ROOT, evidence.path);
    assert(fs.existsSync(file), `${record.id}: evidence file is missing: ${evidence.path}`);
    const source = fs.readFileSync(file, 'utf8');
    for (const token of evidence.tokens || []) {
      assert(source.includes(token), `${record.id}: evidence token ${token} is missing from ${evidence.path}`);
    }
  }
}

function auditIronMarchesMechanics() {
  const pack = readJson('content/packs/iron_marches_vertical_slice.json');
  const report = readJson('content/audits/iron_marches_mechanics_readiness.json');
  const heroes = pack.content?.heroes || [];
  const relics = pack.content?.relics || [];
  const abilityIds = heroes.map((hero) => hero.abilityId).filter(Boolean);
  const relicEffectIds = relics.map((relic) => relic.effectId).filter(Boolean);
  const reportAbilityIds = report.abilities.map((record) => record.id);
  const reportRelicEffectIds = report.relicEffects.map((record) => record.id);

  assert(report.schemaVersion === 1, 'mechanics readiness report must use schemaVersion 1');
  assert(report.scope === 'region.iron_marches', 'mechanics readiness report must target Iron Marches');
  assert(sameSet(abilityIds, reportAbilityIds), 'ability readiness records do not exactly match production content');
  assert(sameSet(relicEffectIds, reportRelicEffectIds), 'relic readiness records do not exactly match production content');
  assert(new Set(reportAbilityIds).size === reportAbilityIds.length, 'duplicate ability readiness record');
  assert(new Set(reportRelicEffectIds).size === reportRelicEffectIds.length, 'duplicate relic readiness record');

  const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
  const relicById = new Map(relics.map((relic) => [relic.id, relic]));
  for (const record of report.abilities) {
    assert(ALLOWED_STATUSES.has(record.status), `${record.id}: invalid readiness status ${record.status}`);
    assert(record.uiAvailability === 'disabled' || record.status === 'IMPLEMENTED', `${record.id}: non-implemented ability must be disabled`);
    assert(heroById.get(record.heroId)?.abilityId === record.id, `${record.id}: hero binding does not match production content`);
    assert(typeof record.reason === 'string' && record.reason.length >= 20, `${record.id}: readiness reason is incomplete`);
    validateEvidence(record);
  }
  for (const record of report.relicEffects) {
    assert(ALLOWED_STATUSES.has(record.status), `${record.id}: invalid readiness status ${record.status}`);
    assert(relicById.get(record.relicId)?.effectId === record.id, `${record.id}: relic binding does not match production content`);
    assert(typeof record.reason === 'string' && record.reason.length >= 20, `${record.id}: readiness reason is incomplete`);
    if (record.status === 'PARTIAL' || record.status === 'IMPLEMENTED') {
      assert((record.evidence || []).length > 0, `${record.id}: implemented evidence is required`);
    }
    validateEvidence(record);
  }

  const presenterBridge = fs.readFileSync(path.join(ROOT, 'src/runtime/presenter-bridge.cjs'), 'utf8');
  const browserClient = fs.readFileSync(path.join(ROOT, 'game/js/runtime-command-client.mjs'), 'utf8');
  assert(!presenterBridge.includes("'UseAbility'"), 'UseAbility must not be exposed before an executable contract exists');
  assert(!browserClient.includes("'UseAbility'"), 'browser client must not advertise an unavailable ability command');

  const allRecords = [...report.abilities, ...report.relicEffects];
  const counts = Object.freeze(Object.fromEntries([...ALLOWED_STATUSES].map((status) => [
    status,
    allRecords.filter((record) => record.status === status).length
  ])));
  return Object.freeze({
    abilityCount: report.abilities.length,
    relicEffectCount: report.relicEffects.length,
    totalCount: allRecords.length,
    counts
  });
}

if (require.main === module) {
  try {
    const summary = auditIronMarchesMechanics();
    console.log(`Iron Marches mechanics readiness: ${summary.totalCount}/${summary.totalCount} records validated.`);
    console.log(JSON.stringify(summary.counts));
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}

module.exports = { auditIronMarchesMechanics };
