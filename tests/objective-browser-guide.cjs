'use strict';

const assert = require('assert');
const { buildBrowserProductionBundle } = require('../src/browser/production-content-browser.cjs');
const { createBossFromTemplates } = require('../src/content/scenario-templates.cjs');
const { createRuntimeArmy } = require('../src/runtime/army-roster.cjs');
const { projectIronMarchesBattleOptions } = require('../src/runtime/iron-marches-mechanics.cjs');
const { legalBattleCommands } = require('../src/combat/battle.cjs');
const { toFen, indexToSquare } = require('../src/core/chess/position.cjs');
const { chooseObjectiveBrowserCommand } = require('./helpers/objective-browser-guide.cjs');

const bundle = buildBrowserProductionBundle();
const army = createRuntimeArmy({
  regionId:'region.iron_marches', kingId:'king.oathkeeper', doctrineId:'doctrine.fortress', heroIds:['hero.aldric_wall']
}, bundle.registry, bundle.combatProfiles);
const stageB = Object.freeze({ roster:Object.freeze([
  Object.freeze({ id:'king.oathkeeper', contentId:'king.oathkeeper', kind:'king', type:'k', active:true, available:true, skipBattles:0, relicIds:Object.freeze([]), talents:Object.freeze([]), stars:0, merits:0 }),
  Object.freeze({ id:'regular.pawn.fixture', kind:'regular', type:'p', active:true, available:true, skipBattles:0, relicIds:Object.freeze([]), talents:Object.freeze([]), stars:0, merits:0 })
]) });
const created = createBossFromTemplates(bundle.scenarioTemplates, 'boss.iron_regent', {
  seed:9042, playerSide:'w', battleProjector:(options) => projectIronMarchesBattleOptions(options, army, stageB)
});

function snapshotFor(battle, phaseIndex) {
  const pieces = Object.entries(battle.identities.bySquare).map(([square,id]) => {
    const piece = battle.position.board[require('../src/core/chess/position.cjs').squareToIndex(square)];
    return { id, pieceId:id, square, side:piece.side, type:piece.type, ...(battle.identities.metadata[id] || {}) };
  });
  return {
    seed:9042,
    status:'boss',
    playerSide:'w',
    currentNode:{ contentId:'boss.iron_regent' },
    boss:{ bossId:'boss.iron_regent', phaseIndex, phaseNumber:phaseIndex + 1 },
    scenario:{
      scenarioId:`boss_phase_${phaseIndex + 1}`,
      playerSide:'w',
      actionIndex:0,
      positionFen:toFen(battle.position),
      pieces,
      legalCommands:legalBattleCommands(battle),
      objectives:[{ id:'objective', mandatory:true, status:'active' }],
      environment:[]
    }
  };
}

const phaseOne = snapshotFor(created.state.scenario.battle, 0);
const first = chooseObjectiveBrowserCommand(phaseOne, bundle.scenarioTemplates);
assert.ok(first, 'guide must choose a phase-one command');
assert.notDeepStrictEqual([first.payload.from,first.payload.to], ['d1','d7'], 'guide must not sacrifice the required queen with Qd7');
assert.ok(phaseOne.scenario.legalCommands.some((command) => command.type === 'MovePiece' && command.payload.from === first.payload.from && command.payload.to === first.payload.to));

const phaseTwo = snapshotFor(created.battleForPhase(1), 1);
const mate = chooseObjectiveBrowserCommand(phaseTwo, bundle.scenarioTemplates);
assert.deepStrictEqual([mate.payload.from,mate.payload.to], ['g6','g7'], 'guide must select the authored Qg7#');

console.log(`Objective browser guide: safe phase-one ${first.payload.from}->${first.payload.to}, phase-two Qg7# passed.`);
