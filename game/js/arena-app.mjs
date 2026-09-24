import { ChessAIAdapter } from './chess-ai-adapter.mjs';
import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { RACE_TAGS, RACE_LABELS, racePiecePath, applyRaceBoardTheme } from './race-assets.mjs';
import { ARTIFACTS, artifactById } from './artifact-core.mjs';
import { renderThreatOverlay } from './artifact-combat-ui.mjs';
import { applyPinIce } from './king-pin-ice.mjs';
import { currentLanguage, subscribe } from './i18n.mjs';
import { platform } from './platform.mjs';
import { ARENA_KEY, SHARD_ICON, PIECE_CODE, OPPONENTS, OPPONENT_BY_ID, SQUAD_PRICES, ARTIFACT_PRICES, emptyArena, normalizeArena, arenaSummary, newMatch, chooseArtifact, finishMatch, claimDouble, purchaseSquad } from './arena-core.mjs';

const copy = {
  ru:{title:'Арена',back:'Главное меню',shards:'Осколки чести',squads:'Ваш отряд',enemies:'Соперники',section:'Раздел',power:'Мощь',wins:'Побед',losses:'Поражений',draws:'Ничьих',fight:'В бой!',locked:'Победите предыдущего соперника',buy:'Купить',select:'Выбрать',owned:'Выбран',resume:'Продолжить бой',offer:'Подготовка к бою',offerText:'Выберите один артефакт на эту партию',none:'Без артефакта',insufficient:'Недостаточно осколков чести',victory:'Победа!',defeat:'Поражение',draw:'Ничья',continue:'Продолжить',again:'Сыграть ещё',rivals:'К соперникам',double:'Реклама: награда ×2',adError:'Реклама не завершена. Основная награда сохранена.',move:'Ваш ход',thinking:'Противник думает…',promotion:'Превращение пешки',result:'Партия завершена',drawText:'Следующий противник открывается за победу.',defeatText:'Можно попробовать снова.',opponent:'Соперник',squad:'Отряд'},
  en:{title:'Arena',back:'Main menu',shards:'Honor shards',squads:'Your squad',enemies:'Opponents',section:'Section',power:'Power',wins:'Wins',losses:'Losses',draws:'Draws',fight:'Fight!',locked:'Defeat the previous opponent',buy:'Buy',select:'Select',owned:'Selected',resume:'Resume match',offer:'Prepare for battle',offerText:'Choose one artifact for this match',none:'No artifact',insufficient:'Not enough honor shards',victory:'Victory!',defeat:'Defeat',draw:'Draw',continue:'Continue',again:'Play again',rivals:'Opponents',double:'Watch ad: reward ×2',adError:'Ad was not completed. Your base reward is safe.',move:'Your move',thinking:'Opponent is thinking…',promotion:'Promote pawn',result:'Match complete',drawText:'Win to unlock the next opponent.',defeatText:'You can try again.',opponent:'Opponent',squad:'Squad'}
};
const types = {ru:{pawn:'Пешка',knight:'Конь',bishop:'Слон',rook:'Ладья',queen:'Ферзь',king:'Король'},en:{pawn:'Pawn',knight:'Knight',bishop:'Bishop',rook:'Rook',queen:'Queen',king:'King'}};
const raceEn = ['Humans','Elves','Orcs','Undead','Dark elves','Dwarves','Demons','Angels','Dragonborn','Beastfolk','Constructs','Animals','Fae','Goblins'];
const glyphs = {w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}};
const root = document.querySelector('[data-arena-screen]');
const menu = document.querySelector('[data-reboot-foundation]');
const board = root?.querySelector('[data-arena-board]');
const dialog = document.querySelector('[data-arena-dialog]');
const adapter = new ChessAIAdapter();
let state=emptyArena(),engine=null,section=0,selected=null,thinking=false,searchId=0,adBusy=false,dialogType=null,promotion=null,notice='';
function l(key){return (copy[currentLanguage()]||copy.ru)[key]||key;}
function raceLabel(race){return currentLanguage()==='en'?raceEn[RACE_TAGS.indexOf(race)]||race:(RACE_LABELS[race]||race);}
function foeLabel(foe){return (types[currentLanguage()]||types.ru)[foe.type]+' · '+raceLabel(foe.race);}
function read(){try{return normalizeArena(JSON.parse(platform.storage.local?.getItem(ARENA_KEY)||'null'));}catch{return emptyArena();}}
function save(next){state=normalizeArena(next);platform.storage.local?.setItem(ARENA_KEY,JSON.stringify(state));globalThis.dispatchEvent(new CustomEvent('rpchess:arena-updated'));render();}
function id(){return globalThis.crypto?.randomUUID?.()||'arena:'+Date.now()+':'+Math.random().toString(36).slice(2);}
function escape(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function img(src,cls,alt=''){return '<img class="'+cls+'" src="'+src+'" alt="'+escape(alt)+'">';}
function button(action,label,extra=''){return '<button type="button" data-arena-action="'+action+'" '+extra+'>'+label+'</button>';}
function visible(open){
  root.hidden=!open;menu.hidden=open;document.body.classList.toggle('arena-active',open);
  if(!open)document.body.classList.remove('arena-battle-active');
  if(open)window.scrollTo(0,0);
}
function renderCatalog(){
  const stats=arenaSummary(state),h=root.querySelector('[data-arena-catalog]');
  root.setAttribute('aria-label',l('title'));
  root.querySelector('[data-arena-title]').textContent=l('title');
  root.querySelector('[data-arena-back]').textContent=l('back');
  h.hidden=Boolean(state.match&&state.match.phase==='playing' && engine);
  root.querySelector('[data-arena-shards]').innerHTML=img(SHARD_ICON,'arena-shard','')+' '+stats.balance+' · '+l('shards');
  const squads=root.querySelector('[data-arena-squads]');squads.replaceChildren();
  for(const race of RACE_TAGS){
    const owned=stats.owned.has(race),tile=document.createElement('button');
    const affordable=owned||stats.balance>=SQUAD_PRICES[race];
    tile.type='button';tile.className='arena-squad'+(state.squad===race?' is-selected':'')+(affordable?'':' is-unaffordable');
    tile.dataset.arenaSquad=race;tile.setAttribute('aria-pressed',String(state.squad===race));tile.disabled=!affordable;
    tile.setAttribute('aria-label',raceLabel(race)+' · '+(owned?(state.squad===race?l('owned'):l('select')):l('buy')+' · '+SQUAD_PRICES[race]));
    tile.innerHTML=img(racePiecePath(race,'king','w'),'arena-squad-art','')+(owned?'':'<span class="arena-squad-price">'+img(SHARD_ICON,'arena-inline-shard','')+' '+SQUAD_PRICES[race]+'</span>');
    squads.append(tile);
  }
  root.querySelector('[data-arena-squad-label]').textContent=l('squads');
  root.querySelector('[data-arena-enemy-label]').textContent=l('enemies');
  root.querySelector('[data-arena-section]').textContent=l('section')+' '+(section+1)+' / 12';
  root.querySelector('[data-arena-prev]').setAttribute('aria-label',currentLanguage()==='en'?'Previous':'Назад');
  root.querySelector('[data-arena-next]').setAttribute('aria-label',currentLanguage()==='en'?'Next':'Вперёд');
  root.querySelector('[data-arena-prev]').disabled=section===0;
  root.querySelector('[data-arena-next]').disabled=section===11;
  const foes=root.querySelector('[data-arena-foes]');foes.replaceChildren();
  for(const foe of OPPONENTS.slice(section*7,section*7+7)){
    const unlocked=foe.index<=stats.highest,card=document.createElement('button');
    card.type='button';card.className='arena-foe'+(unlocked?'':' is-locked');card.dataset.arenaFoe=foe.id;
    card.disabled=!unlocked;card.setAttribute('aria-label',foeLabel(foe)+' '+foe.elo+' Elo');
    card.innerHTML=img(foe.art,'arena-foe-art','')+'<strong>'+escape(foeLabel(foe))+'</strong><small>≈'+foe.elo+' Elo</small>'+(unlocked?'':'<span class="arena-lock" aria-hidden="true">🔒</span>');
    foes.append(card);
  }
  const resume=root.querySelector('[data-arena-resume]');
  resume.hidden=!state.match;resume.textContent=l('resume')+' · '+(state.match?foeLabel(OPPONENT_BY_ID.get(state.match.foe)):'');
  root.querySelector('[data-arena-notice]').textContent=notice;
}
function renderBoard(){
  const area=root.querySelector('[data-arena-battle]');
  area.hidden=!engine || !state.match || state.match.phase!=='playing';
  document.body.classList.toggle('arena-battle-active',!area.hidden);
  if(area.hidden)return;
  const foe=OPPONENT_BY_ID.get(state.match.foe),snapshot=engine.snapshot(),legal=selected?engine.legalMoves(selected):[];
  root.querySelector('[data-arena-battle-title]').textContent=foeLabel(foe)+' · ≈'+foe.elo+' Elo';
  root.querySelector('[data-arena-status]').textContent=thinking?l('thinking'):(snapshot.status.over?l('result'):l('move'));
  root.querySelector('[data-arena-rivals]').textContent=l('rivals');
  board.replaceChildren();
  applyRaceBoardTheme(board,foe.race);
  for(let rank=7;rank>=0;rank--)for(let file=0;file<8;file++){
    const index=rank*8+file,square='abcdefgh'[file]+(rank+1),piece=snapshot.board[index];
    const cell=document.createElement('button');cell.type='button';cell.className='classic-square classic-square--'+((rank+file)%2?'light':'dark');
    cell.dataset.square=square;cell.setAttribute('role','gridcell');cell.setAttribute('aria-label',square+(piece?' '+piece.type:''));
    if(selected===square)cell.classList.add('classic-square--selected');
    if(legal.some(move=>(move.uciTo||move.to)===square))cell.classList.add('classic-square--legal');
    if(snapshot.lastMove && [snapshot.lastMove.from,snapshot.lastMove.to].includes(square))cell.classList.add('classic-square--last');
    if(piece){
      const race=piece.color==='w'?state.match.squad:foe.race;
      cell.innerHTML=img(racePiecePath(race,({p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'})[piece.type],piece.color),'classic-piece','')+'<span class="classic-piece-marker classic-piece-marker--'+piece.color+'" data-piece-marker="'+piece.type+'" aria-hidden="true">'+glyphs[piece.color][piece.type]+'</span>';
    }
    cell.disabled=thinking||snapshot.status.over;
    board.append(cell);
  }
  renderThreatOverlay(board,snapshot,artifactById(state.match.artifactId),'w');
  applyPinIce(board,snapshot);
}
function openDialog(kind,html){dialogType=kind;dialog.innerHTML='<section class="arena-dialog-panel'+(kind==='foe'?' arena-dialog-panel--foe':'')+'" role="dialog" aria-modal="true" aria-label="'+escape(kind==='foe'?foeLabel(OPPONENT_BY_ID.get(dialog.dataset.foe)):l('title'))+'">'+html+'</section>';dialog.hidden=false;dialog.querySelector('button')?.focus();}
function closeDialog(){dialog.hidden=true;dialog.replaceChildren();dialogType=null;}
function renderDialog(){
  if(dialogType==='foe'){
    const foe=OPPONENT_BY_ID.get(dialog.dataset.foe);if(!foe)return closeDialog();
    const stats=arenaSummary(state).stats[foe.id];
    openDialog('foe','<header>'+button('close','×','class="arena-close" aria-label="'+(currentLanguage()==='en'?'Close':'Закрыть')+'"')+'</header><div class="arena-foe-profile"><div class="arena-foe-profile-art">'+img(foe.art,'arena-dialog-foe','')+'<p>'+l('power')+': ≈'+foe.elo+' Elo</p></div><dl class="arena-foe-profile-stats"><div><dt>'+l('wins')+'</dt><dd>'+stats.wins+'</dd></div><div><dt>'+l('losses')+'</dt><dd>'+stats.losses+'</dd></div><div><dt>'+l('draws')+'</dt><dd>'+stats.draws+'</dd></div></dl></div>'+button('fight',l('fight')));
  }else if(dialogType==='offer'&&state.match){
    const cards=ARTIFACTS.map(a=>button('artifact',img(a.icon,'arena-artifact','')+'<strong>'+escape(currentLanguage()==='en'?a.id==='threat.great'?'Greater awareness':a.id==='threat.attack'?'Attack awareness':'Defense awareness':a.name)+'</strong><small>'+escape(currentLanguage()==='en'?a.id==='threat.great'?'Shows threats to both armies':a.id==='threat.attack'?'Shows threats to enemy pieces':'Shows threats to your pieces':a.description)+'</small><span>'+img(SHARD_ICON,'arena-inline-shard','')+' '+ARTIFACT_PRICES[a.id]+'</span>','data-artifact="'+a.id+'" '+(arenaSummary(state).balance<ARTIFACT_PRICES[a.id]?'disabled':''))).join('');
    openDialog('offer','<h2>'+l('offer')+'</h2><p>'+l('offerText')+'</p><div class="arena-offers">'+cards+button('artifact',l('none'),'data-artifact="none"')+'</div>');
  }else if(dialogType==='result'&&state.match){
    const match=state.match,win=match.outcome==='win',loss=match.outcome==='loss',claimed=arenaSummary(state).accepted.has(match.id+':ad');
    const icon=win?img(SHARD_ICON,'arena-result-icon',''):loss?img('assets/arena/defeat_crown.png','arena-result-icon',''):'<span class="arena-result-icon">½</span>';
    const ad=win && platform.storage.cloud.available && !claimed?button('double',l('double'),' '+(adBusy?'disabled':'')):'';
    const message=win?('+'+match.reward+(claimed?' ×2':'')+' '+l('shards')):loss?l('defeatText'):l('drawText');
    openDialog('result','<h2>'+l(win?'victory':loss?'defeat':'draw')+'</h2>'+icon+'<p>'+message+'</p><p class="arena-notice" role="status">'+escape(notice)+'</p><div class="arena-result-actions">'+ad+button('continue',l('continue'),adBusy?'disabled':'')+(loss?button('again',l('again')):'')+'</div>');
  }else if(dialogType==='promotion'){
    openDialog('promotion','<h2>'+l('promotion')+'</h2><div class="arena-promotions">'+['q','r','b','n'].map(type=>button('promote',glyphs.w[type],'data-promotion="'+type+'"')).join('')+'</div>');
  }
}
function render(){if(!root||root.hidden)return;renderCatalog();renderBoard();if(dialogType)renderDialog();}
function restoreMatch(){
  if(!state.match||state.match.phase!=='playing')return;
  const next=new ClassicChessEngine();
  for(const uci of state.match.moves){
    if(!next.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null).ok){
      notice='Cannot restore the saved match';save({...state,match:null,updatedAt:Date.now()});return;
    }
  }
  engine=next;selected=null;thinking=false;
  if(next.status().over)settle(next.status());
  else {render();void aiTurn();}
}
function settle(status){
  if(!status.over||state.match?.phase!=='playing')return;
  const outcome=status.type==='checkmate'?(status.winner==='w'?'win':'loss'):'draw';
  engine=null;selected=null;adapter.stop();searchId++;notice='';
  save(finishMatch(state,outcome));dialogType='result';render();
}
function startBattle(){
  if(state.match?.phase!=='playing')return;
  closeDialog();engine=new ClassicChessEngine();selected=null;render();
}
function commit(from,to,promo=null){
  if(!engine||thinking||state.match?.phase!=='playing')return;
  const result=engine.move(from,to,promo);
  if(!result.ok){
    if(result.reason==='promotion_required'){promotion={from,to};dialogType='promotion';renderDialog();}
    return;
  }
  selected=null;promotion=null;closeDialog();
  const moves=[...state.match.moves,from+to+(promo||'')];
  save({...state,match:{...state.match,moves},updatedAt:Date.now()});
  if(result.status.over)settle(result.status);
  else void aiTurn();
}
async function aiTurn(){
  if(!engine||engine.turn()!=='b'||state.match?.phase!=='playing')return;
  const stamp=++searchId,foe=OPPONENT_BY_ID.get(state.match.foe);thinking=true;render();
  const uci=await adapter.chooseMove({fen:engine.fen(),elo:foe.elo,legalMoves:engine.legalMoves(),arena:true});
  if(stamp!==searchId||!engine||state.match?.phase!=='playing')return;
  thinking=false;
  if(!uci){notice='Engine is unavailable';render();return;}
  commit(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
}
function enter(){state=read();engine=null;selected=null;section=Math.floor((OPPONENT_BY_ID.get(state.match?.foe)?.index??arenaSummary(state).highest)/7);notice='';visible(true);if(state.match?.phase==='result')dialogType='result';else if(state.match?.phase==='offer')dialogType='offer';else restoreMatch();render();}
function leave(){adapter.stop();searchId++;thinking=false;engine=null;closeDialog();visible(false);}
root?.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target||target.disabled)return;
  if(target.dataset.arenaBack!==undefined){leave();return;}
  if(target.dataset.arenaPrev!==undefined){section=Math.max(0,section-1);render();return;}
  if(target.dataset.arenaNext!==undefined){section=Math.min(11,section+1);render();return;}
  if(target.dataset.arenaResume!==undefined){if(state.match?.phase==='offer')dialogType='offer';else if(state.match?.phase==='result')dialogType='result';else restoreMatch();render();return;}
  if(target.dataset.arenaRivals!==undefined){adapter.stop();searchId++;thinking=false;engine=null;render();return;}
  if(target.dataset.arenaSquad){
    const race=target.dataset.arenaSquad,summary=arenaSummary(state);
    if(!summary.owned.has(race)){
      if(summary.balance<SQUAD_PRICES[race]){notice=l('insufficient');render();return;}
      save(purchaseSquad(state,race,id()));
    }
    save({...state,squad:race,updatedAt:Date.now()});return;
  }
  if(target.dataset.arenaFoe){
    dialog.dataset.foe=target.dataset.arenaFoe;dialogType='foe';renderDialog();return;
  }
  if(target.dataset.square){
    if(!engine||thinking||engine.turn()!=='w')return;
    const square=target.dataset.square,piece=engine.pieceAt(square);
    if(!selected){if(piece?.color==='w'){selected=square;renderBoard();}return;}
    if(selected===square){selected=null;renderBoard();return;}
    if(piece?.color==='w'&&!engine.legalMoves(selected).some(m=>m.uciTo===square)){selected=square;renderBoard();return;}
    commit(selected,square);return;
  }
});
dialog?.addEventListener('click',async event=>{
  const target=event.target.closest('[data-arena-action]');if(!target||target.disabled)return;
  const action=target.dataset.arenaAction;
  if(action==='close'){closeDialog();return;}
  if(action==='fight'){
    const next=newMatch(state,dialog.dataset.foe,id());if(next===state)return;
    save(next);dialogType='offer';renderDialog();
  }else if(action==='artifact'){
    const artifactId=target.dataset.artifact==='none'?null:target.dataset.artifact,next=chooseArtifact(state,artifactId);
    if(next===state){notice=l('insufficient');render();return;}
    save(next);startBattle();
  }else if(action==='promote'&&promotion){commit(promotion.from,promotion.to,target.dataset.promotion);}
  else if(action==='continue'){
    if(state.match?.outcome==='win')section=Math.floor(Math.min(83,OPPONENT_BY_ID.get(state.match.foe).index+1)/7);
    closeDialog();save({...state,match:null,updatedAt:Date.now()});engine=null;render();
  }
  else if(action==='again'){
    const foe=state.match.foe;
    save({...state,match:null,updatedAt:Date.now()});
    save(newMatch(state,foe,id()));dialogType='offer';render();
  }else if(action==='double'){
    if(adBusy||!state.match||arenaSummary(state).accepted.has(state.match.id+':ad'))return;
    const matchId=state.match.id;
    adBusy=true;renderDialog();
    try{
      const result=await platform.ads.show('reward');
      if(result.status==='completed'&&state.match?.id===matchId&&state.match.phase==='result')save(claimDouble(state));
      else notice=l('adError');
    }catch{notice=l('adError');}
    finally{adBusy=false;render();}
  }
});
const entryButton=document.querySelector('[data-arena-open]');
entryButton?.addEventListener('click',()=>{void Promise.resolve(globalThis.RPChessCloudReady).then(enter);});
function updateLanguage(){if(entryButton)entryButton.textContent=l('title');render();}
subscribe(updateLanguage);
updateLanguage();
addEventListener('beforeunload',()=>adapter.destroy(),{once:true});
globalThis.RPChessArena={enter,get state(){return state;},get engine(){return engine;}};
