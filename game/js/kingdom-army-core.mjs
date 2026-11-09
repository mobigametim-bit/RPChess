/* Persistent nameless recruits are independent from named heroes in run.roster. */
import {RACE_TAGS} from './race-assets.mjs';
import {DEFAULT_KINGDOM_ECONOMY,PIECE_TYPES} from './kingdom-economy-config.mjs';

const PIECE_NAMES={pawn:'Пешка',knight:'Конь',bishop:'Слон',rook:'Ладья',queen:'Ферзь'};
const RECEIPT_CAP=6000;
const MAX_UNITS_PER_ROLE=16;
function normalizeArmy(army){
  const result=new Map();
  for(const row of Array.isArray(army)?army:[]){
    if(!RACE_TAGS.includes(row?.raceTag)||!PIECE_TYPES.includes(row?.pieceType))continue;
    const count=Number.isSafeInteger(row.count)&&row.count>0?Math.min(row.count,100000):0;
    if(!count)continue;
    const key=row.raceTag+':'+row.pieceType;
    result.set(key,Math.min(100000,(result.get(key)||0)+count));
  }
  return [...result].sort(([a],[b])=>a.localeCompare(b)).map(([key,count])=>{
    const [raceTag,pieceType]=key.split(':');return {raceTag,pieceType,count};
  });
}
function hydrateArmy(run){
  return {...run,army:normalizeArmy(run?.army),armyReceipts:Array.isArray(run?.armyReceipts)?run.armyReceipts.filter(x=>typeof x==='string').slice(-RECEIPT_CAP):[],
    armyCasualtyReceipts:Array.isArray(run?.armyCasualtyReceipts)?run.armyCasualtyReceipts.filter(x=>typeof x==='string').slice(-RECEIPT_CAP):[]};
}
function addArmyRecruits(run,{raceTag,pieceType,count=1,receiptId}={}){
  const current=hydrateArmy(run);
  if(!RACE_TAGS.includes(raceTag)||!PIECE_TYPES.includes(pieceType)||!Number.isSafeInteger(count)||count<1||count>10000||!receiptId)
    return {ok:false,run:current,reason:'invalid'};
  if(current.armyReceipts.includes(receiptId))return {ok:false,run:current,reason:'duplicate'};
  const next=normalizeArmy([...current.army,{raceTag,pieceType,count}]);
  return{ok:true,run:{...current,army:next,armyReceipts:[...current.armyReceipts,receiptId].slice(-RECEIPT_CAP)},added:{raceTag,pieceType,count}};
}
function buyCastleRecruit(run,{raceTag,pieceType,receiptId,settings=DEFAULT_KINGDOM_ECONOMY}={}){
  const current=hydrateArmy(run);
  const expectedRace=current.kingdomMap?.castle?.raceTag;
  if(raceTag!==expectedRace)return{ok:false,run:current,reason:'race'};
  const price=settings.castle.recruitGold[pieceType];
  if(!Number.isSafeInteger(price)||price<0)return{ok:false,run:current,reason:'type'};
  if(current.gold<price)return{ok:false,run:current,reason:'gold'};
  const result=addArmyRecruits(current,{raceTag,pieceType,receiptId});
  if(!result.ok)return result;
  return{...result,run:{...result.run,gold:current.gold-price},spent:price};
}
function armyCandidateId(raceTag,pieceType,index){return 'army:'+raceTag+':'+pieceType+':'+index;}
function armyCandidates(run,perTypeLimit=MAX_UNITS_PER_ROLE){
  const result=[];const limits=new Map();
  for(const row of normalizeArmy(run?.army)){
    const present=limits.get(row.pieceType)||0;
    const count=Math.max(0,Math.min(row.count,perTypeLimit-present));
    limits.set(row.pieceType,present+count);
    for(let i=0;i<count;i++)result.push({
      id:armyCandidateId(row.raceTag,row.pieceType,i),name:PIECE_NAMES[row.pieceType],
      pieceType:row.pieceType,raceTag:row.raceTag,isArmyRecruit:true,isRunKing:false,
      status:'healthy',commandCost:{pawn:1,knight:3,bishop:3,rook:5,queen:9}[row.pieceType]
    });
  }
  return result;
}
function consumeCapturedRecruits(run,{capturedIds=[],receiptId}={}){
  const current=hydrateArmy(run);
  if(!receiptId)return{ok:false,run:current,reason:'receipt'};
  if(current.armyCasualtyReceipts.includes(receiptId))return{ok:false,run:current,reason:'duplicate'};
  const losses=new Map();
  for(const id of new Set(capturedIds)){
    if(typeof id!=='string'||!id.startsWith('army:'))continue;
    const match=/^army:([a-z_]+):(pawn|knight|bishop|rook|queen):([0-9]+)$/.exec(id);
    if(match)losses.set(match[1]+':'+match[2],(losses.get(match[1]+':'+match[2])||0)+1);
  }
  for(const row of current.army){
    const key=row.raceTag+':'+row.pieceType;
    if((losses.get(key)||0)>row.count)return{ok:false,run:current,reason:'insufficient-army'};
  }
  const army=normalizeArmy(current.army.map(row=>({...row,count:row.count-(losses.get(row.raceTag+':'+row.pieceType)||0)})));
  return{ok:true,run:{...current,army,armyCasualtyReceipts:[...current.armyCasualtyReceipts,receiptId].slice(-RECEIPT_CAP)},losses:Object.fromEntries(losses)};
}
export {normalizeArmy,hydrateArmy,addArmyRecruits,buyCastleRecruit,armyCandidateId,armyCandidates,consumeCapturedRecruits};
