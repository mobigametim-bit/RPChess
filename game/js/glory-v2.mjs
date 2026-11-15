// Non-prize Journey Glory v2. Power is read at the moment of evaluation;
// it is never interpreted as the gain since the run began.
const SCORE_VERSION=2;
const EVENT_POINTS=Object.freeze({
  skirmish:[10,2],battle:[25,4],caravan:[18,3],puzzle:[8,2],event:[5,0]
});
const MAX_EVENTS=6000;
const safeNumber=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const clampStars=stars=>Math.max(1,Math.min(12,Number.isInteger(stars)?stars:1));
function eventHash(value) {
  let hash=2166136261;
  for(const char of String(value))hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  return hash.toString(36);
}
function emptyGloryV2(){return {version:SCORE_VERSION,events:[]};}
function normalizeGloryV2(value) {
  if(value?.version!==SCORE_VERSION||!Array.isArray(value.events))return emptyGloryV2();
  const seen=new Set(),events=[];
  for(const row of value.events.slice(0,MAX_EVENTS)){
    if(!Array.isArray(row)||row.length!==3||!Object.hasOwn(EVENT_POINTS,row[0])||
       typeof row[1]!=='string'||!/^[a-z0-9]{1,12}$/.test(row[1])||seen.has(row[0]+':'+row[1]))continue;
    seen.add(row[0]+':'+row[1]);
    events.push([row[0],row[1],clampStars(row[2])]);
  }
  return {version:SCORE_VERSION,events};
}
function addAchievement(glory,kind,id,stars=1){
  const current=normalizeGloryV2(glory);
  if(!Object.hasOwn(EVENT_POINTS,kind)||typeof id!=='string'||!id||current.events.length>=MAX_EVENTS)return current;
  const hash=eventHash(id);
  if(current.events.some(event=>event[0]===kind&&event[1]===hash))return current;
  return {version:SCORE_VERSION,events:[...current.events,[kind,hash,clampStars(stars)]]};
}
function scoreForAchievements(glory){
  const source=normalizeGloryV2(glory);
  let adventure=0;
  const counts={battle:0,skirmish:0,caravan:0,puzzle:0,event:0};
  for(const [kind,,stars] of source.events){
    const [base,perStar]=EVENT_POINTS[kind];
    adventure+=base+perStar*stars;
    counts[kind]+=1;
  }
  return {adventure,counts,achievementCount:source.events.length};
}
function kingdomAchievements(map){
  if(!map||typeof map!=='object')return {territories:0,outposts:0,settlements:0,kingdom:0};
  const validCell=id=>typeof id==='string'&&/^-?\d+,-?\d+$/.test(id);
  const territories=new Set((Array.isArray(map.battleConqueredCells)?map.battleConqueredCells:[]).filter(validCell)).size;
  const outposts=new Set((Array.isArray(map.outposts)?map.outposts:[]).map(p=>p?.id).filter(validCell)).size;
  const settlements=new Set((Array.isArray(map.builtSettlements)?map.builtSettlements:[]).map(p=>p?.id).filter(validCell)).size;
  return {territories,outposts,settlements,kingdom:territories*2+outposts*12+settlements*10};
}
function powerMultiplier(power){
  const p=Math.max(0,Math.min(1000000,safeNumber(power)));
  return Math.max(.75,Math.min(1.5,Math.sqrt(p/500)));
}
function gloryFromComponents(adventure,kingdom,power){
  const b=safeNumber(adventure),k=safeNumber(kingdom);
  return Math.floor((b+Math.min(k,Math.floor(b/2)))*powerMultiplier(power));
}
function calculateGloryV2(run,power){
  const {adventure,counts,achievementCount}=scoreForAchievements(run?.gloryV2);
  const lands=kingdomAchievements(run?.kingdomMap);
  return {
    scoreVersion:SCORE_VERSION,
    glory:gloryFromComponents(adventure,lands.kingdom,power),
    adventure,kingdom:lands.kingdom,achievementCount,...lands,counts
  };
}
function scoreFromCompletedRecord(record){
  if(record?.scoreVersion!==SCORE_VERSION)return null;
  if(!Number.isSafeInteger(record.adventure)||record.adventure<0||
     !Number.isSafeInteger(record.kingdom)||record.kingdom<0||
     !Number.isSafeInteger(record.power)||record.power<0||record.power>1000000)return null;
  return gloryFromComponents(record.adventure,record.kingdom,record.power);
}
export {SCORE_VERSION,EVENT_POINTS,MAX_EVENTS,emptyGloryV2,normalizeGloryV2,
  addAchievement,scoreForAchievements,kingdomAchievements,powerMultiplier,
  gloryFromComponents,calculateGloryV2,scoreFromCompletedRecord};
