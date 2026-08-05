'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const file = (relative) => path.join(root, relative);
const read = (relative) => fs.readFileSync(file(relative), 'utf8');
const write = (relative, content) => {
  fs.mkdirSync(path.dirname(file(relative)), { recursive: true });
  fs.writeFileSync(file(relative), content);
};
function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(search, replacement);
}

function copyBlockerFoundation() {
  execFileSync('git', ['fetch', 'origin', 'scenario/blocker-legality-v2'], { cwd: root, stdio: 'inherit' });
  for (const relative of ['src/core/chess/rules.cjs', 'src/combat/reserve.cjs']) {
    const content = execFileSync('git', ['show', `origin/scenario/blocker-legality-v2:${relative}`], { cwd: root, encoding: 'utf8' });
    write(relative, content);
  }
}

function patchStatuses() {
  let source = read('src/combat/statuses.cjs');
  source = replaceOnce(source,
    "  ward: Object.freeze({ id: 'ward', category: 'primary', visible: true, geometryChange: false, defaultExpiry: null, consumable: true }),\n",
    "  ward: Object.freeze({ id: 'ward', category: 'primary', visible: true, geometryChange: false, defaultExpiry: null, consumable: true }),\n  evasion: Object.freeze({ id: 'evasion', category: 'primary', visible: true, geometryChange: false, defaultExpiry: null, consumable: true }),\n  guarded: Object.freeze({ id: 'guarded', category: 'primary', visible: true, geometryChange: false, defaultExpiry: null, consumable: true }),\n  offered: Object.freeze({ id: 'offered', category: 'primary', visible: true, geometryChange: false, defaultExpiry: Object.freeze({ kind: 'actions', remaining: 2 }), consumable: false }),\n",
    'status definitions');
  write('src/combat/statuses.cjs', source);
}

