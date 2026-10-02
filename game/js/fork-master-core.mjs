import { parseFEN, legalMoves, simulateMove, inCheck, squareToIndex, indexToSquare } from './classic-chess-engine.mjs';

function attacksKing(state,from,to){
  const piece=state.board[from],dx=to%8-from%8,dy=Math.floor(to/8)-Math.floor(from/8);
  if(piece.type==='p')return Math.abs(dx)===1 && dy===(piece.color==='w'?1:-1);
  if(piece.type==='n')return Math.abs(dx)*Math.abs(dy)===2;
  // Kings cannot form a legal attack on the opposing king.
  if(piece.type==='k')return false;
  const straight=(dx===0)!==(dy===0),diagonal=Math.abs(dx)===Math.abs(dy)&&dx!==0;
  if(!((piece.type==='r'&&straight)||(piece.type==='b'&&diagonal)||(piece.type==='q'&&(straight||diagonal))))return false;
  const sx=Math.sign(dx),sy=Math.sign(dy),distance=Math.max(Math.abs(dx),Math.abs(dy));
  for(let i=1;i<distance;i++){const at=from+sx*i+sy*i*8;if(state.board[at]||state.blockedSquares.has(at))return false;}
  return !state.blockedSquares.has(to);
}

function targetsFor(state,from,color,withDefense=false){
  // Future targets are evaluated before the enemy reply. EP belongs only to
  // the side actually on move; changing the analysis turn must not invent EP.
  const ownTurn={...state,turn:color,enPassant:state.turn===color?state.enPassant:null};
  const targets=new Map();
  for(const move of legalMoves(ownTurn,indexToSquare(from))){
    if(move.capture==null)continue;
    const square=indexToSquare(move.capture);
    let defended=false;
    if(withDefense){
      const after=simulateMove(ownTurn,move);
      defended=legalMoves(after).some(reply=>reply.capture===move.to);
    }
    // Promotion can offer multiple captures of the same target: green if at
    // least one legal promotion avoids a recapture.
    if(!targets.has(square)||!defended)targets.set(square,defended?'red':'green');
  }
  const king=state.board.findIndex(p=>p?.color!==color&&p?.type==='k');
  if(king>=0 && attacksKing(state,from,king) && !inCheck(simulateMove(ownTurn,{from,to:king,capture:king}),color))targets.set(indexToSquare(king),'check');
  return targets;
}

function forkMasterHints(snapshot,selectedSquare,playerColor){
  const empty={targets:new Map(),destinations:new Set()};
  if(!snapshot?.fen || snapshot.status?.over || snapshot.turn!==playerColor || !/^[a-h][1-8]$/.test(selectedSquare||''))return empty;
  const state=parseFEN(snapshot.fen),from=squareToIndex(selectedSquare);
  state.chess960=Boolean(snapshot.chess960);
  state.blockedSquares=new Set((snapshot.blockedSquares||[]).map(squareToIndex));
  if(state.board[from]?.color!==playerColor)return empty;
  const targets=targetsFor(state,from,playerColor,true),destinations=new Set();
  for(const move of legalMoves(state,selectedSquare)){
    const after=simulateMove(state,move);
    if(targetsFor(after,move.to,playerColor).size>=2)destinations.add(indexToSquare(move.uciTo??move.to));
  }
  return {targets:targets.size>=2?targets:new Map(),destinations};
}

export { forkMasterHints };
