import { currentLanguage } from './i18n.mjs';
import { FORMATION_SQUARES, normalizedFormation, moveFormation } from './roster-formation-core.mjs';

const WORDS={
 ru:{board:'Расстановка',hint:'Перетащите фигуру на клетку или в запас. На телефоне: выберите фигуру, затем клетку.',reserve:'В запасе',wounded:'Ранены',dead:'Убиты',empty:'Нет героев',points:'Очки',king:'Король обязан оставаться на поле',capacity:'Лимит: 16 фигур, 39 очков, не больше 8 пешек',slot:'Клетка',selected:'Выбрано',hero:'Герой'},
 en:{board:'Formation',hint:'Drag pieces to a square or reserves. On touchscreens, choose a piece and then a square.',reserve:'Reserves',wounded:'Wounded',dead:'Fallen',empty:'No heroes',points:'Points',king:'The king must stay on the board',capacity:'Limit: 16 pieces, 39 points and 8 pawns',slot:'Square',selected:'Selected',hero:'Hero'}
};
let armedId=null;
let pointerStart=null;
function copy(){return WORDS[currentLanguage()==='en'?'en':'ru'];}
function element(tag,className,text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=text;
  return el;
}
function label(c,run){return c.isRunKing?
  (run?.commanderId&&run?.roster?.find(x=>x.id===c.id)?.name||c.name):c.name;}
