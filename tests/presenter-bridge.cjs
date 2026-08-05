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
const {
  createPresenterSnapshot,
  normalizePresenterCommand,
  dispatchPresenterCommand
} = require('../src/runtime/presenter-bridge.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const boardThemeManifest = {
  schemaVersion: 1,
  themes: [{ id: 'neutral', light: 'assets/boards/neutral/tile_light.png', dark: 'assets/boards/neutral/tile_dark.png' }]
};

function pack() {
  return {
    schemaVersion: 1,
    packId: 'presenter_slice',
    content: {
      regions: [{ id: 'region.iron_marches', nameKey: 'region.iron_marches.name', factionId: 'faction.iron_marches', boardThemeId: 'neutral' }],
      events: [{
        id: 'event.silent_foundry', nameKey: 'event.silent_foundry.name', titleKey: 'event.silent_foundry.title', bodyKey: 'event.silent_foundry.body', scope: 'iron_marches',
        choices: [
          { id: 'workers', textKey: 'event.silent_foundry.choice.workers', effectIds: ['effect.gold'] },
          { id: 'crown', textKey: 'event.silent_foundry.choice.crown', effectIds: ['effect.supplies'] },
          { id: 'mediate', textKey: 'event.silent_foundry.choice.mediate', effectIds: ['effect.meta'] }
        ]
      }],
      encounters: [{
        id: 'encounter.iron_crossfire', nameKey: 'encounter.iron_crossfire.name', regionId: 'region.iron_marches',
        board: { themeId: 'neutral', width: 8, height: 8 }, objectiveKeys: ['encounter.iron_crossfire.objective']
      }],
      bosses: [{
        id: 'boss.iron_regent', nameKey: 'boss.iron_regent.name', regionId: 'region.iron_marches',
        phases: [
          { id: 'seals', titleKey: 'boss.iron_regent.phase.seals', objectiveKey: 'boss.iron_regent.objective.seals' },
          { id: 'mate', titleKey: 'boss.iron_regent.phase.mate', objectiveKey: 'boss.iron_regent.objective.mate' }
        ],
        assets: {
          portrait: 'assets/bosses/iron_regent/portrait.png', piece: 'assets/bosses/iron_regent/piece.png', arena: 'assets/bosses/iron_regent/arena.jpg',
          phaseTransition: 'assets/bosses/iron_regent/phase_transition.png',
          phaseSigils: ['assets/bosses/iron_regent/phase_01.png', 'assets/bosses/iron_regent/phase_02.png']
        }
      }]
    }
  };
}

function registry() {
  return new ContentRegistry({ boardThemeManifest }).addPack(pack()).finalize();
}

function runtime(seed = 111) {
  const contentRegistry = registry();
  const graph = generateActGraph({
    seed, act: 1, nodeCount: 9, regionId: 'region.iron_marches',
    contentPools: {
      encounters: ['encounter.iron_crossfire'], events: ['event.silent_foundry'], bosses: ['boss.iron_regent'],
      shops: ['shop.field'], services: ['service.smith'], treasures: ['treasure.cache']
    }
  });
  const campaign = createCampaignState(graph, { supplies: 99, scouting: 2 });
  return {
    contentRegistry,
    state: createVerticalSliceRuntime({ runtimeId: `presenter_${seed}`, seed, profileId: 1, playerSide: 'w', aiProfile: 'apprentice', campaign, contentRegistry })
  };
}

function nodeResolver() {
  return ({ runtime: state, node, content }) => {
    if (['battle', 'elite', 'boss'].includes(node.type)) {
      const battle = createBattleState({
        battleId: `battle_${node.id}`,
        seed: hash32(`${state.seed}:${node.id}`),
        playerSide: 'w',
        position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
        identitiesBySquare: { e1: 'king_w', e2: 'pawn_w', e8: 'king_b' },
        identityMetadata: { pawn_w: { heroId: 'hero.test', stars: 1, relicIds: ['relic.test'] } }
      });
      const scenario = createScenarioState({
        scenarioId: `scenario_${node.id}`,
        seed: state.seed,
        playerSide: 'w',
        battle,
        objectives: [{ id: `objective.survive_${node.id}`, type: 'survive_actions', side: 'w', requiredActions: 2, protectedPieceIds: ['king_w'], previewKey: 'objective.survive' }],
        failures: [{ id: `failure.king_${node.id}`, type: 'piece_lost', side: 'w', targetPieceIds: ['king_w'], previewKey: 'failure.king' }],
        environment: [{ id: `environment.altar_${node.id}`, type: 'altar', visible: true, cells: ['d4'], interaction: 'hold', previewKey: 'environment.altar' }]
      });
      return { mode: 'scenario', scenario, reward: node.type === 'boss' ? { gold: 50, supplies: 2, meta: 1 } : { gold: 10, supplies: 1 } };
    }
    return { mode: 'immediate', reward: { gold: 3, supplies: 1, meta: 0 } };
  };
}

function dependencies(contentRegistry) {
  return {
    contentRegistry,
    nodeResolver: nodeResolver(),
    aiMaxNodes: 5000,
    localization: {
      'objective.survive': 'Survive two actions',
      'failure.king': 'Protect the king',
      'environment.altar': 'Visible altar'
    },
    boardThemes: {
      neutral: { id: 'neutral', light: 'assets/boards/neutral/tile_light.png', dark: 'assets/boards/neutral/tile_dark.png' }
    }
  };
}

