'use strict';
const {spawn,spawnSync}=require('child_process');
const {once}=require('events');

function run(command,args){
  const result=spawnSync(command,args,{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}

async function main(){
  run('npm',['install','--no-save','--package-lock=false','--ignore-scripts','fzstd@0.1.1']);
  const fzstd=require('fzstd');
  const importer=spawn(process.execPath,[
    'scripts/import-lichess-puzzles.cjs','--stdin',
    '--output','game/js/puzzles/puzzle-catalog.mjs',
    '--count','2000','--seed','rpchess-puzzles-v1'
  ],{stdio:['pipe','inherit','inherit']});

  let needsDrain=false;
  const decoder=new fzstd.Decompress((chunk)=>{
    if(!chunk?.length)return;
    if(!importer.stdin.write(Buffer.from(chunk)))needsDrain=true;
  });

  const maxCompressedBytes=128*1024*1024;
  const response=await fetch('https://database.lichess.org/lichess_db_puzzle.csv.zst',{
    headers:{Range:`bytes=0-${maxCompressedBytes-1}`}
  });
  if(!response.ok)throw new Error(`Lichess download failed: HTTP ${response.status}`);
  const reader=response.body.getReader();
  let compressedBytes=0;
  while(compressedBytes<maxCompressedBytes){
    const {done,value}=await reader.read();
    if(done)break;
    let chunk=value;
    if(compressedBytes+chunk.length>maxCompressedBytes)chunk=chunk.subarray(0,maxCompressedBytes-compressedBytes);
    compressedBytes+=chunk.length;
    decoder.push(chunk,false);
    if(needsDrain){needsDrain=false;await once(importer.stdin,'drain');}
  }
  try{await reader.cancel();}catch{}
  // Deliberately do not mark the truncated zstd stream as final. All complete
  // decompressed blocks/CSV lines emitted before the range boundary are valid.
  importer.stdin.end();
  const [code]=await once(importer,'close');
  if(code!==0)throw new Error(`Puzzle importer exited with ${code}`);
  console.log(`Cloudflare bootstrap consumed ${(compressedBytes/1024/1024).toFixed(1)} MiB of the official Lichess archive.`);
  run(process.execPath,['scripts/validate-puzzle-catalog.cjs']);
  console.log('Cloudflare generation bootstrap: PASS');
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
