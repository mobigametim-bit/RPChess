#!/usr/bin/env node
'use strict';

const assert=require('assert');
const path=require('path');
const {pathToFileURL}=require('url');
const {TARGET_BY_TYPE,isMateType}=require('./import-lichess-puzzles.cjs');
const {EXPECTED_COUNT}=require('./materialize-puzzle-catalog.cjs');
const PIECE_VALUE=Object.freeze({p:1,n:3,b:3,r:5,q:9,k:0});

function materialScore(snapshot,side){
  let ours=0,theirs=0;
  for(const piece of snapshot.board||[]){
    if(!piece)continue;
    const value=PIECE_VALUE[piece.type]||0;
    if(piece.color===side)ours+=value;else theirs+=value;
  }
  return ours-theirs;
}

async function main(){
  const root=path.resolve(__dirname,'..');
  const core=await import(pathToFileURL(path.join(root,'game/js/puzzles/puzzle-core.mjs')).href);
  const catalogModule=await import(`${pathToFileURL(path.join(root,'game/js/puzzles/puzzle-catalog.mjs')).href}?full=${Date.now()}`);
  const engineModule=await import(pathToFileURL(path.join(root,'game/js/classic-chess-engine.mjs')).href);
  const catalog=catalogModule.PUZZLE_CATALOG;
  assert.strictEqual(catalog.length,EXPECTED_COUNT);

  let checked=0;
  for(const puzzle of catalog){
    const engine=new engineModule.ClassicChessEngine(puzzle.fen);
    assert.strictEqual(engine.turn(),puzzle.side,`side mismatch: ${puzzle.id}`);
    const initialMaterial=materialScore(engine.snapshot(),puzzle.side);
    const capturedTargets=[];
    let sawMate=false;
    for(const uci of puzzle.solution){
      const move=core.uciParts(uci);assert(move,`invalid UCI: ${puzzle.id} ${uci}`);
      const mover=engine.turn();
      const captured=engine.pieceAt(move.to);
      const result=engine.move(move.from,move.to,move.promotion);
      assert(result.ok,`illegal solution move: ${puzzle.id} ${uci}`);
      if(mover===puzzle.side&&captured&&captured.color!==puzzle.side&&TARGET_BY_TYPE[captured.type])capturedTargets.push(TARGET_BY_TYPE[captured.type]);
      if(result.status.type==='checkmate')sawMate=true;
    }

    if(isMateType(puzzle.type)){
      assert.strictEqual(engine.status().type,'checkmate',`mate line does not finish in checkmate: ${puzzle.id}`);
      assert.strictEqual(engine.status().winner,puzzle.side,`mate winner mismatch: ${puzzle.id}`);
    }else{
      assert.strictEqual(puzzle.type,'material',`unexpected non-mate type: ${puzzle.id}`);
      assert(!sawMate&&engine.status().type!=='checkmate',`material line unexpectedly mates: ${puzzle.id}`);
      const unique=[...new Set(capturedTargets)];
      assert.deepStrictEqual(unique,[puzzle.targetPiece],`material target mismatch: ${puzzle.id}`);
      const gain=materialScore(engine.snapshot(),puzzle.side)-initialMaterial;
      assert(gain>0,`material line has no positive gain: ${puzzle.id}`);
      assert.strictEqual(Math.round(gain),puzzle.materialGain,`material gain mismatch: ${puzzle.id}`);
    }
    checked+=1;
  }
  console.log(`Puzzle full engine validation: PASS — replayed ${checked}/${EXPECTED_COUNT} curated solutions`);
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
