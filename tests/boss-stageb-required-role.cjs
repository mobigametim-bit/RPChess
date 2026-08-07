'use strict';

const assert = require('assert');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const { createRuntimeArmy } = require('../src/runtime/army-roster.cjs');
const { projectIronMarchesBattleOptions } = require('../src/runtime/iron-marches-mechanics.cjs');
const { createBossFromTemplates } = require('../src/content/scenario-templates.cjs');
const { gameStatus, makeMove } = require('../src/core/chess/rules.cjs');

const bundle = buildBrowserProductionBundle();
const army = createRuntimeArmy({
  regionId:'region.iron_marches',
  kingId:'king.oathkeeper',
  doctrineId:'doctrine.fortress',
  heroIds:['hero.aldric_wall']
}, bundle.registry, bundle.combatProfiles);

// Deliberately no active queen in the Stage B roster. Boss puzzle roles declared
// by the authored scenario must survive roster projection instead of becoming
// impossible solely because the run did not draft a queen.
const stageB = Object.freeze({
  roster:Object.freeze([
    Object.freeze({ id:'king.oathkeeper', contentId:'king.oathkeeper', kind:'king', type:'k', name:'Хранитель клятвы', active:true, available:true, skipBattles:0, relicIds:Object.freeze([]), talents:Object.freeze([]), stars:0, merits:0 }),
    Object.freeze({ id:'regular.pawn.fixture', kind:'regular', type:'p', name:'Пехотинец', active:true, available:true, skipBattles:0, relicIds:Object.freeze([]), talents:Object.freeze([]), stars:0, merits:0 })
  ])
});

const created = createBossFromTemplates(bundle.scenarioTemplates, 'boss.iron_regent', {
  seed:9042,
  playerSide:'w',
  battleProjector:(options) => projectIronMarchesBattleOptions(options, army, stageB)
});

for (const battle of [created.state.scenario.battle, created.battleForPhase(1)]) {
  const square = Object.entries(battle.identities.bySquare).find(([,pieceId]) => pieceId === 'lady_sorn')?.[0];
  assert.ok(square, 'authored Lady Sorn tactical role was removed by Stage B roster projection');
  const piece = battle.position.board[require('../src/core/chess/position.cjs').squareToIndex(square)];
  assert.strictEqual(piece?.type, 'q', 'authored boss tactical role must remain a queen');
  assert.strictEqual(battle.identities.metadata.lady_sorn.heroId, undefined, 'unselected Lady Sorn must remain anonymous');
  assert.strictEqual(battle.identities.metadata.lady_sorn.fixedScenarioRole, true, 'preserved boss role must be marked fixed');
}

const phaseTwo = created.battleForPhase(1);
const result = makeMove(phaseTwo.position, { from:'g6', to:'g7' }, phaseTwo.scenarioRules || {});
const status = gameStatus(result.position, phaseTwo.scenarioRules || {});
assert.strictEqual(status.state, 'checkmate');
assert.strictEqual(status.winner, 'w');

console.log('Boss Stage B required role: queen preserved without drafted queen and Qg7# remains legal.');
