import { readRun } from './run-persistence.mjs';
import { PIECE_GLYPHS } from './roster-data.mjs';

const CSS_HREF='css/ui-redesign-final.css?v=20260902-cleanup1';
const classicScreen=document.querySelector('[data-classic-screen]');
const movePanel=classicScreen?.querySelector('.classic-panel--moves')||null;
const movePanelHome=movePanel?.parentElement||null;
const movePanelNext=movePanel?.nextSibling||null;
const skirmishScreen=document.querySelector('[data-skirmish-screen]');
const skirmishActionbar=skirmishScreen?.querySelector('.skirmish-actionbar')||null;
const skirmishActionbarHome=skirmishActionbar?.parentElement||null;
const skirmishActionbarNext=skirmishActionbar?.nextSibling||null;
let battleStartHome=null,battleStartNext=null,queued=false;

function ensureCss(){
  if(document.querySelector('[data-ui-redesign-final-css]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href=CSS_HREF;link.dataset.uiRedesignFinalCss='';document.head.append(link);
}
function visible(root){return Boolean(root&&!root.hidden);}
function desktop(){return matchMedia('(min-width: 901px)').matches;}
function restore(node,home,next){if(!node||!home||node.parentElement===home)return;home.insertBefore(node,next?.parentNode===home?next:null);}
function activeCombatKind(){
  if(!desktop()||!visible(classicScreen))return null;
  if(globalThis.RPChessBattle?.battlePlan)return'battle';
  if(globalThis.RPChessSkirmish?.battlePlan)return'skirmish';
  return null;
}
function syncCombatBoard(){
  const kind=activeCombatKind();
  document.body.classList.toggle('compact-combat-active',Boolean(kind));
  if(!kind){restore(movePanel,movePanelHome,movePanelNext);return;}
  const party=classicScreen?.querySelector('.classic-party-panel');
  if(party&&movePanel&&movePanel.parentElement!==party)party.append(movePanel);
}
function syncPuzzle(){
  const puzzle=document.querySelector('[data-puzzle-screen]'),active=visible(puzzle);
  document.body.classList.toggle('compact-puzzle-active',active);
  const outcome=puzzle?.querySelector('[data-puzzle-outcome]');
  document.body.classList.toggle('puzzle-resolved-compact',Boolean(active&&outcome&&!outcome.hidden));
}
function characterGlyph(card,run){
  const id=card?.dataset.skirmishCharacter||card?.dataset.battleCharacter;
  const character=run?.roster?.find((entry)=>entry.id===id);
  return character?PIECE_GLYPHS[character.pieceType]||'':'';
}
function ensureCardGlyphs(selector,className){
  const run=readRun();
  for(const card of document.querySelectorAll(selector)){
    let mark=card.querySelector(`.${className}`);
    const glyph=characterGlyph(card,run);
    if(!glyph){mark?.remove();continue;}
    if(!mark){mark=document.createElement('span');mark.className=className;mark.setAttribute('aria-hidden','true');card.append(mark);}
    if(mark.textContent!==glyph)mark.textContent=glyph;
  }
}
function syncSkirmishPrep(){
  if(!skirmishScreen)return;
  const active=visible(skirmishScreen);
  if(active){
    ensureCardGlyphs('[data-skirmish-screen] [data-skirmish-character]','skirmish-card__tech-glyph');
    const title=skirmishScreen.querySelector('[data-skirmish-title]'),stars=skirmishScreen.querySelector('[data-skirmish-stars]');
    if(title&&stars)title.dataset.compactStars=stars.textContent.trim();
  }
  const selection=skirmishScreen.querySelector('.skirmish-selection');
  if(active&&desktop()&&selection&&skirmishActionbar&&skirmishActionbar.parentElement!==selection)selection.append(skirmishActionbar);
  else restore(skirmishActionbar,skirmishActionbarHome,skirmishActionbarNext);
}
function syncBattleStart(screen,active){
  const start=screen?.querySelector('[data-battle-start]'),actionbar=screen?.querySelector('.battle-actionbar'),army=screen?.querySelector('.battle-army');
  if(!start||!actionbar)return;
  if(!battleStartHome){battleStartHome=actionbar;battleStartNext=start.nextSibling;}
  if(active&&desktop()&&army){const quote=army.querySelector('[data-battle-mercenary-quote]');if(start.parentElement!==army){if(quote)quote.insertAdjacentElement('afterend',start);else army.append(start);}else if(quote&&start.previousElementSibling!==quote)quote.insertAdjacentElement('afterend',start);return;}
  restore(start,battleStartHome,battleStartNext);
}
function syncBattlePrep(){
  const screen=document.querySelector('[data-battle-screen]'),active=visible(screen);
  document.body.classList.toggle('battle-prep-compact-active',active);
  if(active)ensureCardGlyphs('[data-battle-screen] [data-battle-character]','battle-card__tech-glyph');
  syncBattleStart(screen,active);
}
function syncAftermath(){
  const battle=document.querySelector('[data-battle-aftermath]'),skirmish=document.querySelector('[data-skirmish-aftermath]');
  document.body.classList.toggle('compact-aftermath-active',visible(battle)||visible(skirmish));
}
function refresh(){queued=false;syncCombatBoard();syncPuzzle();syncSkirmishPrep();syncBattlePrep();syncAftermath();}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(refresh);}

ensureCss();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
for(const name of ['rpchess:skirmish-open','rpchess:battle-open','rpchess:puzzle-open','rpchess:travel-open','rpchess:run-continue','rpchess:run-updated'])addEventListener(name,()=>queueMicrotask(schedule));
addEventListener('resize',schedule,{passive:true});
document.addEventListener('click',(event)=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('[data-skirmish-character],[data-selected-character],[data-skirmish-start],[data-battle-character],[data-battle-participant],[data-battle-start],[data-puzzle-board],[data-puzzle-continue],[data-aftermath-continue],[data-battle-continue]'))queueMicrotask(schedule);},true);
