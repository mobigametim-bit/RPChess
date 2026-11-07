import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { ChessAIAdapter } from './chess-ai-adapter.mjs';
import { StockfishReviewEngine, reviewMoveJournal, gradeReviewAttempt, classifyStrongMove, openFinishedGameReview } from './finished-game-review.mjs?v=20261108-piece-verdicts-1';
import { boardRacePiecePath, racePiecePath, raceBoardTiles } from './race-assets.mjs';
import { attachPieceDrag } from './piece-drag.mjs';
import { applyPinIce } from './king-pin-ice.mjs';
import { makeToggle, syncToggles } from './board-view-toggle.mjs';
import { createMentorMotion } from './mentor-training-motion.mjs';
import { createMentorSpeech } from './mentor-training-speech.mjs?v=20261108-tts-speed-v3';
import { fantasyPieceMarkup } from './fantasy-piece.mjs';
import { currentLanguage, subscribe } from './i18n.mjs';
import { TRAINING_MENTORS, UCI, rebuildTraining, extendTraining, trainingMoveQualityWinChance } from './mentor-training-history.mjs';
import {buildMentorV2Payload,requestMentorV2Text} from './mentor-training-feedback-client.mjs?v=20261108-en-validation-v4';
import {validatedV2Facts,localMentorV2Fallback} from './mentor-training-feedback-v2.mjs?v=20261108-en-validation-v4';
import {mentorLessonCopy,validateLessonGuess} from './mentor-training-teaching.mjs?v=20261107-mentor-auto-pause-v3';
import {thinkingText,praiseText,fallbackText} from './mentor-training-copy.mjs';
import {POS,TACTIC,quickThreatProbe,verifyImmediateThreat} from './mentor-training-threat.mjs?v=20261107-mentor-stage4-v1';

