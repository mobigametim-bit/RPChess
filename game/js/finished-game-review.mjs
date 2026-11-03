/* Completed-game error review: ONLY Tournament and Arena.
 * A fresh Stockfish 18 lite worker evaluates completed chess positions.
 * Never instantiate this module from Journey or from a live PvP match.
 */
import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { racePiecePath } from './race-assets.mjs';
import { fantasyPieceMarkup } from './fantasy-piece.mjs';
import { makeToggle, syncToggles } from './board-view-toggle.mjs';

const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
const MODES=new Set(['arena','tournament']);
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
 limited:'Проверяем все ходы игрока в партии. Оценки приблизительные.',
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
 limited:'Every player move is checked throughout the game. Evaluations are approximate.',
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
  if(ours)turns.push({ply:i+1,uci,beforeFen:fenBefore,afterFen:engine.fen()});
 }
 return turns;
}
function sampleReviewTurns(turns){
 // Legacy export kept for callers. Full-game analysis never samples or caps turns.
 return turns.slice();
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
   errors.push({...turn,loss:Math.round(drop),severity,bestMove:before.bestMove,beforeCp:before.cp,originalReply:after.bestMove||null});
  onProgress(i+1,sampled.length);
 }
 return errors.sort((a,b)=>a.ply-b.ply);
}
function esc(x){return String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function localized(lang){return lang==='en'?EN:RU;}
function chessSquareBoard(fen,color,sides,selected='',hint='',last=''){
 const snapshot=new ClassicChessEngine(fen).snapshot(),reverse=color==='b';
 let html='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const rank=reverse?y:7-y,file=reverse?7-x:x,idx=rank*8+file;
  const sq='abcdefgh'[file]+(rank+1),piece=snapshot.board[idx],light=(rank+file)%2!==0;
  const img=piece?'<img class="classic-piece" alt="" draggable="false" src="'+racePiecePath(sides[piece.color]||'humans',ROLES[piece.type],piece.color)+'">':'';
  const symbol=piece?'<span class="rpchess-piece-symbol" aria-hidden="true">'+fantasyPieceMarkup(piece.type,piece.color)+'</span>':'';
  html+='<button type="button" class="review-square '+(light?'review-square--light':'review-square--dark')+(sq===selected?' is-selected':'')+(hint.slice(0,2)===sq?' is-hint-from':'')+(hint.slice(2,4)===sq?' is-hint-to':'')+(last.slice(0,2)===sq||last.slice(2,4)===sq?' is-last':'')+'" data-review-square="'+sq+'" aria-label="'+sq+'">'+img+symbol+'</button>';
 }
 return html;
}
/* Opened by a *result screen click* only. Does not run as background analysis
 * or during a live match. No review data is written to rated game state.
 */

/* A solved practice move is evaluated from the original position, not compared
 * to a single UCI string. Both scores are from opposite side-to-move POVs.
 * 70cp tolerance acknowledges near-equivalent human alternatives. */
async function gradeReviewAttempt(lesson,uci,{engine,tolerance=70}={}){
 if(!UCI.test(String(uci))||!lesson?.beforeFen||!engine)throw new Error('Invalid review attempt');
 const game=new ClassicChessEngine(lesson.beforeFen);
 const played=game.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
 if(!played.ok)return {accepted:false,invalid:true,reason:played.reason};
 const afterFen=game.fen();
 if(played.status.type==='checkmate')return {accepted:true,loss:0,afterFen,reply:null};
 if(uci===lesson.bestMove)return {accepted:true,loss:0,afterFen,reply:null};
 const after=await engine.evaluate(afterFen);
 if(after.cp===null||after.depth<5||!Number.isFinite(lesson.beforeCp))
  return {accepted:false,unavailable:true,afterFen};
 const loss=Math.round(lesson.beforeCp+after.cp);
 return {accepted:loss<=tolerance,loss,afterFen,reply:after.bestMove||null};
}
function reviewUci(game,uci){
 if(!UCI.test(String(uci)))return null;
 const step=game.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
 return step.ok?step:null;
}
function reviewContinuation(lesson,step=1){
 const game=new ClassicChessEngine(lesson.beforeFen);
 const first=reviewUci(game,lesson.uci);
 if(!first)return {fen:lesson.beforeFen,last:''};
 if(step===1)return {fen:game.fen(),last:lesson.uci};
 const reply=lesson.originalReply&&reviewUci(game,lesson.originalReply);
 return {fen:game.fen(),last:reply?lesson.originalReply:lesson.uci};
}
/* Full-screen teaching screen uses the same centered-viewport board contract as
 * Battle, Arena and Classic. The left rail owns all explanatory UI. */
