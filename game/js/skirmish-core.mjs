import { PIECE_VALUES } from './roster-data.mjs';
import { MAX_ENCOUNTER_STARS, clampStars, difficultyForStars } from './encounter-difficulty.mjs';
import { combatTheme, oppositeColor } from './race-assets.mjs';

const MAX_SKIRMISH_PIECES=16,MAX_SKIRMISH_POINTS=39,TYPE_CODE=Object.freeze({pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}),CODE_TYPE=Object.freeze({p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}),FILES='abcdefgh';
const ENCOUNTER_TIERS=Object.freeze(Object.fromEntries(Array.from({length:MAX_ENCOUNTER_STARS},(_,i)=>{const stars=i+1,d=difficultyForStars(stars);const low=Math.max(4,Math.min(39,Math.round(4+stars*2.15))),high=Math.max(low,Math.min(39,low+7));return[stars,Object.freeze({label:`${d.label} · дорожный отряд`,stars,threat:`${low}–${high}`,elo:d.elo,tactic:d.tactic})];})));

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function hashSeed(input){let h=2166136261;for(const c of String(input)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function seededRandom(seed){let v=hashSeed(seed)||1;return()=>{v+=0x6D2B79F5;let t=v;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function shuffle(values,seed){const result=[...values],random=seededRandom(seed);for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}

function validEncounterOverride(value,expectedType){return Boolean(value&&value.type===expectedType&&value.seed);}
function takeTravelEncounterOverride(expectedType){
  if(typeof globalThis==='undefined')return null;
  const eventOverride=globalThis.RPChessEvents?.state?.combat;
  const travelOverride=globalThis.RPChessTravelEncounterOverride;
  const o=validEncounterOverride(eventOverride,expectedType)?eventOverride:(validEncounterOverride(travelOverride,expectedType)?travelOverride:null);
  if(!o)return null;
  try{delete globalThis.RPChessTravelEncounterOverride;}catch{globalThis.RPChessTravelEncounterOverride=null;}
  return o;
}

function createEncounter({seed='rpchess-skirmish',stars=2}={}){
  const o=takeTravelEncounterOverride('skirmish'),resolvedSeed=o?.seed||seed,s=clampStars(o?.stars??stars),tier=ENCOUNTER_TIERS[s];
  const generatedTheme=combatTheme({seed:resolvedSeed,raceTag:o?.enemyRaceTag||null,playerColor:o?.playerColor,mixed:Boolean(o?.mixedArmy)});
  const theme={...generatedTheme,...(o?.enemyRoleRaces?{enemyRoleRaces:o.enemyRoleRaces}:{}),...(o?.enemyRaceTag?{enemyRaceTag:o.enemyRaceTag}:{}),...(o?.sideNarrative?{sideNarrative:o.sideNarrative}:{})};
  return Object.freeze({id:`skirmish-${hashSeed(resolvedSeed).toString(36)}-${s}`,seed:String(resolvedSeed),stars:s,label:tier.label,threat:tier.threat,aiElo:tier.elo,tactic:tier.tactic,description:s<=3?'Небольшая вражеская группа перекрывает путь.':s<=7?'Опытный противник занял выгодную позицию впереди.':'Элитный отряд ждёт столкновения и почти не допускает ошибок.',...theme});
}

function combatEligible(character){return Boolean(character&&(character.status==='healthy'||(character.isRunKing&&character.status==='wounded')));}
function selectionSummary(roster,selectedIds){const selected=new Set(selectedIds||[]),members=(roster||[]).filter((c)=>selected.has(c.id));return{members,count:members.length,points:members.reduce((s,c)=>s+(PIECE_VALUES[c.pieceType]??c.commandCost??0),0)};}
function validateSelection(roster,selectedIds){const ids=[...new Set(selectedIds||[])],byId=new Map((roster||[]).map((c)=>[c.id,c])),king=(roster||[]).find((c)=>c.isRunKing);if(!king)return{ok:false,reason:'missing_king'};if(!combatEligible(king))return{ok:false,reason:'king_unavailable'};if(!ids.includes(king.id))return{ok:false,reason:'king_required'};for(const id of ids){const c=byId.get(id);if(!c)return{ok:false,reason:'unknown_character',id};if(!combatEligible(c))return{ok:false,reason:'character_unavailable',id};}const summary=selectionSummary(roster,ids);if(summary.count>MAX_SKIRMISH_PIECES)return{ok:false,reason:'piece_limit',...summary};if(summary.points>MAX_SKIRMISH_POINTS)return{ok:false,reason:'point_limit',...summary};return{ok:true,...summary};}
function defaultCombatSelection(roster){const eligible=(roster||[]).filter(combatEligible),king=eligible.find((c)=>c.isRunKing);if(!king)return[];const selected=[king.id];let points=0;for(const c of eligible){if(c.id===king.id)continue;const cost=PIECE_VALUES[c.pieceType]??c.commandCost??0;if(selected.length>=MAX_SKIRMISH_PIECES||points+cost>MAX_SKIRMISH_POINTS)continue;selected.push(c.id);points+=cost;}return selected;}

function startingSquares(color){const home=color==='w'?'1':'8',front=color==='w'?'2':'7';return{home:[...FILES].map((f)=>`${f}${home}`),front:[...FILES].map((f)=>`${f}${front}`)};}
function placeArmy(army,color,{seed='rpchess-formation'}={}){
  const {home,front}=startingSquares(color),occupied=new Set(),placements=[];
  const pawns=army.filter((m)=>(m.pieceType||CODE_TYPE[m.type]||m.type)==='pawn');
  const others=army.filter((m)=>(m.pieceType||CODE_TYPE[m.type]||m.type)!=='pawn');
  if(pawns.length>front.length||army.length>16)throw new Error('Skirmish army does not fit into two starting ranks');
  const pawnSquares=shuffle(front,`${seed}:${color}:pawns`);
  pawns.forEach((member,index)=>{const square=pawnSquares[index],type='pawn';occupied.add(square);placements.push({id:member.id||null,name:member.name||null,pieceType:type,type:TYPE_CODE[type],color,square});});
  const remaining=shuffle([...home,...front].filter((sq)=>!occupied.has(sq)),`${seed}:${color}:others`);
  others.forEach((member,index)=>{const square=remaining[index];if(!square)throw new Error('Skirmish army does not fit into two starting ranks');const type=member.pieceType||CODE_TYPE[member.type]||member.type;occupied.add(square);placements.push({id:member.id||null,name:member.name||null,pieceType:type,type:TYPE_CODE[type]||member.type,color,square});});
  return placements;
}
function fenFromPlacements(placements,turn='w'){const board=new Map(placements.map((p)=>[p.square,p])),ranks=[];for(let rank=8;rank>=1;rank--){let row='',empty=0;for(const file of FILES){const p=board.get(`${file}${rank}`);if(!p){empty++;continue;}if(empty){row+=String(empty);empty=0;}const code=TYPE_CODE[p.pieceType]||p.type;row+=p.color==='w'?code.toUpperCase():code.toLowerCase();}if(empty)row+=String(empty);ranks.push(row);}return`${ranks.join('/')} ${turn} - - 0 1`;}

function generateEnemyArmy({playerPoints=0,playerCount=1,encounter}={}){
  const resolved=encounter||createEncounter(),random=seededRandom(`${resolved.seed}:${resolved.stars}:${playerPoints}:${playerCount}`);
  const scale=.62+(resolved.stars-1)*.058;
  const target=clamp(Math.round(Number(playerPoints||0)*scale+resolved.stars*1.65),4,MAX_SKIRMISH_POINTS);
  const army=[{id:'enemy.king',name:'Вражеский король',pieceType:'king',commandCost:0}];let points=0;
  const candidates=resolved.stars>=9?['queen','rook','bishop','knight','pawn']:resolved.stars>=5?['rook','bishop','knight','pawn','pawn']:['bishop','knight','pawn','pawn','pawn'];
  let guard=0;while(army.length<MAX_SKIRMISH_PIECES&&points<target&&guard<200){guard++;const pawnCount=army.reduce((sum,piece)=>sum+(piece.pieceType==='pawn'?1:0),0);const affordable=candidates.filter((t)=>points+PIECE_VALUES[t]<=target&&(t!=='pawn'||pawnCount<8));if(!affordable.length)break;const type=affordable[Math.floor(random()*affordable.length)],cost=PIECE_VALUES[type];army.push({id:`enemy.${type}.${army.length}`,name:`Вражеский ${type}`,pieceType:type,commandCost:cost});points+=cost;}
  return{army,points,target};
}

function createBattlePlan({roster,selectedIds,encounter}={}){
  const validation=validateSelection(roster,selectedIds);if(!validation.ok)throw new Error(`Invalid Skirmish selection: ${validation.reason}`);
  const resolved=encounter||createEncounter(),playerColor=resolved.playerColor==='b'?'b':'w',enemyColor=oppositeColor(playerColor),enemy=generateEnemyArmy({playerPoints:validation.points,playerCount:validation.count,encounter:resolved});
  const playerFormation=placeArmy(validation.members,playerColor,{seed:`${resolved.seed}:player`});
  const enemyFormation=placeArmy(enemy.army,enemyColor,{seed:`${resolved.seed}:enemy`});
  return{encounter:resolved,playerColor,enemyColor,selectedIds:validation.members.map((m)=>m.id),playerPoints:validation.points,enemyPoints:enemy.points,playerFormation,enemyFormation,fen:fenFromPlacements([...playerFormation,...enemyFormation],'w')};
}

function applyBattleOutcome(run,{capturedIds=[],status=null,playerColor='w'}={}){const captured=new Set(capturedIds||[]);let kingDied=false;const lost=status?.type==='checkmate'&&status.winner&&status.winner!==playerColor;const roster=(run?.roster||[]).map((c)=>{if(c.isRunKing&&lost){kingDied=true;return{...c,status:'dead'};}if(!c.isRunKing&&captured.has(c.id)&&c.status==='healthy')return{...c,status:'wounded'};return{...c};});const woundedIds=roster.filter((c)=>captured.has(c.id)&&!c.isRunKing&&c.status==='wounded').map((c)=>c.id);return{...run,roster,ended:Boolean(run?.ended||kingDied),endReason:kingDied?'king_dead':(run?.endReason||null),lastSkirmish:{result:status?.type||'unknown',winner:status?.winner||null,woundedIds,kingDied}};}

export {MAX_SKIRMISH_PIECES,MAX_SKIRMISH_POINTS,ENCOUNTER_TIERS,combatEligible,createEncounter,selectionSummary,validateSelection,defaultCombatSelection,placeArmy,fenFromPlacements,generateEnemyArmy,createBattlePlan,applyBattleOutcome};