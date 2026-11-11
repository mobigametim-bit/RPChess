/* Mandatory production conversion of 128px pixel-rect parchment masters.
 * No image libraries, Chromium or Network. Never write into game/assets.
 * Every build ships PNG only; editable source SVG masters remain in Git.
 */
const fs=require('node:fs');
const path=require('node:path');
const {encodeRgbaPng,parsePng}=require('./piece-asset-runtime.cjs');
const GROUPS=['parchment_base_variations','forest_clusters','mountain_clusters',
 'hills_rocks','fog_of_war_shapes','marsh_wasteland_optional','decor_minor_landmarks'];
function rasterSvg(svg,filename){
 if(!/<svg\b[^>]*viewBox="0 0 128 128"/.test(svg)||
    !/shape-rendering="crispEdges"/.test(svg))
   throw Error(filename+': unsupported viewBox or pixel-art SVG renderer');
 for(const tag of svg.matchAll(/<([a-zA-Z][\w-]*)\b/g)){
   if(!['svg','title','rect'].includes(tag[1]))
     throw Error(filename+': unexpected SVG markup '+tag[1]);
 }
 const image=Buffer.alloc(128*128*4),occupied=new Uint8Array(128*128);
 const rectangles=[...svg.matchAll(/<rect\b([^>]*?)\/>/g)];
 if(!rectangles.length)throw Error(filename+': no rects');
 for(const match of rectangles){
   const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)]
     .map(m=>[m[1],m[2]]));
   const x=Number(attrs.x),y=Number(attrs.y),w=Number(attrs.width),h=Number(attrs.height);
   if(![x,y,w,h].every(Number.isSafeInteger)||w<1||h<1||
      x<0||y<0||x+w>128||y+h>128)
     throw Error(filename+': fractional/out-of-bounds rect');
   const hex=(attrs.fill||'').replace(/^#/,'');
   if(!/^[0-9a-f]{6}$/i.test(hex))throw Error(filename+': unsupported color');
   const op=Number(attrs['fill-opacity']??1);
   if(!Number.isFinite(op)||op<0||op>1)throw Error(filename+': invalid alpha');
   const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),
     b=parseInt(hex.slice(4,6),16),a=Math.round(op*255);
   for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){
      const pos=j*128+i;
      // Artist pixel-vector assets were compiled from one raster layer.
      // Fail rather than silently lose alpha compositing if that changes.
      if(occupied[pos])throw Error(filename+': overlapping pixel rects');
      occupied[pos]=1;
      image[pos*4]=r;image[pos*4+1]=g;
      image[pos*4+2]=b;image[pos*4+3]=a;
   }
 }
 const png=encodeRgbaPng(128,128,image);
 const header=parsePng(png);
 if(header.width!==128||header.height!==128)throw Error(filename+': bad PNG');
 return png;
}
function convertParchment(root){
 const folder=path.join(root,'assets/kingdom-parchment');
 if(!fs.existsSync(folder))throw Error('Missing parchment folder: '+folder);
 const rows=[];
 for(const group of GROUPS){
   const dir=path.join(folder,group);
   const names=fs.readdirSync(dir).filter(n=>n.endsWith('.svg')).sort();
   if(names.length!==16)throw Error(group+': expected 16 SVG assets, found '+names.length);
   for(const name of names){
     const src=path.join(dir,name),source=fs.readFileSync(src,'utf8');
     const png=rasterSvg(source,group+'/'+name);
     const dest=src.replace(/\.svg$/,'.png');
     fs.writeFileSync(dest,png);
     rows.push({path:group+'/'+name,svgBytes:Buffer.byteLength(source),pngBytes:png.length});
     fs.rmSync(src); // SVG masters never ship with dist
   }
 }
 if(rows.length!==112)throw Error('Expected exactly 112 raster assets');
 const manifest=path.join(folder,'extra-manifest.json');
 if(fs.existsSync(manifest)){
  const data=JSON.parse(fs.readFileSync(manifest,'utf8'));
  for(const [group,names]of Object.entries(data.groups||{})){
    data.groups[group]=names.map(name=>name.replace(/\.svg$/,'.png'));
  }
  fs.writeFileSync(manifest,JSON.stringify(data,null,2)+'\n');
 }
 const report={count:rows.length,svgBytes:rows.reduce((n,r)=>n+r.svgBytes,0),
    pngBytes:rows.reduce((n,r)=>n+r.pngBytes,0),rows};
 console.log('[Parchment raster] '+rows.length+' sprites, '+(report.svgBytes/1048576).toFixed(2)+
   ' MiB SVG -> '+(report.pngBytes/1048576).toFixed(2)+' MiB PNG');
 return report;
}
if(require.main===module){
 const root=path.resolve(process.argv[2]||'dist');
 // Guard against accidentally overwriting the checked-in source masters.
 if(root===path.resolve(__dirname,'../game'))
  throw Error('Refusing to rasterize game/ source masters');
 const report=convertParchment(root);
 const output=path.resolve(process.argv[3]||'test-results/parchment-raster-report.json');
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
}
module.exports={rasterSvg,convertParchment,GROUPS};
