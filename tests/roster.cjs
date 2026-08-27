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
  assert(roster[0].description.includes('Последний хранитель древней присяги'), 'Oathkeeper must have character history instead of mechanical death copy');
  assert(!roster[0].description.includes('Его гибель завершает путешествие'), 'Oathkeeper detail must not repeat mechanical run-failure copy');

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

  const staleCopy = persistence.createRun({ now: 1500, id: 'run-stale-copy' });
  staleCopy.roster[0].description = 'Король отряда и центральная фигура текущего забега. Его гибель завершает путешествие.';
  staleCopy.roster.find((entry) => entry.id === 'hero.mara_chain').status = 'wounded';
  storage.setItem(persistence.RUN_STORAGE_KEY, JSON.stringify(staleCopy));
  const hydratedCopy = persistence.readRun(storage);
  assert(hydratedCopy.roster[0].description.includes('Последний хранитель древней присяги'), 'saved runs must hydrate current Oathkeeper character copy');
  assert.strictEqual(hydratedCopy.roster.find((entry) => entry.id === 'hero.mara_chain').status, 'wounded', 'saved-run hydration must preserve gameplay status');

  storage.setItem(persistence.RUN_STORAGE_KEY, '{broken');
  assert.strictEqual(persistence.readRun(storage), null, 'corrupted run JSON must fail closed');

  const html = fs.readFileSync(path.join(game, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(game, 'js/roster-app.mjs'), 'utf8');
  const persistenceSource = fs.readFileSync(path.join(game, 'js/run-persistence.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(game, 'css/roster.css'), 'utf8');
  const foundationCss = fs.readFileSync(path.join(game, 'css/reboot-foundation.css'), 'utf8');
  for (const token of ['data-roster-screen', 'data-continue-run', 'data-roster-detail', 'data-roster-list', 'data-roster-filter="dead"', 'data-roster-travel', 'Начать путешествие', 'js/roster-app.mjs', 'css/roster.css']) {
    assert(html.includes(token), `Roster HTML contract missing: ${token}`);
  }
  for (const forbidden of ['Применить состав', '39/39', '16/16', 'В ПУТЬ', 'Именные фигуры, которые путешествуют вместе с вашим королём', 'Обязательная фигура текущего забега.', 'Готов к участию в будущих сражениях.']) {
    assert(!html.includes(forbidden) && !app.includes(forbidden), `removed/future Roster copy leaked into runtime: ${forbidden}`);
  }
  assert(!/data-roster[^>]*type=["']checkbox/i.test(html), 'Roster must not use checkbox selection');
  assert(app.includes("rpchess.reboot.v1.run") || persistenceSource.includes("rpchess.reboot.v1.run"), 'Roster run persistence key missing');
  assert(persistenceSource.includes('hydrateCurrentRosterCopy'), 'saved runs must refresh current static character copy');
  assert(app.includes("new CustomEvent('rpchess:new-game'"), 'Start Journey must route into the current playable chess setup');
  assert(html.includes('ui-panel-safe'), 'Roster panels must use the global frameless safe-area contract');
  assert(css.includes('border: 1px solid var(--ui-panel-border)'), 'Roster must use CSS-only panel edges');
  assert(css.includes('background: var(--ui-panel-bg)'), 'Roster must use global frameless panel surface tokens');
  assert(foundationCss.includes('--ui-panel-safe-left'), 'global frameless safe-area tokens are missing');
  assert(!css.includes('ui_panel_frame.png') && !css.includes('ui_panel_wide.png'), 'Roster must never use ornate panel frame assets');

  console.log('Roster model, persistence hydration, concise copy, journey routing and frameless static UX contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
