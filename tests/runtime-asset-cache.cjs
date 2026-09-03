const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {
  fingerprintFiles,
  cachedTransform,
  pruneRuntimeAssetCache,
  inspectRuntimeAssetCache,
  clearRuntimeAssetCache
}=require('../scripts/runtime-asset-cache.cjs');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rpchess-asset-cache-'));
const fingerprintA=fs.mkdtempSync(path.join(os.tmpdir(),'rpchess-fingerprint-a-'));
const fingerprintB=fs.mkdtempSync(path.join(os.tmpdir(),'rpchess-fingerprint-b-'));
process.env.RPCHESS_ASSET_CACHE_DIR=temp;
try{
  for(const root of [fingerprintA,fingerprintB]){
    fs.writeFileSync(path.join(root,'optimizer-a.cjs'),'module.exports="same-a";\n');
    fs.writeFileSync(path.join(root,'optimizer-b.cjs'),'module.exports="same-b";\n');
  }
  const fpA=fingerprintFiles([path.join(fingerprintA,'optimizer-a.cjs'),path.join(fingerprintA,'optimizer-b.cjs')]);
  const fpB=fingerprintFiles([path.join(fingerprintB,'optimizer-a.cjs'),path.join(fingerprintB,'optimizer-b.cjs')]);
  assert.strictEqual(fpA,fpB,'optimizer fingerprint must not depend on absolute workspace path');

  let calls=0;
  const transform=(source)=>{calls++;return Buffer.from(`optimized:${source.toString('utf8')}`);};
  const validate=(buffer)=>{if(!buffer.toString('utf8').startsWith('optimized:'))throw new Error('invalid cache payload');};
  const options={maxSide:384,codec:'png'};
  const sourceA=Buffer.from('source-a');
  const first=cachedTransform(sourceA,{namespace:'unit',version:'1',options,extension:'png',transform,validate});
  assert.strictEqual(first.cacheHit,false);
  assert.strictEqual(calls,1);
  const second=cachedTransform(sourceA,{namespace:'unit',version:'1',options,extension:'png',transform,validate});
  assert.strictEqual(second.cacheHit,true);
  assert.strictEqual(second.buffer.toString(),first.buffer.toString());
  assert.strictEqual(calls,1,'unchanged source/config must reuse cached output');

  const configMiss=cachedTransform(sourceA,{namespace:'unit',version:'1',options:{...options,maxSide:256},extension:'png',transform,validate});
  assert.strictEqual(configMiss.cacheHit,false);
  assert.strictEqual(calls,2,'changed optimizer options must invalidate cache');

  const sourceMiss=cachedTransform(Buffer.from('source-b'),{namespace:'unit',version:'1',options,extension:'png',transform,validate});
  assert.strictEqual(sourceMiss.cacheHit,false);
  assert.strictEqual(calls,3,'changed source content must invalidate cache');

  const versionMiss=cachedTransform(sourceA,{namespace:'unit',version:'2',options,extension:'png',transform,validate});
  assert.strictEqual(versionMiss.cacheHit,false);
  assert.strictEqual(calls,4,'optimizer version change must invalidate cache');

  fs.writeFileSync(first.cachePath,Buffer.from('corrupt'));
  const repaired=cachedTransform(sourceA,{namespace:'unit',version:'1',options,extension:'png',transform,validate});
  assert.strictEqual(repaired.cacheHit,false);
  assert.strictEqual(calls,5,'corrupt cache entry must be rebuilt');
  assert.strictEqual(repaired.buffer.toString(),'optimized:source-a');

  process.env.RPCHESS_ASSET_CACHE_DISABLE='1';
  const disabled=cachedTransform(sourceA,{namespace:'unit',version:'1',options,extension:'png',transform,validate});
  assert.strictEqual(disabled.cacheHit,false);
  assert.strictEqual(calls,6,'disabled cache must always transform');
  delete process.env.RPCHESS_ASSET_CACHE_DISABLE;

  const beforePrune=inspectRuntimeAssetCache();
  assert.strictEqual(beforePrune.root,temp);
  assert(beforePrune.files>=4,'cache should contain independent entries');
  assert(beforePrune.bytes>0);
  const pruned=pruneRuntimeAssetCache([repaired.cachePath]);
  assert(pruned.removedFiles>=3,'prune must remove stale cache entries');
  assert.strictEqual(pruned.keptFiles,1,'prune must keep the active cache entry');
  assert.strictEqual(inspectRuntimeAssetCache().files,1,'only active cache entries should remain after prune');

  clearRuntimeAssetCache();
  assert.strictEqual(inspectRuntimeAssetCache().files,0);
  console.log('Runtime asset cache: PASS — workspace-independent fingerprint, content/config/version invalidation, corrupt repair and stale-entry prune');
}finally{
  delete process.env.RPCHESS_ASSET_CACHE_DIR;
  delete process.env.RPCHESS_ASSET_CACHE_DISABLE;
  fs.rmSync(temp,{recursive:true,force:true});
  fs.rmSync(fingerprintA,{recursive:true,force:true});
  fs.rmSync(fingerprintB,{recursive:true,force:true});
}
