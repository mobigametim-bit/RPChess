/* Replay-safe weekly Battle command contract. No changes to first-conquest rewards. */
import {weekForDay,isOwned} from './kingdom-map-core.mjs';
import {SLOT_CAPACITY,createBattlePlan} from './battle-core.mjs';
import {armyCandidates,consumeCapturedRecruits} from './kingdom-army-core.mjs';
import {mercenaryQuote,SUPPLY_GOLD_VALUE} from './battle-mercenaries.mjs';
import {combatGoldReward} from './resources-core.mjs';
import {normalizeHeroMastery,awardMastery,threatLevel} from './hero-threat.mjs';

const FREE_KING=Object.freeze({id:'weekly:free-king',name:'Король',pieceType:'king',status:'healthy',isRunKing:true,isArmyRecruit:false});
function weeklyState(run){
 const w=run?.weeklyDefenders;
 return {active:w?.active||null,receipts:Array.isArray(w?.receipts)?w.receipts:[]};
}
function eligibleWeeklySite(map,id){
 const cell=map?.cells?.[id];
 return Boolean(cell?.status==='completed'&&cell?.completedOnce&&
  cell?.selectedEncounter?.type==='battle'&&cell?.production?.kind==='battle'&&
  cell?.respawnReady===true&&isOwned(map,id));
}
function canCommand(run,id,heroId){
 const map=run?.kingdomMap,hero=run?.roster?.find(c=>c.id===heroId),week=weekForDay(map?.day);
 if(!run||run.ended||!map||!eligibleWeeklySite(map,id))return {ok:false,reason:'site'};
 if(weeklyState(run).active||map.pendingCell||run.currentCombat||run.activeTravelChoice)
  return {ok:false,reason:'busy'};
 if(!hero||hero.status!=='healthy')return {ok:false,reason:'hero'};
 if(hero.weeklyCommandedWeek===week)return {ok:false,reason:'used'};
 return {ok:true,hero,week,mode:hero.isRunKing?'manual':'auto',cell:map.cells[id]};
}
function weeklyArmyPlan(run,cell){
 const roster=[FREE_KING,...armyCandidates(run)],ids=[FREE_KING.id],count={};
 for(const type of ['queen','rook','bishop','knight','pawn'])count[type]=0;
 for(const piece of roster.slice(1)){
  if(count[piece.pieceType]<SLOT_CAPACITY[piece.pieceType]){
   ids.push(piece.id);count[piece.pieceType]++;
  }
 }
 const encounter={...cell.selectedEncounter,type:'battle',playerColor:cell.selectedEncounter.playerColor==='b'?'b':'w'};
 return {...createBattlePlan({roster,selectedIds:ids,encounter}),roster};
}
function weeklyQuote(run,id,heroId){
 const check=canCommand(run,id,heroId);if(!check.ok)return check;
 const plan=weeklyArmyPlan(run,check.cell);
 const quote=mercenaryQuote(plan.roster,plan.selectedIds);
 const gold=Math.max(0,Number(run.gold)||0),supplies=Math.max(0,Number(run.supplies)||0);
 const chargedGold=Math.min(gold,quote.totalCost);
 const shortage=Math.max(0,quote.totalCost-chargedGold);
 const chargedSupplies=Math.min(supplies,Math.ceil(shortage/SUPPLY_GOLD_VALUE));
 const unpaidValue=Math.max(0,quote.totalCost-chargedGold-chargedSupplies*SUPPLY_GOLD_VALUE);
 return {...check,plan,quote,payment:{chargedGold,chargedSupplies,unpaidValue}};
}
function startWeeklyBattle(run,id,heroId,{acceptDebt=false}={}){
 const offer=weeklyQuote(run,id,heroId);
 if(!offer.ok)return offer;
 if(offer.payment.unpaidValue>0&&!acceptDebt)return {ok:false,reason:'debt-confirm',offer};
 const {plan,payment,hero,week,mode,cell}=offer;
 const receiptId=[run.id,'weekly-battle',week,id,heroId].join(':');
 if(weeklyState(run).receipts.includes(receiptId))return {ok:false,reason:'settled'};
 const nextCell={...cell,production:null,respawnReady:false};
 const map={...run.kingdomMap,cells:{...run.kingdomMap.cells,[id]:nextCell}};
 const active={receiptId,week,cellId:id,heroId,heroName:hero.name,mode,
  playerColor:plan.playerColor,enemyLevel:threatLevel(cell.selectedEncounter.stars),
  heroLevel:threatLevel(hero.threatLevel),paid:payment,selectionIds:plan.selectedIds,
  formation:plan.playerFormation,moves:[],status:'playing'};
 const roster=run.roster.map(c=>c.id===heroId?
   {...normalizeHeroMastery(c),weeklyCommandedWeek:week}:c);
 return {ok:true,run:{...run,kingdomMap:map,roster,
  gold:run.gold-payment.chargedGold,supplies:run.supplies-payment.chargedSupplies,
  weeklyDefenders:{...weeklyState(run),active}},active};
}
const VALID_UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
function recordWeeklyMove(run,uci,grade=null){
 const state=weeklyState(run),active=state.active;
 if(!active||active.status!=='playing'||!VALID_UCI.test(uci)||active.moves.length>=400)
  return {ok:false,run};
 const moves=[...active.moves,{uci,grade:typeof grade==='string'?grade:null}];
 return {ok:true,run:{...run,weeklyDefenders:{...state,active:{...active,moves}}}};
}
function settleWeeklyBattle(run,{result,capturedIds=[]}={}){
 const state=weeklyState(run),active=state.active;
 if(!active||active.status!=='playing')return {ok:false,reason:'inactive',run};
 if(state.receipts.includes(active.receiptId))return {ok:false,reason:'duplicate',run};
 if(!['win','draw','loss'].includes(result))return {ok:false,reason:'result',run};
 const armyLoss=consumeCapturedRecruits(run,{capturedIds,receiptId:active.receiptId});
 if(!armyLoss.ok)return {ok:false,reason:'army-'+armyLoss.reason,run};
 const killed=active.paid.unpaidValue>0;
 const gold=result==='win'?
  Math.floor(combatGoldReward({encounterType:'battle',stars:active.enemyLevel,
   playerColor:'w',status:{over:true,type:'checkmate',winner:'w'}})/2):0;
 let mastery=0;
 const roster=armyLoss.run.roster.map(character=>{
  if(character.id!==active.heroId)return character;
  let hero=normalizeHeroMastery(character);
  if(result==='win'&&active.mode==='auto'&&!killed){
   hero=awardMastery(hero,active.enemyLevel);mastery=hero.earnedMastery||0;
  }
  const stats={...hero.weeklyBattleStats};
  stats[result==='win'?'wins':result==='draw'?'draws':'losses']++;
  if(result==='win')stats.highestDefeatedThreat=Math.max(stats.highestDefeatedThreat,active.enemyLevel);
  const history=[...hero.weeklyBattleHistory,{receiptId:active.receiptId,week:active.week,
   cellId:active.cellId,enemyLevel:active.enemyLevel,heroLevel:active.heroLevel,
   result,moves:active.moves.slice(0,400),gold,mastery}].slice(-20);
  return {...hero,status:killed?'dead':result==='loss'&&active.mode==='auto'?'wounded':hero.status,
   weeklyBattleStats:stats,weeklyBattleHistory:history};
 });
 const kingDied=killed&&roster.some(c=>c.id===active.heroId&&c.isRunKing);
 const next={...armyLoss.run,roster,gold:armyLoss.run.gold+gold,
  ended:Boolean(run.ended||kingDied),endReason:kingDied?'weekly-mercenary-debt':run.endReason,
  weeklyDefenders:{active:null,receipts:[...state.receipts,active.receiptId].slice(-6000)}};
 return {ok:true,run:next,receiptId:active.receiptId,results:{result,gold,mastery,killed,
  capturedIds:[...new Set(capturedIds)],heroId:active.heroId,kingDied}};
}
export {FREE_KING,weeklyState,eligibleWeeklySite,canCommand,weeklyArmyPlan,
 weeklyQuote,startWeeklyBattle,recordWeeklyMove,settleWeeklyBattle};