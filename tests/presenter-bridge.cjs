const assert = require('assert');
const { ContentRegistry } = require('../src/content/index.cjs');
const { generateActGraph } = require('../src/campaign/graph.cjs');
const { createCampaignState } = require('../src/campaign/state.cjs');
const { parseFen } = require('../src/core/chess/position.cjs');
const { hash32 } = require('../src/core/determinism.cjs');
const { createBattleState } = require('../src/combat/battle.cjs');
const { createScenarioState } = require('../src/scenario/scenario.cjs');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { AtomicProfileStore } = require('../src/save/profile-store.cjs');
const { createVerticalSliceRuntime } = require('../src/runtime/vertical-slice.cjs');
const { createPresenterSnapshot, normalizePresenterCommand, dispatchPresenterCommand } = require('../src/runtime/presenter-bridge.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const boardThemeManifest = { schemaVersion: 1, themes: [{ id: 'neutral', light: 'assets/boards/neutral/tile_light.png', dark: 'assets/boards/neutral/tile_dark.png' }] };

function pack() {
  return {
    schemaVersion: 1,
    packId: 'presenter_slice',
    content: {
      regions: [{ id: 'region.iron_marches', nameKey: 'region.iron_marches.name', factionId: 'faction.iron_marches', boardThemeId: 'neutral' }],
      events: [{ id: 'event.silent_foundry', nameKey: 'event.silent_foundry.name', titleKey: 'event.silent_foundry.title', bodyKey: 'event.silent_foundry.body', scope: 'iron_marches', choices: [
        { id: 'workers', textKey: 'event.silent_foundry.choice.workers', effectIds: ['effect.gold'] },
        { id: 'crown', textKey: 'event.silent_foundry.choice.crown', effectIds: ['effect.supplies'] },
        { id: 'mediate', textKey: 'event.silent_foundry.choice.mediate', effectIds: ['effect.meta'] }
      ] }],
      encounters: [{ id: 'encounter.iron_crossfire', nameKey: 'encounter.iron_crossfire.name', regionId: 'region.iron_marches', board: { themeId: 'neutral', width: 8, height: 8 }, objectiveKeys: ['encounter.iron_crossfire.objective'] }],
      bosses: [{ id: 'boss.iron_regent', nameKey: 'boss.iron_regent.name', regionId: 'region.iron_marches', phases: [
        { id: 'seals', titleKey: 'boss.iron_regent.phase.seals', objectiveKey: 'boss.iron_regent.objective.seals' },
        { id: 'mate', titleKey: 'boss.iron_regent.phase.mate', objectiveKey: 'boss.iron_regent.objective.mate' }
      ], assets: {
        portrait: 'assets/bosses/iron_regent/portrait.png', piece: 'assets/bosses/iron_regent/piece.png', arena: 'assets/bosses/iron_regent/arena.jpg', phaseTransition: 'assets/bosses/iron_regent/phase_transition.png', phaseSigils: ['assets/bosses/iron_regent/phase_01.png', 'assets/bosses/iron_regent/phase_02.png']
      } }]
    }
  };
}

function fixture(seed) {
  const contentRegistry = new ContentRegistry({ boardThemeManifest }).addPack(pack()).finalize();
  const graph = generateActGraph({ seed, act: 1, nodeCount: 9, regionId: 'region.iron_marches', contentPools: {
    encounters: ['encounter.iron_crossfire'], events: ['event.silent_foundry'], bosses: ['boss.iron_regent'], shops: ['shop.field'], services: ['service.smith'], treasures: ['treasure.cache']
  } });
  const campaign = createCampaignState(graph, { supplies: 99, scouting: 2 });
  const state = createVerticalSliceRuntime({ runtimeId: `presenter_${seed}`, seed, profileId: 1, playerSide: 'w', aiProfile: 'apprentice', campaign, contentRegistry });
  return { contentRegistry, state };
}

function nodeResolver() {
  return ({ runtime, node }) => {
    if (!['battle', 'elite', 'boss'].includes(node.type)) return { mode: 'immediate', reward: { gold: 3, supplies: 1, meta: 0 } };
    const battle = createBattleState({
      battleId: `battle_${node.id}`, seed: hash32(`${runtime.seed}:${node.id}`), playerSide: 'w',
      position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
      identitiesBySquare: { e1: 'king_w', e2: 'pawn_w', e8: 'king_b' },
      identityMetadata: { pawn_w: { heroId: 'hero.test', stars: 1, relicIds: ['relic.test'] } }
    });
    const scenario = createScenarioState({
      scenarioId: `scenario_${node.id}`, seed: runtime.seed, playerSide: 'w', battle,
      objectives: [{ id: `objective.survive_${node.id}`, type: 'survive_actions', side: 'w', requiredActions: 2, protectedPieceIds: ['king_w'], previewKey: 'objective.survive' }],
      failures: [{ id: `failure.king_${node.id}`, type: 'piece_lost', side: 'w', targetPieceIds: ['king_w'], previewKey: 'failure.king' }],
      environment: [{ id: `environment.altar_${node.id}`, type: 'altar', visible: true, cells: ['d4'], interaction: 'hold', previewKey: 'environment.altar' }]
    });
    return { mode: 'scenario', scenario, reward: node.type === 'boss' ? { gold: 50, supplies: 2, meta: 1 } : { gold: 10, supplies: 1, meta: 0 } };
  };
}

function dependencies(contentRegistry) {
  return {
    contentRegistry, nodeResolver: nodeResolver(), aiMaxNodes: 5000,
    localization: { 'objective.survive': 'Survive two actions', 'failure.king': 'Protect the king', 'environment.altar': 'Visible altar' },
    boardThemes: { neutral: { id: 'neutral', light: 'assets/boards/neutral/tile_light.png', dark: 'assets/boards/neutral/tile_dark.png' } }
  };
}

function enterUntilScenario(initial, deps) {
  let state = initial;
  for (let guard = 0; guard < 10; guard += 1) {
    const route = createPresenterSnapshot(state, deps).campaign.routes[0];
    state = dispatchPresenterCommand(state, { type: 'Travel', targetNodeId: route.to }, deps).state;
    if (state.status === 'scenario') return state;
    if (state.status === 'reward') state = dispatchPresenterCommand(state, { type: 'ClaimReward' }, deps).state;
  }
  throw new Error('did not find scenario node');
}

function playerPawnCommand(state, deps) {
  return createPresenterSnapshot(state, deps).scenario.legalCommands.find((command) => command.type === 'MovePiece' && command.payload.from === 'e2');
}

test('campaign snapshot exposes routes and resources without runtime internals', () => {
  const { contentRegistry, state } = fixture(121);
  const snapshot = createPresenterSnapshot(state, dependencies(contentRegistry));
  assert.strictEqual(snapshot.format, 'rpchess-presenter-snapshot');
  assert.strictEqual(snapshot.status, 'campaign');
  assert.strictEqual(snapshot.resources.supplies, 99);
  assert.ok(snapshot.campaign.routes.length > 0);
  assert.deepStrictEqual(snapshot.actions, ['Travel']);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(snapshot, 'transcript'), false);
});

