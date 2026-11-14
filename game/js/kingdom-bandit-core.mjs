/* Kingdom ambush when only the King is left. Never launches a chess match
 * or creates victory/Conquest receipts. One pending Skirmish resolves once. */
import {hasHealthySkirmishCompanion} from './travel-choice-core.mjs';

const MURDER_REASON='bandit_murder';
function isUnprotectedBanditAmbush(run){
 const map=run?.kingdomMap,id=map?.pendingCell,cell=map?.cells?.[id];
 return Boolean(id&&cell?.status==='revealed'&&
  cell?.selectedEncounter?.type==='skirmish'&&
  !hasHealthySkirmishCompanion(run));
}
function resolveUnprotectedBanditAmbush(run){
 if(!isUnprotectedBanditAmbush(run))return {ok:false,run};
 const map=run.kingdomMap,id=map.pendingCell,cell=map.cells[id];
 const paid=run.gold>=10&&run.supplies>=10;
 const {resourceSnapshot,revealUntil,...persistent}=cell;
 const settled={...persistent,status:'completed',completedOnce:true,explored:true,
  banditOutcome:paid?'robbed':'murdered'};
 const nextMap={...map,pendingCell:null,cells:{...map.cells,[id]:settled}};
 const next={...run,kingdomMap:nextMap,activeTravelChoice:null,currentTravelChoices:null,
  journeyStep:Math.max(run.journeyStep||0,cell.selectedEncounter.step||0)};
 if(paid)return {ok:true,kind:'robbed',run:{...next,gold:10,supplies:10}};
 return {ok:true,kind:'murdered',run:{...next,ended:true,endReason:MURDER_REASON,
  roster:run.roster.map(c=>c.isRunKing?{...c,status:'dead'}:c)}};
}
export {MURDER_REASON,isUnprotectedBanditAmbush,resolveUnprotectedBanditAmbush};
