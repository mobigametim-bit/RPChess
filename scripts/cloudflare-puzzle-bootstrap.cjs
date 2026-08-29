'use strict';
const fs=require('fs');
const path=require('path');
const {spawn,spawnSync}=require('child_process');
const {once}=require('events');

const report=[];
function note(value){report.push(String(value));console.log(value);}
function finishReport(){
  const target=path.resolve('game/generated_assets/puzzle-bootstrap-report.txt');
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,`${report.join('\n')}\n`);
}
function capture(command,args){
  const result=spawnSync(command,args,{encoding:'utf8'});
  report.push(`$ ${command} ${args.join(' ')}`);
  report.push(`status=${result.status}`);
  if(result.stdout)report.push(`stdout=${result.stdout.trim().slice(-12000)}`);
  if(result.stderr)report.push(`stderr=${result.stderr.trim().slice(-12000)}`);
  if(result.error)report.push(`error=${result.error.stack||result.error}`);
  return result;
}

async function main(){
  try{
    const install=capture('npm',['install','--no-save','--package-lock=false','--ignore-scripts','fzstd@0.1.1']);
    if(install.status!==0){note('bootstrap_result=transient_fzstd_install_failed');return;}
    const fzstd=require('fzstd');
    const importer=spawn(process.execPath,[
      'scripts/import-lichess-puzzles.cjs','--stdin',
      '--output','game/js/puzzles/puzzle-catalog.mjs',
      '--count','2000','--seed','rpchess-puzzles-v1'
    ],{stdio:['pipe','pipe','pipe']});
    let importerOut='',importerErr='';
    importer.stdout.on('data',chunk=>{importerOut=(importerOut+chunk).slice(-20000);});
    importer.stderr.on('data',chunk=>{importerErr=(importerErr+chunk).slice(-20000);});

    let needsDrain=false;
    const decoder=new fzstd.Decompress((chunk)=>{
      if(!chunk?.length)return;
      if(!importer.stdin.write(Buffer.from(chunk)))needsDrain=true;
    });

    const maxCompressedBytes=128*1024*1024;
    const response=await fetch('https://database.lichess.org/lichess_db_puzzle.csv.zst',{
      headers:{Range:`bytes=0-${maxCompressedBytes-1}`}
    });
    note(`fetch_status=${response.status}`);
    note(`content_range=${response.headers.get('content-range')||''}`);
    note(`content_length=${response.headers.get('content-length')||''}`);
    if(!response.ok){importer.kill();note('bootstrap_result=download_failed');return;}
    const reader=response.body.getReader();
    let compressedBytes=0,decoderError=null;
    try{
      while(compressedBytes<maxCompressedBytes){
        const {done,value}=await reader.read();
        if(done)break;
        let chunk=value;
        if(compressedBytes+chunk.length>maxCompressedBytes)chunk=chunk.subarray(0,maxCompressedBytes-compressedBytes);
        compressedBytes+=chunk.length;
        decoder.push(chunk,false);
        if(needsDrain){needsDrain=false;await once(importer.stdin,'drain');}
      }
    }catch(error){decoderError=error;}
    try{await reader.cancel();}catch{}
    note(`compressed_bytes=${compressedBytes}`);
    if(decoderError)note(`decoder_error=${decoderError.stack||decoderError}`);
    importer.stdin.end();
    const [code]=await once(importer,'close');
    note(`importer_exit=${code}`);
    if(importerOut.trim())note(`importer_stdout=${importerOut.trim()}`);
    if(importerErr.trim())note(`importer_stderr=${importerErr.trim()}`);
    if(code!==0){note('bootstrap_result=import_failed');return;}

    const validation=capture(process.execPath,['scripts/validate-puzzle-catalog.cjs']);
    if(validation.status!==0){note('bootstrap_result=validation_failed');return;}
    note('bootstrap_result=success');
  }catch(error){
    note(`bootstrap_exception=${error.stack||error}`);
  }finally{
    finishReport();
  }
}

main();