function enterUntilScenario(initial, deps) {
  let state = initial;
  for (let guard = 0; guard < 10; guard += 1) {
    const snapshot = createPresenterSnapshot(state, deps);
    const route = snapshot.campaign.routes[0];
    state = dispatchPresenterCommand(state, { type: 'Travel', targetNodeId: route.to }, deps).state;
    if (state.status === 'scenario') return state;
    if (state.status === 'reward') state = dispatchPresenterCommand(state, { type: 'ClaimReward' }, deps).state;
  }
  throw new Error('did not find scenario node');
}

test('campaign presenter snapshot exposes visible routes and resources without runtime internals', () => {
  const fixture = runtime(121);
  const deps = dependencies(fixture.contentRegistry);
  const snapshot = createPresenterSnapshot(fixture.state, deps);
  assert.strictEqual(snapshot.format, 'rpchess-presenter-snapshot');
  assert.strictEqual(snapshot.status, 'campaign');
  assert.strictEqual(snapshot.resources.supplies, 99);
  assert.ok(snapshot.campaign.routes.length > 0);
  assert.deepStrictEqual(snapshot.actions, ['Travel']);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(snapshot, 'transcript'), false);
});

test('scenario presenter contains modular board, pieces, objectives, environment and legal commands', () => {
  const fixture = runtime(122);
  const deps = dependencies(fixture.contentRegistry);
  const state = enterUntilScenario(fixture.state, deps);
  const snapshot = createPresenterSnapshot(state, deps);
  assert.strictEqual(snapshot.status, 'scenario');
  assert.strictEqual(snapshot.scenario.board.themeId, 'neutral');
  assert.strictEqual(snapshot.scenario.board.tileSet.light.endsWith('tile_light.png'), true);
  assert.strictEqual(snapshot.scenario.pieces.length, 3);
  assert.strictEqual(snapshot.scenario.pieces.find((piece) => piece.pieceId === 'pawn_w').heroId, 'hero.test');
  assert.strictEqual(snapshot.scenario.objectives[0].label, 'Survive two actions');
  assert.strictEqual(snapshot.scenario.environment[0].cells[0], 'd4');
  assert.ok(snapshot.scenario.legalCommands.some((command) => command.type === 'MovePiece' && command.payload.from === 'e2'));
});

test('bridge dispatches one player/AI pair and returns reward snapshot', () => {
  const fixture = runtime(123);
  const deps = dependencies(fixture.contentRegistry);
  const active = enterUntilScenario(fixture.state, deps);
  const before = createPresenterSnapshot(active, deps);
  const command = before.scenario.legalCommands.find((candidate) => candidate.type === 'MovePiece' && candidate.payload.from === 'e2');
  const result = dispatchPresenterCommand(active, { type: 'PlayerCommand', request: command }, deps);
  assert.strictEqual(result.state.status, 'reward');
  assert.strictEqual(result.snapshot.status, 'reward');
  assert.strictEqual(result.snapshot.reward.gold, 10);
  assert.deepStrictEqual(result.snapshot.actions, ['ClaimReward']);
});

test('claim reward returns to campaign and updates presenter resources', () => {
  const fixture = runtime(124);
  const deps = dependencies(fixture.contentRegistry);
  let state = enterUntilScenario(fixture.state, deps);
  const command = createPresenterSnapshot(state, deps).scenario.legalCommands.find((candidate) => candidate.type === 'MovePiece' && candidate.payload.from === 'e2');
  state = dispatchPresenterCommand(state, { type: 'PlayerCommand', request: command }, deps).state;
  const claimed = dispatchPresenterCommand(state, { type: 'ClaimReward' }, deps);
  assert.strictEqual(claimed.snapshot.status, 'campaign');
  assert.strictEqual(claimed.snapshot.resources.gold, 10);
  assert.strictEqual(claimed.snapshot.resources.supplies, 99 - claimed.state.campaign.history.find((item) => item.edgeId)?.cost + 1);
});

test('save checkpoint uses atomic store without changing runtime state', () => {
  const fixture = runtime(125);
  const deps = dependencies(fixture.contentRegistry);
  const store = new AtomicProfileStore({ storage: new MemoryKeyValueStorage(), deviceId: 'presenter-test', clock: () => 1000 });
  const result = dispatchPresenterCommand(fixture.state, { type: 'SaveCheckpoint' }, { ...deps, saveStore: store });
  assert.strictEqual(result.state, fixture.state);
  assert.strictEqual(result.saveEnvelope.revision, 1);
  assert.strictEqual(store.load(1).payload.runtimeId, fixture.state.runtimeId);
});

test('presenter command validation rejects malformed or unsupported writes', () => {
  assert.throws(() => normalizePresenterCommand({ type: 'Travel' }), /targetNodeId/);
  assert.throws(() => normalizePresenterCommand({ type: 'PlayerCommand' }), /request/);
  assert.throws(() => normalizePresenterCommand({ type: 'DeleteProfile' }), /unsupported/);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}
console.log(`\nPresenter bridge: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
