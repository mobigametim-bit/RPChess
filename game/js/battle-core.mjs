import { MAX_ENCOUNTER_STARS, clampStars, difficultyForStars } from './encounter-difficulty.mjs';
import { combatTheme, oppositeColor } from './race-assets.mjs';

const BATTLE_PIECE_COUNT=16,BATTLE_ARMY_POINTS=39,STANDARD_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const TYPE_CODE=Object.freeze({pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}),SLOT_CAPACITY=Object.freeze({king:1,queen:1,rook:2,bishop:2,knight:2,pawn:8}),TYPE_LABELS=Object.freeze({pawn:'Пешка',knight:'Конь',bishop:'Слон',rook:'Ладья',queen:'Ферзь',king:'Король'});
const STANDARD_SLOTS=Object.freeze({w:Object.freeze({rook:Object.freeze(['a1','h1']),knight:Object.freeze(['b1','g1']),bishop:Object.freeze(['c1','f1']),queen:Object.freeze(['d1']),king:Object.freeze(['e1']),pawn:Object.freeze(['a2','b2','c2','d2','e2','f2','g2','h2'])}),b:Object.freeze({rook:Object.freeze(['a8','h8']),knight:Object.freeze(['b8','g8']),bishop:Object.freeze(['c8','f8']),queen:Object.freeze(['d8']),king:Object.freeze(['e8']),pawn:Object.freeze(['a7','b7','c7','d7','e7','f7','g7','h7'])})});
const BATTLE_TIERS=Object.freeze(Object.fromEntries(Array.from({length:MAX_ENCOUNTER_STARS},(_,i)=>{const stars=i+1,d=difficultyForStars(stars);return[stars,Object.freeze({label:`${d.label} · полевая армия`,elo:d.elo,tactic:d.tactic})];})));