function patchBattle() {
  let source = read('src/combat/battle.cjs');
  source = replaceOnce(source,
    "const { generateLegalMoves, makeMove, gameStatus } = require('../core/chess/rules.cjs');",
    "const { generateLegalMoves, makeMove, gameStatus, normalizeRulesContext } = require('../core/chess/rules.cjs');",
    'battle rules import');
  source = replaceOnce(source,
    "} = require('./abilities.cjs');\n",
    "} = require('./abilities.cjs');\nconst { applyMovePassives, advanceScenarioRules } = require('./iron-marches-hooks.cjs');\n",
    'battle hooks import');
  source = replaceOnce(source,
    "function createBattleState(options) {",
    `function normalizeScenarioRules(input = {}) {
  const baseBlockedSquares = [...new Set((input.baseBlockedSquares || input.blockedSquares || []).map((square) => indexToSquare(squareToIndex(square))))];
  const blockers = (input.blockers || []).map((record) => Object.freeze({
    square: indexToSquare(squareToIndex(record.square)),
    sourceId: String(record.sourceId || 'scenario'),
    ownerId: record.ownerId || null,
    kind: record.kind || 'blocker',
    expiresAfterAction: record.expiresAfterAction == null ? null : Number(record.expiresAfterAction)
  }));
  return Object.freeze({
    ...input,
    baseBlockedSquares: freezeArray(baseBlockedSquares),
    blockers: freezeArray(blockers),
    blockedSquares: freezeArray([...new Set([...baseBlockedSquares, ...blockers.map((record) => record.square)])]),
    gateSquares: freezeArray((input.gateSquares || []).map((square) => indexToSquare(squareToIndex(square))))
  });
}

function createBattleState(options) {`,
    'battle scenario rules helper');
  source = replaceOnce(source,
    "  const initialStatus = gameStatus(options.position);",
    "  const scenarioRules = normalizeScenarioRules(options.scenarioRules || {});\n  const initialStatus = gameStatus(options.position, scenarioRules);",
    'battle initial status');
  source = replaceOnce(source,
    "    schemaVersion: 4,",
    "    schemaVersion: 5,",
    'battle schema');
  source = replaceOnce(source,
    "    abilities: createAbilityState(options.abilities || {}),\n",
    "    abilities: createAbilityState(options.abilities || {}),\n    scenarioRules,\n",
    'battle state scenario rules');
  source = replaceOnce(source,
    "  return generateLegalMoves(state.position)\n",
    "  return generateLegalMoves(state.position, state.scenarioRules || {})\n",
    'battle move rules');
  source = replaceOnce(source,
    "      orderPoints: state.orderPoints\n",
    "      orderPoints: state.orderPoints,\n      rules: state.scenarioRules || {}\n",
    'battle reserve discovery rules');
  source = replaceOnce(source,
    "function appendPositionStatusEvents(state, position, identities, factory, events) {\n  const chessStatus = gameStatus(position);",
    "function appendPositionStatusEvents(state, position, identities, factory, events, scenarioRules = state.scenarioRules || {}) {\n  const chessStatus = gameStatus(position, scenarioRules);",
    'battle outcome rules');
  source = replaceOnce(source,
    "  const result = makeMove(before, command.payload);",
    "  const result = makeMove(before, command.payload, state.scenarioRules || {});",
    'battle execute move rules');
  source = replaceOnce(source,
    "  const outcome = appendPositionStatusEvents(state, result.position, identityChange.identities, factory, events);\n  return {\n    position: result.position,\n    identities: identityChange.identities,\n    events,\n    status: outcome.status,\n    result: outcome.result,\n    orderPoints: state.orderPoints,\n    reserve: state.reserve,\n    actedPieceId: identityChange.movedId,\n    capturedId: identityChange.capturedId\n  };",
    `  const outcome = appendPositionStatusEvents(state, result.position, identityChange.identities, factory, events, state.scenarioRules);
  const passives = applyMovePassives(state, {
    actedPieceId: identityChange.movedId,
    statuses: state.statuses,
    abilities: state.abilities,
    orderPoints: state.orderPoints
  }, moving, identityChange.capturedId, factory, events);
  return {
    position: result.position,
    identities: identityChange.identities,
    statuses: passives.statuses,
    abilities: passives.abilities,
    scenarioRules: state.scenarioRules,
    events,
    status: outcome.status,
    result: outcome.result,
    orderPoints: passives.orderPoints,
    reserve: state.reserve,
    actedPieceId: identityChange.movedId,
    capturedId: identityChange.capturedId
  };`,
    'battle move passives');
  source = replaceOnce(source,
    "    square: command.payload.square\n  });",
    "    square: command.payload.square,\n    rules: state.scenarioRules || {}\n  });",
    'battle reserve execution rules');
  source = replaceOnce(source,
    "  const outcome = appendPositionStatusEvents(state, deployed.position, identities, factory, events);\n  return {\n    position: deployed.position,\n    identities,\n    events,",
    "  const outcome = appendPositionStatusEvents(state, deployed.position, identities, factory, events, state.scenarioRules);\n  return {\n    position: deployed.position,\n    identities,\n    statuses: state.statuses,\n    abilities: state.abilities,\n    scenarioRules: state.scenarioRules,\n    events,",
    'battle reserve state');
  source = replaceOnce(source,
    "  const statuses = advanceBattleStatuses(state, resolution, actingSide, factory, events);\n\n  const nextState = Object.freeze({",
    "  const statuses = advanceBattleStatuses(state, resolution, actingSide, factory, events);\n  const scenarioRules = advanceScenarioRules(resolution.scenarioRules || state.scenarioRules, state.actionIndex + 1, factory, state.battleId, events);\n\n  const nextState = Object.freeze({",
    'battle topology advance');
  source = replaceOnce(source,
    "    abilities: resolution.abilities || state.abilities,\n    actionIndex:",
    "    abilities: resolution.abilities || state.abilities,\n    scenarioRules,\n    actionIndex:",
    'battle next scenario rules');
  write('src/combat/battle.cjs', source);
}

