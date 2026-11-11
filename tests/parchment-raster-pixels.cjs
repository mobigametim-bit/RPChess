/* Chromium pixel-parity check for opt-in PNG rasterized parchment.
 * Compares all 112 scenes at native and gameplay-aligned zooms; checks visible
 * premultiplied RGB and alpha, not meaningless RGB under zero alpha.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {GROUPS}=require('../scripts/prepare-parchment-raster.cjs');
const repo=path.resolve(__dirname,'..'),sourceRoot=path.join(repo,'game/assets/kingdom-parchment');
const out=path.join(repo,'test-results/parchment-raster-qa');
const pngRoot=path.join(out,'converted');
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const rows=[];
 try{
  const page=await browser.newPage();
  for(const group of GROUPS){
   const files=fs.readdirSync(path.join(sourceRoot,group)).filter(n=>n.endsWith('.svg')).sort();
   for(const file of files){
    const vector=fs.readFileSync(path.join(sourceRoot,group,file),'utf8');
    const png=fs.readFileSync(path.join(pngRoot,group,file.replace(/\.svg$/,'.png'))).toString('base64');
    const pixels=await page.evaluate(async({vector,png})=>{
      const svgUrl=URL.createObjectURL(new Blob([vector],{type:'image/svg+xml'}));
      const load=async(src)=>{
       const image=new Image();image.src=src;await image.decode();return image;
      };
      try{
       const [svg,raster]=await Promise.all([
         load(svgUrl),load('data:image/png;base64,'+png)]);
       const samples=[];
       for(const size of [128,142,284]){
        const paint=(image,smooth)=>{
         const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
         const ctx=canvas.getContext('2d',{willReadFrequently:true});
         ctx.imageSmoothingEnabled=smooth;ctx.drawImage(image,0,0,size,size);
         return ctx.getImageData(0,0,size,size).data;
        };
        const a=paint(svg,true),b=paint(raster,false);
        let total=0,changed=0,worst=0;
        for(let i=0;i<a.length;i+=4){
         const aa=a[i+3],bb=b[i+3];
         const diff=Math.max(Math.abs(aa-bb),
           Math.abs(a[i]*aa-b[i]*bb)/255,
           Math.abs(a[i+1]*aa-b[i+1]*bb)/255,
           Math.abs(a[i+2]*aa-b[i+2]*bb)/255);
         total+=diff;worst=Math.max(worst,diff);
         if(diff>4)changed++;
        }
        samples.push({size,changed,changedPercent:100*changed/(size*size),
          meanVisibleDifference:total/(size*size),maxVisibleDifference:worst});
       }
       return samples;
      }finally{URL.revokeObjectURL(svgUrl);}
    },{vector,png});
    rows.push({path:group+'/'+file,samples:pixels});
   }
  }
 }finally{await browser.close();}
 assert.equal(rows.length,112);
 const summary=[128,142,284].map(size=>{
   const a=rows.map(r=>r.samples.find(s=>s.size===size));
   return {size,meanVisibleDifference:a.reduce((n,s)=>n+s.meanVisibleDifference,0)/a.length,
     changedPercent:a.reduce((n,s)=>n+s.changed,0)/(a.length*size*size)*100,
     worstImage:a.reduce((w,x,i)=>x.changedPercent>w.changedPercent?{path:rows[i].path,...x}:w,
       {changedPercent:0})};
 });
 fs.writeFileSync(path.join(out,'pixel-parity.json'),
   JSON.stringify({count:rows.length,summary,files:rows},null,2)+'\n');
 for(const s of summary)console.log('Parchment pixel QA '+s.size+'px: visible mean '+
  s.meanVisibleDifference.toFixed(3)+', changed >4: '+s.changedPercent.toFixed(4)+'%, worst: '+
  JSON.stringify(s.worstImage));
 // Fail if this bespoke renderer distorts visible pixels. Native unscaled
 // 128px artwork is the strong, most important lossless requirement.
 assert(summary[0].changedPercent<0.5&&summary[0].meanVisibleDifference<1,
   'Native 128px rasterization visibly changed the original SVG pixel art');
 assert(summary[1].changedPercent<1&&summary[2].changedPercent<1,
   'Nearest zoom of rasterized art differs visibly from source SVG');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
