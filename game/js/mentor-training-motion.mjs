/* Mentor training uses Tournament/Classic's 290ms flyer and 240ms capture fade.
 * The flight remains valid across a feedback-only DOM render; game state is authoritative.
 */
const movingSelector=()=>document.documentElement.dataset.simplePieces==='1'?'.rpchess-fantasy-piece':'.classic-piece';
const reducedMotion=()=>document.documentElement.dataset.reducedMotion==='1'||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function createMentorMotion(root){
 let flyer=null,captured=null,animation=null,active=null,serial=0;
 function clear(){
  serial++;
  animation?.cancel();animation=null;flyer?.remove();flyer=null;captured?.remove();captured=null;
  root.querySelectorAll('.mentor-piece--arriving').forEach(el=>el.classList.remove('mentor-piece--arriving'));
  active=null;
 }
 function capture(chess,uci){
  if(!uci||typeof Element.prototype.animate!=='function'||reducedMotion())return null;
  const board=root.querySelector('.mentor-board');
  const from=uci.slice(0,2),to=uci.slice(2,4);
  const candidate=chess.legalMoves(from).find(m=>m.to===to&&(!m.promotion||m.promotion===uci.slice(4)));
  // Castling changes two figures simultaneously; the standard repaint is safer.
  if(!candidate||candidate.castle||!board)return null;
  const selector=movingSelector();
  const origin=board.querySelector('[data-square="'+from+'"] '+selector);
  const target=board.querySelector('[data-square="'+to+'"]');
  const capturedAt=candidate.capture||to;
  const taken=board.querySelector('[data-square="'+capturedAt+'"] '+selector);
  if(!origin||!target)return null;
  return {
   from,to,selector,src:origin.getAttribute('src'),
   origin:origin.getBoundingClientRect(),target:target.getBoundingClientRect(),
   capturedSrc:candidate.capture?taken?.getAttribute('src'):null,
   capturedRect:candidate.capture?taken?.getBoundingClientRect():null
  };
 }
 function markArrival(){
  if(!active)return;
  const arrived=root.querySelector('.mentor-board [data-square="'+active.to+'"] '+active.selector);
  arrived?.classList.add('mentor-piece--arriving');
 }
 function play(geometry){
  clear();
  if(!geometry)return;
  active=geometry;
  markArrival();
  const arrival=root.querySelector('.mentor-board [data-square="'+geometry.to+'"] '+geometry.selector)?.getBoundingClientRect();
  const left=arrival?.left??geometry.target.left+(geometry.target.width-geometry.origin.width)/2;
  const top=arrival?.top??geometry.target.top+(geometry.target.height-geometry.origin.height)/2;
  flyer=document.createElement('img');
  flyer.className='classic-piece-flyer mentor-flight';
  flyer.alt='';flyer.draggable=false;flyer.src=geometry.src;
  Object.assign(flyer.style,{
   left:geometry.origin.left+'px',top:geometry.origin.top+'px',
   width:geometry.origin.width+'px',height:geometry.origin.height+'px'
  });
  document.body.append(flyer);
  if(geometry.capturedSrc&&geometry.capturedRect){
   captured=document.createElement('img');captured.className='classic-captured-ghost mentor-capture';
   captured.src=geometry.capturedSrc;captured.alt='';captured.draggable=false;
   Object.assign(captured.style,{
    left:geometry.capturedRect.left+'px',top:geometry.capturedRect.top+'px',
    width:geometry.capturedRect.width+'px',height:geometry.capturedRect.height+'px'
   });
   document.body.append(captured);
   captured.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.72)'}],
    {duration:240,easing:'ease-out',fill:'forwards'}).finished.catch(()=>{});
  }
  const stamp=++serial;
  animation=flyer.animate([
   {transform:'translate3d(0,0,0) scale(1)'},
   {transform:'translate3d('+(left-geometry.origin.left)+'px,'+(top-geometry.origin.top)+'px,0) scale(1.025)'}
  ],{duration:290,easing:'cubic-bezier(.22,.8,.24,1)',fill:'forwards'});
  animation.finished.catch(()=>{}).finally(()=>{if(stamp===serial)clear();});
 }
 return {capture,play,clear,markArrival};
}
export {createMentorMotion};