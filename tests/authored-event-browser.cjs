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
  const presenter = await import(pathToFileURL(path.resolve(__dirname, '../game/js/event-aware-vertical-slice-presenter.mjs')).href);
  const snapshot = {
    format: 'rpchess-presenter-snapshot', schemaVersion: 1, runtimeId: 'event_browser', seed: 1, profileId: 'profile-1', status: 'event', playerSide: 'w',
    resources: { gold: 0, supplies: 10, meta: 0 }, flags: [], chronicleKeys: [],
    campaign: { graphId: 'g', act: 1, regionId: 'region.iron_marches', status: 'active', currentNodeId: 'event_node', bossNodeId: 'boss', supplies: 10, scouting: 1, visitedNodeIds: ['start', 'event_node'], traversedEdgeIds: ['edge'], nodes: [], routes: [] },
    currentNode: { nodeId: 'event_node', type: 'event', contentId: 'event.silent_foundry', reward: { gold: 1, supplies: 0, meta: 0 } },
    event: { eventId: 'event.silent_foundry', nodeId: 'event_node', status: 'active', title: 'Молчаливая кузница', body: 'Горны остыли.', sceneArt: null, scope: 'iron_marches', selectedChoiceId: null, choices: [
      { id: 'workers', label: 'Поддержать рабочих', effectCount: 2 },
      { id: 'crown', label: 'Поддержать корону', effectCount: 2 },
      { id: 'mediate', label: 'Посредничать', effectCount: 2 }
    ], outcome: null },
    scenario: null, reward: null, terminal: null, actions: ['ChooseEvent'], transcriptLength: 1, historyLength: 1
  };

  assert.strictEqual(client.validatePresenterSnapshot(snapshot).status, 'event');
  assert.deepStrictEqual(client.normalizeClientCommand({ type: 'ChooseEvent', choiceId: 'workers' }), { type: 'ChooseEvent', choiceId: 'workers' });
  assert.throws(() => client.normalizeClientCommand({ type: 'ChooseEvent' }), /choiceId/);
  const markup = presenter.eventChoiceMarkup(snapshot.event);
  assert.ok(markup.includes('data-event-choice="workers"'));
  assert.ok(markup.includes('Поддержать рабочих'));
  assert.strictEqual(markup.includes('effectIds'), false);
  const escaped = presenter.eventChoiceMarkup({ choices: [{ id: 'x', label: '<script>', effectCount: 0 }] });
  assert.ok(escaped.includes('&lt;script&gt;'));
  console.log('PASS browser validates and renders authored event choices safely');
  console.log('\nAuthored event browser: 1/1 passed.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
