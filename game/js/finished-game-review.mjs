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
 title:'Разбор ошибок',
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
 title:'Review mistakes',
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
function prepareFinishedReview({mode,moves,playerColor,finished,allColors=false}={}){
 if(!MODES.has(mode)||finished!==true)throw new Error('Error review is allowed only for completed Tournament or Arena matches');
 if(!['w','b'].includes(playerColor)||!Array.isArray(moves)||moves.length>1000)throw new Error('Invalid completed game data');
 const engine=new ClassicChessEngine(),turns=[];
 for(let i=0;i<moves.length;i++){
  const uci=moveUci(moves[i]);
  if(!UCI.test(uci))throw new Error('Invalid UCI history');
  const fenBefore=engine.fen(),ours=engine.turn()===playerColor;
  const applied=engine.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
  if(!applied.ok)throw new Error('Corrupted game move history');
  if(ours||allColors)turns.push({ply:i+1,uci,beforeFen:fenBefore,afterFen:engine.fen(),color:ours?playerColor:(playerColor==='w'?'b':'w')});
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
     const info=parseInfo(text),pvIndex=Number(text.match(/\bmultipv (\d+)/)?.[1]||1);
     const pv=text.match(/\bpv\s+(.+)$/)?.[1]?.trim().split(/\s+/).filter(x=>UCI.test(x))||[];
     const previous=search.variants.get(pvIndex);
     if(info.cp!==null&&info.depth>=5&&pv.length&&(!previous||info.depth>=previous.depth)){
      search.variants.set(pvIndex,{depth:info.depth,cp:info.cp,pv});
      if(pvIndex===1){search.depth=info.depth;search.cp=info.cp;search.bestMove=pv[0];search.pv=pv;}
     }
    }else if(text.startsWith('bestmove ')){
     this.search=null;clearTimeout(search.timer);
     const second=search.variants.get(2);
     search.resolve({cp:search.cp,bestMove:search.bestMove,depth:search.depth,
      pv:search.pv.slice(),secondCp:second?.cp??null,secondMove:second?.pv[0]??null,
      secondDepth:second?.depth??0});
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
  this.worker.postMessage('setoption name MultiPV value 2');
  this.worker.postMessage('setoption name UCI_LimitStrength value false');
  const ready=this._wait('readyok');this.worker.postMessage('isready');await ready;
 }
 async evaluate(fen,{movetime=180}={}){
  if(this.closed||this.search)throw new Error('Invalid review engine state');
  return await new Promise((resolve,reject)=>{
   const search={resolve,reject,depth:0,cp:null,bestMove:null,pv:[],variants:new Map(),timer:null};
   search.timer=setTimeout(()=>{if(this.search===search){this.search=null;this.worker.postMessage('stop');reject(new Error('Stockfish analysis timeout'));}},this.timeoutMs);
   this.search=search;this.worker.postMessage('position fen '+fen);
   this.worker.postMessage('go movetime '+Math.max(120,Math.min(1400,Math.round(movetime))));
  });
 }
 close(){
  if(this.closed)return;this.closed=true;
  this._fail(new Error('Analysis closed'));
  this.worker.terminate?.();
 }
}
function classifyLoss(cp){return cp>=250?'blunder':cp>=120?'mistake':cp>=65?'inaccuracy':null;}
/* A best move is not automatically brilliant. Positive marks require a clear
 * measurable gap to the runner-up MultiPV option, adequate search depth, and
 * a non-trivial competitive position. !! is a conservative critical-move
 * heuristic, NOT a verified sacrifice or Lichess classification. */
function classifyStrongMove(turn,before,loss){
 if(!before||before.bestMove!==turn.uci||before.depth<9||before.secondDepth<8||
    !Number.isFinite(before.cp)||!Number.isFinite(before.secondCp)||
    !Number.isFinite(loss)||loss>40||Math.abs(before.cp)>600)return null;
 const margin=before.cp-before.secondCp;
 if(!Number.isFinite(margin)||margin<65)return null;
 const options=new ClassicChessEngine(turn.beforeFen).legalMoves().length;
 if(options<8)return null;
 if(margin>=175&&options>=12&&Math.abs(before.cp)<=350&&loss<=20)return 'excellent';
 return 'good';
}
async function analyseFinishedReview(turns,{engine,onProgress=()=>{},annotate=false,playerColor=null}={}){
 if(!engine||typeof engine.evaluate!=='function')throw new Error('Stockfish review engine is required');
 const sampled=sampleReviewTurns(turns),errors=[],annotations={};
 for(let i=0;i<sampled.length;i++){
  const turn=sampled[i];
  const before=await engine.evaluate(turn.beforeFen);
  const after=await engine.evaluate(turn.afterFen);
  const drop=(before.cp===null||after.cp===null)?null:before.cp+after.cp;
  // Stockfish scores are from side-to-move POV; after the move it reverses.
  const severity=drop===null?null:classifyLoss(drop);
  const reliable=Number.isFinite(drop)&&before.depth>=5&&after.depth>=5&&
    before.bestMove&&UCI.test(before.bestMove);
  if(reliable){
   const mistake=severity&&before.bestMove!==turn.uci;
   const strong=!mistake&&annotate?classifyStrongMove(turn,before,drop):null;
   const kind=mistake?severity:strong;
   if(kind)annotations[turn.ply]={kind,loss:Math.round(drop)};
   if(mistake&&(!playerColor||!turn.color||turn.color===playerColor))
    errors.push({...turn,loss:Math.round(drop),severity,bestMove:before.bestMove,
     beforeCp:before.cp,pv:before.pv||[],originalReply:after.bestMove||null});
  }
  onProgress(i+1,sampled.length);
 }
 errors.sort((a,b)=>a.ply-b.ply);
 return annotate?{errors,annotations}:errors;
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
const REVIEW_MARKS={excellent:'!!',good:'!',inaccuracy:'?!',mistake:'?',blunder:'??'};
// Original moving piece, not the SAN prefix: pawn moves and castling need glyphs too.
const REVIEW_PIECE_GLYPHS={
 w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},
 b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}
};

