/* Evaluate a native-resolution PNG alternative; NEVER mutate dist or sources.
 * Use the same Chromium SVG renderer that paints the 128px authored artwork.
 * Generated PNGs and measurements stay in test-results for art review.
 */
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const DIST=path.join(ROOT,'dist','assets','kingdom-parchment');
const OUTPUT=path.join(ROOT,'test-results','parchment-raster-benchmark');
const manifest=JSON.parse(fs.readFileSync(path.join(DIST,'extra-manifest.json'),'utf8'));
const inputs=Object.entries(manifest.groups).flatMap(([group,names])=>
 names.filter(name=>name.endsWith('.svg')).map(name=>({group,name,
  relative:group+'/'+name})));
if(inputs.length!==112)throw Error('Unexpected parchment SVG catalog: '+inputs.length);

async function main(){
 fs.mkdirSync(OUTPUT,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const results=[];
 try{
  const page=await browser.newPage();
  for(const input of inputs){
   const text=fs.readFileSync(path.join(DIST,input.relative),'utf8');
   const base64=await page.evaluate(async svg=>{
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    try{
     const img=new Image();img.src=url;await img.decode();
     if(img.naturalWidth!==128||img.naturalHeight!==128)
      throw Error('Expected native 128×128 artwork, got '+img.naturalWidth+'x'+img.naturalHeight);
     const canvas=document.createElement('canvas');
     canvas.width=128;canvas.height=128;
     const ctx=canvas.getContext('2d',{willReadFrequently:false});
     ctx.imageSmoothingEnabled=false;
     ctx.drawImage(img,0,0,128,128);
     const png=canvas.toDataURL('image/png');
     if(!png.startsWith('data:image/png;base64,'))throw Error('PNG encoder unavailable');
     return png.slice('data:image/png;base64,'.length);
    }finally{URL.revokeObjectURL(url)}
   },text);
   const png=Buffer.from(base64,'base64');
   if(!png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))
    throw Error('PNG header missing: '+input.relative);
   const outputFile=path.join(OUTPUT,input.group,input.name.replace(/\.svg$/,'.png'));
   fs.mkdirSync(path.dirname(outputFile),{recursive:true});
   fs.writeFileSync(outputFile,png);
   results.push({svg:input.relative,sourceBytes:Buffer.byteLength(text,'utf8'),
     sourceGzipBytes:zlib.gzipSync(Buffer.from(text),{level:6}).length,
     pngBytes:png.length,pngGzipBytes:zlib.gzipSync(png,{level:6}).length});
  }
 }finally{await browser.close()}
 const sum=name=>results.reduce((n,x)=>n+x[name],0);
 const report={version:1,dimensions:'128x128',format:'native raster PNG alternative; source SVG unchanged',
  count:results.length,svgBytes:sum('sourceBytes'),svgGzipBytes:sum('sourceGzipBytes'),
  pngBytes:sum('pngBytes'),pngGzipBytes:sum('pngGzipBytes'),files:results};
 fs.writeFileSync(path.join(OUTPUT,'report.json'),JSON.stringify(report,null,2)+'\n');
 const mib=n=>(n/1048576).toFixed(2);
 console.log('Parchment raster experiment: '+results.length+' sprites, SVG '+mib(report.svgBytes)+
  ' MiB / gzip '+mib(report.svgGzipBytes)+' MiB → 128px lossless PNG '+
  mib(report.pngBytes)+' MiB / gzip '+mib(report.pngGzipBytes)+' MiB');
 console.log('No production asset was changed; inspect the benchmark artifact before choosing a format.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
