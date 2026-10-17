#!/usr/bin/env node
'use strict';
// Stream the official Lichess database to extend the existing, immutable
// 11,498-puzzle CC0 catalog to EXACTLY 30,000. Do not load 6M CSV rows in RAM.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),readline=require('readline');
const {pathToFileURL}=require('url');
const source=require('./import-lichess-puzzles.cjs');
const {decodeRow}=require('./materialize-puzzle-catalog.cjs');
const ORIGINAL=path.resolve('game/js/puzzles/catalog-data/puzzle-catalog-11498.json.gz');
const DEST=path.resolve('game/js/puzzles');
const STAR_TARGETS=[2100,2700,3300,3600,3600,3300,3000,2700,2100,1800,1200,600];
const TYPE_TARGETS={mate1:3600,mate2:5400,mate3:3000,mate4:900,mate5Plus:300,material:7200,bestLine:9600};
const TYPE_ORDER=['mate5Plus','mate4','mate3','mate2','mate1','material','bestLine'];
const CENTERS={mate1:[2.3,1.9],mate2:[5.1,2.4],mate3:[8.4,2.2],mate4:[10.2,1.5],mate5Plus:[11.3,1.1],material:[6,4],bestLine:[6.3,4.8]};
const OVERSAMPLE={mate1:5,mate2:6,mate3:8,mate4:10,mate5Plus:15,material:28,bestLine:3};
const RARE_TAGS=new Set(['underPromotion','enPassant','zugzwang','quietMove','intermezzo','swallowstailMate','anastasiaMate','bodenMate','epauletteMate','vukovicMate','operaMate','pillsburysMate','doubleBishopMate','killBoxMate','morphysMate','arabianMate','dovetailMate','sacrifice','castling','knightEndgame','pawnEndgame','interference']);
function assert(condition,message){if(!condition)throw new Error('[30K Lichess] '+message);}
function legacy(){
  const compressed=fs.readFileSync(ORIGINAL);
  const raw=JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
  assert(raw.length===11498,'legacy count mismatch');
  return raw.map((row,i)=>decodeRow(row,i));
}
function allocate(legacyRows){
  const starLeft=STAR_TARGETS.slice();
  const typeLeft={...TYPE_TARGETS};
  for(const puzzle of legacyRows){starLeft[puzzle.difficulty-1]--;typeLeft[puzzle.type]--;}
  assert(starLeft.every(x=>x>=0),'existing puzzle stars exceed agreed limits');
  assert(Object.values(typeLeft).every(x=>x>=0),'existing goal totals exceed agreed limits');
  assert(starLeft.reduce((a,b)=>a+b,0)===18502,'expected exactly 18,502 new puzzles');
  const quotas={};
  for(const type of TYPE_ORDER)while(typeLeft[type]>0){
    const [center,sigma]=CENTERS[type];
    let winner=-1,best=-1;
    for(let i=0;i<12;i++){
      if(!starLeft[i])continue;
      const weight=Math.exp(-0.5*((i+1-center)/sigma)**2);
      const capacity=(starLeft[i]/STAR_TARGETS[i])**0.68;
      const score=weight*capacity;
      if(score>best){best=score;winner=i;}
    }
    assert(winner>=0,'cannot fit '+type);
    const key=(winner+1)+':'+type;
    quotas[key]=(quotas[key]||0)+1;
    starLeft[winner]--;typeLeft[type]--;
  }
  assert(starLeft.every(v=>v===0),'row quota mismatch');
  return quotas;
}
// Retain the smallest deterministic scores without a global in-memory sort.
function heapOffer(heap,value,cap){
  if(!cap)return;
  const up=i=>{while(i>0){const parent=(i-1)>>1;if(heap[parent].score>=heap[i].score)break;[heap[i],heap[parent]]=[heap[parent],heap[i]];i=parent;}};
  const down=()=>{let i=0;for(;;){let j=i,l=2*i+1,r=l+1;if(l<heap.length&&heap[l].score>heap[j].score)j=l;if(r<heap.length&&heap[r].score>heap[j].score)j=r;if(j===i)break;[heap[i],heap[j]]=[heap[j],heap[i]];i=j;}};
  if(heap.length<cap){heap.push(value);up(heap.length-1);return;}
  if(value.score>=heap[0].score)return;
  heap[0]=value;down();
}
function classify(row,table){
  const pre=source.preclassifyExtendedLichessRow(row,table);
  if(!pre)return null;
  // A simple material target needs a concrete captured knight/bishop/rook/
  // queen; source motif tags alone do not prove the reward objective.
  if(pre.type==='bestLine'){
    const material=source.preclassifyLichessRow(row,table);
    if(material?.type==='material')return [{...material},pre];
  }
  return [pre];
}
async function curate(input=process.stdin){
  const old=legacy(),known=new Set(old.map(p=>p.sourceId)),quotas=allocate(old);
  const {ClassicChessEngine}=await import(pathToFileURL(path.resolve('game/js/classic-chess-engine.mjs')).href);
  const core=await import(pathToFileURL(path.resolve('game/js/puzzles/puzzle-core.mjs')).href);
  const candidates=new Map(Object.entries(quotas).map(([key])=>[key,[]]));
  const rl=readline.createInterface({input,crlfDelay:Infinity});
  let header=null,seen=0,eligible=0;
  for await(const line of rl){
    if(!header){header=source.parseCsvLine(line.replace(/^\uFEFF/,''));continue;}
    if(!line.trim())continue;
    seen++;
    const row=source.rowFromHeader(header,line);
    if(known.has(row.PuzzleId))continue;
    const alternatives=classify(row,core.DIFFICULTY_TABLE);
    if(!alternatives)continue;
    for(const pre of alternatives){
      const key=pre.star+':'+pre.type,quota=quotas[key]||0;
      if(!quota)continue;
      eligible++;
      const tags=pre.themes.filter(tag=>RARE_TAGS.has(tag)).length;
      // Favor a bounded number of rare motifs without inventing annotations.
      const hash=source.hashString('rpchess-30000-v1:'+pre.sourceId+':'+key)/4294967296;
      const score=hash-Math.min(0.2,tags*0.025);
      heapOffer(candidates.get(key),{score,row,pre},Math.ceil(quota*OVERSAMPLE[pre.type]));
    }
    if(seen%1500000===0)console.error('[30K Lichess] streamed',seen,'rows');
  }
  const final=[],newIds=new Set(),misses=[];let attempted=0;
  for(const [key,quota] of Object.entries(quotas)){
    const sorted=candidates.get(key).sort((a,b)=>a.score-b.score);
    let count=0;
    for(const entry of sorted){
      if(count>=quota)break;
      if(newIds.has(entry.pre.sourceId))continue;
      let puzzle=null;try{
        puzzle=await source.normalizeLichessRow(entry.row,{ClassicChessEngine,puzzleBaseGold:core.puzzleBaseGold,
          difficultyTable:core.DIFFICULTY_TABLE,preclassified:entry.pre});
      }catch{/* discard corrupt or illegal Lichess rows */}
      attempted++;
      if(!puzzle||!core.isNormalizedPuzzle(puzzle))continue;
      final.push(puzzle);newIds.add(entry.pre.sourceId);count++;
    }
    if(count<quota)misses.push(key+' '+count+'/'+quota);
  }
  assert(!misses.length,'strict filters cannot fill: '+misses.join(', '));
  assert(final.length===18502,'new task count '+final.length+' != 18502');
  assert(new Set([...old.map(p=>p.sourceId),...newIds]).size===30000,'duplicate source puzzle');
  const all=[...old,...final];
  for(let i=1;i<=12;i++)assert(all.filter(p=>p.difficulty===i).length===STAR_TARGETS[i-1],
    '★'+i+' quota mismatch');
  for(const [type,target] of Object.entries(TYPE_TARGETS))assert(all.filter(p=>p.type===type).length===target,
    'goal '+type+' quota mismatch');
  const tags=[...new Set(all.flatMap(p=>p.themes))].sort();
  const newByStar=Array.from({length:12},()=>[]);
  for(const puzzle of final)newByStar[puzzle.difficulty-1].push(puzzle);
  for(let i=0;i<12;i++){
    const list=newByStar[i].sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
    const body=JSON.stringify(list);
    fs.writeFileSync(path.join(DEST,'extra-star-'+String(i+1).padStart(2,'0')+'.mjs'),
      '// Lichess Open Database Puzzles (CC0); deterministic verified ★'+(i+1)+' shard.\n'
      +'// Original 11,498 legacy puzzles are maintained separately.\n'
      +'const EXTRA_PUZZLES=Object.freeze('+body+');\nexport {EXTRA_PUZZLES};\n');
  }
  const info={source:'Lichess Open Database Puzzles',license:'CC0',version:'rpchess-30000-v1',
    total:all.length,legacy:old.length,additional:final.length,stars:STAR_TARGETS,
    goals:TYPE_TARGETS,tagCount:tags.length,tags,sourceRows:seen,cheapEligible:eligible,engineAttempts:attempted};
  fs.writeFileSync(path.join(DEST,'catalog-data','puzzle-expansion-report.json'),JSON.stringify(info,null,2)+'\n');
  console.log('Lichess 30K: SUCCESS',JSON.stringify({total:info.total,stars:info.stars,goals:info.goals,tags:info.tagCount,scanned:seen,engineAttempts:attempted}));
  return info;
}
if(require.main===module)curate().catch(error=>{console.error(error.stack||error);process.exitCode=1});
module.exports={STAR_TARGETS,TYPE_TARGETS,allocate,heapOffer,curate};