function openFinishedGameReview({mode,moves,playerColor,finished,lang='ru',sides={}}={}){
 const turns=prepareFinishedReview({mode,moves,playerColor,finished});
 // One open analysis at a time. No worker survives the screen.
 document.querySelector('[data-finished-review]')?.querySelector('[data-review-action="close"]')?.click();
 const L=localized(lang),overlay=document.createElement('div');
 overlay.className='rpchess-review-overlay';overlay.setAttribute('data-finished-review','');
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',L.title);
 overlay.innerHTML='<div class="rpchess-review-shell"><aside class="rpchess-review-rail">'+
  '<header class="rpchess-review-header"><div><h2>'+L.title+'</h2><small>'+L.subtitle+'</small></div>'+
  '<button type="button" data-review-action="close" class="rpchess-review-button rpchess-review-close">'+L.close+'</button></header>'+
  '<div class="rpchess-review-content" data-review-content aria-live="polite">'+L.loading+'</div></aside>'+
  '<section class="rpchess-review-board-column" aria-label="'+(lang==='en'?'Training chessboard':'Тренировочная доска')+'">'+
  '<div class="rpchess-review-board-frame"><div class="rpchess-review-ranks" aria-hidden="true"></div>'+
  '<div class="rpchess-review-board classic-board" data-review-board></div>'+
  '<div class="rpchess-review-files" aria-hidden="true"></div></div></section>'+
  '<div class="rpchess-review-right" aria-hidden="true"></div></div>';
 document.body.append(overlay);
 const artSwitch=makeToggle();
 overlay.querySelector('.rpchess-review-rail').insertBefore(artSwitch,overlay.querySelector('[data-review-content]'));
 syncToggles();
 const target=overlay.querySelector('[data-review-content]');
 const board=overlay.querySelector('[data-review-board]');
 const rankLabels=overlay.querySelector('.rpchess-review-ranks');
 const fileLabels=overlay.querySelector('.rpchess-review-files');
 const reverse=playerColor==='b';
 rankLabels.innerHTML=(reverse?['1','2','3','4','5','6','7','8']:['8','7','6','5','4','3','2','1']).map(x=>'<span>'+x+'</span>').join('');
 fileLabels.innerHTML=(reverse?[...'hgfedcba']:[...'abcdefgh']).map(x=>'<span>'+x+'</span>').join('');
 let cancelled=false,cases=[],worker=null,selected=0,selectedSquare='',feedback='',feedbackKind='',busy=false;
 // Actual pixels are authoritative: older WebViews can resolve nested CSS
 // min()/calc() grid tracks incorrectly and stretch the panel over the board.
 // Keep the separate coordinate labels visible at every landscape size.
 const rail=overlay.querySelector('.rpchess-review-rail');
 function layoutReviewRail(){
  if(cancelled)return;
  const portrait=window.innerWidth<=700||window.innerHeight>window.innerWidth;
  if(portrait){rail.style.width='100%';rail.style.maxWidth='none';return;}
  const gutter=rankLabels.getBoundingClientRect().left-overlay.getBoundingClientRect().left-4;
  const width=Math.max(0,Math.floor(gutter))+'px';
  rail.style.width=width;rail.style.maxWidth=width;
 }
 window.addEventListener('resize',layoutReviewRail);
 layoutReviewRail();
 let solved=new Set(),hint=false,boardMode='before',attemptFen='',attemptUci='',pendingPromotion=null,serial=0;
 const tx={
  en:{issues:'Key moments',task:'Find a better move for',mistake:'Your move',loss:'Evaluation drop',
      pending:'Analyse the position and play a stronger move on the board.',
      alternative:'Your alternative is acceptable according to the engine.',
      wrong:'This move still loses too much evaluation. Try again.',
      checking:'Stockfish is assessing your move…',fail:'Could not assess this move. Try again.',
      invalid:'This move is not legal.',tryAgain:'Try again',next:'Next mistake',solution:'Best move',
      original:'Why was it a mistake?',opponent:'Show opponent reply',back:'Back to exercise',
      hint:'Hint',hideHint:'Hide hint',show:'Engine suggestion',solved:'Solved',
      intro:'Solve each position before checking the answer.',completed:'Practice complete!',
      progress:'Solved',from:'Position before the mistake',after:'Your attempted move',played:'Original move',
      reply:'Engine reply to that move',noReply:'No engine reply available for this position.',
      explanation:'Compare your move with the actual engine continuation on the board.',
      side:'to move',promotion:'Choose promotion',unavailable:'The engine could not verify this move. Retry.',
      noMistakes:'No major mistakes found in the finished game.',limited:'Every move you played is analysed; evaluations are approximate.',
      original2:'Original move',examining:'Checking'},
  ru:{issues:'Ключевые моменты',task:'Найдите более сильный ход за',mistake:'Ваш ход',loss:'Потеря оценки',
      pending:'Посмотрите на позицию и сделайте более сильный ход на доске.',
      alternative:'Хороший ход! Движок подтверждает, что этот вариант достаточно силён.',
      wrong:'Этот ход по-прежнему теряет слишком много оценки. Попробуйте другой.',
      checking:'Stockfish проверяет ваш ход…',fail:'Не удалось проверить ход. Попробуйте ещё.',
      invalid:'Недопустимый ход.',tryAgain:'Попробовать ещё',next:'Следующая ошибка',solution:'Лучший ход',
      original:'Почему это ошибка?',opponent:'Ответ соперника',back:'Вернуться к задаче',
      hint:'Подсказка',hideHint:'Скрыть подсказку',show:'Предложение движка',solved:'Решено',
      intro:'Найдите хороший ход самостоятельно, а затем сравните варианты.',
      completed:'Разбор завершён!',progress:'Разобрано',from:'Позиция до ошибки',
      after:'Ваш вариант',played:'Исходный ход',reply:'Ответ движка на этот ход',
      noReply:'Достоверный ответ движка для этой позиции недоступен.',
      explanation:'Сравните исходный ход с продолжением, найденным движком.',
      side:'ход',promotion:'Выберите превращение',unavailable:'Движок не смог оценить этот ход. Попробуйте ещё.',
      noMistakes:'В завершённой партии крупных ошибок не найдено.',
      limited:'Проверяем каждый ваш ход за всю партию. Оценки приблизительные.',original2:'Сыграно',examining:'Проверено'}
 }[lang==='en'?'en':'ru'];
 const close=()=>{if(cancelled)return;cancelled=true;serial++;worker?.close();overlay.remove();document.removeEventListener('keydown',onEscape);window.removeEventListener('resize',layoutReviewRail);};
 const onEscape=e=>{if(e.key==='Escape'){e.preventDefault();close();}};
 document.addEventListener('keydown',onEscape);
 function resetView(){serial++;selectedSquare='';feedback='';feedbackKind='';hint=false;boardMode='before';attemptFen='';attemptUci='';pendingPromotion=null;busy=false;}
 function goTo(index){if(index<0||index>=cases.length)return;selected=index;resetView();render();}
 function render(){
  if(cancelled)return;
  if(!cases.length){board.innerHTML='';return;}
  const item=cases[selected],moveNo=Math.ceil(item.ply/2)+(item.ply%2===1?'.':'…');
  const list=cases.map((c,i)=>{
   const type=L[c.severity],num=Math.ceil(c.ply/2)+(c.ply%2===1?'.':'…');
   const mark={inaccuracy:'?!',mistake:'?',blunder:'??'}[c.severity]||'';
   return '<button type="button" data-review-case="'+i+'" class="rpchess-review-case'+(i===selected?' is-active':'')+(solved.has(i)?' is-solved':'')+'">'+
    '<strong>'+num+' '+esc(c.uci)+'</strong><b class="rpchess-review-symbol rpchess-review-symbol--'+c.severity+'" aria-label="'+esc(type)+'">'+mark+'</b><small>−'+(c.loss/100).toFixed(2)+(solved.has(i)?' ✓':'')+'</small></button>';
  }).join('');
  const complete=solved.size===cases.length;
  const viewingOriginal=boardMode==='original'||boardMode==='reply';
  let currentFen=item.beforeFen,lastMove='',label=tx.from;
  if(boardMode==='attempt'&&attemptFen){currentFen=attemptFen;lastMove=attemptUci;label=tx.after;}
  if(viewingOriginal){const view=reviewContinuation(item,boardMode==='original'?1:2);currentFen=view.fen;lastMove=view.last;label=tx.played;}
  const actualHint=hint&&!viewingOriginal&&boardMode==='before'?item.bestMove:'';
  board.innerHTML=chessSquareBoard(currentFen,playerColor,sides,selectedSquare,actualHint,lastMove);
  const title=tx.task+' '+(playerColor==='w'?(lang==='en'?'White':'белых'):(lang==='en'?'Black':'чёрных'));
  const symbol={inaccuracy:'?!',mistake:'?',blunder:'??'}[item.severity]||'';
  let details='<div class="rpchess-review-details"><h3 class="rpchess-review-current">'+moveNo+' '+esc(item.uci)+
   '<b class="rpchess-review-symbol rpchess-review-symbol--'+item.severity+'" aria-label="'+esc(L[item.severity])+'">'+symbol+'</b>'+
   '<span class="rpchess-review-current-loss">−'+(item.loss/100).toFixed(2)+'</span></h3>'+
   '<p class="rpchess-review-detail">'+title+'</p>';
  if(viewingOriginal){
   details+='<p class="rpchess-review-prompt">'+tx.explanation+'</p><p class="rpchess-review-meta">'+tx.original2+': <strong>'+esc(item.uci)+'</strong></p>';
   details+='<p class="rpchess-review-meta">'+tx.reply+': <strong>'+(item.originalReply?esc(item.originalReply):tx.noReply)+'</strong></p>';
   details+='<div class="rpchess-review-actions"><button type="button" data-review-action="back" class="rpchess-review-button">'+tx.back+'</button>';
   if(boardMode==='original'&&item.originalReply)details+='<button type="button" data-review-action="opponent" class="rpchess-review-button">'+tx.opponent+'</button>';
   details+='</div>';
  }else{
   if(feedback)details+='<p class="rpchess-review-prompt rpchess-review-prompt--'+feedbackKind+'" role="status">'+feedback+'</p>';
   if(hint)details+='<p class="rpchess-review-answer">'+tx.show+': <strong>'+esc(item.bestMove)+'</strong></p>';
   if(pendingPromotion){
    details+='<div class="rpchess-review-promotions"><strong>'+tx.promotion+'</strong><div>';
    for(const role of ['q','r','b','n'])details+='<button type="button" class="rpchess-review-button" data-review-promotion="'+role+'">'+role.toUpperCase()+'</button>';
    details+='</div></div>';
   }
   details+='<div class="rpchess-review-actions">';
   if(boardMode==='attempt')details+='<button type="button" data-review-action="retry" class="rpchess-review-button">'+tx.tryAgain+'</button>';
   details+='<button type="button" data-review-action="hint" class="rpchess-review-button">'+(hint?tx.hideHint:tx.hint)+'</button>';
   details+='<button type="button" data-review-action="solution" class="rpchess-review-button">'+tx.solution+'</button>';
   details+='</div>';
  }
  details+='</div>';
  target.innerHTML='<div class="rpchess-review-summary"><strong>'+tx.progress+': '+solved.size+' / '+cases.length+'</strong>'+
    (complete?'<span>'+tx.completed+'</span>':'')+'</div>'+
   '<p class="rpchess-review-note">'+tx.limited+'</p><h3 class="rpchess-review-section-title">'+tx.issues+'</h3>'+
   '<div class="rpchess-review-cases">'+list+'</div>'+details;
  const labelEl=overlay.querySelector('[data-review-board-label]');
  if(labelEl)labelEl.textContent=label;
  board.setAttribute('aria-busy',String(busy));
 }
 async function submit(uci){
  if(cancelled||busy||!cases.length)return;
  const current=cases[selected],stamp=++serial;
  const game=new ClassicChessEngine(current.beforeFen);
  const played=reviewUci(game,uci);
  if(!played){feedback=tx.invalid;feedbackKind='error';render();return;}
  busy=true;pendingPromotion=null;selectedSquare='';feedback=tx.checking;feedbackKind='checking';
  attemptFen=game.fen();attemptUci=uci;boardMode='attempt';render();
  try{
   const result=await gradeReviewAttempt(current,uci,{engine:worker});
   if(cancelled||stamp!==serial)return;
   busy=false;
   if(result.unavailable){feedback=tx.unavailable;feedbackKind='error';}
   else if(result.accepted){solved.add(selected);feedback=tx.alternative;feedbackKind='correct';}
   else{feedback=tx.wrong;feedbackKind='error';}
  }catch{if(!cancelled&&stamp===serial){busy=false;feedback=tx.fail;feedbackKind='error';}}
  if(!cancelled&&stamp===serial)render();
 }
 overlay.addEventListener('click',event=>{
  const action=event.target.closest('[data-review-action]');
  if(action){
   const a=action.dataset.reviewAction;
   if(a==='close'){close();return;}
   if(busy)return;
   if(a==='next'){const next=cases.findIndex((_,i)=>i>selected&&!solved.has(i));const start=cases.findIndex((_,i)=>!solved.has(i));goTo(next>=0?next:start>=0?start:Math.min(selected+1,cases.length-1));return;}
   if(a==='hint'){hint=!hint;render();return;}
   if(a==='retry'||a==='back'){resetView();render();return;}
   if(a==='solution'){
    const item=cases[selected],game=new ClassicChessEngine(item.beforeFen);
    const applied=reviewUci(game,item.bestMove);
    if(applied){attemptFen=game.fen();attemptUci=item.bestMove;boardMode='attempt';feedback=tx.show+': '+item.bestMove;feedbackKind='revealed';solved.add(selected);}
    render();return;
   }
   if(a==='original'){boardMode='original';selectedSquare='';render();return;}
   if(a==='opponent'){boardMode='reply';render();return;}
  }
  const choice=event.target.closest('[data-review-case]');
  if(choice){if(!busy)goTo(Number(choice.dataset.reviewCase));return;}
  const promotion=event.target.closest('[data-review-promotion]');
  if(promotion&&pendingPromotion){const uci=pendingPromotion+promotion.dataset.reviewPromotion;pendingPromotion=null;submit(uci);return;}
  const square=event.target.closest('[data-review-square]');
  if(!square||busy||boardMode!=='before'||pendingPromotion||!cases.length)return;
  const current=cases[selected],game=new ClassicChessEngine(current.beforeFen),sq=square.dataset.reviewSquare;
  if(!selectedSquare){if(game.pieceAt(sq)?.color===playerColor){selectedSquare=sq;render();}return;}
  if(sq===selectedSquare){selectedSquare='';render();return;}
  const options=game.legalMoves(selectedSquare).filter(m=>(m.uciTo||m.to)===sq);
  if(!options.length){selectedSquare=game.pieceAt(sq)?.color===playerColor?sq:'';render();return;}
  const move=selectedSquare+sq;
  if(options.some(m=>m.promotion)){pendingPromotion=move;render();return;}
  submit(move);
 });
 (async()=>{
  if(!turns.length){target.innerHTML='<p>'+L.noMoves+'</p>';return;}
  try{
   worker=new StockfishReviewEngine();await worker.start();
   if(cancelled)return;
   cases=await analyseFinishedReview(turns,{engine:worker,onProgress:(done,total)=>{
    if(!cancelled)target.innerHTML='<div class="rpchess-review-loading">'+tx.examining+': '+done+'/'+total+'…</div>';
   }});
   if(cancelled)return;
   if(!cases.length){target.innerHTML='<p>'+tx.noMistakes+'</p><p class="rpchess-review-note">'+tx.limited+'</p>';worker.close();worker=null;return;}
   render();
  }catch{
   if(!cancelled)target.innerHTML='<p>'+L.error+'</p>';
   worker?.close();worker=null;
  }
 })();
 return {close};
}
export { prepareFinishedReview, sampleReviewTurns, parseInfo, classifyLoss, analyseFinishedReview, gradeReviewAttempt, StockfishReviewEngine, openFinishedGameReview };
