#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const readline=require('readline');
const {pathToFileURL}=require('url');

const MATERIAL_THEMES=new Set(['hangingPiece','fork','skewer','trappedPiece','capturingDefender','pin']);
const TARGET_BY_TYPE=Object.freeze({q:'queen',r:'rook',b:'bishop',n:'knight'});
const PIECE_VALUE=Object.freeze({p:1,n:3,b:3,r:5,q:9,k:0});
const DEFAULT_COUNT=2000;
const DEFAULT_SEED='rpchess-puzzles-v1';
const DEFAULT_MATE_OVERSAMPLE=8;
const DEFAULT_MATERIAL_OVERSAMPLE=30;

function parseCsvLine(line){
  const fields=[];let value='',quoted=false;
  for(let i=0;i<line.length;i+=1){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){value+='"';i+=1;}
      else quoted=!quoted;
    }else if(ch===','&&!quoted){fields.push(value);value='';}
    else value+=ch;
  }
  fields.push(value);
  return fields;
}
function rowFromHeader(header,line){
  const values=parseCsvLine(line),row={};
  for(let i=0;i<header.length;i+=1)row[header[i]]=values[i]??'';
  return row;
}
function parseArgs(argv){
  const result={input:null,output:path.resolve('game/js/puzzles/puzzle-catalog.generated.mjs'),count:DEFAULT_COUNT,seed:DEFAULT_SEED,mateOversample:DEFAULT_MATE_OVERSAMPLE,materialOversample:DEFAULT_MATERIAL_OVERSAMPLE};
  for(let i=0;i<argv.length;i+=1){
    const arg=argv[i];
    if(arg==='--input')result.input=argv[++i];
    else if(arg==='--output')result.output=path.resolve(argv[++i]);
    else if(arg==='--count')result.count=Math.max(12,Number(argv[++i])||DEFAULT_COUNT);
    else if(arg==='--seed')result.seed=String(argv[++i]||DEFAULT_SEED);
    else if(arg==='--mate-oversample')result.mateOversample=Math.max(2,Number(argv[++i])||DEFAULT_MATE_OVERSAMPLE);
    else if(arg==='--material-oversample')result.materialOversample=Math.max(4,Number(argv[++i])||DEFAULT_MATERIAL_OVERSAMPLE);
    else if(arg==='--stdin')result.input='-';
    else if(!arg.startsWith('--')&&!result.input)result.input=arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if(!result.input)throw new Error('Usage: node scripts/import-lichess-puzzles.cjs --input lichess_db_puzzle.csv [--output game/js/puzzles/puzzle-catalog.generated.mjs] [--count 2000] [--seed rpchess-puzzles-v1]. Use --stdin to pipe decompressed CSV.');
  return result;
}
function hashString(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;}
function materialScore(snapshot,side){let ours=0,theirs=0;for(const piece of snapshot.board||[]){if(!piece)continue;const value=PIECE_VALUE[piece.type]||0;if(piece.color===side)ours+=value;else theirs+=value;}return ours-theirs;}
function typeFromThemes(themes){const set=themes instanceof Set?themes:new Set(themes||[]);if(set.has('mateIn1'))return'mate1';if(set.has('mateIn2'))return'mate2';if(set.has('mateIn3'))return'mate3';if(set.has('mate'))return null;for(const theme of MATERIAL_THEMES)if(set.has(theme))return'material';return null;}
function expectedSolutionPlies(type){return type==='mate1'?1:type==='mate2'?3:type==='mate3'?5:null;}
function allocateStarTotals(count){const base=Math.floor(count/12),remainder=count%12;return Array.from({length:12},(_,i)=>base+(i<remainder?1:0));}
function allocateMix(total,mix){const entries=Object.entries(mix),raw=entries.map(([type,weight])=>({type,value:total*weight/100,amount:Math.floor(total*weight/100)}));let left=total-raw.reduce((sum,item)=>sum+item.amount,0);raw.sort((a,b)=>(b.value-b.amount)-(a.value-a.amount)||a.type.localeCompare(b.type));for(let i=0;i<left;i+=1)raw[i%raw.length].amount+=1;return Object.fromEntries(raw.map(item=>[item.type,item.amount]));}
function closestEligibleStar(rating,type,difficultyTable){const candidates=[];for(let star=1;star<=12;star+=1){const row=difficultyTable[star];if(!row||!row.mix?.[type])continue;if(rating<row.rating[0]||rating>row.rating[1])continue;const midpoint=(row.rating[0]+row.rating[1])/2;candidates.push({star,distance:Math.abs(rating-midpoint)});}candidates.sort((a,b)=>a.distance-b.distance||a.star-b.star);return candidates[0]?.star||null;}
function reservoirPush(bucket,item,limit,score){if(limit<=0)return;if(bucket.length<limit){bucket.push({score,item});bucket.sort((a,b)=>b.score-a.score);return;}if(score>=bucket[0].score)return;bucket[0]={score,item};bucket.sort((a,b)=>b.score-a.score);}
function uciParts(value){const uci=String(value||'').trim().toLowerCase();return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)?{from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci.slice(4,5)||null,uci}:null;}

