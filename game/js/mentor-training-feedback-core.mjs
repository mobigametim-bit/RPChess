/* Pure mentor feedback contract. Broker text is never authoritative for chess. */
import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { trainingMoveQuality, UCI } from './mentor-training-history.mjs';
import {tacticalEvidence,MAX_PV} from './mentor-training-tactics.mjs';

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
 // The fast assessment remains the sole source of grade/loss. The optional
 // deeper PV is a separate (possibly longer) continuation of the SAME FEN.
 const extended=raw.continuation;
 if(extended!==undefined && (
  !extended || !Array.isArray(extended.pv) || extended.pv.length>MAX_PV ||
  !isValidDepth(extended.depth) || extended.pv.some(s=>typeof s!=='string'||!UCI.test(s))
 ))throw Error('invalid_deep_analysis');
 const selectedLine=extended?.pv?.length?extended.pv:after.pv;
 const afterLine=legalLine(raw.afterFen,selectedLine,MAX_PV);
 if(afterLine.length<1)throw Error('missing_refutation');
 // Do not silently truncate an illegal line and then call it verified.
 if(afterLine.length!==selectedLine.length)throw Error('invalid_refutation');
 const replay=tacticalEvidence(raw.afterFen,afterLine,player,MAX_PV);
 const game=new ClassicChessEngine(raw.afterFen),first=afterLine[0];
 const candidate=game.legalMoves(first.slice(0,2)).find(x=>x.to===first.slice(2,4)&&(!x.promotion||x.promotion===first.slice(4)));
 const captured=candidate?.capture?game.pieceAt(candidate.capture):null;
 const response=game.move(first.slice(0,2),first.slice(2,4),first.slice(4)||null);
 let motive='positional',capturedType=null;
 // A mate in the actual first reply is stronger evidence than a longer PV.
 if(response.status.type==='checkmate')motive='checkmate';
 else if(replay.events.some(e=>e.kind==='mate_sequence'))motive='mate_sequence';
 else if(replay.events.some(e=>e.kind==='material_loss'))motive='material_loss';
 else if(replay.events.some(e=>e.kind==='fork'))motive='fork';
 else if(replay.events.some(e=>e.kind==='pin'))motive='pin';
 else if(captured&&captured.color===player){motive='capture';capturedType=captured.type;}
 else if(response.status.checked)motive='check';
 return {
  version:1,language:raw.language,uci:raw.uci,grade:quality.kind,loss:quality.loss,
  beforeFen,afterFen:board.fen(),player,bestMove:before.bestMove,
  afterLine,motive,capturedType,depth:Math.min(before.depth,after.depth),
  continuationDepth:extended?.depth??after.depth,tactics:replay.events,netMaterialLoss:replay.netMaterialLoss
 };
}
function promptForMentor(data){
 const ru=data.language==='ru';
 const descriptions={
  checkmate:ru?'Первый ответ соперника непосредственно ставит мат.':'The immediate opponent reply is checkmate.',
  mate_sequence:ru?'В просчитанном варианте возникает мат игроку; альтернативные ответы не исключены.':'The calculated variation ends in checkmate against the player; alternative replies are not excluded.',
  material_loss:ru?'В просчитанном варианте соперник получает материальное преимущество после разменов.':'The calculated variation shows a net material gain for the opponent after exchanges.',
  fork:ru?'В просчитанном варианте одна фигура соперника нападает сразу на две важные фигуры.':'In the variation, one opposing piece attacks two valuable pieces at once.',
  pin:ru?'В просчитанном варианте фигура игрока оказывается связана с королём.':'The calculated variation includes an absolute pin against the player’s king.',
  capture:ru?'Первый ответ соперника берёт фигуру игрока.':'The first reply captures a player piece.',
  check:ru?'Первый ответ соперника даёт шах.':'The first reply gives check.',
  positional:ru?'Подтверждено только ухудшение оценки; конкретную тактическую причину не установили.':'Only evaluation deterioration is established; no specific tactic has been verified.'
 };
 const instructions=ru
  ?'Ты шахматный наставник. Верни строго JSON {"explanation":"..."} на русском, 1–2 коротких предложения, до 250 символов. Используй только подтверждённые факты. Линия Stockfish — пример продолжения, НЕ доказательство вынужденного варианта при всех ответах. Объясни суть ошибки: потеря материала, связка, вилка, матовая угроза или ухудшение позиции — только если подтверждено. Не называй лучший ход до ошибки, не подсказывай следующий ход или клетку и не пересказывай линию ходов. Не придумывай угрозы и уверенность в форсированном исходе.'
  :'You are a chess mentor. Return strict JSON {"explanation":"..."} in English, 1–2 short sentences under 250 characters. Only explain verified facts. Stockfish PV is ONE illustrative line, not proof that all replies are forced. Discuss a verified material loss, pin, fork, mating line or general decline. Never reveal the best move before the mistake, suggest the player’s next move or destination, or recite the variation. Never fabricate tactics or certainty.';
 const message={
  severity:data.grade,playerColor:data.player,playedUci:data.uci,
  positionBefore:data.beforeFen,positionAfter:data.afterFen,
  verifiedFact:descriptions[data.motive],
  opponentContinuation:data.afterLine.slice(0,MAX_PV),
  continuationDepth:data.continuationDepth,
  verifiedTactics:data.tactics.map(({kind,ply,piece,targets,net})=>({
   kind,ply,...(piece?{piece}:{}),...(targets?{targets}:{}),...(Number.isFinite(net)?{net}: {})
  })),
  note:ru?'Тактические факты относятся к указанной линии, а не гарантированы при любой защите.':'Tactical facts apply to this line, not to every possible defense.'
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
  case 'checkmate':return ru?'Этот ход допускает немедленный мат. Найди пропущенную угрозу.':'This move allows immediate checkmate. Look for the overlooked threat.';
  case 'mate_sequence':return ru?'В рассчитанном продолжении соперник приходит к мату. Проверь безопасность короля и угрозы.':'The calculated continuation ends with a mate against you. Review your king’s safety.';
  case 'material_loss':return ru?'В рассчитанном продолжении соперник выигрывает материал. Посмотри, как развиваются размены после твоего хода.':'The calculated continuation costs you material. Examine how the exchanges unfold.';
  case 'fork':return ru?'В рассчитанной линии соперник создаёт двойное нападение на важные фигуры. Попробуй найти, как оно возникает.':'The calculated line contains a fork against your important pieces. See how it arises.';
  case 'pin':return ru?'В рассчитанной линии одна из твоих фигур оказывается связана с королём. Найди эту уязвимость.':'The calculated line includes a pin against your king. Find the vulnerable piece.';
  case 'capture':return ru?'После этого хода соперник может сразу забрать фигуру. Посмотри, почему она под ударом.':'After this move, the opponent can immediately capture a piece. See why it is exposed.';
  case 'check':return ru?'Соперник может сразу объявить шах. Проверь безопасность короля.':'The opponent can immediately check. Reconsider your king’s safety.';
  default:return ru?'Позиция ухудшилась, но конкретная тактическая причина не подтверждена. Поищи более надёжный план.':'Your position worsened, but no concrete tactic is verified. Look for a more reliable plan.';
 }
}
export {legalLine,validateMentorInput,promptForMentor,safeExplanation,localMentorFallback};
