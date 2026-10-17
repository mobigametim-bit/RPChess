#!/usr/bin/env node
'use strict';
// One-time generation of WebP companions for remaining scene backdrops.
// JPEG masters are immutable; only the WebP copies are shipped in future builds.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const GAME=path.join(ROOT,'game');
const REPORT=path.join(ROOT,'docs','assets','remaining-backgrounds-webp-report.json');
const MAX_WIDTH=1280,MAX_HEIGHT=720,QUALITY=55;
const EXPECTED={generated:8,regions:36,bosses:15};
function files(dir,accept) {
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
    const full=path.join(dir,ent.name);
    return ent.isDirectory()?files(full,accept):ent.isFile()&&accept(full)?[full]:[];
  });
}
function collect(){
  const generated=files(path.join(GAME,'generated_assets'),p=>/\/(scene_[^/]+|splash_poster)\.jpg$/i.test(p));
  const regions=files(path.join(GAME,'assets','regions'),p=>/\/(battle|elite|capital|map_banner|boss_arena)\.jpg$/i.test(p));
  const bosses=files(path.join(GAME,'assets','bosses'),p=>/\/arena\.jpg$/i.test(p));
  for(const [key,rows] of Object.entries({generated,regions,bosses}))
    if(rows.length!==EXPECTED[key])throw new Error(`Expected ${EXPECTED[key]} ${key} scene JPGs, got ${rows.length}`);
  return [...generated,...regions,...bosses].sort();
}
function run(program,args){
  const child=spawnSync(program,args,{encoding:'utf8',timeout:120000});
  if(child.status!==0)throw new Error(program+' failed: '+(child.stderr||child.error?.message||child.status));
  return child.stdout.trim();
}
function inspect(jpg,{verify=false}={}){
  const relative=path.relative(ROOT,jpg).split(path.sep).join('/');
  const webp=jpg.replace(/\.jpg$/i,'.webp');
  if(!verify){
    // Never stretch or enlarge; preserve source aspect ratio, no alpha required.
    run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',jpg,
      '-vf',`scale=${MAX_WIDTH}:${MAX_HEIGHT}:force_original_aspect_ratio=decrease:flags=lanczos`,
      '-frames:v','1','-c:v','libwebp','-quality',String(QUALITY),'-compression_level','6',webp]);
    const dimensions=run('ffprobe',['-v','error','-select_streams','v:0',
      '-show_entries','stream=width,height','-of','csv=p=0',webp]);
    const [width,height]=dimensions.split(',').map(Number);
    if(!width||!height||width>MAX_WIDTH||height>MAX_HEIGHT)
      throw new Error('Invalid WebP dimensions: '+relative+': '+dimensions);
  }
  if(!fs.existsSync(webp))throw new Error('WebP companion missing: '+relative);
  const buffer=fs.readFileSync(webp),before=fs.statSync(jpg).size,after=buffer.length;
  if(buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WEBP')
    throw new Error('Invalid WebP signature: '+relative);
  if(after>=before)throw new Error('WebP does not save bytes: '+relative+' '+before+' -> '+after);
  return {source:relative,webp:path.relative(ROOT,webp).split(path.sep).join('/'),before,after};
}
function main(){
  const verify=process.argv.includes('--verify'),entries=collect();
  const rows=entries.map(src=>inspect(src,{verify}));
  const before=rows.reduce((sum,r)=>sum+r.before,0),after=rows.reduce((sum,r)=>sum+r.after,0);
  const savedPercent=Number((100*(1-after/before)).toFixed(2));
  if(savedPercent<60)throw new Error('Expected >=60% total savings, got '+savedPercent+'%');
  const report={source:'RPChess scene JPEG masters',format:'WebP',widthLimit:MAX_WIDTH,
    heightLimit:MAX_HEIGHT,quality:QUALITY,count:rows.length,
    groups:EXPECTED,beforeBytes:before,webpBytes:after,savedBytes:before-after,savedPercent,
    files:rows};
  if(!verify){fs.mkdirSync(path.dirname(REPORT),{recursive:true});fs.writeFileSync(REPORT,JSON.stringify(report,null,2)+'\n');}
  console.log('Remaining scene backgrounds '+(verify?'VERIFIED':'ENCODED')+': '+JSON.stringify(
    {count:rows.length,beforeBytes:before,webpBytes:after,savedPercent}));
  return report;
}
if(require.main===module)main();
module.exports={collect,inspect,main,EXPECTED,MAX_WIDTH,MAX_HEIGHT,QUALITY};