test('scenario snapshot contains board, identities, objectives, environment and legal commands', () => {
  const { contentRegistry, state: initial } = fixture(122);
  const deps = dependencies(contentRegistry);
  const state = enterUntilScenario(initial, deps);
  const snapshot = createPresenterSnapshot(state, deps);
  assert.strictEqual(snapshot.scenario.board.themeId, 'neutral');
  assert.strictEqual(snapshot.scenario.board.tileSet.light.endsWith('tile_light.png'), true);
  assert.strictEqual(snapshot.scenario.pieces.find((piece) => piece.pieceId === 'pawn_w').heroId, 'hero.test');
  assert.strictEqual(snapshot.scenario.objectives[0].label, 'Survive two actions');
  assert.strictEqual(snapshot.scenario.environment[0].cells[0], 'd4');
  assert.ok(playerPawnCommand(state, deps));
});

test('player command resolves one player/AI pair and projects the exact node reward', () => {
  const { contentRegistry, state: initial } = fixture(123);
  const deps = dependencies(contentRegistry);
  const active = enterUntilScenario(initial, deps);
  const expected = active.currentNode.reward;
  const result = dispatchPresenterCommand(active, { type: 'PlayerCommand', request: playerPawnCommand(active, deps) }, deps);
  assert.strictEqual(result.snapshot.status, 'reward');
  assert.deepStrictEqual({ gold: result.snapshot.reward.gold, supplies: result.snapshot.reward.supplies, meta: result.snapshot.reward.meta }, expected);
});

test('claim reward adds to existing resources and follows boss terminal routing', () => {
  const { contentRegistry, state: initial } = fixture(124);
  const deps = dependencies(contentRegistry);
  let state = enterUntilScenario(initial, deps);
  state = dispatchPresenterCommand(state, { type: 'PlayerCommand', request: playerPawnCommand(state, deps) }, deps).state;
  const before = { ...state.resources, supplies: state.campaign.supplies };
  const reward = state.pendingReward;
  const boss = state.currentNode.type === 'boss';
  const claimed = dispatchPresenterCommand(state, { type: 'ClaimReward' }, deps).snapshot;
  assert.strictEqual(claimed.status, boss ? 'complete' : 'campaign');
  assert.strictEqual(claimed.resources.gold, before.gold + reward.gold);
  assert.strictEqual(claimed.resources.meta, before.meta + reward.meta);
  assert.strictEqual(claimed.resources.supplies, before.supplies + reward.supplies);
});

test('save checkpoint uses atomic storage without changing runtime state', () => {
  const { contentRegistry, state } = fixture(125);
  const store = new AtomicProfileStore({ storage: new MemoryKeyValueStorage(), deviceId: 'presenter-test', clock: () => 1000 });
  const result = dispatchPresenterCommand(state, { type: 'SaveCheckpoint' }, { ...dependencies(contentRegistry), saveStore: store });
  assert.strictEqual(result.state, state);
  assert.strictEqual(result.saveEnvelope.revision, 1);
  assert.strictEqual(store.load(1).payload.runtimeId, state.runtimeId);
});

test('presenter command validation rejects undeclared writes', () => {
  assert.throws(() => normalizePresenterCommand({ type: 'Travel' }), /targetNodeId/);
  assert.throws(() => normalizePresenterCommand({ type: 'PlayerCommand' }), /request/);
  assert.throws(() => normalizePresenterCommand({ type: 'DeleteProfile' }), /unsupported/);
});

let failures = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}`); console.error(error.stack || error); }
}
console.log(`\nPresenter bridge: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
