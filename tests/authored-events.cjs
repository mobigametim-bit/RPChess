const assert = require('assert');
const { buildProductionContentBundle } = require('../src/content/production-bundle.cjs');
const { generateActGraph } = require('../src/campaign/graph.cjs');
const { createCampaignState } = require('../src/campaign/state.cjs');
const {
  createAuthoredEventState,
  resolveAuthoredEventChoice,
  applyFlagChanges
} = require('../src/runtime/authored-event.cjs');
const {
  createVerticalSliceRuntime,
  availableVerticalSliceRoutes,
  enterVerticalSliceNode,
  chooseVerticalSliceEvent,
  claimVerticalSliceReward,
  replayVerticalSlice
} = require('../src/runtime/vertical-slice.cjs');
const { createPresenterSnapshot, dispatchPresenterCommand } = require('../src/runtime/presenter-bridge.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function production() {
  return buildProductionContentBundle({ projectRoot: require('path').resolve(__dirname, '..') });
}

function eventGraphFixture() {
  const bundle = production();
  const pools = {
    events: bundle.registry.list('event').map((record) => record.id),
    encounters: bundle.registry.list('encounter').map((record) => record.id),
    bosses: bundle.registry.list('boss').map((record) => record.id),
    shops: ['shop.field'], services: ['service.smith'], treasures: ['treasure.cache']
  };
  for (let seed = 1; seed <= 1000; seed += 1) {
    const graph = generateActGraph({ seed, act: 1, nodeCount: 9, regionId: 'region.iron_marches', contentPools: pools });
    const campaign = createCampaignState(graph, { supplies: 20, scouting: 2 });
    const route = require('../src/campaign/state.cjs').availableRoutes(campaign).find((candidate) => graph.nodesById[candidate.to].type === 'event');
    if (route) return { bundle, graph, campaign, route, seed };
  }
  throw new Error('could not find deterministic event opening fixture');
}

function dependencies(bundle) {
  return {
    contentRegistry: bundle.registry,
    localization: bundle.localization.ru,
    nodeResolver: ({ node, content }) => {
      if (node.type === 'event') return { mode: 'event', reward: { gold: 1, supplies: 1, meta: 0 } };
      return { mode: 'immediate', reward: { gold: 0, supplies: 0, meta: 0 } };
    },
    eventChoiceResolver: ({ event, choice }) => ({
      resourceDelta: { gold: choice.id === 'workers' ? 2 : 0, supplies: choice.id === 'workers' ? -1 : 0, meta: 0 },
      addFlags: [`event.${event.eventId.split('.').pop()}.${choice.id}`],
      chronicleKeys: [`chronicle.${event.eventId.split('.').pop()}.${choice.id}`],
      outcomeKey: null
    })
  };
}

test('compiled event state exposes exactly the authored choices and no resolved outcome', () => {
  const bundle = production();
  const content = bundle.registry.get('event', 'event.silent_foundry');
  const state = createAuthoredEventState(content, { nodeId: 'l1_n1' });
  assert.strictEqual(state.eventId, 'event.silent_foundry');
  assert.strictEqual(state.choices.length, 3);
  assert.deepStrictEqual(state.choices.map((choice) => choice.id), ['workers', 'crown', 'mediate']);
  assert.strictEqual(state.status, 'active');
  assert.strictEqual(state.resolution, null);
});

test('choice resolution preserves declared effects and deterministic resource/flag changes', () => {
  const bundle = production();
  const event = createAuthoredEventState(bundle.registry.get('event', 'event.silent_foundry'), { nodeId: 'node' });
  const resolved = resolveAuthoredEventChoice(event, 'workers', ({ choice }) => ({
    resourceDelta: { gold: 2, supplies: -1, meta: 0 },
    addFlags: ['flag.workers_supported'],
    removeFlags: ['flag.crown_priority'],
    chronicleKeys: ['chronicle.silent_foundry.workers']
  }));
  assert.strictEqual(resolved.status, 'resolved');
  assert.deepStrictEqual(resolved.resolution.effectIds, event.choices[0].effectIds);
  assert.deepStrictEqual(applyFlagChanges(['flag.crown_priority', 'flag.old'], resolved.resolution), ['flag.old', 'flag.workers_supported']);
  assert.throws(() => resolveAuthoredEventChoice(event, 'missing', () => ({})), /has no choice/);
});

