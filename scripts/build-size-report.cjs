/* Read-only footprint inventory for a built dist. Never rewrites shipped assets. */
const fs=require('node:fs');
const path=require('node:path');

function category(relative){
 if(relative.startsWith('vendor/stockfish/'))return 'Stockfish';
 if(relative.startsWith('assets/kingdom-parchment/'))return 'Kingdom parchment';
 if(relative.startsWith('assets/kingdom-map/'))return 'Kingdom icons';
 if(relative.startsWith('assets/'))return 'Assets: '+(relative.split('/')[1]||'other');
 if(relative.startsWith('js/puzzles/'))return 'Puzzle modules';
 if(relative.startsWith('music/'))return 'Music';
 if(relative.startsWith('SFX/'))return 'SFX';
 if(relative.startsWith('generated_assets/'))return 'Generated assets';
 if(relative.startsWith('js/'))return 'JavaScript';
 if(relative.startsWith('css/'))return 'CSS';
 if(relative.startsWith('localization/'))return 'Localization';
 if(relative.startsWith('fonts/'))return 'Fonts';
 return 'Other';
}
function walk(root,directory=root,files=[]){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const full=path.join(directory,entry.name);
  if(entry.isDirectory())walk(root,full,files);
  else if(entry.isFile()){
   const relative=path.relative(root,full).split(path.sep).join('/');
   files.push({path:relative,bytes:fs.statSync(full).size,category:category(relative)});
  }
 }
 return files;
}
function analyzeDist(root){
 const files=walk(root);
 const groups=new Map();
 for(const file of files){
  const group=groups.get(file.category)||{category:file.category,count:0,bytes:0};
  group.count++;group.bytes+=file.bytes;groups.set(file.category,group);
 }
 return {schemaVersion:1,fileCount:files.length,
  totalBytes:files.reduce((n,x)=>n+x.bytes,0),
  categories:[...groups.values()].sort((a,b)=>b.bytes-a.bytes||a.category.localeCompare(b.category)),
  largest:files.sort((a,b)=>b.bytes-a.bytes||a.path.localeCompare(b.path)).slice(0,25)};
}
function printBuildSizeReport(dist,output){
 const report=analyzeDist(dist);
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 const mib=n=>(n/1048576).toFixed(2);
 console.log('[RPChess size] dist: '+mib(report.totalBytes)+' MiB uncompressed, '+report.fileCount+' files');
 for(const item of report.categories)console.log('[RPChess size] '+item.category+': '+mib(item.bytes)+' MiB ('+item.count+' files)');
 console.log('[RPChess size] full inventory: '+output);
 return report;
}
if(require.main===module)printBuildSizeReport(path.resolve(process.argv[2]||'dist'),
 path.resolve(process.argv[3]||'test-results/build-size-report.json'));
module.exports={category,analyzeDist,printBuildSizeReport};
