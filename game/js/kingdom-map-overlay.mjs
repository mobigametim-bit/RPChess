/* Decorative ownership perimeter and completed-event roads, for both map skins.
 * No gameplay mutations, no tile hitboxes, no leaks outside charted fog. */
import {PARCHMENT_TILE} from './kingdom-parchment-core.mjs';
import {hashString} from './race-assets.mjs';

const TILE=PARCHMENT_TILE;
const SIDES=Object.freeze([
 ['n',0,-1,(x,y)=>[x,y,x+1,y]],
 ['e',1,0,(x,y)=>[x+1,y,x+1,y+1]],
 ['s',0,1,(x,y)=>[x+1,y+1,x,y+1]],
 ['w',-1,0,(x,y)=>[x,y+1,x,y]]
]);

function parseTile(id){
 if(typeof id!=='string'||!/^-?[0-9]+,-?[0-9]+$/.test(id))return null;
 const [x,y]=id.split(',').map(Number);
 return Number.isSafeInteger(x)&&Number.isSafeInteger(y)?{x,y}:null;
}
function drawKingdomOverlay(canvas,{map,view,columns,rows}){
 if(!canvas||!map||!view)return;
 const width=Math.round(columns*TILE),height=Math.round(rows*TILE);
 if(canvas.width!==width)canvas.width=width;
 if(canvas.height!==height)canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.clearRect(0,0,width,height);
 const left=view.x-Math.floor(columns/2),top=view.y-Math.floor(rows/2);
 const cells=map.cells||{};
 const owned=new Set([...(map.centralOwnedCells||[]),
  ...(map.outposts||[]).flatMap(post=>post.cells||[]),
  ...Object.keys(cells).filter(id=>cells[id]?.annexed)]);
 // Clip roads and sovereignty lines to explored/revealed fog circles. Ownership
 // by Power is not scouting and must not disclose an unknown location.
 ctx.save();ctx.beginPath();
 for(const id of Object.keys(cells)){
  const p=parseTile(id);
  if(!p||p.x<left-2||p.x>left+columns+1||p.y<top-2||p.y>top+rows+1)continue;
  const x=(p.x-left+.5)*TILE,y=(p.y-top+.5)*TILE;
  ctx.moveTo(x+TILE*.71,y);ctx.arc(x,y,TILE*.71,0,Math.PI*2);
 }
 ctx.clip();
 // Strategy-map treatment: all six ownership glow alphas are reduced by 30%.
 // One continuous blue tint across all owned cells,
 // bright edge bloom and fine light dashes like painted province borders.
 // All operations remain inside scouted territory's clip.
 ctx.save();ctx.beginPath();
 for(const id of owned){
  const p=parseTile(id);if(!p)continue;
  ctx.rect((p.x-left)*TILE,(p.y-top)*TILE,TILE,TILE);
 }
 ctx.fillStyle='rgba(35,118,222,.175)';ctx.fill();
 ctx.restore();
 ctx.save();
 let glowCount=0;
 for(const id of owned){
  const p=parseTile(id);if(!p)continue;
  const x=(p.x-left+.5)*TILE,y=(p.y-top+.5)*TILE;
  if(x<-TILE||y<-TILE||x>width+TILE||y>height+TILE)continue;
  const glow=ctx.createRadialGradient(x,y,TILE*.08,x,y,TILE*.76);
  glow.addColorStop(0,'rgba(49,151,255,.203)');
  glow.addColorStop(.56,'rgba(40,133,238,.112)');
  glow.addColorStop(1,'rgba(58,134,218,0)');
  ctx.fillStyle=glow;ctx.fillRect(x-TILE*.78,y-TILE*.78,TILE*1.56,TILE*1.56);
  glowCount++;
 }
 ctx.restore();
 let roadCount=0;
 const painted=new Set();
 for(const road of [...(map.completedRoads||[]),...(map.outpostRoads||[])]){
  const a=parseTile(road.from),b=parseTile(road.to);
  if(!a||!b||!Number.isFinite(road.bend))continue;
  const identity=[road.from,road.to].sort().join('::');
  if(painted.has(identity))continue;
  painted.add(identity);
  const x1=(a.x-left+.5)*TILE,y1=(a.y-top+.5)*TILE;
  const x2=(b.x-left+.5)*TILE,y2=(b.y-top+.5)*TILE;
  if(Math.max(x1,x2)<-TILE*2||Math.min(x1,x2)>width+TILE*2||
     Math.max(y1,y2)<-TILE*2||Math.min(y1,y2)>height+TILE*2)continue;
  const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);
  if(length<1)continue;
  const nx=-dy/length,ny=dx/length,offset=road.bend*TILE;
  ctx.beginPath();ctx.moveTo(x1,y1);
  ctx.bezierCurveTo(x1+dx*.32+nx*offset,y1+dy*.32+ny*offset,
   x1+dx*.68-nx*offset*.45,y1+dy*.68-ny*offset*.45,x2,y2);
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='rgba(57,41,25,.68)';ctx.lineWidth=9;ctx.stroke();
  ctx.strokeStyle='rgba(220,179,105,.85)';ctx.lineWidth=5;ctx.stroke();
  ctx.strokeStyle='rgba(250,226,164,.45)';ctx.lineWidth=1.5;ctx.stroke();
  roadCount++;
 }
 // The overlay is beneath all site and king art; never cut off the road
 // before its endpoint. Roads physically reach the tile centers.
 let borderCount=0;
 for(const id of owned){
  const p=parseTile(id);if(!p)continue;
  if(p.x<left-2||p.x>left+columns+1||p.y<top-2||p.y>top+rows+1)continue;
  for(const [side,dx,dy,edge] of SIDES){
   if(owned.has((p.x+dx)+','+(p.y+dy)))continue;
   const [ax,ay,bx,by]=edge(p.x-left,p.y-top);
   const x1=ax*TILE,y1=ay*TILE,x2=bx*TILE,y2=by*TILE;
   const nx=-(y2-y1)/TILE,ny=(x2-x1)/TILE;
   const hash=hashString(map.seed+':boundary:'+id+':'+side)>>>0;
   const amplitude=(3+hash%4)*(hash&16?-1:1);
   ctx.beginPath();ctx.moveTo(x1,y1);
   ctx.bezierCurveTo(x1+(x2-x1)*.23+nx*amplitude,
      y1+(y2-y1)*.23+ny*amplitude,
      x1+(x2-x1)*.72-nx*amplitude*.62,
      y1+(y2-y1)*.72-ny*amplitude*.62,x2,y2);
   ctx.lineCap='round';ctx.lineJoin='round';
   // Saturated blue outer province stroke + luminous white/blue inner dashes.
   ctx.setLineDash([]);
   ctx.strokeStyle='rgba(19,58,119,.96)';ctx.lineWidth=10;
   ctx.shadowColor='rgba(28,115,249,.658)';ctx.shadowBlur=19;ctx.stroke();
   ctx.shadowBlur=0;
   ctx.strokeStyle='rgba(37,139,254,.679)';ctx.lineWidth=6;ctx.stroke();
   ctx.setLineDash([10,6]);ctx.lineDashOffset=0;
   ctx.strokeStyle='rgba(201,234,255,.672)';ctx.lineWidth=2.1;ctx.stroke();
   ctx.setLineDash([]);

   borderCount++;
  }
 }
 ctx.restore();
 canvas.dataset.glowingOwnedCells=String(glowCount);
 canvas.dataset.roadSegments=String(roadCount);
 canvas.dataset.borderSegments=String(borderCount);
}
export {drawKingdomOverlay};
