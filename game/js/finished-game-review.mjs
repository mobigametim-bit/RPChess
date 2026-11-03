/* Completed-game error review: ONLY Tournament and Arena.
 * A fresh Stockfish 18 lite worker evaluates completed chess positions.
 * Never instantiate this module from Journey or from a live PvP match.
 */
import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { racePiecePath } from './race-assets.mjs';
import { fantasyPieceMarkup } from './fantasy-piece.mjs';

const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
const MODES=new Set(['arena','tournament']);
const MAX_SAMPLED_TURNS=16;
const WORKER_URL='vendor/stockfish/stockfish-18-lite-single.js';
const ROLES={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const RU={
 title:'Разбор ошибок',subtitle:'Stockfish 18 · приблизительная оценка позиций',
 loading:'Запускаем шахматный анализ…',working:'Проверено ходов',notFound:'В проверенных ходах крупных ошибок не обнаружено.',
 noMoves:'В завершённой партии нет ходов для разбора.',
 error:'Не удалось получить достоверную оценку Stockfish. Повторите попытку позже.',
 choose:'Выберите момент, чтобы найти более сильный ход.',move:'Ход',played:'Сыграно',
 best:'Предложение движка',blunder:'Зевок',mistake:'Ошибка',inaccuracy:'Неточность',
 loss:'Потеря оценки',challenge:'Попробуйте сделать ход, который рекомендует движок.',
 retry:'Этот ход отличается от варианта движка. Попробуйте ещё — хорошие альтернативы тоже возможны.',
 correct:'Верно — вы нашли рекомендованный движком ход!',answer:'Показать подсказку',
 hide:'Скрыть подсказку',close:'Закрыть',examined:'Проанализировано позиций',
 limited:'Проверяем до 16 ходов игрока, равномерно по партии. Это не полный анализ каждого хода.',
 white:'белыми',black:'чёрными'
};
const EN={
 title:'Review mistakes',subtitle:'Stockfish 18 · approximate position evaluation',
 loading:'Starting chess analysis…',working:'Moves checked',notFound:'No major mistakes found in the checked moves.',
 noMoves:'No moves to review in this finished game.',
 error:'Stockfish could not provide a reliable evaluation. Try again later.',
 choose:'Pick a moment and try to find a stronger move.',move:'Move',played:'Played',
 best:'Engine suggestion',blunder:'Blunder',mistake:'Mistake',inaccuracy:'Inaccuracy',
 loss:'Evaluation lost',challenge:'Try the move recommended by the engine.',
 retry:'That differs from the engine line. Try again; other strong moves can exist.',
 correct:'Correct — you found the engine recommendation!',answer:'Show hint',
 hide:'Hide hint',close:'Close',examined:'Positions analysed',
 limited:'Up to 16 player turns sampled throughout the game. This is not a full move-by-move analysis.',
 white:'as White',black:'as Black'
};

function moveUci(value){
 if(typeof value==='string')return value.toLowerCase();
 if(value&&typeof value==='object')return String(value.from||'')+String(value.to||'')+String(value.promotion||'').toLowerCase();
 return '';
}
function prepareFinishedReview({mode,moves,playerColor,finished}={}){
 if(!MODES.has(mode)||finished!==true)throw new Error('Error review is allowed only for completed Tournament or Arena matches');
 if(!['w','b'].includes(playerColor)||!Array.isArray(moves)||moves.length>1000)throw new Error('Invalid completed game data');
 const engine=new ClassicChessEngine(),turns=[];
 for(let i=0;i<moves.length;i++){
  const uci=moveUci(moves[i]);
  if(!UCI.test(uci))throw new Error('Invalid UCI history');
  const fenBefore=engine.fen(),ours=engine.turn()===playerColor;
  const applied=engine.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
  if(!applied.ok)throw new Error('Corrupted game move history');
  if(ours&&!applied.status.over)turns.push({ply:i+1,uci,beforeFen:fenBefore,afterFen:engine.fen()});
 }
 return turns;
}
function sampleReviewTurns(turns,maximum=MAX_SAMPLED_TURNS){
 if(turns.length<=maximum)return turns.slice();
 return Array.from({length:maximum},(_,i)=>turns[Math.min(turns.length-1,Math.floor((i+.5)*turns.length/maximum))]);
}
function parseScore(line){
 const cp=line.match(/\bscore cp (-?\d+)/);
 if(cp)return Number(cp[1]);
 const mate=line.match(/\bscore mate (-?\d+)/);
 if(mate)return Number(mate[1])>=0?1200:-1200;
 return null;
}
function parseInfo(line){
 const depth=Number(line.match(/\bdepth (\d+)/)?.[1]||0);
 const cp=parseScore(line);
 const pv=line.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?)/i)?.[1]?.toLowerCase()||null;
 return {depth,cp,pv};
}
class StockfishReviewEngine {
 constructor({WorkerClass=globalThis.Worker,workerUrl=WORKER_URL,timeoutMs=8000}={}){
  if(typeof WorkerClass!=='function')throw new Error('Stockfish worker is unavailable');
  this.worker=new WorkerClass(workerUrl);
  this.timeoutMs=timeoutMs;this.waiters=[];this.search=null;this.closed=false;
  this.worker.onmessage=e=>{
   for(const line of String(e.data||'').split(/\r?\n/)){
    const text=line.trim();if(!text)continue;
    const waiter=this.waiters.find(w=>w.name===text);
    if(waiter){this.waiters.splice(this.waiters.indexOf(waiter),1);clearTimeout(waiter.timer);waiter.resolve();}
    const search=this.search;if(!search)continue;
    if(text.startsWith('info ')){
     const info=parseInfo(text);
     if(info.cp!==null&&info.depth>=search.depth){
      search.depth=info.depth;search.cp=info.cp;
      if(info.pv)search.bestMove=info.pv;
     }
    }else if(text.startsWith('bestmove ')){
     this.search=null;clearTimeout(search.timer);
     search.resolve({cp:search.cp,bestMove:search.bestMove,depth:search.depth});
    }
   }
  };
  this.worker.onerror=()=>this._fail(new Error('Stockfish worker failed'));
 }
 _fail(error){
  for(const w of this.waiters.splice(0)){clearTimeout(w.timer);w.reject(error);}
  if(this.search){const s=this.search;this.search=null;clearTimeout(s.timer);s.reject(error);}
 }
 _wait(name){
  return new Promise((resolve,reject)=>{
   const waiter={name,resolve,reject,timer:null};
   waiter.timer=setTimeout(()=>{this.waiters=this.waiters.filter(w=>w!==waiter);reject(new Error('Stockfish timeout'));},this.timeoutMs);
   this.waiters.push(waiter);
  });
 }
 async start(){
  const uci=this._wait('uciok');this.worker.postMessage('uci');await uci;
  this.worker.postMessage('setoption name Hash value 16');
  this.worker.postMessage('setoption name MultiPV value 1');
  this.worker.postMessage('setoption name UCI_LimitStrength value false');
  const ready=this._wait('readyok');this.worker.postMessage('isready');await ready;
 }
 async evaluate(fen){
  if(this.closed||this.search)throw new Error('Invalid review engine state');
  return await new Promise((resolve,reject)=>{
   const search={resolve,reject,depth:0,cp:null,bestMove:null,timer:null};
   search.timer=setTimeout(()=>{if(this.search===search){this.search=null;this.worker.postMessage('stop');reject(new Error('Stockfish analysis timeout'));}},this.timeoutMs);
   this.search=search;this.worker.postMessage('position fen '+fen);this.worker.postMessage('go movetime 180');
  });
 }
 close(){
  if(this.closed)return;this.closed=true;
  this._fail(new Error('Analysis closed'));
  this.worker.terminate?.();
 }
}
function classifyLoss(cp){return cp>=250?'blunder':cp>=120?'mistake':cp>=65?'inaccuracy':null;}
async function analyseFinishedReview(turns,{engine,onProgress=()=>{}}={}){
 if(!engine||typeof engine.evaluate!=='function')throw new Error('Stockfish review engine is required');
 const sampled=sampleReviewTurns(turns),errors=[];
 for(let i=0;i<sampled.length;i++){
  const turn=sampled[i];
  const before=await engine.evaluate(turn.beforeFen);
  const after=await engine.evaluate(turn.afterFen);
  const drop=(before.cp===null||after.cp===null)?null:before.cp+after.cp;
  // Stockfish reports score from side to move; after the move, the opponent
  // is to move, hence the sign reversal when comparing evaluations.
  const severity=drop===null?null:classifyLoss(drop);
  if(severity&&before.bestMove&&UCI.test(before.bestMove)&&before.bestMove!==turn.uci&&
    before.depth>=5&&after.depth>=5)
   errors.push({...turn,loss:Math.round(drop),severity,bestMove:before.bestMove});
  onProgress(i+1,sampled.length);
 }
 return errors.sort((a,b)=>b.loss-a.loss).slice(0,3).sort((a,b)=>a.ply-b.ply);
}
function esc(x){return String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function localized(lang){return lang==='en'?EN:RU;}
function chessSquareBoard(fen,color,sides,selected=''){
 const snapshot=new ClassicChessEngine(fen).snapshot(),reverse=color==='b';
 let html='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const rank=reverse?y:7-y,file=reverse?7-x:x,idx=rank*8+file;
  const sq='abcdefgh'[file]+(rank+1),piece=snapshot.board[idx],light=(rank+file)%2!==0;
  const img=piece?'<img class="classic-piece" alt="" draggable="false" src="'+racePiecePath(sides[piece.color]||'humans',ROLES[piece.type],piece.color)+'">':'';
  const symbol=piece?'<span class="rpchess-piece-symbol" aria-hidden="true">'+fantasyPieceMarkup(piece.type,piece.color)+'</span>':'';
  html+='<button type="button" class="review-square '+(light?'review-square--light':'review-square--dark')+(sq===selected?' is-selected':'')+'" data-review-square="'+sq+'" aria-label="'+sq+'">'+img+symbol+'</button>';
 }
 return html;
}
/* Opened by a *result screen click* only. Does not run as background analysis
 * or during a live match. No review data is written to rated game state.
 */
