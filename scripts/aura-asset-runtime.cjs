const fs=require('fs');
const path=require('path');
const {parsePng,optimizePngBuffer,formatBytes}=require('./piece-asset-runtime.cjs');

const AURA_FILES=Object.freeze([
  'assets/vfx/aura_white.png',
  'assets/vfx/aura_black.png',
  'assets/vfx/aura_red.png'
]);
const AURA_RUNTIME_MAX_SIDE=384;
const AURA_RUNTIME_MAX_BYTES=768*1024;
const AURA_RUNTIME_MAX_TOTAL_BYTES=2304*1024;

function inspectAuraAssets(root){
  const records=AURA_FILES.map(relative=>{
    const full=path.join(root,relative);
    if(!fs.existsSync(full))throw new Error(`[aura asset contract] missing ${relative}`);
    const buffer=fs.readFileSync(full),png=parsePng(buffer);
    return {path:relative,bytes:buffer.length,width:png.width,height:png.height,colorType:png.colorType};
  });
  return {count:records.length,totalBytes:records.reduce((sum,item)=>sum+item.bytes,0),records};
}

function projectAuraAssets(root,maxSide=AURA_RUNTIME_MAX_SIDE){
  const source=inspectAuraAssets(root);
  const records=source.records.map(item=>{
    if(item.width!==item.height)throw new Error(`[aura asset contract] ${item.path}: source must be square, got ${item.width}x${item.height}`);
    const optimized=optimizePngBuffer(fs.readFileSync(path.join(root,item.path)),maxSide);
    return {...item,afterBytes:optimized.buffer.length,afterWidth:optimized.width,afterHeight:optimized.height};
  });
  const afterBytes=records.reduce((sum,item)=>sum+item.afterBytes,0);
  return {count:records.length,beforeBytes:source.totalBytes,afterBytes,savedBytes:source.totalBytes-afterBytes,savedPercent:source.totalBytes?(source.totalBytes-afterBytes)*100/source.totalBytes:0,records};
}

function optimizeAuraAssets(root,{write=true,maxSide=AURA_RUNTIME_MAX_SIDE,maxBytes=AURA_RUNTIME_MAX_BYTES,maxTotalBytes=AURA_RUNTIME_MAX_TOTAL_BYTES}={}){
  const report=projectAuraAssets(root,maxSide),failures=[];
  for(const item of report.records){
    if(item.afterBytes>maxBytes)failures.push(`${item.path}: optimized ${formatBytes(item.afterBytes)} exceeds ${formatBytes(maxBytes)}`);
    if(write){
      const optimized=optimizePngBuffer(fs.readFileSync(path.join(root,item.path)),maxSide);
      fs.writeFileSync(path.join(root,item.path),optimized.buffer);
    }
  }
  if(report.afterBytes>maxTotalBytes)failures.push(`aggregate ${formatBytes(report.afterBytes)} exceeds ${formatBytes(maxTotalBytes)}`);
  if(failures.length)throw new Error(`[aura asset budget]\n${failures.join('\n')}`);
  return report;
}

function assertAuraAssetBudget(root,{maxSide=AURA_RUNTIME_MAX_SIDE,maxBytes=AURA_RUNTIME_MAX_BYTES,maxTotalBytes=AURA_RUNTIME_MAX_TOTAL_BYTES}={}){
  const report=inspectAuraAssets(root),failures=[];
  if(report.count!==AURA_FILES.length)failures.push(`expected ${AURA_FILES.length}, found ${report.count}`);
  for(const item of report.records){
    if(item.width!==item.height)failures.push(`${item.path}: expected square PNG, got ${item.width}x${item.height}`);
    if(Math.max(item.width,item.height)>maxSide)failures.push(`${item.path}: ${item.width}x${item.height} exceeds ${maxSide}px max side`);
    if(item.bytes>maxBytes)failures.push(`${item.path}: ${formatBytes(item.bytes)} exceeds ${formatBytes(maxBytes)}`);
    if(![3,4,6].includes(item.colorType))failures.push(`${item.path}: expected transparent-capable PNG, colorType=${item.colorType}`);
  }
  if(report.totalBytes>maxTotalBytes)failures.push(`aggregate ${formatBytes(report.totalBytes)} exceeds ${formatBytes(maxTotalBytes)}`);
  if(failures.length)throw new Error(`[aura asset budget]\n${failures.join('\n')}`);
  return report;
}

if(require.main===module){
  const args=process.argv.slice(2),rootIndex=args.indexOf('--root'),sideIndex=args.indexOf('--max-side');
  const root=path.resolve(rootIndex>=0&&args[rootIndex+1]?args[rootIndex+1]:'game');
  const maxSide=sideIndex>=0&&args[sideIndex+1]?Number(args[sideIndex+1]):AURA_RUNTIME_MAX_SIDE;
  if(args.includes('--verify-only')){
    const report=assertAuraAssetBudget(root,{maxSide});
    console.log(`Aura asset budget PASS: ${report.count} files, ${formatBytes(report.totalBytes)}`);
  }else{
    const report=projectAuraAssets(root,maxSide);
    console.log(`Aura assets: ${report.count}`);
    console.log(`Source: ${formatBytes(report.beforeBytes)}`);
    console.log(`Projected @ ${maxSide}px: ${formatBytes(report.afterBytes)}`);
    console.log(`Saved: ${formatBytes(report.savedBytes)} (${report.savedPercent.toFixed(1)}%)`);
    for(const item of report.records)console.log(`${item.path}: ${item.width}x${item.height} ${formatBytes(item.bytes)} -> ${item.afterWidth}x${item.afterHeight} ${formatBytes(item.afterBytes)}`);
    if(args.includes('--write'))optimizeAuraAssets(root,{write:true,maxSide});
  }
}

module.exports={AURA_FILES,AURA_RUNTIME_MAX_SIDE,AURA_RUNTIME_MAX_BYTES,AURA_RUNTIME_MAX_TOTAL_BYTES,inspectAuraAssets,projectAuraAssets,optimizeAuraAssets,assertAuraAssetBudget,formatBytes};
