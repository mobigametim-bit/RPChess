/* Tournament MVP: first production-integrated screen.
   Real matchmaking is enabled only after a verified tournament API is configured.
   This UI never creates fictitious opponents, receipts or ranked results. */
import { arenaSummary, normalizeArena, ARENA_KEY, SHARD_ICON } from './arena-core.mjs';
import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { attachPieceDrag } from './piece-drag.mjs';
import { fantasyPieceMarkup } from './fantasy-piece.mjs';
import { openFinishedGameReview } from './finished-game-review.mjs?v=20261104-piece-glyph-7';
import { applyPinIce } from './king-pin-ice.mjs';
import { RACE_TAGS, RACE_LABELS, racePiecePath, applyRaceBoardTheme } from './race-assets.mjs';
import { readPlayerRating, importTournamentRatingReceipt, ratingDelta } from './player-rating.mjs';
import { currentLanguage, subscribe } from './i18n.mjs';
import { platform } from './platform.mjs';
import { readRun } from './run-persistence.mjs';
import { readChronicle } from './chronicle-core.mjs';
import { commanderPortrait,normalizeCommanderId } from './commander-portraits.mjs';
import { LocalShadowGame,loadShadowGame,saveShadowGame } from './tournament-shadow-game.mjs';

const root=document.createElement('main');
root.className='tournament-screen';
root.setAttribute('data-tournament-screen','');
root.setAttribute('aria-label','Турнир — Герои Шаха и мата');
root.hidden=true;
document.querySelector('#app')?.append(root);
const menu=document.querySelector('[data-reboot-foundation]');
const button=document.querySelector('[data-tournament-open]');
const STORAGE_KEY='rpchess.reboot.v1.tournament-ui';
const API=globalThis.location?.hostname==='rpchess-tournament-v4-preview.mobigametim.workers.dev'
 ? 'https://rpchess-tournament-v4-api-preview.mobigametim.workers.dev'
 :platform.profileEnabled
 ? 'https://rpchess-tournament-profile-preview.mobigametim.workers.dev'
 : (document.querySelector('meta[name="rpchess-tournament-api"]')?.content?.trim()||'');
