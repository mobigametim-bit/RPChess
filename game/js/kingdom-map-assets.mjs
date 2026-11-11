/* Runtime paths for all 85 approved Kingdom map sprites. */
import {RACE_TAGS,hashString,racePiecePath} from './race-assets.mjs';
const KINGDOM_MAP_TYPES=Object.freeze(['battle','caravan','castle','event','settlement','skirmish']);
const races=new Set(RACE_TAGS),types=new Set(KINGDOM_MAP_TYPES);
const COMBAT_TYPES=new Set(['battle','skirmish','caravan']);
const THREAT_PIECES=Object.freeze(['pawn','knight','bishop','rook','queen','king']);
function kingdomMapSprite(type,raceTag,visualRaceOrSeed=''){
 if(type==='puzzle')return 'assets/kingdom-map/puzzle/puzzle_128.svg';
 if(!types.has(type))return null;
 // Mixed/unknown narrative events use existing race SVG art. This choice is
 // cosmetic only; actual event race and board terrain remain neutral.
 if(type==='event'&&!races.has(raceTag)){
  const artRace=races.has(visualRaceOrSeed)?visualRaceOrSeed:
    RACE_TAGS[hashString(String(visualRaceOrSeed||'neutral-event')+':event-visual-race')%RACE_TAGS.length];
  return `assets/kingdom-map/${artRace}/${artRace}_event_128.svg`;
 }
 if(!races.has(raceTag)){
  if(type==='castle')return 'assets/kingdom-map/humans/humans_castle_128.svg';
  return ({battle:'generated_assets/node_elite.png',skirmish:'generated_assets/node_battle.png',
    caravan:'assets/doctrines/cavalry/emblem.png',
    settlement:'generated_assets/node_shop.png'})[type]||null;
 }
 return `assets/kingdom-map/${raceTag}/${raceTag}_${type}_128.svg`;
}
// The chess figure denotes the combat threat in pairs of levels: 1-2 pawn,
// 3-4 knight, 5-6 bishop, 7-8 rook, 9-10 queen, 11-12 king.
// Visual-only: never modify encounter type, enemy side, stars or persisted routes.
function kingdomEncounterSprite(choice){
 if(!choice)return null;
 if(COMBAT_TYPES.has(choice.type)){
  const race=races.has(choice.enemyRaceTag)?choice.enemyRaceTag:
   (races.has(choice.raceTag)?choice.raceTag:null);
  if(race){
   const stars=Math.max(1,Math.min(12,Number.isInteger(choice.stars)?choice.stars:1));
   const role=THREAT_PIECES[Math.floor((stars-1)/2)];
   return racePiecePath(race,role,'b');
  }
 }
 // Legacy encounters with no race retain their prior icon; event art and all
 // other encounter types preserve the existing deterministic behavior.
 return kingdomMapSprite(choice.type,choice.raceTag||choice.enemyRaceTag,
  choice.visualRaceTag||choice.seed||choice.id);
}
export {KINGDOM_MAP_TYPES,kingdomMapSprite,kingdomEncounterSprite};
