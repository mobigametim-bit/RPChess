/* World-coordinate encounter assignment for the Draft Kingdom experiment.
 * A cell's terrain, object, type and race are deterministic before fog reveals it.
 * No engine combat outcome, run calendar or resource transaction belongs here.
 */
import {terrainAt} from './kingdom-parchment-core.mjs';
import {VISUAL,BIOMES,RACE_TAGS_ORDER,ENCOUNTER_TYPES,DENSITY,DENSITY_MULTIPLIER,ENCOUNTER_MIN_SPACING,EVENT_NEARBY_MAX,WORLD_SETTINGS,SETTLEMENT_PROBABILITY_MULTIPLIER,TYPE_WEIGHTS,RACE_WEIGHTS} from './kingdom-world-config.mjs?v=20261109-kingdom-feedback1';

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

const TYPE_RACE_BOOSTS=Object.freeze({
 battle:{orcs:1.25,demons:1.25,undead:1.2,dragonborn:1.15},
 skirmish:{goblins:1.35,beastfolk:1.2,animals:1.2,fae:1.15},
 caravan:{humans:1.35,dwarves:1.3,goblins:1.15,elves:1.1},
 settlement:{humans:1.6,dwarves:1.4,elves:1.3,goblins:1.15}
});
const BIOME_MOD=Object.freeze({
 forest:[{event:1.3,skirmish:1.15},{elves:1.35,fae:1.5,beastfolk:1.2}],
 mountain:[{battle:1.35,caravan:.75},{angels:1.35,dragonborn:1.4}],
 hills:[{battle:1.2,puzzle:1.15},{dwarves:1.4,orcs:1.2}],
 plains:[{caravan:1.16,settlement:1.1},{humans:1.14}],
 marsh:[{event:1.35,caravan:.65},{undead:1.35,dark_elves:1.2,goblins:1.2}],
 wasteland:[{battle:1.35,settlement:.65},{demons:1.45,undead:1.25,constructs:1.2}]
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Intentionally exactly Atlas Lab v6 simRandom(), independent of the
// low-frequency hash used by the visual nature stamps.
function atlasRandom(seed,x,y,salt=''){
 let h=2166136261;
 for(const char of String(seed)+':'+salt+':'+x+':'+y){
  h^=char.charCodeAt(0);h=Math.imul(h,16777619);
 }
 h>>>=0;h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;
 h=Math.imul(h,0x846ca68b);h^=h>>>16;
 return (h>>>0)/4294967296;
}
function biomeAt(seed,x,y){
 // Atlas samples the CENTER of each integer world cell.
 const terrain=terrainAt(seed,x+.5,y+.5);
 if(terrain.kind==='mountain')return 'mountain';
 if(terrain.kind==='hill')return 'hills';
 if(terrain.wet>Math.max(.60,VISUAL.marshWetThreshold+.07)&&terrain.elevation<.58&&
    atlasRandom(seed,x,y,'marsh-category')<.68)return 'marsh';
 if(terrain.wet<.36&&terrain.elevation<.51)return 'wasteland';
 if(terrain.kind==='forest')return 'forest';
 return 'plains';
}
function landmarkAt(seed,x,y,{landmarks=WORLD_SETTINGS.landmarks}={}){
 if(!landmarks)return null;
 const chance=clamp(VISUAL.landmarkDensity*.18,0,.22);
 return atlasRandom(seed,x,y,'encounter-landmark-prob')<chance?
  LANDMARKS[Math.floor(atlasRandom(seed,x,y,'encounter-landmark-id')*LANDMARKS.length)]:null;
}
function naturalPathAt(seed,x,y,{roads=WORLD_SETTINGS.roads}={}){
 if(!roads)return {road:false,river:false};
 const roadStep=Math.max(1,VISUAL.roadSpacing);
 const roadDrift=atlasRandom(seed,1,1,'road')*roadStep*(8/12);
 const roadIndex=Math.round((y-roadDrift)/roadStep);
 const roadY=roadIndex*roadStep+roadDrift+
  VISUAL.roadCurve*(Math.sin(x*.37+roadIndex*2.1)*1.25+Math.sin(x*.83+roadIndex)*.18);
 const riverStep=Math.max(1,VISUAL.riverSpacing);
 const riverDrift=atlasRandom(seed,1,1,'river')*riverStep*(12/17);
 const riverIndex=Math.round((x-riverDrift)/riverStep);
 const riverX=riverIndex*riverStep+riverDrift+
  VISUAL.riverCurve*(Math.sin(y*.21+riverIndex*1.7)*2.15+Math.sin(y*.79+riverIndex*.3)*.55);
 return {road:Math.abs(roadY-y)<.8,river:Math.abs(riverX-x)<.7};
}
function normalized(row){
 const total=row.reduce((sum,v)=>sum+Math.max(0,Number(v)||0),0);
 return row.map(v=>total>0?Math.max(0,Number(v)||0)/total:1/row.length);
}
function pickWeighted(weights,labels,rnd){
 let sum=0;
 for(const weight of weights)sum+=Math.max(0,weight);
 if(sum<=0)return null;
 let remaining=rnd*sum;
 for(let i=0;i<weights.length;i++){
  remaining-=Math.max(0,weights[i]);
  if(remaining<0)return labels[i];
 }
 return labels[labels.length-1];
}
function weightedIndex(weights,rnd){let total=0;for(let i=0;i<weights.length;i++){total+=weights[i];if(rnd<total)return i;}return weights.length-1;}
function scaledWeights(mod,amount){
 if(!mod)return null;
 return Object.fromEntries(Object.entries(mod).map(([key,value])=>[key,clamp(1+(value-1)*amount,.3,3)]));
}
function applyWeights(base,modifiers,labels){
 const out=base.map(v=>Math.max(0,v));
 for(const changes of modifiers){
  if(!changes)continue;
  for(let i=0;i<out.length;i++)out[i]*=(changes[labels[i]]||1);
 }
 return normalized(out);
}
// Increase the final settlement probability by 20% after all biome and location
// modifiers, rescaling the other five types proportionally to keep sum = 1.
function boostSettlementProbability(weights,multiplier=SETTLEMENT_PROBABILITY_MULTIPLIER){
 const idx=ENCOUNTER_TYPES.indexOf('settlement'),previous=weights[idx];
 if(idx<0||previous<=0||previous>=1||multiplier===1)return [...weights];
 const target=Math.min(1,Math.max(0,previous*multiplier));
 const otherScale=(1-target)/(1-previous);
 return weights.map((weight,i)=>i===idx?target:weight*otherScale);
}
function encounterCandidate(seed,x,y,{densityMultiplier=DENSITY_MULTIPLIER,biomeDensity=DENSITY}={}){
 if(x===0&&y===0)return false; // starting castle never becomes an event
 const index=BIOMES.indexOf(biomeAt(seed,x,y));
 const chance=clamp((Number(biomeDensity[index])||0)*densityMultiplier/100,0,.98);
 return atlasRandom(seed,x,y,'spawn')<chance;
}
let admissionCache=new Map(),admissionSignature='';
function priorTo(seed,ax,ay,bx,by){
 const a=atlasRandom(seed,ax,ay,'spawn-priority'),b=atlasRandom(seed,bx,by,'spawn-priority');
 return a>b||(a===b&&(ay<by||(ay===by&&ax<bx)));
}
function forNearby(x,y,r,fn){
 for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(dx||dy){if(fn(x+dx,y+dy)===false)return;}
 }
}
function encounterPresent(seed,x,y,{spacing=ENCOUNTER_MIN_SPACING,
 eventNearbyMax=EVENT_NEARBY_MAX,densityMultiplier=DENSITY_MULTIPLIER,biomeDensity=DENSITY}={}){
 const r=clamp(Math.floor(Number(spacing)||0),0,3);
 const cap=clamp(Math.floor(Number(eventNearbyMax)||0),0,8*r*(r+1));
 const candidate=(xx,yy)=>encounterCandidate(seed,xx,yy,{densityMultiplier,biomeDensity});
 const sig=JSON.stringify([seed,spacing,eventNearbyMax,densityMultiplier,biomeDensity]);
 if(sig!==admissionSignature){admissionCache=new Map();admissionSignature=sig;}
 const accepted=(xx,yy)=>{
  if(!candidate(xx,yy))return false;
  if(!r||cap>=8*r*(r+1))return true;
  const key=xx+','+yy;
  if(admissionCache.has(key))return admissionCache.get(key);
  if(cap===0){
   let free=true;
   forNearby(xx,yy,r,(nx,ny)=>{
    if(candidate(nx,ny)&&priorTo(seed,nx,ny,xx,yy)){free=false;return false;}
   });
   admissionCache.set(key,free);return free;
  }
  const preceding=[];
  forNearby(xx,yy,r,(nx,ny)=>{
   if(priorTo(seed,nx,ny,xx,yy)&&accepted(nx,ny)){
    preceding.push([nx,ny]);if(preceding.length>cap)return false;
   }
  });
  if(preceding.length>cap){admissionCache.set(key,false);return false;}
  for(const [nx,ny] of preceding){
   let used=0;
   forNearby(nx,ny,r,(px,py)=>{
    if(priorTo(seed,px,py,xx,yy)&&accepted(px,py)){
     used++;if(used>=cap)return false;
    }
   });
   if(used>=cap){admissionCache.set(key,false);return false;}
  }
  admissionCache.set(key,true);return true;
 };
 return accepted(x,y);
}
function worldAt(seed,x,y,{allowSkirmish=true,spacing=ENCOUNTER_MIN_SPACING,
 eventNearbyMax=EVENT_NEARBY_MAX,densityMultiplier=DENSITY_MULTIPLIER,biomeDensity=DENSITY,
 typeWeights=TYPE_WEIGHTS,raceWeights=RACE_WEIGHTS,
 settlementProbabilityMultiplier=SETTLEMENT_PROBABILITY_MULTIPLIER,
 biomeInfluence=WORLD_SETTINGS.biomeInfluence,
 landmarkInfluence=WORLD_SETTINGS.landmarkInfluence,roadInfluence=WORLD_SETTINGS.roadInfluence,
 landmarks=WORLD_SETTINGS.landmarks,roads=WORLD_SETTINGS.roads}={}){
 const biome=biomeAt(seed,x,y);
 const landmark=landmarkAt(seed,x,y,{landmarks});
 const paths=naturalPathAt(seed,x+.5,y+.5,{roads});
 if(!encounterPresent(seed,x,y,{spacing,eventNearbyMax,densityMultiplier,biomeDensity}))
  return {biome,landmark,paths,type:null,raceTag:null};
 const idx=BIOMES.indexOf(biome),site=MODIFIERS[landmark]||null;
 const biomeMods=BIOME_MOD[biome];
 const weightedTypes=boostSettlementProbability(applyWeights(typeWeights[idx],[
  scaledWeights(biomeMods[0],biomeInfluence),
  scaledWeights(site?.t,landmarks?landmarkInfluence:0),
  scaledWeights(paths.road?{caravan:1.5,settlement:1.25}:null,roadInfluence),
  scaledWeights(paths.river?{event:1.15,settlement:1.1}:null,roadInfluence)
 ],ENCOUNTER_TYPES),settlementProbabilityMultiplier);
 const type=ENCOUNTER_TYPES[weightedIndex(weightedTypes,atlasRandom(seed,x,y,'type'))];
 // Gameplay may defer inaccessible Skirmishes; the *world layout* never
 // resamples them, preserving parity with Atlas.
 if(type==='puzzle'||type==='event')
  return {biome,landmark,paths,type,raceTag:null};
 const races=applyWeights(raceWeights[idx],[
  TYPE_RACE_BOOSTS[type],
  scaledWeights(biomeMods[1],biomeInfluence),
  scaledWeights(site?.r,landmarks?landmarkInfluence:0),
  scaledWeights(paths.road?{humans:1.25,dwarves:1.15}:null,roadInfluence),
  scaledWeights(paths.river?{animals:1.2,humans:1.1}:null,roadInfluence)
 ],RACE_TAGS_ORDER);
 return {biome,landmark,paths,type,
  raceTag:RACE_TAGS_ORDER[weightedIndex(races,atlasRandom(seed,x,y,'race'))]};
}
export {LANDMARKS,MODIFIERS,biomeAt,landmarkAt,naturalPathAt,
 pickWeighted,boostSettlementProbability,atlasRandom,encounterCandidate,encounterPresent,worldAt};