function writeProtectionModule() {
  write('src/combat/ward-protection.cjs', `'use strict';

const { DeterministicIdFactory } = require('../core/determinism.cjs');
const { DomainEnvelopeFactory } = require('../core/domain.cjs');
const { opposite, createPosition, squareToIndex, indexToSquare, coordinates, indexOf, toFen } = require('../core/chess/position.cjs');
const { generateLegalMoves, isInCheck, gameStatus } = require('../core/chess/rules.cjs');
const { identityAt } = require('./identity.cjs');
const { hasStatus, statusFor, consumeStatus, advanceStatuses } = require('./statuses.cjs');
const { legalBattleCommands, executeBattleCommand, applyBattleStatus } = require('./battle.cjs');
const { advanceScenarioRules } = require('./iron-marches-hooks.cjs');

function freezeArray(items) { return Object.freeze(items.slice()); }
function envelopeFactory(snapshot) { return new DomainEnvelopeFactory({ idFactory: DeterministicIdFactory.fromSnapshot(snapshot.idFactory), sequence: snapshot.sequence }); }
function sameMove(move, payload) { return indexToSquare(move.from) === payload.from && indexToSquare(move.to) === payload.to && (move.promotion || null) === (payload.promotion || null); }
function captureSquare(position, move) {
  if (!move.capture) return null;
  if (!move.enPassant) return indexToSquare(move.to);
  const { x, y } = coordinates(move.to);
  return indexToSquare(indexOf(x, y + (position.sideToMove === 'w' ? 1 : -1)));
}
function protectedTarget(state, request) {
  if (!request || request.type !== 'MovePiece') return null;
  const move = generateLegalMoves(state.position, state.scenarioRules || {}).find((candidate) => sameMove(candidate, request.payload));
  if (!move || !move.capture) return null;
  const square = captureSquare(state.position, move);
  const pieceId = identityAt(state.identities, square);
  const status = pieceId ? statusFor(state.statuses, pieceId) : null;
  if (!status || !['ward', 'evasion', 'guarded'].includes(status.id)) return null;
  return Object.freeze({ move, square, pieceId, status, protection: status.id });
}
function wardedTarget(state, request) {
  const target = protectedTarget(state, request);
  return target?.protection === 'ward' ? target : null;
}
function passActionPosition(position) {
  const actingSide = position.sideToMove;
  return createPosition({ board: position.board, sideToMove: opposite(actingSide), castling: position.castling, enPassant: null, halfmove: position.halfmove + 1, fullmove: position.fullmove + (actingSide === 'b' ? 1 : 0) });
}
function sideByPiece(identities) { return Object.fromEntries(Object.entries(identities.metadata).map(([pieceId, metadata]) => [pieceId, metadata.side])); }
function outcome(state, position, factory, events) {
  const status = gameStatus(position, state.scenarioRules || {});
  if (status.state === 'check') {
    const kingIndex = position.board.findIndex((value) => value && value.side === position.sideToMove && value.type === 'k');
    const kingSquare = indexToSquare(kingIndex);
    events.push(factory.event('KingChecked', { battleId: state.battleId, checkedSide: position.sideToMove, kingSquare, kingId: identityAt(state.identities, kingSquare) }));
    return { status: 'active', result: null };
  }
  if (status.state === 'checkmate') {
    const result = { outcome: status.winner === state.playerSide ? 'victory' : 'defeat', winner: status.winner, reason: 'checkmate' };
    events.push(factory.event('CheckmateDeclared', { battleId: state.battleId, winner: status.winner, loser: position.sideToMove }));
    events.push(factory.event('BattleCompleted', { battleId: state.battleId, ...result }));
    return { status: 'completed', result };
  }
  if (status.state === 'stalemate') {
    const result = { outcome: 'draw', winner: null, reason: 'stalemate' };
    events.push(factory.event('StalemateDeclared', { battleId: state.battleId }));
    events.push(factory.event('BattleCompleted', { battleId: state.battleId, ...result }));
    return { status: 'completed', result };
  }
  return { status: 'active', result: null };
}
function legalWardAwareCommands(state) {
  const inCheck = isInCheck(state.position, state.position.sideToMove, state.scenarioRules || {});
  return legalBattleCommands(state).filter((command) => !(protectedTarget(state, command) && inCheck));
}
function applyWardStatus(state, pieceId, options = {}) {
  const square = Object.entries(state.identities.bySquare).find(([, id]) => id === pieceId);
  if (!square) throw new Error(\`cannot ward inactive piece: \${pieceId}\`);
  const boardPiece = state.position.board[squareToIndex(square[0])];
  if (boardPiece.type === 'k') throw new Error('ward cannot be applied to a king');
  return applyBattleStatus(state, pieceId, 'ward', options);
}
function executeWardAwareCommand(state, request) {
  const target = protectedTarget(state, request);
  if (!target) return executeBattleCommand(state, request);
  if (isInCheck(state.position, state.position.sideToMove, state.scenarioRules || {})) throw new Error('protected capture cannot be used to leave own king in check');
  const actingSide = state.position.sideToMove;
  const attackerId = identityAt(state.identities, request.payload.from);
  const factory = envelopeFactory(state.envelope);
  const command = factory.command('MovePiece', request.payload, { battleId: state.battleId, actorSide: actingSide, actionIndex: state.actionIndex, interceptedByProtection: target.protection });
  const consumed = consumeStatus(state.statuses, target.pieceId, target.protection, 'capture_prevented');
  const events = [
    factory.event('CapturePrevented', {
      battleId: state.battleId,
      attackerId,
      protectedId: target.pieceId,
      protectedSquare: target.square,
      attemptedFrom: request.payload.from,
      attemptedTo: request.payload.to,
      protection: target.protection,
      guardianId: target.status.data.guardianId || null
    }),
    factory.event('StatusRemoved', { battleId: state.battleId, pieceId: target.pieceId, statusId: target.protection, reason: 'capture_prevented' })
  ];
  const advanced = advanceStatuses(consumed.state, { actingSide, actedPieceId: attackerId, sideByPiece: sideByPiece(state.identities) });
  for (const expired of advanced.expired) events.push(factory.event('StatusExpired', { battleId: state.battleId, pieceId: expired.pieceId, statusId: expired.id, expiryKind: expired.expirationReason }));
  const position = passActionPosition(state.position);
  const battleOutcome = outcome(state, position, factory, events);
  const scenarioRules = advanceScenarioRules(state.scenarioRules, state.actionIndex + 1, factory, state.battleId, events);
  const nextState = Object.freeze({
    ...state,
    position,
    statuses: advanced.state,
    scenarioRules,
    actionIndex: state.actionIndex + 1,
    status: battleOutcome.status,
    result: battleOutcome.result,
    envelope: factory.snapshot(),
    history: freezeArray([...state.history, command]),
    eventLog: freezeArray([...state.eventLog, ...events])
  });
  return Object.freeze({ state: nextState, command, events: freezeArray(events) });
}
function replayWardAware(initialState, requests) {
  let state = initialState;
  const events = [];
  for (const request of requests) {
    const result = executeWardAwareCommand(state, request);
    state = result.state;
    events.push(...result.events);
  }
  return Object.freeze({ state, events: freezeArray(events), finalFen: toFen(state.position) });
}
module.exports = { protectedTarget, wardedTarget, legalWardAwareCommands, applyWardStatus, executeWardAwareCommand, replayWardAware };
`);
}

