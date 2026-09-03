const fs=require('fs');
const path=require('path');
const {parsePng,optimizePngBuffer,formatBytes}=require('./piece-asset-runtime.cjs');

const PIN_ICE_FILES=Object.freeze(['assets/vfx/pin_ice_full.png','assets/vfx/pin_ice_partial.png']);
const PIN_ICE_RUNTIME_MAX_SIDE=384;
const PIN_ICE_RUNTIME_MAX_BYTES=768*1024;
const PIN_ICE_RUNTIME_MAX_TOTAL_BYTES=1280*1024;

function inspectPinIceAssets(root){
  const records=PIN_ICE_FILES.map(relative=>{
    const full=path.join(root,relative);
    if(!fs.existsSync(full))throw new Error(`[pin ice asset contract] missing ${relative}`);
    const buffer=fs.readFileSync(full),png=parsePng(buffer);
    return {path:relative,bytes:buffer.length,width:png.width,height:png.height,colorType:png.colorType};
  });
  return {count:records.length,totalBytes:records.reduce((sum,item)=>sum+item.bytes,0),records};
}

function projectPinIceAssets(root,maxSide=PIN_ICE_RUNTIME_MAX_SIDE){
  const source=inspectPinIceAssets(root);
  const records=source.records.map(item=>{
    const optimized=optimizePngBuffer(fs.readFileSync(path.join(root,item.path)),maxSide);
    return {...item,afterBytes:optimized.buffer.length,afterWidth:optimized.width,afterHeight:optimized.height};
  });
  const afterBytes=records.reduce((sum,item)=>sum+item.afterBytes,0);
  return {count:records.length,beforeBytes:source.totalBytes,afterBytes,savedBytes:source.totalBytes-afterBytes,savedPercent:source.totalBytes?(source.totalBytes-afterBytes)*100/source.totalBytes:0,records};
}

function optimizePinIceAssets(root,{write=true,maxSide=PIN_ICE_RUNTIME_MAX_SIDE,maxBytes=PIN_ICE_RUNTIME_MAX_BYTES,maxTotalBytes=PIN_ICE_RUNTIME_MAX_TOTAL_BYTES}={}){
  const report=projectPinIceAssets(root,maxSide),failures=[];
  for(const item of report.records){
    if(item.afterBytes>maxBytes)failures.push(`${item.path}: optimized ${formatBytes(item.afterBytes)} exceeds ${formatBytes(maxBytes)}`);
    if(write){
      const optimized=optimizePngBuffer(fs.readFileSync(path.join(root,item.path)),maxSide);
      fs.writeFileSync(path.join(root,item.path),optimized.buffer);
    }
  }
  if(report.afterBytes>maxTotalBytes)failures.push(`aggregate ${formatBytes(report.afterBytes)} exceeds ${formatBytes(maxTotalBytes)}`);
  if(failures.length)throw new Error(`[pin ice asset budget]\n${failures.join('\n')}`);
  return report;
}

function assertPinIceAssetBudget(root,{maxSide=PIN_ICE_RUNTIME_MAX_SIDE,maxBytes=PIN_ICE_RUNTIME_MAX_BYTES,maxTotalBytes=PIN_ICE_RUNTIME_MAX_TOTAL_BYTES}={}){
  const report=inspectPinIceAssets(root),failures=[];
  if(report.count!==PIN_ICE_FILES.length)failures.push(`expected ${PIN_ICE_FILES.length}, found ${report.count}`);
  for(const item of report.records){
    if(Math.max(item.width,item.height)>maxSide)failures.push(`${item.path}: ${item.width}x${item.height} exceeds ${maxSide}px max side`);
    if(item.bytes>maxBytes)failures.push(`${item.path}: ${formatBytes(item.bytes)} exceeds ${formatBytes(maxBytes)}`);
    if(item.colorType!==6&&item.colorType!==4&&item.colorType!==3)failures.push(`${item.path}: expected transparent-capable PNG, colorType=${item.colorType}`);
  }
  if(report.totalBytes>maxTotalBytes)failures.push(`aggregate ${formatBytes(report.totalBytes)} exceeds ${formatBytes(maxTotalBytes)}`);
  if(failures.length)throw new Error(`[pin ice asset budget]\n${failures.join('\n')}`);
  return report;
}

if(require.main===module){
  const args=process.argv.slice(2),rootIndex=args.indexOf('--root'),sideIndex=args.indexOf('--max-side');
  const root=path.resolve(rootIndex>=0&&args[rootIndex+1]?args[rootIndex+1]:'game');
  const maxSide=sideIndex>=0&&args[sideIndex+1]?Number(args[sideIndex+1]):PIN_ICE_RUNTIME_MAX_SIDE;
  if(args.includes('--verify-only')){
    const report=assertPinIceAssetBudget(root,{maxSide});
    console.log(`Pin ice asset budget PASS: ${report.count} files, ${formatBytes(report.totalBytes)}`);
  }else{
    const report=projectPinIceAssets(root,maxSide);
    console.log(`Pin ice assets: ${report.count}`);
    console.log(`Source: ${formatBytes(report.beforeBytes)}`);
    console.log(`Projected @ ${maxSide}px: ${formatBytes(report.afterBytes)}`);
    console.log(`Saved: ${formatBytes(report.savedBytes)} (${report.savedPercent.toFixed(1)}%)`);
    for(const item of report.records)console.log(`${item.path}: ${item.width}x${item.height} ${formatBytes(item.bytes)} -> ${item.afterWidth}x${item.afterHeight} ${formatBytes(item.afterBytes)}`);
    if(args.includes('--write'))optimizePinIceAssets(root,{write:true,maxSide});
  }
}

module.exports={PIN_ICE_FILES,PIN_ICE_RUNTIME_MAX_SIDE,PIN_ICE_RUNTIME_MAX_BYTES,PIN_ICE_RUNTIME_MAX_TOTAL_BYTES,inspectPinIceAssets,projectPinIceAssets,optimizePinIceAssets,assertPinIceAssetBudget,formatBytes};
