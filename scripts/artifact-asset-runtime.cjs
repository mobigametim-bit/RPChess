const fs=require('fs');
const path=require('path');
const {parsePng,optimizePngBuffer,formatBytes}=require('./piece-asset-runtime.cjs');

const ARTIFACT_FILES=Object.freeze([
  'assets/artifacts/threat_sense/amulet_defense.png',
  'assets/artifacts/threat_sense/amulet_attack.png',
  'assets/artifacts/threat_sense/amulet_great.png',
  'assets/artifacts/threat_sense/threat_fire_1_yellow.png',
  'assets/artifacts/threat_sense/threat_fire_2_orange.png',
  'assets/artifacts/threat_sense/threat_fire_3_plus_red.png'
]);
const ARTIFACT_RUNTIME_MAX_SIDE=256;
const ARTIFACT_RUNTIME_MAX_BYTES=256*1024;
const ARTIFACT_RUNTIME_MAX_TOTAL_BYTES=1536*1024;

function inspectArtifactAssets(root){
  const records=ARTIFACT_FILES.map(relative=>{
    const full=path.join(root,relative);
    if(!fs.existsSync(full))throw new Error(`[artifact asset contract] missing ${relative}`);
    const buffer=fs.readFileSync(full),png=parsePng(buffer);
    return {path:relative,bytes:buffer.length,width:png.width,height:png.height,colorType:png.colorType};
  });
  return {count:records.length,totalBytes:records.reduce((sum,item)=>sum+item.bytes,0),records};
}

function projectArtifactAssets(root,maxSide=ARTIFACT_RUNTIME_MAX_SIDE){
  const source=inspectArtifactAssets(root);
  const records=source.records.map(item=>{
    if(item.width!==item.height)throw new Error(`[artifact asset contract] ${item.path}: source must be square, got ${item.width}x${item.height}`);
    const optimized=optimizePngBuffer(fs.readFileSync(path.join(root,item.path)),maxSide);
    return {...item,afterBytes:optimized.buffer.length,afterWidth:optimized.width,afterHeight:optimized.height};
  });
  const afterBytes=records.reduce((sum,item)=>sum+item.afterBytes,0);
  return {count:records.length,beforeBytes:source.totalBytes,afterBytes,savedBytes:source.totalBytes-afterBytes,savedPercent:source.totalBytes?(source.totalBytes-afterBytes)*100/source.totalBytes:0,records};
}

function optimizeArtifactAssets(root,{write=true,maxSide=ARTIFACT_RUNTIME_MAX_SIDE,maxBytes=ARTIFACT_RUNTIME_MAX_BYTES,maxTotalBytes=ARTIFACT_RUNTIME_MAX_TOTAL_BYTES}={}){
  const report=projectArtifactAssets(root,maxSide),failures=[];
  for(const item of report.records){
    if(item.afterBytes>maxBytes)failures.push(`${item.path}: optimized ${formatBytes(item.afterBytes)} exceeds ${formatBytes(maxBytes)}`);
    if(write){
      const optimized=optimizePngBuffer(fs.readFileSync(path.join(root,item.path)),maxSide);
      fs.writeFileSync(path.join(root,item.path),optimized.buffer);
    }
  }
  if(report.afterBytes>maxTotalBytes)failures.push(`aggregate ${formatBytes(report.afterBytes)} exceeds ${formatBytes(maxTotalBytes)}`);
  if(failures.length)throw new Error(`[artifact asset budget]\n${failures.join('\n')}`);
  return report;
}

function assertArtifactAssetBudget(root,{maxSide=ARTIFACT_RUNTIME_MAX_SIDE,maxBytes=ARTIFACT_RUNTIME_MAX_BYTES,maxTotalBytes=ARTIFACT_RUNTIME_MAX_TOTAL_BYTES}={}){
  const report=inspectArtifactAssets(root),failures=[];
  if(report.count!==ARTIFACT_FILES.length)failures.push(`expected ${ARTIFACT_FILES.length}, found ${report.count}`);
  for(const item of report.records){
    if(item.width!==item.height)failures.push(`${item.path}: expected square PNG, got ${item.width}x${item.height}`);
    if(Math.max(item.width,item.height)>maxSide)failures.push(`${item.path}: ${item.width}x${item.height} exceeds ${maxSide}px max side`);
    if(item.bytes>maxBytes)failures.push(`${item.path}: ${formatBytes(item.bytes)} exceeds ${formatBytes(maxBytes)}`);
    if(![3,4,6].includes(item.colorType))failures.push(`${item.path}: expected transparent-capable PNG, colorType=${item.colorType}`);
  }
  if(report.totalBytes>maxTotalBytes)failures.push(`aggregate ${formatBytes(report.totalBytes)} exceeds ${formatBytes(maxTotalBytes)}`);
  if(failures.length)throw new Error(`[artifact asset budget]\n${failures.join('\n')}`);
  return report;
}

if(require.main===module){
  const args=process.argv.slice(2),rootIndex=args.indexOf('--root'),sideIndex=args.indexOf('--max-side');
  const root=path.resolve(rootIndex>=0&&args[rootIndex+1]?args[rootIndex+1]:'game');
  const maxSide=sideIndex>=0&&args[sideIndex+1]?Number(args[sideIndex+1]):ARTIFACT_RUNTIME_MAX_SIDE;
  if(args.includes('--verify-only')){
    const report=assertArtifactAssetBudget(root,{maxSide});
    console.log(`Artifact asset budget PASS: ${report.count} files, ${formatBytes(report.totalBytes)}`);
  }else{
    const report=projectArtifactAssets(root,maxSide);
    console.log(`Artifact assets: ${report.count}`);
    console.log(`Source: ${formatBytes(report.beforeBytes)}`);
    console.log(`Projected @ ${maxSide}px: ${formatBytes(report.afterBytes)}`);
    console.log(`Saved: ${formatBytes(report.savedBytes)} (${report.savedPercent.toFixed(1)}%)`);
    for(const item of report.records)console.log(`${item.path}: ${item.width}x${item.height} ${formatBytes(item.bytes)} -> ${item.afterWidth}x${item.afterHeight} ${formatBytes(item.afterBytes)}`);
    if(args.includes('--write'))optimizeArtifactAssets(root,{write:true,maxSide});
  }
}

module.exports={ARTIFACT_FILES,ARTIFACT_RUNTIME_MAX_SIDE,ARTIFACT_RUNTIME_MAX_BYTES,ARTIFACT_RUNTIME_MAX_TOTAL_BYTES,inspectArtifactAssets,projectArtifactAssets,optimizeArtifactAssets,assertArtifactAssetBudget,formatBytes};
