/* Tournament MVP: first production-integrated screen.
   Real matchmaking is enabled only after a verified tournament API is configured.
   This UI never creates fictitious opponents, receipts or ranked results. */
import { arenaSummary, normalizeArena, ARENA_KEY, SHARD_ICON } from './arena-core.mjs';
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
 root.innerHTML=head()+(page==='setup'?setup():page==='search'?search():page==='invite'?invite():page==='join'?joining():notice(message));
}
function visible(active){tabVisible=active;root.hidden=!active;menu.hidden=active;document.body.classList.toggle('tournament-active',active);if(active){window.scrollTo(0,0);render();}}
function open(){squad=arena().owned.has(saved().squad)?saved().squad:'humans';page='setup';message='';visible(true);}
function leave(){if(page==='search')void cancelQueue();if(page==='invite')void cancelRoom();stopPolling();visible(false);}
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
 try{
  await connect(); queueSince=Date.now();page='search';message=t('searchPending');render();
  const res=await call('/v1/queue/join',{squad,power:readPlayerRating().power});
  if(res.status==='matched'){openMatch(res);return;}
  stopPolling();searchJob=setInterval(()=>{void pollQueue();},2400);
 }catch(err){page='setup';message=err.message;render();}
}
async function pollQueue(){
 if(page!=='search')return;
 try{
  const res=await call('/v1/queue/status',{});
  if(res.status==='matched'){openMatch(res);return;}
  if(Date.now()-queueSince>45000)message=t('noMatch');
  render();
 }catch(err){message=err.message;render();}
}
function openMatch(response){stopPolling();live=response;page='match';message='';render();}
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
button?.addEventListener('click',()=>{void Promise.resolve(globalThis.RPChessCloudReady).then(open);});
root.addEventListener('click',event=>{
 const squadButton=event.target.closest('[data-tour-squad]');
 if(squadButton){squad=squadButton.dataset.tourSquad;remember();render();return;}
 const btn=event.target.closest('[data-tour-action]');if(!btn)return;
 const a=btn.dataset.tourAction;
 if(a==='back'||a==='cancel'){if(page==='setup'){leave();return;}if(page==='search')void cancelQueue();if(page==='invite')void cancelRoom();stopPolling();page='setup';message='';render();return;}
 if(a==='search'){void beginSearch();return;}
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
