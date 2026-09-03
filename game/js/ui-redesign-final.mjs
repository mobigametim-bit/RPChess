import { readRun } from './run-persistence.mjs';
import { PIECE_GLYPHS } from './roster-data.mjs';
import { placeArmy } from './skirmish-core.mjs';

const CSS_HREF='css/ui-redesign-final.css?v=20260902-cleanup2';
const SIDE_COLORS_CSS_HREF='css/combat-side-colors.css?v=20260903-aura1';
const BLACK_GLYPHS=Object.freeze({pawn:'♟',knight:'♞',bishop:'♝',rook:'♜',queen:'♛',king:'♚'});
const GLYPHS_BY_COLOR=Object.freeze({w:PIECE_GLYPHS,b:BLACK_GLYPHS});
const TYPE_BY_GLYPH=Object.freeze(Object.fromEntries([...Object.entries(PIECE_GLYPHS),...Object.entries(BLACK_GLYPHS)].map(([type,glyph])=>[glyph,type])));
const OBSOLETE_HIDDEN_CONTROLS=Object.freeze([
  '[data-skirmish-back]',
  '[data-battle-back]',
  '[data-puzzle-roster]',
  '[data-settlement-roster]',
  '[data-settlement-settings]',
  '[data-events-roster]',
  '[data-events-settings]'
]);
const classicScreen=document.querySelector('[data-classic-screen]');
const movePanel=classicScreen?.querySelector('.classic-panel--moves')||null;
const movePanelHome=movePanel?.parentElement||null;
const movePanelNext=movePanel?.nextSibling||null;
const skirmishScreen=document.querySelector('[data-skirmish-screen]');
const skirmishActionbar=skirmishScreen?.querySelector('.skirmish-actionbar')||null;
const skirmishActionbarHome=skirmishActionbar?.parentElement||null;
const skirmishActionbarNext=skirmishActionbar?.nextSibling||null;
let battleStartHome=null,battleStartNext=null,queued=false;

