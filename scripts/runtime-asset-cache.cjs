const fs=require('fs');
const path=require('path');
const os=require('os');
const crypto=require('crypto');

const CACHE_SCHEMA='rpchess-runtime-assets-v1';

function stable(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function sha256(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function fingerprintFiles(files=[]){
  const hash=crypto.createHash('sha256');
  const entries=files.map(item=>{const file=path.resolve(item);return {file,label:path.basename(file)};}).sort((a,b)=>a.label.localeCompare(b.label)||a.file.localeCompare(b.file));
  for(const entry of entries){hash.update(entry.label);hash.update('\0');hash.update(fs.readFileSync(entry.file));hash.update('\0');}
  return hash.digest('hex');
}
function cacheEnabled(){return !['1','true','yes'].includes(String(process.env.RPCHESS_ASSET_CACHE_DISABLE||'').toLowerCase());}
function runtimeAssetCacheRoot(){
  if(process.env.RPCHESS_ASSET_CACHE_DIR)return path.resolve(process.env.RPCHESS_ASSET_CACHE_DIR);
  const npmCache=process.env.npm_config_cache||process.env.NPM_CONFIG_CACHE||path.join(os.homedir(),'.npm');
  return path.join(npmCache,CACHE_SCHEMA);
}
function cacheIdentity(sourceBuffer,{namespace,version='1',options={}}={}){
  if(!Buffer.isBuffer(sourceBuffer))throw new Error('runtime asset cache source must be a Buffer');
  if(!namespace)throw new Error('runtime asset cache namespace is required');
  const sourceHash=sha256(sourceBuffer);
  const transformFingerprint=sha256(Buffer.from(stable({schema:CACHE_SCHEMA,namespace,version:String(version),options}),'utf8'));
  const key=sha256(Buffer.from(`${sourceHash}:${transformFingerprint}`,'utf8'));
  return {sourceHash,transformFingerprint,key};
}
function cachePathFor(identity,{namespace,extension='bin'}={}){
  const root=runtimeAssetCacheRoot(),safeNamespace=String(namespace||'default').replace(/[^a-zA-Z0-9._-]+/g,'_');
  return path.join(root,safeNamespace,identity.key.slice(0,2),`${identity.key}.${String(extension||'bin').replace(/^\./,'')}`);
}
function validateBuffer(buffer,validate){
  if(!validate)return true;
  try{validate(buffer);return true;}catch{return false;}
}
function cachedTransform(sourceBuffer,{namespace,version='1',options={},extension='bin',transform,validate=null}={}){
  if(typeof transform!=='function')throw new Error('runtime asset cache transform function is required');
  const identity=cacheIdentity(sourceBuffer,{namespace,version,options});
  const target=cachePathFor(identity,{namespace,extension});
  if(cacheEnabled()&&fs.existsSync(target)){
    const cached=fs.readFileSync(target);
    if(cached.length&&validateBuffer(cached,validate))return {buffer:cached,cacheHit:true,cacheKey:identity.key,cachePath:target,sourceHash:identity.sourceHash};
    try{fs.unlinkSync(target);}catch{}
  }
  const output=transform(sourceBuffer);
  const buffer=Buffer.isBuffer(output)?output:output?.buffer;
  if(!Buffer.isBuffer(buffer))throw new Error('runtime asset cache transform must return a Buffer or {buffer}');
  if(!validateBuffer(buffer,validate))throw new Error(`runtime asset cache transform produced invalid output for ${namespace}`);
  if(cacheEnabled()){
    fs.mkdirSync(path.dirname(target),{recursive:true});
    const temp=`${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp,buffer);
    try{fs.renameSync(temp,target);}catch(error){
      try{fs.unlinkSync(temp);}catch{}
      if(!fs.existsSync(target))throw error;
    }
  }
  return {buffer,cacheHit:false,cacheKey:identity.key,cachePath:target,sourceHash:identity.sourceHash};
}
function summarizeCacheRecords(records=[]){
  const hits=records.filter(item=>item.cacheHit===true).length;
  const misses=records.filter(item=>item.cacheHit===false).length;
  return {hits,misses,total:hits+misses,hitPercent:hits+misses?hits*100/(hits+misses):0};
}
function walkFiles(root){
  const out=[];
  if(!fs.existsSync(root))return out;
  const visit=(current)=>{for(const entry of fs.readdirSync(current,{withFileTypes:true})){const full=path.join(current,entry.name);if(entry.isDirectory())visit(full);else out.push(full);}};
  visit(root);return out;
}
function removeEmptyDirectories(root){
  if(!fs.existsSync(root))return;
  const visit=(current)=>{
    for(const entry of fs.readdirSync(current,{withFileTypes:true}))if(entry.isDirectory())visit(path.join(current,entry.name));
    if(current!==root&&fs.readdirSync(current).length===0)fs.rmdirSync(current);
  };
  visit(root);
}
function pruneRuntimeAssetCache(activePaths=[]){
  const root=runtimeAssetCacheRoot();
  if(!cacheEnabled()||!fs.existsSync(root))return {root,removedFiles:0,removedBytes:0,keptFiles:0};
  const keep=new Set(activePaths.filter(Boolean).map(item=>path.resolve(item)));
  let removedFiles=0,removedBytes=0,keptFiles=0;
  for(const file of walkFiles(root)){
    if(keep.has(path.resolve(file))){keptFiles++;continue;}
    const bytes=fs.statSync(file).size;
    fs.unlinkSync(file);removedFiles++;removedBytes+=bytes;
  }
  removeEmptyDirectories(root);
  return {root,removedFiles,removedBytes,keptFiles};
}
function inspectRuntimeAssetCache(){
  const root=runtimeAssetCacheRoot(),files=walkFiles(root),bytes=files.reduce((sum,file)=>sum+fs.statSync(file).size,0);
  return {root,enabled:cacheEnabled(),files:files.length,bytes};
}
function clearRuntimeAssetCache(){
  const root=runtimeAssetCacheRoot();fs.rmSync(root,{recursive:true,force:true});return root;
}
function formatBytes(bytes){if(bytes>=1024*1024)return `${(bytes/(1024*1024)).toFixed(2)} MiB`;if(bytes>=1024)return `${(bytes/1024).toFixed(1)} KiB`;return `${bytes} B`;}

if(require.main===module){
  const args=process.argv.slice(2);
  if(args.includes('--clear')){const root=clearRuntimeAssetCache();console.log(`Runtime asset cache cleared: ${root}`);}
  else{const info=inspectRuntimeAssetCache();console.log(`Runtime asset cache: ${info.enabled?'enabled':'disabled'}`);console.log(`Location: ${info.root}`);console.log(`Entries: ${info.files}`);console.log(`Size: ${formatBytes(info.bytes)}`);}
}

module.exports={CACHE_SCHEMA,stable,sha256,fingerprintFiles,cacheEnabled,runtimeAssetCacheRoot,cacheIdentity,cachePathFor,cachedTransform,summarizeCacheRecords,pruneRuntimeAssetCache,inspectRuntimeAssetCache,clearRuntimeAssetCache,formatBytes};