const STORAGE_KEY='rpchess.mentor-training.v1';
const DEEP_ANALYSIS_MS=1700; // Only after a confirmed quick-analysis error.
const DEEP_PV_LIMIT=20;
const ROLES={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const SYMBOLS={w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}};
const TEXT={
 ru:{title:'Тренировка с наставником',back:'Главное меню',mentor:'Наставник',mentorThinking:'Думаю…',mentorSpeak:'Озвучить текст наставника',mentorStopSpeech:'Остановить озвучивание',mentorSpeechUnavailable:'Озвучивание недоступно в этом браузере',lesson:'Проверить себя',lessonHint:'Подсказка',lessonShow:'Показать ответ',lessonExit:'Продолжить партию',lessonAskAI:'Попросить совет наставника',correctionStart:'Исправить ход',correctionTitle:'Попробуй исправить свой ход',correctionInstruction:'Это учебная позиция до ошибки. Выбери более сильный ход на доске — сыгранная партия останется неизменной.',correctionChecking:'Проверяю твой ход…',correctionGood:'Хорошее решение!',correctionWrong:'Этот ход недостаточно улучшает позицию. Попробуй другое продолжение.',correctionUnavailable:'Не удалось проверить этот ход. Можешь попробовать снова или продолжить партию.',correctionBack:'К объяснению',correctionAgain:'Другой вариант',correctionStrong:'Сильный ход',correctionBest:'Лучший ход Stockfish:',correctionBoard:'Найди более сильный ход',lessonBoard:'Найди ответ соперника',lessonPending:'Наставник ищет опасное продолжение…',positional:'Позиция ухудшилась, но непосредственная тактическая угроза не подтверждена. Продолжай партию и следи за безопасностью фигур.',moves:'Ходы',white:'Белые',black:'Чёрные',random:'Случайно',start:'Начать тренировку',new:'Новая тренировка',exit:'К наставникам',prev:'Назад',next:'Вперёд',close:'Закрыть',journal:'Ходы',ready:'Ваш ход',thinking:'Соперник думает…',analysing:'Анализ хода…',waiting:'Оценка недоступна',fine:'Продолжайте партию.',inaccuracy:'Неточность',mistake:'Ошибка',blunder:'Зевок',noGrade:'Нет замечаний',loss:'Потеря оценки',retry:'Позиция ухудшилась. Попробуйте вернуться назад и найти более сильное продолжение.',reviewFail:'Не удалось проверить ход. Партию можно продолжать.',gameOver:'Партия завершена',check:'Шах!',promotion:'Превращение пешки',before:'Вернуться перед ошибкой',clear:'Начать заново',profile:'Мощь',restore:'Продолжить тренировку',victory:'Победа!',defeat:'Поражение',draw:'Ничья',reviewGame:'Анализировать',menu:'Главное меню',mentors:'К наставникам',good:'Хороший ход',excellent:'Блестящий ход',view:'Посмотреть',engineLine:'Вариант Stockfish',afterMistake:'После ошибки',returnToGame:'К партии',retryAI:'Повторить запрос ИИ'},
 en:{title:'Training with a Mentor',back:'Main menu',mentor:'Mentor',mentorThinking:'Thinking…',mentorSpeak:'Read mentor text aloud',mentorStopSpeech:'Stop narration',mentorSpeechUnavailable:'Text-to-speech is unavailable in this browser',lesson:'Test yourself',lessonHint:'Hint',lessonShow:'Reveal answer',lessonExit:'Continue game',lessonAskAI:'Ask the mentor for advice',correctionStart:'Improve your move',correctionTitle:'Try a better move',correctionInstruction:'This is a practice position before the mistake. Choose a stronger move on the board; your original game stays unchanged.',correctionChecking:'Checking your move…',correctionGood:'Good solution!',correctionWrong:'This move does not improve the position enough. Try another continuation.',correctionUnavailable:'The move could not be checked. Try again or continue the game.',correctionBack:'Back to explanation',correctionAgain:'Try another',correctionStrong:'Strong move',correctionBest:'Stockfish best move:',correctionBoard:'Find a stronger move',lessonBoard:'Find the opponent’s reply',lessonPending:'Mentor is checking the opponent’s reply…',positional:'The position became worse, but no immediate tactical threat was verified. Keep playing and watch your pieces’ safety.',moves:'Moves',white:'White',black:'Black',random:'Random',start:'Start training',new:'New training',exit:'Mentors',prev:'Back',next:'Forward',close:'Close',journal:'Moves',ready:'Your move',thinking:'Opponent thinking…',analysing:'Analysing move…',waiting:'Evaluation unavailable',fine:'Continue the game.',inaccuracy:'Inaccuracy',mistake:'Mistake',blunder:'Blunder',noGrade:'No issues found',loss:'Evaluation lost',retry:'This move worsened your position. Go back and try to find a stronger continuation.',reviewFail:'The move could not be evaluated. You can continue playing.',gameOver:'Game over',check:'Check!',promotion:'Promote pawn',before:'Return before error',clear:'Start over',profile:'Strength',restore:'Resume training',victory:'Victory!',defeat:'Defeat',draw:'Draw',reviewGame:'Analyse',menu:'Main menu',mentors:'Mentors',good:'Good move',excellent:'Brilliant move',view:'View',engineLine:'Stockfish line',afterMistake:'After the mistake',returnToGame:'Back to game',retryAI:'Retry AI explanation'}
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
const deepFeedbackCache=new Map();
const deepInFlight=new Map();
let boardNode=null,dragActive=false,motion=null;
let mentorReplyAbort=null;
let analysisView=null; // Separate engine variation viewer; never mutates played history.
let lessonView=null; // Automatic interactive lesson, on the post-mistake position.
let correctionView=null; // Ephemeral practice board before the error: NEVER mutates actual moves.
let pausedEntry=null; // Delay the opponent's move until the learner continues.
let lessonFlashSeq=0;
const mentorReplyCache=new Map();
function lang(){return currentLanguage()==='en'?'en':'ru';}
function t(name){return TEXT[lang()][name]||name;}
const speech=createMentorSpeech({getRoot:()=>root,getLanguage:lang,translate:t});
function title(mentor){return mentor[lang()];}
function race(mentor){return RACES[lang()][mentor.race]||mentor.race;}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function mentor(){return TRAINING_MENTORS[selected-1];}
function save(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,selected,color,playing,moves,cursor,pausedAt:pausedEntry?moves.indexOf(pausedEntry):-1,
  lessonSolved:Boolean(pausedEntry&&(lessonView?.stage===3||correctionView?.entry===pausedEntry))}));}catch{}
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
  pausedEntry=Number.isInteger(raw.pausedAt)&&raw.pausedAt>=0&&raw.pausedAt===cursor-1&&
   cursor===moves.length&&moves[raw.pausedAt]?.threatStatus===TACTIC&&['inaccuracy','mistake','blunder'].includes(moves[raw.pausedAt]?.grade)
   ?moves[raw.pausedAt]:null;
  const lessonSolved=Boolean(raw.lessonSolved&&pausedEntry?.mentorLesson);
  lessonView=pausedEntry?{entry:pausedEntry,plan:pausedEntry.mentorLesson||null,
   stage:pausedEntry.mentorLesson?(lessonSolved?3:0):-1,feedback:null}:null;
  analysisView=lessonSolved&&pausedEntry?.analysisLine?.length
   ?{entry:pausedEntry,index:raw.pausedAt,offset:1}:null;
  correctionView=null;
  if(pausedEntry?.mentorRequested&&!pausedEntry?.mentorSource){
   // Never charge again for a request lost during reload.
   pausedEntry.mentorRequested=false;pausedEntry.pending=false;
  }
 }catch{playing=false;moves=[];cursor=0;pausedEntry=null;lessonView=null;correctionView=null;}
}
function game(){return rebuildTraining(moves,cursor);}
function cancel(){
 speech.stop();
 mentorReplyAbort?.abort();mentorReplyAbort=null;analysisView=null;lessonView=null;correctionView=null;pausedEntry=null;
 gameEpoch++;busy=false;analysisPending=false;square=null;promotion=null;dragActive=false;
 motion?.clear();ai?.stop();review?.close();review=null;reviewStarted=null;reviewChain=Promise.resolve();evaluationInFlight=new Map();deepInFlight.clear();
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
 motion=createMentorMotion(root);
 root.addEventListener('click',onClick);
 subscribe(()=>{speech.stop();entry.textContent=t('title');if(!root.hidden)render();});
 addEventListener('beforeunload',()=>{speech.stop();ai?.destroy();review?.close();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)speech.stop();});
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
function powerValue(value){
 return '<span class="mentor-power" aria-label="'+esc(t('profile')+': '+value)+'">'+
 '<img class="mentor-power-icon" alt="" aria-hidden="true" src="generated_assets/node_battle.png">'+
 '<span>'+value+'</span></span>';
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
   cards+='<button type="button" class="mentor-choice'+(selected===item.id?' is-selected':'')+'" data-mentor-id="'+item.id+'" aria-label="'+esc(title(item)+', '+race(item)+', '+t('profile')+': '+item.elo)+'" aria-pressed="'+(selected===item.id)+'">'+picture(item,'mentor-choice-art')+
   '<span class="mentor-choice-meta"><strong>'+esc(title(item))+'</strong><small>'+esc(race(item))+'</small>'+powerValue(item.elo)+'</span></button>';
  }
  cards+='</div>';
 }
 const colors=[['w','♔ '+t('white')],['b','♚ '+t('black')],['r',t('random')]].map(([value,label])=>'<button type="button" data-mentor-color="'+value+'" class="'+(color===value?'is-selected':'')+'">'+esc(label)+'</button>').join('');
 return '<section class="mentor-setup"><header class="mentor-top">'+
 '<h1>'+t('title')+'</h1>'+button('leave',t('back'),'mentor-small-btn')+'</header>'+
 '<div class="mentor-setup-body"><section class="mentor-selected mentor-card">'+picture(m,'mentor-selected-art')+
 '<strong class="mentor-selected-name">'+esc(title(m))+'</strong><span class="mentor-selected-level"><span class="mentor-selected-race">'+esc(race(m))+'</span>'+powerValue(m.elo)+'</span>'+
 '<div class="mentor-colors">'+colors+'</div>'+button('start',t('start'),'mentor-primary')+'</section>'+
 '<section class="mentor-catalog mentor-card"><div class="mentor-catalog-scroll">'+cards+'</div></section></div></section>';
}
function currentPlayerColor(){return color==='r'?'w':color;}
function startTraining(){
 cancel();moves=[];cursor=0;playing=true;journalOpen=false;
 if(color==='r')color=Math.random()<.5?'w':'b';
 ai?.destroy();ai=new ChessAIAdapter();feedbackCache.clear();deepFeedbackCache.clear();
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
   rows+=item?'<button type="button" data-mentor-ply="'+(pos+1)+'" class="'+(cursor===pos+1?'is-active':'')+'">'+esc(item.san)+(note?.grade?'<em class="mentor-grade mentor-grade--'+note.grade+'">'+({'inaccuracy':'?!','mistake':'?','blunder':'??',good:'!',excellent:'!!'}[note.grade])+'</em>':'')+'</button>':'<i>—</i>';
  }
  rows+='</div>';
 }
 return rows||'<div class="mentor-empty">—</div>';
}
function resultHTML(status){
 const won=status.type==='checkmate'&&status.winner===currentPlayerColor();
 const draw=status.winner===null;
 const headline=won?t('victory'):draw?t('draw'):t('defeat');
 const symbol=won?'♕':draw?'½':'♚';
 return '<div class="mentor-result-overlay" data-mentor-result>'+
 '<section class="mentor-result-panel" role="dialog" aria-modal="true" aria-label="'+esc(headline)+'">'+
 '<span class="mentor-result-emblem" aria-hidden="true">'+symbol+'</span>'+
 '<h2>'+esc(headline)+'</h2>'+
 '<div class="mentor-result-actions">'+
 button('result-review',t('reviewGame'),'mentor-primary')+
 button('leave',t('menu'),'mentor-outline')+
 button('catalog',t('mentors'),'mentor-outline')+
 '</div></section></div>';
}
function navigation(){
 return '<div class="mentor-navigation"><button type="button" data-mentor-action="prev" '+(cursor===0?'disabled':'')+' aria-label="'+t('prev')+'">❮ '+t('prev')+'</button>'+
 '<button type="button" data-mentor-action="next" '+(cursor===moves.length?'disabled':'')+' aria-label="'+t('next')+'">'+t('next')+' ❯</button></div>';
}
function boardHTML(chess,preview=false){
 const whiteBottom=currentPlayerColor()==='w',state=chess.snapshot(),files='abcdefgh',legal=square?chess.legalMoves(square):[];
 const tiles=raceBoardTiles(mentor().race);
 const checkedKing=state.status.checked
  ?state.board.findIndex(piece=>piece?.type==='k'&&piece.color===state.turn):-1;
 const last=correctionView ? ((correctionView.bestShown?correctionView.bestMove:correctionView.accepted?correctionView.chosenUci:null)?{uci:correctionView.bestShown?correctionView.bestMove:correctionView.chosenUci}:null) : preview&&analysisView ? (analysisView.offset ? {uci:analysisView.entry.analysisLine[analysisView.offset-1]} : analysisView.entry) : moves[cursor-1];
 const recentOwn=preview ? (analysisView?.offset===0 ? analysisView.entry : null) : moves.slice(0,cursor).reverse().find(entry=>entry.color===currentPlayerColor());
 const mark=recentOwn?.grade?recentOwn.uci.slice(2,4):null;
 let grid='';
 for(let r=0;r<8;r++)for(let f=0;f<8;f++){
  const file=whiteBottom?f:7-f,rank=whiteBottom?7-r:r,index=rank*8+file;
  const sq=files[file]+(rank+1),piece=state.board[index],dark=(file+rank)%2===0;
  const active=selected!==null&&square===sq,possible=legal.some(m=>(m.uciTo||m.to)===sq);
  const highlight=last&&[last.uci.slice(0,2),last.uci.slice(2,4)].includes(sq);
  const lessonMark=lessonView?.entry===analysisView?.entry&&lessonView?.stage===3;
  const lessonOrigin=lessonMark&&sq===lessonView.plan.from;
  const lessonTarget=lessonMark&&sq===lessonView.plan.to;
  const lessonThreat=lessonMark&&lessonView.plan.targets?.includes(sq)&&!lessonOrigin&&!lessonTarget;
  const correctionFlash=correctionView?.flash;
  const flash=lessonView?.feedback?.square===sq?lessonView.feedback:
   correctionFlash?.square===sq?correctionFlash:null;
   const flyDown=['1','2','7','8'].includes(sq[1]);
  const ownRace=piece?.color===currentPlayerColor()?'humans':mentor().race;
  let figure='';
  if(piece){
   figure='<img alt="" class="mentor-piece classic-piece" draggable="false" src="'+boardRacePiecePath(ownRace,ROLES[piece.type],piece.color)+'"><span class="mentor-piece-fallback">'+SYMBOLS[piece.color][piece.type]+'</span>'+fantasyPieceMarkup(piece.type,piece.color);
  }
  const sign=mark===sq&&piece?.color===currentPlayerColor()?'<span class="mentor-square-grade'+(['good','excellent'].includes(recentOwn.grade)?' mentor-square-grade--good':'')+'">'+({'inaccuracy':'?!','mistake':'?','blunder':'??',good:'!',excellent:'!!'}[recentOwn.grade])+'</span>':'';
  const flashText=flash?(flash.text||mentorLessonCopy(lessonView.plan,lang())[flash.kind]):'';
  const flashArt=flash?'<span class="mentor-lesson-aura mentor-lesson-aura--'+flash.kind+'" aria-hidden="true"></span>'+
    '<span class="mentor-lesson-burst mentor-lesson-burst--'+flash.kind+(flash.correction?' mentor-lesson-burst--correction':'')+(flyDown?' mentor-lesson-burst--down':'')+'" role="status">'+esc(flashText)+'</span>':'';
  grid+='<button type="button" data-mentor-square="'+sq+'" data-square="'+sq+'" class="mentor-square '+(dark?'is-dark':'is-light')+(highlight?' is-last':'')+(active?' is-selected':'')+(possible?' is-legal':'')+(index===checkedKing?' is-check classic-square--check':'')+(lessonOrigin?' mentor-lesson-origin':'')+(lessonTarget?' mentor-lesson-target':'')+(lessonThreat?' mentor-lesson-threat':'')+(flash?' mentor-square-flash':'')+'" aria-label="'+sq+'">'+figure+sign+flashArt+'</button>';
 }
 const status=chess.status();
 // CSS variables consumed by an external stylesheet resolve relative url() against /css/.
 // Use document-absolute URLs so race artwork also works under /RPChess/ on GitHub Pages.
 const lightTile=new URL(tiles.light,document.baseURI).href;
 const darkTile=new URL(tiles.dark,document.baseURI).href;
 return '<div class="mentor-board-shell"><div class="mentor-board" data-mentor-race="'+tiles.raceTag+'" style="--mentor-light-tile:url('+lightTile+');--mentor-dark-tile:url('+darkTile+')">'+grid+'</div><div class="mentor-file-coords">'+(whiteBottom?files.split(''):[...files].reverse()).map(v=>'<span>'+v+'</span>').join('')+'</div><div class="mentor-rank-coords">'+(whiteBottom?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8]).map(v=>'<span>'+v+'</span>').join('')+'</div></div>';
}
function latestPlayerNote(){
 for(let index=cursor-1;index>=0;index--){
  const move=moves[index];
  if(move?.color===currentPlayerColor())return move.grade?{move,index}:null;
 }
 return null;
}
function correctionBoard(){
 if(!correctionView)return game();
 const board=new ClassicChessEngine(correctionView.beforeFen);
 const uci=correctionView.bestShown?correctionView.bestMove:correctionView.accepted?correctionView.chosenUci:null;
 if(uci){
  board.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
 }
 return board;
}
function variationPosition(){
 if(correctionView)return correctionBoard();
 if(!analysisView)return game();
 const chess=new ClassicChessEngine(analysisView.entry.analysisFen);
 for(const uci of analysisView.entry.analysisLine.slice(0,analysisView.offset)){
  const result=chess.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
  if(!result.ok)break;
 }
 return chess;
}
function variationHTML(entry,index){
 if(!Array.isArray(entry.analysisLine)||!entry.analysisLine.length)return '';
 let san=[];
 try{san=reviewMoveJournal(entry.analysisLine,{startFen:entry.analysisFen});}catch{return '';}
 const active=analysisView?.index===index;
 const fields=entry.analysisFen.split(' ');
 const turn=fields[1],full=fields[5];
 const startPly=(Math.max(1,Number(full)||1)-1)*2+(turn==='b'?1:0);
 const previewButtons=san.map((item,i)=>{
  const moveIndex=startPly+i,number=Math.floor(moveIndex/2)+1;
  const label=number+(moveIndex%2?'...':'.')+' '+item.san;
  return '<button type="button" data-mentor-line="'+(i+1)+'" class="mentor-variation-move'+(active&&analysisView.offset===i+1?' is-active':'')+'" aria-pressed="'+(active&&analysisView.offset===i+1)+'">'+esc(label)+'</button>';
 }).join('');
 return '<div class="mentor-variation" '+(!active?'hidden':'')+'><div class="mentor-variation-heading"><strong>'+t('engineLine')+'</strong>'+
 button('close-variation',t('returnToGame'),'mentor-small-btn')+'</div>'+
 '<div class="mentor-variation-moves"><button type="button" data-mentor-line="0" class="mentor-variation-move'+(active&&analysisView.offset===0?' is-active':'')+'">'+t('afterMistake')+'</button>'+previewButtons+'</div>'+
 '<div class="mentor-variation-navigation"><button type="button" data-mentor-action="line-prev" '+(active&&analysisView.offset===0?'disabled':'')+'>❮ '+t('prev')+'</button>'+
 '<button type="button" data-mentor-action="line-next" '+(active&&analysisView.offset>=entry.analysisLine.length?'disabled':'')+'>'+t('next')+' ❯</button></div></div>';
}
function lessonHTML(data){
 if(!data||!lessonView||lessonView.entry!==data)return '';
 const waiting=!lessonView.plan;
 if(waiting)return '<section class="mentor-learning" aria-live="polite"><strong class="mentor-learning-question">'+t('lessonPending')+'</strong>'+
  '<div class="mentor-learning-buttons">'+button('lesson-close',t('lessonExit'),'mentor-outline')+'</div></section>';
 const plan=lessonView.plan,copy=mentorLessonCopy(plan,lang()),solved=lessonView.stage===3;
 let section='<section class="mentor-learning" aria-label="'+esc(t('lesson'))+'">';
 if(!solved){
  section+='<strong class="mentor-learning-question">'+esc(copy.question)+'</strong>'+
   '<p class="mentor-learning-instruction">'+esc(copy.instruction)+'</p>';
  if(lessonView.stage>=1)section+='<p class="mentor-learning-hint">'+esc(copy.hint1)+'</p>';
  if(lessonView.stage>=2)section+='<p class="mentor-learning-hint">'+esc(copy.hint2)+'</p>';
 }else{
  section+='<p class="mentor-learning-answer">'+esc(copy.answer)+'</p>'+ 
   
   '<small class="mentor-learning-caveat">'+esc(copy.optional)+'</small>';
 }
 section+='<div class="mentor-learning-buttons">';
 if(!solved){
  if(lessonView.stage<2)section+=button('lesson-hint',t('lessonHint'),'mentor-outline');
  section+=button('lesson-reveal',t('lessonShow'),'mentor-outline');
 }
 if(solved&&data.mentorPayload&&!data.mentorSource&&!data.pending)
  section+=button('lesson-ask-ai',t('lessonAskAI'),'mentor-outline');
 if(solved&&pausedEntry===data&&data.mentorPayload?.beforeFen&&UCI.test(data.mentorPayload.before?.bestMove||''))
  section+=button('correction-start',t('correctionStart'),'mentor-outline mentor-correction-start');
 section+=button('lesson-close',t('lessonExit'),'mentor-outline')+'</div></section>';
 return section;
}
function correctionSeconds(c){
 return Math.max(0,Math.ceil((c.revealAt-Date.now())/1000));
}
function updateCorrectionCountdown(c,epoch){
 if(correctionView!==c||gameEpoch!==epoch||!correctionSeconds(c))return;
 const leftMs=c.revealAt-Date.now();
 const delay=Math.max(20,leftMs-(correctionSeconds(c)-1)*1000+30);
 setTimeout(()=>{
  if(correctionView!==c||gameEpoch!==epoch)return;
  const seconds=correctionSeconds(c);
  const button=root?.querySelector('[data-mentor-action="correction-strong"]');
  if(button){
   button.textContent=t('correctionStrong')+(seconds?' ('+seconds+')':'');
   button.disabled=seconds>0||c.checking;
  }
  if(seconds)updateCorrectionCountdown(c,epoch);
 },delay);
}
function correctionHTML(data){
 if(!correctionView||correctionView.entry!==data)return '';
 const c=correctionView,seconds=correctionSeconds(c);
 const reply=c.checking?t('correctionChecking'):
  c.outcome==='unavailable'?t('correctionUnavailable'):'';
 const result=reply?'<p class="mentor-correction-result" role="status">'+esc(reply)+'</p>':'';
 const best=c.bestShown?'<p class="mentor-correction-best" role="status">'+
  esc(t('correctionBest'))+' <strong>'+esc(c.bestMove.slice(0,2)+'–'+c.bestMove.slice(2))+'</strong></p>':'';
 const hint='<button type="button" class="mentor-outline mentor-correction-strong" data-mentor-action="correction-strong" '+
  (seconds||c.checking?'disabled ':'')+'>'+esc(t('correctionStrong')+(seconds?' ('+seconds+')':''))+'</button>';
 return '<section class="mentor-learning mentor-correction" aria-label="'+esc(t('correctionTitle'))+'">'+
  '<strong class="mentor-learning-question">'+esc(t('correctionTitle'))+'</strong>'+
  '<p class="mentor-learning-instruction">'+esc(t('correctionInstruction'))+'</p>'+result+best+
  '<div class="mentor-learning-buttons">'+hint+
  (c.accepted||c.bestShown?button('correction-again',t('correctionAgain'),'mentor-outline'):'')+
  button('correction-back',t('correctionBack'),'mentor-outline')+
  button('correction-close',t('lessonExit'),'mentor-outline')+'</div></section>';
}
function startCorrection(){
 const entry=lessonView?.entry,payload=entry?.mentorPayload;
 if(!entry||lessonView?.stage!==3||pausedEntry!==entry||cursor!==moves.length||
    !payload?.beforeFen||!UCI.test(payload.before?.bestMove||'')||!Number.isFinite(payload.before?.cp))return;
 try{
  const board=new ClassicChessEngine(payload.beforeFen);
  if(board.turn()!==currentPlayerColor()||board.status().over)return;
 }catch{return;}
 correctionView={entry,beforeFen:payload.beforeFen,beforeCp:payload.before.cp,
  bestMove:payload.before.bestMove,accepted:false,chosenUci:null,checking:false,outcome:null,flash:null,
  revealAt:Date.now()+10000,bestShown:false};
 lessonView=null;analysisView=null;promotion=null;square=null;motion?.clear();
 save();render();updateCorrectionCountdown(correctionView,gameEpoch);
}
async function submitCorrection(from,to,promote=null){
 const c=correctionView;
 if(!c||c.checking||c.accepted||c.bestShown||cursor!==moves.length||pausedEntry!==c.entry)return;
 const uci=from+to+(promote||'');
 const board=new ClassicChessEngine(c.beforeFen);
 if(!board.legalMoves(from).some(m=>m.to===to&&(m.promotion||null)===(promote||null)))return;
 c.checking=true;c.outcome=null;square=null;promotion=null;render();
 try{
  // Reuse existing game-review grading. A 70cp tolerance accepts equivalent
  // moves, not only exact engine UCI. Review and rival use separate workers.
  const result=await gradeReviewAttempt(
   {beforeFen:c.beforeFen,beforeCp:c.beforeCp,bestMove:c.bestMove},
   uci,{engine:{evaluate:fen=>evaluate(fen)},tolerance:70});
  if(c!==correctionView||cursor!==moves.length||pausedEntry!==c.entry)return;
  c.checking=false;c.accepted=Boolean(result.accepted);
  c.chosenUci=c.accepted?uci:null;
  c.outcome=c.accepted?'correct':result.unavailable?'unavailable':'wrong';
  c.flash=c.outcome==='correct'?{id:++lessonFlashSeq,kind:'correct',square:to,text:t('correctionGood')}:
   c.outcome==='wrong'?{id:++lessonFlashSeq,kind:'wrong',square:from,text:t('correctionWrong'),correction:true}:null;
  if(c.flash){
   const flash=c.flash,epoch=gameEpoch;
   setTimeout(()=>{
    if(correctionView!==c||c.flash!==flash||gameEpoch!==epoch)return;
    c.flash=null;render();
   },c.outcome==='wrong'?3600:1200);
  }
 }catch{
  if(c!==correctionView||cursor!==moves.length||pausedEntry!==c.entry)return;
  c.checking=false;c.outcome='unavailable';
 }
 save();render();
}
function returnFromCorrection(resume){
 const c=correctionView;
 if(!c)return;
 correctionView=null;analysisView=null;square=null;promotion=null;
 if(resume){
  const shouldResume=pausedEntry===c.entry&&cursor===moves.length;
  if(shouldResume)pausedEntry=null;
  lessonView=null;save();render();
  if(shouldResume)resumeAI();
 }else{
  lessonView={entry:c.entry,plan:c.entry.mentorLesson,stage:3,feedback:null};
  if(Array.isArray(c.entry.analysisLine)&&c.entry.analysisLine.length)
   analysisView={entry:c.entry,index:moves.indexOf(c.entry),offset:1};
  save();render();
 }
}
function feedbackHTML(){
 const found=latestPlayerNote(),data=found?.move||null;
 const mark=data?({inaccuracy:'?!',mistake:'?',blunder:'??',good:'!',excellent:'!!'}[data.grade]||''):'';
 const label=data?t(data.grade):'';
 let copy=data?.message||'';
 if(!data&&analysisPending)copy=t('analysing');
 else if(!data&&!busy)copy=t('fine');
 const positive=data&&['good','excellent'].includes(data.grade);
 const canView=Boolean(data?.analysisLine?.length&&!positive);
 return '<section class="mentor-feedback mentor-card"><div class="mentor-feedback-head">'+picture(mentor(),'mentor-face')+
 '<h2>'+t('mentor')+'</h2>'+speech.buttonMarkup()+(data?.pending?'<span class="mentor-thinking" role="status" aria-live="polite">'+t('mentorThinking')+'</span>':'')+'</div>'+
 (data?'<div class="mentor-feedback-grade'+(positive?' mentor-feedback-grade--good':'')+'"><strong>'+mark+'</strong><span>'+label+'</span></div>':'')+
 (data?.mentorSource&&data.message&&(!lessonView||lessonView.stage===3)?
   '<p class="mentor-learning-mentor-note mentor-ai-explanation" data-mentor-ai-explanation role="note">'+esc(data.message)+'</p>':'')+
  (lessonView?.entry===data||correctionView?.entry===data||(data?.mentorSource&&data.message)?'':'<p class="mentor-feedback-text">'+esc(copy)+'</p>')+
 (canView&&!lessonView&&!correctionView?(analysisView?'':'<div class="mentor-analysis-actions">'+button('open-variation',t('view'),'mentor-outline mentor-view-btn')+'</div>')+variationHTML(data,found.index):'')+
 lessonHTML(data)+correctionHTML(data)+
 (data?.mentorSource==='fallback'&&data.mentorPayload?button('retry-explanation',t('retryAI'),'mentor-outline mentor-retry-ai'):'')+
 (found&&!positive&&!lessonView&&!correctionView&&data?.threatStatus===TACTIC?button('before-error',t('before'),'mentor-outline mentor-undo-error'):'')+'</section>';
}
function battleHTML(){
 const chess=variationPosition(),m=mentor(),status=chess.status();
 const notice=correctionView?t('correctionBoard'):lessonView?(lessonView.plan?t('lessonBoard'):t('analysing')):busy?(analysisPending?t('analysing'):t('thinking')):status.over?t('gameOver'):status.checked?t('check'):t('ready');
 return '<section class="mentor-battle"><header class="mentor-battle-top"><h1>'+t('title')+'</h1>'+
 '<div class="mentor-top-actions">'+button('journal',t('journal'),'mentor-small-btn mentor-journal-toggle')+
 button('catalog',t('exit'),'mentor-small-btn')+button('leave',t('back'),'mentor-small-btn')+'</div></header>'+
 '<aside class="mentor-journal mentor-card'+(journalOpen?' is-open':'')+'"><div class="mentor-journal-head"><h2>'+t('moves')+'</h2>'+
 button('journal',t('close'),'mentor-small-btn mentor-journal-close')+'</div>'+
 '<div class="mentor-rival">'+picture(m,'mentor-rival-art')+'<div><strong>'+esc(title(m))+'</strong><small>'+m.elo+' Elo</small></div></div>'+
 '<div class="mentor-history-head"><span>№</span><span>'+t('white')+'</span><span>'+t('black')+'</span></div>'+
 '<div class="mentor-history">'+getJournal()+'</div>'+navigation()+'</aside>'+
 '<div class="mentor-center"><div class="mentor-status">'+esc(notice)+'</div>'+boardHTML(chess,Boolean(analysisView||correctionView))+
 '<div class="mentor-mobile-navigation">'+navigation()+'<div class="mentor-mobile-toggle"></div></div></div>'+
 feedbackHTML()+
 (!analysisView&&cursor===moves.length&&status.over?resultHTML(status):'')+
 (promotion?'<div class="mentor-promotion"><div class="mentor-promotion-dialog"><h2>'+t('promotion')+'</h2>'+
 ['q','r','b','n'].map(v=>'<button type="button" data-mentor-promote="'+v+'">'+SYMBOLS[currentPlayerColor()][v]+'</button>').join('')+'</div></div>':'')+
 '</section>';
}
function highlightDragFrom(from){
 const board=boardNode;if(!board||!playing)return;
 square=from;
 board.querySelectorAll('.is-selected,.is-legal').forEach(node=>node.classList.remove('is-selected','is-legal'));
 board.querySelector('[data-square="'+from+'"]')?.classList.add('is-selected');
 for(const move of variationPosition().legalMoves(from))board.querySelector('[data-square="'+move.to+'"]')?.classList.add('is-legal');
}
function installMentorDrag(board){
 attachPieceDrag(board,{
  canPick:from=>Boolean(playing&&!busy&&!promotion&&!analysisView&&!lessonView&&!correctionView?.checking&&!correctionView?.accepted&&!correctionView?.bestShown&&cursor<=moves.length&&
   variationPosition().turn()===currentPlayerColor()&&variationPosition().pieceAt(from)?.color===currentPlayerColor()&&!variationPosition().status().over),
  onStart:from=>{dragActive=true;highlightDragFrom(from);},
  onDrop:(from,to)=>{
   dragActive=false;
   if(to&&variationPosition().legalMoves(from).some(move=>move.to===to)){
    if(correctionView){
     const candidate=variationPosition().legalMoves(from).filter(m=>m.to===to);
     if(candidate.some(m=>m.promotion)){promotion={from,to,correction:true};render();}
     else void submitCorrection(from,to);
    }else void userMove(from,to);
   }
   else {square=from;render();}
  },
  onCancel:()=>{dragActive=false;render();}
 });
}
function render(){
 if(!root||root.hidden||dragActive)return;
 const list=root.querySelector('.mentor-catalog-scroll'),oldScroll=list?.scrollTop||0;
 const historyList=root.querySelector('.mentor-history'),oldHistory=historyList?.scrollTop||0;
 root.innerHTML=playing?battleHTML():setupHTML();
 speech.onRender();
 if(!playing&&root.querySelector('.mentor-catalog-scroll'))root.querySelector('.mentor-catalog-scroll').scrollTop=oldScroll;
 if(playing){
  const fresh=root.querySelector('.mentor-board');
  if(boardNode){
   boardNode.innerHTML=fresh.innerHTML;
   boardNode.style.cssText=fresh.style.cssText;
   fresh.replaceWith(boardNode);
  }else{
   boardNode=fresh;
   installMentorDrag(boardNode);
  }
  applyPinIce(boardNode,variationPosition().snapshot());
  motion?.markArrival();
  root.querySelector('.mentor-journal-head')?.append(makeToggle());
  root.querySelector('.mentor-mobile-toggle')?.append(makeToggle());
  syncToggles();
  if(root.querySelector('.mentor-history'))root.querySelector('.mentor-history').scrollTop=oldHistory;
 }
}
function moveCursor(next){
 if(!playing||promotion)return;
 cancelPending();
 cursor=Math.max(0,Math.min(moves.length,next));
 save();render();
 // Browsing a previous move never requests a new computer response.
}
function cancelPending(){
 mentorReplyAbort?.abort();mentorReplyAbort=null;analysisView=null;lessonView=null;correctionView=null;pausedEntry=null;
 gameEpoch++;busy=false;analysisPending=false;square=null;promotion=null;dragActive=false;motion?.clear();ai?.stop();
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
function evaluateDeep(fen){
 if(deepFeedbackCache.has(fen))return Promise.resolve(deepFeedbackCache.get(fen));
 if(deepInFlight.has(fen))return deepInFlight.get(fen);
 // The same non-weakened Stockfish worker is shared with the quick review.
 // Rival replies run on the independent ChessAIAdapter and are not delayed.
 const task=reviewChain.catch(()=>{}).then(async()=>{
  const worker=await ensureReview();
  const result=await worker.evaluate(fen,{movetime:DEEP_ANALYSIS_MS});
  if(result?.depth>=5&&Array.isArray(result.pv)&&result.pv.length){
   result.pv=result.pv.slice(0,DEEP_PV_LIMIT);
   deepFeedbackCache.set(fen,result);
  }
  return result;
 });
 reviewChain=task.catch(()=>{});
 deepInFlight.set(fen,task);
 task.finally(()=>{if(deepInFlight.get(fen)===task)deepInFlight.delete(fen);}).catch(()=>{});
 return task;
}
function preEvaluate(){
 if(playing&&currentPlayerColor()===game().turn()&&!game().status().over)void evaluate(game().fen()).catch(()=>{});
}
function resumeAI(){
 if(!playing||cursor!==moves.length||busy||pausedEntry)return;
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
 const geometry=motion?.capture(chess,uci);
 const step=extendTraining(moves,cursor,uci);
 if(step.ok){moves=step.moves;cursor=step.cursor;moves[cursor-1].color=chess.turn();save();}
 busy=false;render();if(step.ok)motion?.play(geometry);preEvaluate();
}
async function deliverMentorFeedback(entry,payload,verified,cacheKey,epoch){
 let outcome=mentorReplyCache.get(cacheKey);
 if(!outcome){
  const controller=new AbortController();
  mentorReplyAbort?.abort();
  mentorReplyAbort=controller;
  try{
   outcome=await requestMentorV2Text({payload,verified,signal:controller.signal});
  }catch{
   outcome={explanation:localMentorV2Fallback(verified),source:'fallback',
    model:null,reason:'client_error',attempts:[],retryable:true};
  }
  if(controller.signal.aborted)return;
  if(mentorReplyAbort===controller)mentorReplyAbort=null;
  // Never cache an unsuccessful model response: the user can retry this position.
  if(outcome.source!=='fallback')mentorReplyCache.set(cacheKey,outcome);
 }
 if(epoch!==gameEpoch||!playing||!moves.includes(entry))return;
 entry.message=outcome.explanation;
 entry.pending=false;
 entry.mentorSource=outcome.source;
 entry.mentorModel=outcome.model||null;
 entry.mentorReason=outcome.reason||null;
 entry.mentorAttempts=outcome.attempts;
 entry.mentorModelAttempt=outcome.modelAttempt||1;
 entry.mentorFailures=outcome.failures||[];
 save();render();
}
async function explainVerifiedMove({beforeFen,afterFen,uci,kind,before,after,continuation,entry,epoch}){
 // The deep search was checked BEFORE pausing. Do not invent a second result.
 if(epoch!==gameEpoch||!playing||!moves.includes(entry)||entry.threatStatus!==TACTIC)return;
 let request;
 try{
  request=buildMentorV2Payload({
   beforeFen,afterFen,uci,grade:kind,before,after,
   continuation:continuation?.depth>=5?continuation:null,language:lang(),
   verifiedThreat:entry.mentorThreat
  });
 }catch{
  if(epoch===gameEpoch&&playing&&moves.includes(entry)){
   entry.message=fallbackText(lang(),kind);
   entry.mentorSource='fallback';entry.mentorReason='analysis_invalid';
   entry.pending=false;
   // Never retain a pause if the lesson cannot be validated end-to-end.
   if(pausedEntry===entry){pausedEntry=null;lessonView=null;entry.threatStatus=POS;}
   save();render();resumeAI();
  }
  return;
 }
 const cacheKey=beforeFen+'|'+uci+'|'+kind+'|'+lang();
 // Analysis and optional retry survive reload without a second Stockfish pass.
 entry.analysisFen=afterFen;
 entry.analysisLine=request.verified.afterLine.slice(0,DEEP_PV_LIMIT);
 entry.mentorLesson=request.verified.lesson;
 entry.mentorPayload=request.payload;
 if(pausedEntry===entry&&cursor===moves.length){
  // No opponent move has happened: the real board is exactly the exercise board.
  lessonView={entry,plan:entry.mentorLesson,stage:0,feedback:null};
  analysisView=null;square=null;
 }
 entry.pending=false;entry.mentorRequested=false;entry.message='';
 save();render();
 // Do not call the provider before the learner has answered.
}
function requestAfterAnswer(entry){
 if(!entry?.mentorPayload||entry.mentorRequested||entry.mentorSource)return;
 let verified;
 try{verified=validatedV2Facts(entry.mentorPayload);}catch{return;}
 entry.mentorRequested=true;entry.pending=true;
 const cacheKey='v2|'+verified.factId+'|'+verified.beforeFen+'|'+lang();
 save();render();
 void deliverMentorFeedback(entry,entry.mentorPayload,verified,cacheKey,gameEpoch);
}
async function retryMentorFeedback(){
 const found=latestPlayerNote(),entry=found?.move;
 if(!entry||entry.pending||entry.mentorSource!=='fallback'||!entry.mentorPayload)return;
 let verified;
 try{verified=validatedV2Facts(entry.mentorPayload);}
 catch{return;}
 const payload=entry.mentorPayload;
 const cacheKey=payload.beforeFen+'|'+payload.uci+'|'+payload.grade+'|'+payload.language;
 const epoch=gameEpoch;
 entry.pending=true;
 entry.message=thinkingText(lang(),cacheKey+'|retry');
 entry.mentorReason=null;
 save();render();
 await deliverMentorFeedback(entry,payload,verified,cacheKey,epoch);
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
 const geometry=motion?.capture(chess,uci);
 cancelPending();
 const epoch=gameEpoch;
 moves=change.moves;cursor=change.cursor;
 moves[cursor-1].color=who;
 // A terminal move is authoritative immediately. Never wait for Stockfish's
 // grading or for DeepSeek before presenting the game result.
 if(change.status.over){
  square=null;busy=false;analysisPending=false;
  save();render();motion?.play(geometry);
  return;
 }
 square=null;busy=true;analysisPending=true;save();render();motion?.play(geometry);
 let data=null,before=null,after=null;
 try{
  before=await evaluate(beforeFen);
  after=await evaluate(change.fen);
  data=trainingMoveQualityWinChance(before,after,uci);
 }catch{}
 if(epoch!==gameEpoch||!playing)return;
 if(data?.kind){
  const entry=moves[cursor-1];
  entry.grade=data.kind;entry.loss=data.loss;
  // An ordinary positional inaccuracy never stops the game. Deep analysis
  // is reserved for concrete, immediate and legible tactical candidates.
  const quick=quickThreatProbe({afterFen:change.fen,after,player:who});
  if(quick.status==='candidate'){
   entry.message=t('analysing');entry.threatStatus='checking';
   save();render();
   let continuation=null;
   try{continuation=await evaluateDeep(change.fen);}catch{}
   if(epoch!==gameEpoch||!playing||!moves.includes(entry)||cursor!==moves.length)return;
   const verdict=verifyImmediateThreat({afterFen:change.fen,after,deep:continuation,player:who});
   entry.threatStatus=verdict.status;
   entry.threatReason=verdict.reason||null;
   if(verdict.status===TACTIC){
    entry.mentorThreat=verdict.evidence;
    entry.pending=true;
    entry.message=thinkingText(lang(),beforeFen+'|'+uci);
    pausedEntry=entry;
    lessonView={entry,plan:null,stage:-1,feedback:null};
    busy=false;analysisPending=false;save();render();
    // The verified lesson uses the exact search already confirmed.
    void explainVerifiedMove({beforeFen,afterFen:change.fen,uci,kind:data.kind,
     before,after,continuation,entry,epoch});
    return;
   }
  }else{
   entry.threatStatus=POS;
   entry.threatReason=quick.reason;
  }
  entry.message=t('positional');entry.pending=false;
 }else if(data){
  const quality=classifyStrongMove({uci,beforeFen},before,data.loss);
  if(quality){
   moves[cursor-1].grade=quality;
   moves[cursor-1].message=praiseText(lang(),quality,beforeFen+'|'+uci);
  }
 }else{
  moves[cursor-1].analysisUnavailable=true;
 }
 busy=false;analysisPending=false;save();render();
 if(cursor===moves.length&&!game().status().over)resumeAI();
}
function setVariationStep(step){
 if(!analysisView)return;
 analysisView.offset=Math.max(0,Math.min(analysisView.entry.analysisLine.length,step));
 square=null;render();
}
function onClick(event){
 const button=event.target.closest('button');
 if(!button||!root?.contains(button))return;
 if(button.dataset.mentorId){
  selected=Number(button.dataset.mentorId);save();render();return;
 }
 if(button.dataset.mentorColor){color=button.dataset.mentorColor;save();render();return;}
 if(button.dataset.mentorPly){moveCursor(Number(button.dataset.mentorPly));return;}
 if(button.dataset.mentorLine!==undefined){setVariationStep(Number(button.dataset.mentorLine));return;}
 if(button.dataset.mentorPromote&&promotion){
  const chosen=promotion;promotion=null;
  if(chosen.correction)void submitCorrection(chosen.from,chosen.to,button.dataset.mentorPromote);
  else void userMove(chosen.from,chosen.to,button.dataset.mentorPromote);
  return;
 }
 if(button.dataset.mentorSquare&&correctionView){
  if(correctionView.checking||correctionView.accepted||correctionView.bestShown)return;
  const cell=button.dataset.mentorSquare,board=correctionBoard();
  if(board.turn()!==currentPlayerColor())return;
  if(square&&board.legalMoves(square).some(m=>m.to===cell)){
   const options=board.legalMoves(square).filter(m=>m.to===cell);
   if(options.some(m=>m.promotion)){promotion={from:square,to:cell,correction:true};render();}
   else void submitCorrection(square,cell);
   return;
  }
  if(square===cell)square=null;
  else square=board.pieceAt(cell)?.color===currentPlayerColor()?cell:null;
  render();return;
 }
 if(button.dataset.mentorSquare){
  // Select rival pieces in the paused, unchanged post-mistake position.
  if(lessonView){
   if(!lessonView.plan||lessonView.stage===3)return;
   const cell=button.dataset.mentorSquare;
   const chess=game(),piece=chess.pieceAt(cell);
   // Only attempts on actual rival pieces produce feedback.
   if(!piece||piece.color===currentPlayerColor())return;
   const correct=validateLessonGuess(lessonView.plan,cell);
   const feedback={square:cell,kind:correct?'correct':'wrong',id:++lessonFlashSeq};
   lessonView.feedback=feedback;
   if(correct){lessonView.stage=3;lessonView.revealPending=true;}
   render();
   if(correct)requestAfterAnswer(lessonView.entry);
   if(correct){
    const current=lessonView,epoch=gameEpoch;
    setTimeout(()=>{
     if(lessonView!==current||gameEpoch!==epoch||current.feedback!==feedback)return;
     current.feedback=null;current.revealPending=false;
     analysisView={entry:current.entry,index:moves.indexOf(current.entry),offset:current.plan.ply};
     square=null;render();
    },1200);
   }
   return;
  }
  if(busy||!playing||analysisView)return;
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
 if(action==='result-review'){
  if(!playing||cursor!==moves.length||!moves.length||!game().status().over)return;
  const ours=currentPlayerColor(),theirs=ours==='w'?'b':'w';
  // Reuse the finished-game analysis UI, without Arena/Tournament rewards.
  openFinishedGameReview({
   mode:'mentor',finished:true,moves:moves.map(item=>item.uci),
   playerColor:ours,lang:lang(),
   sides:{[ours]:'humans',[theirs]:mentor().race}
  });
  return;
 }
 if(action==='lesson-ask-ai'&&lessonView?.stage===3){requestAfterAnswer(lessonView.entry);return;}
 if(action==='correction-start'){startCorrection();return;}
 if(action==='correction-strong'&&correctionView&&!correctionView.checking&&
    !correctionSeconds(correctionView)&&pausedEntry===correctionView.entry&&cursor===moves.length){
  const c=correctionView,chess=new ClassicChessEngine(c.beforeFen),uci=c.bestMove;
  if(chess.legalMoves(uci.slice(0,2)).some(move=>move.to===uci.slice(2,4)&&
      (move.promotion||null)===(uci.slice(4)||null))){
   c.bestShown=true;c.flash=null;square=null;promotion=null;render();
  }
  return;
 }
 if(action==='correction-again'&&correctionView&&!correctionView.checking){
  correctionView.accepted=false;correctionView.chosenUci=null;correctionView.outcome=null;
  correctionView.flash=null;correctionView.bestShown=false;square=null;render();return;
 }
 if(action==='correction-back'){returnFromCorrection(false);return;}
 if(action==='correction-close'){returnFromCorrection(true);return;}
 if(action==='lesson-hint'&&lessonView?.plan&&lessonView.stage<3){
  lessonView.stage=Math.min(2,lessonView.stage+1);lessonView.feedback=null;
  render();return;
 }
 if(action==='lesson-reveal'&&lessonView?.plan){
  lessonView.stage=3;lessonView.feedback=null;lessonView.revealPending=false;
  analysisView={entry:lessonView.entry,index:moves.indexOf(lessonView.entry),offset:lessonView.plan.ply};
  render();requestAfterAnswer(lessonView.entry);return;
 }
 if(action==='lesson-close'&&lessonView){
  const shouldResume=pausedEntry===lessonView.entry&&cursor===moves.length;
  lessonView=null;analysisView=null;square=null;
  if(shouldResume)pausedEntry=null;
  save();render();
  if(shouldResume)resumeAI();
  return;
 }
 if(action==='speech'){speech.toggle();return;}
 if(action==='retry-explanation')void retryMentorFeedback();
 if(action==='open-variation'){
  lessonView=null;correctionView=null;
  const found=latestPlayerNote();
  if(found?.move?.analysisFen&&found.move.analysisLine?.length){
   analysisView={entry:found.move,index:found.index,offset:0};
   motion?.clear();square=null;render();
  }
 }
 if(action==='close-variation'){analysisView=null;lessonView=null;square=null;render();}
 if(action==='line-prev'){setVariationStep((analysisView?.offset||0)-1);}
 if(action==='line-next'){setVariationStep((analysisView?.offset||0)+1);}
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
 get state(){return {selected,color,playing,cursor,moves:moves.map(m=>({...m})),fen:playing?game().fen():null,busy,paused:Boolean(pausedEntry),lesson:lessonView?.plan?.kind||null,correction:correctionView?{checking:correctionView.checking,accepted:correctionView.accepted,outcome:correctionView.outcome,chosenUci:correctionView.chosenUci}:null};}
};