function ensureStylesheet(href,datasetName){if(document.querySelector(`[${datasetName}]`))return;const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.setAttribute(datasetName,'');document.head.append(link);}
function ensureCss(){ensureStylesheet(CSS_HREF,'data-ui-redesign-final-css');ensureStylesheet(SIDE_COLORS_CSS_HREF,'data-combat-side-colors-css');}
function removeObsoleteHiddenControls(){for(const selector of OBSOLETE_HIDDEN_CONTROLS)for(const node of document.querySelectorAll(selector))node.remove();}
function visible(root){return Boolean(root&&!root.hidden);}
function desktop(){return matchMedia('(min-width: 901px)').matches;}
function normalizeColor(value){return value==='b'?'b':'w';}
function glyphsFor(color){return GLYPHS_BY_COLOR[normalizeColor(color)];}
function restore(node,home,next){if(!node||!home||node.parentElement===home)return;home.insertBefore(node,next?.parentNode===home?next:null);}
function activeCombatKind(){if(!visible(classicScreen))return null;if(globalThis.RPChessBattle?.battlePlan)return'battle';if(globalThis.RPChessSkirmish?.battlePlan)return'skirmish';return null;}
function syncCombatBoard(){const kind=activeCombatKind(),compact=Boolean(kind&&desktop());document.body.classList.toggle('run-combat-board-active',Boolean(kind));document.body.classList.toggle('compact-combat-active',compact);if(!compact){restore(movePanel,movePanelHome,movePanelNext);return;}const party=classicScreen?.querySelector('.classic-party-panel');if(party&&movePanel&&movePanel.parentElement!==party)party.append(movePanel);}
function syncPuzzle(){const puzzle=document.querySelector('[data-puzzle-screen]'),active=visible(puzzle);document.body.classList.toggle('compact-puzzle-active',active);const outcome=puzzle?.querySelector('[data-puzzle-outcome]');document.body.classList.toggle('puzzle-resolved-compact',Boolean(active&&outcome&&!outcome.hidden));}
function characterGlyph(card,run,color='w'){const id=card?.dataset.skirmishCharacter||card?.dataset.battleCharacter;const character=run?.roster?.find((entry)=>entry.id===id);return character?glyphsFor(color)[character.pieceType]||'':'';}
function ensureCardGlyphs(selector,className,color='w'){const run=readRun(),side=normalizeColor(color);for(const card of document.querySelectorAll(selector)){let mark=card.querySelector(`.${className}`);const glyph=characterGlyph(card,run,side);if(!glyph){mark?.remove();continue;}if(!mark){mark=document.createElement('span');mark.className=className;mark.setAttribute('aria-hidden','true');card.append(mark);}mark.dataset.pieceColor=side;if(mark.textContent!==glyph)mark.textContent=glyph;}}
function syncSkirmishFormation(){
  const root=skirmishScreen?.querySelector('[data-skirmish-formation]'),api=globalThis.RPChessSkirmish,encounter=api?.encounter,selectedIds=api?.selectedIds,run=readRun();
  if(!root||!encounter||!run||!Array.isArray(selectedIds))return;
  const color=normalizeColor(encounter.playerColor),selected=new Set(selectedIds),members=(run.roster||[]).filter((character)=>selected.has(character.id));
  let placements=[];try{placements=placeArmy(members,color,{seed:`${encounter.seed}:player`});}catch{return;}
  root.dataset.playerColor=color;root.dir=color==='b'?'rtl':'ltr';
  const bySquare=new Map(placements.map((piece)=>[piece.square,piece])),ranks=color==='w'?['2','1']:['7','8'],glyphs=glyphsFor(color),cells=[...root.querySelectorAll('.skirmish-formation-cell')];
  if(cells.length!==16)return;
  let index=0;for(const rank of ranks)for(const file of 'abcdefgh'){const cell=cells[index++],square=`${file}${rank}`,piece=bySquare.get(square);cell.textContent=piece?(glyphs[piece.pieceType]||''):'·';cell.title=piece?.name||square;if(piece?.pieceType){cell.dataset.previewPiece=piece.pieceType;cell.dataset.pieceColor=color;}else{delete cell.dataset.previewPiece;delete cell.dataset.pieceColor;}}
}
function syncBattleFormation(screen,color){const root=screen?.querySelector('[data-battle-formation]');if(!root)return;const side=normalizeColor(color),glyphs=glyphsFor(side);root.dataset.playerColor=side;for(const cell of root.querySelectorAll('.battle-formation-cell')){const mark=cell.querySelector('span');if(!mark)continue;const type=TYPE_BY_GLYPH[mark.textContent||''];if(!type){delete mark.dataset.pieceColor;continue;}mark.textContent=glyphs[type]||mark.textContent;mark.dataset.pieceColor=side;}}
function syncSkirmishPrep(){if(!skirmishScreen)return;const active=visible(skirmishScreen),api=globalThis.RPChessSkirmish,color=normalizeColor(api?.encounter?.playerColor);if(active){ensureCardGlyphs('[data-skirmish-screen] [data-skirmish-character]','skirmish-card__tech-glyph',color);const title=skirmishScreen.querySelector('[data-skirmish-title]'),stars=skirmishScreen.querySelector('[data-skirmish-stars]');if(title&&stars)title.dataset.compactStars=stars.textContent.trim();syncSkirmishFormation();}const selection=skirmishScreen.querySelector('.skirmish-selection');if(active&&desktop()&&selection&&skirmishActionbar&&skirmishActionbar.parentElement!==selection)selection.append(skirmishActionbar);else restore(skirmishActionbar,skirmishActionbarHome,skirmishActionbarNext);}
function syncBattleStart(screen,active){const start=screen?.querySelector('[data-battle-start]'),actionbar=screen?.querySelector('.battle-actionbar'),army=screen?.querySelector('.battle-army');if(!start||!actionbar)return;if(!battleStartHome){battleStartHome=actionbar;battleStartNext=start.nextSibling;}if(active&&army){const quote=army.querySelector('[data-battle-mercenary-quote]');if(start.parentElement!==army){if(quote)quote.insertAdjacentElement('afterend',start);else army.append(start);}else if(quote&&start.previousElementSibling!==quote)quote.insertAdjacentElement('afterend',start);actionbar.hidden=true;start.style.width='100%';return;}actionbar.hidden=false;start.style.width='';restore(start,battleStartHome,battleStartNext);}
function syncBattlePrep(){const screen=document.querySelector('[data-battle-screen]'),active=visible(screen),api=globalThis.RPChessBattle,color=normalizeColor(api?.encounter?.playerColor);document.body.classList.toggle('battle-prep-compact-active',active);if(active){ensureCardGlyphs('[data-battle-screen] [data-battle-character]','battle-card__tech-glyph',color);syncBattleFormation(screen,color);}syncBattleStart(screen,active);}
function syncAftermath(){const battle=document.querySelector('[data-battle-aftermath]'),skirmish=document.querySelector('[data-skirmish-aftermath]');document.body.classList.toggle('compact-aftermath-active',visible(battle)||visible(skirmish));}
function refresh(){queued=false;removeObsoleteHiddenControls();syncCombatBoard();syncPuzzle();syncSkirmishPrep();syncBattlePrep();syncAftermath();}
function schedule(){removeObsoleteHiddenControls();if(queued)return;queued=true;requestAnimationFrame(refresh);}

ensureCss();
removeObsoleteHiddenControls();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
for(const name of ['rpchess:skirmish-open','rpchess:battle-open','rpchess:puzzle-open','rpchess:settlement-open','rpchess:event-open','rpchess:travel-open','rpchess:run-continue','rpchess:run-updated'])addEventListener(name,()=>queueMicrotask(schedule));
addEventListener('resize',schedule,{passive:true});
document.addEventListener('click',(event)=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('[data-skirmish-character],[data-selected-character],[data-skirmish-start],[data-battle-character],[data-battle-participant],[data-battle-start],[data-puzzle-board],[data-puzzle-continue],[data-aftermath-continue],[data-battle-continue]'))queueMicrotask(schedule);},true);
