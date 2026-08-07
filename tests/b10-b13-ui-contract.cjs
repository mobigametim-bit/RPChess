'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const index = read('game/index.html');
  const isolated = read('game/vertical-slice.html');
  const ui = read('game/js/b10-b13-production-ui.mjs');
  const css = read('game/css/b10-b13-production-ui.css');
  for (const html of [index, isolated]) {
    assert(html.includes('css/b10-b13-production-ui.css'));
    assert(html.includes('js/b10-b13-production-ui.mjs'));
    assert(html.indexOf('js/b10-b13-production-ui.mjs') < html.indexOf('js/vertical-slice-app.mjs'));
  }
  assert(ui.includes('forcedMarchChoice'));
  assert(ui.includes("type:'DecideSecret'"));
  assert(ui.includes("type:'ReopenBranch'"));
  assert(ui.includes('b10-event-probability'));
  assert(ui.includes('targetRelicId'));
  assert(ui.includes('conversionPreview'));
  assert(css.includes('@media(max-width:760px)'));
  assert(css.includes('.b10-secret-decision'));

  const client = await import(pathToFileURL(path.join(root, 'game/js/runtime-command-client.mjs')).href);
  assert(client.CLIENT_COMMANDS.includes('DecideSecret'));
  assert(client.CLIENT_COMMANDS.includes('CompleteSecret'));
  assert(client.CLIENT_COMMANDS.includes('ReopenBranch'));
  assert.deepStrictEqual(client.normalizeClientCommand({ type:'Travel', targetNodeId:'l2_n1', forcedMarchChoice:'gold_loss' }), { type:'Travel', targetNodeId:'l2_n1', forcedMarchChoice:'gold_loss' });
  assert.deepStrictEqual(client.normalizeClientCommand({ type:'UseService', offerId:'forge.reforge', targetRosterId:'r1', targetRelicId:'relic.a' }), { type:'UseService', offerId:'forge.reforge', targetRosterId:'r1', targetRelicId:'relic.a' });
  assert.deepStrictEqual(client.normalizeClientCommand({ type:'DecideSecret', decision:'enter' }), { type:'DecideSecret', decision:'enter' });
  assert.deepStrictEqual(client.normalizeClientCommand({ type:'ReopenBranch', nodeId:'l2_n2' }), { type:'ReopenBranch', nodeId:'l2_n2' });
  assert.throws(() => client.normalizeClientCommand({ type:'DecideSecret', decision:'peek' }), /enter or decline/);
  console.log('B10-B13 UI contract: forced march, secret choice, rare reopen, event disclosure, service relic target and responsive assets passed.');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
