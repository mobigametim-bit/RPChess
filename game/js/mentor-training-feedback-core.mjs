/* Pure mentor feedback contract. Broker text is never authoritative for chess. */
import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { trainingMoveQuality, UCI } from './mentor-training-history.mjs';
import {tacticalEvidence,MAX_PV} from './mentor-training-tactics.mjs?v=20261107-mentor-auto-pause-v3';
import {lessonFromVerified,mentorLessonCopy} from './mentor-training-teaching.mjs?v=20261107-mentor-auto-pause-v3';

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
 else if(replay.events.some(e=>e.kind==='fork'))motive='fork';
 else if(replay.events.some(e=>e.kind==='pin'))motive='pin';
 else if(replay.events.some(e=>e.kind==='material_loss'))motive='material_loss';
 else {
  const recognized=['double_check','discovered_check','skewer_pattern','overloaded_defender',
   'removed_defender','undefended_capture','promotion','advanced_passed_pawn',
   'discovered_attack','interference','en_passant','check'];
  motive=recognized.find(kind=>replay.events.some(e=>e.kind===kind))||
   (captured?.color===player?'capture':response.status.checked?'check':'positional');
  if(motive==='capture')capturedType=captured?.type||null;
 }
 return {
  version:1,language:raw.language,uci:raw.uci,grade:quality.kind,loss:quality.loss,
  beforeFen,afterFen:board.fen(),player,bestMove:before.bestMove,
  afterLine,motive,capturedType,depth:Math.min(before.depth,after.depth),
  continuationDepth:extended?.depth??after.depth,tactics:replay.events,netMaterialLoss:replay.netMaterialLoss
 };
}
const RU_TARGET={p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя',k:'короля'};
const RU_PINNED={p:'пешка',n:'конь',b:'слон',r:'ладья',q:'ферзь'};
const EN_TARGET={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const RU_COUNTS=['','один ход','два хода','три хода','четыре хода','пять ходов',
 'шесть ходов','семь ходов','восемь ходов','девять ходов','десять ходов'];
function leadTime(ply,language){
 const n=Math.min(10,Math.max(1,Math.ceil((ply||1)/2)));
 if(language==='en')return n===1?'On the next move':'In about '+n+' moves';
 return n===1?'Следующим ходом':'Через '+RU_COUNTS[n];
}
function typeNames(types,language){
 const dictionary=language==='en'?EN_TARGET:RU_TARGET;
 const names=(types||[]).map(type=>dictionary[type]).filter(Boolean);
 const conj=language==='en'?' and ':' и ';
 return names.length?names.join(', ').replace(/, ([^,]+)$/,(m,last)=>conj+last):'';
}
function describeMentorFact(data,language=data.language){
 const en=language==='en',kind=data.motive;
 const event=data.tactics?.find(e=>e.kind===kind || (kind==='checkmate'&&e.kind==='mate_sequence'));
 const time=leadTime(event?.ply||1,language);
 if(kind==='checkmate')return en
  ?'The very next reply can checkmate you. Find the threat near your king.'
  :'Соперник может сразу поставить мат. Найди угрозу своему королю.';
 if(kind==='mate_sequence')return en
  ?time+', your opponent may reach a checkmate. Find how to stop this threat.'
  :time+' соперник может довести атаку до мата. Подумай, как это предотвратить.';
 if(kind==='fork'){
  const targets=typeNames(event?.targets?.slice(0,2),language);
  return en
   ?time+', your opponent may create a fork attacking the '+(targets||'important pieces')+'. Find how to prevent it.'
   :time+' у соперника может возникнуть вилка на '+(targets||'важные фигуры')+'. Найди, как её предотвратить.';
 }
 if(kind==='pin'){
  const piece=en?(EN_TARGET[event?.piece]||'piece'):(RU_PINNED[event?.piece]||'фигура');
  return en
   ?time+', your '+piece+' may become pinned to the king. Look for a way to avoid it.'
   :time+' твой '+piece+' может оказаться связан с королём. Подумай, как избежать связки.';
 }
 if(kind==='material_loss'){
  const piece=en?(EN_TARGET[event?.piece]||'material'):(RU_TARGET[event?.piece]||'материал');
  return en
   ?time+', the opponent may win material, including a '+piece+'. Check which piece may become vulnerable.'
   :time+' соперник может выиграть материал, в том числе '+piece+'. Проверь, какая фигура может оказаться под ударом.';
 }
 if(kind==='capture')return en
  ?'Your opponent can capture a piece immediately. See what was left unprotected.'
  :'Соперник может сразу забрать фигуру. Посмотри, что осталось под ударом.';
 if(kind==='check')return en
  ?'The next reply may give check. Pay attention to your king’s safety.'
  :'Следующим ходом соперник может дать шах. Проверь безопасность своего короля.';
 const lesson=lessonFromVerified(data);
 if(lesson?.kind===kind){
  const guide=mentorLessonCopy(lesson,language);
  return en
   ?'One legal continuation contains a possible '+kind.replace(/_/g,' ')+' pattern. '+guide.principle
   :'В одном из легальных продолжений виден тактический мотив. '+guide.principle;
 }
 return en
  ?'Your position worsened, but no concrete tactical reason was verified. Look for a safer plan.'
  :'Позиция ухудшилась, но конкретная тактическая причина не подтверждена. Поищи более надёжный план.';
}
function promptForMentor(data){
 const ru=data.language==='ru';
 const instructions=ru
  ?'Ты шахматный наставник. Верни строго JSON {"explanation":"..."} на русском: от двух до пяти законченных предложений, суммарно не более 500 символов. Говори конкретно, по схеме «Через [N] ходов соперник может [подтверждённое событие: вилка на ферзя и ладью, связка слона, потеря ладьи, мат]. Подумай, как это предотвратить». Для немедленной угрозы используй «Следующим ходом». НЕ пиши «В рассчитанной линии», «По расчёту движка», «В просчитанном варианте» и подобные канцеляризмы. Важно: линия Stockfish — один возможный вариант, не доказательство неизбежности; поэтому говори «может», а не «обязательно». Объясни игроку, что ему нужно замечать перед каждым ходом, и заверши объяснение одним вопросом о проверенной угрозе. Используй learningPrinciple и learningQuestion, но не выдумывай мотивов. Только подтверждённые факты! Не называй лучший альтернативный ход игрока, не предлагай готовые ходы и клетки, не пересказывай UCI. Не называй шахматные координаты и не придумывай размены или цепочки взятий: текст не должен утверждать ни одного конкретного хода, кроме проверенного verifiedFact.'
  :'You are a chess mentor. Return strict JSON {"explanation":"..."} in English, 2–5 complete sentences, max 500 characters total. Be concrete: "In about [N] moves, your opponent may [verified tactic such as a knight fork attacking your queen and rook]. Find a way to prevent it." Use "On the next move" for immediate replies. Never write "In the calculated line" or similar jargon. Stockfish PV is ONE possible variation, not an inevitable outcome, so say "may". Explain a reusable pattern the learner should check before moving, and end with a question grounded in learningQuestion. Use learningPrinciple; do not invent tactics. Mention ONLY verified facts. Never reveal the player’s best alternative move, offer a ready-made next move, or recite UCI. Do not name board squares, invented exchanges or capture sequences; never assert a concrete move not established by verifiedFact.';
 const learning=mentorLessonCopy(lessonFromVerified(data),data.language);
 const message={
  severity:data.grade,playerColor:data.player,playedUci:data.uci,
  learningQuestion:learning.question,learningPrinciple:learning.principle,
  positionBefore:data.beforeFen,positionAfter:data.afterFen,
  verifiedFact:describeMentorFact(data),
  opponentContinuation:data.afterLine.slice(0,MAX_PV),
  continuationDepth:data.continuationDepth,
  verifiedTactics:data.tactics.map(({kind,ply,piece,pinner,targets,net})=>({
   kind,ply,opponentMovesAway:Math.ceil(ply/2),
   ...(piece?{piece}:{}),...(pinner?{pinner}:{}),
   ...(targets?{targets}:{}),...(Number.isFinite(net)?{net}: {})
  }))
 };
 return {system:instructions,user:JSON.stringify(message)};
}
function safeExplanation(value,data){
 if(typeof value!=='string')return null;
 const s=value.trim().replace(/\s+/g,' ');
 if(s.length<12||s.length>500||/<|>|https?:|www\.|\x60{3}|[{}\n\r]/i.test(s))return null;
 // Explanations are deliberately short, but no longer restricted to two sentences.
 // Reject truncated, unterminated or overly verbose outputs so a second model can try.
 const sentenceCount=(s.match(/[.!?](?=\s|$)/g)||[]).length;
 if(sentenceCount<2||sentenceCount>5||!/[.!?]$/.test(s))return null;
 if(/в рассчитанной линии|в просчитанном варианте|in the calculated line|in the calculated variation/i.test(s))return null;
 // A free-form model cannot prove a square, move or exchange from prose.
 // The verified Stockfish continuation remains available via «Посмотреть».
 if(/(?:^|[^a-z0-9])[a-h][1-8](?=$|[^a-z0-9])/i.test(s)||/\b[КQRBN]?[a-h]?[1-8]?x[a-h][1-8]\b/i.test(s))return null;
 if(/размен\w*|exchange\w*|\btrad(?:e|es|ing)\b/i.test(s))return null;
 const best=data.bestMove,dst=best.slice(2,4),src=best.slice(0,2);
 if(s.toLowerCase().includes(best)||new RegExp('(?:^|[^a-h0-9])'+src+'\\s*[-–→]\\s*'+dst+'(?:$|[^a-z0-9])','i').test(s))return null;
 if(new RegExp('(?:ходи|сыграй|переведи|move to|play)\\s+.{0,14}\\b'+dst+'\\b','i').test(s))return null;
 return s;
}
function localMentorFallback(data){return describeMentorFact(data,data.language);}
export {legalLine,validateMentorInput,promptForMentor,safeExplanation,localMentorFallback,describeMentorFact,leadTime};
