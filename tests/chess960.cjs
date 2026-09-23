const assert = require('assert');
(async()=>{
  const {chess960BackRank,chess960Fen}=await import('../game/js/chess960.mjs');
  const {ClassicChessEngine,parseFEN,stateToFEN}=await import('../game/js/classic-chess-engine.mjs');
  const {moveToUci}=await import('../game/js/chess-ai-adapter.mjs');
  const ranks=new Set();
  assert.equal(chess960BackRank(518),'rnbqkbnr');
  for(let i=0;i<960;i++){
    const rank=chess960BackRank(i);ranks.add(rank);
    assert.equal([...rank].sort().join(''),'bbknnqrr');
    assert.notEqual(rank.indexOf('b')%2,rank.lastIndexOf('b')%2);
    assert(rank.indexOf('r')<rank.indexOf('k')&&rank.indexOf('k')<rank.lastIndexOf('r'));
    const fen=chess960Fen(i),engine=new ClassicChessEngine(fen);
    assert.equal(engine.fen(),fen);assert(!engine.status().over);
    assert.equal(fen.split('/')[0],rank);assert.equal(fen.split('/')[7].split(' ')[0],rank.toUpperCase());
    // Exercise every start's castling geometry for each side/color on a cleared board.
    for(const color of ['w','b'])for(const side of ['K','Q']){
      const state=parseFEN(fen),home=color==='w'?0:56,king=home+rank.indexOf('k');
      const right=color==='w'?side:side.toLowerCase(),rook=state.castleRooks[right];
      state.board=Array(64).fill(null);state.board[king]={type:'k',color};state.board[rook]={type:'r',color};
      state.board[color==='w'?60:4]={type:'k',color:color==='w'?'b':'w'};
      state.turn=color;state.castling={K:false,Q:false,k:false,q:false};state.castling[right]=true;
      const e=new ClassicChessEngine(stateToFEN(state)),castle=e.legalMoves().find(m=>m.castle===side);
      assert(castle,`castle ${i} ${color} ${side}`);
      assert.equal(moveToUci(castle),castle.from+castle.rookFrom);
      assert(e.move(castle.from,castle.uciTo).ok);
      assert.deepEqual(e.pieceAt(castle.to),{type:'k',color});assert.deepEqual(e.pieceAt(castle.rookTo),{type:'r',color});
      assert.equal(e.snapshot().board.filter(Boolean).length,3);assert(!e.snapshot().castling[right]);
    }
  }
  assert.equal(ranks.size,960);
  for(const i of [-1,960,1.5])assert.throws(()=>chess960BackRank(i));
  // Rook b1 shields a stationary king c1 from a1: moving rook exposes check.
  const revealed=new ClassicChessEngine('4k3/8/8/8/8/8/8/rRK5 w B - 0 1');
  assert(!revealed.legalMoves().some(m=>m.castle));
  const transit=new ClassicChessEngine('4kr2/8/8/8/8/8/8/1K5R w H - 0 1');
  assert(!transit.legalMoves().some(m=>m.castle),'cannot cross attacked f1');
  const blocked=new ClassicChessEngine('4k3/8/8/8/8/8/8/1K2N2R w H - 0 1');
  assert(!blocked.legalMoves().some(m=>m.castle),'cannot cross occupied e1');
  const rights=new ClassicChessEngine('4k3/8/8/8/8/8/8/1RK4R w HB - 0 1');
  assert(rights.move('b1','b2').ok);assert.equal(rights.snapshot().castling.Q,false);assert.equal(rights.snapshot().castling.K,true);
  const capture=new ClassicChessEngine('4k3/8/8/8/8/8/1r6/1RK4R b HB - 0 1');
  assert(capture.move('b2','b1').ok);assert.equal(capture.snapshot().castling.Q,false);
  console.log('Chess960: all 960 starts, 3840 castlings, check paths and rights PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