function patchDeploymentGate() {
  let source = read('src/runtime/deployment-gate.cjs');
  source = replaceOnce(source,
    "    abilities: originalBattle.abilities,\n    orderPoints:",
    "    abilities: originalBattle.abilities,\n    scenarioRules: originalBattle.scenarioRules,\n    orderPoints:",
    'deployment scenario rules');
  write('src/runtime/deployment-gate.cjs', source);
}

function patchAbilityLabels() {
  let source = read('game/js/vertical-slice-presenter.mjs');
  source = replaceOnce(source,
    "    const name = payload.abilityId === 'ability.circle_warding' ? 'Круг защиты' : payload.abilityId;\n    return `${name} → ${payload.targetSquare || payload.targetId} · ${payload.effectiveOrderCost ?? payload.baseOrderCost ?? 0} ОП`;",
    `    const names = {
      'ability.circle_warding': 'Круг защиты',
      'ability.interpose': 'Перехват',
      'ability.chain_formation': 'Цепное построение',
      'ability.forge_line': 'Линия кузни',
      'ability.previewed_charge': 'Предсказанный натиск',
      'ability.hostage_tactic': 'Тактика заложника',
      'ability.gate_command': 'Команда ворот',
      'ability.royal_decree': 'Королевский указ',
      'ability.oath_fallen': 'Клятва павших'
    };
    const name = names[payload.abilityId] || payload.abilityId;
    const target = payload.via && payload.to ? \`\${payload.via} → \${payload.to}\` : payload.targetSquare || payload.to || payload.targetId;
    return \`\${name} → \${target} · \${payload.effectiveOrderCost ?? payload.baseOrderCost ?? 0} ОП\`;`,
    'ability labels');
  write('game/js/vertical-slice-presenter.mjs', source);
}

