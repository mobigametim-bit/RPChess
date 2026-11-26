/* Lexical inventory, not a complete call graph. Read-only audit.
 * Count tokens/call-like occurrences, including possible comments or literals.
 * Aliased imports and dynamically computed storage keys require manual review. */
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
function filesUnder(dir){
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(dir,entry.name);
  return entry.isDirectory()?filesUnder(file):/\.(?:mjs|js|cjs)$/.test(entry.name)?[file]:[];
 });
}
function persistenceCallSites(){
 const roots=['game/js','profile-worker/src','tournament-worker/src'];
 const files=roots.filter(dir=>fs.existsSync(path.join(ROOT,dir))).flatMap(dir=>filesUnder(path.join(ROOT,dir)));
 const patterns={
  readRun:/\breadRun\s*\(/g,writeRun:/\bwriteRun\s*\(/g,clearRun:/\bclearRun\s*\(/g,
  runKey:/\bRUN_STORAGE_KEY\b|rpchess\.reboot\.v1\.run(?![\w.-])/g,
  restoreLocalEnvelope:/\brestoreLocalEnvelope\s*\(/g,localPayload:/\blocalPayload\s*\(/g,
  syncStorage:/\bplatform\.storage\.sync\s*\(/g,localStorage:/\b(?:localStorage|platform\.storage\.local)\b/g
 };
 const rows=[];
 for(const file of files){
  const source=fs.readFileSync(file,'utf8'),row={file:path.relative(ROOT,file).split(path.sep).join('/')};
  for(const [name,pattern] of Object.entries(patterns))row[name]=[...source.matchAll(pattern)].length;
  if(Object.keys(patterns).some(name=>row[name]))rows.push(row);
 }
 const totals=Object.fromEntries(Object.keys(patterns).map(name=>[name,rows.reduce((sum,row)=>sum+row[name],0)]));
 const counts=Object.fromEntries(Object.keys(patterns).map(name=>[name,rows.filter(row=>row[name]).length]));
 return {scannedFiles:files.length,affectedFiles:rows.length,totals,filesByPattern:counts,
  directRunKey:rows.filter(row=>row.runKey).map(({file,runKey})=>({file,runKey})),
  restorePaths:rows.filter(row=>row.restoreLocalEnvelope||row.localPayload).map(({file,restoreLocalEnvelope,localPayload})=>({file,restoreLocalEnvelope,localPayload})),
  largestOwners:rows.filter(row=>row.readRun||row.writeRun||row.clearRun).sort((a,b)=>
   (b.readRun+b.writeRun+b.clearRun)-(a.readRun+a.writeRun+a.clearRun)).slice(0,15),
  limitations:'lexical counts include declarations and possible comments; excludes HTML, aliases, computed keys and generated build output; inspect ownership and call timing manually'};
}
module.exports={persistenceCallSites};
