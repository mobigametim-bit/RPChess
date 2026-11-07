/* Legal-move-aware bounded capture exchange search for the Mentor.
 * This is a stand-pat material exchange estimate (SEE), not a complete
 * multi-move evaluation or proof that a tactic is forced. Uses OUR chess
 * rules for pins, promotions, en-passant and discovered attacks.
 *
 * Deliberately not wired into the live mentor until Stage 4's threat
 * classifier combines exchanges with independent Stockfish confirmation.
 */
import {ClassicChessEngine} from './classic-chess-engine.mjs';

const VALUE=Object.freeze({p:100,n:320,b:330,r:500,q:900,k:20000});
const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;

function legalCapturesAt(board,square){
 return board.legalMoves().filter(m=>m.to===square&&m.capture&&board.pieceAt(m.capture));
}
function moveUci(m){return m.from+m.to+(m.promotion||'');}
function captureBonus(piece,move){
 return (VALUE[piece?.type]||0)+(move.promotion?VALUE[move.promotion]-VALUE.p:0);
}
/* Opponent can choose to stop recapturing. Search all legal recaptures, not
 * just the geometrically cheapest attacker, so pinned attackers and x-rays
 * are handled by ChessEngine. The budget makes uncertain answers explicit. */
function recaptures(board,square,depth,options,budget){
 const moves=legalCapturesAt(board,square);
 if(!moves.length)return {gain:0,line:[],exact:!board.status().checked};
 if(depth>=options.maxPlies||budget.nodes>=options.maxNodes)
  return {gain:0,line:[],exact:false};
 let best=0,bestLine=[],exact=!board.status().checked;
 for(const m of moves){
  if(budget.nodes>=options.maxNodes){exact=false;break;}
  budget.nodes++;
  const victim=board.pieceAt(m.capture);
  const next=new ClassicChessEngine(board.fen());
  const played=next.move(m.from,m.to,m.promotion||null);
  if(!played.ok){exact=false;continue;}
  const reply=recaptures(next,square,depth+1,options,budget);
  const score=captureBonus(victim,m)-reply.gain;
  if(score>best){best=score;bestLine=[moveUci(m),...reply.line];}
  if(!reply.exact)exact=false;
 }
 return {gain:best,line:bestLine,exact};
}
/**
 * Estimate material from the ORIGINAL mover's perspective after an
 * explicitly selected capture. scoreCp>0 means the resulting capture tree
 * favors that mover; scoreCp<0 means recapture makes it unfavorable.
 * exact=false must never be used as a verified tactical fact.
 *
 * CPU safety: a maximum of 10 plies and 2048 searched captures even when
 * callers request larger values. A checking position is conservative
 * (exact=false), since non-capture check evasions aren't in this tree.
 */
function evaluateStaticExchange(fen,uci,{maxPlies=8,maxNodes=512}={}){
 if(typeof fen!=='string'||typeof uci!=='string'||!UCI.test(uci))return null;
 const maxDepth=Math.max(1,Math.min(10,Math.trunc(maxPlies)||8));
 const maxCount=Math.max(1,Math.min(2048,Math.trunc(maxNodes)||512));
 let board;
 try{board=new ClassicChessEngine(fen);}catch{return null;}
 const from=uci.slice(0,2),to=uci.slice(2,4),promotion=uci.slice(4)||null;
 const move=board.legalMoves(from).find(m=>m.to===to&&
   (m.promotion||null)===promotion&&m.capture);
 if(!move)return null;
 const victim=board.pieceAt(move.capture);
 if(!victim||victim.type==='k')return null;
 const next=new ClassicChessEngine(board.fen());
 const step=next.move(from,to,promotion);
 if(!step.ok)return null;
 const budget={nodes:1};
 const reply=recaptures(next,to,1,{maxPlies:maxDepth,maxNodes:maxCount},budget);
 const scoreCp=captureBonus(victim,move)-reply.gain;
 return {scoreCp,exact:reply.exact,captured:victim.type,
  firstMove:uci,line:[uci,...reply.line],nodes:budget.nodes};
}
export {VALUE,evaluateStaticExchange};
