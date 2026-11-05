// Unified, non-prize Glory board for RPChess profiles and legacy VK players.
// The existing leaderboard_v1 is read-only. User PvE progress is unverified.
const MAX_WEEK=5000,MAX_POWER=1000000;
const COMMANDERS=new Set(['oathkeeper','stone_crown','wanderer_queen','pilgrim','fox_prince','ash_regent','nameless_heir']);
const commander=value=>COMMANDERS.has(value)?value:'oathkeeper';
const GLORY=(week,power)=>Math.floor(Math.sqrt(week*power)/10);
function candidate(record,{active=false,power=0}={}){
  const week=active?record?.journeyStep:record?.week;
  const rating=active?power:record?.power;
  const runId=String(active?record?.id||'':record?.runId||'');
  if(!Number.isSafeInteger(week)||week<0||week>MAX_WEEK
    ||!Number.isSafeInteger(rating)||rating<0||rating>MAX_POWER
    ||!/^[\w.:-]{1,128}$/.test(runId))return null;
  const name=String(record.playerName||'Воин').trim().replace(/\s+/g,' ').slice(0,24)||'Воин';
  return {name,week,power:rating,glory:GLORY(week,rating),runId,
    commanderId:commander(record.commanderId)};
}
function compare(a,b){
  return b.glory-a.glory||b.week-a.week||b.power-a.power;
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
  'INSERT INTO rpchess_leaderboard_v2(profile_id,player_name,glory,week,power,run_id,commander_id,achieved_at,updated_at)',
  'VALUES(?,?,?,?,?,?,?,?,?)',
  'ON CONFLICT(profile_id) DO UPDATE SET player_name=excluded.player_name,glory=excluded.glory,',
  'week=excluded.week,power=excluded.power,run_id=excluded.run_id,commander_id=excluded.commander_id,',
  'achieved_at=excluded.achieved_at,updated_at=excluded.updated_at',
  'WHERE excluded.glory>rpchess_leaderboard_v2.glory',
  'OR (excluded.glory=rpchess_leaderboard_v2.glory AND excluded.week>rpchess_leaderboard_v2.week)',
  'OR (excluded.glory=rpchess_leaderboard_v2.glory AND excluded.week=rpchess_leaderboard_v2.week',
  'AND excluded.power>rpchess_leaderboard_v2.power)'
].join(' ');
async function refreshProfileBoard(db,profile){
  const snapshot=JSON.parse(profile.snapshot_json||'{}');
  const best=bestFromSnapshot(snapshot);
  if(!best)return false;
  const timestamp=Date.now();
  const result=await db.prepare(UPSERT).bind(profile.id,best.name,best.glory,best.week,best.power,
    best.runId,best.commanderId,timestamp,timestamp).run();
  return result.meta?.changes===1;
}
// D1/SQLite windows rank ALL rows, not just a fetched top-N. The legacy and
// RPChess scores of an already-migrated VK user share one canonical owner key.
const BOARD_QUERY=`
WITH candidates AS (
 SELECT 'p:'||b.profile_id AS owner_key,b.player_name AS name,b.glory,b.week,b.power,
        b.commander_id AS commanderId,b.achieved_at
 FROM rpchess_leaderboard_v2 b
 UNION ALL
 SELECT CASE WHEN p.id IS NULL THEN 'vk:'||l.vk_id ELSE 'p:'||p.id END AS owner_key,
        l.player_name AS name,l.glory,l.week,l.power,
        l.commander_id AS commanderId,l.achieved_at
 FROM leaderboard_v1 l LEFT JOIN rpchess_profile_v1 p ON p.vk_user_id=l.vk_id
), selected AS (
 SELECT *, ROW_NUMBER() OVER (
  PARTITION BY owner_key ORDER BY glory DESC,week DESC,power DESC,achieved_at ASC,owner_key ASC
 ) AS owner_rank FROM candidates
), ranked AS (
 SELECT *, ROW_NUMBER() OVER (
  ORDER BY glory DESC,week DESC,power DESC,achieved_at ASC,owner_key ASC
 ) AS rank FROM selected WHERE owner_rank=1
)
SELECT owner_key,name,glory,week,power,commanderId,rank FROM ranked
WHERE rank<=10 OR owner_key=? ORDER BY rank`;
async function readUnifiedBoard(db,profile=null){
  const owner=profile?'p:'+profile.id:'';
  const result=await db.prepare(BOARD_QUERY).bind(owner).all();
  const rows=result.results||[];
  const toPublic=row=>({rank:Number(row.rank),name:String(row.name||'Воин').slice(0,24),
    glory:Number(row.glory),week:Number(row.week),power:Number(row.power),
    commanderId:commander(row.commanderId)});
  return {top:rows.filter(r=>Number(r.rank)<=10).map(toPublic),
    me:profile?(rows.find(r=>r.owner_key===owner)?toPublic(rows.find(r=>r.owner_key===owner)):null):null,
    viewerAuthenticated:Boolean(profile)};
}
export {bestFromSnapshot,refreshProfileBoard,readUnifiedBoard,BOARD_QUERY};
