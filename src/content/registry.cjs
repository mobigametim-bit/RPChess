'use strict';

const fs = require('fs');
const path = require('path');
const { validateBoardThemeManifest } = require('../assets/board-manifest.cjs');
const { buildBoardCellPlan } = require('../rendering/modular-board.cjs');

const CONTENT_KINDS = Object.freeze([
  'region',
  'king',
  'doctrine',
  'hero',
  'relic',
  'event',
  'encounter',
  'boss'
]);
const PIECE_TYPES = Object.freeze(['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']);
const CONTENT_STATUSES = Object.freeze(['draft', 'review', 'approved']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function assertString(value, label, pattern = null) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  if (pattern && !pattern.test(value)) throw new Error(`${label} has invalid format: ${value}`);
  return value;
}

function canonicalAssetPath(value, label = 'asset path') {
  const input = assertString(value, label).replace(/\\/g, '/').replace(/^\.\//, '');
  if (input.startsWith('/') || input.split('/').includes('..')) throw new Error(`${label} must stay relative`);
  if (!/^[a-z0-9_./-]+$/.test(input)) throw new Error(`${label} must use lowercase canonical characters`);
  return input;
}

function uniqueStrings(values, label, options = {}) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  if (options.min != null && values.length < options.min) throw new Error(`${label} requires at least ${options.min} entries`);
  if (options.max != null && values.length > options.max) throw new Error(`${label} allows at most ${options.max} entries`);
  const normalized = values.map((value, index) => assertString(value, `${label}[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates`);
  return normalized;
}

function commonRecord(record, kind) {
  assertObject(record, `${kind} record`);
  const id = assertString(record.id, `${kind}.id`, new RegExp(`^${kind}\.[a-z0-9][a-z0-9_-]*$`));
  const nameKey = assertString(record.nameKey, `${id}.nameKey`, /^[a-z0-9][a-z0-9_.-]*$/);
  const status = record.status || 'draft';
  if (!CONTENT_STATUSES.includes(status)) throw new Error(`${id}.status is invalid`);
  const tags = uniqueStrings(record.tags || [], `${id}.tags`);
  return { id, kind, nameKey, status, tags };
}

function requiredAssets(recordId, assets, keys) {
  assertObject(assets, `${recordId}.assets`);
  return Object.fromEntries(keys.map((key) => [key, canonicalAssetPath(assets[key], `${recordId}.assets.${key}`)]));
}

function normalizeRecord(kind, record, context) {
  const common = commonRecord(record, kind);
  const localizationKeys = new Set([common.nameKey]);
  const references = [];
  const assets = [];
  let specific;

  if (kind === 'region') {
    const boardThemeId = assertString(record.boardThemeId, `${common.id}.boardThemeId`, /^[a-z0-9][a-z0-9_-]*$/);
    specific = { boardThemeId, factionId: assertString(record.factionId, `${common.id}.factionId`, /^faction\.[a-z0-9][a-z0-9_-]*$/) };
  } else if (kind === 'king') {
    const normalizedAssets = requiredAssets(common.id, record.assets, ['portrait', 'piece', 'commandIcon', 'passiveIcon']);
    assets.push(...Object.values(normalizedAssets));
    const doctrineIds = uniqueStrings(record.doctrineIds || [], `${common.id}.doctrineIds`);
    doctrineIds.forEach((id) => references.push({ kind: 'doctrine', id, field: 'doctrineIds' }));
    specific = { assets: normalizedAssets, doctrineIds };
  } else if (kind === 'doctrine') {
    const baseAssets = requiredAssets(common.id, record.assets, ['emblem']);
    const nodes = (record.assets && Array.isArray(record.assets.nodes)) ? record.assets.nodes.map((value, index) => canonicalAssetPath(value, `${common.id}.assets.nodes[${index}]`)) : [];
    if (nodes.length !== 5) throw new Error(`${common.id}.assets.nodes must contain exactly 5 icons`);
    assets.push(baseAssets.emblem, ...nodes);
    specific = { assets: { ...baseAssets, nodes } };
  } else if (kind === 'hero') {
    if (!PIECE_TYPES.includes(record.pieceType)) throw new Error(`${common.id}.pieceType is invalid`);
    const regionId = assertString(record.regionId, `${common.id}.regionId`, /^region\.[a-z0-9][a-z0-9_-]*$/);
    references.push({ kind: 'region', id: regionId, field: 'regionId' });
    const normalizedAssets = requiredAssets(common.id, record.assets, ['portrait', 'pieceBadge', 'abilityIcon']);
    assets.push(...Object.values(normalizedAssets));
    specific = { pieceType: record.pieceType, regionId, assets: normalizedAssets, abilityId: assertString(record.abilityId, `${common.id}.abilityId`, /^ability\.[a-z0-9][a-z0-9_.-]*$/) };
  } else if (kind === 'relic') {
    const compatibility = uniqueStrings(record.compatibility, `${common.id}.compatibility`, { min: 1 });
    for (const value of compatibility) {
      if (!PIECE_TYPES.includes(value) && value !== 'any' && value !== 'hero') throw new Error(`${common.id}.compatibility contains invalid value: ${value}`);
    }
    const icon = canonicalAssetPath(record.icon, `${common.id}.icon`);
    assets.push(icon);
    specific = { compatibility, icon, effectId: assertString(record.effectId, `${common.id}.effectId`, /^effect\.[a-z0-9][a-z0-9_.-]*$/) };
  } else if (kind === 'event') {
    const titleKey = assertString(record.titleKey, `${common.id}.titleKey`, /^[a-z0-9][a-z0-9_.-]*$/);
    const bodyKey = assertString(record.bodyKey, `${common.id}.bodyKey`, /^[a-z0-9][a-z0-9_.-]*$/);
    localizationKeys.add(titleKey); localizationKeys.add(bodyKey);
    if (!Array.isArray(record.choices) || record.choices.length < 3 || record.choices.length > 4) throw new Error(`${common.id}.choices must contain 3 or 4 choices`);
    const choiceIds = new Set();
    const choices = record.choices.map((choice, index) => {
      assertObject(choice, `${common.id}.choices[${index}]`);
      const id = assertString(choice.id, `${common.id}.choices[${index}].id`, /^[a-z0-9][a-z0-9_-]*$/);
      if (choiceIds.has(id)) throw new Error(`${common.id}.choices contains duplicate id: ${id}`);
      choiceIds.add(id);
      const textKey = assertString(choice.textKey, `${common.id}.choices[${index}].textKey`, /^[a-z0-9][a-z0-9_.-]*$/);
      localizationKeys.add(textKey);
      return { id, textKey, effectIds: uniqueStrings(choice.effectIds || [], `${common.id}.choices[${index}].effectIds`) };
    });
    const sceneArt = record.sceneArt ? canonicalAssetPath(record.sceneArt, `${common.id}.sceneArt`) : null;
    if (sceneArt) assets.push(sceneArt);
    specific = { titleKey, bodyKey, choices, sceneArt, scope: assertString(record.scope, `${common.id}.scope`, /^[a-z0-9][a-z0-9_-]*$/) };
  } else if (kind === 'encounter') {
    assertObject(record.board, `${common.id}.board`);
    const themeId = assertString(record.board.themeId, `${common.id}.board.themeId`, /^[a-z0-9][a-z0-9_-]*$/);
    if (!context.boardThemes.has(themeId)) throw new Error(`${common.id} references unknown board theme: ${themeId}`);
    const width = record.board.width ?? 8;
    const height = record.board.height ?? 8;
    const theme = context.boardThemes.get(themeId);
    buildBoardCellPlan({ width, height, activeCells: record.board.activeCells || null, tileSet: theme });
    const objectiveKeys = uniqueStrings(record.objectiveKeys, `${common.id}.objectiveKeys`, { min: 1 });
    objectiveKeys.forEach((key) => localizationKeys.add(key));
    const regionId = record.regionId || null;
    if (regionId) references.push({ kind: 'region', id: regionId, field: 'regionId' });
    specific = { regionId, board: { themeId, width, height, activeCells: record.board.activeCells || null }, objectiveKeys };
  } else if (kind === 'boss') {
    const regionId = record.regionId || null;
    if (regionId) references.push({ kind: 'region', id: regionId, field: 'regionId' });
    if (!Array.isArray(record.phases) || record.phases.length < 2 || record.phases.length > 3) throw new Error(`${common.id}.phases must contain 2 or 3 phases`);
    const phases = record.phases.map((phase, index) => {
      assertObject(phase, `${common.id}.phases[${index}]`);
      const id = assertString(phase.id, `${common.id}.phases[${index}].id`, /^[a-z0-9][a-z0-9_-]*$/);
      const titleKey = assertString(phase.titleKey, `${common.id}.phases[${index}].titleKey`, /^[a-z0-9][a-z0-9_.-]*$/);
      const objectiveKey = assertString(phase.objectiveKey, `${common.id}.phases[${index}].objectiveKey`, /^[a-z0-9][a-z0-9_.-]*$/);
      localizationKeys.add(titleKey); localizationKeys.add(objectiveKey);
      return { id, titleKey, objectiveKey };
    });
    const baseAssets = requiredAssets(common.id, record.assets, ['portrait', 'piece', 'arena', 'phaseTransition']);
    const phaseSigils = (record.assets && Array.isArray(record.assets.phaseSigils)) ? record.assets.phaseSigils.map((value, index) => canonicalAssetPath(value, `${common.id}.assets.phaseSigils[${index}]`)) : [];
    if (phaseSigils.length !== phases.length) throw new Error(`${common.id}.assets.phaseSigils must match phase count`);
    assets.push(...Object.values(baseAssets), ...phaseSigils);
    specific = { regionId, phases, assets: { ...baseAssets, phaseSigils } };
  } else {
    throw new Error(`unsupported content kind: ${kind}`);
  }

  return deepFreeze({
    ...common,
    ...specific,
    _references: references,
    _localizationKeys: Array.from(localizationKeys),
    _assetPaths: assets
  });
}

class ContentRegistry {
  constructor(options = {}) {
    const boardManifest = validateBoardThemeManifest(options.boardThemeManifest);
    this.boardThemes = new Map(boardManifest.themes.map((theme) => [theme.id, theme]));
    this.records = new Map(CONTENT_KINDS.map((kind) => [kind, new Map()]));
    this.packIds = new Set();
    this.finalized = false;
  }

  addPack(pack) {
    if (this.finalized) throw new Error('content registry is already finalized');
    assertObject(pack, 'content pack');
    if (pack.schemaVersion !== 1) throw new Error('unsupported content pack schemaVersion');
    const packId = assertString(pack.packId, 'content pack packId', /^[a-z0-9][a-z0-9_-]*$/);
    if (this.packIds.has(packId)) throw new Error(`duplicate content pack id: ${packId}`);
    assertObject(pack.content, `${packId}.content`);

    const pending = [];
    for (const kind of CONTENT_KINDS) {
      const records = pack.content[`${kind}s`] || [];
      if (!Array.isArray(records)) throw new Error(`${packId}.content.${kind}s must be an array`);
      for (const record of records) {
        const normalized = normalizeRecord(kind, record, { boardThemes: this.boardThemes });
        if (this.records.get(kind).has(normalized.id) || pending.some((item) => item.record.id === normalized.id)) {
          throw new Error(`duplicate ${kind} id: ${normalized.id}`);
        }
        pending.push({ kind, record: normalized });
      }
    }

    this.packIds.add(packId);
    for (const { kind, record } of pending) this.records.get(kind).set(record.id, record);
    return this;
  }

  finalize(options = {}) {
    const errors = [];
    for (const kind of CONTENT_KINDS) {
      for (const record of this.records.get(kind).values()) {
        for (const reference of record._references) {
          if (!this.records.get(reference.kind).has(reference.id)) {
            errors.push(`${record.id}.${reference.field} references missing ${reference.id}`);
          }
        }
      }
    }

    const localization = options.localization || null;
    if (localization) {
      for (const language of ['ru', 'en']) {
        if (!localization[language] || typeof localization[language] !== 'object') errors.push(`missing ${language} localization dictionary`);
      }
      if (localization.ru && localization.en) {
        for (const kind of CONTENT_KINDS) {
          for (const record of this.records.get(kind).values()) {
            for (const key of record._localizationKeys) {
              if (typeof localization.ru[key] !== 'string' || !localization.ru[key].trim()) errors.push(`missing ru localization: ${key}`);
              if (typeof localization.en[key] !== 'string' || !localization.en[key].trim()) errors.push(`missing en localization: ${key}`);
            }
          }
        }
      }
    }

    if (errors.length) {
      const error = new Error(`content registry validation failed with ${errors.length} error(s)`);
      error.details = Object.freeze(errors);
      throw error;
    }
    this.finalized = true;
    return this;
  }

  get(kind, id) {
    if (!CONTENT_KINDS.includes(kind)) throw new Error(`unsupported content kind: ${kind}`);
    return this.records.get(kind).get(id) || null;
  }

  list(kind) {
    if (!CONTENT_KINDS.includes(kind)) throw new Error(`unsupported content kind: ${kind}`);
    return Object.freeze(Array.from(this.records.get(kind).values()));
  }

  assetPaths() {
    const paths = new Set();
    for (const kind of CONTENT_KINDS) for (const record of this.records.get(kind).values()) for (const asset of record._assetPaths) paths.add(asset);
    return Object.freeze(Array.from(paths).sort());
  }

  summary() {
    return deepFreeze(Object.fromEntries(CONTENT_KINDS.map((kind) => [kind, this.records.get(kind).size])));
  }
}

function loadContentPack(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

module.exports = {
  CONTENT_KINDS,
  PIECE_TYPES,
  CONTENT_STATUSES,
  canonicalAssetPath,
  normalizeRecord,
  ContentRegistry,
  loadContentPack
};
