/* Reuse the icon provided for RPChess. Generate real PNG launcher icons
 * without pulling a new image-processing dependency into the game pipeline.
 * Source: game/pwa/icon-source.png (192px optimized from supplied 512px art).
 */
const fs=require('fs');
const path=require('path');
const {decodePng,encodeRgbaPng}=require('./piece-asset-runtime.cjs');
const BG=[5,10,18];

function resizePremultiplied(src,sw,sh,dw,dh){
 const dest=Buffer.alloc(dw*dh*4);
 for(let y=0;y<dh;y++){
  const sy=Math.max(0,Math.min(sh-1,(y+.5)*sh/dh-.5));
  const y0=Math.floor(sy),y1=Math.min(sh-1,y0+1),fy=sy-y0;
  for(let x=0;x<dw;x++){
   const sx=Math.max(0,Math.min(sw-1,(x+.5)*sw/dw-.5));
   const x0=Math.floor(sx),x1=Math.min(sw-1,x0+1),fx=sx-x0;
   let a=0,r=0,g=0,b=0;
   for(const [px,py,w] of [[x0,y0,(1-fx)*(1-fy)],[x1,y0,fx*(1-fy)],
                             [x0,y1,(1-fx)*fy],[x1,y1,fx*fy]]){
    const i=(py*sw+px)*4,alpha=src[i+3]/255,weighted=w*alpha;
    a+=weighted;r+=weighted*src[i];g+=weighted*src[i+1];b+=weighted*src[i+2];
   }
   const o=(y*dw+x)*4;
   if(a>1e-8){dest[o]=Math.round(r/a);dest[o+1]=Math.round(g/a);dest[o+2]=Math.round(b/a);}
   dest[o+3]=Math.round(a*255);
  }
 }
 return dest;
}
function compose(icon,side,padding){
 const actual=side-padding*2;
 const image=resizePremultiplied(icon.rgba,icon.width,icon.height,actual,actual);
 const canvas=Buffer.alloc(side*side*4);
 for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const o=(y*side+x)*4;
  let [r,g,b]=BG;
  if(x>=padding&&x<padding+actual&&y>=padding&&y<padding+actual){
   const i=((y-padding)*actual+x-padding)*4,a=image[i+3]/255;
   r=Math.round(image[i]*a+r*(1-a));
   g=Math.round(image[i+1]*a+g*(1-a));
   b=Math.round(image[i+2]*a+b*(1-a));
  }
  canvas[o]=r;canvas[o+1]=g;canvas[o+2]=b;canvas[o+3]=255;
 }
 return encodeRgbaPng(side,side,canvas);
}
function makePwaIcons(sourceRoot,distRoot){
 const src=path.join(sourceRoot,'pwa/icon-source.png');
 if(!fs.existsSync(src))throw new Error('Missing RPChess PWA source icon');
 const icon=decodePng(fs.readFileSync(src));
 if(icon.width!==192||icon.height!==192)throw new Error('RPChess PWA icon must be 192px source');
 const out=path.join(distRoot,'icons');fs.mkdirSync(out,{recursive:true});
 for(const [name,side,padding] of [
  ['icon-192.png',192,5],
  ['icon-512.png',512,12],
  ['apple-touch-icon.png',180,8],
  // Keep the entire emblem inside the maskable safe circle on Android.
  ['icon-maskable-512.png',512,76]
 ]){
  const bytes=compose(icon,side,padding);
  const file=path.join(out,name);fs.writeFileSync(file,bytes);
  const check=decodePng(bytes);
  if(check.width!==side||check.height!==side||bytes.length>450*1024)
   throw new Error('Invalid or oversized generated PWA icon: '+name);
 }
 return 4;
}
module.exports={makePwaIcons};
