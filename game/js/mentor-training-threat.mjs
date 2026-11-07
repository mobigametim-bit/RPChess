/* Immediate-tactic gate for the live Mentor.
 *
 * The first legal Stockfish move alone is NOT evidence of a tactic. A lesson
 * requires (1) a demonstrable event on the immediate reply, (2) an independent
 * deeper search confirming the same candidate, and (3) a bounded verification
 * of the motif. A quiet move or an event only later in PV never pauses play.
 *
 * This module does not assign move severity; the currently deployed Mentor
 * API still validates legacy centipawn grades. Avoid unapproved API changes.
 */
import {ClassicChessEngine} from './classic-chess-engine.mjs';
import {tacticalEvidence} from './mentor-training-tactics.mjs';
import {evaluateStaticExchange} from './mentor-training-exchange.mjs';

const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
const POS='unverified_or_positional';
const TACTIC='verified_immediate_tactic';
const VALUES=Object.freeze({p:100,n:320,b:330,r:500,q:900,k:0});
function legalFirstReply(fen,uci,player){
 if(typeof fen!=='string'||typeof uci!=='string'||!UCI.test(uci)||!['w','b'].includes(player))return null;
 try{
  const board=new ClassicChessEngine(fen);
  if(board.turn()===player)return null;
  const from=uci.slice(0,2),to=uci.slice(2,4),promotion=uci.slice(4)||null;
  const piece=board.pieceAt(from);
  if(piece?.color!==board.turn())return null;
  const move=board.legalMoves(from).find(m=>m.to===to&&(m.promotion||null)===promotion);
  if(!move)return null;
  const victim=move.capture?board.pieceAt(move.capture):null;
  const after=new ClassicChessEngine(fen);
  const step=after.move(from,to,promotion);
  if(!step.ok)return null;
  return {board,after,move,uci,actor:piece.type,victim,
   targetSquare:move.capture||to,status:step.status};
 }catch{return null;}
}
function immediateCandidate(fen,analysis,player){
 if(!analysis||analysis.depth<5||!UCI.test(analysis.bestMove)||!Array.isArray(analysis.pv)||
    analysis.pv[0]!==analysis.bestMove)return null;
 const reply=legalFirstReply(fen,analysis.bestMove,player);
 if(!reply)return null;
 const line=tacticalEvidence(fen,[analysis.bestMove],player,1);
 const firstEvents=line.events.filter(e=>e.ply===1);
 const byKind=kind=>firstEvents.find(e=>e.kind===kind);
 if(reply.status.type==='checkmate'&&reply.status.winner!==player){
  return {kind:'mate_sequence',uci:analysis.bestMove,from:analysis.bestMove.slice(0,2),
   to:analysis.bestMove.slice(2,4),targets:byKind('mate_sequence')?.targetSquares||[],
   basis:'legal_checkmate',depth:analysis.depth};
 }
 if(reply.victim){
  const exchange=evaluateStaticExchange(fen,analysis.bestMove);
  if(exchange?.exact&&exchange.scoreCp>=100){
   // An actual legal, profitable immediate capture is a demonstrable tactical
   // opportunity. Determine the motif from the *same* move, not later PV.
   const kind=byKind('undefended_capture')?'undefended_capture':reply.move.enPassant?'en_passant':'material_loss';
   return {kind,uci:analysis.bestMove,from:analysis.bestMove.slice(0,2),
    to:analysis.bestMove.slice(2,4),targets:[reply.targetSquare],
    basis:'positive_see',seeCp:exchange.scoreCp,depth:analysis.depth};
  }
 }
 if(reply.move.promotion){
  // Promotion is objectively visible now, but an apparent pawn race in a
  // single PV is not automatically the cause of the player's error.
  const queenValue=VALUES[reply.move.promotion]||0;
  if(queenValue>=VALUES.r&&analysis.cp>=100){
   return {kind:'promotion',uci:analysis.bestMove,from:analysis.bestMove.slice(0,2),
    to:analysis.bestMove.slice(2,4),targets:[analysis.bestMove.slice(2,4)],
    basis:'legal_promotion',depth:analysis.depth};
  }
 }
 // Only geometric *checking* double attacks qualify without a captured
 // victim. For all other forks, pins, x-rays and positional events the
 // current one-PV heuristic cannot prove material gain or forcedness.
 const fork=byKind('fork');
 if(fork&&reply.status.checked&&Array.isArray(fork.targets)&&fork.targets.includes('k')&&
    fork.targets.some(t=>['r','q'].includes(t))){
  // The checking forker can still be taken. In that case do not advertise a
  // fork as a verified threat without another defence search (stage 4+).
  const defended=reply.after.legalMoves().filter(m=>m.to===analysis.bestMove.slice(2,4)&&m.capture);
  if(!defended.length){
   return {kind:'fork',uci:analysis.bestMove,from:analysis.bestMove.slice(0,2),
    to:analysis.bestMove.slice(2,4),targets:fork.targetSquares||[],
    basis:'legal_checking_fork',depth:analysis.depth};
  }
 }
 const doubleCheck=byKind('double_check')||byKind('discovered_check');
 if(doubleCheck&&reply.status.checked){
  return {kind:doubleCheck.kind,uci:analysis.bestMove,from:analysis.bestMove.slice(0,2),
   to:analysis.bestMove.slice(2,4),targets:doubleCheck.targetSquares||[],
   basis:'legal_check',depth:analysis.depth};
 }
 return null;
}
/**
 * Quick probe: no deep search and NO pause if there is no immediately
 * inspectable tactical candidate on the post-move board.
 */
function quickThreatProbe({afterFen,after,player}){
 const candidate=immediateCandidate(afterFen,after,player);
 return candidate?{status:'candidate',candidate}:{status:POS,reason:'no_immediate_tactic'};
}
/**
 * Complete verification: Deep Stockfish must endorse the SAME immediate
 * response, with adequate depth and broadly compatible score. Alternate
 * first moves are ambiguous, not a licence to name whichever piece we like.
 * Exactly verified tactical geometry ≠ proof that the whole PV is forced.
 */
function verifyImmediateThreat({afterFen,after,deep,player}){
 const quick=quickThreatProbe({afterFen,after,player});
 if(quick.status!== 'candidate')return quick;
 if(!deep||deep.depth<7||!Array.isArray(deep.pv)||deep.pv[0]!==deep.bestMove||
    deep.bestMove!==quick.candidate.uci)
  return {status:POS,reason:'deep_disagreement_or_timeout'};
 if(!Number.isFinite(after.cp)||!Number.isFinite(deep.cp)||
    Math.abs(after.cp-deep.cp)>280)
  return {status:POS,reason:'unstable_engine_score'};
 const deepCandidate=immediateCandidate(afterFen,deep,player);
 if(!deepCandidate||deepCandidate.kind!==quick.candidate.kind||
    deepCandidate.basis!==quick.candidate.basis)
  return {status:POS,reason:'motif_unconfirmed'};
 if(quick.candidate.basis==='positive_see'&&
    (deepCandidate.seeCp<100||quick.candidate.seeCp<100))
  return {status:POS,reason:'unprofitable_capture'};
 return {status:TACTIC,reason:null,
  evidence:{...deepCandidate,fastDepth:after.depth,deepDepth:deep.depth,
   firstMove:deep.bestMove,secondMove:deep.secondMove||null,
   alternativeScore:deep.secondCp??null,
   note:'One confirmed tactical opportunity, not a proof of all replies'}};
}
export {POS,TACTIC,legalFirstReply,immediateCandidate,quickThreatProbe,verifyImmediateThreat};
