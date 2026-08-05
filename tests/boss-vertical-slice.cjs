const assert = require('assert');
const path = require('path');
const { buildProductionContentBundle } = require('../src/content/production-bundle.cjs');
const { generateActGraph } = require('../src/campaign/graph.cjs');
const { createCampaignState } = require('../src/campaign/state.cjs');
const { parseFen } = require('../src/core/chess/position.cjs');
const { createBattleState } = require('../src/combat/battle.cjs');
const { createBossPhaseState } = require('../src/scenario/boss-phases.cjs');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { AtomicProfileStore } = require('../src/save/profile-store.cjs');
const {
  createVerticalSliceRuntime,
  availableVerticalSliceRoutes,
  enterVerticalSliceNode,
  executeVerticalSlicePlayerTurn,
  beginVerticalSliceBossPhase,
  claimVerticalSliceReward,
  saveVerticalSlice,
  loadVerticalSlice,
  replayVerticalSlice
} = require('../src/runtime/vertical-slice.cjs');
const { createPresenterSnapshot, dispatchPresenterCommand } = require('../src/runtime/presenter-bridge.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const projectRoot = path.resolve(__dirname, '..');
const bundle = buildProductionContentBundle({ projectRoot });

function graph(seed = 707) {
  return generateActGraph({
    seed,
    act: 1,
    nodeCount: 9,
    regionId: 'region.iron_marches',
    contentPools: {
      encounters: bundle.registry.list('encounter').map((record) => record.id),
      events: bundle.registry.list('event').map((record) => record.id),
      bosses: ['boss.iron_regent'],
      shops: ['shop.field'], services: ['service.smith'], treasures: ['treasure.cache']
    }
  });
}

function phaseOneBattle(seed = 1) {
  return createBattleState({
    battleId: `boss_phase_one_${seed}`,
    seed,
    playerSide: 'w',
    position: parseFen('r3k3/8/8/8/8/8/8/R3K3 w - - 0 1'),
    identitiesBySquare: { a1: 'hero_rook', e1: 'player_king', a8: 'seal_rook', e8: 'iron_regent' }
  });
}

function phaseTwoBattle(seed = 2) {
  return createBattleState({
    battleId: `boss_phase_two_${seed}`,
    seed,
    playerSide: 'w',
    position: parseFen('7k/8/5KQ1/8/8/8/8/8 w - - 0 1'),
    identitiesBySquare: { f6: 'player_king', g6: 'hero_queen', h8: 'iron_regent' }
  });
}

function createTestBoss(seed = 31) {
  return createBossPhaseState({
    bossId: 'boss.iron_regent',
    seed,
    playerSide: 'w',
    initialBattle: phaseOneBattle(seed),
    phases: [
      {
        id: 'seal_test',
        titleKey: 'boss.iron_regent.phase.furnace_seals',
        objectives: [{ id: 'objective.capture_test_seal', type: 'capture_targets', side: 'w', targetPieceIds: ['seal_rook'] }],
        failures: [{ id: 'failure.test_king', type: 'piece_lost', side: 'w', targetPieceIds: ['player_king'] }],
        environment: [{ id: 'environment.test_seal', type: 'seal', visible: true, cells: ['a8'], interaction: 'destroy' }]
      },
      {
        id: 'mate_test',
        titleKey: 'boss.iron_regent.phase.collapsing_fortress',
        objectives: [{ id: 'objective.mate_test_regent', type: 'checkmate', side: 'w' }],
        failures: [{ id: 'failure.test_limit', type: 'action_limit', side: 'w', maxActions: 4 }],
        environment: []
      }
    ]
  });
}

function dependencies() {
  return {
    contentRegistry: bundle.registry,
    localization: bundle.localization.ru,
    boardThemes: Object.fromEntries(bundle.boardThemeManifest.themes.map((theme) => [theme.id, theme])),
    nodeResolver: ({ runtime, node }) => {
      if (node.type === 'boss') return { mode: 'boss', boss: createTestBoss(runtime.seed), reward: { gold: 30, supplies: 3, meta: 1 } };
      return { mode: 'immediate', reward: { gold: 0, supplies: 0, meta: 0 } };
    },
    bossPhaseBattleResolver: ({ boss }) => phaseTwoBattle(boss.seed + 1),
    aiMaxNodes: 4000,
    aiTimeBudgetMs: 0
  };
}

function reachBoss(initial, deps) {
  let state = initial;
  let guard = 0;
  while (state.campaign.currentNodeId !== state.campaign.graph.bossNodeId) {
    if (guard++ > 20) throw new Error('boss path guard exceeded');
    const route = availableVerticalSliceRoutes(state)[0];
    state = enterVerticalSliceNode(state, route.to, deps);
    if (state.status === 'reward') state = claimVerticalSliceReward(state);
  }
  return state;
}

function fixture(seed = 707) {
  const campaign = createCampaignState(graph(seed), { supplies: 99, scouting: 2 });
  const initial = createVerticalSliceRuntime({
    runtimeId: `boss_runtime_${seed}`,
    seed,
    profileId: 1,
    playerSide: 'w',
    aiProfile: 'apprentice',
    campaign,
    contentRegistry: bundle.registry
  });
  return { initial, deps: dependencies() };
}

test('boss node enters an explicit phase runtime and presenter snapshot', () => {
  const { initial, deps } = fixture(711);
  const state = reachBoss(initial, deps);
  assert.strictEqual(state.status, 'boss');
  assert.strictEqual(state.boss.currentPhaseId, 'seal_test');
  assert.strictEqual(state.boss.phaseIndex, 0);
  const snapshot = createPresenterSnapshot(state, deps);
  assert.strictEqual(snapshot.status, 'boss');
  assert.strictEqual(snapshot.boss.phaseNumber, 1);
  assert.strictEqual(snapshot.boss.phaseCount, 2);
  assert.strictEqual(snapshot.scenario.playerTurn, true);
  assert.deepStrictEqual(snapshot.actions, ['PlayerCommand']);
});

test('completing phase one creates a saved transition gate before phase two', () => {
  const { initial, deps } = fixture(712);
  let state = reachBoss(initial, deps);
  state = executeVerticalSlicePlayerTurn(state, { type: 'MovePiece', payload: { from: 'a1', to: 'a8' } }, deps);
  assert.strictEqual(state.status, 'boss_transition');
  assert.strictEqual(state.boss.status, 'awaiting_phase_transition');
  assert.strictEqual(state.boss.phaseHistory.length, 1);
  const snapshot = createPresenterSnapshot(state, deps);
  assert.strictEqual(snapshot.boss.nextPhaseId, 'mate_test');
  assert.deepStrictEqual(snapshot.actions, ['BeginBossPhase']);

  const store = new AtomicProfileStore({ storage: new MemoryKeyValueStorage(), deviceId: 'boss-test', clock: () => 5000 });
  saveVerticalSlice(store, state);
  const loaded = loadVerticalSlice(store, 1, { contentRegistry: bundle.registry });
  assert.strictEqual(loaded.state.status, 'boss_transition');
  assert.deepStrictEqual(loaded.state, state);
});

test('phase transition begins on the player side and mate completes the boss reward gate', () => {
  const { initial, deps } = fixture(713);
  let state = reachBoss(initial, deps);
  state = executeVerticalSlicePlayerTurn(state, { type: 'MovePiece', payload: { from: 'a1', to: 'a8' } }, deps);
  state = beginVerticalSliceBossPhase(state, deps);
  assert.strictEqual(state.status, 'boss');
  assert.strictEqual(state.boss.phaseIndex, 1);
  assert.strictEqual(state.boss.scenario.battle.position.sideToMove, 'w');
  state = executeVerticalSlicePlayerTurn(state, { type: 'MovePiece', payload: { from: 'g6', to: 'g7' } }, deps);
  assert.strictEqual(state.status, 'reward');
  assert.strictEqual(state.boss.result.outcome, 'victory');
  assert.strictEqual(state.pendingReward.meta, 1);
  state = claimVerticalSliceReward(state);
  assert.strictEqual(state.status, 'complete');
  assert.strictEqual(state.campaign.status, 'completed');
  assert.strictEqual(state.resources.meta, 1);
  assert.strictEqual(state.boss, null);
});

test('presenter dispatch supports the phase transition command but rejects it elsewhere', () => {
  const { initial, deps } = fixture(714);
  let state = reachBoss(initial, deps);
  assert.throws(() => dispatchPresenterCommand(state, { type: 'BeginBossPhase' }, deps), /not awaiting/);
  state = dispatchPresenterCommand(state, { type: 'PlayerCommand', request: { type: 'MovePiece', payload: { from: 'a1', to: 'a8' } } }, deps).state;
  const transitioned = dispatchPresenterCommand(state, { type: 'BeginBossPhase' }, deps);
  assert.strictEqual(transitioned.snapshot.status, 'boss');
  assert.strictEqual(transitioned.snapshot.boss.phaseNumber, 2);
});

test('boss phases and transition operations replay byte-equivalently', () => {
  const { initial, deps } = fixture(715);
  let live = reachBoss(initial, deps);
  live = executeVerticalSlicePlayerTurn(live, { type: 'MovePiece', payload: { from: 'a1', to: 'a8' } }, deps);
  live = beginVerticalSliceBossPhase(live, deps);
  live = executeVerticalSlicePlayerTurn(live, { type: 'MovePiece', payload: { from: 'g6', to: 'g7' } }, deps);
  live = claimVerticalSliceReward(live);
  const replayed = replayVerticalSlice(initial, live.transcript, deps);
  assert.deepStrictEqual(replayed, live);
});

let failures = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}`); console.error(error.stack || error); }
}
console.log(`\nBoss vertical slice: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
