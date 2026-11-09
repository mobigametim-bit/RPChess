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
 let roadCount=0;
 for(const road of map.completedRoads||[]){
  const a=parseTile(road.from),b=parseTile(road.to);
  if(!a||!b||!Number.isFinite(road.bend))continue;
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
  ctx.strokeStyle='rgba(57,41,25,.75)';ctx.lineWidth=12;ctx.stroke();
  ctx.strokeStyle='rgba(220,179,105,.85)';ctx.lineWidth=7;ctx.stroke();
  ctx.strokeStyle='rgba(250,226,164,.48)';ctx.lineWidth=2;ctx.stroke();
  roadCount++;
 }
 // Roads lie below sites and guards: remove their central footprint without
 // erasing the actual sprite (which is a separate DOM element).
 ctx.save();ctx.globalCompositeOperation='destination-out';
 for(const [id,cell] of Object.entries(cells)){
  if(!cell?.selectedEncounter)continue;
  const p=parseTile(id);if(!p)continue;
  const x=(p.x-left+.5)*TILE,y=(p.y-top+.5)*TILE;
  ctx.beginPath();ctx.arc(x,y,TILE*.33,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
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
   const amplitude=(9+hash%10)*(hash&16?-1:1);
   ctx.beginPath();ctx.moveTo(x1,y1);
   ctx.bezierCurveTo(x1+(x2-x1)*.23+nx*amplitude,
      y1+(y2-y1)*.23+ny*amplitude,
      x1+(x2-x1)*.72-nx*amplitude*.62,
      y1+(y2-y1)*.72-ny*amplitude*.62,x2,y2);
   ctx.lineCap='round';ctx.lineJoin='round';
   ctx.strokeStyle='rgba(39,26,15,.82)';ctx.lineWidth=7;ctx.stroke();
   ctx.strokeStyle='rgba(235,191,95,.94)';ctx.lineWidth=3;ctx.stroke();
   borderCount++;
  }
 }
 ctx.restore();
 canvas.dataset.roadSegments=String(roadCount);
 canvas.dataset.borderSegments=String(borderCount);
}
export {drawKingdomOverlay};
