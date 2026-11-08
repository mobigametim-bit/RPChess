/* Runtime paths for all 85 approved Kingdom map sprites. */
import {RACE_TAGS} from './race-assets.mjs';
const KINGDOM_MAP_TYPES=Object.freeze(['battle','caravan','castle','event','settlement','skirmish']);
const races=new Set(RACE_TAGS),types=new Set(KINGDOM_MAP_TYPES);
function kingdomMapSprite(type,raceTag){
 if(type==='puzzle')return 'assets/kingdom-map/puzzle/puzzle_128.png';
 if(!types.has(type))return null;
 // Unknown/mixed is a visual fallback only: never change the saved raceTag.
 const race=races.has(raceTag)?raceTag:'humans';
 return `assets/kingdom-map/${race}/${race}_${type}_128.png`;
}
export {KINGDOM_MAP_TYPES,kingdomMapSprite};
