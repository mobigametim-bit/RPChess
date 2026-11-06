import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { ChessAIAdapter } from './chess-ai-adapter.mjs';
import { StockfishReviewEngine, reviewMoveJournal } from './finished-game-review.mjs';
import { boardRacePiecePath, racePiecePath } from './race-assets.mjs';
import { fantasyPieceMarkup } from './fantasy-piece.mjs';
import { currentLanguage, subscribe } from './i18n.mjs';
import { TRAINING_MENTORS, UCI, rebuildTraining, extendTraining, trainingMoveQuality } from './mentor-training-history.mjs';

const STORAGE_KEY='rpchess.mentor-training.v1';
const ROLES={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const SYMBOLS={w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}};
const TEXT={
 ru:{title:'Тренировка с наставником',back:'Главное меню',mentor:'Наставник',moves:'Ходы',white:'Белые',black:'Чёрные',random:'Случайно',start:'Начать тренировку',new:'Новая тренировка',exit:'К наставникам',prev:'Назад',next:'Вперёд',close:'Закрыть',journal:'Ходы',ready:'Ваш ход',thinking:'Соперник думает…',analysing:'Анализ хода…',waiting:'Оценка недоступна',fine:'Продолжайте партию.',inaccuracy:'Неточность',mistake:'Ошибка',blunder:'Зевок',noGrade:'Нет замечаний',loss:'Потеря оценки',retry:'Позиция ухудшилась. Попробуйте вернуться назад и найти более сильное продолжение.',reviewFail:'Не удалось проверить ход. Партию можно продолжать.',gameOver:'Партия завершена',check:'Шах!',promotion:'Превращение пешки',before:'Вернуться перед ошибкой',clear:'Начать заново',profile:'Мощь',restore:'Продолжить тренировку'},
 en:{title:'Training with a Mentor',back:'Main menu',mentor:'Mentor',moves:'Moves',white:'White',black:'Black',random:'Random',start:'Start training',new:'New training',exit:'Mentors',prev:'Back',next:'Forward',close:'Close',journal:'Moves',ready:'Your move',thinking:'Opponent thinking…',analysing:'Analysing move…',waiting:'Evaluation unavailable',fine:'Continue the game.',inaccuracy:'Inaccuracy',mistake:'Mistake',blunder:'Blunder',noGrade:'No issues found',loss:'Evaluation lost',retry:'This move worsened your position. Go back and try to find a stronger continuation.',reviewFail:'The move could not be evaluated. You can continue playing.',gameOver:'Game over',check:'Check!',promotion:'Promote pawn',before:'Return before error',clear:'Start over',profile:'Strength',restore:'Resume training'}
};
const RACES={
 ru:{humans:'Люди',orcs:'Орки',fae:'Феи',dark_elves:'Тёмные эльфы',dwarves:'Гномы',undead:'Нежить',demons:'Демоны',elves:'Эльфы',dragonborn:'Дракониды',angels:'Ангелы',constructs:'Конструкты'},
 en:{humans:'Humans',orcs:'Orcs',fae:'Fae',dark_elves:'Dark elves',dwarves:'Dwarves',undead:'Undead',demons:'Demons',elves:'Elves',dragonborn:'Dragonborn',angels:'Angels',constructs:'Constructs'}
};
const app=document.querySelector('#app');
const menu=document.querySelector('[data-reboot-foundation]');
let root=null,ai=null,review=null,reviewStarted=null,reviewChain=Promise.resolve();
let selected=1,color='w',playing=false,moves=[],cursor=0,square=null,promotion=null,busy=false,gameEpoch=0,journalOpen=false,analysisPending=false;
let feedbackCache=new Map(),evaluationInFlight=new Map();
function lang(){return currentLanguage()==='en'?'en':'ru';}
function t(name){return TEXT[lang()][name]||name;}
function title(mentor){return mentor[lang()];}
function race(mentor){return RACES[lang()][mentor.race]||mentor.race;}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function mentor(){return TRAINING_MENTORS[selected-1];}
function save(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,selected,color,playing,moves,cursor}));}catch{}
}
function restore(){
 try{
  const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  if(!raw||raw.version!==1||!Number.isInteger(raw.selected)||raw.selected<1||raw.selected>12)return;
  const restoredMoves=Array.isArray(raw.moves)?raw.moves.slice(0,1000):[];
  if(restoredMoves.length>1000)return;
  rebuildTraining(restoredMoves,restoredMoves.length);
  selected=raw.selected;color=['w','b','r'].includes(raw.color)?raw.color:'w';
  moves=restoredMoves;cursor=Math.max(0,Math.min(moves.length,Number(raw.cursor)||0));playing=Boolean(raw.playing);
 }catch{playing=false;moves=[];cursor=0;}
}
function game(){return rebuildTraining(moves,cursor);}
function cancel(){
 gameEpoch++;busy=false;analysisPending=false;square=null;promotion=null;
 ai?.stop();review?.close();review=null;reviewStarted=null;reviewChain=Promise.resolve();evaluationInFlight=new Map();
}
function show(open){
 if(!root)return;
 root.hidden=!open;
 if(menu)menu.hidden=open;
 document.body.classList.toggle('mentor-training-active',open);
 if(open)scrollTo(0,0);
}
function ensure(){
 if(root)return;
 const entry=document.createElement('button');
 entry.type='button';entry.className='reboot-button reboot-button--primary';
 entry.dataset.mentorOpen='';entry.textContent=t('title');
 entry.addEventListener('click',enter);
 const actions=document.querySelector('.reboot-menu-actions');
 actions?.insertBefore(entry,actions.querySelector('.reboot-menu-secondary'));
 root=document.createElement('main');root.className='mentor-training';root.dataset.mentorScreen='';root.hidden=true;
 (app||document.body).append(root);
 root.addEventListener('click',onClick);
 subscribe(()=>{entry.textContent=t('title');if(!root.hidden)render();});
 addEventListener('beforeunload',()=>{ai?.destroy();review?.close();});
}
function enter(){
 restore();
 show(true);
 if(!playing)cancel();
 render();
 if(playing)resumeAI();
}
function leave(){
 save();cancel();playing=false;
 show(false);if(root)root.innerHTML='';
}
function picture(mentor,cl=''){
 return '<img class="'+cl+'" alt="" loading="lazy" src="'+racePiecePath(mentor.race,mentor.type,'b')+'">';
}
function button(action,label,cls=''){
 return '<button type="button" class="'+cls+'" data-mentor-action="'+action+'">'+label+'</button>';
}
function setupHTML(){
 const m=mentor();
 let cards='';
 for(let group=0;group<6;group++){
  cards+='<div class="mentor-pair">';
  for(const item of TRAINING_MENTORS.slice(group*2,group*2+2)){
   cards+='<button type="button" class="mentor-choice'+(selected===item.id?' is-selected':'')+'" data-mentor-id="'+item.id+'" aria-label="'+esc(title(item)+' '+item.elo+' Elo')+'" aria-pressed="'+(selected===item.id)+'">'+picture(item,'mentor-choice-art')+
   '<span class="mentor-choice-meta"><strong>'+esc(title(item))+'</strong><small>'+esc(race(item))+'</small><b>'+item.elo+' Elo</b></span></button>';
  }
  cards+='</div>';
 }
 const colors=[['w','♔ '+t('white')],['b','♚ '+t('black')],['r',t('random')]].map(([value,label])=>'<button type="button" data-mentor-color="'+value+'" class="'+(color===value?'is-selected':'')+'">'+esc(label)+'</button>').join('');
 return '<section class="mentor-setup"><header class="mentor-top">'+
 '<h1>'+t('title')+'</h1>'+button('leave',t('back'),'mentor-small-btn')+'</header>'+
 '<div class="mentor-setup-body"><section class="mentor-selected mentor-card">'+picture(m,'mentor-selected-art')+
 '<strong class="mentor-selected-name">'+esc(title(m))+'</strong><span class="mentor-selected-level">'+esc(race(m))+' · '+m.elo+' Elo</span>'+
 '<div class="mentor-colors">'+colors+'</div>'+button('start',t('start'),'mentor-primary')+'</section>'+
 '<section class="mentor-catalog mentor-card"><div class="mentor-catalog-scroll">'+cards+'</div></section></div></section>';
}
function currentPlayerColor(){return color==='r'?'w':color;}
function startTraining(){
 cancel();moves=[];cursor=0;playing=true;journalOpen=false;
 if(color==='r')color=Math.random()<.5?'w':'b';
 ai?.destroy();ai=new ChessAIAdapter();feedbackCache.clear();
 save();render();resumeAI();
}
function getJournal(){
 let entries=[];
 try{entries=reviewMoveJournal(moves.map(item=>item.uci));}catch{}
 let rows='';
 for(let i=0;i<entries.length;i+=2){
  rows+='<div class="mentor-history-row"><span>'+(i/2+1)+'.</span>';
  for(const pos of [i,i+1]){
   const item=entries[pos],note=moves[pos];
   rows+=item?'<button type="button" data-mentor-ply="'+(pos+1)+'" class="'+(cursor===pos+1?'is-active':'')+'">'+esc(item.san)+(note?.grade?'<em class="mentor-grade mentor-grade--'+note.grade+'">'+({'inaccuracy':'?!','mistake':'?','blunder':'??'}[note.grade])+'</em>':'')+'</button>':'<i>—</i>';
  }
  rows+='</div>';
 }
 return rows||'<div class="mentor-empty">—</div>';
}
function navigation(){
 return '<div class="mentor-navigation"><button type="button" data-mentor-action="prev" '+(cursor===0?'disabled':'')+' aria-label="'+t('prev')+'">❮ '+t('prev')+'</button>'+
 '<button type="button" data-mentor-action="next" '+(cursor===moves.length?'disabled':'')+' aria-label="'+t('next')+'">'+t('next')+' ❯</button></div>';
}
function boardHTML(chess){
 const whiteBottom=currentPlayerColor()==='w',state=chess.snapshot(),files='abcdefgh',legal=square?chess.legalMoves(square):[];
 const last=moves[cursor-1],mark=last?.grade&&last.uci.slice(2,4);
 let grid='';
 for(let r=0;r<8;r++)for(let f=0;f<8;f++){
  const file=whiteBottom?f:7-f,rank=whiteBottom?7-r:r,index=rank*8+file;
  const sq=files[file]+(rank+1),piece=state.board[index],dark=(file+rank)%2===0;
  const active=selected!==null&&square===sq,possible=legal.some(m=>(m.uciTo||m.to)===sq);
  const highlight=last&&[last.uci.slice(0,2),last.uci.slice(2,4)].includes(sq);
  const ownRace=piece?.color===currentPlayerColor()?'humans':mentor().race;
  let figure='';
  if(piece){
   figure='<img alt="" class="mentor-piece" draggable="false" src="'+boardRacePiecePath(ownRace,ROLES[piece.type],piece.color)+'"><span class="mentor-piece-fallback">'+SYMBOLS[piece.color][piece.type]+'</span>'+fantasyPieceMarkup(piece.type,piece.color);
  }
  const sign=mark===sq?'<span class="mentor-square-grade">'+({'inaccuracy':'?!','mistake':'?','blunder':'??'}[last.grade])+'</span>':'';
  grid+='<button type="button" data-mentor-square="'+sq+'" class="mentor-square '+(dark?'is-dark':'is-light')+(highlight?' is-last':'')+(active?' is-selected':'')+(possible?' is-legal':'')+'" aria-label="'+sq+'">'+figure+sign+'</button>';
 }
 const status=chess.status();
 return '<div class="mentor-board-shell"><div class="mentor-board">'+grid+'</div><div class="mentor-file-coords">'+(whiteBottom?files.split(''):[...files].reverse()).map(v=>'<span>'+v+'</span>').join('')+'</div><div class="mentor-rank-coords">'+(whiteBottom?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8]).map(v=>'<span>'+v+'</span>').join('')+'</div></div>'+
 (status.over?'<div class="mentor-board-message">'+t('gameOver')+'</div>':'');
}
function latestPlayerNote(){
 for(let index=cursor-1;index>=0;index--){
  const move=moves[index];
  if(move?.color===currentPlayerColor()&&move.grade)return {move,index};
 }
 return null;
}
function feedbackHTML(){
 const found=latestPlayerNote(),data=found?.move||null;
 const mark=data?({inaccuracy:'?!',mistake:'?',blunder:'??'}[data.grade]):'';
 const label=data?t(data.grade):'';
 let copy=data?.message||'';
 if(!data&&analysisPending)copy=t('analysing');
 else if(!data&&!busy)copy=t('fine');
 return '<section class="mentor-feedback mentor-card"><div class="mentor-feedback-head">'+picture(mentor(),'mentor-face')+
 '<h2>'+t('mentor')+'</h2></div>'+
 (data?'<div class="mentor-feedback-grade"><strong>'+mark+'</strong><span>'+label+(Number.isFinite(data.loss)?' · '+data.loss+' cp':'')+'</span></div>':'')+
 '<p class="mentor-feedback-text">'+esc(copy)+'</p>'+
 (found?button('before-error',t('before'),'mentor-outline mentor-undo-error'):'')+'</section>';
}
function battleHTML(){
 const chess=game(),m=mentor(),status=chess.status();
 const notice=busy?(analysisPending?t('analysing'):t('thinking')):status.over?t('gameOver'):status.checked?t('check'):t('ready');
 return '<section class="mentor-battle"><header class="mentor-battle-top"><h1>'+t('title')+'</h1>'+
 '<div class="mentor-top-actions">'+button('journal',t('journal'),'mentor-small-btn mentor-journal-toggle')+
 button('catalog',t('exit'),'mentor-small-btn')+button('leave',t('back'),'mentor-small-btn')+'</div></header>'+
 '<aside class="mentor-journal mentor-card'+(journalOpen?' is-open':'')+'"><div class="mentor-journal-head"><h2>'+t('moves')+'</h2>'+
 button('journal',t('close'),'mentor-small-btn mentor-journal-close')+'</div>'+
 '<div class="mentor-rival">'+picture(m,'mentor-rival-art')+'<div><strong>'+esc(title(m))+'</strong><small>'+m.elo+' Elo</small></div></div>'+
 '<div class="mentor-history-head"><span>№</span><span>'+t('white')+'</span><span>'+t('black')+'</span></div>'+
 '<div class="mentor-history">'+getJournal()+'</div>'+navigation()+'</aside>'+
 '<div class="mentor-center"><div class="mentor-status">'+esc(notice)+'</div>'+boardHTML(chess)+
 '<div class="mentor-mobile-navigation">'+navigation()+'</div></div>'+
 feedbackHTML()+
 (promotion?'<div class="mentor-promotion"><div class="mentor-promotion-dialog"><h2>'+t('promotion')+'</h2>'+
 ['q','r','b','n'].map(v=>'<button type="button" data-mentor-promote="'+v+'">'+SYMBOLS[currentPlayerColor()][v]+'</button>').join('')+'</div></div>':'')+
 '</section>';
}
function render(){
 if(!root||root.hidden)return;
 const list=root.querySelector('.mentor-catalog-scroll'),oldScroll=list?.scrollTop||0;
 const historyList=root.querySelector('.mentor-history'),oldHistory=historyList?.scrollTop||0;
 root.innerHTML=playing?battleHTML():setupHTML();
 if(!playing&&root.querySelector('.mentor-catalog-scroll'))root.querySelector('.mentor-catalog-scroll').scrollTop=oldScroll;
 if(playing&&root.querySelector('.mentor-history'))root.querySelector('.mentor-history').scrollTop=oldHistory;
}
function moveCursor(next){
 if(!playing||promotion)return;
 cancelPending();
 cursor=Math.max(0,Math.min(moves.length,next));
 save();render();
 // Browsing a previous move never requests a new computer response.
}
function cancelPending(){
 gameEpoch++;busy=false;analysisPending=false;square=null;promotion=null;ai?.stop();
}
async function ensureReview(){
 if(review)return reviewStarted;
 review=new StockfishReviewEngine();const self=review;
 reviewStarted=self.start().then(()=>self).catch(err=>{if(review===self){review=null;reviewStarted=null;}self.close();throw err;});
 return reviewStarted;
}
function evaluate(fen){
 if(feedbackCache.has(fen))return Promise.resolve(feedbackCache.get(fen));
 if(evaluationInFlight.has(fen))return evaluationInFlight.get(fen);
 const scheduled=reviewChain.catch(()=>{}).then(async()=>{
  const self=await ensureReview();
  const score=await self.evaluate(fen,{movetime:260});
  feedbackCache.set(fen,score);
  return score;
 });
 reviewChain=scheduled.catch(()=>{});
 evaluationInFlight.set(fen,scheduled);
 scheduled.finally(()=>{if(evaluationInFlight.get(fen)===scheduled)evaluationInFlight.delete(fen);}).catch(()=>{});
 return scheduled;
}
function preEvaluate(){
 if(playing&&currentPlayerColor()===game().turn()&&!game().status().over)void evaluate(game().fen()).catch(()=>{});
}
function resumeAI(){
 if(!playing||cursor!==moves.length||busy)return;
 const chess=game();
 if(chess.status().over)return;
 if(chess.turn()!==currentPlayerColor())void computerMove();
 else preEvaluate();
}
async function computerMove(){
 if(busy||!playing||cursor!==moves.length)return;
 const chess=game();
 if(chess.status().over||chess.turn()===currentPlayerColor())return;
 const epoch=gameEpoch;busy=true;render();
 let uci=null;
 try{
  if(!ai)ai=new ChessAIAdapter();
  uci=await ai.chooseMove({fen:chess.fen(),elo:mentor().elo,legalMoves:chess.legalMoves()});
 }catch{}
 if(epoch!==gameEpoch||!playing||cursor!==moves.length)return;
 if(!UCI.test(uci||'')){busy=false;render();return;}
 const step=extendTraining(moves,cursor,uci);
 if(step.ok){moves=step.moves;cursor=step.cursor;moves[cursor-1].color=chess.turn();save();}
 busy=false;render();preEvaluate();
}
async function userMove(from,to,promote=null){
 if(busy||!playing)return;
 const chess=game(),who=chess.turn();
 if(who!==currentPlayerColor()||chess.status().over)return;
 const movesTo=chess.legalMoves(from).filter(m=>(m.uciTo||m.to)===to);
 if(!movesTo.length)return;
 if(movesTo.some(m=>m.promotion)&&!promote){promotion={from,to};render();return;}
 const beforeFen=chess.fen(),uci=from+to+(promote||'');
 const change=extendTraining(moves,cursor,uci);
 if(!change.ok)return;
 cancelPending();
 const epoch=gameEpoch;
 moves=change.moves;cursor=change.cursor;
 moves[cursor-1].color=who;
 square=null;busy=true;analysisPending=true;save();render();
 let data=null;
 try{
  const before=await evaluate(beforeFen);
  const after=await evaluate(change.fen);
  data=trainingMoveQuality(before,after,uci);
 }catch{}
 if(epoch!==gameEpoch||!playing)return;
 if(data?.kind){
  moves[cursor-1].grade=data.kind;moves[cursor-1].loss=data.loss;
  moves[cursor-1].message=t('retry');
 }else if(data===null){
  moves[cursor-1].analysisUnavailable=true;
 }
 busy=false;analysisPending=false;save();render();
 if(cursor===moves.length&&game().status().over)return;
 // The next move is independent of a remote language model.
 resumeAI();
}
function onClick(event){
 const button=event.target.closest('button');
 if(!button||!root?.contains(button))return;
 if(button.dataset.mentorId){
  selected=Number(button.dataset.mentorId);save();render();return;
 }
 if(button.dataset.mentorColor){color=button.dataset.mentorColor;save();render();return;}
 if(button.dataset.mentorPly){moveCursor(Number(button.dataset.mentorPly));return;}
 if(button.dataset.mentorPromote&&promotion){
  const chosen=promotion;promotion=null;void userMove(chosen.from,chosen.to,button.dataset.mentorPromote);return;
 }
 if(button.dataset.mentorSquare){
  if(busy||!playing)return;
  const chess=game(),cell=button.dataset.mentorSquare;
  if(chess.turn()!==currentPlayerColor()||chess.status().over)return;
  if(square){
   if(chess.legalMoves(square).some(m=>(m.uciTo||m.to)===cell)){void userMove(square,cell);return;}
   if(square===cell){square=null;render();return;}
  }
  square=chess.pieceAt(cell)?.color===currentPlayerColor()?cell:null;render();return;
 }
 const action=button.dataset.mentorAction;
 if(action==='start')startTraining();
 if(action==='prev')moveCursor(cursor-1);
 if(action==='next')moveCursor(cursor+1);
 if(action==='journal'){journalOpen=!journalOpen;render();}
 if(action==='before-error'){const found=latestPlayerNote();if(found)moveCursor(found.index);}
 if(action==='catalog'){cancel();playing=false;save();render();}
 if(action==='leave')leave();
}
ensure();
globalThis.RPChessMentorTraining={
 enter,start:startTraining,back:()=>moveCursor(cursor-1),forward:()=>moveCursor(cursor+1),
 get state(){return {selected,color,playing,cursor,moves:moves.map(m=>({...m})),fen:playing?game().fen():null,busy};}
};
