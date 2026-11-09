/* Third Atlas Lab v6 tab. Sandbox edits NEVER mutate the active RPChess run. */
import {DEFAULT_KINGDOM_ECONOMY,ECONOMY_GROUPS,ECONOMY_LABELS,PIECE_TYPES,
  economyClone,normalizeKingdomEconomy} from './kingdom-economy-config.mjs';

const storageKey='rpchess.atlas-lab.economy.draft.v1';
const $=id=>document.getElementById(id);
const shell=document.querySelector('.shell'),nav=document.querySelector('.lab-tabs');
if(!shell||!nav)throw Error('Atlas Lab v6 shell is required');
const b=document.createElement('button');b.type='button';b.id='labEconomyTab';
b.textContent='◈ Экономика';b.setAttribute('aria-pressed','false');nav.append(b);
const sheet=document.createElement('style');
sheet.textContent=`
.shell.economy-active .side,.shell.economy-active .stage,
.shell.economy-active .sim-side,.shell.economy-active .sim-stage{display:none!important}
.shell .km-economy-panel{display:none}
.shell.economy-active .km-economy-panel{display:block;grid-column:1/-1;grid-row:2;min-height:0;overflow:auto;background:#111a17;padding:20px clamp(12px,3vw,50px) 40px;scrollbar-color:#756446 #18221c}
.km-econ-layout{max-width:1350px;margin:auto}
.km-econ-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:22px}
.km-econ-toolbar h2{font-size:22px;color:#f2dda6;margin:0 auto 0 0}
.km-econ-toolbar button{padding:9px 14px;border:1px solid #806b44;border-radius:7px;background:#352e23;color:#f2dda6}
.km-econ-help{font-size:12px;color:#b2bcae;line-height:1.65;max-width:960px}
.km-econ-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:15px;margin-top:22px;align-items:start}
.km-econ-group{background:#1b2821;border:1px solid #4c5649;border-radius:11px;padding:16px}
.km-econ-group h3{font-size:15px;color:#e6c98b;margin:0 0 13px}
.km-econ-field{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:7px 0;border-top:1px solid #38463b}
.km-econ-field label{font-size:12px;color:#dce2d4;line-height:1.3;max-width:72%}
.km-econ-field input{min-width:70px;width:100px;padding:6px 8px;color:#f9e9c1;background:#101b16;border:1px solid #5c6a55;border-radius:6px;text-align:right;font-variant-numeric:tabular-nums}
.km-econ-invalid{color:#f1a781!important}
.km-econ-foot{font-size:11px;color:#abb8a5;margin-top:10px}
.km-econ-status{font-size:12px;min-width:200px;color:#d9c38c}
@media(max-width:740px){.km-econ-toolbar h2{width:100%}.shell.economy-active .km-economy-panel{grid-row:2;min-height:500px}}
`;
document.head.append(sheet);
const panel=document.createElement('section');panel.id='labEconomyPanel';panel.className='km-economy-panel';
panel.setAttribute('aria-label','Экономика Королевства');shell.append(panel);
const area=document.createElement('div');area.className='km-econ-layout';panel.append(area);
area.innerHTML=`<div class="km-econ-toolbar"><h2>Экономика Королевства</h2>
<button id="kmEconomyExport">↓ Экспорт JSON</button><button id="kmEconomyImport">↑ Импорт JSON</button>
<button id="kmEconomyReset">↺ Сброс экономики</button><input id="kmEconomyFile" type="file" accept=".json,application/json" hidden>
<span id="kmEconomyStatus" class="km-econ-status" role="status"></span></div>
<p class="km-econ-help">Здесь можно изменить любую цену и награду, не затрагивая сохранённую игру. Экспорт сохраняет конфигурацию для утверждения и переноса в сборку. Цены именных героев редактируются поимённо; рекруты различаются по расе и типу. Строительство поселения вне владений должно быть дороже по обеим валютам.</p>
<div id="kmEconomyGroups" class="km-econ-groups"></div>`;
let draft=economyClone();
try{const raw=localStorage.getItem(storageKey);if(raw)draft=normalizeKingdomEconomy(JSON.parse(raw))}catch{}
const status=msg=>{$('kmEconomyStatus').textContent=msg};
function store(){try{localStorage.setItem(storageKey,JSON.stringify(draft))}catch{}}
const label=(key)=>ECONOMY_LABELS[key]||key.replace(/([A-Z])/g,' $1');
function fields(node,path=[]){
 return Object.entries(node).flatMap(([key,value])=>{
  const next=[...path,key];
  return value&&typeof value==='object'&&!Array.isArray(value)?fields(value,next):
    typeof value==='number'?[{path:next,label:label(key),value}]:[];
 });
}
function pickGroup([,root,...keys]){
 const node=draft[root];
 if(!keys.length)return node;
 if(keys.length===1&&keys[0]==='namedHeroPrices')return node.namedHeroPrices;
 return Object.fromEntries(keys.map(key=>[key,node[key]]).filter(([,value])=>value!==undefined));
}
function makeField(field,section){
 const row=document.createElement('div');row.className='km-econ-field';
 const name=document.createElement('label'),input=document.createElement('input');input.type='number';input.min='0';input.max='1000000';input.step='1';
 const id='econ_'+field.path.join('_').replace(/[^a-zA-Z0-9_]/g,'_');input.id=id;input.value=field.value;
 name.htmlFor=id;name.textContent=field.label;row.append(name,input);
 input.onchange=()=>{
  const value=Number(input.value);if(!Number.isSafeInteger(value)||value<0||value>1000000){input.classList.add('km-econ-invalid');status('Число должно быть целым и неотрицательным');return}
  const copy=economyClone(draft);
  let target=copy;for(const part of field.path.slice(0,-1))target=target[part];
  target[field.path.at(-1)]=value;
  if((field.path.join('.')==='building.settlementForeignGold'&&value<=copy.building.settlementOwnedGold)
  ||(field.path.join('.')==='building.settlementForeignShards'&&value<=copy.building.settlementOwnedShards)){
   input.classList.add('km-econ-invalid');status('За границей цена должна быть строго больше');return;
  }
  draft=normalizeKingdomEconomy(copy);store();render();status('Изменения сохранены только в Atlas Lab');
 };
 section.append(row);
}
function render(){
 const root=$('kmEconomyGroups');root.replaceChildren();
 for(const group of ECONOMY_GROUPS){
  const block=document.createElement('section');block.className='km-econ-group';
  const h=document.createElement('h3');h.textContent=group[0];block.append(h);
  const source=pickGroup(group);
  const pathPrefix=group[1]==='settlementServices'&&group[2]==='namedHeroPrices'?['settlementServices','namedHeroPrices']:[group[1]];
  for(const field of fields(source,pathPrefix))makeField(field,block);
  if(group[1]==='recruits'){
    const tip=document.createElement('p');tip.className='km-econ-foot';
    tip.textContent='Уровни I–V: относительные веса пешки, коня, слона, ладьи, ферзя. Допускается не сумма 100: веса нормализуются при выдаче рекрута.';block.append(tip);
  }
  root.append(block);
 }
}
function getConfig(){return economyClone(draft)}
function setConfig(input){draft=normalizeKingdomEconomy(input?.economy||input);store();render();status('Экономика импортирована в редактор')}
function exportConfig(){return {format:'rpchess.kingdom.economy.v1',savedAt:new Date().toISOString(),economy:getConfig(),note:'Экспорт из Atlas Lab: требуется утверждение и перенос разработчиком; текущий забег не затронут'};}
function download(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}
$('kmEconomyExport').onclick=()=>download(exportConfig(),'RPChess_Kingdom_Economy_Config.json');
$('kmEconomyImport').onclick=()=>$('kmEconomyFile').click();
$('kmEconomyFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{
 const input=JSON.parse(await file.text());if(!input.economy||input.economy.schemaVersion!==1)throw Error('Ожидается JSON с economy.schemaVersion=1');
 setConfig(input.economy);
}catch(ex){status('Ошибка импорта: '+ex.message)}finally{e.target.value=''}};
$('kmEconomyReset').onclick=()=>{draft=economyClone();store();render();status('Вернулись к базовым ценам')};
const visual=$('labVisualTab'),sim=$('labSimTab');
const deactivate=()=>{shell.classList.remove('economy-active');b.classList.remove('is-active');b.setAttribute('aria-pressed','false')};
visual.addEventListener('click',deactivate);sim.addEventListener('click',deactivate);
b.onclick=()=>{visual.click();shell.classList.add('economy-active');for(const tab of [visual,sim]){tab.classList.remove('is-active');tab.setAttribute('aria-pressed','false')}
 b.classList.add('is-active');b.setAttribute('aria-pressed','true');};
globalThis.RPChessAtlasEconomy={getConfig,setConfig,exportConfig,show:()=>b.click()};
render();
