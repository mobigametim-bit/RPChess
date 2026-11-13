/* Kingdom's player-built roads: pale sandstone running-bond paving.
 * Based on the accepted HTML road preview, option 1, width=16px.
 * Geometry is unchanged (same 32%/68% Bezier controls and saved bend).
 * Pure Canvas drawing: no image downloads, gameplay state, or RNG mutations. */
const SANDSTONE_WIDTH=16;
const PALETTE=Object.freeze({
 base:'#e4bd54',
 bricks:['#f3d47a','#e7be50','#ffe18a','#d6a93b'],
 joint:'#89692e',
 edge:'#9b7938'
});
const GRAY_STONE=Object.freeze({
 base:'#9a9b98',bricks:['#bec1bf','#aeb3b1','#c8c9c5','#929896'],
 joint:'#555c5d',edge:'#55595b'
});
const BRICK_LENGTH=22,BRICK_STEP=24,ROWS=3;
function hash32(value){
 let h=2166136261;
 for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
 return h>>>0;
}
function drawSandstoneRoad(ctx,{x1,y1,x2,y2,bend=0,id='',tone='sandstone'}) {
 if(!ctx||![x1,y1,x2,y2,bend].every(Number.isFinite))return false;
 const palette=tone==='gray'?GRAY_STONE:PALETTE;
 const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);
 if(length<1)return false;
 const nx=-dy/length,ny=dx/length,offset=bend;
 const c1x=x1+dx*.32+nx*offset,c1y=y1+dy*.32+ny*offset;
 const c2x=x1+dx*.68-nx*offset*.45,c2y=y1+dy*.68-ny*offset*.45;
 const curve=t=>{
  const u=1-t,uu=u*u,tt=t*t;
  const x=uu*u*x1+3*uu*t*c1x+3*u*tt*c2x+tt*t*x2;
  const y=uu*u*y1+3*uu*t*c1y+3*u*tt*c2y+tt*t*y2;
  const tx=3*uu*(c1x-x1)+6*u*t*(c2x-c1x)+3*tt*(x2-c2x);
  const ty=3*uu*(c1y-y1)+6*u*t*(c2y-c1y)+3*tt*(y2-c2y);
  const tangent=Math.max(1e-9,Math.hypot(tx,ty));
  return {x,y,angle:Math.atan2(ty,tx),nx:-ty/tangent,ny:tx/tangent};
 };
 const begin=()=>{ctx.beginPath();ctx.moveTo(x1,y1);
  ctx.bezierCurveTo(c1x,c1y,c2x,c2y,x2,y2);};
 ctx.save();
 ctx.lineCap='round';ctx.lineJoin='round';
 // Dusty undercut and restrained shadow match the accepted sandstone preview.
 ctx.save();ctx.shadowColor=tone==='gray'?'#1e252866':'#432b1866';ctx.shadowBlur=9;ctx.shadowOffsetY=4;
 begin();ctx.lineWidth=SANDSTONE_WIDTH+7;ctx.strokeStyle=palette.edge;ctx.stroke();ctx.restore();
 begin();ctx.lineWidth=SANDSTONE_WIDTH+2;ctx.strokeStyle=palette.edge;ctx.stroke();
 begin();ctx.lineWidth=SANDSTONE_WIDTH;ctx.strokeStyle=palette.base;ctx.stroke();
 // Arc-length table: stable stone spacing independent of Bezier curvature.
 const steps=Math.min(1800,Math.max(32,Math.ceil((length+Math.abs(offset)*2)/4)));
 const points=[],arcs=[0];
 for(let i=0;i<=steps;i++){
  const p=curve(i/steps);points.push(p);
  if(i){const prev=points[i-1];arcs[i]=arcs[i-1]+Math.hypot(p.x-prev.x,p.y-prev.y);}
 }
 const total=arcs[steps];
 const sample=distance=>{
  const target=Math.max(0,Math.min(total,distance));
  let lo=0,hi=steps;
  while(hi-lo>1){const middle=(lo+hi)>>1;
   if(arcs[middle]<target)lo=middle;else hi=middle;}
  const t=(lo+(target-arcs[lo])/(arcs[hi]-arcs[lo]||1))/steps;
  return curve(t);
 };
 // Trimming every brick to the curved road silhouette prevents squared ends.
 ctx.save();ctx.beginPath();
 for(let i=0;i<=steps;i++){
  const p=points[i],x=p.x+p.nx*SANDSTONE_WIDTH*.5,y=p.y+p.ny*SANDSTONE_WIDTH*.5;
  if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
 }
 for(let i=steps;i>=0;i--){const p=points[i];
  ctx.lineTo(p.x-p.nx*SANDSTONE_WIDTH*.5,p.y-p.ny*SANDSTONE_WIDTH*.5);}
 ctx.closePath();ctx.clip();
 const rowHeight=SANDSTONE_WIDTH/ROWS;
 const salt=hash32(String(id));
 for(let row=0;row<ROWS;row++){
  const lateral=(row-(ROWS-1)/2)*rowHeight;
  for(let i=0,d=-BRICK_LENGTH*2;d<total+BRICK_LENGTH*2;d+=BRICK_STEP,i++){
   const shifted=d+(row%2)*BRICK_LENGTH*.49;
   if(shifted<0||shifted>total)continue;
   const p=sample(shifted);
   const h=hash32(salt+':'+row+':'+i);
   const brickLength=BRICK_LENGTH*(.94+(h%130)/1000);
   const x=p.x+p.nx*lateral,y=p.y+p.ny*lateral;
   ctx.save();ctx.translate(x,y);ctx.rotate(p.angle);
   const height=rowHeight+1;
   ctx.fillStyle=palette.joint;ctx.fillRect(-brickLength/2,-height/2,brickLength,height);
   ctx.fillStyle=palette.bricks[(h>>>8)%palette.bricks.length];
   ctx.fillRect(-brickLength/2+1.1,-height/2+1.05,brickLength-2.2,height-2.1);
   ctx.fillStyle='#fff7d120';
   ctx.fillRect(-brickLength/2+1.5,-height/2+1.4,brickLength-3.1,Math.max(1,height*.19));
   ctx.fillStyle='#0000000e';
   ctx.fillRect(-brickLength/2+1.3,height/2-3,brickLength-2.6,1.6);
   ctx.fillStyle='#3f342318';
   ctx.fillRect(-brickLength*.17,-height*.25,1+(h%20)/10,1.1);
   ctx.restore();
  }
 }
 ctx.restore();
 begin();ctx.lineWidth=1.35;ctx.strokeStyle=tone==='gray'?'#e0e5e5a8':'#f7dfacb8';ctx.stroke();
 // Subtle broken curb edges, no glowing UI highlights.
 ctx.save();ctx.lineWidth=1.4;ctx.strokeStyle=tone==='gray'?'#454c4ca8':'#786347a8';ctx.setLineDash([24,5,8,4]);
 for(const sign of [-1,1]){
  ctx.beginPath();
  for(let i=0;i<=steps;i+=3){const p=points[i];
   const x=p.x+p.nx*sign*SANDSTONE_WIDTH*.53;
   const y=p.y+p.ny*sign*SANDSTONE_WIDTH*.53;
   if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.stroke();
 }
 ctx.restore();
 ctx.restore();
 return true;
}
export {SANDSTONE_WIDTH,drawSandstoneRoad};
