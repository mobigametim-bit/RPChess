/* Road-crossing trading tents. Pure, deterministic, additive to existing saves.
 * Gold is earned per completed week and held for collection; the King trades
 * only when physically standing on his own trading-tent tile. */
import {visibleRoyalRoads,ownedKeys} from './kingdom-road-network.mjs?v=20261111-polish-v1';
import {naturalTileOccupancy} from './kingdom-geography.mjs';
import {industryLevel} from './kingdom-industry-core.mjs';

const KEY=/^-?\d+,-?\d+$/;
const GOLD_PER_LEVEL=3,GOLD_TO_SUPPLY=15,SUPPLY_TO_GOLD=6;
const WEEK_DAYS=7;
const weekForDay=day=>Math.max(0,Math.floor(Math.max(1,day||1)/WEEK_DAYS));
const asPoint=value=>typeof value==='string'&&KEY.test(value)?value:
  value&&Number.isSafeInteger(value.x)&&Number.isSafeInteger(value.y)
    ?value.x+','+value.y:null;
const gameInteger=n=>Number.isSafeInteger(n)&&n>=0;
function junctionType(map,id){
  if(!map||!KEY.test(id))return null;
  const ways=new Set();
  for(const line of visibleRoyalRoads(map)){
    if(line.from===id)ways.add(line.to);
    if(line.to===id)ways.add(line.from);
  }
  if(ways.size>=3)return 'royal';
  // A natural road runs approximately east-west. One cardinal north/south
  // royal segment genuinely crossing this road is a second viable junction.
  if(ways.size>=1){
    const [x,y]=id.split(',').map(Number);
    const natural=naturalTileOccupancy(map.seed,x,y);
    if(natural.road&&[...ways].some(other=>{
      const [xx,yy]=other.split(',').map(Number);
      return yy!==y&&xx===x;
    }))return 'natural';
  }
  return null;
}
function tradeLevel(map){
  // Trading tents are production buildings: never above the castle.
  return industryLevel(map);
}
function synchronizeTradeLevels(map){
  const level=tradeLevel(map),posts=map?.tradePosts||[];
  if(!posts.some(site=>site.level!==level))return map;
  return {...map,tradePosts:posts.map(site=>site.level===level?site:{...site,level})};
}
function hasTradeConflict(map,id){
  return id===asPoint(map.castle)||!!map.cells?.[id]?.selectedEncounter||
    map.cells?.[id]?.type==='castle'||map.cells?.[id]?.type==='settlement'||
    (map.industry?.buildings||[]).some(site=>site.id===id)||
    (map.outposts||[]).some(site=>site.id===id)||
    (map.builtSettlements||[]).some(site=>site.id===id)||
    (map.tradePosts||[]).some(site=>site.id===id);
}
function canBuildTradePost(map,point){
  const id=asPoint(point);
  return Boolean(id&&map?.seed&&!map.pendingCell&&ownedKeys(map).has(id)&&
    !hasTradeConflict(map,id)&&junctionType(map,id));
}
function validTradePosts(map){
  if(map?.tradePosts==null&&map?.tradeProcessedWeek==null)return true;
  if(!Array.isArray(map?.tradePosts)||!gameInteger(map?.tradeProcessedWeek))return false;
  const seen=new Set();
  return map.tradePosts.every(site=>{
    if(!site||!KEY.test(site.id)||!gameInteger(site.level)||
       site.level<1||site.level>5||!gameInteger(site.builtWeek)||
       site.builtWeek>map.tradeProcessedWeek||
       !gameInteger(site.pendingGold)||seen.has(site.id))return false;
    seen.add(site.id);return true;
  });
}
function initializeTrade(map){
  if(Array.isArray(map.tradePosts)&&gameInteger(map.tradeProcessedWeek))return map;
  return {...map,tradePosts:[],tradeProcessedWeek:weekForDay(map.day)};
}
function buildTradePost(map,point){
  if(!canBuildTradePost(map,point))return {ok:false,map};
  const id=asPoint(point),initialized=initializeTrade(map),week=weekForDay(map.day);
  const post={id,level:tradeLevel(initialized),builtWeek:week,pendingGold:0};
  return {ok:true,post,map:{...initialized,tradePosts:[...initialized.tradePosts,post],
    tradeProcessedWeek:Math.max(initialized.tradeProcessedWeek,week)}};
}
function settleTradeWeek(map,week=weekForDay(map?.day)){
  const initialized=synchronizeTradeLevels(initializeTrade(map));
  if(week<=initialized.tradeProcessedWeek)return initialized;
  const posts=initialized.tradePosts.map(site=>({
    ...site,pendingGold:site.pendingGold+
      Math.max(0,week-Math.max(site.builtWeek,initialized.tradeProcessedWeek))*
        GOLD_PER_LEVEL*site.level
  }));
  return {...initialized,tradePosts:posts,tradeProcessedWeek:week};
}
function pendingTradeGold(map,id){
  const site=(map?.tradePosts||[]).find(site=>site.id===asPoint(id));
  return site?.pendingGold||0;
}
function collectTradeGold(map,id){
  id=asPoint(id);
  const amount=pendingTradeGold(map,id);
  if(!amount||!ownedKeys(map).has(id))return {ok:false,map};
  return {ok:true,amount,map:{...map,tradePosts:map.tradePosts.map(site=>
    site.id===id?{...site,pendingGold:0}:site)}};
}
function tradeLimits(run,id){
  const map=run?.kingdomMap,point=asPoint(id);
  const king=asPoint(map?.king);
  const available=point&&king===point&&(map?.tradePosts||[]).some(site=>site.id===point)&&
    ownedKeys(map).has(point)&&!map.pendingCell&&!run.ended;
  const gold=gameInteger(run?.gold)?run.gold:0;
  const supplies=gameInteger(run?.supplies)?run.supplies:0;
  return {available:Boolean(available),buySupplies:available?Math.floor(gold/GOLD_TO_SUPPLY):0,
    sellSupplies:available?supplies:0};
}
function exchangeAtTradePost(run,id,direction,amount){
  const limits=tradeLimits(run,id);
  if(!limits.available||!Number.isSafeInteger(amount)||amount<1)return {ok:false,run};
  if(direction==='buy'&&amount<=limits.buySupplies){
    return {ok:true,run:{...run,gold:run.gold-amount*GOLD_TO_SUPPLY,
      supplies:run.supplies+amount},goldDelta:-amount*GOLD_TO_SUPPLY,supplyDelta:amount};
  }
  if(direction==='sell'&&amount<=limits.sellSupplies){
    return {ok:true,run:{...run,gold:run.gold+amount*SUPPLY_TO_GOLD,
      supplies:run.supplies-amount},goldDelta:amount*SUPPLY_TO_GOLD,supplyDelta:-amount};
  }
  return {ok:false,run};
}
export {GOLD_PER_LEVEL,GOLD_TO_SUPPLY,SUPPLY_TO_GOLD,junctionType,tradeLevel,synchronizeTradeLevels,
  canBuildTradePost,validTradePosts,initializeTrade,buildTradePost,settleTradeWeek,
  pendingTradeGold,collectTradeGold,tradeLimits,exchangeAtTradePost};