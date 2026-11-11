/* Decorative ownership perimeter and completed-event roads, for both map skins.
 * No gameplay mutations, no tile hitboxes, no leaks outside charted fog. */
import {PARCHMENT_TILE} from './kingdom-parchment-core.mjs';
import {hashString} from './race-assets.mjs';
import {visibleRoyalRoads,visibleTravelRoads} from './kingdom-road-network.mjs?v=20261111-polish-v1';
import {drawSandstoneRoad} from './kingdom-road-paving.mjs?v=20261110-graystone-v3';
import {VISUAL} from './kingdom-world-config.mjs?v=20261109-atlas-visual5';

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
// Enemy Battle sovereignty. The province is reserved in saves but the red
// ink and boundary never disclose cells that have not been explored.
function drawEnemyBattleTerritories(ctx,{map,view,columns,rows}){
 if(!ctx||!map||!view)return 0;
 const left=view.x-Math.floor(columns/2),top=view.y-Math.floor(rows/2);
 const red=new Set((map.battleTerritories||[]).flatMap(b=>b.cells||[])
  .filter(id=>map.cells?.[id]?.explored===true));
 if(!red.size)return 0;
 ctx.save();ctx.beginPath();
 for(const id of red){
  const p=parseTile(id);if(!p)continue;
  ctx.rect((p.x-left)*TILE,(p.y-top)*TILE,TILE,TILE);
 }
 ctx.fillStyle='rgba(215,42,48,.19)';ctx.fill();
 let borders=0;
 for(const id of red){
  const p=parseTile(id);if(!p)continue;
  if(p.x<left-2||p.x>left+columns+1||p.y<top-2||p.y>top+rows+1)continue;
  for(const [side,dx,dy,edge] of SIDES){
   if(red.has((p.x+dx)+','+(p.y+dy)))continue;
   const [ax,ay,bx,by]=edge(p.x-left,p.y-top);
   const x1=ax*TILE,y1=ay*TILE,x2=bx*TILE,y2=by*TILE;
   const hash=hashString(map.seed+':red-edge:'+id+':'+side)>>>0;
   const amplitude=(3+hash%4)*(hash&16?-1:1);
   const nx=-(y2-y1)/TILE,ny=(x2-x1)/TILE;
   ctx.beginPath();ctx.moveTo(x1,y1);
   ctx.bezierCurveTo(x1+(x2-x1)*.23+nx*amplitude,
    y1+(y2-y1)*.23+ny*amplitude,
    x1+(x2-x1)*.72-nx*amplitude*.62,
    y1+(y2-y1)*.72-ny*amplitude*.62,x2,y2);
   ctx.lineCap='round';ctx.lineJoin='round';
   ctx.strokeStyle='rgba(100,13,22,.99)';ctx.lineWidth=10;
   ctx.shadowColor='rgba(255,36,48,.9)';ctx.shadowBlur=19;ctx.stroke();
   ctx.shadowBlur=0;
   ctx.strokeStyle='rgba(231,44,62,.97)';ctx.lineWidth=6;ctx.stroke();
   ctx.setLineDash([10,6]);ctx.strokeStyle='rgba(255,205,203,.92)';
   ctx.lineWidth=2.1;ctx.stroke();ctx.setLineDash([]);
   borders++;
  }
 }
 ctx.restore();
 return borders;
}
// Drawn on the *terrain* layer in parchment mode, beside the natural roads.
// Unlike event roads, sovereignty strokes must stay beneath world landmarks.
function drawKingdomBoundary(ctx,{map,view,columns,rows}){
 if(!ctx||!map||!view)return 0;
 const left=view.x-Math.floor(columns/2),top=view.y-Math.floor(rows/2);
 const owned=new Set([...(map.centralOwnedCells||[]),
  ...(map.outposts||[]).flatMap(post=>post.cells||[]),
  ...Object.keys(map.cells||{}).filter(id=>map.cells[id]?.annexed),
  ...(map.battleConqueredCells||[])]);
 ctx.save();ctx.beginPath();
 for(const id of Object.keys(map.cells||{})){
  const p=parseTile(id);
  if(!p||p.x<left-2||p.x>left+columns+1||p.y<top-2||p.y>top+rows+1)continue;
  const x=(p.x-left+.5)*TILE,y=(p.y-top+.5)*TILE;
  ctx.moveTo(x+TILE*.71,y);ctx.arc(x,y,TILE*.71,0,Math.PI*2);
 }
 ctx.clip();
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
   ctx.shadowColor='rgba(28,115,249,.94)';ctx.shadowBlur=19;ctx.stroke();
   ctx.shadowBlur=0;
   ctx.strokeStyle='rgba(37,139,254,.97)';ctx.lineWidth=6;ctx.stroke();
   ctx.setLineDash([10,6]);ctx.lineDashOffset=0;
   ctx.strokeStyle='rgba(201,234,255,.96)';ctx.lineWidth=2.1;ctx.stroke();
   ctx.setLineDash([]);

   borderCount++;
  }
 }

 ctx.restore();
 return borderCount;
}