function openFinishedGameReview({mode,moves,playerColor,finished,lang='ru',sides={}}={}){
 const turns=prepareFinishedReview({mode,moves,playerColor,finished});
 const L=localized(lang),overlay=document.createElement('div');
 overlay.className='rpchess-review-overlay';overlay.setAttribute('data-finished-review','');
 overlay.innerHTML='<section class="rpchess-review-panel" role="dialog" aria-modal="true" aria-label="'+L.title+'">'+
  '<header class="rpchess-review-header"><div><h2>'+L.title+'</h2><small>'+L.subtitle+'</small></div>'+
  '<button type="button" data-review-action="close" class="rpchess-review-button">'+L.close+'</button></header>'+
  '<div class="rpchess-review-content" data-review-content role="status">'+L.loading+'</div></section>';
 document.body.append(overlay);
 const target=overlay.querySelector('[data-review-content]');
 let cancelled=false,selected=0,selectedSquare='',revealed=false,feedback='',cases=[],worker=null;
 const close=()=>{
  if(cancelled)return;cancelled=true;worker?.close();overlay.remove();
  document.removeEventListener('keydown',escapeListener);
 };
 const escapeListener=e=>{if(e.key==='Escape'){e.preventDefault();close();}};
 document.addEventListener('keydown',escapeListener);
 function render(){
  if(cancelled)return;
  if(!cases.length){target.innerHTML='<p>'+L.notFound+'</p><p class="rpchess-review-note">'+L.limited+'</p>';return;}
  const current=cases[selected],ply=Math.ceil(current.ply/2),turnLabel=current.ply%2===1?'1.':'…';
  const choices=cases.map((item,i)=>
   '<button type="button" class="rpchess-review-case'+(selected===i?' is-active':'')+'" data-review-case="'+i+'">'+
   L.move+' '+Math.ceil(item.ply/2)+(item.ply%2===1?'.':'…')+' '+esc(item.uci)+
   ' · '+L[item.severity]+' (−'+(item.loss/100).toFixed(2)+')</button>').join('');
  target.innerHTML='<p class="rpchess-review-note">'+L.limited+'</p><div class="rpchess-review-cases">'+choices+'</div>'+
   '<div class="rpchess-review-body"><div class="rpchess-review-board classic-board" data-review-board>'+
   chessSquareBoard(current.beforeFen,playerColor,sides,selectedSquare)+'</div>'+
   '<div class="rpchess-review-details"><h3>'+L.move+' '+ply+(current.ply%2===1?'.':'…')+'</h3>'+
   '<p>'+L.played+': <strong>'+esc(current.uci)+'</strong></p>'+
   '<p>'+L.loss+': <strong>≈ −'+(current.loss/100).toFixed(2)+'</strong></p>'+
   '<p>'+L.challenge+'</p>'+
   (revealed?'<p>'+L.best+': <strong>'+esc(current.bestMove)+'</strong></p>':'')+
   '<button type="button" class="rpchess-review-button" data-review-action="hint">'+(revealed?L.hide:L.answer)+'</button>'+
   '<p class="rpchess-review-feedback" aria-live="polite">'+esc(feedback)+'</p></div></div>';
 }
 overlay.addEventListener('click',event=>{
  const closeButton=event.target.closest('[data-review-action="close"]');if(closeButton){close();return;}
  const hint=event.target.closest('[data-review-action="hint"]');if(hint){revealed=!revealed;render();return;}
  const caseBtn=event.target.closest('[data-review-case]');
  if(caseBtn){selected=Number(caseBtn.dataset.reviewCase);selectedSquare='';feedback='';revealed=false;render();return;}
  const square=event.target.closest('[data-review-square]');
  if(!square||!cases[selected])return;
  const chess=new ClassicChessEngine(cases[selected].beforeFen),next=square.dataset.reviewSquare;
  if(!selectedSquare){
   if(chess.pieceAt(next)?.color!==playerColor)return;
   selectedSquare=next;render();return;
  }
  if(selectedSquare===next){selectedSquare='';render();return;}
  const legal=chess.legalMoves(selectedSquare).filter(m=>(m.uciTo||m.to)===next);
  if(legal.length){
   const best=cases[selected].bestMove;
   const requested=best.slice(0,4)===selectedSquare+next?(best.slice(4)||''):null;
   feedback=requested!==null&&legal.some(m=>!m.promotion||m.promotion===requested)?L.correct:L.retry;
   selectedSquare='';render();return;
  }
  selectedSquare=chess.pieceAt(next)?.color===playerColor?next:'';
  render();
 });
 (async()=>{
  if(!turns.length){target.innerHTML='<p>'+L.noMoves+'</p>';return;}
  try{
   worker=new StockfishReviewEngine();await worker.start();
   if(cancelled)return;
   cases=await analyseFinishedReview(turns,{engine:worker,onProgress:(done,total)=>{
    if(!cancelled)target.textContent=L.working+': '+done+'/'+total+'…';
   }});
   if(!cancelled)render();
  }catch{
   if(!cancelled)target.textContent=L.error;
  }finally{worker?.close();}
 })();
 return {close};
}
export { prepareFinishedReview, sampleReviewTurns, parseInfo, classifyLoss, analyseFinishedReview, StockfishReviewEngine, openFinishedGameReview };
