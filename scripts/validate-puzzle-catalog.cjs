#!/usr/bin/env node
'use strict';

const assert=require('assert');
const path=require('path');
const {pathToFileURL}=require('url');
const {TARGET_BY_TYPE,isMateType}=require('./import-lichess-puzzles.cjs');
const {EXPECTED_SHA256,EXPECTED_COUNT,EXPECTED_TYPE_TOTALS,EXPECTED_STAR_TOTALS}=require('./materialize-puzzle-catalog.cjs');

async function main(){
  const root=path.resolve(__dirname,'..');
  const core=await import(pathToFileURL(path.join(root,'game/js/puzzles/puzzle-core.mjs')).href);
  const catalogModule=await import(`${pathToFileURL(path.join(root,'game/js/puzzles/puzzle-catalog.mjs')).href}?v=${Date.now()}`);
  const engineModule=await import(pathToFileURL(path.join(root,'game/js/classic-chess-engine.mjs')).href);
  const catalog=catalogModule.PUZZLE_CATALOG;
  const meta=catalogModule.PUZZLE_CATALOG_META;

  assert.strictEqual(catalogModule.PUZZLE_SOURCE.license,'CC0');
  assert.strictEqual(catalog.length,EXPECTED_COUNT,`production Puzzle catalog must contain ${EXPECTED_COUNT} tasks`);
  assert(meta,'generated Puzzle catalog metadata is missing');
  assert.strictEqual(meta.count,EXPECTED_COUNT);
  assert.strictEqual(meta.sha256,EXPECTED_SHA256);
  assert.deepStrictEqual(meta.typeTotals,EXPECTED_TYPE_TOTALS);
  assert.deepStrictEqual(meta.starTotals,EXPECTED_STAR_TOTALS);

  const ids=new Set(),sourceIds=new Set();
  const typeTotals=Object.fromEntries(core.PUZZLE_TYPES.map(type=>[type,0]));
  const starTotals=Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,0]));
  for(const puzzle of catalog){
    assert(core.isNormalizedPuzzle(puzzle),`invalid normalized puzzle: ${puzzle?.id}`);
    assert(!ids.has(puzzle.id),`duplicate puzzle id: ${puzzle.id}`);ids.add(puzzle.id);
    assert(!sourceIds.has(puzzle.sourceId),`duplicate source id: ${puzzle.sourceId}`);sourceIds.add(puzzle.sourceId);
    const row=core.DIFFICULTY_TABLE[puzzle.difficulty];
    assert(row,`missing difficulty row for ${puzzle.id}`);
    assert(puzzle.rating>=row.rating[0]&&puzzle.rating<=row.rating[1],`rating outside ★${puzzle.difficulty}: ${puzzle.id}`);
    assert(row.mix[puzzle.type]>0,`type ${puzzle.type} not allowed at ★${puzzle.difficulty}: ${puzzle.id}`);
    assert.strictEqual(puzzle.reward,core.puzzleBaseGold(puzzle.difficulty),`reward mismatch: ${puzzle.id}`);
    typeTotals[puzzle.type]+=1;starTotals[puzzle.difficulty]+=1;
  }
  assert.deepStrictEqual(typeTotals,EXPECTED_TYPE_TOTALS,'type totals mismatch');
  assert.deepStrictEqual(starTotals,EXPECTED_STAR_TOTALS,'star totals mismatch');

  // Lightweight engine smoke only: one representative line per supported type.
  // Full 11,498-line replay lives in scripts/validate-puzzle-catalog-full.cjs and is not part of the regular build gate.
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
    if(isMateType(type)){
      assert.strictEqual(engine.status().type,'checkmate',`representative mate does not finish: ${puzzle.id}`);
      assert.strictEqual(engine.status().winner,puzzle.side,`representative mate winner mismatch: ${puzzle.id}`);
    }else{
      assert(capturedTarget,`representative material target not captured: ${puzzle.id}`);
      assert(puzzle.materialGain>0,`representative material gain invalid: ${puzzle.id}`);
      assert.notStrictEqual(engine.status().type,'checkmate',`representative material line unexpectedly mates: ${puzzle.id}`);
    }
  }

  console.log(`Puzzle production catalog validation: PASS — ${catalog.length} unique tasks; ${JSON.stringify(typeTotals)}; stars ${JSON.stringify(starTotals)}`);
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
