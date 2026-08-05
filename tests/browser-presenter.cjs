const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

if (typeof global.CustomEvent !== 'function') {
  global.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) { super(type); this.detail = options.detail; }
  };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function snapshot(status = 'campaign') {
  return {
    format: 'rpchess-presenter-snapshot',
    schemaVersion: 1,
    runtimeId: 'browser_test',
    seed: 7,
    profileId: 'profile-1',
    status,
    playerSide: 'w',
    resources: { gold: 0, supplies: 9, meta: 0 },
    campaign: {
      graphId: 'act_1', act: 1, regionId: 'region.test', status: 'active', currentNodeId: 'start', bossNodeId: 'boss', supplies: 9, scouting: 1,
      visitedNodeIds: ['start'], traversedEdgeIds: [],
      nodes: [
        { id: 'start', layer: 0, type: 'start', visibility: 'content', visited: true, current: true, label: 'Start' },
        { id: 'l1_n1', layer: 1, type: 'battle', visibility: 'type', visited: false, current: false, label: 'battle' }
      ],
      routes: [{ edgeId: 'e1', from: 'start', to: 'l1_n1', cost: 1, affordable: true, visibility: 'type', type: 'battle', contentId: null, label: 'battle' }]
    },
    currentNode: null,
    scenario: null,
    reward: null,
    terminal: null,
    actions: ['Travel'],
    transcriptLength: 0,
    historyLength: 0
  };
}

(async () => {
  const clientModule = await import(pathToFileURL(path.resolve(__dirname, '../game/js/runtime-command-client.mjs')).href);
  const presenterModule = await import(pathToFileURL(path.resolve(__dirname, '../game/js/vertical-slice-presenter.mjs')).href);

  test('browser snapshot validator accepts the narrow presenter format', () => {
    assert.strictEqual(clientModule.validatePresenterSnapshot(snapshot()).runtimeId, 'browser_test');
    assert.throws(() => clientModule.validatePresenterSnapshot({}), /invalid RPChess presenter snapshot/);
    assert.throws(() => clientModule.validatePresenterSnapshot({ ...snapshot(), schemaVersion: 2 }), /unsupported/);
  });

  test('browser command normalizer permits only declared runtime writes', () => {
    assert.deepStrictEqual(clientModule.normalizeClientCommand({ type: 'Travel', targetNodeId: 'l1_n1' }), { type: 'Travel', targetNodeId: 'l1_n1' });
    assert.deepStrictEqual(clientModule.normalizeClientCommand({ type: 'PlayerCommand', request: { type: 'MovePiece', payload: { from: 'e2', to: 'e4' } } }), {
      type: 'PlayerCommand', request: { type: 'MovePiece', payload: { from: 'e2', to: 'e4' } }
    });
    assert.throws(() => clientModule.normalizeClientCommand({ type: 'Cheat' }), /unsupported/);
  });

  test('runtime client serializes pending commands and replaces snapshots from transport', async () => {
    const calls = [];
    const next = { ...snapshot(), resources: { gold: 2, supplies: 8, meta: 0 } };
    const client = new clientModule.RuntimeCommandClient({
      snapshot: snapshot(),
      transport: async (command, context) => { calls.push({ command, context }); return { snapshot: next }; }
    });
    const events = [];
    client.addEventListener('pending', (event) => events.push(event.detail.pending));
    const resolved = await client.dispatch({ type: 'Travel', targetNodeId: 'l1_n1' });
    assert.strictEqual(resolved.resources.gold, 2);
    assert.strictEqual(client.getSnapshot().resources.supplies, 8);
    assert.strictEqual(calls[0].context.sequence, 1);
    assert.deepStrictEqual(events, [true, false]);
  });

  test('presenter view helpers preserve chess and route semantics', () => {
    assert.strictEqual(presenterModule.pieceGlyph({ side: 'w', type: 'n' }), '♘');
    assert.strictEqual(presenterModule.pieceGlyph({ side: 'b', type: 'q' }), '♛');
    assert.strictEqual(presenterModule.commandLabel({ type: 'MovePiece', payload: { from: 'e7', to: 'e8', promotion: 'q' } }), 'e7 → e8 = Q');
    assert.deepStrictEqual(presenterModule.groupNodesByLayer(snapshot().campaign.nodes).map((group) => group.layer), [0, 1]);
  });

  test('legal target projection keeps every promotion choice for the selected square', () => {
    const scenario = {
      legalCommands: [
        { type: 'MovePiece', payload: { from: 'e7', to: 'e8', promotion: 'q' } },
        { type: 'MovePiece', payload: { from: 'e7', to: 'e8', promotion: 'n' } },
        { type: 'MovePiece', payload: { from: 'a2', to: 'a3' } }
      ]
    };
    const targets = presenterModule.legalTargets(scenario, 'e7');
    assert.strictEqual(targets.get('e8').length, 2);
    assert.strictEqual(targets.has('a3'), false);
  });

  test('presenter escaping blocks generated labels from injecting markup', () => {
    assert.strictEqual(presenterModule.escapeHtml('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
  });

  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error.stack || error);
    }
  }
  console.log(`\nBrowser presenter: ${tests.length - failures}/${tests.length} passed.`);
  if (failures) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
