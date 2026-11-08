/* Runtime paths for all 85 approved Kingdom map sprites. */
import {RACE_TAGS} from './race-assets.mjs';
const KINGDOM_MAP_TYPES=Object.freeze(['battle','caravan','castle','event','settlement','skirmish']);
const races=new Set(RACE_TAGS),types=new Set(KINGDOM_MAP_TYPES);
function kingdomMapSprite(type,raceTag){
 if(type==='puzzle')return 'assets/kingdom-map/puzzle/puzzle_128.svg';
 if(!types.has(type))return null;
 // Never invent a race for mixed events: those keep the existing neutral art.
 if(!races.has(raceTag)){
  if(type==='castle')return 'assets/kingdom-map/humans/humans_castle_128.svg';
  return ({battle:'generated_assets/node_elite.png',skirmish:'generated_assets/node_battle.png',
    caravan:'assets/doctrines/cavalry/emblem.png',event:'generated_assets/node_story.png',
    settlement:'generated_assets/node_shop.png'})[type]||null;
 }
 return `assets/kingdom-map/${raceTag}/${raceTag}_${type}_128.svg`;
}
export {KINGDOM_MAP_TYPES,kingdomMapSprite};
