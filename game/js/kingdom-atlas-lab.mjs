/* Atlas Lab v7 — uses exactly the same world placement and SVG parchment
 * renderer as RPChess. This page writes NO run state and NO Arena ledger.
 */
import {worldAt,encounterCandidate} from './kingdom-world-core.mjs?v=20261109-atlas-lab-v7';
import {VISUAL,ATLAS_VIEW,BIOMES,DENSITY,DENSITY_MULTIPLIER,ENCOUNTER_MIN_SPACING,
 TERRAIN_LAYOUT,TYPE_WEIGHTS,RACE_WEIGHTS,ENCOUNTER_TYPES,RACE_TAGS_ORDER}
 from './kingdom-world-config.mjs?v=20261109-atlas-lab-v7';
import {renderParchment} from './kingdom-parchment-app.mjs?v=20261109-atlas-lab-v7';
import {kingdomMapSprite,kingdomEncounterSprite} from './kingdom-map-assets.mjs';

const byId=id=>document.getElementById(id);
const BIOME_NAMES=['Лес','Горы','Холмы','Равнины','Болота','Пустоши'];
const TYPE_NAMES=['Битва','Стычка','Караван','Поселение','Событие','Задача'];
const RACE_NAMES=['Люди','Эльфы','Орки','Нежить','Тёмные эльфы','Гномы','Демоны',
 'Ангелы','Дракониды','Зверолюди','Конструкты','Животные','Феи','Гоблины'];
const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const clamp=(a,min,max)=>Math.max(min,Math.min(max,Number(a)||0));
const matrixCopy=matrix=>matrix.map(row=>[...row]);
let densities=[...DENSITY],typeWeights=matrixCopy(TYPE_WEIGHTS),raceWeights=matrixCopy(RACE_WEIGHTS);
const defaults={seed:ATLAS_VIEW.seed,density:DENSITY_MULTIPLIER,spacing:ENCOUNTER_MIN_SPACING,
 stampSpacing:VISUAL.stampSpacing,jitter:TERRAIN_LAYOUT.jitter,
 separation:TERRAIN_LAYOUT.separation,zoom:ATLAS_VIEW.zoom};
let drawn=null;