function patchRelicUi() {
  let source = read('game/js/vertical-slice-presenter-register-02.mjs');
  source = replaceOnce(source,
    "import { heroAssets, politicalPortrait } from './register-02-assets.mjs';",
    "import { heroAssets, politicalPortrait } from './register-02-assets.mjs';\nimport { relicProfile, relicAsset } from './register-03-relic-assets.mjs';",
    'army relic import');
  source = replaceOnce(source,
    "function armyPanelMarkup(snapshot) {",
    `function relicIconsMarkup(relicIds = []) {
  if (!relicIds.length) return '<small>Реликвии: нет</small>';
  return \`<span class="rpr02__relics">\${relicIds.map((id) => {
    const profile = relicProfile(id);
    const asset = relicAsset(id);
    return asset ? \`<span class="rpr02__relic" title="\${escapeAttribute(profile?.nameRu || id)}"><img src="\${escapeAttribute(asset)}" alt=""><small>\${escapeHtml(profile?.nameRu || id)}</small></span>\` : '';
  }).join('')}</span>\`;
}

function armyPanelMarkup(snapshot) {`,
    'army relic markup helper');
  source = replaceOnce(source,
    "        <small>${hero.relicIds?.length || 0} реликв.</small>",
    "        ${relicIconsMarkup(hero.relicIds)}",
    'army relic placeholders');
  source = replaceOnce(source,
    ".rpr02__army-hero small{color:#aebbd0}",
    ".rpr02__army-hero small{color:#aebbd0}.rpr02__relics{display:flex;gap:5px;flex-wrap:wrap}.rpr02__relic{display:flex;align-items:center;gap:4px;padding:3px 5px;border:1px solid rgba(211,178,96,.3);border-radius:7px;background:#0b1423}.rpr02__relic img{width:24px;height:24px;object-fit:contain}",
    'army relic styles');
  write('game/js/vertical-slice-presenter-register-02.mjs', source);

  source = read('game/js/register-02-codex.mjs');
  source = replaceOnce(source,
    "import { REGISTER_02_HERO_IDS, REGISTER_02_POLITICAL_IDS, heroAssets, politicalPortrait } from './register-02-assets.mjs';",
    "import { REGISTER_02_HERO_IDS, REGISTER_02_POLITICAL_IDS, heroAssets, politicalPortrait } from './register-02-assets.mjs';\nimport { RELIC_ROWS, relicProfile, relicAsset } from './register-03-relic-assets.mjs';",
    'codex relic import');
  const labelStart = source.indexOf('const RELIC_LABELS = Object.freeze({');
  if (labelStart < 0) throw new Error('codex relic labels start missing');
  const labelEnd = source.indexOf('\n});', labelStart);
  if (labelEnd < 0) throw new Error('codex relic labels end missing');
  source = source.slice(0, labelStart)
    + "const RELIC_LABELS = Object.freeze(Object.fromEntries(RELIC_ROWS.map((record) => [record.id, record.nameRu])));"
    + source.slice(labelEnd + 4);
  source = replaceOnce(source,
    "function heroAssetMarkup(profile, assetType, alt) {",
    `function relicMarkup(relicIds = []) {
  if (!relicIds.length) return '<span>Нет</span>';
  return \`<span class="rpr02__relic-list">\${relicIds.map((id) => {
    const profile = relicProfile(id);
    const asset = relicAsset(id);
    return \`<span class="rpr02__relic-chip"><img src="\${escapeAttribute(asset || '')}" alt=""><span>\${escapeHtml(profile?.nameRu || RELIC_LABELS[id] || id)}</span></span>\`;
  }).join('')}</span>\`;
}

function heroAssetMarkup(profile, assetType, alt) {`,
    'codex relic helper');
  source = source.replace("<dd>${relics.length ? relics.map((id) => escapeHtml(RELIC_LABELS[id] || id)).join(', ') : 'Нет'}</dd>", "<dd>${relicMarkup(relics)}</dd>");
  source = replaceOnce(source,
    ".rpr02__facts dd{margin:0;color:#eef4ff}",
    ".rpr02__facts dd{margin:0;color:#eef4ff}.rpr02__relic-list{display:flex;flex-wrap:wrap;gap:7px}.rpr02__relic-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 7px;border:1px solid #6e5c32;border-radius:8px;background:#111c2d}.rpr02__relic-chip img{width:34px;height:34px;object-fit:contain}",
    'codex relic styles');
  write('game/js/register-02-codex.mjs', source);
}

