const fs=require('fs');
const path=require('path');
const {
  cachedTransform,
  fingerprintFiles,
  summarizeCacheRecords,
  pruneRuntimeAssetCache
}=require('./runtime-asset-cache.cjs');
const piece=require('./piece-asset-runtime.cjs');
const portrait=require('./portrait-asset-runtime.cjs');
const board=require('./board-asset-runtime.cjs');
const background=require('./background-asset-runtime.cjs');
const pinIce=require('./pin-ice-asset-runtime.cjs');
const aura=require('./aura-asset-runtime.cjs');

const PIECE_FILE=require.resolve('./piece-asset-runtime.cjs');
const PORTRAIT_FILE=require.resolve('./portrait-asset-runtime.cjs');
const BOARD_FILE=require.resolve('./board-asset-runtime.cjs');
const BACKGROUND_FILE=require.resolve('./background-asset-runtime.cjs');
const PIN_ICE_FILE=require.resolve('./pin-ice-asset-runtime.cjs');
const AURA_FILE=require.resolve('./aura-asset-runtime.cjs');
const ORCHESTRATOR_FILE=__filename;
const BOARD_MAX_SIDE=384,BOARD_MAX_BYTES=512*1024,BOARD_MAX_TOTAL_BYTES=10*1024*1024;

