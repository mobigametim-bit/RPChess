/* Mentor explanation contract v2. This is ONLY for the isolated v2 Worker.
 * Do not swap the deployed v1 endpoint until both ends are in sync.
 * Stockfish, legal chess moves and SEE determine facts; an LLM is allowed
 * to write general coaching advice only, never chess claims.
 */
import {ClassicChessEngine} from './classic-chess-engine.mjs';
import {UCI,trainingMoveQualityWinChance} from './mentor-training-history.mjs';
import {tacticalEvidence,MAX_PV} from './mentor-training-tactics.mjs';
import {verifyImmediateThreat,TACTIC} from './mentor-training-threat.mjs';
import {lessonFromVerified,mentorLessonCopy} from './mentor-training-teaching.mjs';

const GRADE=new Set(['inaccuracy','mistake','blunder']);
const THREAT_KINDS=new Set(['mate_sequence','undefended_capture','material_loss',
 'en_passant','promotion','fork','double_check','discovered_check']);
const PIECE_RU={p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя'};
const PIECE_EN={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen'};
function fenBoard(fen){
 if(typeof fen!=='string'||fen.length<15||fen.length>110||/[\r\n]/.test(fen))
  throw Error('invalid_fen');
 return new ClassicChessEngine(fen);
}
function isScore(score,requireBest=false){
 return score&&typeof score==='object'&&Number.isInteger(score.cp)&&Math.abs(score.cp)<=1800&&
  Number.isInteger(score.depth)&&score.depth>=5&&score.depth<=100&&
  (score.mate===undefined||Number.isInteger(score.mate)&&Math.abs(score.mate)<=100)&&
  (!requireBest||typeof score.bestMove==='string'&&UCI.test(score.bestMove));
}
function replayLine(fen,pv){
 if(!Array.isArray(pv)||!pv.length||pv.length>MAX_PV)throw Error('invalid_line');
 const board=fenBoard(fen);
 for(const uci of pv){
  if(typeof uci!=='string'||!UCI.test(uci))throw Error('invalid_line');
  const applied=board.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
  if(!applied.ok)throw Error('invalid_line');
 }
 return board;
}
function validatedV2Facts(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==2||
    !['ru','en'].includes(raw.language)||!GRADE.has(raw.grade)||!UCI.test(raw.uci||''))
  throw Error('invalid_payload');
 const board=fenBoard(raw.beforeFen);
 const beforeFen=board.fen(),player=board.turn();
 const step=board.move(raw.uci.slice(0,2),raw.uci.slice(2,4),raw.uci.slice(4)||null);
 if(!step.ok||board.fen()!==raw.afterFen)throw Error('invalid_position');
 const afterFen=board.fen();
 const before=raw.before,after=raw.after,deep=raw.continuation;
 if(!isScore(before,true)||!isScore(after,true)||!isScore(deep,true))
  throw Error('invalid_analysis');
 if(!Array.isArray(after.pv)||after.pv[0]!==after.bestMove||
    !Array.isArray(deep.pv)||deep.pv[0]!==deep.bestMove)
  throw Error('invalid_analysis');
 replayLine(beforeFen,[before.bestMove]);
 replayLine(afterFen,after.pv);
 replayLine(afterFen,deep.pv);
 if(deep.secondMove!==undefined){
  if(!UCI.test(deep.secondMove)||!Number.isInteger(deep.secondCp)||
     Math.abs(deep.secondCp)>1800||!Number.isInteger(deep.secondDepth)||
     deep.secondDepth<5||deep.secondDepth>100)throw Error('invalid_multipv');
  replayLine(afterFen,[deep.secondMove]);
 }
 const quality=trainingMoveQualityWinChance(before,after,raw.uci);
 if(!quality?.kind||quality.kind!==raw.grade)throw Error('invalid_grade');
 const verdict=verifyImmediateThreat({afterFen,after,deep,player});
 if(verdict.status!==TACTIC||!THREAT_KINDS.has(verdict.evidence.kind))
  throw Error('unverified_tactic');
 const declared=raw.verifiedThreat;
 if(!declared||typeof declared!=='object'||
    declared.uci!==verdict.evidence.uci||declared.kind!==verdict.evidence.kind||
    declared.basis!==verdict.evidence.basis)throw Error('mismatched_tactic');
 const threat=verdict.evidence;
 const event={kind:threat.kind,ply:1,from:threat.from,to:threat.to,
  targetSquares:Array.isArray(threat.targets)?threat.targets:[]};
 const lesson=lessonFromVerified({afterFen,afterLine:deep.pv.slice(0,MAX_PV),
  player,tactics:[event]});
 if(!lesson||lesson.from!==threat.from||lesson.kind!==threat.kind)
  throw Error('invalid_lesson');
 const copy=mentorLessonCopy(lesson,raw.language);
 const captures=tacticalEvidence(afterFen,[threat.uci],player,1);
 const fact=verifiedImmediateFact({threat,afterFen,language:raw.language});
 const factId=threat.kind+':'+threat.uci;
 return {
  version:2,language:raw.language,grade:raw.grade,loss:quality.loss,
  winLoss:quality.winLoss,afterFen,beforeFen,uci:raw.uci,player,
  bestMove:before.bestMove,afterLine:deep.pv.slice(0,MAX_PV),
  motive:threat.kind,tactics:captures.events,verifiedThreat:threat,
  factId,verifiedFact:fact,learningPrinciple:copy.principle,
  learningQuestion:copy.question,lesson
 };
}
function verifiedImmediateFact({threat,afterFen,language}){
 const en=language==='en';
 const kind=threat.kind;
 if(kind==='mate_sequence')return en
  ?'The opponent can checkmate you with the next move.'
  :'Соперник может поставить мат следующим ходом.';
 if(kind==='promotion')return en
  ?'The opponent can promote a pawn with the next move.'
  :'Соперник может превратить пешку следующим ходом.';
 if(kind==='fork')return en
  ?'The opponent can give check while attacking another valuable piece.'
  :'Соперник может дать шах и одновременно напасть на ценную фигуру.';
 if(kind==='double_check')return en
  ?'The opponent can give a double check on the next move.'
  :'Соперник может следующим ходом дать двойной шах.';
 if(kind==='discovered_check')return en
  ?'The opponent can reveal a discovered check on the next move.'
  :'Соперник может следующим ходом открыть линию шаха.';
 if(['material_loss','undefended_capture','en_passant'].includes(kind)){
  const board=new ClassicChessEngine(afterFen);
  const target=board.legalMoves(threat.from).find(m=>m.to===threat.to)?.capture;
  const piece=target&&board.pieceAt(target);
  const ru=PIECE_RU[piece?.type]||'фигуру';
  const english=PIECE_EN[piece?.type]||'piece';
  return en
   ?'The opponent can profitably capture your '+english+' on the next move.'
   :'Соперник может следующим ходом выгодно взять твою '+ru+'.';
 }
 throw Error('unverified_tactic');
}
/* v2 message is deliberately an open-ended COACHING note, not a source of
 * tactical facts. The actual chess statement is authored by deterministic
 * code and prepended AFTER validation, never generated by the model.
 */
function promptForMentorV2(data){
 const ru=data.language==='ru';
 return {
  system:ru
   ?'Ты шахматный педагог. Верни строго JSON {"advice":"..."} на русском. Напиши 1–2 коротких законченных предложения (всего 25–230 символов) с практическим способом проверять собственные решения в будущих позициях. Пользуйся проверенными verifiedFact и learningPrinciple, но НЕ повторяй сам verifiedFact, не пересказывай конкретную комбинацию, не называй ходы, клетки, фигуры или шахматные события. Не предлагай готовый ответ. Можно задать один короткий вопрос для самопроверки. Не утверждай, что конкретный исход неизбежен. Пример безопасного совета: «Перед ходом проверь шахи, взятия и угрозы соперника. Какой ответ самый опасный?» Это общий совет, а НЕ утверждение об этой позиции. Не добавляй иные поля.'
   :'You are a chess educator. Return strictly JSON {"advice":"..."} in English. Write 1–2 short complete sentences (25–230 characters total) giving a reusable thinking habit. Take verifiedFact and learningPrinciple as context, but DO NOT repeat the verified fact or describe a specific tactic, move, square, piece or chess event. Do not reveal a solution. You may ask one short self-check question. Do not assert an inevitable result. Example of safe generic advice: "Before moving, look for the opponent’s checks, captures, and threats. Which reply is most dangerous?" This is a general habit, NOT an assertion about this position. Do not add fields.',
  user:JSON.stringify({language:data.language,lessonFactId:data.factId,
   verifiedFact:data.verifiedFact,learningPrinciple:data.learningPrinciple,
   learningQuestion:data.learningQuestion,skillLevel:'beginner-friendly',
   constraints:'general thinking process only; no chess facts beyond verifiedFact'})
 };
}
// Only a coarse rejection category is returned to the Worker diagnostics.
 // Never reveal provider text, board position, fact or prompt in logs.
function mentorAdviceValidationIssue(value,data){
 if(typeof value!=='string'||!data?.verifiedFact)return 'invalid_type';
 const s=value.trim().replace(/\s+/g,' ');
 if(s.length<25||s.length>230)return 'length';
 if(/[<>{}\r\n\x60]|https?:|www\./i.test(s))return 'markup';
 const sentences=(s.match(/[.!?](?=\s|$)/g)||[]).length;
 if(sentences<1||sentences>2||!/[.!?]$/.test(s))return 'sentence_format';
 if(/(?:^|[^a-z0-9])[a-h][1-8](?=$|[^a-z0-9])/i.test(s)||
    /\b[a-h][1-8][a-h][1-8][qrbn]?\b/i.test(s))return 'coordinates';
 // Reusable mental habits may refer to checks, captures and threats.
 // Specific tactics, piece types and invented board claims are prohibited.
 if(/вилк|связк|размен|сруб|забра|потер|выигра|жертв|ферз|ладь|слон|конь|пешк|корол|fork|pin|skewer|checkmate|exchang|sacrific|queens?|rooks?|bishops?|knights?|pawns?|kings?/i.test(s))
  return 'piece_or_motif';
 if(/(?:соперник|противник|opponent|enemy).{0,70}(?:может|сможет|сделает|поставит|нанес|будет|will|can).{0,70}(?:шах|мат|взя|атак|check|capture|mate)/i.test(s))
  return 'specific_opponent_claim';
 if(/(?:в этой позиции|здесь|именно сейчас|теперь|in this position|right now|this move).{0,85}(?:шах|мат|взят|атак|check|capture|mate)/i.test(s))
  return 'specific_position_claim';
 if(s.includes(data.verifiedFact)||s.includes(data.factId))return 'repeated_fact';
 return null;
}
function safeMentorAdvice(value,data){
 if(mentorAdviceValidationIssue(value,data))return null;
 return value.trim().replace(/\s+/g,' ');
}
function composeMentorV2Explanation(advice,data){
 const safe=safeMentorAdvice(advice,data);
 if(!safe)return null;
 const result=data.verifiedFact+' '+safe;
 return result.length<=500?result:null;
}
function localMentorV2Fallback(data){
 const ru=data.language==='ru';
 const generic=ru
  ?'Перед каждым ходом попробуй представить самый сильный ответ соперника. Какой риск ты мог не заметить?'
  :'Before every move, imagine the opponent’s strongest reply. Which risk might you have overlooked?';
 return data.verifiedFact+' '+generic;
}
export {validatedV2Facts,promptForMentorV2,safeMentorAdvice,mentorAdviceValidationIssue,composeMentorV2Explanation,localMentorV2Fallback,verifiedImmediateFact};
