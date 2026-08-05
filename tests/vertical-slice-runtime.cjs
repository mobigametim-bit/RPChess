const assert = require('assert');
const { ContentRegistry } = require('../src/content/index.cjs');
const { generateActGraph } = require('../src/campaign/graph.cjs');
const { createCampaignState } = require('../src/campaign/state.cjs');
const { parseFen } = require('../src/core/chess/position.cjs');
const { hash32 } = require('../src/core/determinism.cjs');
const { createBattleState } = require('../src/combat/battle.cjs');
const { legalWardAwareCommands } = require('../src/combat/ward-protection.cjs');
const { createScenarioState } = require('../src/scenario/scenario.cjs');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { AtomicProfileStore } = require('../src/save/profile-store.cjs');
const {
  createVerticalSliceRuntime,
  availableVerticalSliceRoutes,
  enterVerticalSliceNode,
  executeVerticalSlicePlayerTurn,
  claimVerticalSliceReward,
  snapshotVerticalSlice,
  saveVerticalSlice,
  loadVerticalSlice,
  replayVerticalSlice
} = require('../src/runtime/vertical-slice.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const boardThemeManifest = {
  schemaVersion: 1,
  themes: [{
    id: 'neutral',
    light: 'assets/boards/neutral/tile_light.png',
    dark: 'assets/boards/neutral/tile_dark.png'
  }]
};

function verticalSlicePack() {
  return {
    schemaVersion: 1,
    packId: 'runtime_vertical_slice',
    content: {
      regions: [{
        id: 'region.iron_marches',
        nameKey: 'region.iron_marches.name',
        factionId: 'faction.iron_marches',
        boardThemeId: 'neutral'
      }],
      events: [{
        id: 'event.silent_foundry',
        nameKey: 'event.silent_foundry.name',
        titleKey: 'event.silent_foundry.title',
        bodyKey: 'event.silent_foundry.body',
        scope: 'iron_marches',
        choices: [
          { id: 'workers', textKey: 'event.silent_foundry.choice.workers', effectIds: ['effect.gold'] },
          { id: 'crown', textKey: 'event.silent_foundry.choice.crown', effectIds: ['effect.supplies'] },
          { id: 'mediate', textKey: 'event.silent_foundry.choice.mediate', effectIds: ['effect.meta'] }
        ]
      }],
      encounters: [{
        id: 'encounter.iron_crossfire',
        nameKey: 'encounter.iron_crossfire.name',
        regionId: 'region.iron_marches',
        board: { themeId: 'neutral', width: 8, height: 8 },
        objectiveKeys: ['encounter.iron_crossfire.objective']
      }],
      bosses: [{
        id: 'boss.iron_regent',
        nameKey: 'boss.iron_regent.name',
        regionId: 'region.iron_marches',
        phases: [
          { id: 'seals', titleKey: 'boss.iron_regent.phase.seals', objectiveKey: 'boss.iron_regent.objective.seals' },
          { id: 'mate', titleKey: 'boss.iron_regent.phase.mate', objectiveKey: 'boss.iron_regent.objective.mate' }
        ],
        assets: {
          portrait: 'assets/bosses/iron_regent/portrait.png',
          piece: 'assets/bosses/iron_regent/piece.png',
          arena: 'assets/bosses/iron_regent/arena.jpg',
          phaseTransition: 'assets/bosses/iron_regent/phase_transition.png',
          phaseSigils: ['assets/bosses/iron_regent/phase_01.png', 'assets/bosses/iron_regent/phase_02.png']
        }
      }]
    }
  };
}

function completeLocalization() {
  const dictionary = new Proxy({}, { get: (_target, key) => typeof key === 'string' ? key : undefined });
  return { ru: dictionary, en: dictionary };
}

function makeRegistry() {
  return new ContentRegistry({ boardThemeManifest })
    .addPack(verticalSlicePack())
    .finalize({ localization: completeLocalization() });
}

function makeGraph(seed = 9042) {
  return generateActGraph({
    seed,
    act: 1,
    nodeCount: 9,
    regionId: 'region.iron_marches',
    contentPools: {
      encounters: ['encounter.iron_crossfire'],
      events: ['event.silent_foundry'],
      bosses: ['boss.iron_regent'],
      shops: ['shop.field_quartermaster'],
      services: ['service.field_smith'],
      treasures: ['treasure.iron_cache']
    }
  });
}

