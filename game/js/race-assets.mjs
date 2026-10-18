import './king-pin-ice.mjs';
import { commanderPieceArt } from './commander-portraits.mjs';

const RACE_TAGS = Object.freeze(['humans','elves','orcs','undead','dark_elves','dwarves','demons','angels','dragonborn','beastfolk','constructs','animals','fae','goblins']);
const PIECE_TYPES = Object.freeze(['pawn','knight','bishop','rook','queen','king']);
const NAMED_PAWN_IDS = Object.freeze(['daro_last','kael_cinder','mara_chain','nemea_quill','puck_ember','renzo_bridge','saran_dawn','elio_silk']);
const NAMED_PAWN_SET = new Set(NAMED_PAWN_IDS);
const NAMED_BISHOP_IDS = Object.freeze(["altana_bow","brother_orell","velka_urn","deacon_mirel","seraph_lyra","briar_sister","old_marin"]);
const NAMED_BISHOP_SET = new Set(NAMED_BISHOP_IDS);
const NAMED_KNIGHT_IDS = Object.freeze(['vael_hammer','orion_step','roan_stag','suri_ash','temur_wind','tessa_gull']);
const NAMED_KNIGHT_SET = new Set(NAMED_KNIGHT_IDS);
const NAMED_ROOK_IDS = Object.freeze(['aldric_wall','batu_cliff','ivar_lens','cassian_coin','maeve_root','rat_banner']);
const NAMED_ROOK_SET = new Set(NAMED_ROOK_IDS);
const NAMED_PAWN_ROLES = Object.freeze(['pawn','knight','bishop','rook','queen']);
const ROLE_FROM_CODE = Object.freeze({p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen'});
function namedPawnPieceArt(character,role=character?.pieceType,color='w'){
  const id=String(character?.id||'').replace(/^hero\./,'');
  const type=ROLE_FROM_CODE[role]||role;
  if(!NAMED_PAWN_SET.has(id)||!NAMED_PAWN_ROLES.includes(type))return null;
  return `assets/heroes/${id}/pieces/${color==='b'||color==='black'?'black':'white'}/${type}.webp`;
}
function namedBishopPieceArt(character,role=character?.pieceType,color='w'){
  const id=String(character?.id||'').replace(/^hero\./,'');
  const type=ROLE_FROM_CODE[role]||role;
  if(!NAMED_BISHOP_SET.has(id)||type!=='bishop')return null;
  return `assets/heroes/${id}/pieces/${color==='b'||color==='black'?'black':'white'}/bishop.webp`;
}
function namedKnightPieceArt(character,role=character?.pieceType,color='w'){
  const id=String(character?.id||'').replace(/^hero\./,'');
  const type=ROLE_FROM_CODE[role]||role;
  if(!NAMED_KNIGHT_SET.has(id)||type!=='knight')return null;
  return `assets/heroes/${id}/pieces/${color==='b'||color==='black'?'black':'white'}/knight.webp`;
}
function namedRookPieceArt(character,role=character?.pieceType,color='w'){
  const id=String(character?.id||'').replace(/^hero\./,'');
  const type=ROLE_FROM_CODE[role]||role;
  if(!NAMED_ROOK_SET.has(id)||type!=='rook')return null;
  return `assets/heroes/${id}/pieces/${color==='b'||color==='black'?'black':'white'}/rook.webp`;
}
const BOARD_TILE_FILES = Object.freeze({ light:'white.png', dark:'black.png' });
const BOARD_THEME_STYLE_ID='rpchess-race-board-theme-style';
let boardRuntimeInstallQueued=false;

const RACE_LABELS = Object.freeze({
  humans:'Люди', elves:'Эльфы', orcs:'Орки', undead:'Нежить', dark_elves:'Тёмные эльфы', dwarves:'Гномы', demons:'Демоны', angels:'Ангелы', dragonborn:'Дракониды', beastfolk:'Зверолюди', constructs:'Конструкты', animals:'Животные', fae:'Феи', goblins:'Гоблины', mixed:'Нейтральные и смешанные'
});
const RACE_TAG_BY_LABEL = Object.freeze(Object.fromEntries(Object.entries(RACE_LABELS).map(([tag,label]) => [label.toLocaleLowerCase('ru-RU'), tag])));

const BACKGROUND_POOLS = Object.freeze({
  generic:Object.freeze(['forest_crossroad.png','old_kings_road.png','roadside_shrine.png','abandoned_camp.png','ancient_ruins.png','stormy_bridge.png','moonlit_gravefield.png','market_square_twilight.png']),
  humans:Object.freeze(['human_waystation.png','human_chapel_court.png']),
  elves:Object.freeze(['elven_glade.png','elven_waystones.png']),
  orcs:Object.freeze(['orc_war_camp.png','orc_trial_circle.png']),
  undead:Object.freeze(['necropolis_gate.png','bone_court.png']),
  dark_elves:Object.freeze(['obsidian_passage.png','spider_shrine.png']),
  dwarves:Object.freeze(['dwarven_forgehall.png','dwarven_gate_road.png']),
  demons:Object.freeze(['infernal_breach.png','ashen_altar.png']),
  angels:Object.freeze(['sky_sanctuary.png','hall_of_halos.png']),
  dragonborn:Object.freeze(['dragonborn_aerie.png','ember_tribunal.png']),
  beastfolk:Object.freeze(['beastfolk_hunting_camp.png','moon_run_path.png']),
  constructs:Object.freeze(['construct_foundry.png','silent_observatory.png']),
  animals:Object.freeze(['wild_glen.png','riverbank_tracks.png']),
  fae:Object.freeze(['fae_ring_garden.png','whispering_meadow.png']),
  goblins:Object.freeze(['goblin_trade_nook.png','goblin_scrapyard_camp.png'])
});
const BACKGROUND_FOLDER_BY_RACE = Object.freeze({});

function hashString(value) { let hash=2166136261; for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);} return hash>>>0; }
function normalizeRaceTag(value) {
  const raw=String(value||'').trim(),tag=raw.toLowerCase();
  if(RACE_TAGS.includes(tag))return tag;
  return RACE_TAG_BY_LABEL[raw.toLocaleLowerCase('ru-RU')]||'mixed';
}
function oppositeColor(color){return color==='b'?'w':'b';}
// Every race now has a separate light/dark chess set. The same sprites are used
// on the board AND in Arena opponent/squad cards; no legacy catalog art fallback.
const BOARD_PIECE_RACES=RACE_TAGS;
function boardRacePiecePath(raceTag,pieceType,color='b'){
  const race=normalizeRaceTag(raceTag),resolved=race==='mixed'?'humans':race;
  const type=PIECE_TYPES.includes(pieceType)?pieceType:'pawn';
  return `assets/races/${resolved}/pieces/board/${color==='w'?'white':'black'}/${type}.png`;
}
function racePiecePath(raceTag,pieceType,color='b'){
  return boardRacePiecePath(raceTag,pieceType,color);
}
function boardPieceArtForTheme(theme,pieceType,color){
  const race=theme?.enemyRoleRaces?.[pieceType]||theme?.enemyRaceTag||'humans';
  return boardRacePiecePath(race,pieceType,color||theme?.enemyColor||'b');
}
function heroPortraitArt(character){
  // Resolve portraits by stable hero ID, so previously saved runs with the old
  // portrait.png path receive new named art without migrating save data.
  const id=String(character?.id||'').replace(/^hero\./,'');
  if(NAMED_PAWN_SET.has(id)||NAMED_BISHOP_SET.has(id)||NAMED_KNIGHT_SET.has(id)||NAMED_ROOK_SET.has(id))return `assets/heroes/${id}/portrait_named.webp`;
  return character?.portrait||character?.pieceArt||'';
}
function boardPieceArtForCharacter(character,color='w',currentPieceType=character?.pieceType){
  // Roles can change through pawn promotion. Resolve art from the ACTUAL chess piece
  // rather than the saved roster starter role. The hero's identity survives the move.
  if(character?.isRunKing)return commanderPieceArt(character.commanderId,color);
  const personalized=namedPawnPieceArt(character,currentPieceType,color)||namedBishopPieceArt(character,currentPieceType,color)||namedKnightPieceArt(character,currentPieceType,color)||namedRookPieceArt(character,currentPieceType,color);
  if(personalized)return personalized;
  const id=String(character?.id||'').replace(/^hero\./,'');
  // For other named heroes, always restore the individual badge art (even for
  // older saves lacking pieceArt, or a transient formation proxy with only id).
  // Generic mercenaries/enemies still receive their normal race pieces.
  if(String(character?.id||'').startsWith('hero.')&&id)return `assets/heroes/${id}/piece_badge.png`;
  return character?.boardPieceArt||character?.pieceArt||boardRacePiecePath(character?.raceTag||'humans',currentPieceType,color);
}
function setBoardPieceArt(image,src){
  if(!image)return;
  if(typeof image.getAttribute==='function'&&typeof image.setAttribute==='function'){
    if(image.getAttribute('src')!==src)image.setAttribute('src',src);
  }else if(image.src!==src)image.src=src;
  const dedicated=String(src).includes('/pieces/board/')||/\/kings\/[^/]+\/pieces\/(?:white|black)\.webp$/.test(String(src))||/\/heroes\/[^/]+\/pieces\/(?:white|black)\/(?:pawn|knight|bishop|rook|queen)\.webp$/.test(String(src));
  image.classList.toggle('classic-piece--new-race',dedicated);
  // New illustrations are self-explanatory: no legacy role glyph or decorative aura.
  if(dedicated)image.parentElement?.querySelector('.classic-piece-marker')?.remove();
}
function raceBoardTiles(raceTag){
  const race=normalizeRaceTag(raceTag);
  if(race==='mixed')return null;
  const root=`assets/races/${race}/board`;
  return Object.freeze({ raceTag:race, light:`${root}/${BOARD_TILE_FILES.light}`, dark:`${root}/${BOARD_TILE_FILES.dark}` });
}
function installRaceBoardStyles(){
  if(typeof document==='undefined')return false;
  if(document.getElementById(BOARD_THEME_STYLE_ID))return true;
  const style=document.createElement('style');
  style.id=BOARD_THEME_STYLE_ID;
  style.textContent=`
.classic-board[data-board-race] .classic-square--light{background-image:var(--board-light-tile),linear-gradient(145deg,#c3b995,#aa9f7c);background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat}
.classic-board[data-board-race] .classic-square--dark{background-image:var(--board-dark-tile),linear-gradient(145deg,#4d585d,#374349);background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat}
`;
  document.head.append(style);
  return true;
}
function applyRaceBoardTheme(board,raceTag){
  if(!board)return null;
  installRaceBoardStyles();
  const tiles=raceBoardTiles(raceTag);
  if(!tiles){
    delete board.dataset.boardRace;
    board.style.removeProperty('--board-light-tile');
    board.style.removeProperty('--board-dark-tile');
    return null;
  }
  board.dataset.boardRace=tiles.raceTag;
  board.style.setProperty('--board-light-tile',`url("${tiles.light}")`);
  board.style.setProperty('--board-dark-tile',`url("${tiles.dark}")`);
  return tiles;
}
function currentCombatBoardRace(){
  const battle=globalThis.RPChessBattle?.battlePlan;
  if(battle)return battle.encounter?.enemyRaceTag||globalThis.RPChessBattle?.encounter?.enemyRaceTag||null;
  const skirmish=globalThis.RPChessSkirmish?.battlePlan;
  if(skirmish)return skirmish.encounter?.enemyRaceTag||globalThis.RPChessSkirmish?.encounter?.enemyRaceTag||null;
  return null;
}
function queueRaceBoardRuntimeInstall(){
  if(typeof document==='undefined'||boardRuntimeInstallQueued)return false;
  boardRuntimeInstallQueued=true;
  let installed=false;
  const retry=()=>{
    if(installed)return;
    if(!globalThis.RPChessClassicChess?.newGame)return;
    installed=true;
    boardRuntimeInstallQueued=false;
    installRaceBoardRuntime();
  };
  if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',retry,{once:true});
  setTimeout(retry,0);
  return true;
}
function installRaceBoardRuntime(){
  if(typeof document==='undefined')return false;
  const board=document.querySelector('[data-chess-board]');
  const api=globalThis.RPChessClassicChess;
  if(!board)return false;
  if(!api?.newGame){queueRaceBoardRuntimeInstall();return false;}
  if(api.__raceBoardThemeInstalled)return true;
  installRaceBoardStyles();
  const originalNewGame=api.newGame.bind(api);
  api.newGame=(fen=null,options={})=>{
    const snapshot=originalNewGame(fen,options);
    applyRaceBoardTheme(board,currentCombatBoardRace());
    return snapshot;
  };
  Object.defineProperty(api,'__raceBoardThemeInstalled',{value:true,enumerable:false});
  const clear=()=>applyRaceBoardTheme(board,null);
  addEventListener('rpchess:new-game',clear);
  document.querySelector('[data-classic-new]')?.addEventListener('click',clear,{capture:true});
  document.querySelector('[data-result-rematch]')?.addEventListener('click',clear,{capture:true});
  return true;
}
function eventBackgroundPath(event){
  const id=event?.id||event?.eventId||'event',race=normalizeRaceTag(event?.raceTag||event?.race),pool=race==='mixed'?BACKGROUND_POOLS.generic:(BACKGROUND_POOLS[race]||BACKGROUND_POOLS.generic),filename=pool[hashString(`${id}:background`)%pool.length],folder=race==='mixed'?'generic':(BACKGROUND_FOLDER_BY_RACE[race]||race);
  return `assets/events/register-04/backgrounds/${folder}/${filename.replace(/\.png$/,'.webp')}`;
}
function deterministicPlayerColor(seed,explicit=null){if(explicit==='w'||explicit==='b')return explicit;return hashString(`${seed}:player-color`)%100<36?'b':'w';}
function deterministicRace(seed,explicit=null){const tag=normalizeRaceTag(explicit);if(tag!=='mixed')return tag;return RACE_TAGS[hashString(`${seed}:enemy-race`)%RACE_TAGS.length];}
function mixedRoleRaces(seed,raceTag='mixed'){
  const normalized=normalizeRaceTag(raceTag);if(normalized!=='mixed')return Object.freeze(Object.fromEntries(PIECE_TYPES.map(type=>[type,normalized])));
  const pool=[...RACE_TAGS],first=pool[hashString(`${seed}:mix:1`)%pool.length];let second=pool[hashString(`${seed}:mix:2`)%pool.length];if(second===first)second=pool[(pool.indexOf(second)+5)%pool.length];let third=pool[hashString(`${seed}:mix:3`)%pool.length];if(third===first||third===second)third=pool[(pool.indexOf(third)+9)%pool.length];return Object.freeze({pawn:first,knight:second,bishop:third,rook:second,queen:third,king:first});
}
function combatTheme({seed,raceTag=null,playerColor=null,mixed=false}={}){
  const resolvedSeed=String(seed||'rpchess-combat'),normalized=normalizeRaceTag(raceTag),roleRaces=mixed||normalized==='mixed'?mixedRoleRaces(resolvedSeed,'mixed'):mixedRoleRaces(resolvedSeed,deterministicRace(resolvedSeed,normalized)),primaryRace=normalized==='mixed'?roleRaces.pawn:deterministicRace(resolvedSeed,normalized),color=deterministicPlayerColor(resolvedSeed,playerColor),enemyColor=oppositeColor(color),defense=color==='b';
  return Object.freeze({playerColor:color,enemyColor,enemyRaceTag:primaryRace,enemyRoleRaces:roleRaces,mixedArmy:new Set(Object.values(roleRaces)).size>1,sideNarrative:defense?'Враг уже занял поле и начинает первым. Ваш отряд принимает бой, удерживая оборону.':'Ваш отряд перехватывает инициативу и первым выходит на поле.'});
}
function pieceArtForTheme(theme,pieceType,color){const race=theme?.enemyRoleRaces?.[pieceType]||theme?.enemyRaceTag||'humans';return racePiecePath(race,pieceType,color||theme?.enemyColor||'b');}

installRaceBoardRuntime();

export {RACE_TAGS,PIECE_TYPES,BOARD_TILE_FILES,BOARD_THEME_STYLE_ID,RACE_LABELS,RACE_TAG_BY_LABEL,BACKGROUND_POOLS,BACKGROUND_FOLDER_BY_RACE,hashString,normalizeRaceTag,oppositeColor,racePiecePath,BOARD_PIECE_RACES,boardRacePiecePath,boardPieceArtForTheme,NAMED_PAWN_IDS,NAMED_PAWN_ROLES,namedPawnPieceArt,NAMED_BISHOP_IDS,namedBishopPieceArt,NAMED_KNIGHT_IDS,namedKnightPieceArt,NAMED_ROOK_IDS,namedRookPieceArt,heroPortraitArt,boardPieceArtForCharacter,setBoardPieceArt,raceBoardTiles,installRaceBoardStyles,applyRaceBoardTheme,currentCombatBoardRace,queueRaceBoardRuntimeInstall,installRaceBoardRuntime,eventBackgroundPath,deterministicPlayerColor,deterministicRace,mixedRoleRaces,combatTheme,pieceArtForTheme};