function createPiece(c,run,{board=false,selected=false}={}){
  const node=element(board?'span':'button',board?'rfc-piece rfc-piece--board':'rfc-piece rfc-piece--list');
  if(!board)node.type='button';
  node.dataset.rosterPiece=c.id;node.draggable=c.status==='healthy'||c.isRunKing;
  node.classList.toggle('is-selected',selected);
  node.title=label(c,run);
  node.setAttribute('aria-label',label(c,run));
  const img=element('img','rfc-piece__art');img.src=c.pieceArt;img.alt='';img.draggable=false;
  node.append(img);
  if(!board)node.append(element('span','rfc-piece__name',label(c,run)));
  return node;
}
function renderFormationUI(root,run,{onSelect,onCommit}={}){
  if(!root||!run)return;
  const w=copy(),state=normalizedFormation(run);
  if(armedId&&!run.roster.some(c=>c.id===armedId))armedId=null;
  root.replaceChildren();
  root.className='roster-formation-ui';
  const byId=new Map(run.roster.map(c=>[c.id,c]));
  const header=element('div','rfc-head');
  header.append(element('h3','rfc-title',w.board));
  const count=element('span','rfc-count',`${state.members.length}/16 · ${state.members.reduce((n,c)=>n+(c.commandCost||0),0)}/39 ${w.points.toLowerCase()}`);
  header.append(count);
  root.append(header);
  const board=element('div','rfc-board');
  board.dataset.rosterBoard='';
  board.setAttribute('role','group');board.setAttribute('aria-label',w.board);
  // White canonical formation is shown from the front rank to the home rank.
  for(const rank of ['2','1'])for(const file of 'abcdefgh'){
    const square=file+rank,id=state.squares[square],c=byId.get(id);
    const tile=element('button','rfc-square');
    tile.type='button';tile.dataset.rosterSlot=square;
    tile.classList.toggle('rfc-square--light',('abcdefgh'.indexOf(file)+Number(rank))%2===0);
    tile.classList.toggle('rfc-square--occupied',Boolean(c));
    tile.classList.toggle('rfc-square--selected',Boolean(c&&c.id===run.selectedCharacterId));
    tile.classList.toggle('rfc-square--armed',Boolean(c&&c.id===armedId));
    tile.setAttribute('aria-label',`${w.slot} ${square}: ${c?label(c,run):w.empty}`);
    tile.title=c?label(c,run):square;
    if(c)tile.append(createPiece(c,run,{board:true,selected:c.id===run.selectedCharacterId}));
    board.append(tile);
  }
  root.append(board);
  root.append(element('p','rfc-hint',w.hint));
  const feedback=element('div','rfc-feedback');
  feedback.setAttribute('role','status');feedback.dataset.rosterFormationFeedback='';
  root.append(feedback);
  const section=(key,items,acceptDrop=false)=>{
    const block=element('section',`rfc-section rfc-section--${key}`);
    block.dataset.rosterGroup=key;
    if(acceptDrop)block.dataset.rosterReserve='';
    const head=element('div','rfc-section__head');
    head.append(element('h3','rfc-section__title',w[key]),element('span','rfc-section__count',String(items.length)));
    block.append(head);
    const list=element('div','rfc-section__list');
    if(!items.length)list.append(element('span','rfc-section__empty',w.empty));
    else for(const c of items)list.append(createPiece(c,run,{selected:c.id===run.selectedCharacterId}));
    block.append(list);
    return block;
  };
  root.append(section('reserve',state.bench,true),section('wounded',state.wounded),section('dead',state.dead));
  const commit=(id,square)=>{
    const outcome=moveFormation(run,id,square);
    if(!outcome.ok){
      feedback.textContent=outcome.reason==='king_required'?w.king:w.capacity;
      return;
    }
    armedId=null;
    if(outcome.run!==run)onCommit?.(outcome.run);
    else renderFormationUI(root,run,{onSelect,onCommit});
  };
  const show=(id)=>{
    if(!byId.has(id))return;
    armedId=id;
    onSelect?.(id);
  };
  const dropTarget=(node)=>{
    const slot=node?.closest?.('[data-roster-slot]');
    if(slot&&root.contains(slot))return {found:true,square:slot.dataset.rosterSlot};
    const reserve=node?.closest?.('[data-roster-reserve]');
    if(reserve&&root.contains(reserve))return {found:true,square:null};
    return {found:false};
  };
  root.onclick=(event)=>{
    const tile=event.target.closest?.('[data-roster-slot]');
    const card=event.target.closest?.('[data-roster-piece]');
    const target=dropTarget(event.target);
    if(card&&root.contains(card)){
      const id=card.dataset.rosterPiece;
      if(armedId&&armedId!==id&&tile){
        commit(armedId,tile.dataset.rosterSlot);
        return;
      }
      show(id);return;
    }
    if(target.found&&armedId)commit(armedId,target.square);
  };
  root.ondragstart=(event)=>{
    const piece=event.target.closest?.('[data-roster-piece]');
    if(!piece||!root.contains(piece)||!piece.draggable){event.preventDefault();return;}
    event.dataTransfer?.setData('text/plain',piece.dataset.rosterPiece);
    if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
    armedId=piece.dataset.rosterPiece;
  };
  root.ondragover=(event)=>{
    if(dropTarget(event.target).found){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}
  };
  root.ondrop=(event)=>{
    const target=dropTarget(event.target);
    if(!target.found)return;
    event.preventDefault();
    const id=event.dataTransfer?.getData('text/plain')||armedId;
    if(byId.has(id))commit(id,target.square);
  };
  root.onpointerdown=(event)=>{
    const piece=event.target.closest?.('[data-roster-piece]');
    if(event.pointerType!=='touch'||!piece||!piece.draggable)return;
    pointerStart={id:piece.dataset.rosterPiece,x:event.clientX,y:event.clientY,pointerId:event.pointerId};
  };
  root.onpointerup=(event)=>{
    if(!pointerStart||pointerStart.pointerId!==event.pointerId)return;
    const origin=pointerStart;pointerStart=null;
    if(Math.hypot(event.clientX-origin.x,event.clientY-origin.y)<16)return;
    const target=dropTarget(document.elementFromPoint(event.clientX,event.clientY));
    if(target.found){event.preventDefault();commit(origin.id,target.square);}
  };
  root.onpointercancel=()=>{pointerStart=null;};
}
export {renderFormationUI};
