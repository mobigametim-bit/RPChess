'use strict';

const { parseFen, squareToIndex } = require('../../src/core/chess/position.cjs');
const { createBattleState } = require('../../src/combat/battle.cjs');
const { makeMove, gameStatus, generateLegalMoves } = require('../../src/core/chess/rules.cjs');
const { hash32 } = require('../../src/core/determinism.cjs');

function activeIds(snapshot) {
  return new Set((snapshot?.scenario?.pieces || []).map((piece) => piece.id || piece.pieceId).filter(Boolean));
}
function currentObjective(snapshot, templates) {
  const progress = snapshot?.scenario?.objectives || [];
  const found = progress.findIndex((entry) => entry.mandatory !== false && entry.status !== 'completed');
  const index = found >= 0 ? found : 0;
  if (snapshot.status === 'boss') {
    const bossId = snapshot.boss?.bossId || snapshot.currentNode?.contentId;
    return templates.bosses?.[bossId]?.phases?.[Number(snapshot.boss?.phaseIndex || 0)]?.objectives?.[index] || null;
  }
  const eventCombatId = snapshot.currentNode?.eventCombat ? snapshot.event?.pendingCombat?.encounterId : null;
  const encounterId = eventCombatId || snapshot.currentNode?.contentId;
  return templates.encounters?.[encounterId]?.objectives?.[index] || null;
}
function remainingObjective(definition, snapshot) {
  if (!definition) return null;
  const ids = activeIds(snapshot);
  const objective = { ...definition };
  if (objective.targetPieceIds) objective.targetPieceIds = objective.targetPieceIds.filter((id) => ids.has(id));
  if (objective.protectedPieceIds) objective.protectedPieceIds = objective.protectedPieceIds.filter((id) => ids.has(id));
  return objective;
}
function battleFromSnapshot(snapshot) {
  const scenario = snapshot.scenario;
  const identitiesBySquare = {};
  const identityMetadata = {};
  for (const piece of scenario.pieces || []) {
    const id = piece.id || piece.pieceId;
    if (!id) continue;
    identitiesBySquare[piece.square] = id;
    identityMetadata[id] = { ...(piece.heroId ? { heroId:piece.heroId } : {}), ...(piece.relicIds ? { relicIds:piece.relicIds } : {}) };
  }
  const blockedSquares = (scenario.environment || []).filter((entry) => entry.passable === false || entry.type === 'blocker').flatMap((entry) => entry.cells || []);
  return createBattleState({
    battleId:`browser-guide-${scenario.scenarioId || 'scenario'}`,
    seed:hash32(`${snapshot.seed || 1}:${scenario.scenarioId || 'scenario'}:${scenario.actionIndex || 0}:guide`),
    playerSide:scenario.playerSide || 'w',
    position:parseFen(scenario.positionFen), identitiesBySquare, identityMetadata,
    scenarioRules:{ blockedSquares }, orderPoints:scenario.orderPoints || undefined
  });
}
function coord(square) { return { x:String(square).charCodeAt(0)-97, y:Number(String(square).slice(1))-1 }; }
function distance(a,b) { const aa=coord(a),bb=coord(b); return Math.max(Math.abs(aa.x-bb.x),Math.abs(aa.y-bb.y)); }
function targetSquares(definition,snapshot) {
  const wanted = new Set(definition?.targetPieceIds || []);
  return (snapshot.scenario?.pieces || []).filter((piece) => wanted.has(piece.id || piece.pieceId)).map((piece) => piece.square);
}
function simulated(battle,command) {
  try { return makeMove(battle.position,command.payload,battle.scenarioRules || {}).position; } catch (_error) { return null; }
}
function immediateLossPenalty(battle,command) {
  const next=simulated(battle,command); if(!next) return 100000;
  const destination=command.payload.to;
  const moving=next.board[squareToIndex(destination)];
  if(!moving) return 100000;
  const replies=generateLegalMoves(next,battle.scenarioRules || {});
  return replies.some((reply)=>reply.to===squareToIndex(destination)&&reply.capture) ? 10000 : 0;
}
function mateInOne(battle,legal) {
  for(const command of legal) {
    const next=simulated(battle,command); if(!next) continue;
    const status=gameStatus(next,battle.scenarioRules || {});
    if(status.state==='checkmate'&&status.winner===battle.playerSide) return command;
  }
  return null;
}
function chooseObjectiveBrowserCommand(snapshot,templates) {
  if(!snapshot?.scenario?.positionFen) return null;
  const legal=(snapshot.scenario.legalCommands||[]).filter((command)=>command.type==='MovePiece');
  if(!legal.length) return null;
  const definition=remainingObjective(currentObjective(snapshot,templates),snapshot)||{};
  const battle=battleFromSnapshot(snapshot);
  const mate=mateInOne(battle,legal);
  if(definition.type==='checkmate'&&mate) return mate;
  const targets=targetSquares(definition,snapshot);
  if(definition.type==='capture_targets'&&targets.length) {
    const direct=legal.find((command)=>targets.includes(command.payload.to));
    if(direct) return direct;
    return legal.slice().sort((a,b)=>{
      const as=immediateLossPenalty(battle,a)+Math.min(...targets.map((t)=>distance(a.payload.to,t)))*100;
      const bs=immediateLossPenalty(battle,b)+Math.min(...targets.map((t)=>distance(b.payload.to,t)))*100;
      return as-bs||`${a.payload.from}${a.payload.to}`.localeCompare(`${b.payload.from}${b.payload.to}`);
    })[0];
  }
  if(definition.type==='escort'&&definition.pieceId&&(definition.targetCells||[]).length) {
    const square=(snapshot.scenario.pieces||[]).find((piece)=>(piece.id||piece.pieceId)===definition.pieceId)?.square;
    const options=legal.filter((command)=>command.payload.from===square);
    if(options.length) return options.slice().sort((a,b)=>Math.min(...definition.targetCells.map((t)=>distance(a.payload.to,t)))-Math.min(...definition.targetCells.map((t)=>distance(b.payload.to,t)))||immediateLossPenalty(battle,a)-immediateLossPenalty(battle,b))[0];
  }
  if(definition.type==='occupy_cells'&&(definition.targetCells||[]).length) {
    const direct=legal.find((command)=>definition.targetCells.includes(command.payload.to)); if(direct) return direct;
    return legal.slice().sort((a,b)=>immediateLossPenalty(battle,a)-immediateLossPenalty(battle,b)||Math.min(...definition.targetCells.map((t)=>distance(a.payload.to,t)))-Math.min(...definition.targetCells.map((t)=>distance(b.payload.to,t))))[0];
  }
  const captures=legal.filter((command)=>snapshot.scenario.pieces.some((piece)=>piece.square===command.payload.to&&piece.side!==snapshot.scenario.playerSide));
  const pool=captures.length?captures:legal;
  return pool.slice().sort((a,b)=>immediateLossPenalty(battle,a)-immediateLossPenalty(battle,b)||`${a.payload.from}${a.payload.to}`.localeCompare(`${b.payload.from}${b.payload.to}`))[0];
}

module.exports={currentObjective,remainingObjective,battleFromSnapshot,chooseObjectiveBrowserCommand};