function report(records){
  const beforeBytes=records.reduce((sum,item)=>sum+item.before,0),afterBytes=records.reduce((sum,item)=>sum+item.after,0),savedBytes=beforeBytes-afterBytes;
  return {count:records.length,beforeBytes,afterBytes,savedBytes,savedPercent:beforeBytes?savedBytes*100/beforeBytes:0,cache:summarizeCacheRecords(records),records};
}
function cachedPng(source,{namespace,version,maxSide,maxBytes,validateExtra=null}){
  return cachedTransform(source,{
    namespace,version,options:{maxSide,maxBytes},extension:'png',
    transform:(buffer)=>piece.optimizePngBuffer(buffer,maxSide).buffer,
    validate:(buffer)=>{
      const png=piece.parsePng(buffer);
      if(Math.max(png.width,png.height)>maxSide)throw new Error(`cached PNG exceeds ${maxSide}px`);
      if(buffer.length>maxBytes)throw new Error(`cached PNG exceeds ${maxBytes} bytes`);
      validateExtra?.(png,buffer);
    }
  });
}
function materializePieces(root){
  const version=fingerprintFiles([ORCHESTRATOR_FILE,PIECE_FILE]),records=[];
  for(const relative of piece.collectPieceAssetPaths(root)){
    const full=path.join(root,relative),source=fs.readFileSync(full),meta=piece.parsePng(source),before=source.length;
    if(meta.width<=piece.PIECE_RUNTIME_MAX_SIDE&&meta.height<=piece.PIECE_RUNTIME_MAX_SIDE&&before<=piece.PIECE_RUNTIME_MAX_BYTES){
      records.push({path:relative,before,after:before,width:meta.width,height:meta.height,sourceWidth:meta.width,sourceHeight:meta.height,skipped:true,cacheHit:null});continue;
    }
    const cached=cachedPng(source,{namespace:'pieces',version,maxSide:piece.PIECE_RUNTIME_MAX_SIDE,maxBytes:piece.PIECE_RUNTIME_MAX_BYTES});
    const out=piece.parsePng(cached.buffer);fs.writeFileSync(full,cached.buffer);
    records.push({path:relative,before,after:cached.buffer.length,width:out.width,height:out.height,sourceWidth:meta.width,sourceHeight:meta.height,skipped:false,cacheHit:cached.cacheHit,cacheKey:cached.cacheKey,cachePath:cached.cachePath});
  }
  return report(records);
}
function materializePortraits(root){
  const version=fingerprintFiles([ORCHESTRATOR_FILE,PIECE_FILE,PORTRAIT_FILE]),paths=portrait.collectPortraitAssetPaths(root),records=[];
  if(paths.length!==portrait.PORTRAIT_RUNTIME_EXPECTED_COUNT)throw new Error(`[portrait asset budget] expected ${portrait.PORTRAIT_RUNTIME_EXPECTED_COUNT} runtime portraits, found ${paths.length}`);
  for(const relative of paths){
    const full=path.join(root,relative),source=fs.readFileSync(full),meta=piece.parsePng(source),before=source.length;
    if(meta.width<=portrait.PORTRAIT_RUNTIME_MAX_SIDE&&meta.height<=portrait.PORTRAIT_RUNTIME_MAX_SIDE&&before<=portrait.PORTRAIT_RUNTIME_MAX_BYTES){
      records.push({path:relative,before,after:before,width:meta.width,height:meta.height,sourceWidth:meta.width,sourceHeight:meta.height,skipped:true,cacheHit:null});continue;
    }
    const cached=cachedPng(source,{namespace:'portraits',version,maxSide:portrait.PORTRAIT_RUNTIME_MAX_SIDE,maxBytes:portrait.PORTRAIT_RUNTIME_MAX_BYTES});
    const out=piece.parsePng(cached.buffer);fs.writeFileSync(full,cached.buffer);
    records.push({path:relative,before,after:cached.buffer.length,width:out.width,height:out.height,sourceWidth:meta.width,sourceHeight:meta.height,skipped:false,cacheHit:cached.cacheHit,cacheKey:cached.cacheKey,cachePath:cached.cachePath});
  }
  const result=report(records);
  if(result.afterBytes>portrait.PORTRAIT_RUNTIME_MAX_TOTAL_BYTES)throw new Error(`[portrait asset budget] optimized aggregate ${result.afterBytes} bytes exceeds ${portrait.PORTRAIT_RUNTIME_MAX_TOTAL_BYTES} bytes`);
  return result;
}
function materializeBoards(root){
  const version=fingerprintFiles([ORCHESTRATOR_FILE,PIECE_FILE,BOARD_FILE]),records=[];
  for(const relative of board.collectBoardAssetPaths(root)){
    const full=path.join(root,relative),source=fs.readFileSync(full),meta=piece.parsePng(source),before=source.length;
    if(meta.width!==meta.height)throw new Error(`[board asset budget] ${relative}: source must be square, got ${meta.width}x${meta.height}`);
    const cached=cachedPng(source,{namespace:'boards',version,maxSide:BOARD_MAX_SIDE,maxBytes:BOARD_MAX_BYTES,validateExtra:(png)=>{if(png.width!==png.height)throw new Error('cached board tile is not square');}});
    const out=piece.parsePng(cached.buffer);fs.writeFileSync(full,cached.buffer);
    records.push({path:relative,before,after:cached.buffer.length,width:out.width,height:out.height,sourceWidth:meta.width,sourceHeight:meta.height,skipped:false,cacheHit:cached.cacheHit,cacheKey:cached.cacheKey,cachePath:cached.cachePath});
  }
  const result=report(records);if(result.afterBytes>BOARD_MAX_TOTAL_BYTES)throw new Error(`[board asset budget] aggregate ${piece.formatBytes(result.afterBytes)} exceeds ${piece.formatBytes(BOARD_MAX_TOTAL_BYTES)}`);return result;
}
function materializePinIce(root){
  const version=fingerprintFiles([ORCHESTRATOR_FILE,PIECE_FILE,PIN_ICE_FILE]),records=[];
  for(const item of pinIce.inspectPinIceAssets(root).records){
    const full=path.join(root,item.path),source=fs.readFileSync(full),before=source.length;
    const cached=cachedPng(source,{namespace:'pin-ice',version,maxSide:pinIce.PIN_ICE_RUNTIME_MAX_SIDE,maxBytes:pinIce.PIN_ICE_RUNTIME_MAX_BYTES,validateExtra:(png)=>{if(![3,4,6].includes(png.colorType))throw new Error(`cached pin ice lost transparency capability: colorType=${png.colorType}`);}});
    const out=piece.parsePng(cached.buffer);fs.writeFileSync(full,cached.buffer);
    records.push({path:item.path,before,after:cached.buffer.length,width:out.width,height:out.height,sourceWidth:item.width,sourceHeight:item.height,skipped:false,cacheHit:cached.cacheHit,cacheKey:cached.cacheKey,cachePath:cached.cachePath});
  }
  const result=report(records);if(result.afterBytes>pinIce.PIN_ICE_RUNTIME_MAX_TOTAL_BYTES)throw new Error(`[pin ice asset budget] aggregate ${piece.formatBytes(result.afterBytes)} exceeds ${piece.formatBytes(pinIce.PIN_ICE_RUNTIME_MAX_TOTAL_BYTES)}`);return result;
}
function materializeAuras(root){
  const version=fingerprintFiles([ORCHESTRATOR_FILE,PIECE_FILE,AURA_FILE]),records=[];
  for(const item of aura.inspectAuraAssets(root).records){
    if(item.width!==item.height)throw new Error(`[aura asset contract] ${item.path}: source must be square, got ${item.width}x${item.height}`);
    const full=path.join(root,item.path),source=fs.readFileSync(full),before=source.length;
    const cached=cachedPng(source,{namespace:'auras',version,maxSide:aura.AURA_RUNTIME_MAX_SIDE,maxBytes:aura.AURA_RUNTIME_MAX_BYTES,validateExtra:(png)=>{if(png.width!==png.height)throw new Error('cached aura is not square');if(![3,4,6].includes(png.colorType))throw new Error(`cached aura lost transparency capability: colorType=${png.colorType}`);}});
    const out=piece.parsePng(cached.buffer);fs.writeFileSync(full,cached.buffer);
    records.push({path:item.path,before,after:cached.buffer.length,width:out.width,height:out.height,sourceWidth:item.width,sourceHeight:item.height,skipped:false,cacheHit:cached.cacheHit,cacheKey:cached.cacheKey,cachePath:cached.cachePath});
  }
  const result=report(records);if(result.afterBytes>aura.AURA_RUNTIME_MAX_TOTAL_BYTES)throw new Error(`[aura asset budget] aggregate ${piece.formatBytes(result.afterBytes)} exceeds ${piece.formatBytes(aura.AURA_RUNTIME_MAX_TOTAL_BYTES)}`);return result;
}
function materializeBackgrounds(root){
  const version=fingerprintFiles([ORCHESTRATOR_FILE,PIECE_FILE,BACKGROUND_FILE]),records=[];
  for(const relative of background.collectBackgroundAssetPaths(root)){
    const full=path.join(root,relative),source=fs.readFileSync(full),meta=piece.parsePng(source),before=source.length;
    const cached=cachedTransform(source,{
      namespace:'backgrounds',version,options:{width:background.BACKGROUND_RUNTIME_WIDTH,height:background.BACKGROUND_RUNTIME_HEIGHT,channelBits:background.BACKGROUND_RUNTIME_CHANNEL_BITS,maxBytes:background.BACKGROUND_RUNTIME_MAX_BYTES},extension:'png',
      transform:(buffer)=>background.optimizeBackgroundBuffer(buffer,background.BACKGROUND_RUNTIME_CHANNEL_BITS).buffer,
      validate:(buffer)=>{const png=piece.parsePng(buffer);if(png.width!==background.BACKGROUND_RUNTIME_WIDTH||png.height!==background.BACKGROUND_RUNTIME_HEIGHT)throw new Error('cached background dimensions mismatch');if(png.colorType!==2)throw new Error(`cached background colorType=${png.colorType}, expected 2`);if(buffer.length>background.BACKGROUND_RUNTIME_MAX_BYTES)throw new Error('cached background exceeds byte budget');}
    });
    const out=piece.parsePng(cached.buffer);fs.writeFileSync(full,cached.buffer);
    records.push({path:relative,before,after:cached.buffer.length,width:out.width,height:out.height,sourceWidth:meta.width,sourceHeight:meta.height,skipped:false,cacheHit:cached.cacheHit,cacheKey:cached.cacheKey,cachePath:cached.cachePath});
  }
  const result=report(records);if(result.afterBytes>background.BACKGROUND_RUNTIME_MAX_TOTAL_BYTES)throw new Error(`[background asset budget] aggregate ${piece.formatBytes(result.afterBytes)} exceeds ${piece.formatBytes(background.BACKGROUND_RUNTIME_MAX_TOTAL_BYTES)}`);return result;
}
function materializeRuntimeAssets(root){
  const groups={
    boards:materializeBoards(root),
    pinIce:materializePinIce(root),
    auras:materializeAuras(root),
    pieces:materializePieces(root),
    portraits:materializePortraits(root),
    backgrounds:materializeBackgrounds(root)
  };
  const activePaths=Object.values(groups).flatMap(group=>group.records.map(record=>record.cachePath).filter(Boolean));
  groups.cachePrune=pruneRuntimeAssetCache(activePaths);
  return groups;
}
function cacheText(group){return group.cache.total?`${group.cache.hits} hit / ${group.cache.misses} miss`:'no transforms';}

module.exports={BOARD_MAX_SIDE,BOARD_MAX_BYTES,BOARD_MAX_TOTAL_BYTES,materializePieces,materializePortraits,materializeBoards,materializePinIce,materializeAuras,materializeBackgrounds,materializeRuntimeAssets,cacheText};
