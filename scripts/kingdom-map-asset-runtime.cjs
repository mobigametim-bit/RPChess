/* Fixed 85-sprite SVG register for Kingdom map. Validate both source and dist. */
const fs=require('node:fs');
const path=require('node:path');
const KINGDOM_RACES=Object.freeze(['humans','elves','orcs','undead','dark_elves','dwarves','demons','angels','dragonborn','beastfolk','constructs','animals','fae','goblins']);
const KINGDOM_TYPES=Object.freeze(['battle','caravan','castle','event','settlement','skirmish']);
const KINGDOM_MAP_ASSET_PATHS=Object.freeze([
 ...KINGDOM_RACES.flatMap(race=>KINGDOM_TYPES.map(type=>`assets/kingdom-map/${race}/${race}_${type}_128.svg`)),
 'assets/kingdom-map/puzzle/puzzle_128.svg'
]);
const MAX_SVG_BYTES=128*1024;
const MAX_TOTAL_BYTES=8*1024*1024;
function collectKingdomMapAssetPaths(){return [...KINGDOM_MAP_ASSET_PATHS];}
function assertKingdomMapAssetBudget(root){
 let totalBytes=0;
 for(const relative of KINGDOM_MAP_ASSET_PATHS){
  const full=path.join(root,relative),oldPng=full.replace(/\.svg$/,'.png');
  if(!fs.existsSync(full))throw new Error('[kingdom assets] missing '+relative);
  if(fs.existsSync(oldPng))throw new Error('[kingdom assets] obsolete PNG is still present: '+oldPng);
  const bytes=fs.readFileSync(full),svg=bytes.toString('utf8').trim();
  if(bytes.length>MAX_SVG_BYTES)throw new Error('[kingdom assets] SVG exceeds 128 KiB: '+relative);
  if(!/^<svg\b/i.test(svg)||!/<\/svg>$/.test(svg)||
    !/\bviewBox="0 0 128 128"/.test(svg)||
    !/\bwidth="128"/.test(svg)||!/\bheight="128"/.test(svg)||
    !/<path\b/.test(svg)||!/<mask\b/.test(svg))
   throw new Error('[kingdom assets] expected standalone 128x128 vector SVG: '+relative);
  // No linked images/scripts or remote dependencies in published game assets.
  if(/<(?:script|image|foreignObject)\b/i.test(svg)||/data:image\//i.test(svg)||
    /\b(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|data:)/i.test(svg))
   throw new Error('[kingdom assets] external or raster SVG content forbidden: '+relative);
  totalBytes+=bytes.length;
 }
 if(totalBytes>MAX_TOTAL_BYTES)throw new Error('[kingdom assets] SVG assets exceed 8 MiB');
 return {count:KINGDOM_MAP_ASSET_PATHS.length,totalBytes};
}
module.exports={KINGDOM_RACES,KINGDOM_TYPES,KINGDOM_MAP_ASSET_PATHS,collectKingdomMapAssetPaths,assertKingdomMapAssetBudget};
