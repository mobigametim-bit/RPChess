#!/usr/bin/env node
'use strict';
// One-time offline conversion; keep lossless original PNGs in the repository.
// The normal game build uses these checked-in WebP companions, not FFmpeg.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const bg=require('./background-asset-runtime.cjs');
const root=path.resolve(__dirname,'..','game');
const files=bg.collectBackgroundAssetPaths(root);
let originalBytes=0,encodedBytes=0;
for(const relative of files){
  const from=path.join(root,relative),to=from.replace(/\.png$/,'.webp');
  if(!fs.existsSync(from))throw new Error('Missing Event PNG master: '+relative);
  const before=fs.statSync(from).size;
  const args=['-hide_banner','-loglevel','error','-y','-i',from,
    '-vf',`scale=${bg.BACKGROUND_RUNTIME_WIDTH}:${bg.BACKGROUND_RUNTIME_HEIGHT}:flags=lanczos`,
    '-frames:v','1','-c:v','libwebp','-quality',String(bg.BACKGROUND_RUNTIME_WEBP_QUALITY),
    '-compression_level','6',to];
  const p=spawnSync('ffmpeg',args,{encoding:'utf8',timeout:120000});
  if(p.status!==0)throw new Error('FFmpeg failed for '+relative+': '+(p.stderr||p.error?.message));
  const out=fs.readFileSync(to);
  if(out.toString('ascii',0,4)!=='RIFF'||out.toString('ascii',8,12)!=='WEBP')throw new Error('WebP magic mismatch '+to);
  if(out.length>bg.BACKGROUND_RUNTIME_MAX_BYTES)throw new Error('WebP budget exceeded '+relative+': '+out.length);
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height',
    '-of','csv=p=0',to],{encoding:'utf8',timeout:15000});
  if(probe.status!==0||probe.stdout.trim()!==bg.BACKGROUND_RUNTIME_WIDTH+','+bg.BACKGROUND_RUNTIME_HEIGHT)
    throw new Error('Invalid Event WebP dimensions: '+relative+' '+probe.stdout);
  originalBytes+=before;encodedBytes+=out.length;
  console.log(relative+' '+before+' -> '+out.length);
}
if(files.length!==37)throw new Error('Expected precisely 37 Event/Caravan backgrounds');
if(encodedBytes>bg.BACKGROUND_RUNTIME_MAX_TOTAL_BYTES)throw new Error('Total Event WebP budget exceeded '+encodedBytes);
console.log(JSON.stringify({count:files.length,originalBytes,encodedBytes,savedBytes:originalBytes-encodedBytes,
  savingsPercent:Number((100*(1-encodedBytes/originalBytes)).toFixed(2)),
  target: `${bg.BACKGROUND_RUNTIME_WIDTH}x${bg.BACKGROUND_RUNTIME_HEIGHT}`,
  webpQuality:bg.BACKGROUND_RUNTIME_WEBP_QUALITY},null,2));