function hashSeed(input){let h=2166136261;for(const c of String(input)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
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

function createBattleEncounter({seed='rpchess-battle',stars=2}={}){
  const o=takeTravelEncounterOverride('battle'),resolvedSeed=o?.seed||seed,s=clampStars(o?.stars??stars),tier=BATTLE_TIERS[s];
  const generatedTheme=combatTheme({seed:resolvedSeed,raceTag:o?.enemyRaceTag||null,playerColor:o?.playerColor,mixed:Boolean(o?.mixedArmy)});
  const theme={...generatedTheme,...(o?.enemyRoleRaces?{enemyRoleRaces:o.enemyRoleRaces}:{}),...(o?.enemyRaceTag?{enemyRaceTag:o.enemyRaceTag}:{}),...(o?.sideNarrative?{sideNarrative:o.sideNarrative}:{})};
  return Object.freeze({id:`battle-${hashSeed(resolvedSeed).toString(36)}-${s}`,seed:String(resolvedSeed),stars:s,label:tier.label,aiElo:tier.elo,tactic:tier.tactic,description:s<=3?'Впереди развёрнута полноценная армия. Победа решится по классическим шахматным правилам.':s<=7?'Опытный противник вывел полный комплект фигур и готов к открытому сражению.':'Перед вами элитная армия. Каждый неточный ход будет наказан.',...theme});
}

function combatEligible(character){return Boolean(character&&(character.status==='healthy'||(character.isRunKing&&character.status==='wounded')));}
function selectedMembers(roster,selectedIds){const selected=new Set(selectedIds||[]);return(roster||[]).filter((c)=>selected.has(c.id));}
function selectedTypeCounts(roster,selectedIds){const counts={king:0,queen:0,rook:0,bishop:0,knight:0,pawn:0};for(const c of selectedMembers(roster,selectedIds))if(Object.prototype.hasOwnProperty.call(counts,c.pieceType))counts[c.pieceType]++;return counts;}
function validateBattleSelection(roster,selectedIds){const ids=[...new Set(selectedIds||[])],byId=new Map((roster||[]).map((c)=>[c.id,c])),king=(roster||[]).find((c)=>c.isRunKing);if(!king)return{ok:false,reason:'missing_king'};if(!combatEligible(king))return{ok:false,reason:'king_unavailable'};if(!ids.includes(king.id))return{ok:false,reason:'king_required'};for(const id of ids){const c=byId.get(id);if(!c)return{ok:false,reason:'unknown_character',id};if(!combatEligible(c))return{ok:false,reason:'character_unavailable',id};if(c.pieceType==='king'&&!c.isRunKing)return{ok:false,reason:'invalid_king',id};}const members=selectedMembers(roster,ids),typeCounts=selectedTypeCounts(roster,ids);for(const [pieceType,count] of Object.entries(typeCounts))if(count>SLOT_CAPACITY[pieceType])return{ok:false,reason:'slot_limit',pieceType,count,capacity:SLOT_CAPACITY[pieceType],members,typeCounts};return{ok:true,members,typeCounts,count:members.length};}
function defaultBattleSelection(roster){const eligible=(roster||[]).filter(combatEligible),king=eligible.find((c)=>c.isRunKing);if(!king)return[];const selected=[king.id],counts={king:1,queen:0,rook:0,bishop:0,knight:0,pawn:0};for(const c of eligible){if(c.id===king.id||c.pieceType==='king')continue;const capacity=SLOT_CAPACITY[c.pieceType]||0;if((counts[c.pieceType]||0)>=capacity)continue;selected.push(c.id);counts[c.pieceType]=(counts[c.pieceType]||0)+1;}return selected;}

function formationFor(color,roster=[],selectedIds=[],playerColor='w'){
  const isPlayer=color===playerColor;
  const validation=isPlayer?validateBattleSelection(roster,selectedIds):null;
  if(isPlayer&&!validation.ok)throw new Error(`Invalid Battle selection: ${validation.reason}`);
  const selected=isPlayer?validation.members:[],byType=new Map();for(const type of Object.keys(SLOT_CAPACITY))byType.set(type,selected.filter((c)=>c.pieceType===type));
  const placements=[];for(const pieceType of ['rook','knight','bishop','queen','king','pawn']){const chars=byType.get(pieceType)||[],slots=STANDARD_SLOTS[color][pieceType];slots.forEach((square,index)=>{const c=chars[index]||null;placements.push({id:c?.id||null,name:c?.name||`Временная фигура · ${TYPE_LABELS[pieceType]}`,pieceType,type:TYPE_CODE[pieceType],color,square,personalized:Boolean(c)});});}return placements;
}

function createBattlePlan({roster,selectedIds,encounter}={}){
  const validation=validateBattleSelection(roster,selectedIds);if(!validation.ok)throw new Error(`Invalid Battle selection: ${validation.reason}`);
  const resolved=encounter||createBattleEncounter(),playerColor=resolved.playerColor==='b'?'b':'w',enemyColor=oppositeColor(playerColor);
  return{encounter:resolved,playerColor,enemyColor,selectedIds:validation.members.map((m)=>m.id),participants:validation.members.map((m)=>m.id),playerFormation:formationFor(playerColor,roster,selectedIds,playerColor),enemyFormation:formationFor(enemyColor,[],[],playerColor),fullArmyPieces:BATTLE_PIECE_COUNT,fullArmyPoints:BATTLE_ARMY_POINTS,fen:STANDARD_FEN};
}

function applyBattleOutcome(run,{capturedIds=[],status=null,playerColor='w',participantIds=[]}={}){const captured=new Set(capturedIds||[]),participants=[...new Set(participantIds||[])];const roster=(run?.roster||[]).map((c)=>{if(!c.isRunKing&&captured.has(c.id)&&c.status==='healthy')return{...c,status:'wounded'};return{...c};}),woundedIds=roster.filter((c)=>captured.has(c.id)&&!c.isRunKing&&c.status==='wounded').map((c)=>c.id);return{...run,roster,ended:Boolean(run?.ended),endReason:run?.endReason||null,lastBattle:{result:status?.type||'unknown',winner:status?.winner||null,participants,woundedIds,kingDied:false}};}

export {BATTLE_PIECE_COUNT,BATTLE_ARMY_POINTS,STANDARD_FEN,SLOT_CAPACITY,STANDARD_SLOTS,BATTLE_TIERS,combatEligible,createBattleEncounter,selectedTypeCounts,validateBattleSelection,defaultBattleSelection,formationFor,createBattlePlan,applyBattleOutcome};
