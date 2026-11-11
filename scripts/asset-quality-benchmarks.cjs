/* Visual QA benchmark, NOT a build transform. Original artwork stays untouched. */
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const assetRoot=path.join(root,'game/assets/kingdom-parchment');
const output=path.join(root,'test-results/asset-quality');
const sizes=[142,284];
function svgFiles(folder,files=[]){
 for(const ent of fs.readdirSync(folder,{withFileTypes:true})){
  const full=path.join(folder,ent.name);
  if(ent.isDirectory())svgFiles(full,files);
  else if(ent.isFile()&&ent.name.endsWith('.svg'))files.push(full);
 }
 return files.sort();
}
function rel(file){return path.relative(assetRoot,file).split(path.sep).join('/');}
function summarize(rows,size,mode){
 const items=rows.map(x=>x.measurements.find(v=>v.size===size)[mode]);
 const pixels=items.reduce((n,x)=>n+x.pixels,0);
 return {size,mode,meanAbsDifference:+(items.reduce((n,x)=>n+x.absoluteSum,0)/(pixels*4)).toFixed(4),
  changedOver8Pct:+(100*items.reduce((n,x)=>n+x.changedOver8,0)/pixels).toFixed(4),
  worstChannelDifference:Math.max(...items.map(x=>x.maxDifference))};
}
async function main(){
 const files=svgFiles(assetRoot);
 if(files.length!==112)throw Error('Expected 112 parchment SVG files, got '+files.length);
 fs.mkdirSync(output,{recursive:true});
 const samples=new Map();
 for(const file of files){
  const group=rel(file).split('/')[0],bytes=fs.statSync(file).size;
  if(!samples.has(group)||samples.get(group).bytes<bytes)samples.set(group,{file,bytes});
 }
 const sampleSet=new Set([...samples.values()].map(x=>x.file));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const rows=[];
 try{
  const page=await browser.newPage();
  for(const file of files){
   const markup=fs.readFileSync(file,'utf8');
   const showPreview=sampleSet.has(file);
   const result=await page.evaluate(async ({markup,sizes,showPreview})=>{
    const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'}));
    const load=async src=>{
      const image=new Image();
      image.src=src;
      await image.decode();
      return image;
    };
    const canvas=(size)=>{
      const c=document.createElement('canvas');
      c.width=size;c.height=size;return c;
    };
    const draw=(image,size,smoothing)=>{
      const c=canvas(size),ctx=c.getContext('2d',{willReadFrequently:true});
      ctx.imageSmoothingEnabled=smoothing;
      ctx.drawImage(image,0,0,size,size);
      return c;
    };
    const compare=(svg,png)=>{
      const a=svg.getContext('2d').getImageData(0,0,svg.width,svg.height).data;
      const b=png.getContext('2d').getImageData(0,0,png.width,png.height).data;
      let absoluteSum=0,changedOver8=0,maxDifference=0;
      for(let i=0;i<a.length;i+=4){
        let changed=false;
        for(let k=0;k<4;k++){
         const delta=Math.abs(a[i+k]-b[i+k]);
         absoluteSum+=delta;
         maxDifference=Math.max(maxDifference,delta);
         if(delta>8)changed=true;
        }
        if(changed)changedOver8++;
      }
      return {pixels:a.length/4,absoluteSum,changedOver8,maxDifference};
    };
    try{
      const original=await load(url);
      if(original.naturalWidth!==128||original.naturalHeight!==128)
        throw Error('Source must be exactly 128x128');
      const native=draw(original,128,false);
      const png=await load(native.toDataURL('image/png'));
      const measurements=[];
      let preview=null;
      for(const size of sizes){
       const vector=draw(original,size,true);
       const nearest=draw(png,size,false);
       const smooth=draw(png,size,true);
       measurements.push({size,nearest:compare(vector,nearest),smooth:compare(vector,smooth)});
       if(showPreview&&size===284){
        const combo=canvas(size*3),ctx=combo.getContext('2d');
        ctx.drawImage(vector,0,0);ctx.drawImage(nearest,size,0);ctx.drawImage(smooth,size*2,0);
        preview=combo.toDataURL('image/png').split(',')[1];
       }
      }
      return {measurements,preview};
    }finally{URL.revokeObjectURL(url);}
   },{markup,sizes,showPreview});
   const record={path:rel(file),svgBytes:fs.statSync(file).size,measurements:result.measurements};
   rows.push(record);
   if(result.preview){
     const dest=path.join(output,'samples',rel(file).replace(/\.svg$/,'.png'));
     fs.mkdirSync(path.dirname(dest),{recursive:true});
     fs.writeFileSync(dest,Buffer.from(result.preview,'base64'));
   }
  }
 }finally{await browser.close();}
 const report={version:1,source:'112 untouched authored SVG assets; browser native 128px PNG rasterized in memory',
  sizes,previewColumns:['SVG rendered at target size','PNG at 128px scaled nearest','PNG at 128px scaled smooth'],
  summary:sizes.flatMap(size=>['nearest','smooth'].map(mode=>summarize(rows,size,mode))),
  files:rows};
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(output,'README.txt'),
   'Each sample image contains 3 columns: SVG original at 284px | PNG nearest at 284px | PNG smooth at 284px.\n'+
   'Report describes alpha-inclusive RGBA pixel deviations. No asset is modified or promoted to release.\n');
 for(const item of report.summary)console.log('Visual QA '+item.size+'px '+item.mode+
  ': mean channel diff '+item.meanAbsDifference+', pixels >8 difference '+
  item.changedOver8Pct+'%, worst channel diff '+item.worstChannelDifference);
 console.log('Compared '+rows.length+' SVG assets; 7 contact-sheet examples in test-results/asset-quality/samples.');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
