/* Tournament MVP: first production-integrated screen.
   Real matchmaking is enabled only after a verified tournament API is configured.
   This UI never creates fictitious opponents, receipts or ranked results. */
import { arenaSummary, normalizeArena, ARENA_KEY, SHARD_ICON } from './arena-core.mjs';
import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { attachPieceDrag } from './piece-drag.mjs';
import { RACE_TAGS, RACE_LABELS, racePiecePath } from './race-assets.mjs';
import { readPlayerRating } from './player-rating.mjs';
import { currentLanguage, subscribe } from './i18n.mjs';
import { platform } from './platform.mjs';

const root=document.createElement('main');
root.className='tournament-screen';
root.setAttribute('data-tournament-screen','');
root.hidden=true;
document.querySelector('#app')?.append(root);
const menu=document.querySelector('[data-reboot-foundation]');
const button=document.querySelector('[data-tournament-open]');
const STORAGE_KEY='rpchess.reboot.v1.tournament-ui';
const API=document.querySelector('meta[name="rpchess-tournament-api"]')?.content?.trim()||'';
const EN=['Humans','Elves','Orcs','Undead','Dark elves','Dwarves','Demons','Angels','Dragonkin','Beastfolk','Constructs','Animals','Fae','Goblins'];
const words={
 ru:{title:'Турнир',back:'Главное меню',subtitle:'Шахматный бой с настоящим соперником',clock:'Классика · 10 минут',clockNote:'По 10 минут каждому игроку, без добавления секунд',squad:'Ваш отряд',pick:'Выберите доступный скин, купленный на Арене',power:'Мощь',shards:'Осколки чести',find:'Найти соперника',invite:'Пригласить друга',join:'Войти по коду',owned:'Открыт',locked:'Не куплен',search:'Поиск соперника',searchHint:'Подбираем живого игрока по Мощи',cancel:'Отменить поиск',bot:'Сыграть с ИИ на Арене',offline:'Сервер Турнира ещё не подключён. PvP станет доступен после отдельной серверной приёмки.',searchPending:'Ожидание соперника',wait:'В поиске',noMatch:'Соперник пока не найден. Можно продолжить поиск или сыграть с ИИ на Арене.',continue:'Продолжить поиск',waitFriend:'Ожидание друга',room:'Код комнаты',copy:'Копировать код',link:'Копировать ссылку',private:'Приватная партия · 10+0',entry:'Введите код приглашения',enter:'Присоединиться',closeRoom:'Отменить комнату',match:'Матч',you:'Вы',opponent:'Противник',draw:'Предложить ничью',resign:'Сдаться',leave:'К Турниру',yourTurn:'Ваш ход',theirTurn:'Ход соперника',connection:'Соединение',result:'Результат',again:'Найти ещё соперника',notice:'Это реальный PvP: бот никогда не выдаётся за человека.',loading:'Подключение…',error:'Ошибка соединения',needServer:'Онлайн-матчи пока недоступны',newInvite:'Создать комнату'},
 en:{title:'Tournament',back:'Main menu',subtitle:'Real chess against another player',clock:'Classic · 10 minutes',clockNote:'10 minutes per player, no increment',squad:'Your squad',pick:'Choose an Arena squad you own',power:'Power',shards:'Honor shards',find:'Find opponent',invite:'Invite a friend',join:'Join by code',owned:'Owned',locked:'Locked',search:'Matchmaking',searchHint:'Looking for a real player near your power',cancel:'Cancel search',bot:'Play AI in Arena',offline:'Tournament server is not connected yet. PvP goes live after separate server testing.',searchPending:'Waiting for opponent',wait:'Searching',noMatch:'No opponent found yet. Continue searching or play Arena AI.',continue:'Keep searching',waitFriend:'Waiting for friend',room:'Room code',copy:'Copy code',link:'Copy invite URL',private:'Private game · 10+0',entry:'Enter invite code',enter:'Join',closeRoom:'Close room',match:'Match',you:'You',opponent:'Opponent',draw:'Offer draw',resign:'Resign',leave:'Tournament',yourTurn:'Your move',theirTurn:"Opponent's move",connection:'Connection',result:'Result',again:'Find another player',notice:'Real PvP only: AI is never disguised as a human.',loading:'Connecting…',error:'Connection error',needServer:'Online unavailable',newInvite:'Create room'}
};
let page='setup',squad='humans',queueSince=0,searchJob=null,session=null,live=null,roomCode='',message='',tabVisible=false;
let lastSearch=0;
let matchState=null,chess=null,selectedSquare=null,matchJob=null,matchRendered=false,lastSnapshotAt=0,busyMove=false;
const ROLE={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
function lang(){return currentLanguage()==='en'?'en':'ru';}
function t(key){return words[lang()][key]||key;}
function esc(text){return String(text??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function arena(){try{return arenaSummary(normalizeArena(JSON.parse(platform.storage.local?.getItem(ARENA_KEY)||'null')));}catch{return {owned:new Set(['humans']),balance:0};}}
function saved(){try{return JSON.parse(platform.storage.local?.getItem(STORAGE_KEY)||'{}');}catch{return {};}}
function remember(){platform.storage.local?.setItem(STORAGE_KEY,JSON.stringify({squad}));}
function raceLabel(r){return lang()==='en'?EN[RACE_TAGS.indexOf(r)]||r:RACE_LABELS[r]||r;}
function head(){return '<header class="tournament-header"><div><small>♛ RPChess · PvP</small><h1>'+t('title')+'</h1></div><button type="button" class="classic-mini-button" data-tour-action="back">'+t('back')+'</button></header>';}
function stats(){const a=arena(),power=readPlayerRating().power;return '<div class="tournament-stats"><span>'+t('power')+': <b>'+power+'</b></span><span><img src="'+SHARD_ICON+'" alt="">'+t('shards')+': <b>'+a.balance+'</b></span></div>';}
function action(name,label,extra=''){return '<button type="button" class="reboot-button reboot-button--primary" data-tour-action="'+name+'" '+extra+'>'+label+'</button>';}
function notice(text){return '<p class="tournament-notice" role="status">'+esc(text||'')+'</p>';}
function setup(){
 const owned=arena().owned;
 if(!owned.has(squad))squad='humans';
 const choices=RACE_TAGS.map(r=>{const available=owned.has(r);return '<button type="button" data-tour-squad="'+r+'" class="tournament-squad'+(r===squad?' is-selected':'')+(available?'':' is-locked')+'" '+(available?'':'disabled')+' aria-pressed="'+(r===squad)+'"><img src="'+racePiecePath(r,'king','w')+'" alt=""><strong>'+esc(raceLabel(r))+'</strong><small>'+(available?t('owned'):'🔒 '+t('locked'))+'</small></button>';}).join('');
 return '<section class="tournament-layout"><div class="tournament-card tournament-mode"><small>10+0</small><h2>'+t('clock')+'</h2><p>'+t('clockNote')+'</p></div><div class="tournament-card"><h2>'+t('squad')+'</h2><p class="tournament-muted">'+t('pick')+'</p><div class="tournament-squads">'+choices+'</div></div>'+stats()+'<div class="tournament-actions">'+action('search',t('find'))+action('invite',t('invite'))+action('join-screen',t('join'))+'</div>'+notice(API?t('notice'):t('offline'))+'</section>';
}
function search(){
 const sec=Math.floor((Date.now()-queueSince)/1000);
 return '<section class="tournament-card tournament-center"><div class="tournament-spinner">♞</div><h2>'+t('search')+'</h2><p>'+t('searchHint')+'</p><strong>'+Math.floor(sec/60).toString().padStart(2,'0')+':'+(sec%60).toString().padStart(2,'0')+'</strong><div class="tournament-actions">'+action('cancel',t('cancel'))+action('arena',t('bot'))+'</div>'+notice(message||t('noMatch'))+'</section>';
}
function invite(){return '<section class="tournament-card tournament-center"><h2>'+t('waitFriend')+'</h2><p>'+t('private')+'</p><div class="tournament-room-code">'+esc(roomCode||'—')+'</div><div class="tournament-actions">'+action('copy-code',t('copy'))+action('copy-link',t('link'))+action('cancel',t('closeRoom'))+'</div>'+notice(message)+'</section>';}
function joining(){return '<section class="tournament-card tournament-center"><h2>'+t('join')+'</h2><p>'+t('entry')+'</p><input class="tournament-code-input" data-tour-code maxlength="12" autocomplete="off" placeholder="AB12CD" value="'+esc(roomCode)+'"><div class="tournament-actions">'+action('join-submit',t('enter'))+action('cancel',t('leave'))+'</div>'+notice(message)+'</section>';}
function render(){
 if(!tabVisible)return;
 if(page==='match'&&matchState){showBattle();return;}
 if(page==='result'&&matchState){root.innerHTML=head()+resultView();return;}
 matchRendered=false;
 root.innerHTML=head()+(page==='setup'?setup():page==='search'?search():page==='invite'?invite():page==='join'?joining():notice(message));
}
function boardMarkup(){
 if(!chess||!matchState)return '';
 const snapshot=chess.snapshot();
 const reverse=matchState.playerColor==='b';
 const legal=selectedSquare?chess.legalMoves(selectedSquare).map(m=>m.to):[];
 let output='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const rank=reverse?y:7-y, file=reverse?7-x:x,idx=rank*8+file;
  const sq='abcdefgh'[file]+(rank+1),piece=snapshot.board[idx];
  const light=(rank+file)%2!==0;
  const img=piece?'<img class="classic-piece" draggable="false" alt="" src="'+racePiecePath(matchState.players.find(p=>p.color===piece.color)?.race||'humans',ROLE[piece.type],piece.color)+'">':'';
  const mark=legal.includes(sq)?'<span class="tournament-legal"></span>':'';
  output+='<button type="button" class="classic-square '+(light?'classic-square--light':'classic-square--dark')+(selectedSquare===sq?' is-selected':'')+'" data-square="'+sq+'" aria-label="'+sq+'">'+img+mark+'</button>';
 }
 return output;
}
function timeLeft(color){
 if(!matchState)return 0;
 const base=Number(matchState.remaining?.[color]||0);
 const elapsed=matchState.status==='playing'&&matchState.turn===color?Math.max(0,Date.now()-lastSnapshotAt):0;
 return Math.max(0,base-elapsed);
}
function clock(ms){const sec=Math.ceil(Math.max(0,ms)/1000);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
function resultView(){
 const outcome=matchState.result;
 const win=outcome?.winner===matchState.playerColor,draw=!outcome?.winner;
 const title=lang()==='ru'?(draw?'Ничья':win?'Победа!':'Поражение'):(draw?'Draw':win?'Victory!':'Defeat');
 return '<section class="tournament-card tournament-center"><h2>'+title+'</h2><p>'+esc(outcome?.kind||'')+'</p><p class="tournament-muted">'+(lang()==='ru'?'Матч завершён на сервере. Награды и изменение Мощи будут включены после приёмки защищённой экономики.':'Server-confirmed result. Rewards and Power updates are pending secure economy validation.')+'</p><div class="tournament-actions">'+action('again',t('again'))+action('cancel',t('leave'))+'</div></section>';
}
function showBattle(){
 if(!matchState)return;
 const my=matchState.players.find(p=>p.color===matchState.playerColor);
 const enemy=matchState.players.find(p=>p.color!==matchState.playerColor);
 if(!my||!enemy)return;
 const opponent='<div class="tournament-player"><strong>'+esc(enemy.name)+'</strong><small>'+esc(raceLabel(enemy.race))+'</small></div><span class="tournament-clock" data-tour-clock="'+enemy.color+'"></span>';
 const player='<div class="tournament-player"><strong>'+t('you')+'</strong><small>'+esc(raceLabel(my.race))+'</small></div><span class="tournament-clock" data-tour-clock="'+my.color+'"></span>';
 if(!matchRendered||!root.querySelector('[data-tour-board]')){
  root.innerHTML=head()+'<section class="tournament-match"><div class="tournament-match-layout"><div class="tournament-match-main"><div class="tournament-playerbar">'+opponent+'</div><div class="classic-board tournament-board" data-tour-board data-player-color="'+esc(matchState.playerColor)+'" role="grid" aria-label="Tournament chessboard"></div><div class="tournament-playerbar">'+player+'</div></div><aside class="tournament-card tournament-match-sidebar"><h2>'+t('match')+' · 10+0</h2><p data-tour-turn role="status"></p><div class="tournament-actions">'+action('offer-draw',t('draw'))+action('resign',t('resign'))+action('back',t('leave'))+'</div><div class="tournament-moves" data-tour-history></div></aside></div></section>';
  attachPieceDrag(root.querySelector('[data-tour-board]'),{
   canPick:square=>Boolean(chess&&matchState.status==='playing'&&chess.turn()===matchState.playerColor&&chess.pieceAt(square)?.color===matchState.playerColor&&!busyMove),
   onStart:from=>{selectedSquare=from;refreshBoard();},
   onDrop:(from,to)=>{if(to)void sendMove(from,to);}
  });
  matchRendered=true;
 }
 refreshBoard();
}
function refreshBoard(){
 const b=root.querySelector('[data-tour-board]');if(!b||!chess)return;
 b.innerHTML=boardMarkup();
 const journal=root.querySelector('[data-tour-history]');
 if(journal)journal.textContent=matchState.moves.map((m,i)=> (i+1)+'. '+m.from+'–'+m.to).join('  ');
 const turn=root.querySelector('[data-tour-turn]');
 if(turn)turn.textContent=chess.turn()===matchState.playerColor?t('yourTurn'):t('theirTurn');
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
  matchState=response;lastSnapshotAt=Date.now();
  chess=new ClassicChessEngine();
  for(const mv of response.moves){const result=chess.move(mv.from,mv.to,mv.promotion||null);if(!result.ok)throw Error('Invalid server history');}
  if(response.status==='finished'){stopMatch();page='result';render();return;}
  page='match';render();
 }catch(err){
  if(live?.matchId!==expectedMatch||(page!=='match'&&page!=='result'))return;
  message=err.message;const tag=root.querySelector('[data-tour-turn]');if(tag)tag.textContent=message;
 }
}
function stopMatch(){if(matchJob){clearInterval(matchJob);matchJob=null;}}
async function sendMove(from,to,promotion=null){
 if(busyMove||!chess||!matchState||chess.turn()!==matchState.playerColor)return;
 const choices=chess.promotionChoices(from,to);
 const promoted=choices.length?(promotion||'q'):null;
 busyMove=true;
 try{
  const result=await call('/v1/match/'+encodeURIComponent(live.matchId)+'/move',{from,to,promotion:promoted});
  selectedSquare=null;matchState=result;lastSnapshotAt=Date.now();await syncMatch();
 }catch(err){message=err.message;await syncMatch();}finally{busyMove=false;}
}
async function matchAction(action){
 if(!live?.matchId)return;
 try{const result=await call('/v1/match/'+encodeURIComponent(live.matchId)+'/'+action,{});matchState=result;lastSnapshotAt=Date.now();await syncMatch();}
 catch(err){message=err.message;const tag=root.querySelector('[data-tour-turn]');if(tag)tag.textContent=message;}
}

function visible(active){tabVisible=active;root.hidden=!active;menu.hidden=active;document.body.classList.toggle('tournament-active',active);if(active){window.scrollTo(0,0);render();}}
function open(){squad=arena().owned.has(saved().squad)?saved().squad:'humans';page='setup';message='';visible(true);}
function leave(){if(page==='search')void cancelQueue();if(page==='invite')void cancelRoom();stopPolling();stopMatch();visible(false);}
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
async function connect(){
 if(session)return session;
 const previous=platform.storage.local?.getItem('rpchess.reboot.v1.tournament-session')||'';
 const obtained=await call('/v1/session',{previous,nick:'Guest',power:readPlayerRating().power,launch:location.search.slice(1)});
 if(!obtained.token)throw Error('No tournament session');
 session=obtained;platform.storage.local?.setItem('rpchess.reboot.v1.tournament-session',session.token);
 return session;
}
async function beginSearch(){
 if(!API){message=t('offline');page='setup';render();return;}
 // A previous completed match must not keep polling and redraw its Victory
 // screen over the next search (the old interval ran every 2.4 seconds).
 stopMatch();stopPolling();
 live=null;matchState=null;chess=null;selectedSquare=null;matchRendered=false;
 queueSince=Date.now();page='search';message=t('searchPending');render();
 try{
  await connect();
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
 stopPolling();stopMatch();live=response;page='match';message='';selectedSquare=null;matchRendered=false;
 await syncMatch();
 // A finished game never receives another polling interval. Otherwise the
 // timer continues and overwrites the next search with its old result.
 if(page==='match'&&live?.matchId===response.matchId)
  matchJob=setInterval(()=>{void syncMatch();},2400);
}
async function cancelQueue(){stopPolling();if(session&&API)await call('/v1/queue/cancel',{}).catch(()=>{});}
async function cancelRoom(){stopPolling();if(session&&API&&roomCode)await call('/v1/room/cancel',{code:roomCode}).catch(()=>{});}
async function makeRoom(){
 if(!API){message=t('offline');render();return;}
 try{await connect();const response=await call('/v1/room/create',{squad,power:readPlayerRating().power});roomCode=response.code;page='invite';message='';render();stopPolling();searchJob=setInterval(async()=>{if(page!=='invite')return;try{const status=await call('/v1/room/status',{code:roomCode});if(status.status==='matched')openMatch(status);}catch(e){message=e.message;render();}},2400);}
 catch(err){message=err.message;render();}
}
async function joinRoom(){
 const code=root.querySelector('[data-tour-code]')?.value.trim().toUpperCase()||roomCode;
 if(!/^[A-Z0-9-]{4,12}$/.test(code)){message=t('entry');render();return;}
 try{await connect();const res=await call('/v1/room/join',{code,squad,power:readPlayerRating().power});if(res.status==='matched')openMatch(res);else{message=res.error||t('waitFriend');render();}}
 catch(err){message=err.message;render();}
}
button?.addEventListener('click',()=>{open();void Promise.resolve(globalThis.RPChessCloudReady).then(()=>{if(page==='setup')render();}).catch(()=>{});});
root.addEventListener('click',event=>{
 const square=event.target.closest('[data-tour-board] [data-square]');
 if(square&&chess&&matchState?.status==='playing'){
  const clicked=square.dataset.square,own=chess.pieceAt(clicked)?.color===matchState.playerColor;
  if(chess.turn()!==matchState.playerColor)return;
  if(selectedSquare&&chess.legalMoves(selectedSquare).some(m=>m.to===clicked)){void sendMove(selectedSquare,clicked);return;}
  selectedSquare=own?clicked:null;refreshBoard();return;
 }
 const squadButton=event.target.closest('[data-tour-squad]');
 if(squadButton){squad=squadButton.dataset.tourSquad;remember();render();return;}
 const btn=event.target.closest('[data-tour-action]');if(!btn)return;
 const a=btn.dataset.tourAction;
 if(a==='back'||a==='cancel'){if(page==='setup'){leave();return;}if(page==='match'){stopMatch();page='setup';message='';render();return;}if(page==='search')void cancelQueue();if(page==='invite')void cancelRoom();stopPolling();page='setup';message='';render();return;}
 if(a==='search'||a==='again'){void beginSearch();return;}
 if(a==='offer-draw'||a==='resign'){void matchAction(a==='offer-draw'?'draw':'resign');return;}
 if(a==='invite'){void makeRoom();return;}
 if(a==='join-screen'){page='join';message='';render();return;}
 if(a==='join-submit'){void joinRoom();return;}
 if(a==='arena'){void cancelQueue();leave();document.querySelector('[data-arena-open]')?.click();return;}
 if(a==='copy-code')void navigator.clipboard?.writeText(roomCode);
 if(a==='copy-link')void navigator.clipboard?.writeText(new URL('?tournament_room='+encodeURIComponent(roomCode),location.href).href);
});
addEventListener('rpchess:arena-updated',()=>{if(page==='setup')render();});
subscribe(()=>{if(button)button.textContent=t('title');render();});
const incoming=new URLSearchParams(location.search).get('tournament_room');
if(incoming&&/^[a-zA-Z0-9-]{4,12}$/.test(incoming)){
 addEventListener('load',()=>{roomCode=incoming.toUpperCase();open();page='join';render();},{once:true});
}
globalThis.RPChessTournament={enter:open,close:leave,get page(){return page;},get apiConfigured(){return Boolean(API);}};