function makeInitialRuntime(seed = 9042) {
  const registry = makeRegistry();
  const graph = makeGraph(seed);
  const campaign = createCampaignState(graph, { supplies: 99, scouting: 2 });
  return {
    registry,
    state: createVerticalSliceRuntime({
      runtimeId: `slice_${seed}`,
      seed,
      profileId: 1,
      playerSide: 'w',
      aiProfile: 'apprentice',
      campaign,
      contentRegistry: registry
    })
  };
}

function makeNodeResolver() {
  return ({ runtime, node, content }) => {
    if (['battle', 'elite', 'boss'].includes(node.type)) {
      const seed = hash32(`${runtime.seed}:${node.id}:${content.id}`);
      const battle = createBattleState({
        battleId: `battle_${runtime.seed}_${node.id}`,
        seed,
        playerSide: 'w',
        position: parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'),
        identitiesBySquare: { e1: 'king_w', e2: 'pawn_w', e8: 'king_b' }
      });
      const scenario = createScenarioState({
        scenarioId: `scenario_${runtime.seed}_${node.id}`,
        seed,
        playerSide: 'w',
        battle,
        objectives: [{
          id: `objective.survive_${node.id}`,
          type: 'survive_actions',
          side: 'w',
          requiredActions: 2,
          protectedPieceIds: ['king_w']
        }],
        failures: [{
          id: `failure.king_${node.id}`,
          type: 'piece_lost',
          side: 'w',
          targetPieceIds: ['king_w']
        }]
      });
      return {
        mode: 'scenario',
        scenario,
        reward: node.type === 'boss'
          ? { gold: 50, supplies: 2, meta: 1 }
          : { gold: node.type === 'elite' ? 20 : 10, supplies: 1 }
      };
    }
    return {
      mode: 'immediate',
      reward: {
        gold: node.type === 'event' ? 3 : 2,
        supplies: node.type === 'service' ? 1 : 0,
        meta: node.type === 'treasure' ? 1 : 0
      }
    };
  };
}

function playerPawnCommand(state) {
  const commands = legalWardAwareCommands(state.scenario.battle);
  const command = commands.find((candidate) => candidate.type === 'MovePiece' && candidate.payload.from === 'e2');
  assert.ok(command, 'expected a legal player pawn command');
  return command;
}

function advanceOneNode(state, dependencies) {
  const route = availableVerticalSliceRoutes(state)[0];
  assert.ok(route, 'expected an available campaign route');
  let next = enterVerticalSliceNode(state, route.to, dependencies);
  if (next.status === 'scenario') next = executeVerticalSlicePlayerTurn(next, playerPawnCommand(next), dependencies);
  assert.strictEqual(next.status, 'reward');
  return claimVerticalSliceReward(next);
}

function playToCompletion(initial, dependencies) {
  let state = initial;
  let guard = 0;
  while (state.status !== 'complete') {
    state = advanceOneNode(state, dependencies);
    guard += 1;
    if (guard > 12) throw new Error('vertical slice did not reach boss completion');
  }
  return state;
}

test('runtime validates compiled graph content and starts at the campaign gate', () => {
  const { state } = makeInitialRuntime();
  assert.strictEqual(state.status, 'campaign');
  assert.strictEqual(state.profileId, 'profile-1');
  assert.strictEqual(state.campaign.currentNodeId, 'start');
  assert.strictEqual(availableVerticalSliceRoutes(state).length > 0, true);

  const emptyRegistry = new ContentRegistry({ boardThemeManifest }).addPack({
    schemaVersion: 1,
    packId: 'empty',
    content: {}
  }).finalize();
  const graph = makeGraph(100);
  assert.throws(() => createVerticalSliceRuntime({
    campaign: createCampaignState(graph, { supplies: 99 }),
    contentRegistry: emptyRegistry
  }), /content validation failed/);
});