const EN=['Humans','Elves','Orcs','Undead','Dark elves','Dwarves','Demons','Angels','Dragonkin','Beastfolk','Constructs','Animals','Fae','Goblins'];
const words={
 ru:{title:'Турнир',back:'Главное меню',subtitle:'Шахматный бой с настоящим соперником',clock:'Классика · 10 минут',clockNote:'По 10 минут каждому игроку, без добавления секунд',squad:'Ваш отряд',pick:'Выберите доступный скин, купленный на Арене',power:'Мощь',shards:'Осколки чести',find:'Найти соперника',invite:'Пригласить друга',join:'Войти по коду',owned:'Открыт',locked:'Не куплен',search:'Поиск соперника',searchHint:'Подбираем живого игрока по Мощи',cancel:'Отменить поиск',bot:'Сыграть с ИИ на Арене',offline:'Сервер Турнира ещё не подключён. PvP станет доступен после отдельной серверной приёмки.',searchPending:'Ожидание соперника',wait:'В поиске',noMatch:'Соперник пока не найден. Можно продолжить поиск или сыграть с ИИ на Арене.',continue:'Продолжить поиск',waitFriend:'Ожидание друга',room:'Код комнаты',copy:'Копировать код',link:'Копировать ссылку',private:'Приватная партия · 10+0',entry:'Введите код приглашения',enter:'Присоединиться',closeRoom:'Отменить комнату',match:'Матч',you:'Вы',opponent:'Противник',draw:'Предложить ничью',resign:'Сдаться',leave:'К Турниру',yourTurn:'Ваш ход',theirTurn:'Ход соперника',connection:'Соединение',result:'Результат',again:'Найти ещё соперника',notice:'Это реальный PvP: бот никогда не выдаётся за человека.',loading:'Подключение…',error:'Ошибка соединения',needServer:'Онлайн-матчи пока недоступны',newInvite:'Создать комнату',review:'Анализировать',shadow:'Игра с тенью',shadowTime:'Время партии',noClock:'Без времени',startShadow:'Играть',resumeShadow:'Продолжить',shadowWinWhite:'Победа белых',shadowWinBlack:'Победа чёрных',shadowDraw:'Ничья',shadowTurn:'Ход',shadowNew:'Новая партия',shadowDrawAction:'Ничья',shadowLocal:'Локальная партия · рейтинг не изменяется'},
 en:{title:'Tournament',back:'Main menu',subtitle:'Real chess against another player',clock:'Classic · 10 minutes',clockNote:'10 minutes per player, no increment',squad:'Your squad',pick:'Choose an Arena squad you own',power:'Power',shards:'Honor shards',find:'Find opponent',invite:'Invite a friend',join:'Join by code',owned:'Owned',locked:'Locked',search:'Matchmaking',searchHint:'Looking for a real player near your power',cancel:'Cancel search',bot:'Play AI in Arena',offline:'Tournament server is not connected yet. PvP goes live after separate server testing.',searchPending:'Waiting for opponent',wait:'Searching',noMatch:'No opponent found yet. Continue searching or play Arena AI.',continue:'Keep searching',waitFriend:'Waiting for friend',room:'Room code',copy:'Copy code',link:'Copy invite URL',private:'Private game · 10+0',entry:'Enter invite code',enter:'Join',closeRoom:'Close room',match:'Match',you:'You',opponent:'Opponent',draw:'Offer draw',resign:'Resign',leave:'Tournament',yourTurn:'Your move',theirTurn:"Opponent's move",connection:'Connection',result:'Result',again:'Find another player',notice:'Real PvP only: AI is never disguised as a human.',loading:'Connecting…',error:'Connection error',needServer:'Online unavailable',newInvite:'Create room',review:'Analyze',shadow:'Shadow game',shadowTime:'Game clock',noClock:'Unlimited',startShadow:'Play',resumeShadow:'Resume',shadowWinWhite:'White wins',shadowWinBlack:'Black wins',shadowDraw:'Draw',shadowTurn:'To move',shadowNew:'New game',shadowDrawAction:'Draw',shadowLocal:'Local match · ratings unchanged'}
};
let page='setup',squad='humans',queueSince=0,searchJob=null,session=null,live=null,roomCode='',message='',tabVisible=false;
let lastSearch=0;
let matchState=null,chess=null,selectedSquare=null,matchJob=null,matchRendered=false,lastSnapshotAt=0,busyMove=false,dragActive=false;
let ratedReceipt=null,resumeSerial=0,connectJob=null,tournamentProfile=null;
let chosenMode='online',shadowClock='unlimited',shadowGame=null;
// Arena-matched 290 ms smooth move flight for authoritative server moves.
let pendingFlight=null,moveFlyer=null,captureGhost=null,moveAnimation=null,moveAnimationSerial=0;
const ROLE={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
function lang(){return currentLanguage()==='en'?'en':'ru';}
function t(key){return words[lang()][key]||key;}
function esc(text){return String(text??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function arena(){try{return arenaSummary(normalizeArena(JSON.parse(platform.storage.local?.getItem(ARENA_KEY)||'null')));}catch{return {owned:new Set(['humans']),balance:0};}}
function saved(){try{return JSON.parse(platform.storage.local?.getItem(STORAGE_KEY)||'{}');}catch{return {};}}
function remember(){platform.storage.local?.setItem(STORAGE_KEY,JSON.stringify({squad}));}
function raceLabel(r){return lang()==='en'?EN[RACE_TAGS.indexOf(r)]||r:RACE_LABELS[r]||r;}
function head(){return '<header class="tournament-header"><div><h1>'+t('title')+'</h1></div><button type="button" class="classic-mini-button" data-tour-action="back">'+t('back')+'</button></header>';}
const POWER_ICON='assets/doctrines/royal_court/emblem.png';
const POWER_NAME=()=>lang()==='ru'?'Мощь':'Power';
const shadowIcon='<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M13 48V28c0-12 8-20 19-20s19 8 19 20v20l-9-6-10 8-10-8-9 6Z" stroke="#eac57d" stroke-width="3" fill="#192c3d"/><circle cx="25" cy="29" r="3" fill="#eac57d"/><circle cx="39" cy="29" r="3" fill="#eac57d"/></svg>';
const modeClock='<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="33" r="23" stroke="#e3c177" stroke-width="3"/><path d="M32 18v15l9 7" stroke="#ffe5a8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 3h12M32 3v6" stroke="#e2b86b" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="33" r="2.5" fill="#ffe5a8"/></svg>';
function identity(){
  const run=readRun();
  const history=readChronicle().history.slice().sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
  const best=run?.playerName?run:history[0]||{};
  return {name:String(best.playerName||(lang()==='ru'?'Воин':'Warrior')).slice(0,24),
    commanderId:normalizeCommanderId(best.commanderId),power:readPlayerRating().power};
}
function powerMark(value){
  const safe=Number.isFinite(value)?Math.max(0,Math.round(value)):500;
  return '<span class="tournament-power-mark" title="'+POWER_NAME()+'" aria-label="'+POWER_NAME()+' '+safe+'"><img src="'+POWER_ICON+'" alt="" aria-hidden="true"><b>'+safe+'</b></span>';
}
function raceMark(race,color='w'){
  const r=RACE_TAGS.includes(race)?race:'humans';
  return '<span class="tournament-race-mark"><img src="'+racePiecePath(r,'king',color)+'" alt="" aria-hidden="true"><b>'+esc(raceLabel(r))+'</b></span>';
}
function profileCard(){
  const player=identity();
  return '<div class="tournament-profile-card" aria-label="'+esc(player.name)+'">'+
    '<img class="tournament-profile-avatar" src="'+commanderPortrait(player.commanderId)+'" alt="">'+
    '<strong class="tournament-profile-name">'+esc(player.name)+'</strong>'+
    raceMark(squad)+powerMark(player.power)+'</div>';
}
function action(name,label,extra=''){return '<button type="button" class="reboot-button reboot-button--primary" data-tour-action="'+name+'" '+extra+'>'+label+'</button>';}
function notice(text){return '<p class="tournament-notice" role="status">'+esc(text||'')+'</p>';}
function setup(){
  const owned=arena().owned;
  if(!owned.has(squad))squad='humans';
  const choices=RACE_TAGS.map(r=>{
    const available=owned.has(r);
    return '<button type="button" data-tour-squad="'+r+'" class="tournament-squad'+
      (r===squad?' is-selected':'')+(available?'':' is-locked')+'" '+
      (available?'':'disabled')+' aria-label="'+esc(raceLabel(r))+
      '" aria-pressed="'+(r===squad)+'">'+
      '<img src="'+racePiecePath(r,'king','w')+'" alt=""><strong>'+esc(raceLabel(r))+'</strong></button>';
  }).join('');
  return '<section class="tournament-layout tournament-setup">'+
    '<div class="tournament-setup-primary">'+profileCard()+
      '<div class="tournament-card tournament-squad-card"><h2>'+t('squad')+'</h2>'+
        '<div class="tournament-squads" tabindex="0" role="group" aria-label="'+t('squad')+'">'+choices+'</div></div></div>'+
    '<div class="tournament-setup-secondary">'+
      '<div class="tournament-card tournament-modes"><h2>'+(lang()==='ru'?'Режимы игры':'Game modes')+'</h2>'+
        '<div class="tournament-mode-grid">'+
          '<button type="button" data-tour-mode="online" class="tournament-mode-tile'+(chosenMode==='online'?' is-selected':'')+
          '" aria-pressed="'+(chosenMode==='online')+'" aria-label="10+0">'+modeClock+'<strong>10+0</strong></button>'+
          '<button type="button" data-tour-mode="shadow" class="tournament-mode-tile tournament-shadow-tile'+(chosenMode==='shadow'?' is-selected':'')+
          '" aria-pressed="'+(chosenMode==='shadow')+'">'+shadowIcon+'<strong>'+t('shadow')+'</strong></button></div>'+
        (chosenMode==='shadow'?'<div class="tournament-shadow-clocks" role="group" aria-label="'+t('shadowTime')+'">'+
          '<button type="button" data-shadow-clock="unlimited" aria-pressed="'+(shadowClock==='unlimited')+
          '" class="'+(shadowClock==='unlimited'?'is-selected':'')+'">'+t('noClock')+'</button>'+
          '<button type="button" data-shadow-clock="10+0" aria-pressed="'+(shadowClock==='10+0')+
          '" class="'+(shadowClock==='10+0'?'is-selected':'')+'">10+0</button>'+
          '</div>':'')+'</div>'+
      '<div class="tournament-actions">'+(chosenMode==='shadow'?
        action('shadow-start',t('startShadow'))+
          (loadShadowGame(platform.storage.local)?.status==='playing'?action('shadow-resume',t('resumeShadow')):''):
        action('search',t('find'))+action('invite',t('invite'))+action('join-screen',t('join')))+
      '</div>'+
      (API||chosenMode==='shadow'?'':notice(t('offline')))+
    '</div></section>';
}
function search(){
 const sec=Math.floor((Date.now()-queueSince)/1000);
 return '<section class="tournament-card tournament-center"><div class="tournament-spinner">♞</div><h2>'+t('search')+'</h2><p>'+t('searchHint')+'</p><strong>'+Math.floor(sec/60).toString().padStart(2,'0')+':'+(sec%60).toString().padStart(2,'0')+'</strong><div class="tournament-actions">'+action('cancel',t('cancel'))+action('arena',t('bot'))+'</div>'+notice(message||t('noMatch'))+'</section>';
}
function invite(){return '<section class="tournament-card tournament-center"><h2>'+t('waitFriend')+'</h2><p>'+t('private')+'</p><div class="tournament-room-code">'+esc(roomCode||'—')+'</div><div class="tournament-actions">'+action('copy-code',t('copy'))+action('copy-link',t('link'))+action('cancel',t('closeRoom'))+'</div>'+notice(message)+'</section>';}
function joining(){return '<section class="tournament-card tournament-center"><h2>'+t('join')+'</h2><p>'+t('entry')+'</p><input class="tournament-code-input" data-tour-code maxlength="12" autocomplete="off" placeholder="AB12CD" value="'+esc(roomCode)+'"><div class="tournament-actions">'+action('join-submit',t('enter'))+action('cancel',t('leave'))+'</div>'+notice(message)+'</section>';}
function render(){
 if(!tabVisible)return;
 const inBattle=page==='match'&&matchState?.status==='playing';
 root.classList.toggle('tournament-screen--setup',page==='setup');
 root.classList.toggle('tournament-screen--shadow',Boolean(shadowGame));
 root.classList.toggle('tournament-screen--match',Boolean(inBattle));
 document.body.classList.toggle('tournament-battle-active',Boolean(inBattle));
 if(inBattle){showBattle();return;}
 if(page==='result'&&matchState){root.innerHTML=head()+resultView();return;}
 matchRendered=false;
 root.innerHTML=head()+(page==='setup'?setup():page==='search'?search():page==='invite'?invite():page==='join'?joining():notice(message));
}
function boardMarkup(){
 if(!chess||!matchState)return '';
 const snapshot=chess.snapshot();
 const checkedKing=snapshot.status.checked?snapshot.board.findIndex(piece=>piece?.type==='k'&&piece.color===snapshot.turn):-1;
 const reverse=!shadowGame&&matchState.playerColor==='b';
 const legal=selectedSquare?chess.legalMoves(selectedSquare):[];
 let output='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const rank=reverse?y:7-y, file=reverse?7-x:x,idx=rank*8+file;
  const sq='abcdefgh'[file]+(rank+1),piece=snapshot.board[idx];
  const light=(rank+file)%2!==0;
  const img=piece?'<img class="classic-piece" draggable="false" alt="" src="'+racePiecePath(matchState.players.find(p=>p.color===piece.color)?.race||'humans',ROLE[piece.type],piece.color)+'">':'';
  const symbol=piece?'<span class="rpchess-piece-symbol" aria-hidden="true">'+fantasyPieceMarkup(piece.type,piece.color)+'</span>':'';
  const move=legal.find(m=>m.to===sq);
  const arriving=pendingFlight?.to===sq;
  const art=arriving?img.replace('class="classic-piece"','class="classic-piece classic-piece--arriving"'):img;
  output+='<button type="button" class="classic-square '+(light?'classic-square--light':'classic-square--dark')+(selectedSquare===sq?' classic-square--selected':'')+(move?' classic-square--legal':'')+(move?.capture?' classic-square--capture':'')+(idx===checkedKing?' classic-square--check':'')+'" data-square="'+sq+'" aria-label="'+sq+'">'+art+symbol+'</button>';
 }
 return output;
}
function timeLeft(color){
 if(!matchState)return 0;
 if(shadowGame)return shadowGame.remainingFor(color);
 const base=Number(matchState.remaining?.[color]||0);
 const elapsed=matchState.status==='playing'&&matchState.turn===color?Math.max(0,Date.now()-lastSnapshotAt):0;
 return Math.max(0,base-elapsed);
}
function clock(ms){if(!Number.isFinite(ms))return '∞';const sec=Math.ceil(Math.max(0,ms)/1000);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
function resultView(){
 if(shadowGame){
  const outcome=matchState?.result;
  const title=outcome?.winner==null?t('shadowDraw'):
    outcome.winner==='w'?t('shadowWinWhite'):t('shadowWinBlack');
  return '<section class="tournament-card tournament-center tournament-shadow-result">'+
    '<h2>'+title+'</h2><p class="tournament-muted">'+t('shadowLocal')+'</p>'+
    '<div class="tournament-actions">'+(matchState?.moves?.length?action('review',t('review')):'')+
      action('again',t('shadowNew'))+action('cancel',t('leave'))+'</div></section>';
 }
 const outcome=matchState.result;
 const win=outcome?.winner===matchState.playerColor,draw=!outcome?.winner;
 const title=lang()==='ru'?(draw?'Ничья':win?'Победа!':'Поражение'):(draw?'Draw':win?'Victory!':'Defeat');
 const rating=ratedReceipt;
 const ratingMarkup=rating
  ?'<div class="tournament-rating-result" data-tour-rating><span>'+(lang()==='ru'?'Мощь':'Power')+'</span><strong>'+rating.before+' → '+rating.after+'</strong><b class="'+(rating.delta<0?'is-loss':rating.delta>0?'is-win':'')+'">'+(rating.delta>0?'+':'')+rating.delta+'</b></div>'
  :'';
 return '<section class="tournament-card tournament-center"><h2>'+title+'</h2><p>'+esc(outcome?.kind||'')+'</p>'+ratingMarkup+
  '<p class="tournament-muted">'+(matchState.rated
   ?(lang()==='ru'?'Рейтинговый результат подтверждён сервером. Осколки чести пока не начисляются.':'Rated result confirmed by server. Honor shards are still disabled.')
   :(lang()==='ru'?'Товарищеская партия: Мощь и Осколки чести не изменяются.':'Casual match: Power and Honor shards remain unchanged.'))+'</p>'+
  '<div class="tournament-actions">'+(matchState?.moves?.length?action('review',t('review')):'')+action('again',t('again'))+action('cancel',t('leave'))+'</div></section>';
}
function showBattle(){
 if(!matchState)return;
 const mine=matchState.players.find(p=>p.color===matchState.playerColor);
 const rival=matchState.players.find(p=>p.color!==matchState.playerColor);
 if(!mine||!rival)return;
 const local=identity();
 const panel=(p,own)=>{
   const commander=normalizeCommanderId(p.commanderId||(own?local.commanderId:null));
   const power=Number.isFinite(p.displayPower)?p.displayPower:(own?local.power:p.power);
   const name=p.name==='Guest'&&own?local.name:p.name;
   const isShadow=Boolean(shadowGame)&&!own;
   const shownName=isShadow?(lang()==='ru'?'Тень ':'Shadow ')+mine.name:name;
   return '<section class="tournament-playerbar tournament-clock-panel '+(own?'tournament-clock-panel--self':'tournament-clock-panel--rival')+
     (isShadow?' tournament-clock-panel--shadow':'')+
     '" data-tour-player="'+p.color+'" aria-label="'+esc(shownName)+'">'+
     '<img class="tournament-duel-portrait'+(isShadow?' tournament-duel-portrait--shadow':'')+
       '" src="'+commanderPortrait(commander)+'" alt="">'+
     '<div class="tournament-player"><strong>'+esc(shownName)+'</strong>'+
       powerMark(power)+raceMark(p.race,p.color)+'</div>'+
     '<span class="tournament-clock" data-tour-clock="'+p.color+'"></span></section>';
 };
 if(!matchRendered||!root.querySelector('[data-tour-board]')){
  root.innerHTML=
   '<header class="tournament-battle-mobile-header"><strong>'+t('title')+' · '+(shadowGame?(shadowGame.isTimed?'10+0':'∞'):'10+0')+'</strong>'+
      '<button type="button" class="classic-mini-button" data-tour-action="menu">'+t('back')+'</button></header>'+
   '<section class="tournament-match" aria-label="'+t('match')+'"><div class="tournament-match-layout">'+
     '<nav class="tournament-battle-nav" aria-label="'+t('match')+'">'+
       '<button type="button" class="classic-mini-button" data-tour-action="panel" aria-expanded="false" aria-controls="tournament-tools" title="'+
         (lang()==='ru'?'Ходы и управление':'Moves and controls')+'">☰</button>'+
       '<button type="button" class="classic-mini-button" data-tour-action="settings" title="'+(lang()==='ru'?'Настройки':'Settings')+'">⚙</button>'+
       '<button type="button" class="classic-mini-button" data-tour-action="menu" title="'+t('back')+'">⌂</button>'+
     '</nav>'+
     '<div class="tournament-battle-rail">'+panel(rival,false)+
       '<aside id="tournament-tools" class="tournament-card tournament-match-sidebar" hidden>'+
         '<h2>'+t('title')+'</h2><small class="tournament-match-kicker">'+(shadowGame?(shadowGame.isTimed?'10+0':'∞'):'10+0')+'</small>'+
         '<p data-tour-turn role="status"></p><div class="tournament-actions">'+
           action('offer-draw',shadowGame?t('shadowDrawAction'):t('draw'))+action('resign',t('resign'))+action('back',t('leave'))+
         '</div><section class="tournament-journal">'+
           '<div class="tournament-journal-heading"><h3>'+(lang()==='en'?'Moves':'Ходы')+'</h3></div>'+
           '<div class="tournament-moves" data-tour-history aria-label="'+(lang()==='en'?'Moves':'Ходы')+'"></div>'+
         '</section></aside>'+
         panel(mine,true)+'</div>'+
     '<div class="tournament-match-main">'+
       '<div class="classic-board tournament-board" data-tour-board data-player-color="'+esc(matchState.playerColor)+'" role="grid" aria-label="Tournament chessboard"></div>'+
     '</div></div></section>';
  applyRaceBoardTheme(root.querySelector('[data-tour-board]'),
    matchState.players.find(p=>p.color==='w')?.race||'humans');
  attachPieceDrag(root.querySelector('[data-tour-board]'),{
   canPick:square=>Boolean(chess&&matchState.status==='playing'&&
     (shadowGame?chess.pieceAt(square)?.color===chess.turn():
       chess.turn()===matchState.playerColor&&chess.pieceAt(square)?.color===matchState.playerColor)&&!busyMove&&!pendingFlight),
   onStart:from=>highlightDragFrom(from),
   onDrop:(from,to)=>{
    dragActive=false;
    if(to&&chess?.legalMoves(from).some(move=>move.to===to))void sendMove(from,to);
    else {selectedSquare=from;refreshBoard();}
   },
   onCancel:()=>{dragActive=false;refreshBoard();}
  });
  matchRendered=true;
  dispatchEvent(new Event('rpchess:tournament-board-mounted'));
 }
 refreshBoard();
}
/* Capture the position BEFORE applying the server snapshot. This animates
 * both our confirmed move and an opponent move, never speculative client state.
 * Arena uses the same 290ms timing, easing and flyer/capture VFX. */
function stopTournamentFlight(){
 moveAnimationSerial++;
 const active=moveAnimation;moveAnimation=null;
 active?.cancel();moveFlyer?.remove();captureGhost?.remove();
 moveFlyer=null;captureGhost=null;pendingFlight=null;
 root.querySelectorAll('[data-tour-board] .classic-piece--arriving').forEach(img=>img.classList.remove('classic-piece--arriving'));
}
function geometryForServerMove(response){
 if(!matchRendered||!matchState||!chess||page!=='match'||dragActive||
    !Array.isArray(response.moves)||response.status!=='playing'||
    response.matchId!==matchState.matchId||
    response.moves.length!==matchState.moves.length+1||
    document.documentElement.dataset.reducedMotion==='1'||
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||
    typeof Element.prototype.animate!=='function')return null;
 const step=response.moves.at(-1),board=root.querySelector('[data-tour-board]');
 if(!board||!step||typeof step.from!=='string'||typeof step.to!=='string')return null;
 const candidate=chess.legalMoves(step.from).find(m=>m.to===step.to&&(!m.promotion||m.promotion===step.promotion));
 if(!candidate||candidate.castle)return null;
 const selector=document.documentElement.dataset.simplePieces==='1'?'.rpchess-fantasy-piece':'.classic-piece';
 const source=board.querySelector('[data-square="'+step.from+'"] '+selector);
 const target=board.querySelector('[data-square="'+step.to+'"]');
 if(!source||!target)return null;
 const capture=candidate.capture?board.querySelector('[data-square="'+candidate.capture+'"] '+selector):null;
 return {to:step.to,src:source.getAttribute('src'),source:source.getBoundingClientRect(),
  target:target.getBoundingClientRect(),selector,capturedSrc:capture?.getAttribute('src'),
  capturedRect:capture?.getBoundingClientRect()};
}
function startTournamentFlight(geometry){
 if(!geometry||pendingFlight!==geometry||!root.querySelector('[data-tour-board]'))return;
 const dest=root.querySelector('[data-tour-board] [data-square="'+geometry.to+'"] '+geometry.selector)?.getBoundingClientRect();
 const left=dest?.left??geometry.target.left+(geometry.target.width-geometry.source.width)/2;
 const top=dest?.top??geometry.target.top+(geometry.target.height-geometry.source.height)/2;
 const flyer=document.createElement('img');
 flyer.className='classic-piece-flyer';flyer.src=geometry.src;flyer.alt='';
 Object.assign(flyer.style,{left:geometry.source.left+'px',top:geometry.source.top+'px',
  width:geometry.source.width+'px',height:geometry.source.height+'px'});
 document.body.append(flyer);moveFlyer=flyer;
 if(geometry.capturedSrc&&geometry.capturedRect){
  const ghost=document.createElement('img');ghost.className='classic-captured-ghost';
  ghost.src=geometry.capturedSrc;ghost.alt='';
  Object.assign(ghost.style,{left:geometry.capturedRect.left+'px',top:geometry.capturedRect.top+'px',
   width:geometry.capturedRect.width+'px',height:geometry.capturedRect.height+'px'});
  document.body.append(ghost);captureGhost=ghost;
  ghost.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.72)'}],
   {duration:240,easing:'ease-out',fill:'forwards'});
 }
 const stamp=++moveAnimationSerial;
 const animation=flyer.animate(
  [{transform:'translate3d(0,0,0) scale(1)'},
   {transform:'translate3d('+(left-geometry.source.left)+'px,'+(top-geometry.source.top)+'px,0) scale(1.025)'}],
  {duration:290,easing:'cubic-bezier(.22,.8,.24,1)',fill:'forwards'});
 moveAnimation=animation;
 animation.finished.catch(()=>{}).finally(()=>{
  if(stamp===moveAnimationSerial&&moveAnimation===animation)stopTournamentFlight();
 });
}
function highlightDragFrom(from){
 const board=root.querySelector('[data-tour-board]');
 if(!board||!chess)return;
 dragActive=true;
 selectedSquare=from;
 // A pointer gesture starts on a square that is currently the pointer target.
 // Replacing its HTML at this moment cancels touch dragging in WebView. Keep
 // those nodes in place and decorate existing squares instead.
 board.querySelectorAll('.classic-square--legal,.classic-square--capture,.classic-square--selected').forEach(node=>node.classList.remove('classic-square--legal','classic-square--capture','classic-square--selected'));
 board.querySelector('[data-square="'+from+'"]')?.classList.add('classic-square--selected');
 for(const move of chess.legalMoves(from)){
  const target=board.querySelector('[data-square="'+move.to+'"]');
  if(target){
   target.classList.add('classic-square--legal');
   if(move.capture)target.classList.add('classic-square--capture');
  }
 }
}
function refreshBoard(){
 const b=root.querySelector('[data-tour-board]');if(!b||!chess)return;
 applyRaceBoardTheme(b,matchState?.players?.find(p=>p.color==='w')?.race||'humans');
 // Keep original pointer targets alive through drag and keep the pin-ice
 // overlays stable between unchanged 2.4-second server snapshots.
 const boardKey=chess.fen()+'|'+(selectedSquare||'');
 if(!dragActive&&b.dataset.renderKey!==boardKey){
  b.innerHTML=boardMarkup();
  applyPinIce(b,chess.snapshot());
  b.dataset.renderKey=boardKey;
 }
 const journal=root.querySelector('[data-tour-history]');
 if(journal)journal.textContent=matchState.moves.map((m,i)=> (i+1)+'. '+m.from+'–'+m.to).join('  ');
 const turn=root.querySelector('[data-tour-turn]');
 if(turn)turn.textContent=shadowGame?
   (chess.turn()==='w'?identity().name:(lang()==='ru'?'Тень ':'Shadow ')+identity().name)+' · '+t('shadowTurn'):
   chess.turn()===matchState.playerColor?t('yourTurn'):t('theirTurn');
 updateClocks();
}
function updateClocks(){
 for(const node of root.querySelectorAll('[data-tour-clock]')){
  const color=node.dataset.tourClock;node.textContent=clock(timeLeft(color));
  node.classList.toggle('is-running',matchState?.turn===color&&matchState.status==='playing');
  node.classList.toggle('is-urgent',timeLeft(color)<30000);
 }
}
async function syncMatch(){
 if(!live?.matchId||!session)return;
 const expectedMatch=live.matchId;
 try{
  const response=await call('/v1/match/'+encodeURIComponent(expectedMatch)+'/snapshot',{});
  // A delayed old-match response must not replace a fresh matchmaking screen.
  if(live?.matchId!==expectedMatch||(page!=='match'&&page!=='result'))return;
  const flight=geometryForServerMove(response);
  if(flight){stopTournamentFlight();pendingFlight=flight;}
  else if(matchState&&response.moves?.length!==matchState.moves?.length)stopTournamentFlight();
  matchState=response;lastSnapshotAt=Date.now();
  chess=new ClassicChessEngine();
  for(const mv of response.moves){const result=chess.move(mv.from,mv.to,mv.promotion||null);if(!result.ok)throw Error('Invalid server history');}
  if(response.status==='finished'){
   // Only a server-confirmed terminal game can change shared Journey Power.
   // The deterministic match+color receipt prevents double Elo on reconnect.
   const rating=response.rating;
   if(response.rated&&!rating){
    message=lang()==='ru'?'Сервер сохраняет рейтинг…':'Saving the server rating…';
    const tag=root.querySelector('[data-tour-turn]');if(tag)tag.textContent=message;
    return; // Retry receipt next snapshot, never silently lose a rated result.
   }
   if(rating){
    const expected='tournament:'+response.matchId+':'+response.playerColor;
    const opponent=response.players.find(p=>p.color!==response.playerColor);
    const self=response.players.find(p=>p.color===response.playerColor);
    const score=response.result?.winner==null?0.5:response.result.winner===response.playerColor?1:0;
    if(!response.rated||rating.id!==expected||!opponent||!self||
      rating.opponentElo!==opponent.power||
      rating.result!==score||rating.after!==Math.max(0,rating.before+ratingDelta(rating.before,rating.opponentElo,score))||
      rating.delta!==rating.after-rating.before)
     throw Error('Invalid server rating receipt');
    importTournamentRatingReceipt(rating);
    ratedReceipt=rating;
    tournamentProfile={ranked:true,power:rating.after};
   }
   stopMatch();page='result';render();return;
  }
  page='match';render();
  if(flight)startTournamentFlight(flight);
 }catch(err){
  if(live?.matchId!==expectedMatch||(page!=='match'&&page!=='result'))return;
  message=err.message;const tag=root.querySelector('[data-tour-turn]');if(tag)tag.textContent=message;
 }
}
function stopMatch(){dragActive=false;stopTournamentFlight();if(matchJob){clearInterval(matchJob);matchJob=null;}}
async function sendMove(from,to,promotion=null){
 if(busyMove||!chess||!matchState||(!shadowGame&&chess.turn()!==matchState.playerColor))return;
 const choices=chess.promotionChoices(from,to);
 const promoted=choices.length?(promotion||'q'):null;
 if(shadowGame){
  const applied=shadowGame.move(from,to,promoted);
  if(applied.ok){selectedSquare=null;saveShadowGame(platform.storage.local,shadowGame);syncShadow();}
  else if(applied.reason==='finished')syncShadow();
  return;
 }
 busyMove=true;
 try{
  await call('/v1/match/'+encodeURIComponent(live.matchId)+'/move',{from,to,promotion:promoted});
  selectedSquare=null;await syncMatch();
 }catch(err){message=err.message;await syncMatch();}finally{busyMove=false;}
}
async function matchAction(action){
 if(shadowGame){
  if(action==='resign')shadowGame.resign();
  else if(action==='draw')shadowGame.draw();
  syncShadow();return;
 }
 if(!live?.matchId)return;
 try{const result=await call('/v1/match/'+encodeURIComponent(live.matchId)+'/'+action,{});matchState=result;lastSnapshotAt=Date.now();await syncMatch();}
 catch(err){message=err.message;const tag=root.querySelector('[data-tour-turn]');if(tag)tag.textContent=message;}
}

function visible(active){
 tabVisible=active;root.hidden=!active;menu.hidden=active;
 document.body.classList.toggle('tournament-active',active);
 if(!active){root.classList.remove('tournament-screen--match');document.body.classList.remove('tournament-battle-active');}
 if(active){window.scrollTo(0,0);render();}
}
function open(){
 shadowGame=null;chosenMode='online';shadowClock='unlimited';
 squad=arena().owned.has(saved().squad)?saved().squad:'humans';
 page='setup';message='';visible(true);
 const serial=++resumeSerial;
 // Recover the server match after a full page/WebView restart, including a
 // completed game's single Power receipt. Stale requests must not override UI.
 if(API)void (async()=>{
  try{
   await connect();
   if(!tabVisible||page!=='setup'||serial!==resumeSerial)return;
   const match=await call('/v1/queue/status',{});
   if(tabVisible&&page==='setup'&&serial===resumeSerial&&match.status==='matched')
    await openMatch(match);
  }catch{ /* Offline state still allows opening Tournament setup. */ }
 })();
}
function leave(){if(shadowGame)saveShadowGame(platform.storage.local,shadowGame);shadowGame=null;resumeSerial++;if(page==='search')void cancelQueue();if(page==='invite')void cancelRoom();stopPolling();stopMatch();visible(false);}
function stopPolling(){if(searchJob){clearInterval(searchJob);searchJob=null;}}
function endpoint(path){return API.replace(/\/$/,'')+path;}
async function call(path,data){
 if(!API)throw Error(t('offline'));
 const headers={'Content-Type':'application/json'};
 if(session?.token)headers.Authorization='Bearer '+session.token;
 const response=await fetch(endpoint(path),{method:'POST',headers,body:JSON.stringify(data||{})});
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(json.error||t('error'));
 return json;
}
async function connect({refreshPower=false}={}){
 // An automatic resume and a quick Invite/Search click may race. Reuse one
 // in-flight session to avoid accidentally creating different guest IDs.
 if(connectJob)return connectJob;
 if(session&&!refreshPower)return session;
 connectJob=(async()=>{
  const previous=session?.token||platform.storage.local?.getItem('rpchess.reboot.v1.tournament-session')||'';
  let profileCredential;
  if(platform.profileEnabled){
    await globalThis.RPChessCloudReady;
    const profile=await import('./profile-client.mjs');
    profileCredential=profile.tournamentCredential();
    if(!profileCredential)throw Error(lang()==='ru'
      ? 'Профиль RPChess пока не подтверждён'
      : 'RPChess profile is not authenticated yet');
  }
  // The existing VK/GamePush launch still uses the legacy local profile
  // namespace. Send only cosmetic identity for that mode; the verified
  // RPChess ID binding takes precedence whenever profile mode is enabled.
  const local=identity();
  const obtained=await call('/v1/session',{
    previous,nick:local.name,commanderId:local.commanderId,
    displayPower:local.power,power:readPlayerRating().power,
    launch:location.search.slice(1),
    ...(profileCredential?{profileCredential}:{})
  });
  if(!obtained.token)throw Error('No tournament session');
  session=obtained;platform.storage.local?.setItem('rpchess.reboot.v1.tournament-session',session.token);
  tournamentProfile=await call('/v1/profile',{});
  if(page==='setup')render();
  return session;
 })();
 try{return await connectJob;}finally{connectJob=null;}
}
async function beginSearch(){
 shadowGame=null;
 if(!API){message=t('offline');page='setup';render();return;}
 // A previous completed match must not keep polling and redraw its Victory
 // screen over the next search (the old interval ran every 2.4 seconds).
 stopMatch();stopPolling();
 live=null;matchState=null;chess=null;selectedSquare=null;matchRendered=false;ratedReceipt=null;
 queueSince=Date.now();page='search';message=t('searchPending');render();
 try{
  await connect({refreshPower:true});
  if(page!=='search')return; // user may have cancelled during authentication
  const res=await call('/v1/queue/join',{squad,power:readPlayerRating().power,newSearch:true,lossStreak:0});
  if(page!=='search')return;
  if(res.status==='matched'){void openMatch(res);return;}
  searchJob=setInterval(()=>{void pollQueue();},2400);
 }catch(err){if(page==='search'){page='setup';message=err.message;render();}}
}
async function pollQueue(){
 if(page!=='search')return;
 try{
  const res=await call('/v1/queue/status',{});
  if(page!=='search')return;
  if(res.status==='matched'){void openMatch(res);return;}
  if(res.status==='not_queued'){
   // Seek expired or lost connectivity. Re-enter rather than waiting forever.
   void beginSearch();return;
  }
  if(Date.now()-queueSince>45000)message=t('noMatch');
  render();
 }catch(err){message=err.message;render();}
}
async function openMatch(response){
 shadowGame=null;
 stopPolling();stopMatch();live=response;page='match';message='';selectedSquare=null;matchRendered=false;ratedReceipt=null;
 await syncMatch();
 // A finished game never receives another polling interval. Otherwise the
 // timer continues and overwrites the next search with its old result.
 if(page==='match'&&live?.matchId===response.matchId)
  matchJob=setInterval(()=>{void syncMatch();},2400);
}
function syncShadow(){
 if(!shadowGame||!tabVisible)return;
 matchState=shadowGame.tick();chess=shadowGame.chess;lastSnapshotAt=Date.now();
 // An active clock is reconstructed from the original wall-clock anchor.
 // Avoid rewriting localStorage four times per second just to paint digits.
 if(matchState.status==='finished'){
  saveShadowGame(platform.storage.local,shadowGame);
  stopMatch();page='result';render();return;
 }
 if(page==='match'){
  if(!matchRendered)render();else refreshBoard();
 }
}
function startShadow({resume=false}={}){
 stopMatch();stopPolling();
 // No network request, cloud save, rating receipt or online Tournament match.
 live=null;selectedSquare=null;matchRendered=false;busyMove=false;ratedReceipt=null;
 const owner=identity();
 const saved=resume?loadShadowGame(platform.storage.local):null;
 shadowGame=saved||new LocalShadowGame({mode:shadowClock,name:owner.name,
   commanderId:owner.commanderId,power:owner.power,race:squad});
 if(!saved)saveShadowGame(platform.storage.local,shadowGame);
 else shadowClock=saved.mode;
 page='match';message='';matchState=null;chess=shadowGame.chess;
 syncShadow();
 if(page==='match')matchJob=setInterval(syncShadow,250);
}
async function cancelQueue(){stopPolling();if(session&&API)await call('/v1/queue/cancel',{}).catch(()=>{});}
async function cancelRoom(){stopPolling();if(session&&API&&roomCode)await call('/v1/room/cancel',{code:roomCode}).catch(()=>{});}
async function makeRoom(){
 if(!API){message=t('offline');render();return;}
 try{await connect({refreshPower:true});const response=await call('/v1/room/create',{squad,power:readPlayerRating().power});roomCode=response.code;page='invite';message='';render();stopPolling();searchJob=setInterval(async()=>{if(page!=='invite')return;try{const status=await call('/v1/room/status',{code:roomCode});if(status.status==='matched')openMatch(status);}catch(e){message=e.message;render();}},2400);}
 catch(err){message=err.message;render();}
}
async function joinRoom(){
 const code=root.querySelector('[data-tour-code]')?.value.trim().toUpperCase()||roomCode;
 if(!/^[A-Z0-9-]{4,12}$/.test(code)){message=t('entry');render();return;}
 try{await connect({refreshPower:true});const res=await call('/v1/room/join',{code,squad,power:readPlayerRating().power});if(res.status==='matched')openMatch(res);else{message=res.error||t('waitFriend');render();}}
 catch(err){message=err.message;render();}
}
button?.addEventListener('click',()=>{open();void Promise.resolve(globalThis.RPChessCloudReady).then(()=>{if(page==='setup')render();}).catch(()=>{});});
root.addEventListener('click',event=>{
 const square=event.target.closest('[data-tour-board] [data-square]');
 if(square&&chess&&matchState?.status==='playing'&&!pendingFlight){
  const clicked=square.dataset.square,own=chess.pieceAt(clicked)?.color===matchState.playerColor;
  if(!shadowGame&&chess.turn()!==matchState.playerColor)return;
  if(selectedSquare&&chess.legalMoves(selectedSquare).some(m=>m.to===clicked)){void sendMove(selectedSquare,clicked);return;}
  selectedSquare=(shadowGame?chess.pieceAt(clicked)?.color===chess.turn():own)?clicked:null;refreshBoard();return;
 }
 const modeButton=event.target.closest('[data-tour-mode]');
 if(modeButton){chosenMode=modeButton.dataset.tourMode==='shadow'?'shadow':'online';render();return;}
 const clockButton=event.target.closest('[data-shadow-clock]');
 if(clockButton){shadowClock=clockButton.dataset.shadowClock==='10+0'?'10+0':'unlimited';render();return;}
 const squadButton=event.target.closest('[data-tour-squad]');
 if(squadButton){squad=squadButton.dataset.tourSquad;remember();render();return;}
 const btn=event.target.closest('[data-tour-action]');if(!btn)return;
 const a=btn.dataset.tourAction;
 if(a==='back'||a==='cancel'){if(page==='setup'){leave();return;}if(page==='match'){if(shadowGame)saveShadowGame(platform.storage.local,shadowGame);stopMatch();shadowGame=null;page='setup';message='';render();return;}if(page==='search')void cancelQueue();if(page==='invite')void cancelRoom();stopPolling();page='setup';message='';render();return;}
 if(a==='review'){
  if(page!=='result'||matchState?.status!=='finished'||!Array.isArray(matchState.moves))return;
  const sides=Object.fromEntries(matchState.players.map(player=>[player.color,player.race]));
  openFinishedGameReview({mode:'tournament',finished:true,moves:matchState.moves,
   playerColor:matchState.playerColor,sides,lang:lang()});
  return;
 }
 if(a==='panel'){
  const panel=root.querySelector('#tournament-tools');
  if(panel){panel.hidden=!panel.hidden;btn.setAttribute('aria-expanded',String(!panel.hidden));}
  return;
 }
 if(a==='settings'){globalThis.RPChessOpenSettings?.();return;}
 if(a==='menu'){leave();return;}
 if(a==='shadow-start'){startShadow();return;}
 if(a==='shadow-resume'){startShadow({resume:true});return;}
 if(a==='search'||a==='again'){
  if(shadowGame&&a==='again'){startShadow();return;}
  void beginSearch();return;
 }
 if(a==='offer-draw'||a==='resign'){void matchAction(a==='offer-draw'?'draw':'resign');return;}
 if(a==='invite'){void makeRoom();return;}
 if(a==='join-screen'){page='join';message='';render();return;}
 if(a==='join-submit'){void joinRoom();return;}
 if(a==='arena'){void cancelQueue();leave();document.querySelector('[data-arena-open]')?.click();return;}
 if(a==='copy-code')void navigator.clipboard?.writeText(roomCode);
 if(a==='copy-link')void navigator.clipboard?.writeText(new URL('?tournament_room='+encodeURIComponent(roomCode),location.href).href);
});
addEventListener('pagehide',()=>{if(shadowGame)saveShadowGame(platform.storage.local,shadowGame);});
addEventListener('rpchess:arena-updated',()=>{if(page==='setup')render();});
subscribe(()=>{if(button)button.textContent=t('title');render();});
const incoming=new URLSearchParams(location.search).get('tournament_room');
if(incoming&&/^[a-zA-Z0-9-]{4,12}$/.test(incoming)){
 addEventListener('load',()=>{roomCode=incoming.toUpperCase();open();page='join';render();},{once:true});
}
addEventListener('keydown',event=>{
 if(event.key!=='Escape'||!tabVisible||page!=='match')return;
 const panel=root.querySelector('#tournament-tools');
 if(panel&&!panel.hidden){panel.hidden=true;root.querySelector('[data-tour-action="panel"]')?.setAttribute('aria-expanded','false');}
});
globalThis.RPChessTournament={enter:open,close:leave,get page(){return page;},get apiConfigured(){return Boolean(API);}};