function writeTests() {
  write('tests/register-03-relic-assets.cjs', `'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/manifests/register-03-relics.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'content/audits/register_03_relic_assets.json'), 'utf8'));
assert.strictEqual(manifest.records.length, 72);
assert.strictEqual(audit.verifiedCount, 72);
assert.strictEqual(new Set(manifest.records.map((record) => record.id)).size, 72);
assert(audit.minimumSafeMarginRatio >= 0.12);
for (const record of manifest.records) {
  const target = path.join(root, 'game', record.path);
  assert(fs.existsSync(target), record.path);
  const bytes = fs.readFileSync(target);
  assert.strictEqual(bytes.readUInt32BE(16), 512, record.filename);
  assert.strictEqual(bytes.readUInt32BE(20), 512, record.filename);
  assert.strictEqual(bytes[25], 6, `${record.filename} must be RGBA`);
}
const browserModule = fs.readFileSync(path.join(root, 'game/js/register-03-relic-assets.mjs'), 'utf8');
for (const record of manifest.records) assert(browserModule.includes(record.path), record.path);
console.log('Register 03 relic assets: 72/72 passed.');
`);
  write('tests/remaining-iron-marches-abilities.cjs', `'use strict';
const assert = require('assert');
const { parseFen } = require('../src/core/chess/position.cjs');
const { createBattleState, legalBattleCommands, executeBattleCommand } = require('../src/combat/battle.cjs');
const { executeWardAwareCommand } = require('../src/combat/ward-protection.cjs');
const { statusFor } = require('../src/combat/statuses.cjs');

function battle(fen, identitiesBySquare, metadata, entries = [], passives = [], rules = {}) {
  return createBattleState({
    battleId: 'remaining_abilities', seed: 77, playerSide: 'w', position: parseFen(fen),
    identitiesBySquare, identityMetadata: metadata,
    orderPoints: { w: { current: 5, max: 5 }, b: { current: 5, max: 5 } },
    abilities: { entries, passives }, scenarioRules: rules
  });
}
function entry(kind, ownerId, abilityId, effectId, extras = {}) {
  return { instanceId: `${abilityId}:${ownerId}`, abilityId, effectId, sourceId: abilityId, ownerId, side: 'w', kind, orderCost: extras.orderCost ?? 1, maxUses: extras.maxUses ?? 1, used: 0, cooldownActions: extras.cooldownActions || 0, data: extras.data || {} };
}
function command(state, abilityId, predicate = () => true) {
  const found = legalBattleCommands(state).find((item) => item.type === 'UseAbility' && item.payload.abilityId === abilityId && predicate(item.payload));
  assert(found, `missing legal ${abilityId}`);
  return found;
}

{
  let state = battle('4k3/8/8/8/8/8/3P4/R3K3 w - - 0 1', { a1: 'aldric', d2: 'ally', e1: 'wk', e8: 'bk' }, { aldric: { side: 'w' }, ally: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('interpose', 'aldric', 'ability.interpose', 'effect.interpose_adjacent_ally')]);
  state = executeBattleCommand(state, command(state, 'ability.interpose')).state;
  assert.strictEqual(statusFor(state.statuses, 'ally').id, 'guarded');
}
{
  let state = battle('4k3/8/8/8/8/8/3PP3/4K3 w - - 0 1', { d2: 'mara', e2: 'ally', e1: 'wk', e8: 'bk' }, { mara: { side: 'w' }, ally: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('chain_formation', 'mara', 'ability.chain_formation', 'effect.advance_two_pawns')]);
  state = executeBattleCommand(state, command(state, 'ability.chain_formation')).state;
  assert.strictEqual(state.identities.bySquare.d3, 'mara');
  assert.strictEqual(state.identities.bySquare.e3, 'ally');
}
{
  let state = battle('4k3/8/8/8/8/8/2B5/4K3 w - - 0 1', { c2: 'orell', e1: 'wk', e8: 'bk' }, { orell: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('forge_line', 'orell', 'ability.forge_line', 'effect.temporary_line_blocker')]);
  const use = command(state, 'ability.forge_line');
  state = executeBattleCommand(state, use).state;
  assert(state.scenarioRules.blockedSquares.includes(use.payload.targetSquare));
}
{
  let state = battle('4k3/8/8/8/8/8/3N4/4K3 w - - 0 1', { d2: 'vael', e1: 'wk', e8: 'bk' }, { vael: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('previewed_charge', 'vael', 'ability.previewed_charge', 'effect.two_jump_charge', { orderCost: 2 })]);
  const use = command(state, 'ability.previewed_charge');
  state = executeBattleCommand(state, use).state;
  assert.strictEqual(state.identities.bySquare[use.payload.to], 'vael');
}
{
  let state = battle('4k3/8/8/8/3r4/8/3Q4/4K3 w - - 0 1', { d2: 'sorn', d4: 'enemy', e1: 'wk', e8: 'bk' }, { sorn: { side: 'w' }, enemy: { side: 'b' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('hostage_tactic', 'sorn', 'ability.hostage_tactic', 'effect.mutual_hostage_binding')]);
  state = executeBattleCommand(state, command(state, 'ability.hostage_tactic')).state;
  assert.strictEqual(statusFor(state.statuses, 'sorn').id, 'bound');
  assert.strictEqual(statusFor(state.statuses, 'enemy').id, 'bound');
}
{
  let state = battle('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1', { e2: 'tomas', e1: 'wk', e8: 'bk' }, { tomas: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('gate_command', 'tomas', 'ability.gate_command', 'effect.visible_gate_toggle', { maxUses: 2 })]);
  const use = command(state, 'ability.gate_command');
  state = executeBattleCommand(state, use).state;
  assert(state.scenarioRules.blockedSquares.includes(use.payload.targetSquare));
}
{
  let state = battle('4k3/3P4/8/8/8/8/8/4K3 w - - 0 1', { d7: 'pawn', e1: 'wk', e8: 'bk' }, { pawn: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('early_promotion', 'pawn', 'ability.royal_decree', 'effect.conditional_early_promotion', { orderCost: 2 })]);
  const use = command(state, 'ability.royal_decree', (payload) => payload.promotion === 'n');
  state = executeBattleCommand(state, use).state;
  assert.strictEqual(state.position.board[3].type, 'n');
}
{
  let state = battle('4k3/8/8/8/3r4/8/3P4/4K3 w - - 0 1', { d2: 'offering', d4: 'enemy', e1: 'wk', e8: 'bk' }, { offering: { side: 'w' }, enemy: { side: 'b' }, wk: { side: 'w' }, bk: { side: 'b' } }, [entry('declare_sacrifice', 'offering', 'ability.oath_fallen', 'effect.order_after_voluntary_sacrifice', { orderCost: 0, maxUses: 99, cooldownActions: 2 })]);
  const use = command(state, 'ability.oath_fallen', (payload) => payload.targetId === 'offering' || payload.targetId);
  state = executeBattleCommand(state, use).state;
  assert(statusFor(state.statuses, use.payload.targetId));
}
{
  let state = battle('4k3/8/8/8/8/8/3N4/4K3 w - - 0 1', { d2: 'knight', e1: 'wk', e8: 'bk' }, { knight: { side: 'w' }, wk: { side: 'w' }, bk: { side: 'b' } }, [], [{ instanceId: 'spurs:knight', effectId: 'effect.visible_evasion_after_non_capture', sourceId: 'relic.phantom_spurs', ownerId: 'knight', side: 'w', kind: 'evasion_after_non_capture', consumed: false }]);
  const move = legalBattleCommands(state).find((item) => item.type === 'MovePiece' && item.payload.from === 'd2');
  state = executeWardAwareCommand(state, move).state;
  assert.strictEqual(statusFor(state.statuses, 'knight').id, 'evasion');
}
console.log('Remaining Iron Marches abilities: 9/9 passed.');
`);
}