test('runtime enters an authored event gate instead of granting an automatic reward', () => {
  const fixture = eventGraphFixture();
  const deps = dependencies(fixture.bundle);
  const runtime = createVerticalSliceRuntime({
    runtimeId: 'authored_event_gate', seed: fixture.seed, profileId: 1, playerSide: 'w', campaign: fixture.campaign, contentRegistry: fixture.bundle.registry
  });
  const entered = enterVerticalSliceNode(runtime, fixture.route.to, deps);
  assert.strictEqual(entered.status, 'event');
  assert.strictEqual(entered.pendingReward, null);
  assert.strictEqual(entered.event.status, 'active');
  assert.strictEqual(availableVerticalSliceRoutes(entered).length, 0);
  assert.throws(() => claimVerticalSliceReward(entered), /no pending/);
});

test('choosing an event applies immediate consequences, records history and opens the reward gate', () => {
  const fixture = eventGraphFixture();
  const deps = dependencies(fixture.bundle);
  const runtime = createVerticalSliceRuntime({ runtimeId: 'authored_event_choice', seed: fixture.seed, profileId: 1, playerSide: 'w', campaign: fixture.campaign, contentRegistry: fixture.bundle.registry });
  const entered = enterVerticalSliceNode(runtime, fixture.route.to, deps);
  const suppliesBefore = entered.campaign.supplies;
  const chosen = chooseVerticalSliceEvent(entered, 'workers', deps);
  assert.strictEqual(chosen.status, 'reward');
  assert.strictEqual(chosen.resources.gold, 2);
  assert.strictEqual(chosen.campaign.supplies, suppliesBefore - 1);
  assert.ok(chosen.flags.includes('event.silent_foundry.workers'));
  assert.ok(chosen.chronicleKeys.includes('chronicle.silent_foundry.workers'));
  assert.strictEqual(chosen.history.at(-1).type, 'event_choice');
  assert.strictEqual(chosen.transcript.at(-1).type, 'ChooseEvent');
  const claimed = claimVerticalSliceReward(chosen);
  assert.strictEqual(claimed.resources.gold, 3);
  assert.strictEqual(claimed.event, null);
});

test('presenter exposes localized event copy but not hidden effect IDs', () => {
  const fixture = eventGraphFixture();
  const deps = dependencies(fixture.bundle);
  const runtime = createVerticalSliceRuntime({ runtimeId: 'authored_event_presenter', seed: fixture.seed, profileId: 1, playerSide: 'w', campaign: fixture.campaign, contentRegistry: fixture.bundle.registry });
  const entered = enterVerticalSliceNode(runtime, fixture.route.to, deps);
  const snapshot = createPresenterSnapshot(entered, deps);
  assert.strictEqual(snapshot.status, 'event');
  assert.strictEqual(snapshot.event.title, 'Молчаливая кузница');
  assert.strictEqual(snapshot.event.choices.length, 3);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(snapshot.event.choices[0], 'effectIds'), false);
  assert.deepStrictEqual(snapshot.actions, ['ChooseEvent']);
  const result = dispatchPresenterCommand(entered, { type: 'ChooseEvent', choiceId: 'workers' }, deps);
  assert.strictEqual(result.snapshot.status, 'reward');
});

test('event operations replay byte-equivalently and resource underflow is rejected', () => {
  const fixture = eventGraphFixture();
  const deps = dependencies(fixture.bundle);
  const initial = createVerticalSliceRuntime({ runtimeId: 'authored_event_replay', seed: fixture.seed, profileId: 1, playerSide: 'w', campaign: fixture.campaign, contentRegistry: fixture.bundle.registry });
  const operations = [
    { type: 'Travel', targetNodeId: fixture.route.to },
    { type: 'ChooseEvent', choiceId: 'workers' },
    { type: 'ClaimReward' }
  ];
  let live = enterVerticalSliceNode(initial, fixture.route.to, deps);
  live = chooseVerticalSliceEvent(live, 'workers', deps);
  live = claimVerticalSliceReward(live);
  assert.deepStrictEqual(replayVerticalSlice(initial, operations, deps), live);

  const entered = enterVerticalSliceNode(initial, fixture.route.to, deps);
  assert.throws(() => chooseVerticalSliceEvent(entered, 'workers', {
    ...deps,
    eventChoiceResolver: () => ({ resourceDelta: { gold: -1, supplies: 0, meta: 0 } })
  }), /gold negative/);
  assert.strictEqual(entered.status, 'event');
});

let failures = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}`); console.error(error.stack || error); }
}
console.log(`\nAuthored events: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
