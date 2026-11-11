/* Opt-in no-browser verification: rasterize all 112 pixel-vector masters in a
 * throwaway directory. Never modify checked-in art or production dist.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {convertParchment,GROUPS}=require('../scripts/prepare-parchment-raster.cjs');
const {parsePng}=require('../scripts/piece-asset-runtime.cjs');
const repo=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rpchess-parchment-raster-'));
const out=path.join(repo,'test-results/parchment-raster-qa');
try{
 const source=path.join(repo,'game/assets/kingdom-parchment');
 const dest=path.join(temp,'assets/kingdom-parchment');
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.cpSync(source,dest,{recursive:true});
 fs.copyFileSync(path.join(repo,'game/index.html'),path.join(temp,'index.html'));
 const manifest={groups:Object.fromEntries(GROUPS.map(group=>[
  group,fs.readdirSync(path.join(dest,group)).filter(name=>name.endsWith('.svg')).sort()
 ]))};
 fs.writeFileSync(path.join(dest,'extra-manifest.json'),JSON.stringify(manifest));
 const report=convertParchment(temp);
 assert.equal(report.count,112);
 assert(report.pngBytes<3*1024*1024,'PNG output should be comfortably under 3 MiB');
 assert(report.svgBytes>30*1024*1024,'Expected 33 MiB input masters');
 assert(fs.readFileSync(path.join(temp,'index.html'),'utf8')
    .includes('name="rpchess-parchment-raster" content="png"'));
 const outputManifest=JSON.parse(fs.readFileSync(path.join(dest,'extra-manifest.json'),'utf8'));
 for(const group of GROUPS){
   assert.equal(outputManifest.groups[group].length,16);
   for(const name of outputManifest.groups[group]){
     assert(name.endsWith('.png'));
     const full=path.join(dest,group,name);
     const info=parsePng(fs.readFileSync(full));
     assert.deepEqual([info.width,info.height],[128,128]);
     assert.equal(fs.existsSync(full.replace(/\.png$/,'.svg')),false,
       'ship only PNGs in experimental dist');
   }
 }
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 // Keep all 112 generated sprites for independent Chromium pixel parity QA.
 for(const group of GROUPS){
  const target=path.join(out,'converted',group);
  fs.mkdirSync(target,{recursive:true});
  for(const name of outputManifest.groups[group]){
   fs.copyFileSync(path.join(dest,group,name),path.join(target,name));
  }
 }
 // Contact images are the original alpha-preserving decoded output; art review
 // can open them, while all 112 source SVGs remain in the repository.
 for(const group of GROUPS)fs.copyFileSync(path.join(dest,group,outputManifest.groups[group][0]),
   path.join(out,group+'.png'));
 console.log('PARCHMENT RASTER QA PASS: '+report.count+' assets / '+
   (report.svgBytes/1048576).toFixed(2)+' MiB SVG -> '+
   (report.pngBytes/1048576).toFixed(2)+' MiB PNG');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