function preclassifyLichessRow(row,difficultyTable){
  const sourceId=String(row.PuzzleId||'').trim(),rating=Number(row.Rating),deviation=Number(row.RatingDeviation),popularity=Number(row.Popularity),themes=String(row.Themes||'').trim().split(/\s+/).filter(Boolean),themeSet=new Set(themes),moves=String(row.Moves||'').trim().split(/\s+/).filter(Boolean);
  if(!sourceId||!Number.isFinite(rating)||!Number.isFinite(deviation)||!Number.isFinite(popularity)||popularity<80||deviation>100||moves.length<2)return null;
  const type=typeFromThemes(themeSet);if(!type)return null;if(type==='material'&&themeSet.has('mate'))return null;
  const expected=expectedSolutionPlies(type);if(expected!=null&&moves.length-1!==expected)return null;
  const star=closestEligibleStar(rating,type,difficultyTable);if(!star)return null;
  return {sourceId,rating,deviation,popularity,themes,themeSet,moves,type,star};
}

async function normalizeLichessRow(row,{ClassicChessEngine,puzzleBaseGold,difficultyTable,preclassified=null}){
  const pre=preclassified||preclassifyLichessRow(row,difficultyTable);if(!pre)return null;
  const {sourceId,rating,themes,moves,type,star}=pre;
  const sourceEngine=new ClassicChessEngine(String(row.FEN||'')),blunder=uciParts(moves[0]);if(!blunder)return null;const blunderResult=sourceEngine.move(blunder.from,blunder.to,blunder.promotion);if(!blunderResult.ok)return null;
  const startFen=blunderResult.fen,side=sourceEngine.turn(),solution=moves.slice(1).map(uciParts);if(!solution.length||solution.some(move=>!move))return null;
  const engine=new ClassicChessEngine(startFen),initialMaterial=materialScore(engine.snapshot(),side),targets=[];let sawMate=false;
  for(const move of solution){const capturedBefore=engine.pieceAt(move.to),mover=engine.turn(),result=engine.move(move.from,move.to,move.promotion);if(!result.ok)return null;if(mover===side&&capturedBefore&&capturedBefore.color!==side&&TARGET_BY_TYPE[capturedBefore.type])targets.push(TARGET_BY_TYPE[capturedBefore.type]);if(result.status.type==='checkmate')sawMate=true;}
  if(type.startsWith('mate')){if(engine.status().type!=='checkmate'||engine.status().winner!==side)return null;}else if(sawMate||engine.status().type==='checkmate')return null;
  let targetPiece=null,materialGain=0;
  if(type==='material'){const unique=[...new Set(targets)];if(unique.length!==1)return null;targetPiece=unique[0];materialGain=materialScore(engine.snapshot(),side)-initialMaterial;if(materialGain<=0)return null;}
  return {id:`puzzle.${sourceId}`,sourceId,fen:startFen,side,solution:solution.map(move=>move.uci),type,rating:Math.round(rating),difficulty:star,themes,targetPiece,materialGain:Math.round(materialGain),reward:puzzleBaseGold(star)};
}
function serializeCatalog(items){const body=items.map(item=>`  Object.freeze(${JSON.stringify({...item,solution:item.solution,themes:item.themes})})`).join(',\n');return `// Generated from Lichess Open Database Puzzles (CC0).\n// Curated by scripts/import-lichess-puzzles.cjs; do not hand-edit entries.\n// Runtime format is source-agnostic and fully offline.\n\nconst PUZZLE_CATALOG = Object.freeze([\n${body}\n]);\n\nconst PUZZLE_SOURCE = Object.freeze({name:'Lichess Open Database Puzzles',license:'CC0',url:'https://database.lichess.org/#puzzles'});\n\nexport { PUZZLE_CATALOG, PUZZLE_SOURCE };\n`;}

