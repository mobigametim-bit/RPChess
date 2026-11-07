/* Pure mentor feedback contract. Broker text is never authoritative for chess. */
import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { trainingMoveQuality, UCI } from './mentor-training-history.mjs';

const GRADE_SET=new Set(['inaccuracy','mistake','blunder']);
const RU={p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя',k:'короля'};
const EN={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};

function legalLine(fen,line,limit=4){
 const game=new ClassicChessEngine(fen),valid=[];
 if(!Array.isArray(line))return valid;
 for(const move of line.slice(0,limit)){
  if(typeof move!=='string'||!UCI.test(move))break;
  const applied=game.move(move.slice(0,2),move.slice(2,4),move.slice(4)||null);
  if(!applied.ok)break;
  valid.push(move);
  if(applied.status.over)break;
 }
 return valid;
}
function ensureFen(fen){
 if(typeof fen!=='string'||fen.length<15||fen.length>110||fen.includes('\n')||fen.includes('\r'))
  throw Error('invalid_fen');
 return new ClassicChessEngine(fen);
}
function validateMentorInput(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1)throw Error('invalid_payload');
 if(!['ru','en'].includes(raw.language))throw Error('invalid_language');
 if(typeof raw.uci!=='string'||!UCI.test(raw.uci)||!GRADE_SET.has(raw.grade))throw Error('invalid_move');
 const board=ensureFen(raw.beforeFen),beforeFen=board.fen(),player=board.turn();
 const applied=board.move(raw.uci.slice(0,2),raw.uci.slice(2,4),raw.uci.slice(4)||null);
 if(!applied.ok||typeof raw.afterFen!=='string'||board.fen()!==raw.afterFen)throw Error('invalid_position');
 const before=raw.before,after=raw.after;
 if(!before||!after||typeof before!=='object'||typeof after!=='object')throw Error('invalid_analysis');
 const isValidCp=n=>Number.isInteger(n)&&n>=-1800&&n<=1800;
 const isValidDepth=n=>Number.isInteger(n)&&n>=5&&n<=100;
 if(!isValidCp(before.cp)||!isValidCp(after.cp)||!isValidDepth(before.depth)||!isValidDepth(after.depth)||
    typeof before.bestMove!=='string'||!UCI.test(before.bestMove))throw Error('invalid_analysis');
 const bestLine=legalLine(beforeFen,[before.bestMove],1);
 if(!bestLine.length)throw Error('invalid_best_move');
 const quality=trainingMoveQuality(before,after,raw.uci);
 if(!quality?.kind||quality.kind!==raw.grade)throw Error('invalid_grade');
 const afterLine=legalLine(raw.afterFen,after.pv,4);
 if(afterLine.length<1)throw Error('missing_refutation');
 const game=new ClassicChessEngine(raw.afterFen),first=afterLine[0];
 const candidate=game.legalMoves(first.slice(0,2)).find(x=>x.to===first.slice(2,4)&&(!x.promotion||x.promotion===first.slice(4)));
 const captured=candidate?.capture?game.pieceAt(candidate.capture):null;
 const response=game.move(first.slice(0,2),first.slice(2,4),first.slice(4)||null);
 let motive='positional',capturedType=null;
 if(response.status.type==='checkmate')motive='checkmate';
 else if(captured&&captured.color===player){motive='capture';capturedType=captured.type;}
 else if(response.status.checked)motive='check';
 return {
  version:1,language:raw.language,uci:raw.uci,grade:quality.kind,loss:quality.loss,
  beforeFen,afterFen:board.fen(),player,bestMove:before.bestMove,
  afterLine,motive,capturedType,depth:Math.min(before.depth,after.depth)
 };
}
function promptForMentor(data){
 const ru=data.language==='ru';
 const fact=data.motive==='checkmate'
  ?(ru?'Подтверждён немедленный мат соперника.':'Verified immediate checkmate by opponent.')
  :data.motive==='capture'
   ?(ru?'Первый ответ соперника берёт '+RU[data.capturedType]+'.':'The verified reply captures a '+EN[data.capturedType]+'.')
   :data.motive==='check'
    ?(ru?'Первый ответ соперника объявляет шах.':'The verified reply gives check.')
    :(ru?'Подтверждён только спад оценки. Конкретная тактическая причина не доказана.':'Only the evaluation loss is verified; no specific tactic is established.');
 const instructions=ru
  ?'Ты шахматный наставник. Верни только JSON с ключом explanation на русском. Одно или два коротких предложения, максимум 250 символов. Объясни только подтверждённый шахматный факт. Не называй лучший ход, конкретную клетку для следующего хода и не подсказывай готовое решение. Не придумывай вилки, связки, потерю материала или мат без подтверждения. Если конкретная причина не подтверждена, скажи только об ухудшении позиции.'
  :'You are a chess mentor. Return only JSON with an explanation key, 1-2 short English sentences (max 250 characters). Explain only verified facts. Never reveal the best move, destination square or answer. Do not invent forks, pins, material loss or checkmate. If no tactic is verified, say only that the position worsened.';
 const message={
  severity:data.grade,playerColor:data.player,playedUci:data.uci,
  positionBefore:data.beforeFen,positionAfter:data.afterFen,
  verifiedFact:fact,opponentContinuation:data.afterLine.slice(0,3)
 };
 return {system:instructions,user:JSON.stringify(message)};
}
function safeExplanation(value,data){
 if(typeof value!=='string')return null;
 const s=value.trim().replace(/\s+/g,' ');
 if(s.length<12||s.length>260||/<|>|https?:|www\.|\x60{3}|[{}\n\r]/i.test(s))return null;
 const best=data.bestMove,dst=best.slice(2,4),src=best.slice(0,2);
 if(s.toLowerCase().includes(best)||new RegExp('(?:^|[^a-h0-9])'+src+'\\s*[-–→]\\s*'+dst+'(?:$|[^a-z0-9])','i').test(s))return null;
 if(new RegExp('(?:ходи|сыграй|переведи|move to|play)\\s+.{0,14}\\b'+dst+'\\b','i').test(s))return null;
 return s;
}
function localMentorFallback(data){
 const ru=data.language==='ru';
 switch(data.motive){
  case 'checkmate':return ru?'Этот ход позволяет сопернику сразу поставить мат. Найди, какую угрозу ты пропустил.':'This move allows immediate checkmate. Look for the overlooked threat.';
  case 'capture':return ru?'После этого хода соперник может сразу взять '+RU[data.capturedType]+'. Посмотри, как фигура оказалась под ударом.':'Your opponent can immediately capture a '+EN[data.capturedType]+'. See why it became vulnerable.';
  case 'check':return ru?'Соперник получает возможность сразу объявить шах. Проверь безопасность своего короля.':'Your opponent can immediately give check. Reconsider your king’s safety.';
  default:return ru?'Ход ухудшает оценку позиции. Конкретная тактическая причина пока не подтверждена — поищи более надёжный план.':'This move worsens your position. No specific tactic is confirmed; look for a more reliable plan.';
 }
}
export {legalLine,validateMentorInput,promptForMentor,safeExplanation,localMentorFallback};
