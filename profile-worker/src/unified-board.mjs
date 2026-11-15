// Public non-prize Glory v2 leaderboard. Only the new, empty v3 table
// participates: legacy VK and profile-v2 scores are NEVER compared to v2 Glory.
import {calculateGloryV2,scoreFromCompletedRecord} from '../../game/js/glory-v2.mjs';

const MAX_POWER=1000000,MAX_DAY=100000;
const COMMANDERS=new Set(['oathkeeper','stone_crown','wanderer_queen','pilgrim','fox_prince','ash_regent','nameless_heir']);
const commander=value=>COMMANDERS.has(value)?value:'oathkeeper';
function candidate(record,{active=false,power=0}={}){
  if(!record||typeof record!=='object')return null;
  const runId=String(active?record.id||'':record.runId||'');
  const rating=active?power:record.power;
  const day=active?record.kingdomMap?.day||record.journeyStep+1:record.day;
  const score=active
    ?record.gloryV2?.version===2?calculateGloryV2(record,rating):null
    :record.scoreVersion===2?{
      glory:scoreFromCompletedRecord(record),
      adventure:record.adventure,achievementCount:record.achievementCount
    }:null;
  if(!score||score.adventure<=0||!Number.isSafeInteger(score.glory)||score.glory<0
    ||!Number.isSafeInteger(rating)||rating<0||rating>MAX_POWER
    ||!Number.isSafeInteger(day)||day<0||day>MAX_DAY
    ||!/^[\w.:-]{1,128}$/.test(runId))return null;
  const name=String(record.playerName||'Воин').trim().replace(/\s+/g,' ').slice(0,24)||'Воин';
  return {name,day,power:rating,glory:score.glory,
    adventure:score.adventure,achievementCount:score.achievementCount||0,
    runId,commanderId:commander(record.commanderId)};
}
function compare(a,b){
  return b.glory-a.glory||b.adventure-a.adventure||
    b.achievementCount-a.achievementCount||a.day-b.day;
}
function bestFromSnapshot(snapshot){
  if(!snapshot||snapshot.schemaVersion!==1)return null;
  const completed=(snapshot.chronicle?.history||[]).slice(0,20)
    .map(r=>candidate(r)).filter(Boolean);
  const run=snapshot.run;
  const active=run&&!run.ended?candidate(run,{active:true,power:snapshot.rating?.power}):null;
  return [...completed,...(active?[active]:[])].sort(compare)[0]||null;
}
const UPSERT=[
  'INSERT INTO rpchess_leaderboard_v3(profile_id,player_name,glory,day,power,adventure,achievement_count,run_id,commander_id,achieved_at,updated_at)',
  'VALUES(?,?,?,?,?,?,?,?,?,?,?)',
  'ON CONFLICT(profile_id) DO UPDATE SET player_name=excluded.player_name,glory=excluded.glory,',
  'day=excluded.day,power=excluded.power,adventure=excluded.adventure,achievement_count=excluded.achievement_count,',
  'run_id=excluded.run_id,commander_id=excluded.commander_id,',
  'achieved_at=excluded.achieved_at,updated_at=excluded.updated_at',
  'WHERE excluded.glory>rpchess_leaderboard_v3.glory',
  'OR (excluded.glory=rpchess_leaderboard_v3.glory AND excluded.adventure>rpchess_leaderboard_v3.adventure)',
  'OR (excluded.glory=rpchess_leaderboard_v3.glory AND excluded.adventure=rpchess_leaderboard_v3.adventure',
  'AND excluded.achievement_count>rpchess_leaderboard_v3.achievement_count)',
  'OR (excluded.glory=rpchess_leaderboard_v3.glory AND excluded.adventure=rpchess_leaderboard_v3.adventure',
  'AND excluded.achievement_count=rpchess_leaderboard_v3.achievement_count AND excluded.day<rpchess_leaderboard_v3.day)'
].join(' ');
async function refreshProfileBoard(db,profile){
  const snapshot=JSON.parse(profile.snapshot_json||'{}');
  const best=bestFromSnapshot(snapshot);
  if(!best)return false;
  const stamp=Date.now();
  const result=await db.prepare(UPSERT).bind(profile.id,best.name,best.glory,best.day,best.power,
    best.adventure,best.achievementCount,best.runId,best.commanderId,stamp,stamp).run();
  return result.meta?.changes===1;
}
// Pure v3 board. v1 and v2 tables are no longer a ranking source at all.
const BOARD_QUERY=`
WITH ranked AS (
 SELECT 'p:'||profile_id AS owner_key,player_name AS name,glory,day,power,
        adventure,achievement_count AS achievementCount,
        commander_id AS commanderId,
        ROW_NUMBER() OVER (
          ORDER BY glory DESC,adventure DESC,achievement_count DESC,
                   day ASC,achieved_at ASC,profile_id ASC
        ) AS rank
 FROM rpchess_leaderboard_v3
)
SELECT owner_key,name,glory,day,power,adventure,achievementCount,commanderId,rank
FROM ranked WHERE rank<=10 OR owner_key=? ORDER BY rank`;
async function readUnifiedBoard(db,profile=null){
  const owner=profile?'p:'+profile.id:'';
  const result=await db.prepare(BOARD_QUERY).bind(owner).all();
  const rows=result.results||[];
  const toPublic=row=>({rank:Number(row.rank),name:String(row.name||'Воин').slice(0,24),
    glory:Number(row.glory),day:Number(row.day),power:Number(row.power),
    adventure:Number(row.adventure),achievementCount:Number(row.achievementCount),
    commanderId:commander(row.commanderId)});
  return {top:rows.filter(r=>Number(r.rank)<=10).map(toPublic),
    me:profile?(rows.find(r=>r.owner_key===owner)?toPublic(rows.find(r=>r.owner_key===owner)):null):null,
    viewerAuthenticated:Boolean(profile),scoreVersion:2};
}
export {candidate,bestFromSnapshot,refreshProfileBoard,readUnifiedBoard,BOARD_QUERY};