// Shared player-road painter: on parchment it runs on the SAME terrain
// canvas, at the same world-road opacity as naturally generated roads.
function drawKingdomRoads(ctx,{map,view,columns,rows,paint=true}){
 if(!ctx||!map||!view)return 0;
 const left=view.x-Math.floor(columns/2),top=view.y-Math.floor(rows/2);
 const width=columns*TILE,height=rows*TILE;
 let roadCount=0;
 const painted=new Set();
 const royalRoads=visibleRoyalRoads(map);
 const travelRoads=visibleTravelRoads(map);
 for(const road of [...travelRoads,...royalRoads]){
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
  const offset=road.bend*TILE;
  // Pale sandstone belongs inside the kingdom. Journey routes and
  // roads outside the border use curved gray stone on the same world graph.
  // Retain the approved 16px width and natural-road opacity.
  if(!paint){roadCount++;continue;}
  ctx.save();ctx.globalAlpha*=VISUAL.roadOpacity;
  if(drawSandstoneRoad(ctx,{x1,y1,x2,y2,bend:offset,id:road.id||identity,
     tone:road.kind==='travel'||road.surface==='gray'?'gray':'sandstone'}))
   roadCount++;
  ctx.restore();
 }

 return roadCount;
}

function drawKingdomOverlay(canvas,{map,view,columns,rows,drawBorder=true,drawRoads=true,resolution=1}){
 if(!canvas||!map||!view)return;
 const width=Math.round(columns*TILE),height=Math.round(rows*TILE);
 if(canvas.width!==Math.round(width*resolution))canvas.width=Math.round(width*resolution);
 if(canvas.height!==Math.round(height*resolution))canvas.height=Math.round(height*resolution);
 const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.setTransform(resolution,0,0,resolution,0,0);
 ctx.clearRect(0,0,width,height);
 const left=view.x-Math.floor(columns/2),top=view.y-Math.floor(rows/2);
 const cells=map.cells||{};
 const owned=new Set([...(map.centralOwnedCells||[]),
  ...(map.outposts||[]).flatMap(post=>post.cells||[]),
  ...Object.keys(cells).filter(id=>cells[id]?.annexed),
  ...(map.battleConqueredCells||[])]);
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
 // Only the flat blue territory tint becomes 30% dimmer again.
 // Radial halos and luminous province-border strokes keep original definition.
 // One continuous blue tint across all owned cells,
 // bright edge bloom and fine light dashes like painted province borders.
 // All operations remain inside scouted territory's clip.
 ctx.save();ctx.beginPath();
 for(const id of owned){
  const p=parseTile(id);if(!p)continue;
  ctx.rect((p.x-left)*TILE,(p.y-top)*TILE,TILE,TILE);
 }
 ctx.fillStyle='rgba(35,118,222,.1225)';ctx.fill();
 ctx.restore();
 ctx.save();
 let glowCount=0;
 for(const id of owned){
  const p=parseTile(id);if(!p)continue;
  const x=(p.x-left+.5)*TILE,y=(p.y-top+.5)*TILE;
  if(x<-TILE||y<-TILE||x>width+TILE||y>height+TILE)continue;
  const glow=ctx.createRadialGradient(x,y,TILE*.08,x,y,TILE*.76);
  glow.addColorStop(0,'rgba(49,151,255,.29)');
  glow.addColorStop(.56,'rgba(40,133,238,.16)');
  glow.addColorStop(1,'rgba(58,134,218,0)');
  ctx.fillStyle=glow;ctx.fillRect(x-TILE*.78,y-TILE*.78,TILE*1.56,TILE*1.56);
  glowCount++;
 }
 ctx.restore();
 const enemyBorderCount=drawEnemyBattleTerritories(ctx,{map,view,columns,rows});
 const roadCount=drawKingdomRoads(ctx,{map,view,columns,rows,paint:drawRoads});
 // The overlay is beneath all site and king art; never cut off the road
 // before its endpoint. Roads physically reach the tile centers.
 const borderCount=drawBorder?drawKingdomBoundary(ctx,{map,view,columns,rows}):0;
 ctx.restore();
 canvas.dataset.glowingOwnedCells=String(glowCount);
 canvas.dataset.roadSegments=String(roadCount);
 canvas.dataset.journeyRoadSegments=String(visibleTravelRoads(map).length);
 canvas.dataset.ownedRoadSegments=String(visibleRoyalRoads(map).length);
 canvas.dataset.borderSegments=String(borderCount);
 canvas.dataset.enemyBorderSegments=String(enemyBorderCount);
}
export {drawKingdomOverlay,drawKingdomBoundary,drawEnemyBattleTerritories,drawKingdomRoads};
