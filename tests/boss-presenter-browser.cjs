const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

if (typeof global.CustomEvent !== 'function') {
  global.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) { super(type); this.detail = options.detail; }
  };
}

(async () => {
  const client = await import(pathToFileURL(path.resolve(__dirname, '../game/js/runtime-command-client.mjs')).href);
  const presenter = await import(pathToFileURL(path.resolve(__dirname, '../game/js/production-vertical-slice-presenter.mjs')).href);
  const common = {
    format: 'rpchess-presenter-snapshot', schemaVersion: 1, runtimeId: 'boss_browser', seed: 1, profileId: 'profile-1', playerSide: 'w',
    resources: { gold: 0, supplies: 10, meta: 0 }, flags: [], chronicleKeys: [],
    campaign: { graphId: 'g', act: 1, regionId: 'region.iron_marches', status: 'boss_reached', currentNodeId: 'boss', bossNodeId: 'boss', supplies: 10, scouting: 1, visitedNodeIds: ['start', 'boss'], traversedEdgeIds: ['edge'], nodes: [], routes: [] },
    currentNode: { nodeId: 'boss', type: 'boss', contentId: 'boss.iron_regent', reward: { gold: 30, supplies: 3, meta: 1 } },
    event: null, reward: null, terminal: null, transcriptLength: 1, historyLength: 1
  };
  const boss = {
    bossId: 'boss.iron_regent', status: 'awaiting_phase_transition', result: null,
    phaseIndex: 0, phaseNumber: 1, phaseCount: 2, currentPhaseId: 'furnace_seals', currentPhaseTitle: 'Печати горнов',
    nextPhaseId: 'collapsing_fortress', nextPhaseTitle: 'Падающая крепость',
    completedPhases: [{ phaseIndex: 0, phaseId: 'furnace_seals', outcome: 'victory', reason: 'scenario_objective', actionCount: 4 }]
  };
  const transition = { ...common, status: 'boss_transition', boss, scenario: { scenarioId: 'phase_one' }, actions: ['BeginBossPhase'] };
  assert.strictEqual(client.validatePresenterSnapshot(transition).status, 'boss_transition');
  assert.deepStrictEqual(client.normalizeClientCommand({ type: 'BeginBossPhase' }), { type: 'BeginBossPhase' });
  assert.strictEqual(presenter.bossPhaseLabel(boss), 'Фаза 1/2: Печати горнов');
  const markup = presenter.bossTransitionMarkup(boss);
  assert.ok(markup.includes('data-begin-boss-phase'));
  assert.ok(markup.includes('Падающая крепость'));
  assert.ok(markup.includes('furnace_seals'));
  const unsafe = presenter.bossTransitionMarkup({ ...boss, nextPhaseTitle: '<script>alert(1)</script>' });
  assert.strictEqual(unsafe.includes('<script>alert(1)</script>'), false);
  assert.ok(unsafe.includes('&lt;script&gt;'));
  assert.throws(() => client.validatePresenterSnapshot({ ...transition, boss: null }), /missing phase data/);
  console.log('PASS browser validates and renders boss phase transitions safely');
  console.log('\nBoss presenter browser: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
