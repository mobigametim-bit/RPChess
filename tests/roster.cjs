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
  const formation = await import(pathToFileURL(path.join(game,'js/roster-formation-core.mjs')).href);
  const skirmishCore = await import(pathToFileURL(path.join(game,'js/skirmish-core.mjs')).href);
  const run = persistence.createRun({ now: 1000, id: 'run-test' });
  assert.strictEqual(run.id, 'run-test');
  const initialFormation=formation.normalizedFormation(run);
  assert.strictEqual(Object.keys(initialFormation.squares).length,6,'initial Roster shows all six named heroes');
  assert.strictEqual(initialFormation.squares.e1,'king.oathkeeper');
  assert.deepStrictEqual(initialFormation.bench,[],'healthy starter party needs no reserves');
  assert.strictEqual(formation.placementForColor('a2','b'),'a7','saved formation mirrors ranks for black');
  const moved=formation.moveFormation(run,'hero.aldric_wall','h2');
  assert(moved.ok,'can reposition hero on two-rank board');
  assert.strictEqual(formation.normalizedFormation(moved.run).squares.h2,'hero.aldric_wall');
  const benched=formation.moveFormation(moved.run,'hero.mara_chain',null);
  assert(benched.ok,'hero can move from board to reserves');
  assert(!formation.formationSelectedIds(benched.run).includes('hero.mara_chain'));
  assert(formation.normalizedFormation(benched.run).bench.some(c=>c.id==='hero.mara_chain'));
  assert.strictEqual(formation.moveFormation(benched.run,'king.oathkeeper',null).reason,'king_required','king cannot enter reserves');
  const blackPlan=skirmishCore.createBattlePlan({
    roster:benched.run.roster,selectedIds:formation.formationSelectedIds(benched.run),
    formation:formation.normalizedFormation(benched.run).squares,
    encounter:{seed:'roster-black-preview',stars:2,playerColor:'b',enemyColor:'w'}
  });
  assert.strictEqual(blackPlan.playerFormation.find(c=>c.id==='hero.aldric_wall').square,'h7',
    'repositioned hero uses mirrored square in black-side Skirmish');
  assert(!blackPlan.playerFormation.some(c=>c.id==='hero.mara_chain'),'benched hero is absent from combat');
  const woundedFormation=formation.normalizedFormation({...benched.run,roster:benched.run.roster.map(c=>
    c.id==='hero.aldric_wall'?{...c,status:'wounded'}:c)});
  assert(woundedFormation.wounded.some(c=>c.id==='hero.aldric_wall'),'wounded hero leaves the field for Wounded section');
  assert(!Object.values(woundedFormation.squares).includes('hero.aldric_wall'));
  // A pawn may only start on the second rank; swapping cannot smuggle it home.
  const pawnStart=Object.entries(initialFormation.squares).find(([,id])=>id==='hero.mara_chain')[0];
  assert(pawnStart.endsWith('2'));
  assert.strictEqual(formation.moveFormation(run,'hero.mara_chain','a1').reason,'pawn_rank',
    'reject swaps that would put a pawn on the first rank');
  const extraBishop={...roster.find(c=>c.pieceType==='bishop'),id:'hero.extra_bishop',name:'Second bishop'};
  const bishopsRun={...run,roster:[...run.roster,extraBishop]};
  const bishopsFormation=formation.normalizedFormation(bishopsRun);
  const bishopSquares=Object.entries(bishopsFormation.squares).filter(([,id])=>[extraBishop.id,'hero.brother_orell'].includes(id));
  assert.strictEqual(bishopSquares.length,2);
  assert.notStrictEqual(formation.squareColor(bishopSquares[0][0]),formation.squareColor(bishopSquares[1][0]),
    'two bishops must occupy opposite square colors on the Roster board');
  assert.strictEqual(formation.moveFormation(bishopsRun,extraBishop.id,'a1').reason,'bishop_color',
    'swapping two same-colored-square bishops must be rejected');
  assert(formation.moveFormation(bishopsRun,extraBishop.id,'b1').ok,
    'a bishop may move to a legal opposite-color cell');
  const badSave={...bishopsRun,rosterFormation:{squares:{a1:'hero.mara_chain',c1:'hero.brother_orell',g1:extraBishop.id,e1:'king.oathkeeper'},reserveIds:[]}};
  const repaired=formation.normalizedFormation(badSave);
  const repairedBishops=Object.entries(repaired.squares).filter(([,id])=>[extraBishop.id,'hero.brother_orell'].includes(id));
  assert(Object.values(repaired.squares).includes('hero.mara_chain'));
  assert(Object.entries(repaired.squares).every(([sq,id])=>id!=='hero.mara_chain'||sq.endsWith('2')),
    'older saves with first-rank pawns automatically normalize to legal deployment');
  assert.notStrictEqual(formation.squareColor(repairedBishops[0][0]),formation.squareColor(repairedBishops[1][0]),
    'older saves with same-colored bishops automatically reassign second bishop');
  const savedFormation=persistence.writeRun(benched.run,new MemoryStorage(),1211);
  assert.deepStrictEqual(formation.normalizedFormation(savedFormation).squares,formation.normalizedFormation(benched.run).squares,
    'run persistence keeps manual formation coordinates');

  assert.strictEqual(run.selectedCharacterId, 'king.oathkeeper');
  assert.strictEqual(run.ended, false, 'new run must start active');
  assert.strictEqual(run.skirmishCount, 0, 'new run must start before the first Skirmish');
  assert.strictEqual(run.battleCount, 0, 'new run must start before the first Battle');
  assert.strictEqual(run.journeyStep, 0, 'new run must start before the first Travel fork');
  assert.strictEqual(run.currentTravelChoices, null);
  assert.strictEqual(run.activeTravelChoice, null);
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
  delete staleCopy.ended;
  delete staleCopy.skirmishCount;
  delete staleCopy.battleCount;
  delete staleCopy.journeyStep;
  delete staleCopy.currentTravelChoices;
  delete staleCopy.activeTravelChoice;
  storage.setItem(persistence.RUN_STORAGE_KEY, JSON.stringify(staleCopy));
  const hydratedCopy = persistence.readRun(storage);
  assert(hydratedCopy.roster[0].description.includes('Последний хранитель древней присяги'), 'saved runs must hydrate current Oathkeeper character copy');
  assert.strictEqual(hydratedCopy.roster.find((entry) => entry.id === 'hero.mara_chain').status, 'wounded', 'saved-run hydration must preserve gameplay status');
  assert.strictEqual(hydratedCopy.ended, false, 'pre-Skirmish Roster save must hydrate as active');
  assert.strictEqual(hydratedCopy.skirmishCount, 0, 'pre-Skirmish Roster save must hydrate with zero Skirmishes');
  assert.strictEqual(hydratedCopy.battleCount, 0, 'pre-Battle Roster save must hydrate with zero Battles');
  assert.strictEqual(hydratedCopy.journeyStep, 0, 'pre-Travel Roster save must hydrate at journey step zero');
  assert.strictEqual(hydratedCopy.currentTravelChoices, null);
  assert.strictEqual(hydratedCopy.activeTravelChoice, null);

  storage.setItem(persistence.RUN_STORAGE_KEY, '{broken');
  assert.strictEqual(persistence.readRun(storage), null, 'corrupted run JSON must fail closed');

  const html = fs.readFileSync(path.join(game, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(game, 'js/roster-app.mjs'), 'utf8');
  const persistenceSource = fs.readFileSync(path.join(game, 'js/run-persistence.mjs'), 'utf8');
  const uiSource = fs.readFileSync(path.join(game, 'localization/ui.mjs'), 'utf8');
  const css = fs.readFileSync(path.join(game, 'css/roster.css'), 'utf8');
  const foundationCss = fs.readFileSync(path.join(game, 'css/reboot-foundation.css'), 'utf8');
  for (const token of ['data-roster-screen', 'data-continue-run', 'data-roster-detail', 'data-roster-list', 'roster-formation-ui', 'data-roster-travel', 'Начать путешествие', 'js/roster-app.mjs', 'css/roster.css', 'css/roster-formation.css']) {
    assert(html.includes(token), `Roster HTML contract missing: ${token}`);
  }
  for (const forbidden of ['Применить состав', 'Именные фигуры, которые путешествуют вместе с вашим королём', 'Обязательная фигура текущего забега.', 'Готов к участию в будущих сражениях.']) {
    assert(!app.includes(forbidden), `removed Roster copy leaked into runtime: ${forbidden}`);
  }
  assert(app.includes("import { subscribe, t, translateLegacy } from './i18n.mjs'"),'Roster owner must render UI keys and content translations explicitly');
  for(const key of ['roster.ariaLabel','roster.filter.all','roster.journey','roster.returnSettlement','roster.commandPoints','roster.inFormation','piece.king','status.wounded'])assert(uiSource.includes(`'${key}'`),`localization registry missing Roster key: ${key}`);
  for(const key of ['roster.ariaLabel','roster.journey','roster.commandPoints'])assert(app.includes(`t('${key}'`)||app.includes(`t(\`${key}`),`Roster owner must call t() for ${key}`);
  assert(app.includes('renderFormationUI(rosterList,activeRun'),'Roster owner must render the real board instead of the old card/filter grid');
  assert(!app.includes('data-roster-filter'),'removed Roster filter buttons must not survive in runtime');
  assert(app.includes('subscribe(() =>')&&app.includes('contentText(heroNoteForId(character.id) || character.description)'),'Roster language changes must rerender owner UI and translated content without relying on document mutation');
  assert(!/journeyButton\.textContent\s*=\s*['"](?:Вернуться в поселение|В путь|Загрузка пути…)/.test(app),'Roster journey labels must not be hardcoded in runtime');
  assert(!/status\.textContent\s*=\s*STATUS_LABELS\[character\.status\]/.test(app),'Roster status presentation must use localized owner labels');
  assert(!/data-roster[^>]*type=["']checkbox/i.test(html), 'Roster must not use checkbox selection');
  assert(app.includes("rpchess.reboot.v1.run") || persistenceSource.includes("rpchess.reboot.v1.run"), 'Roster run persistence key missing');
  assert(persistenceSource.includes('hydrateCurrentRosterCopy'), 'saved runs must refresh current static character copy');
  assert(app.includes('async function ensureTravelChoiceReady()'), 'Start Journey must have an explicit Travel runtime readiness gate');
  assert(app.includes('globalThis.RPChessRouteReady'), 'Start Journey must await the asynchronous route bootstrap');
  assert(app.includes("await import('./travel-choice-app.mjs')"), 'Start Journey must be able to recover Travel Choice independently if the wider route bootstrap fails');
  assert(app.includes('travelChoice.open({ detail:'), 'Start Journey must open Travel Choice directly after readiness instead of dispatching a lossy early event');
  assert(!app.includes("setScene('menu');\n  globalThis.dispatchEvent(new CustomEvent('rpchess:travel-open'"), 'Start Journey must never expose the main menu before Travel Choice owns the transition');
  assert(!app.includes("new CustomEvent('rpchess:skirmish-open'"), 'Roster must no longer bypass Travel Choice with direct Skirmish routing');
  assert(html.includes('ui-panel-safe'), 'Roster panels must use the global frameless safe-area contract');
  assert(css.includes('border: 1px solid var(--ui-panel-border)'), 'Roster must use CSS-only panel edges');
  assert(css.includes('background: var(--ui-panel-bg)'), 'Roster must use global frameless panel surface tokens');
  assert(foundationCss.includes('--ui-panel-safe-left'), 'global frameless safe-area tokens are missing');
  assert(!css.includes('ui_panel_frame.png') && !css.includes('ui_panel_wide.png'), 'Roster must never use ornate panel frame assets');
  assert(css.includes("body.roster-active #app main.roster-screen .roster-catalog"), 'accepted compact Roster catalog layout must live in roster.css');
  const formationCss=fs.readFileSync(path.join(game,'css/roster-formation.css'),'utf8');
  assert(formationCss.includes('.rfc-board')&&formationCss.includes('.rfc-section--dead'),'new Roster board and status groups need their own responsive styling');
  assert(!fs.existsSync(path.join(game,'js/content/post-pages-ui-review2.mjs')), 'superseded review2 compatibility module must stay deleted');
  assert(!fs.existsSync(path.join(game,'js/post-pages-ui-polish.mjs')), 'retired post-pages presentation shim must stay deleted');
  assert(!fs.existsSync(path.join(game,'js/presentation-bootstrap.mjs')), 'retired presentation bootstrap must stay deleted');

  console.log('Roster model, persistence hydration, owner-keyed RU/EN rendering, race-safe Travel Choice routing and frameless static UX contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});