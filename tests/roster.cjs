const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

(async () => {
  const data = await import(pathToFileURL(path.join(game, 'js/roster-data.mjs')).href);
  const persistence = await import(pathToFileURL(path.join(game, 'js/run-persistence.mjs')).href);
  const roster = data.createStarterRoster();

  assert.strictEqual(roster.length, 6, 'starter roster must contain exactly six personalized characters');
  assert.strictEqual(roster[0].id, 'king.oathkeeper', 'Oathkeeper must be the starter king');
  assert.strictEqual(roster.filter((entry) => entry.isRunKing).length, 1, 'run must contain exactly one mandatory king');
  assert.strictEqual(roster.filter((entry) => entry.pieceType === 'king').length, 1, 'starter roster must contain one king role');
  assert.strictEqual(roster.filter((entry) => entry.pieceType === 'pawn').length, 2, 'starter roster must contain two pawns');
  assert.strictEqual(roster.filter((entry) => entry.pieceType === 'knight').length, 1, 'starter roster must contain one knight');
  assert.strictEqual(roster.filter((entry) => entry.pieceType === 'bishop').length, 1, 'starter roster must contain one bishop');
  assert.strictEqual(roster.filter((entry) => entry.pieceType === 'rook').length, 1, 'starter roster must contain one rook');
  assert.strictEqual(roster.filter((entry) => entry.pieceType === 'queen').length, 0, 'queen must remain a later valuable recruit');
  assert.strictEqual(data.rosterMaterialTotal(roster), 13, 'starter personalized non-king material total must be 13');
  assert.strictEqual(new Set(roster.map((entry) => entry.id)).size, roster.length, 'starter character IDs must be unique');
  assert(roster.every((entry) => entry.status === 'healthy'), 'all starter characters must begin healthy');

  for (const entry of roster) {
    assert(fs.existsSync(path.join(game, entry.portrait)), `starter portrait missing: ${entry.portrait}`);
    assert(fs.existsSync(path.join(game, entry.pieceArt)), `starter piece art missing: ${entry.pieceArt}`);
    assert.strictEqual(entry.commandCost, data.PIECE_VALUES[entry.pieceType], `wrong classic material cost for ${entry.id}`);
  }

  const storage = new MemoryStorage();
  const run = persistence.createRun({ now: 1000, id: 'run-test' });
  assert.strictEqual(run.id, 'run-test');
  assert.strictEqual(run.selectedCharacterId, 'king.oathkeeper');
  assert.strictEqual(persistence.readRun(storage), null, 'empty storage must not invent a run');
  const saved = persistence.writeRun(run, storage, 1200);
  assert.strictEqual(saved.updatedAt, 1200);
  assert.strictEqual(persistence.readRun(storage).roster.length, 6, 'saved starter roster must round-trip');

  const selected = { ...saved, selectedCharacterId: 'hero.aldric_wall' };
  persistence.writeRun(selected, storage, 1300);
  assert.strictEqual(persistence.readRun(storage).selectedCharacterId, 'hero.aldric_wall', 'selected roster character must persist');

  const wounded = persistence.readRun(storage);
  wounded.roster.find((entry) => entry.id === 'hero.mara_chain').status = 'wounded';
  wounded.roster.find((entry) => entry.id === 'hero.nemea_quill').status = 'dead';
  persistence.writeRun(wounded, storage, 1400);
  const statusRoundTrip = persistence.readRun(storage);
  assert.strictEqual(statusRoundTrip.roster.find((entry) => entry.id === 'hero.mara_chain').status, 'wounded');
  assert.strictEqual(statusRoundTrip.roster.find((entry) => entry.id === 'hero.nemea_quill').status, 'dead');

  storage.setItem(persistence.RUN_STORAGE_KEY, '{broken');
  assert.strictEqual(persistence.readRun(storage), null, 'corrupted run JSON must fail closed');

  const html = fs.readFileSync(path.join(game, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(game, 'js/roster-app.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(game, 'css/roster.css'), 'utf8');
  for (const token of ['data-roster-screen', 'data-continue-run', 'data-roster-detail', 'data-roster-list', 'data-roster-filter="dead"', 'js/roster-app.mjs', 'css/roster.css']) {
    assert(html.includes(token), `Roster HTML contract missing: ${token}`);
  }
  for (const forbidden of ['Применить состав', '39/39', '16/16', 'В ПУТЬ']) assert(!html.includes(forbidden), `future composition/travel UI leaked into Roster: ${forbidden}`);
  assert(!/data-roster[^>]*type=["']checkbox/i.test(html), 'Roster must not use checkbox selection');
  assert(app.includes("rpchess.reboot.v1.run") || fs.readFileSync(path.join(game, 'js/run-persistence.mjs'), 'utf8').includes("rpchess.reboot.v1.run"), 'Roster run persistence key missing');
  assert(css.includes('ui_panel_frame.png'), 'Roster framed panels must reuse approved dark frame treatment');
  assert(html.includes('ui-frame-safe'), 'Roster panels must use global framed safe-area contract');

  console.log('Roster model, persistence and static UX contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