/* Rebuild SAN from the verified completed UCI history. This is a readable
 * game journal, not a new game state and not an engine recommendation. */
function reviewMoveJournal(moves,{startFen=null}={}){
 const game=new ClassicChessEngine(startFen||undefined),entries=[];
 for(let i=0;i<moves.length;i++){
  const uci=moveUci(moves[i]),from=uci.slice(0,2),to=uci.slice(2,4),promotion=uci.slice(4)||null;
  const moving=game.pieceAt(from),before=game.legalMoves();
  if(!moving)throw new Error('Corrupted finished game journal');
  const candidate=before.find(m=>m.from===from&&m.to===to&&(!m.promotion||m.promotion===promotion));
  const alternatives=before.filter(m=>m.from!==from&&m.to===to&&game.pieceAt(m.from)?.type===moving.type);
  const result=game.move(from,to,promotion);
  if(!result.ok||!candidate)throw new Error('Invalid finished game move');
  const suffix=result.status.type==='checkmate'?'#':result.status.checked?'+':'';
  let san='';
  if(result.move.castle==='K'||result.move.castle==='Q'){
   san=(result.move.castle==='K'?'O-O':'O-O-O')+suffix;
  }else{
   let prefix=moving.type==='p'?(candidate.capture?from[0]:''):{n:'N',b:'B',r:'R',q:'Q',k:'K'}[moving.type]||'';
   if(moving.type!=='p'&&alternatives.length){
    const sameFile=alternatives.some(m=>m.from[0]===from[0]);
    const sameRank=alternatives.some(m=>m.from[1]===from[1]);
    prefix+=!sameFile?from[0]:!sameRank?from[1]:from;
   }
   san=prefix+(candidate.capture?'x':'')+to+(promotion?'='+promotion.toUpperCase():'')+suffix;
  }
  entries.push({ply:i+1,uci,san,fen:game.fen(),color:moving.color,pieceType:moving.type});
 }
 return entries;
}
/* Use the actual accepted attempt as the source of a follow-up engine line.
 * On a revealed solution use the engine best move; a legal, near-equivalent
 * player alternative must NEVER be replaced by the engine first choice. */
function reviewContinuationStart(lesson,chosenUci=null){
 const uci=chosenUci||lesson?.bestMove;
 if(!lesson?.beforeFen||!UCI.test(String(uci)))throw new Error('Invalid review continuation');
 const game=new ClassicChessEngine(lesson.beforeFen);
 if(!reviewUci(game,uci))throw new Error('Illegal continuation move');
 return {uci,afterFen:game.fen(),isEngineBest:uci===lesson.bestMove};
}
/* A validated, playable engine variation. The source is Stockfish's UCI
 * principal variation, not a fabricated natural-language explanation. */
function reviewEngineLine(beforeFen,ucis,maxPlies=9){
 const game=new ClassicChessEngine(beforeFen),valid=[];
 for(const uci of ucis.slice(0,maxPlies)){
  if(!UCI.test(uci))break;
  const move=reviewUci(game,uci);
  if(!move)break;
  valid.push(uci);
  if(move.status.over)break;
 }
 return valid.length?reviewMoveJournal(valid,{startFen:beforeFen}):[];
}
/* Stockfish's centipawn evaluation is side-to-move relative. For a lesson the
 * player is the side to move. The right-hand bar always indicates the board
 * advantage for WHITE, while the colored section follows board orientation. */