test('one player command resolves at most one deterministic AI action before reward', () => {
  const { registry, state } = makeInitialRuntime(9050);
  const dependencies = { contentRegistry: registry, nodeResolver: makeNodeResolver(), aiMaxNodes: 5000 };
  let active = state;
  while (active.status === 'campaign') {
    const route = availableVerticalSliceRoutes(active)[0];
    active = enterVerticalSliceNode(active, route.to, dependencies);
    if (active.status === 'reward') active = claimVerticalSliceReward(active);
  }
  assert.strictEqual(active.status, 'scenario');
  const result = executeVerticalSlicePlayerTurn(active, playerPawnCommand(active), dependencies);
  assert.strictEqual(result.status, 'reward');
  assert.strictEqual(result.scenario.battle.actionIndex, 2);
  assert.strictEqual(result.scenario.result.outcome, 'victory');
  const pair = result.history[result.history.length - 1];
  assert.strictEqual(pair.type, 'action_pair');
  assert.ok(pair.aiCommand);
  assert.strictEqual(pair.aiProfile, 'apprentice');
});

test('complete act composes campaign, scenarios, AI, rewards and boss completion', () => {
  const { registry, state } = makeInitialRuntime(9060);
  const dependencies = { contentRegistry: registry, nodeResolver: makeNodeResolver(), aiMaxNodes: 5000 };
  const completed = playToCompletion(state, dependencies);
  assert.strictEqual(completed.status, 'complete');
  assert.strictEqual(completed.campaign.status, 'completed');
  assert.strictEqual(completed.campaign.currentNodeId, 'boss');
  assert.strictEqual(completed.rewardLog.length, completed.campaign.visitedNodeIds.length - 1);
  assert.strictEqual(completed.resources.gold > 0, true);
  assert.strictEqual(completed.resources.meta >= 1, true);
  assert.strictEqual(completed.transcript.some((operation) => operation.type === 'PlayerCommand'), true);
});

test('full operation transcript replays to a byte-equivalent deterministic state', () => {
  const { registry, state } = makeInitialRuntime(9070);
  const dependencies = { contentRegistry: registry, nodeResolver: makeNodeResolver(), aiMaxNodes: 5000 };
  const completed = playToCompletion(state, dependencies);
  const replayed = replayVerticalSlice(state, completed.transcript, dependencies);
  assert.deepStrictEqual(snapshotVerticalSlice(replayed), snapshotVerticalSlice(completed));
});

test('atomic profile store saves, reloads and recovers a vertical slice checkpoint', () => {
  const { registry, state } = makeInitialRuntime(9080);
  const dependencies = { contentRegistry: registry, nodeResolver: makeNodeResolver(), aiMaxNodes: 5000 };
  const storage = new MemoryKeyValueStorage();
  let clock = 1000;
  const store = new AtomicProfileStore({ storage, deviceId: 'test-device', clock: () => clock++ });

  const checkpoint = advanceOneNode(state, dependencies);
  const first = saveVerticalSlice(store, checkpoint);
  assert.strictEqual(first.revision, 1);
  const loaded = loadVerticalSlice(store, 1, { contentRegistry: registry });
  assert.strictEqual(loaded.status, 'loaded');
  assert.deepStrictEqual(snapshotVerticalSlice(loaded.state), snapshotVerticalSlice(checkpoint));

  const later = advanceOneNode(checkpoint, dependencies);
  saveVerticalSlice(store, later);
  storage.setItem(store.keys(1).current, '{corrupt');
  const recovered = loadVerticalSlice(store, 1, { contentRegistry: registry });
  assert.strictEqual(recovered.status, 'recovered');
  assert.strictEqual(recovered.recoveredFrom, 'backup');
  assert.deepStrictEqual(snapshotVerticalSlice(recovered.state), snapshotVerticalSlice(checkpoint));
});

test('runtime blocks travel and reward operations outside their explicit gates', () => {
  const { registry, state } = makeInitialRuntime(9090);
  const dependencies = { contentRegistry: registry, nodeResolver: makeNodeResolver() };
  const route = availableVerticalSliceRoutes(state)[0];
  const entered = enterVerticalSliceNode(state, route.to, dependencies);
  assert.throws(() => enterVerticalSliceNode(entered, route.to, dependencies), /cannot travel/);
  assert.throws(() => claimVerticalSliceReward(state), /no pending/);
  if (entered.status === 'reward') assert.throws(() => executeVerticalSlicePlayerTurn(entered, { type: 'MovePiece', payload: {} }, dependencies), /no active/);
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
console.log(`\nVertical slice runtime: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
