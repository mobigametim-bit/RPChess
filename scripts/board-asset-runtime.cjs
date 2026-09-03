const fs=require('fs');
const path=require('path');
const {parsePng,optimizePngBuffer,formatBytes}=require('./piece-asset-runtime.cjs');

const BOARD_RACES=Object.freeze(['humans','elves','orcs','undead','dark_elves','dwarves','demons','angels','dragonborn','beastfolk','constructs','animals','fae','goblins']);
const BOARD_FILES=Object.freeze(['white.png','black.png']);
const BOARD_EXPECTED_COUNT=BOARD_RACES.length*BOARD_FILES.length;

function collectBoardAssetPaths(root){
  const paths=[];
  for(const race of BOARD_RACES)for(const file of BOARD_FILES){
    const relative=`assets/races/${race}/board/${file}`;
    if(!fs.existsSync(path.join(root,relative)))throw new Error(`[board asset contract] missing ${relative}`);
    paths.push(relative);
  }
  return paths.sort();
}

function inspectBoardAssets(root){
  const records=collectBoardAssetPaths(root).map(relative=>{
    const buffer=fs.readFileSync(path.join(root,relative));
    const png=parsePng(buffer);
    return {path:relative,bytes:buffer.length,width:png.width,height:png.height,colorType:png.colorType};
  });
  const totalBytes=records.reduce((sum,item)=>sum+item.bytes,0);
  return {count:records.length,totalBytes,records};
}

function projectBoardAssets(root,maxSide){
  const source=inspectBoardAssets(root);
  const records=source.records.map(item=>{
    const buffer=fs.readFileSync(path.join(root,item.path));
    const optimized=optimizePngBuffer(buffer,maxSide);
    return {...item,afterBytes:optimized.buffer.length,afterWidth:optimized.width,afterHeight:optimized.height};
  });
  const afterBytes=records.reduce((sum,item)=>sum+item.afterBytes,0);
  return {count:records.length,beforeBytes:source.totalBytes,afterBytes,savedBytes:source.totalBytes-afterBytes,savedPercent:source.totalBytes?(source.totalBytes-afterBytes)*100/source.totalBytes:0,records};
}

function optimizeBoardAssets(root,{write=true,maxSide=384,maxBytes=512*1024,maxTotalBytes=10*1024*1024}={}){
  const report=projectBoardAssets(root,maxSide);
  const failures=[];
  for(const item of report.records){
    if(item.width!==item.height)failures.push(`${item.path}: source must be square, got ${item.width}x${item.height}`);
    if(item.afterBytes>maxBytes)failures.push(`${item.path}: optimized ${formatBytes(item.afterBytes)} exceeds ${formatBytes(maxBytes)}`);
    if(write){
      const source=fs.readFileSync(path.join(root,item.path));
      const optimized=optimizePngBuffer(source,maxSide);
      fs.writeFileSync(path.join(root,item.path),optimized.buffer);
    }
  }
  if(report.afterBytes>maxTotalBytes)failures.push(`aggregate ${formatBytes(report.afterBytes)} exceeds ${formatBytes(maxTotalBytes)}`);
  if(failures.length)throw new Error(`[board asset budget]\n${failures.join('\n')}`);
  return report;
}

function assertBoardAssetBudget(root,{maxSide=384,maxBytes=512*1024,maxTotalBytes=10*1024*1024}={}){
  const report=inspectBoardAssets(root),failures=[];
  if(report.count!==BOARD_EXPECTED_COUNT)failures.push(`expected ${BOARD_EXPECTED_COUNT}, found ${report.count}`);
  for(const item of report.records){
    if(item.width!==item.height)failures.push(`${item.path}: ${item.width}x${item.height} is not square`);
    if(item.width>maxSide||item.height>maxSide)failures.push(`${item.path}: ${item.width}x${item.height} exceeds ${maxSide}px`);
    if(item.bytes>maxBytes)failures.push(`${item.path}: ${formatBytes(item.bytes)} exceeds ${formatBytes(maxBytes)}`);
  }
  if(report.totalBytes>maxTotalBytes)failures.push(`aggregate ${formatBytes(report.totalBytes)} exceeds ${formatBytes(maxTotalBytes)}`);
  if(failures.length)throw new Error(`[board asset budget]\n${failures.join('\n')}`);
  return report;
}

if(require.main===module){
  const args=process.argv.slice(2),rootIndex=args.indexOf('--root'),sideIndex=args.indexOf('--max-side');
  const root=path.resolve(rootIndex>=0&&args[rootIndex+1]?args[rootIndex+1]:'game');
  const maxSide=sideIndex>=0&&args[sideIndex+1]?Number(args[sideIndex+1]):384;
  const verifyOnly=args.includes('--verify-only'),write=args.includes('--write');
  if(verifyOnly){const report=assertBoardAssetBudget(root,{maxSide});console.log(`Board asset budget PASS: ${report.count} files, ${formatBytes(report.totalBytes)}`);}
  else{
    const report=projectBoardAssets(root,maxSide);
    console.log(`Board assets: ${report.count}`);
    console.log(`Source: ${formatBytes(report.beforeBytes)}`);
    console.log(`Projected @ ${maxSide}px: ${formatBytes(report.afterBytes)}`);
    console.log(`Saved: ${formatBytes(report.savedBytes)} (${report.savedPercent.toFixed(1)}%)`);
    const dims=[...new Set(report.records.map(item=>`${item.width}x${item.height}`))];
    console.log(`Source dimensions: ${dims.join(', ')}`);
    for(const item of report.records.sort((a,b)=>b.bytes-a.bytes))console.log(`${item.path}: ${item.width}x${item.height} ${formatBytes(item.bytes)} -> ${item.afterWidth}x${item.afterHeight} ${formatBytes(item.afterBytes)}`);
    if(write)optimizeBoardAssets(root,{write:true,maxSide});
  }
}

module.exports={BOARD_RACES,BOARD_FILES,BOARD_EXPECTED_COUNT,collectBoardAssetPaths,inspectBoardAssets,projectBoardAssets,optimizeBoardAssets,assertBoardAssetBudget,formatBytes};