function updateAudit() {
  const relative = 'content/audits/iron_marches_mechanics_readiness.json';
  const audit = JSON.parse(read(relative));
  const evidence = {
    'ability.interpose': ['interpose', 'guarded'],
    'ability.chain_formation': ['chain_formation', 'FormationAdvanced'],
    'ability.forge_line': ['forge_line', 'BoardTopologyChanged'],
    'ability.previewed_charge': ['previewed_charge', 'PreviewedChargeCompleted'],
    'ability.hostage_tactic': ['hostage_tactic', 'mutual_hostage_binding'],
    'ability.gate_command': ['gate_command', 'visible_gate_toggle'],
    'effect.visible_evasion_after_non_capture': ['evasion_after_non_capture', 'evasion'],
    'effect.conditional_early_promotion': ['early_promotion', 'PawnPromoted'],
    'effect.order_after_voluntary_sacrifice': ['declare_sacrifice', 'VoluntarySacrificeResolved']
  };
  for (const record of [...audit.abilities, ...audit.relicEffects]) {
    if (!evidence[record.id]) continue;
    record.status = 'IMPLEMENTED';
    record.uiAvailability = 'enabled';
    record.reason = 'Механика исполняется детерминированным runtime-контрактом UseAbility/боевым пассивом, отображается в UI и покрыта регрессионными тестами.';
    record.evidence = [
      { path: record.id.startsWith('ability.') ? 'src/combat/abilities.cjs' : 'src/combat/iron-marches-hooks.cjs', tokens: evidence[record.id] },
      { path: 'tests/remaining-iron-marches-abilities.cjs', tokens: [record.id] }
    ];
  }
  write(relative, JSON.stringify(audit, null, 2) + '\n');
}

function updatePackage() {
  const relative = 'package.json';
  const pkg = JSON.parse(read(relative));
  for (const test of ['node tests/register-03-relic-assets.cjs', 'node tests/remaining-iron-marches-abilities.cjs']) {
    if (!pkg.scripts.test.includes(test)) pkg.scripts.test += ` && ${test}`;
  }
  write(relative, JSON.stringify(pkg, null, 2) + '\n');
}

copyBlockerFoundation();
patchStatuses();
patchBattle();
writeProtectionModule();
patchDeploymentGate();
patchAbilityLabels();
patchRelicUi();
writeTests();
updateAudit();
updatePackage();
console.log('Register 03 runtime/UI and remaining abilities patch applied.');
