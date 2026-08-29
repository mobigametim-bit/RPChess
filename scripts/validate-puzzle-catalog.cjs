#!/usr/bin/env node
'use strict';

const assert=require('assert');
const path=require('path');
const {pathToFileURL}=require('url');
const {allocateStarTotals,allocateMix,TARGET_BY_TYPE}=require('./import-lichess-puzzles.cjs');

async function main(){
  const root=path.resolve(__dirname,'..');
  const core=await import(pathToFileURL(path.join(root,'game/js/puzzles/puzzle-core.mjs')).href);
  const catalogModule=await import(pathToFileURL(path.join(root,'game/js/puzzles/puzzle-catalog.mjs')).href);
  const engineModule=await import(pathToFileURL(path.join(root,'game/js/classic-chess-engine.mjs')).href);
  const catalog=catalogModule.PUZZLE_CATALOG;

  assert.strictEqual(catalogModule.PUZZLE_SOURCE.license,'CC0');
  assert.strictEqual(catalog.length,2000,'production Puzzle catalog must contain exactly 2000 tasks');

  const ids=new Set(),sourceIds=new Set(),actual=new Map();
  for(const puzzle of catalog){
    assert(core.isNormalizedPuzzle(puzzle),`invalid normalized puzzle: ${puzzle?.id}`);
    assert(!ids.has(puzzle.id),`duplicate puzzle id: ${puzzle.id}`);ids.add(puzzle.id);
    assert(!sourceIds.has(puzzle.sourceId),`duplicate source id: ${puzzle.sourceId}`);sourceIds.add(puzzle.sourceId);
    const row=core.DIFFICULTY_TABLE[puzzle.difficulty];
    assert(row,`missing difficulty row for ${puzzle.id}`);
    assert(puzzle.rating>=row.rating[0]&&puzzle.rating<=row.rating[1],`rating outside ★${puzzle.difficulty}: ${puzzle.id}`);
    assert(row.mix[puzzle.type]>0,`type ${puzzle.type} not allowed at ★${puzzle.difficulty}: ${puzzle.id}`);
    assert.strictEqual(puzzle.reward,core.puzzleBaseGold(puzzle.difficulty),`reward mismatch: ${puzzle.id}`);
    const key=`${puzzle.difficulty}:${puzzle.type}`;
    actual.set(key,(actual.get(key)||0)+1);
  }

  const starTotals=allocateStarTotals(2000);
  for(let star=1;star<=12;star+=1){
    const allocation=allocateMix(starTotals[star-1],core.DIFFICULTY_TABLE[star].mix);
    const starCount=catalog.filter(puzzle=>puzzle.difficulty===star).length;
    assert.strictEqual(starCount,starTotals[star-1],`★${star} total mismatch`);
    for(const [type,count] of Object.entries(allocation))assert.strictEqual(actual.get(`${star}:${type}`)||0,count,`★${star} ${type} quota mismatch`);
  }

  // Lightweight engine smoke: one representative line per supported type.
  for(const type of core.PUZZLE_TYPES){
    const puzzle=catalog.find(item=>item.type===type);
    assert(puzzle,`missing representative type ${type}`);
    const engine=new engineModule.ClassicChessEngine(puzzle.fen);
    assert.strictEqual(engine.turn(),puzzle.side,`side mismatch: ${puzzle.id}`);
    let capturedTarget=false;
    for(const uci of puzzle.solution){
      const move=core.uciParts(uci);assert(move,`invalid UCI: ${puzzle.id}`);
      const mover=engine.turn(),captured=engine.pieceAt(move.to),result=engine.move(move.from,move.to,move.promotion);
      assert(result.ok,`illegal representative line: ${puzzle.id} ${uci}`);
      if(type==='material'&&mover===puzzle.side&&captured&&captured.color!==puzzle.side&&TARGET_BY_TYPE[captured.type]===puzzle.targetPiece)capturedTarget=true;
    }
    if(type.startsWith('mate')){
      assert.strictEqual(engine.status().type,'checkmate',`representative mate does not finish: ${puzzle.id}`);
      assert.strictEqual(engine.status().winner,puzzle.side,`representative mate winner mismatch: ${puzzle.id}`);
    }else{
      assert(capturedTarget,`representative material target not captured: ${puzzle.id}`);
      assert(puzzle.materialGain>0,`representative material gain invalid: ${puzzle.id}`);
    }
  }

  const typeTotals=Object.fromEntries(core.PUZZLE_TYPES.map(type=>[type,catalog.filter(puzzle=>puzzle.type===type).length]));
  console.log(`Puzzle production catalog validation: PASS — ${catalog.length} unique tasks; ${JSON.stringify(typeTotals)}`);
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