function value(id){return Number(byId(id).value);}
function updateReadouts(){
 for(const [input,out,digits] of [['density','density-out',1],
  ['terrain-step','terrain-step-out',2],['jitter','jitter-out',2],
  ['separation','separation-out',2],['zoom','zoom-out',0]]){
  byId(out).value=value(input).toFixed(digits);
 }
}
function makeBiomeDensities(){
 const root=byId('biome-densities');root.replaceChildren();
 BIOMES.forEach((biome,i)=>{
  const row=document.createElement('label');
  const name=document.createElement('span');name.textContent=BIOME_NAMES[i];
  const input=document.createElement('input');input.type='number';input.min='0';input.max='100';
  input.step='1';input.value=String(densities[i]);input.dataset.biomeDensity=i;
  input.addEventListener('change',()=>{densities[i]=clamp(input.value,0,100);input.value=densities[i];});
  row.append(name,input);root.append(row);
 });
}
function makeWeightTable(rootId,labels,matrix,property){
 const root=byId(rootId);root.replaceChildren();
 const table=document.createElement('table'),head=document.createElement('thead'),hr=document.createElement('tr');
 for(const h of ['Биом',...labels]){
  const th=document.createElement('th');th.textContent=h;th.scope='col';hr.append(th);
 }
 head.append(hr);table.append(head);
 const body=document.createElement('tbody');
 matrix.forEach((row,i)=>{
  const tr=document.createElement('tr');
  const th=document.createElement('th');th.textContent=BIOME_NAMES[i];tr.append(th);
  row.forEach((score,j)=>{
   const td=document.createElement('td'),inp=document.createElement('input');
   inp.type='number';inp.min='0';inp.max='999';inp.step='1';
   inp.value=String(score);inp.dataset.kind=property;inp.dataset.row=i;inp.dataset.col=j;
   inp.setAttribute('aria-label',BIOME_NAMES[i]+' '+labels[j]);
   inp.addEventListener('change',()=>{matrix[i][j]=clamp(inp.value,0,999);inp.value=matrix[i][j];});
   td.append(inp);tr.append(td);
  });
  body.append(tr);
 });
 table.append(body);root.append(table);
}
function makeTables(){
 makeBiomeDensities();
 makeWeightTable('type-weights',TYPE_NAMES,typeWeights,'types');
 makeWeightTable('race-weights',RACE_NAMES,raceWeights,'races');
}
function controls(){
 return {seed:byId('seed').value.trim()||defaults.seed,
  densityMultiplier:value('density'),spacing:value('spacing'),
  zoom:value('zoom'),terrain:{
   stampSpacing:value('terrain-step'),jitter:value('jitter'),separation:value('separation')
  },biomeDensity:[...densities],typeWeights:matrixCopy(typeWeights),
  raceWeights:matrixCopy(raceWeights)};
}
function formatStats(count,total,minDistance,candidateCount,types){
 const blocks=[
  ['Встречи',String(count)],
  ['Фактическая плотность',(count*100/Math.max(1,total)).toFixed(1)+'%'],
  ['Пустые клетки',String(total-count)],
  ['Ближайшие события',minDistance===Infinity?'—':String(minDistance)+' ход.']
 ];
 byId('stats').replaceChildren();
 for(const [label,number] of blocks){
  const card=document.createElement('div');card.className='stat';
  const big=document.createElement('strong');big.textContent=number;
  const title=document.createElement('span');title.textContent=label;card.append(big,title);
  byId('stats').append(card);
 }
 byId('summary').textContent='До разреживания: '+candidateCount+' кандидатов. '+
  'После: '+count+'. По типам: '+TYPE_NAMES.map((t,i)=>t+' '+(types[ENCOUNTER_TYPES[i]]||0)).join(' · ')+
  '. Расстояние измеряется ходами короля (диагоналями в том числе).';
}
function overlayMarkers({seed,points,width,height,showEvents,showGrid,center}){
 const root=byId('markers');root.replaceChildren();
 root.style.backgroundImage=showGrid?
  'linear-gradient(to right,rgba(55,46,31,.25) 1px,transparent 1px),linear-gradient(to bottom,rgba(55,46,31,.25) 1px,transparent 1px)':'none';
 root.style.backgroundSize=(100/width)+'% '+(100/height)+'%';
 if(!showEvents)return;
 const cx=Math.floor(width/2),cy=Math.floor(height/2);
 // The real journey always reserves world (0,0) for the starting castle.
 const castle=document.createElement('img');castle.className='site';
 castle.src=kingdomMapSprite('castle','humans');castle.alt='Замок игрока';
 castle.style.left=((0-center.x+cx+.5)*100/width)+'%';
 castle.style.top=((0-center.y+cy+.5)*100/height)+'%';
 castle.style.width=(73/width)+'%';castle.style.height=(73/height)+'%';
 root.append(castle);
 for(const point of points){
  const px=(point.x-center.x+cx+.5)*100/width;
  const py=(point.y-center.y+cy+.5)*100/height;
  const site=document.createElement('img');site.className='site';
  site.src=kingdomMapSprite(point.type,point.raceTag,seed+':'+point.x+':'+point.y);
  site.alt='';site.loading='eager';
  site.style.left=px+'%';site.style.top=py+'%';
  site.style.width=(73/width)+'%';site.style.height=(73/height)+'%';
  site.title=TYPE_NAMES[ENCOUNTER_TYPES.indexOf(point.type)]+' · '+point.biome;
  root.append(site);
  if(['battle','skirmish','caravan'].includes(point.type)){
   // The real Kingdom UI separates the defending figure from the location.
   const guard=document.createElement('img');guard.className='site guard';
   const star=1+Math.floor((Math.abs(point.x*17+point.y*29))%12);
   guard.src=kingdomEncounterSprite({type:point.type,raceTag:point.raceTag,stars:star});
   guard.alt='';guard.style.left=(px+10/width)+'%';
   guard.style.top=(py+11/height)+'%';
   guard.style.width=(52/width)+'%';guard.style.height=(52/height)+'%';
   root.append(guard);
  }
 }
}
function simulate(){
 const c=controls(),stage=byId('stage');
 const rect=stage.getBoundingClientRect();
 // A consistent world-space tile size means zoom changes the visible area,
 // not the underlying seeds or relative sprite proportions.
 const width=Math.max(9,Math.min(25,Math.floor(rect.width/c.zoom)|1));
 const height=Math.max(7,Math.min(19,Math.floor(rect.height/c.zoom)|1));
 const center={x:Math.round(ATLAS_VIEW.centerX),y:Math.round(ATLAS_VIEW.centerY)};
 const cells={},points=[],types={},rawCandidates=[];
 const left=center.x-Math.floor(width/2),top=center.y-Math.floor(height/2);
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
  const x=left+col,y=top+row,key=x+','+y;
  if(x===0&&y===0){cells[key]={status:'completed',explored:true};continue;}
  const opts={spacing:c.spacing,densityMultiplier:c.densityMultiplier,
   biomeDensity:c.biomeDensity,typeWeights:c.typeWeights,raceWeights:c.raceWeights};
  const world=worldAt(c.seed,x,y,opts);
  if(encounterCandidate(c.seed,x,y,opts))rawCandidates.push(key);
  cells[key]={status:world.type?'revealed':'completed',explored:true,
   selectedEncounter:world.type?{type:world.type,raceTag:world.raceTag}:null};
  if(world.type){points.push({x,y,...world});types[world.type]=(types[world.type]||0)+1;}
 }
 let minDistance=Infinity;
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  minDistance=Math.min(minDistance,Math.max(Math.abs(points[i].x-points[j].x),
   Math.abs(points[i].y-points[j].y)));
 }
 const canvas=byId('terrain');
 renderParchment(canvas,{seed:c.seed,view:center,columns:width,rows:height,
  map:{cells},terrainLayout:c.terrain});
 overlayMarkers({seed:c.seed,points,width,height,
  showEvents:byId('events').checked,showGrid:byId('grid').checked,center});
 formatStats(points.length,width*height,minDistance,rawCandidates.length,types);
 byId('map-seed').textContent=c.seed;
 drawn={seed:c.seed,points,width,height,center};
}
function exportConfig(){
 const c=controls();
 const config={
  format:'rpchess.atlas-lab.kingdom-simulator.v2',generator:'RPChess Atlas Lab v7',
  visual:{...VISUAL,seed:c.seed,centerX:ATLAS_VIEW.centerX,centerY:ATLAS_VIEW.centerY,
    zoom:c.zoom,stampSpacing:c.terrain.stampSpacing,
    terrainJitter:c.terrain.jitter,terrainSeparation:c.terrain.separation},
  simulation:{densityMultiplier:c.densityMultiplier,encounterMinSpacing:c.spacing,
    density:c.biomeDensity,types:c.typeWeights,races:c.raceWeights},
  notes:'Preview parameters; apply to runtime only after manual approval.'
 };
 const blob=new Blob([JSON.stringify(config,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='RPChess_Atlas_Lab_v7_config.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function importConfig(obj){
 if(!obj||typeof obj!=='object'||!obj.simulation)throw Error('Неверный формат Atlas Lab');
 const sim=obj.simulation,visual=obj.visual||{};
 const set=(id,val,min,max)=>{
  if(Number.isFinite(Number(val)))byId(id).value=String(clamp(val,min,max));
 };
 if(typeof visual.seed==='string')byId('seed').value=visual.seed;
 set('density',sim.densityMultiplier,.2,2.5);
 set('spacing',sim.encounterMinSpacing??sim.eventMinDistance??0,0,2);
 set('zoom',visual.zoom,45,142);
 set('terrain-step',visual.stampSpacing,.85,3);
 set('jitter',visual.terrainJitter??TERRAIN_LAYOUT.jitter,0,1.5);
 set('separation',visual.terrainSeparation??TERRAIN_LAYOUT.separation,0,1.5);
 if(Array.isArray(sim.density)&&sim.density.length===6)
  densities=sim.density.map(v=>clamp(v,0,100));
 if(Array.isArray(sim.types)&&sim.types.length===6&&sim.types.every(a=>a.length===6))
  typeWeights=sim.types.map(a=>a.map(v=>clamp(v,0,999)));
 if(Array.isArray(sim.races)&&sim.races.length===6&&sim.races.every(a=>a.length===14))
  raceWeights=sim.races.map(a=>a.map(v=>clamp(v,0,999)));
 makeTables();updateReadouts();simulate();
}
function reset(){
 byId('seed').value=defaults.seed;
 for(const [field,value] of Object.entries({
  density:defaults.density,spacing:defaults.spacing,'terrain-step':defaults.stampSpacing,
  jitter:defaults.jitter,separation:defaults.separation,zoom:defaults.zoom
 }))byId(field).value=value;
 densities=[...DENSITY];typeWeights=matrixCopy(TYPE_WEIGHTS);
 raceWeights=matrixCopy(RACE_WEIGHTS);
 makeTables();updateReadouts();simulate();
}
byId('simulate').addEventListener('click',simulate);
byId('another').addEventListener('click',()=>{
 const bytes=new Uint32Array(2);crypto.getRandomValues(bytes);
 byId('seed').value='realm-'+(bytes[0]^bytes[1]).toString(36);
 simulate();
});
byId('export').addEventListener('click',exportConfig);
byId('reset').addEventListener('click',reset);
byId('import').addEventListener('click',()=>byId('file').click());
byId('file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{importConfig(JSON.parse(await file.text()));}
 catch(error){alert('Не удалось загрузить конфигурацию: '+error.message);}
 finally{e.target.value='';}
});
for(const id of ['density','terrain-step','jitter','separation','zoom'])
 byId(id).addEventListener('input',updateReadouts);
byId('seed').addEventListener('keydown',e=>{if(e.key==='Enter')simulate();});
for(const id of ['events','grid'])byId(id).addEventListener('change',()=>{
 if(drawn)overlayMarkers({...drawn,
  showEvents:byId('events').checked,showGrid:byId('grid').checked});
});
makeTables();updateReadouts();simulate();
