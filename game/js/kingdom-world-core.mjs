/* World-coordinate encounter assignment for the Draft Kingdom experiment.
 * A cell's terrain, object, type and race are deterministic before fog reveals it.
 * No engine combat outcome, run calendar or resource transaction belongs here.
 */
import {terrainAt,randomAt} from './kingdom-parchment-core.mjs';
import {VISUAL,BIOMES,RACE_TAGS_ORDER,ENCOUNTER_TYPES,DENSITY,DENSITY_MULTIPLIER,ENCOUNTER_MIN_SPACING,TYPE_WEIGHTS,RACE_WEIGHTS} from './kingdom-world-config.mjs?v=20261109-atlas-lab-v7';

const LANDMARKS=Object.freeze('01_broken_wall 02_stone_circle 03_three_menhirs 04_watchtower 05_abandoned_hut 06_wood_bridge 07_stone_bridge 08_burial_mound 09_dead_tree 10_ruin_arch 11_fallen_column 12_wayside_shrine 13_obelisk 14_pond 15_notable_grove 16_ruined_gate'.split(' '));
const MODIFIERS=Object.freeze({
 '01_broken_wall':{t:{battle:1.2,event:1.25},r:{undead:1.2,constructs:1.2}},
 '02_stone_circle':{t:{event:1.6,puzzle:1.3},r:{fae:1.35}},
 '03_three_menhirs':{t:{event:1.6,puzzle:1.2},r:{fae:1.3,angels:1.2}},
 '04_watchtower':{t:{skirmish:1.5,battle:1.2},r:{humans:1.3,orcs:1.2}},
 '05_abandoned_hut':{t:{event:1.4,settlement:1.1},r:{humans:1.2,goblins:1.2}},
 '06_wood_bridge':{t:{caravan:1.6,settlement:1.15},r:{humans:1.35,goblins:1.2}},
 '07_stone_bridge':{t:{caravan:1.65,battle:1.1},r:{humans:1.2,dwarves:1.25}},
 '08_burial_mound':{t:{event:1.4,puzzle:1.3},r:{undead:1.6}},
 '09_dead_tree':{t:{event:1.25,skirmish:1.2},r:{undead:1.3,demons:1.3}},
 '10_ruin_arch':{t:{puzzle:1.45,event:1.25},r:{undead:1.25,constructs:1.3}},
 '11_fallen_column':{t:{puzzle:1.35,battle:1.2},r:{constructs:1.3,angels:1.15}},
 '12_wayside_shrine':{t:{event:1.5,settlement:1.3},r:{angels:1.5,humans:1.2}},
 '13_obelisk':{t:{puzzle:1.5,event:1.3},r:{constructs:1.5,demons:1.2}},
 '14_pond':{t:{event:1.2,settlement:1.1},r:{animals:1.4,fae:1.25}},
 '15_notable_grove':{t:{event:1.4,settlement:1.1},r:{elves:1.45,fae:1.45}},
 '16_ruined_gate':{t:{battle:1.45,skirmish:1.2},r:{orcs:1.2,demons:1.25,undead:1.15}}
});
const TYPE_RACE_BOOSTS={
 battle:{orcs:1.25,demons:1.25,undead:1.2,dragonborn:1.15},
 skirmish:{goblins:1.35,beastfolk:1.2,animals:1.2,fae:1.15},
 caravan:{humans:1.35,dwarves:1.3,goblins:1.15,elves:1.1},
 settlement:{humans:1.6,dwarves:1.4,elves:1.3,goblins:1.15}
};
function biomeAt(seed,x,y){
 const t=terrainAt(seed,x,y);
 if(t.elevation>VISUAL.mountainThreshold)return 'mountain';
 if(t.elevation>VISUAL.hillThreshold)return 'hills';
 if(t.wet>.59&&t.elevation<.59)return 'marsh';
 if(t.wet<.30)return 'wasteland';
 return t.wet>VISUAL.forestThreshold?'forest':'plains';
}
function landmarkAt(seed,x,y){
 if(randomAt(seed,x,y,'landmark-presence')>=VISUAL.landmarkDensity*.095)return null;
 return LANDMARKS[Math.floor(randomAt(seed,x,y,'landmark-kind')*LANDMARKS.length)]||null;
}
function naturalPathAt(seed,x,y){
 // Mirrors the two world-space oscillating Canvas paths. Royal roads are excluded.
 const roadDrift=randomAt(seed,1,1,'road')*8;
 const k=Math.round((y-roadDrift)/VISUAL.roadSpacing);
 const roadY=k*VISUAL.roadSpacing+roadDrift+Math.sin(x*.37+k*2.1)*1.25*VISUAL.roadCurve+Math.sin(x*.83+k)*.18;
 const riverDrift=randomAt(seed,1,1,'river')*12;
 const j=Math.round((x-riverDrift)/VISUAL.riverSpacing);
 const riverX=j*VISUAL.riverSpacing+riverDrift+Math.sin(y*.21+j*1.7)*2.15*VISUAL.riverCurve+Math.sin(y*.79+j*.3)*.55;
 return {road:Math.abs(y-roadY)<.68,river:Math.abs(x-riverX)<.55};
}
function pickWeighted(values,labels,rnd){
 let sum=0;for(const w of values)sum+=Math.max(0,w);
 if(sum<=0)return null;
 let target=rnd*sum;
 for(let i=0;i<values.length;i++){target-=Math.max(0,values[i]);if(target<0)return labels[i];}
 return labels[labels.length-1];
}
// Stable priority thinning (blue-noise-like hard-core sampling). A candidate
// cannot coexist with any higher ranked candidate in its surrounding N tiles.
// This depends only on seed/world coords: scouting order and camera never alter
// the placement, and persisted/revealed cells are never rerolled by this module.
function encounterCandidate(seed,x,y,{densityMultiplier=DENSITY_MULTIPLIER,biomeDensity=DENSITY}={}){
 const biome=biomeAt(seed,x,y),index=BIOMES.indexOf(biome);
 const density=Number(biomeDensity[index])||0;
 const chance=Math.min(1,Math.max(0,density*Math.max(0,Number(densityMultiplier)||0)/100));
 return randomAt(seed,x,y,'encounter-presence')<chance;
}
function encounterPresent(seed,x,y,{spacing=ENCOUNTER_MIN_SPACING,densityMultiplier=DENSITY_MULTIPLIER,biomeDensity=DENSITY}={}){
 const params={densityMultiplier,biomeDensity};
 if(!encounterCandidate(seed,x,y,params))return false;
 const radius=Math.max(0,Math.min(2,Math.floor(Number(spacing)||0)));
 if(radius===0)return true;
 const rank=randomAt(seed,x,y,'encounter-priority');
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  if(dx===0&&dy===0)continue;
  const nx=x+dx,ny=y+dy;
  if(!encounterCandidate(seed,nx,ny,params))continue;
  const other=randomAt(seed,nx,ny,'encounter-priority');
  if(other>rank||(other===rank&&(ny<y||(ny===y&&nx<x))))return false;
 }
 return true;
}
function worldAt(seed,x,y,{allowSkirmish=true,spacing=ENCOUNTER_MIN_SPACING,
 densityMultiplier=DENSITY_MULTIPLIER,biomeDensity=DENSITY}={}){
 const biome=biomeAt(seed,x,y),biomeIndex=BIOMES.indexOf(biome);
 const landmark=landmarkAt(seed,x,y),paths=naturalPathAt(seed,x,y);
 const occupied=encounterPresent(seed,x,y,{spacing,densityMultiplier,biomeDensity});
 if(!occupied)return {biome,landmark,paths,type:null,raceTag:null};
 const mods=MODIFIERS[landmark]||{t:{},r:{}};
 const typeWeights=TYPE_WEIGHTS[biomeIndex].map((w,i)=>{
  const t=ENCOUNTER_TYPES[i];
  if(t==='skirmish'&&!allowSkirmish)return 0;
  let boost=mods.t[t]||1;
  if(paths.road&&t==='caravan')boost*=1.5;
  if(paths.road&&t==='settlement')boost*=1.25;
  if(paths.river&&t==='event')boost*=1.15;
  if(paths.river&&t==='settlement')boost*=1.10;
  return w*Math.min(2.5,Math.max(.5,boost));
 });
 const type=pickWeighted(typeWeights,ENCOUNTER_TYPES,randomAt(seed,x,y,'encounter-type'));
 // Story events and puzzles keep their authored canonical identity. Only
 // combat and the cosmetic settlement affiliation sample the biome race table.
 if(type==='event'||type==='puzzle')return {biome,landmark,paths,type,raceTag:null};
 const raceWeights=RACE_WEIGHTS[biomeIndex].map((w,i)=>{
  const race=RACE_TAGS_ORDER[i];
  let factor=(mods.r[race]||1)*(TYPE_RACE_BOOSTS[type]?.[race]||1);
  if(paths.road&&race==='humans')factor*=1.25;
  if(paths.road&&race==='dwarves')factor*=1.15;
  if(paths.river&&race==='animals')factor*=1.20;
  return w*Math.min(2.5,Math.max(.5,factor));
 });
 const raceTag=pickWeighted(raceWeights,RACE_TAGS_ORDER,randomAt(seed,x,y,'encounter-race'));
 return {biome,landmark,paths,type,raceTag};
}
export {LANDMARKS,MODIFIERS,biomeAt,landmarkAt,naturalPathAt,pickWeighted,encounterCandidate,encounterPresent,worldAt};