async function importLichessPuzzles(options){
  const root=path.resolve(__dirname,'..'),engineModule=await import(pathToFileURL(path.join(root,'game/js/classic-chess-engine.mjs')).href),core=await import(pathToFileURL(path.join(root,'game/js/puzzles/puzzle-core.mjs')).href),starTotals=allocateStarTotals(options.count),limits=new Map(),candidateBuckets=new Map();
  for(let star=1;star<=12;star+=1){const allocation=allocateMix(starTotals[star-1],core.DIFFICULTY_TABLE[star].mix);for(const [type,limit] of Object.entries(allocation)){const key=`${star}:${type}`;limits.set(key,limit);candidateBuckets.set(key,[]);}}
  const input=options.input==='-'?process.stdin:fs.createReadStream(path.resolve(options.input),{encoding:'utf8'}),rl=readline.createInterface({input,crlfDelay:Infinity});let header=null,seen=0,cheapEligible=0;
  for await(const line of rl){if(!header){header=parseCsvLine(line.replace(/^\uFEFF/,''));continue;}if(!line.trim())continue;seen+=1;const row=rowFromHeader(header,line),pre=preclassifyLichessRow(row,core.DIFFICULTY_TABLE);if(!pre)continue;const key=`${pre.star}:${pre.type}`,limit=limits.get(key)||0;if(!limit)continue;cheapEligible+=1;const factor=pre.type==='material'?options.materialOversample:options.mateOversample;reservoirPush(candidateBuckets.get(key),{row,pre},Math.max(limit,Math.ceil(limit*factor)),hashString(`${options.seed}:${pre.sourceId}:${key}`));}
  const selectedByKey=new Map();let engineValidated=0;
  for(const [key,limit] of limits){const candidates=(candidateBuckets.get(key)||[]).slice().sort((a,b)=>a.score-b.score),selected=[];for(const entry of candidates){if(selected.length>=limit)break;let puzzle=null;try{puzzle=await normalizeLichessRow(entry.item.row,{ClassicChessEngine:engineModule.ClassicChessEngine,puzzleBaseGold:core.puzzleBaseGold,difficultyTable:core.DIFFICULTY_TABLE,preclassified:entry.item.pre});}catch{puzzle=null;}engineValidated+=1;if(puzzle)selected.push(puzzle);}selectedByKey.set(key,selected);}
  const shortages=[];for(const [key,limit] of limits){const actual=(selectedByKey.get(key)||[]).length;if(actual<limit)shortages.push(`${key} ${actual}/${limit}`);}if(shortages.length)throw new Error(`Strict filters could not fill requested curated library. Short buckets: ${shortages.join(', ')}. Keep quality filters; increase oversampling or use a larger/newer Lichess source instead of weakening them.`);
  const result=[];for(let star=1;star<=12;star+=1)for(const type of Object.keys(core.DIFFICULTY_TABLE[star].mix)){const key=`${star}:${type}`,selected=(selectedByKey.get(key)||[]).sort((a,b)=>a.sourceId.localeCompare(b.sourceId));result.push(...selected);}
  fs.mkdirSync(path.dirname(options.output),{recursive:true});fs.writeFileSync(options.output,serializeCatalog(result));return {seen,cheapEligible,engineValidated,written:result.length,output:options.output};
}
async function main(){const options=parseArgs(process.argv.slice(2)),summary=await importLichessPuzzles(options);console.log(`Lichess CC0 importer: scanned ${summary.seen}, cheap-eligible ${summary.cheapEligible}, engine-validated ${summary.engineValidated}, wrote ${summary.written} puzzles -> ${summary.output}`);}
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={MATERIAL_THEMES,TARGET_BY_TYPE,parseCsvLine,rowFromHeader,parseArgs,hashString,typeFromThemes,expectedSolutionPlies,allocateStarTotals,allocateMix,closestEligibleStar,preclassifyLichessRow,serializeCatalog,normalizeLichessRow,importLichessPuzzles};
