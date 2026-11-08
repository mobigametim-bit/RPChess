/* Fixed 85-sprite register for the Kingdom map. Validate source and dist. */
const fs=require('node:fs');
const path=require('node:path');
const {parsePng}=require('./piece-asset-runtime.cjs');
const KINGDOM_RACES=Object.freeze(['humans','elves','orcs','undead','dark_elves','dwarves','demons','angels','dragonborn','beastfolk','constructs','animals','fae','goblins']);
const KINGDOM_TYPES=Object.freeze(['battle','caravan','castle','event','settlement','skirmish']);
const KINGDOM_MAP_ASSET_PATHS=Object.freeze([
 ...KINGDOM_RACES.flatMap(race=>KINGDOM_TYPES.map(type=>`assets/kingdom-map/${race}/${race}_${type}_128.png`)),
 'assets/kingdom-map/puzzle/puzzle_128.png'
]);
function collectKingdomMapAssetPaths(){return [...KINGDOM_MAP_ASSET_PATHS];}
function assertKingdomMapAssetBudget(root){
 let totalBytes=0;
 for(const relative of KINGDOM_MAP_ASSET_PATHS){
  const full=path.join(root,relative);
  if(!fs.existsSync(full))throw new Error('[kingdom assets] missing '+relative);
  const bytes=fs.readFileSync(full),image=parsePng(bytes);
  if(image.width!==128||image.height!==128||image.colorType!==6)
   throw new Error('[kingdom assets] expected transparent 128x128 RGBA PNG: '+relative);
  if(bytes.length>48*1024)throw new Error('[kingdom assets] sprite exceeds 48 KiB: '+relative);
  totalBytes+=bytes.length;
 }
 if(totalBytes>3*1024*1024)throw new Error('[kingdom assets] sprites exceed 3 MiB');
 return {count:KINGDOM_MAP_ASSET_PATHS.length,totalBytes};
}
module.exports={KINGDOM_RACES,KINGDOM_TYPES,KINGDOM_MAP_ASSET_PATHS,collectKingdomMapAssetPaths,assertKingdomMapAssetBudget};
