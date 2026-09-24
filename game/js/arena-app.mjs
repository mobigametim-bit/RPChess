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
  ru:{title:'Арена',back:'Главное меню',shards:'Осколки чести',squads:'Ваш отряд',enemies:'Соперники',section:'Раздел',power:'Мощь',wins:'Побед',losses:'Поражений',draws:'Ничьих',fight:'В бой!',locked:'Победите предыдущего соперника',buy:'Купить',select:'Выбрать',owned:'Выбран',resume:'Продолжить бой',offer:'Выберите артефакт',offerKicker:'ПЕРЕД СРАЖЕНИЕМ',offerText:'Выберите один артефакт на эту партию',none:'Без артефакта',insufficient:'Недостаточно осколков чести',victory:'Победа!',defeat:'Поражение',draw:'Ничья',continue:'Продолжить',again:'Сыграть ещё',rivals:'К соперникам',double:'Реклама: награда ×2',adError:'Реклама не завершена. Основная награда сохранена.',move:'Ваш ход',thinking:'Противник думает…',promotion:'Превращение пешки',result:'Партия завершена',drawText:'Следующий противник открывается за победу.',defeatText:'Можно попробовать снова.',opponent:'Соперник',squad:'Отряд',party:'Битва',white:'Белые',black:'Чёрные',journal:'ЖУРНАЛ БОЯ',moves:'Ходы',noMoves:'Ходов пока нет',check:'Шах!'},
  en:{title:'Arena',back:'Main menu',shards:'Honor shards',squads:'Your squad',enemies:'Opponents',section:'Section',power:'Power',wins:'Wins',losses:'Losses',draws:'Draws',fight:'Fight!',locked:'Defeat the previous opponent',buy:'Buy',select:'Select',owned:'Selected',resume:'Resume match',offer:'Choose an artifact',offerKicker:'BEFORE BATTLE',offerText:'Choose one artifact for this match',none:'No artifact',insufficient:'Not enough honor shards',victory:'Victory!',defeat:'Defeat',draw:'Draw',continue:'Continue',again:'Play again',rivals:'Opponents',double:'Watch ad: reward ×2',adError:'Ad was not completed. Your base reward is safe.',move:'Your move',thinking:'Opponent is thinking…',promotion:'Promote pawn',result:'Match complete',drawText:'Win to unlock the next opponent.',defeatText:'You can try again.',opponent:'Opponent',squad:'Squad',party:'Battle',white:'White',black:'Black',journal:'BATTLE LOG',moves:'Moves',noMoves:'No moves yet',check:'Check!'}
};
const types = {ru:{pawn:'Пешка',knight:'Конь',bishop:'Слон',rook:'Ладья',queen:'Ферзь',king:'Король'},en:{pawn:'Pawn',knight:'Knight',bishop:'Bishop',rook:'Rook',queen:'Queen',king:'King'}};
const raceEn = ['Humans','Elves','Orcs','Undead','Dark elves','Dwarves','Demons','Angels','Dragonborn','Beastfolk','Constructs','Animals','Fae','Goblins'];
const glyphs = {w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}};
const statIcons = {power:'generated_assets/node_battle.png',wins:'generated_assets/node_elite.png',losses:'assets/arena/defeat_crown.png',draws:'assets/relics/merchants_scale.png'};
const root = document.querySelector('[data-arena-screen]');
const menu = document.querySelector('[data-reboot-foundation]');
const board = root?.querySelector('[data-arena-board]');
const dialog = document.querySelector('[data-arena-dialog]');
const adapter = new ChessAIAdapter();
let state=emptyArena(),engine=null,section=0,selected=null,thinking=false,animating=false,animationDestination=null,moveAnimation=null,moveFlyer=null,captureGhost=null,searchId=0,adBusy=false,dialogType=null,promotion=null,notice='';
let historyKey=null,historyEntries=[],capturedByWhite=[],capturedByBlack=[];
function audio(){return globalThis.RPChessRebootAudio;}
function l(key){return (copy[currentLanguage()]||copy.ru)[key]||key;}
function raceLabel(race){return currentLanguage()==='en'?raceEn[RACE_TAGS.indexOf(race)]||race:(RACE_LABELS[race]||race);}
function foeLabel(foe){return (types[currentLanguage()]||types.ru)[foe.type]+' · '+raceLabel(foe.race);}
function read(){try{return normalizeArena(JSON.parse(platform.storage.local?.getItem(ARENA_KEY)||'null'));}catch{return emptyArena();}}
function save(next){state=normalizeArena(next);platform.storage.local?.setItem(ARENA_KEY,JSON.stringify(state));globalThis.dispatchEvent(new CustomEvent('rpchess:arena-updated'));render();}
function id(){return globalThis.crypto?.randomUUID?.()||'arena:'+Date.now()+':'+Math.random().toString(36).slice(2);}
function escape(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function img(src,cls,alt=''){return '<img class="'+cls+'" src="'+src+'" alt="'+escape(alt)+'">';}
function button(action,label,extra=''){return '<button type="button" data-arena-action="'+action+'" '+extra+'>'+label+'</button>';}
function statIcon(kind){return img(statIcons[kind],'arena-stat-icon','');}
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
  const foes=root.querySelector('[data-arena-foes]');foes.replaceChildren();
  for(const foe of OPPONENTS){
    const unlocked=foe.index<=stats.highest,card=document.createElement('button');
    card.type='button';card.className='arena-foe'+(foe.index%7===0?' arena-foe--section-start':'')+(unlocked?'':' is-locked');card.dataset.arenaFoe=foe.id;
    card.disabled=!unlocked;card.setAttribute('aria-label',foeLabel(foe)+', '+l('power')+': '+foe.elo);
    card.innerHTML=img(foe.art,'arena-foe-art','')+'<small class="arena-foe-power">'+statIcon('power')+l('power')+': '+foe.elo+'</small>'+(unlocked?'':'<span class="arena-lock" aria-hidden="true">🔒</span>');
    foes.append(card);
  }
  foes.scrollLeft=foes.children[section*7]?.offsetLeft-foes.children[0]?.offsetLeft||0;
  const resume=root.querySelector('[data-arena-resume]');
  resume.hidden=!state.match;resume.textContent=l('resume')+(state.match?' · '+l('power')+': '+OPPONENT_BY_ID.get(state.match.foe).elo:'');
  root.querySelector('[data-arena-notice]').textContent=notice;
}
function renderBoard(){
  const area=root.querySelector('[data-arena-battle]');
  area.hidden=!engine || !state.match || state.match.phase!=='playing';
  root.querySelector('[data-arena-rivals]').hidden=area.hidden;
  document.body.classList.toggle('arena-battle-active',!area.hidden);
  if(area.hidden)return;
  const foe=OPPONENT_BY_ID.get(state.match.foe),snapshot=engine.snapshot(),legal=selected?engine.legalMoves(selected):[];
  const checkedKing=snapshot.status.checked?snapshot.board.findIndex(piece=>piece?.type==='k'&&piece.color===snapshot.turn):-1;
  root.querySelector('[data-arena-party-title]').textContent=l('party');
  root.querySelector('[data-arena-battle-title]').textContent=l('opponent')+' · '+l('power')+': '+foe.elo;
  root.querySelector('[data-arena-status]').textContent=thinking?l('thinking'):(snapshot.status.over?l('result'):snapshot.status.checked?l('check'):snapshot.turn===state.match.playerColor?l('move'):l('thinking'));
  root.querySelector('[data-arena-rivals]').textContent=l('rivals');
  renderBattleHistory();
  board.replaceChildren();
  applyRaceBoardTheme(board,foe.race);
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
    const rank=state.match.playerColor==='b'?row:7-row,file=state.match.playerColor==='b'?7-col:col;
    const index=rank*8+file,square='abcdefgh'[file]+(rank+1),piece=snapshot.board[index];
    const cell=document.createElement('button');cell.type='button';cell.className='classic-square classic-square--'+((rank+file)%2?'light':'dark');
    cell.dataset.square=square;cell.setAttribute('role','gridcell');cell.setAttribute('aria-label',square+(piece?' '+piece.type:''));
    if(selected===square)cell.classList.add('classic-square--selected');
    if(legal.some(move=>(move.uciTo||move.to)===square))cell.classList.add('classic-square--legal');
    if(snapshot.lastMove && [snapshot.lastMove.from,snapshot.lastMove.to].includes(square))cell.classList.add('classic-square--last');
    if(index===checkedKing)cell.classList.add('classic-square--check');
    if(piece){
      const race=piece.color===state.match.playerColor?state.match.squad:foe.race;
      cell.innerHTML=img(racePiecePath(race,({p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'})[piece.type],piece.color),'classic-piece','')+'<span class="classic-piece-marker classic-piece-marker--'+piece.color+'" data-piece-marker="'+piece.type+'" aria-hidden="true">'+glyphs[piece.color][piece.type]+'</span>';
      if(animating&&square===animationDestination)cell.querySelector('.classic-piece').classList.add('classic-piece--arriving');
    }
    cell.disabled=thinking||animating||snapshot.status.over;
    board.append(cell);
  }
  renderThreatOverlay(board,snapshot,artifactById(state.match.artifactId),state.match.playerColor);
  applyPinIce(board,snapshot);
}
function replayBattleHistory(){
  const key=state.match.id+':'+state.match.moves.join(',');
  if(historyKey===key)return;
  historyKey=key;historyEntries=[];capturedByWhite=[];capturedByBlack=[];
  const replay=new ClassicChessEngine();
  for(const uci of state.match.moves){
    const from=uci.slice(0,2),to=uci.slice(2,4),promotion=uci.slice(4)||null;
    const moving=replay.pieceAt(from),before=replay.legalMoves();
    if(!moving)break;
    const candidate=before.find(option=>option.from===from&&option.to===to&&(!option.promotion||option.promotion===promotion));
    const captured=candidate?.capture?replay.pieceAt(candidate.capture):null;
    const alternatives=before.filter(candidate=>candidate.to===to&&candidate.from!==from&&replay.pieceAt(candidate.from)?.type===moving.type);
    const result=replay.move(from,to,promotion);
    if(!result.ok)break;
    const move=result.move,suffix=result.status.type==='checkmate'?'#':result.status.checked?'+':'';
    let san;
    if(move.castle==='K'||move.castle==='Q')san=(move.castle==='K'?'O-O':'O-O-O')+suffix;
    else {
      let prefix=moving.type==='p'?(move.capture?from[0]:''):({n:'N',b:'B',r:'R',q:'Q',k:'K'}[moving.type]||'');
      if(moving.type!=='p'&&alternatives.length){
        const sameFile=alternatives.some(candidate=>candidate.from[0]===from[0]);
        const sameRank=alternatives.some(candidate=>candidate.from[1]===from[1]);
        prefix+=!sameFile?from[0]:!sameRank?from[1]:from;
      }
      san=prefix+(move.capture?'x':'')+to+(promotion?'='+promotion.toUpperCase():'')+suffix;
    }
    historyEntries.push({san,color:moving.color});
    if(captured)(moving.color==='w'?capturedByWhite:capturedByBlack).push(captured.type);
  }
}
function renderBattleHistory(){
  replayBattleHistory();
  root.querySelector('[data-arena-white-label]').textContent=l('white');
  root.querySelector('[data-arena-black-label]').textContent=l('black');
  root.querySelector('[data-arena-journal-label]').textContent=l('journal');
  root.querySelector('[data-arena-moves-label]').textContent=l('moves');
  for(const [side,entries,color] of [['white',capturedByWhite,'b'],['black',capturedByBlack,'w']]){
    const node=root.querySelector('[data-arena-captured-'+side+']');
    node.replaceChildren(...entries.map(type=>{const element=document.createElement('span');element.className='classic-captured-piece classic-captured-piece--'+color;element.textContent=glyphs[color][type];return element;}));
    if(!entries.length)node.textContent='—';
  }
  const moves=root.querySelector('[data-arena-moves]');moves.replaceChildren();
  if(!historyEntries.length){const empty=document.createElement('div');empty.className='classic-empty';empty.textContent=l('noMoves');moves.append(empty);return;}
  for(let index=0;index<historyEntries.length;index+=2){
    const number=document.createElement('div');number.className='classic-move-number';number.textContent=(Math.floor(index/2)+1)+'.';moves.append(number);
    for(let offset=0;offset<2;offset++){
      const entry=historyEntries[index+offset],cell=document.createElement('div');cell.className='classic-move';
      if(!entry)cell.textContent='…';
      else {
        cell.dataset.san=entry.san;cell.setAttribute('aria-label',entry.san);
        const type={N:'n',B:'b',R:'r',Q:'q',K:'k'}[entry.san[0]];
        if(type){const figurine=document.createElement('span');figurine.className='classic-san-figurine classic-san-figurine--'+entry.color;figurine.textContent=glyphs[entry.color][type];figurine.setAttribute('aria-hidden','true');cell.append(figurine,document.createTextNode(entry.san.slice(1)));}
        else cell.textContent=entry.san;
      }
      moves.append(cell);
    }
  }
  moves.scrollTop=moves.scrollHeight;
}
function stopMoveAnimation(){
  const active=moveAnimation;moveAnimation=null;
  active?.cancel();moveFlyer?.remove();captureGhost?.remove();moveFlyer=null;captureGhost=null;
  animating=false;animationDestination=null;
}
function moveGeometry(from,to,promo){
  if(document.documentElement.dataset.reducedMotion==='1'||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||typeof Element.prototype.animate!=='function')return null;
  const candidate=engine.legalMoves(from).find(move=>(move.uciTo||move.to)===to&&(!move.promotion||move.promotion===promo));
  if(!candidate||candidate.castle)return null;
  const source=board.querySelector('[data-square="'+from+'"] .classic-piece');
  const target=board.querySelector('[data-square="'+to+'"]');
  if(!source||!target)return null;
  const captured=candidate.capture?board.querySelector('[data-square="'+candidate.capture+'"] .classic-piece'):null;
  return {source:source.getBoundingClientRect(),target:target.getBoundingClientRect(),src:source.getAttribute('src'),capturedSrc:captured?.getAttribute('src'),capturedRect:captured?.getBoundingClientRect()};
}
function animateCommittedMove(geometry,to,onDone){
  const target=board.querySelector('[data-square="'+to+'"] .classic-piece')?.getBoundingClientRect();
  const left=target?.left??geometry.target.left+(geometry.target.width-geometry.source.width)/2;
  const top=target?.top??geometry.target.top+(geometry.target.height-geometry.source.height)/2;
  const flyer=document.createElement('img');flyer.className='classic-piece-flyer';flyer.src=geometry.src;flyer.alt='';
  Object.assign(flyer.style,{left:geometry.source.left+'px',top:geometry.source.top+'px',width:geometry.source.width+'px',height:geometry.source.height+'px'});
  moveFlyer=flyer;document.body.append(flyer);
  if(geometry.capturedSrc&&geometry.capturedRect){
    const ghost=document.createElement('img');ghost.className='classic-captured-ghost';ghost.src=geometry.capturedSrc;ghost.alt='';
    Object.assign(ghost.style,{left:geometry.capturedRect.left+'px',top:geometry.capturedRect.top+'px',width:geometry.capturedRect.width+'px',height:geometry.capturedRect.height+'px'});
    captureGhost=ghost;document.body.append(ghost);
    ghost.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.72)'}],{duration:240,easing:'ease-out',fill:'forwards'});
  }
  const stamp=searchId,matchId=state.match?.id;
  const animation=flyer.animate([{transform:'translate3d(0,0,0) scale(1)'},{transform:'translate3d('+(left-geometry.source.left)+'px,'+(top-geometry.source.top)+'px,0) scale(1.025)'}],{duration:290,easing:'cubic-bezier(.22,.8,.24,1)',fill:'forwards'});
  moveAnimation=animation;
  animation.finished.catch(()=>{}).finally(()=>{
    if(moveAnimation!==animation)return;
    stopMoveAnimation();
    if(stamp!==searchId||!engine||state.match?.id!==matchId)return;
    renderBoard();onDone();
  });
}
function openDialog(kind,html){dialogType=kind;dialog.innerHTML='<section class="arena-dialog-panel arena-dialog-panel--'+kind+'" role="dialog" aria-modal="true" aria-label="'+escape(kind==='foe'?foeLabel(OPPONENT_BY_ID.get(dialog.dataset.foe)):l('title'))+'">'+html+'</section>';dialog.hidden=false;dialog.querySelector('button')?.focus();}
function closeDialog(){dialog.hidden=true;dialog.replaceChildren();dialogType=null;}
function renderDialog(){
  if(dialogType==='foe'){
    const foe=OPPONENT_BY_ID.get(dialog.dataset.foe);if(!foe)return closeDialog();
    const stats=arenaSummary(state).stats[foe.id];
    openDialog('foe','<header>'+button('close','×','class="arena-close" aria-label="'+(currentLanguage()==='en'?'Close':'Закрыть')+'"')+'</header><div class="arena-foe-profile"><div class="arena-foe-profile-art">'+img(foe.art,'arena-dialog-foe','')+'<p>'+statIcon('power')+l('power')+': '+foe.elo+'</p></div><dl class="arena-foe-profile-stats"><div><dt>'+statIcon('wins')+l('wins')+'</dt><dd>'+stats.wins+'</dd></div><div><dt>'+statIcon('losses')+l('losses')+'</dt><dd>'+stats.losses+'</dd></div><div><dt>'+statIcon('draws')+l('draws')+'</dt><dd>'+stats.draws+'</dd></div></dl></div>'+button('fight',l('fight')));
  }else if(dialogType==='offer'&&state.match){
    const cards=ARTIFACTS.map(a=>button('artifact',img(a.icon,'arena-artifact','')+'<strong>'+escape(currentLanguage()==='en'?a.id==='threat.great'?'Greater awareness':a.id==='threat.attack'?'Attack awareness':'Defense awareness':a.name)+'</strong><small>'+escape(currentLanguage()==='en'?a.id==='threat.great'?'Shows threats to both armies':a.id==='threat.attack'?'Shows threats to enemy pieces':'Shows threats to your pieces':a.description)+'</small><span class="arena-artifact-price">'+img(SHARD_ICON,'arena-inline-shard','')+' '+ARTIFACT_PRICES[a.id]+'</span>','data-artifact="'+a.id+'" '+(arenaSummary(state).balance<ARTIFACT_PRICES[a.id]?'disabled':''))).join('');
    openDialog('offer','<div class="reboot-eyebrow">'+l('offerKicker')+'</div><h2>'+l('offer')+'</h2><p>'+l('offerText')+'</p><div class="arena-offers">'+cards+button('artifact','<span class="arena-artifact-empty" aria-hidden="true">—</span><strong>'+l('none')+'</strong>','data-artifact="none"')+'</div>');
  }else if(dialogType==='result'&&state.match){
    const match=state.match,win=match.outcome==='win',loss=match.outcome==='loss',claimed=arenaSummary(state).accepted.has(match.id+':ad');
    const icon=win?img(SHARD_ICON,'arena-result-icon',''):loss?img('assets/arena/defeat_crown.png','arena-result-icon',''):'<span class="arena-result-icon">½</span>';
    const ad=win && platform.storage.cloud.available && !claimed?button('double',l('double'),' '+(adBusy?'disabled':'')):'';
    const message=win?('+'+match.reward+(claimed?' ×2':'')+' '+l('shards')):loss?l('defeatText'):l('drawText');
    openDialog('result','<h2>'+l(win?'victory':loss?'defeat':'draw')+'</h2>'+icon+'<p>'+message+'</p><p class="arena-notice" role="status">'+escape(notice)+'</p><div class="arena-result-actions">'+ad+button('continue',l('continue'),adBusy?'disabled':'')+(loss?button('again',l('again')):'')+'</div>');
  }else if(dialogType==='promotion'){
    openDialog('promotion','<h2>'+l('promotion')+'</h2><div class="arena-promotions">'+['q','r','b','n'].map(type=>button('promote',glyphs[state.match.playerColor][type],'data-promotion="'+type+'"')).join('')+'</div>');
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
  const outcome=status.type==='checkmate'?(status.winner===state.match.playerColor?'win':'loss'):'draw';
  stopMoveAnimation();engine=null;selected=null;adapter.stop();searchId++;notice='';
  save(finishMatch(state,outcome));dialogType='result';render();
}
function startBattle(){
  if(state.match?.phase!=='playing')return;
  closeDialog();engine=new ClassicChessEngine();selected=null;render();void aiTurn();
}
function commit(from,to,promo=null){
  if(!engine||animating||thinking||state.match?.phase!=='playing')return;
  const geometry=moveGeometry(from,to,promo);
  const result=engine.move(from,to,promo);
  if(!result.ok){
    if(result.reason==='promotion_required'){promotion={from,to};dialogType='promotion';renderDialog();}
    return;
  }
  selected=null;promotion=null;closeDialog();
  if(result.move.capture)audio()?.capture?.();else audio()?.move?.();
  if(result.status.checked)setTimeout(()=>audio()?.check?.(),45);
  animating=Boolean(geometry);animationDestination=animating?to:null;
  const moves=[...state.match.moves,from+to+(promo||'')];
  save({...state,match:{...state.match,moves},updatedAt:Date.now()});
  const afterMove=()=>{if(result.status.over)settle(result.status);else void aiTurn();};
  if(geometry)animateCommittedMove(geometry,to,afterMove);
  else afterMove();
}
async function aiTurn(){
  if(!engine||engine.turn()===state.match?.playerColor||state.match?.phase!=='playing')return;
  const stamp=++searchId,foe=OPPONENT_BY_ID.get(state.match.foe);thinking=true;render();
  const started=performance.now();
  const uci=await adapter.chooseMove({fen:engine.fen(),elo:foe.elo,legalMoves:engine.legalMoves(),arena:true});
  const remaining=Math.max(0,180-(performance.now()-started));
  if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
  if(stamp!==searchId||!engine||state.match?.phase!=='playing')return;
  thinking=false;
  if(!uci){notice='Engine is unavailable';render();return;}
  commit(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
}
function enter(){state=read();engine=null;selected=null;section=Math.floor((OPPONENT_BY_ID.get(state.match?.foe)?.index??arenaSummary(state).highest)/7);notice='';visible(true);if(state.match?.phase==='result')dialogType='result';else if(state.match?.phase==='offer')dialogType='offer';else restoreMatch();render();}
function leave(){adapter.stop();searchId++;thinking=false;stopMoveAnimation();engine=null;closeDialog();visible(false);}
root?.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target||target.disabled)return;
  if(target.dataset.arenaBack!==undefined){leave();return;}
  if(target.dataset.arenaResume!==undefined){if(state.match?.phase==='offer')dialogType='offer';else if(state.match?.phase==='result')dialogType='result';else restoreMatch();render();return;}
  if(target.dataset.arenaRivals!==undefined){adapter.stop();searchId++;thinking=false;stopMoveAnimation();engine=null;render();return;}
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
    if(!engine||thinking||engine.turn()!==state.match.playerColor)return;
    const square=target.dataset.square,piece=engine.pieceAt(square);
    if(!selected){if(piece?.color===state.match.playerColor){selected=square;renderBoard();}return;}
    if(selected===square){selected=null;renderBoard();return;}
    if(piece?.color===state.match.playerColor&&!engine.legalMoves(selected).some(m=>m.uciTo===square)){selected=square;renderBoard();return;}
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
const foeCarousel=root?.querySelector('[data-arena-foes]');
foeCarousel?.addEventListener('wheel',event=>{
  if(!foeCarousel.clientWidth||foeCarousel.scrollWidth<=foeCarousel.clientWidth)return;
  const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
  if(!delta)return;
  event.preventDefault();
  foeCarousel.scrollLeft+=delta;
},{passive:false});
foeCarousel?.addEventListener('scroll',()=>{
  if(!foeCarousel.children.length)return;
  const start=foeCarousel.children[0].offsetLeft;
  let closest=0,distance=Infinity;
  for(let i=0;i<12;i++){
    const card=foeCarousel.children[i*7];
    if(!card)break;
    const gap=Math.abs(card.offsetLeft-start-foeCarousel.scrollLeft);
    if(gap<distance){distance=gap;closest=i;}
  }
  section=closest;
  const label=root.querySelector('[data-arena-section]');
  if(label)label.textContent=l('section')+' '+(section+1)+' / 12';
},{passive:true});
const entryButton=document.querySelector('[data-arena-open]');
entryButton?.addEventListener('click',()=>{void Promise.resolve(globalThis.RPChessCloudReady).then(enter);});
function updateLanguage(){if(entryButton)entryButton.textContent=l('title');render();}
subscribe(updateLanguage);
updateLanguage();
addEventListener('beforeunload',()=>adapter.destroy(),{once:true});
globalThis.RPChessArena={enter,get state(){return state;},get engine(){return engine;}};