function reviewEvaluation(beforeCp,playerColor,loss=null){
 if(!Number.isFinite(beforeCp))return null;
 const playerCp=beforeCp-(Number.isFinite(loss)?loss:0);
 const whiteCp=playerColor==='w'?playerCp:-playerCp;
 const fraction=Math.max(.015,Math.min(.985,1/(1+Math.exp(-whiteCp/310))));
 return {whiteCp,whitePercent:Math.round(fraction*1000)/10,display:(whiteCp>=0?'+':'−')+(Math.abs(whiteCp)/100).toFixed(2)};
}
/* Explicitly invoked from the completed Arena or Tournament result button.
 * There is no live-match Stockfish worker or reward/rating side effect. */
function openFinishedGameReview({mode,moves,playerColor,finished,lang='ru',sides={},engineFactory=null}={}){
 const turns=prepareFinishedReview({mode,moves,playerColor,finished,allColors:true});
 const journal=reviewMoveJournal(moves);
 document.querySelector('[data-finished-review]')?.querySelector('[data-review-action="close"]')?.click();
 const L=localized(lang),en=lang==='en',overlay=document.createElement('div');
 overlay.className='rpchess-review-overlay';
 overlay.setAttribute('data-finished-review','');
 overlay.setAttribute('role','dialog');
 overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label',en?'Learn from your mistakes':'Учиться на своих ошибках');
 overlay.innerHTML='<div class="rpchess-review-shell"><aside class="rpchess-review-rail">'+
  '<header class="rpchess-review-header"><div><h2>'+(en?'Game analysis':'Анализ партии')+'</h2>'+
  '</div>'+
  '<button type="button" data-review-action="close" class="rpchess-review-button rpchess-review-close">'+L.close+'</button></header>'+
  '<div class="rpchess-review-content" data-review-content aria-live="polite">'+L.loading+'</div></aside>'+
  '<section class="rpchess-review-board-column" aria-label="'+(en?'Training chessboard':'Тренировочная доска')+'">'+
  '<div class="rpchess-review-board-frame">'+
  '<div class="rpchess-review-ranks" aria-hidden="true"></div>'+
  '<div class="rpchess-review-board classic-board" data-review-board></div>'+
  '<div class="rpchess-review-files" aria-hidden="true"></div>'+
  '<div class="rpchess-review-eval" data-review-eval role="img" aria-label="'+(en?'Position evaluation':'Оценка позиции')+'">'+
  '<div class="rpchess-review-eval-white" data-review-eval-white></div>'+
  '<span class="rpchess-review-eval-score" data-review-eval-score>—</span></div>'+
  '</div></section><div class="rpchess-review-right" aria-hidden="true"></div></div>';
 document.body.append(overlay);
 const artSwitch=makeToggle();
 overlay.querySelector('.rpchess-review-rail').insertBefore(artSwitch,overlay.querySelector('[data-review-content]'));
 syncToggles();
 const target=overlay.querySelector('[data-review-content]');
 const board=overlay.querySelector('[data-review-board]');
 const rail=overlay.querySelector('.rpchess-review-rail');
 const rankLabels=overlay.querySelector('.rpchess-review-ranks');
 const fileLabels=overlay.querySelector('.rpchess-review-files');
 const evalBar=overlay.querySelector('[data-review-eval]');
 const evalWhite=overlay.querySelector('[data-review-eval-white]');
 const evalScore=overlay.querySelector('[data-review-eval-score]');
 const reverse=playerColor==='b';
 rankLabels.innerHTML=(reverse?['1','2','3','4','5','6','7','8']:['8','7','6','5','4','3','2','1']).map(x=>'<span>'+x+'</span>').join('');
 fileLabels.innerHTML=(reverse?[...'hgfedcba']:[...'abcdefgh']).map(x=>'<span>'+x+'</span>').join('');
 evalBar.classList.toggle('is-flipped',reverse);
 let cancelled=false,cases=[],annotations={},worker=null,selected=0,selectedSquare='',feedback='',feedbackKind='',busy=false;
 let solved=new Set(),revealed=new Set(),skipped=new Set(),acceptedMoves=new Map(),boardMode='before',browsePly=null;
 let attemptFen='',attemptUci='',attemptLoss=null,pendingPromotion=null,serial=0;
 let variation=null,variationIndex=0,variationLoading=false;
 let replayFlight=null,replayFlightSerial=0,replayAnimationCount=0;
 const tx=en?{
  learn:'Learn from your mistakes',moves:'Moves',legend:'Annotations',
  progress:'Reviewed',total:'issues',find:'Find a better move for',
  played:'was played',inaccuracy:'Inaccuracy',mistake:'Mistake',blunder:'Blunder',
  view:'View solution',skip:'Skip this move',next:'Next',retry:'Try again',
  resume:'Resume learning',again:'Practice again',solution:'Best was',
  good:'Good move!',wrong:'You can do better. Try another move.',
  check:'Evaluating your move…',unavailable:'Unable to evaluate the move. Try again.',
  invalid:'Illegal move.',completed:'You have reviewed all your mistakes.',
  nothing:'No significant errors found in this completed game.',
  note:'Stockfish analysis of every move · approximate evaluations',
  yourTurn:'Your move',offTrack:'You browsed away from the exercise.',
  label:'Position evaluation',loading:'Analysed',white:'White',black:'Black',
  excellent:'Outstanding',goodMove:'Strong move',showLine:'See best continuation',
  lineTitle:'Stockfish continuation',lineNote:'Illustrative engine line · short search, not a forced outcome',
  originalLine:'Played',betterLine:'Better',yourLine:'Your line',linePrev:'Previous',lineNext:'Next move',lineLoading:'Analysing continuation…',
  lineUnavailable:'Stockfish did not return a reliable continuation.',
  status:'Done',solved:'Solved',skipped:'Skipped'
 }:{
  learn:'Учиться на своих ошибках',moves:'Ходы партии',legend:'Обозначения',
  progress:'Разобрано',total:'ошибок',find:'Найдите более сильный ход за',
  played:'был сыгран',inaccuracy:'Неточность',mistake:'Ошибка',blunder:'Зевок',
  view:'Посмотреть решение',skip:'Пропустить ход',next:'Следующая',retry:'Попробовать снова',
  resume:'Продолжить обучение',again:'Разобрать заново',solution:'Лучший ход',
  good:'Хороший ход!',wrong:'Можно сыграть сильнее. Попробуйте другой ход.',
  check:'Проверяем ваш ход…',unavailable:'Не удалось оценить ход. Попробуйте ещё.',
  invalid:'Недопустимый ход.',completed:'Вы разобрали все ошибки этой партии.',
  nothing:'В завершённой партии существенных ошибок не найдено.',
  note:'Stockfish проверяет все ходы · оценки приблизительные',
  yourTurn:'Ваш ход',offTrack:'Вы отошли от учебной позиции.',
  label:'Оценка позиции',loading:'Проверено',white:'белых',black:'чёрных',
  excellent:'Выдающийся ход',goodMove:'Сильный ход',showLine:'Посмотреть продолжение',
  lineTitle:'Продолжение Stockfish',lineNote:'Примерный вариант движка · не единственный исход',
  originalLine:'В партии',betterLine:'Сильнее',yourLine:'Ваш вариант',linePrev:'Назад',lineNext:'Вперёд',lineLoading:'Анализируем продолжение…',
  lineUnavailable:'Stockfish не смог построить достоверное продолжение.',
  status:'Готово',solved:'Решено',skipped:'Пропущено'
 };
 // While the engine checks the complete finished game, replay each analysed
 // move on the actual board. Never suggest unsaved analysis moves at this stage.
 function stopReplayFlight(){
  replayFlightSerial++;
  if(replayFlight){
   replayFlight.animation?.cancel();
   replayFlight.flyer.remove();
   replayFlight.target?.style.removeProperty('visibility');
   replayFlight=null;
  }
 }
 function showReplayStep(done){
  if(cancelled||done<1||done>journal.length)return;
  const entry=journal[done-1],from=entry.uci.slice(0,2),to=entry.uci.slice(2,4);
  const sourceSquare=board.querySelector('[data-review-square="'+from+'"]');
  const oldRect=sourceSquare?.getBoundingClientRect();
  const fantasy=document.documentElement.dataset.simplePieces==='1';
  const sourcePiece=sourceSquare?.querySelector(fantasy?'.rpchess-piece-symbol':'.classic-piece');
  const candidate=sourcePiece?.cloneNode(true);
  stopReplayFlight();
  board.innerHTML=chessSquareBoard(entry.fen,playerColor,sides,'','',entry.uci);
  board.dataset.reviewAnalysisPly=String(done);
  const destSquare=board.querySelector('[data-review-square="'+to+'"]');
  if(!oldRect||!candidate||!destSquare||
     typeof Element.prototype.animate!=='function'||
     globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const destRect=destSquare.getBoundingClientRect();
  const target=destSquare.querySelector(fantasy?'.rpchess-piece-symbol':'.classic-piece');
  if(!target)return;
  target.style.setProperty('visibility','hidden','important');
  const flyer=document.createElement('div');
  flyer.className='rpchess-review-analysis-flyer';
  Object.assign(flyer.style,{left:oldRect.left+'px',top:oldRect.top+'px',
   width:oldRect.width+'px',height:oldRect.height+'px'});
  if(fantasy){
   candidate.style.setProperty('display','flex','important');
   candidate.style.setProperty('position','relative','important');
   candidate.style.setProperty('inset','auto','important');
   candidate.style.setProperty('width','100%','important');
   candidate.style.setProperty('height','100%','important');
  }else{
   Object.assign(candidate.style,{display:'block',width:'94%',height:'94%',objectFit:'contain'});
  }
  flyer.append(candidate);
  overlay.append(flyer);
  const token=++replayFlightSerial;
  const animation=flyer.animate([
   {transform:'translate3d(0,0,0)'},
   {transform:'translate3d('+(destRect.left-oldRect.left)+'px,'+
      (destRect.top-oldRect.top)+'px,0)'}
  ],{duration:260,easing:'cubic-bezier(.22,.8,.24,1)',fill:'forwards'});
  replayFlight={animation,flyer,target};
  board.dataset.reviewAnalysisAnimations=String(++replayAnimationCount);
  animation.finished.catch(()=>{}).finally(()=>{
   if(token===replayFlightSerial)stopReplayFlight();
  });
 }
 function showAnalysisProgress(done,total){
  if(cancelled)return;
  showReplayStep(done);
  const move=journal[done-1],label=move?((Math.ceil(move.ply/2))+(move.color==='w'?'.':'…')+' '+move.san):'';
  target.innerHTML='<div class="rpchess-review-loading" role="status">'+
   '<strong>'+tx.loading+': '+done+' / '+total+'</strong>'+
   (move?'<span>'+esc(label)+'</span>':'')+
   '<progress max="'+total+'" value="'+done+'" aria-label="'+tx.loading+'"></progress></div>';
 }
 function layoutReviewRail(){
  if(cancelled)return;
  const portrait=window.innerHeight>window.innerWidth;
  if(portrait){rail.style.width='100%';rail.style.maxWidth='none';return;}
  const gutter=rankLabels.getBoundingClientRect().left-overlay.getBoundingClientRect().left-4;
  const width=Math.max(0,Math.floor(gutter))+'px';
  rail.style.width=width;rail.style.maxWidth=width;
 }
 window.addEventListener('resize',layoutReviewRail);
 layoutReviewRail();
 function close(){
  if(cancelled)return;
  cancelled=true;serial++;
  stopReplayFlight();
  worker?.close();worker=null;
  window.removeEventListener('resize',layoutReviewRail);
  document.removeEventListener('keydown',onEscape);
  overlay.remove();
 }
 function onEscape(e){if(e.key==='Escape'){e.preventDefault();close();}}
 document.addEventListener('keydown',onEscape);
 function resetExercise(){
  serial++;selectedSquare='';feedback='';feedbackKind='';
  boardMode='before';browsePly=null;attemptFen='';attemptUci='';attemptLoss=null;
  pendingPromotion=null;busy=false;variation=null;variationIndex=0;variationLoading=false;
  const remembered=acceptedMoves.get(selected),item=cases[selected];
  if(remembered&&item){
   const game=new ClassicChessEngine(item.beforeFen);
   if(reviewUci(game,remembered.uci)){
    boardMode='attempt';attemptUci=remembered.uci;
    attemptFen=game.fen();attemptLoss=remembered.loss;
   }
  }
 }
 function done(i){return solved.has(i)||revealed.has(i)||skipped.has(i);}
 function completedCount(){return cases.filter((_,i)=>done(i)).length;}
 function goTo(index){
  if(busy||index<0||index>=cases.length)return;
  selected=index;resetExercise();render();
 }
 function nextLesson(){
  if(busy)return;
  let next=cases.findIndex((_,i)=>i>selected&&!done(i));
  if(next<0)next=cases.findIndex((_,i)=>!done(i));
  if(next>=0){selected=next;resetExercise();}
  else{selected=cases.length;resetExercise();}
  render();
 }
 function showEvaluation(model){
  evalWhite.style.height=model?model.whitePercent+'%':'50%';
  evalScore.textContent=model?model.display:'—';
  evalBar.setAttribute('aria-label',tx.label+': '+(model?model.display:(en?'unknown':'нет данных')));
 }
 function renderJournal(){
  const errorsByPly=new Map(cases.map((item,i)=>[item.ply,{...item,index:i}]));
  let rows='';
  for(let n=0;n<journal.length;n+=2){
   rows+='<div class="rpchess-review-move-row"><span class="rpchess-review-move-no">'+(Math.floor(n/2)+1)+'.</span>';
   for(let off=0;off<2;off++){
    const entry=journal[n+off],error=entry&&errorsByPly.get(entry.ply);
    if(!entry){rows+='<span class="rpchess-review-move-empty"></span>';continue;}
    const kind=annotations[entry.ply]?.kind||(error?.severity)||null,mark=kind?REVIEW_MARKS[kind]:'';
    const highlight=error?.index===selected&&browsePly===null?' is-active':'';
    const shown=browsePly===entry.ply?' is-browsing':'';
    rows+='<button type="button" data-review-move="'+entry.ply+'"'+
     (error?' data-review-case="'+error.index+'"':'')+
     ' class="rpchess-review-move'+highlight+shown+(error?' is-error':'')+
     '" aria-label="'+esc((Math.ceil(entry.ply/2))+(entry.color==='w'?'.':'…')+' '+entry.san+(kind?' '+(kind==='good'?tx.goodMove:tx[kind]):''))+'">'+
     '<span class="rpchess-review-move-content"><span class="rpchess-review-piece-glyph rpchess-review-piece-glyph--'+entry.color+'" aria-hidden="true">'+REVIEW_PIECE_GLYPHS[entry.color][entry.pieceType]+'</span>'+
     '<span class="rpchess-review-san">'+esc(entry.san)+'</span>'+
     (kind?'<b class="rpchess-review-symbol rpchess-review-symbol--'+kind+'">'+mark+'</b>':'')+
     '</span>'+
     (error&&done(error.index)?'<span class="rpchess-review-done">✓</span>':'')+
     '</button>';
   }
   rows+='</div>';
  }
  return rows;
 }
 function render(){
  if(cancelled)return;
  // Rebuilding the panel used to recreate the move-list DOM and reset its
  // scrollTop to zero on every move selection. Restore the player's viewport.
  const oldList=target.querySelector('.rpchess-review-movelist');
  const moveListScrollTop=oldList?oldList.scrollTop:null;
  const focusedPly=oldList?.contains(document.activeElement)?
   document.activeElement.closest('[data-review-move]')?.dataset.reviewMove:null;
  const active=cases[selected],doneCount=completedCount();
  let fen=active?.beforeFen||journal.at(-1)?.fen||new ClassicChessEngine().fen(),lastMove='';
  if(browsePly!==null){
   const entry=journal[browsePly-1];
   if(entry){fen=entry.fen;lastMove=entry.uci;}
  }else if(variation?.length){
   if(variationIndex>0){
    const step=variation[variationIndex-1];
    if(step){fen=step.fen;lastMove=step.uci;}
   }else{fen=active.beforeFen;lastMove='';}
  }else if(boardMode==='attempt'&&attemptFen){fen=attemptFen;lastMove=attemptUci;}
  board.innerHTML=chessSquareBoard(fen,playerColor,sides,selectedSquare,'',lastMove);
  const model=active&&browsePly===null&&(!variation||variationIndex<=1)?
   reviewEvaluation(active.beforeCp,playerColor,boardMode==='attempt'?attemptLoss:null):null;
  showEvaluation(model);
  const counts={excellent:0,good:0,inaccuracy:0,mistake:0,blunder:0};
  Object.values(annotations).forEach(item=>{if(Object.hasOwn(counts,item.kind))counts[item.kind]++;});
  const legend=['excellent','good','inaccuracy','mistake','blunder'].map(kind=>
   '<div class="rpchess-review-legend-item"><b class="rpchess-review-symbol rpchess-review-symbol--'+kind+'">'+
   REVIEW_MARKS[kind]+'</b><span>'+(kind==='good'?tx.goodMove:tx[kind])+'</span><strong>'+counts[kind]+'</strong></div>').join('');
  let practice='';
  if(!cases.length){
   practice='<p class="rpchess-review-empty">'+tx.nothing+'</p>';
  }else if(!active){
   practice='<p class="rpchess-review-outcome">'+tx.completed+'</p>'+
    '<div class="rpchess-review-actions"><button type="button" data-review-action="again" class="rpchess-review-button rpchess-review-button--primary">'+tx.again+'</button></div>';
  }else if(browsePly!==null){
   practice='<p class="rpchess-review-prompt">'+tx.offTrack+'</p>'+
    '<div class="rpchess-review-actions"><button type="button" data-review-action="resume" class="rpchess-review-button rpchess-review-button--primary">'+tx.resume+'</button></div>';
  }else{
   const entry=journal[active.ply-1],moveNo=Math.ceil(active.ply/2)+(active.ply%2===1?'.':'…');
   const severity=REVIEW_MARKS[active.severity],position=tx.find+' '+(playerColor==='w'?tx.white:tx.black);
   practice='<div class="rpchess-review-task"><strong>'+moveNo+' '+esc(entry?.san||active.uci)+
     ' <b class="rpchess-review-symbol rpchess-review-symbol--'+active.severity+'">'+severity+'</b> '+tx.played+'</strong>'+
     '<p>'+position+'</p></div>';
   if(feedback)practice+='<p class="rpchess-review-prompt rpchess-review-prompt--'+feedbackKind+'" role="status">'+feedback+'</p>';
   if(pendingPromotion){
    practice+='<div class="rpchess-review-promotions"><strong>'+(en?'Promote to':'Превращение в')+'</strong><div>';
    for(const kind of ['q','r','b','n'])practice+='<button type="button" data-review-promotion="'+kind+'" class="rpchess-review-button">'+kind.toUpperCase()+'</button>';
    practice+='</div></div>';
   }
   const finished=done(selected);
   practice+='<div class="rpchess-review-actions">';
   if(finished){
    if(!skipped.has(selected))practice+='<button type="button" data-review-action="variation" class="rpchess-review-button"'+(variationLoading?' disabled':'')+'>'+tx.showLine+'</button>';
    practice+='<button type="button" data-review-action="next" class="rpchess-review-button rpchess-review-button--primary">'+tx.next+'</button>';
   }else{
    practice+='<button type="button" data-review-action="solution" class="rpchess-review-button">'+tx.view+'</button>'+
     '<button type="button" data-review-action="skip" class="rpchess-review-button">'+tx.skip+'</button>';
   }
   practice+='</div>';
   if(variationLoading)practice+='<p class="rpchess-review-line-loading" role="status">'+tx.lineLoading+'</p>';
   if(variation?.length){
    const original=esc(entry?.san||active.uci),nextReal=journal[active.ply]?.san;
    practice+='<div class="rpchess-review-variation"><h4>'+tx.lineTitle+'</h4>'+
     '<div class="rpchess-review-line-compare"><span>'+tx.originalLine+': <strong>'+original+(nextReal?' '+esc(nextReal):'')+'</strong></span>'+
     '<span>'+(acceptedMoves.get(selected)?.uci&&acceptedMoves.get(selected).uci!==active.bestMove?tx.yourLine:tx.betterLine)+': <strong>'+variation.map(s=>esc(s.san)).join(' ')+'</strong></span></div>'+
     '<div class="rpchess-review-variation-controls"><button type="button" data-review-action="line-prev" class="rpchess-review-button"'+(variationIndex<=0?' disabled':'')+'>'+tx.linePrev+'</button>'+
     '<span class="rpchess-review-line-progress">'+variationIndex+' / '+variation.length+'</span>'+
     '<button type="button" data-review-action="line-next" class="rpchess-review-button"'+(variationIndex>=variation.length?' disabled':'')+'>'+tx.lineNext+'</button></div>'+
     '<p class="rpchess-review-line-note">'+tx.lineNote+'</p></div>';
   }
  }
  target.innerHTML='<section class="rpchess-review-moves-section"><h3 class="rpchess-review-section-title">'+tx.moves+'</h3>'+
    '<div class="rpchess-review-movelist">'+renderJournal()+'</div></section>'+
    '<section class="rpchess-review-legend" aria-label="'+tx.legend+'">'+
    '<h3 class="rpchess-review-section-title">'+tx.legend+'</h3><div class="rpchess-review-legend-grid">'+legend+'</div></section>'+
    '<section class="rpchess-review-learning"><div class="rpchess-review-summary">'+
    '<strong>'+tx.learn+'</strong><span>'+doneCount+' / '+cases.length+'</span></div>'+
    '<div class="rpchess-review-details">'+practice+'</div></section>';
  if(moveListScrollTop!==null){
   const newList=target.querySelector('.rpchess-review-movelist');
   if(newList)newList.scrollTop=moveListScrollTop;
  }
  if(focusedPly){
   target.querySelector('[data-review-move="'+focusedPly+'"]')?.focus({preventScroll:true});
  }
  board.setAttribute('aria-busy',String(busy));
 }
 async function submit(uci){
  if(cancelled||busy||!cases[selected]||browsePly!==null||done(selected))return;
  const item=cases[selected],stamp=++serial;
  const game=new ClassicChessEngine(item.beforeFen);
  const applied=reviewUci(game,uci);
  if(!applied){feedback=tx.invalid;feedbackKind='error';render();return;}
  busy=true;pendingPromotion=null;selectedSquare='';
  boardMode='attempt';attemptFen=game.fen();attemptUci=uci;attemptLoss=null;
  feedback=tx.check;feedbackKind='checking';render();
  try{
   const result=await gradeReviewAttempt(item,uci,{engine:worker});
   if(cancelled||stamp!==serial)return;
   busy=false;
   if(result.unavailable){
    feedback=tx.unavailable;feedbackKind='error';boardMode='before';attemptLoss=null;
   }else if(result.accepted){
    solved.add(selected);acceptedMoves.set(selected,{uci,loss:result.loss});
    feedback=tx.good;feedbackKind='correct';
    attemptLoss=result.loss;
   }else{
    feedback=tx.wrong;feedbackKind='error';boardMode='before';attemptLoss=null;
   }
  }catch{
   if(cancelled||stamp!==serial)return;
   busy=false;feedback=tx.unavailable;feedbackKind='error';boardMode='before';attemptLoss=null;
  }
  render();
 }
 async function showBestContinuation(){
  const item=cases[selected];
  if(!item||!done(selected)||skipped.has(selected)||busy||browsePly!==null)return;
  if(variation?.length){variationIndex=1;render();return;}
  if(!worker){feedback=tx.lineUnavailable;feedbackKind='error';render();return;}
  const stamp=++serial;busy=true;variationLoading=true;render();
  try{
   // The learner's accepted move may differ from the engine's first choice.
   // Analyse the actual accepted position, not a different recommendation.
   const chosen=reviewContinuationStart(item,acceptedMoves.get(selected)?.uci||item.bestMove);
   const analysis=await worker.evaluate(chosen.afterFen,{movetime:850});
   if(cancelled||serial!==stamp)return;
   const follow=analysis.pv?.length?analysis.pv:(chosen.isEngineBest?(item.pv||[]).slice(1):[]);
   variation=reviewEngineLine(item.beforeFen,[chosen.uci,...follow],9);
   if(variation.length<2){
    variation=null;feedback=tx.lineUnavailable;feedbackKind='error';
   }else{
    variationIndex=1;
    attemptLoss=acceptedMoves.get(selected)?.loss??0;
   }
  }catch{
   if(!cancelled&&serial===stamp){variation=null;feedback=tx.lineUnavailable;feedbackKind='error';}
  }finally{
   if(!cancelled&&serial===stamp){busy=false;variationLoading=false;render();}
  }
 }
 overlay.addEventListener('click',event=>{
  const action=event.target.closest('[data-review-action]');
  if(action){
   const key=action.dataset.reviewAction;
   if(key==='close'){close();return;}
   if(busy)return;
   if(key==='resume'){browsePly=null;render();return;}
   if(key==='again'){solved.clear();revealed.clear();skipped.clear();acceptedMoves.clear();selected=0;resetExercise();render();return;}
   if(key==='next'){nextLesson();return;}
   if(key==='line-prev'&&variation){variationIndex=Math.max(0,variationIndex-1);render();return;}
   if(key==='line-next'&&variation){variationIndex=Math.min(variation.length,variationIndex+1);render();return;}
   if(key==='variation'){showBestContinuation();return;}
   if(key==='skip'){
    if(cases[selected]){skipped.add(selected);nextLesson();}
    return;
   }
   if(key==='solution'){
    const item=cases[selected];
    if(!item)return;
    const game=new ClassicChessEngine(item.beforeFen);
    if(reviewUci(game,item.bestMove)){
     revealed.add(selected);acceptedMoves.set(selected,{uci:item.bestMove,loss:0});
     boardMode='attempt';attemptFen=game.fen();attemptUci=item.bestMove;
     attemptLoss=0;selectedSquare='';pendingPromotion=null;
     feedback=tx.solution+': '+item.bestMove;feedbackKind='correct';
     render();
    }
    return;
   }
  }
  if(busy)return;
  const move=event.target.closest('[data-review-move]');
  if(move){
   const index=move.dataset.reviewCase;
   if(index!==undefined){goTo(Number(index));return;}
   browsePly=Number(move.dataset.reviewMove);
   selectedSquare='';render();return;
  }
  const promotion=event.target.closest('[data-review-promotion]');
  if(promotion&&pendingPromotion){
   const uci=pendingPromotion+promotion.dataset.reviewPromotion;
   pendingPromotion=null;submit(uci);return;
  }
  const square=event.target.closest('[data-review-square]');
  if(!square||!cases[selected]||browsePly!==null||boardMode!=='before'||done(selected)||pendingPromotion)return;
  const item=cases[selected],game=new ClassicChessEngine(item.beforeFen),sq=square.dataset.reviewSquare;
  if(!selectedSquare){
   if(game.pieceAt(sq)?.color===playerColor){selectedSquare=sq;render();}
   return;
  }
  if(sq===selectedSquare){selectedSquare='';render();return;}
  const options=game.legalMoves(selectedSquare).filter(m=>(m.uciTo||m.to)===sq);
  if(!options.length){
   selectedSquare=game.pieceAt(sq)?.color===playerColor?sq:'';render();return;
  }
  const uci=selectedSquare+sq;
  if(options.some(m=>m.promotion)){pendingPromotion=uci;render();return;}
  submit(uci);
 });
 // Draw the real starting position immediately: the board is never empty
 // while Stockfish is performing its (potentially long) full-game analysis.
 board.innerHTML=chessSquareBoard(new ClassicChessEngine().fen(),playerColor,sides);
 board.dataset.reviewAnalysisPly='0';
 showEvaluation(null);
 (async()=>{
  if(!turns.length){
   target.innerHTML='<p>'+L.noMoves+'</p>';
   board.innerHTML=chessSquareBoard(journal.at(-1)?.fen||new ClassicChessEngine().fen(),playerColor,sides);
   showEvaluation(null);
   return;
  }
  try{
   worker=engineFactory?engineFactory():new StockfishReviewEngine();await worker.start();
   if(cancelled)return;
   const analysed=await analyseFinishedReview(turns,{engine:worker,annotate:true,playerColor,
    onProgress:showAnalysisProgress});
   if(cancelled)return;
   stopReplayFlight();
   cases=analysed.errors;annotations=analysed.annotations;
   if(!cases.length){worker.close();worker=null;}
   render();
  }catch{
   stopReplayFlight();
   if(!cancelled)target.innerHTML='<p>'+L.error+'</p>';
   worker?.close();worker=null;
  }
 })();
 return {close};
}
export { prepareFinishedReview,sampleReviewTurns,parseInfo,classifyLoss,classifyStrongMove,analyseFinishedReview,gradeReviewAttempt,reviewMoveJournal,reviewEngineLine,reviewContinuationStart,reviewEvaluation,StockfishReviewEngine,openFinishedGameReview };
