'use strict';

const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const crypto=require('crypto');

const SOURCE=path.resolve('game/js/puzzles/catalog-data/puzzle-catalog-11498.json.gz');
const OUTPUT=path.resolve('game/js/puzzles/puzzle-catalog.mjs');
const EXPECTED_SHA256='dc3d10ee765e8e9a76f07bee010c672cb576e8c11a3e191693e9b3f221ac770c';
const EXPECTED_COUNT=11498;
const EXPECTED_TYPE_TOTALS=Object.freeze({mate1:1717,mate2:2859,mate3:554,material:6368});
const EXPECTED_STAR_TOTALS=Object.freeze({1:781,2:1260,3:2218,4:1624,5:1348,6:1148,7:972,8:717,9:551,10:427,11:303,12:149});
const TYPES=new Set(Object.keys(EXPECTED_TYPE_TOTALS));
const TARGETS=new Set(['queen','rook','bishop','knight']);

function fail(message){throw new Error(`Puzzle catalog materializer: ${message}`);}
function splitWords(value){return String(value||'').trim().split(/\s+/).filter(Boolean);}

function decodeRow(row,index){
  if(!Array.isArray(row)||row.length!==10)fail(`row ${index} must contain exactly 10 compact fields`);
  const [sourceId,fen,side,solutionText,type,rating,difficulty,targetPieceRaw,materialGain,themesText]=row;
  if(typeof sourceId!=='string'||!sourceId)fail(`row ${index} missing sourceId`);
  if(typeof fen!=='string'||!fen)fail(`row ${index} missing FEN`);
  if(!['w','b'].includes(side))fail(`row ${index} invalid side`);
  const solution=splitWords(solutionText);if(!solution.length||solution.some(move=>!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)))fail(`row ${index} invalid solution`);
  if(!TYPES.has(type))fail(`row ${index} invalid type ${type}`);
  if(!Number.isInteger(rating)||rating<0)fail(`row ${index} invalid rating`);
  if(!Number.isInteger(difficulty)||difficulty<1||difficulty>12)fail(`row ${index} invalid difficulty`);
  const targetPiece=targetPieceRaw||null;
  if(type==='material'&&!TARGETS.has(targetPiece))fail(`row ${index} invalid material target`);
  if(type!=='material'&&targetPiece!==null)fail(`row ${index} unexpected target`);
  if(!Number.isInteger(materialGain)||materialGain<0)fail(`row ${index} invalid material gain`);
  if(type==='material'&&materialGain<=0)fail(`row ${index} non-positive material gain`);
  if(type!=='material'&&materialGain!==0)fail(`row ${index} unexpected material gain`);
  const themes=splitWords(themesText);
  return {id:`puzzle.${sourceId}`,sourceId,fen,side,solution,type,rating,difficulty,themes,targetPiece,materialGain,reward:9+3*difficulty};
}

function materialize(){
  if(!fs.existsSync(SOURCE))fail(`source not found: ${SOURCE}`);
  const compressed=fs.readFileSync(SOURCE);
  const digest=crypto.createHash('sha256').update(compressed).digest('hex');
  if(digest!==EXPECTED_SHA256)fail(`SHA-256 mismatch: expected ${EXPECTED_SHA256}, got ${digest}`);
  let compact;
  try{compact=JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));}catch(error){fail(`cannot decode gzip JSON: ${error.message}`);}
  if(!Array.isArray(compact)||compact.length!==EXPECTED_COUNT)fail(`expected ${EXPECTED_COUNT} rows, got ${Array.isArray(compact)?compact.length:'non-array'}`);

  const typeTotals={mate1:0,mate2:0,mate3:0,material:0};
  const starTotals=Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,0]));
  const ids=new Set();
  const puzzles=compact.map((row,index)=>{
    const puzzle=decodeRow(row,index);
    if(ids.has(puzzle.sourceId))fail(`duplicate sourceId ${puzzle.sourceId}`);ids.add(puzzle.sourceId);
    typeTotals[puzzle.type]+=1;starTotals[puzzle.difficulty]+=1;
    return puzzle;
  });
  for(const [type,count] of Object.entries(EXPECTED_TYPE_TOTALS))if(typeTotals[type]!==count)fail(`${type} total ${typeTotals[type]} != ${count}`);
  for(const [star,count] of Object.entries(EXPECTED_STAR_TOTALS))if(starTotals[star]!==count)fail(`★${star} total ${starTotals[star]} != ${count}`);

  const body=JSON.stringify(puzzles);
  const meta={count:EXPECTED_COUNT,sha256:EXPECTED_SHA256,typeTotals:EXPECTED_TYPE_TOTALS,starTotals:EXPECTED_STAR_TOTALS};
  const moduleText=`// Generated deterministically from catalog-data/puzzle-catalog-11498.json.gz.\n// Source: Lichess Open Database Puzzles (CC0). Do not hand-edit.\n\nconst raw=${body};\nconst PUZZLE_CATALOG=Object.freeze(raw.map((puzzle)=>Object.freeze({...puzzle,solution:Object.freeze(puzzle.solution),themes:Object.freeze(puzzle.themes)})));\nconst PUZZLE_SOURCE=Object.freeze({name:'Lichess Open Database Puzzles',license:'CC0',url:'https://database.lichess.org/#puzzles'});\nconst PUZZLE_CATALOG_META=Object.freeze(${JSON.stringify(meta)});\n\nexport { PUZZLE_CATALOG, PUZZLE_SOURCE, PUZZLE_CATALOG_META };\n`;
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,moduleText);
  console.log(`Puzzle catalog materializer: PASS — ${EXPECTED_COUNT} tasks, ${compressed.length} compressed bytes, sha256 ${digest}`);
  return {count:EXPECTED_COUNT,typeTotals,starTotals,digest};
}

if(require.main===module){try{materialize();}catch(error){console.error(error.stack||error);process.exitCode=1;}}
module.exports={SOURCE,OUTPUT,EXPECTED_SHA256,EXPECTED_COUNT,EXPECTED_TYPE_TOTALS,EXPECTED_STAR_TOTALS,decodeRow,materialize};
