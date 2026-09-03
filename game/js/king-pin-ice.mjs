const FILES='abcdefgh';
const PIN_ICE_ASSETS=Object.freeze({full:'assets/vfx/pin_ice_full.png',partial:'assets/vfx/pin_ice_partial.png'});
const PIN_ICE_STYLE_ID='rpchess-king-pin-ice-style';
const DIRECTIONS=Object.freeze([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]);
let runtimeInstallQueued=false;

function fileOf(index){return index%8;}
function rankOf(index){return Math.floor(index/8);}
function inBounds(file,rank){return file>=0&&file<8&&rank>=0&&rank<8;}
function indexOf(file,rank){return rank*8+file;}
function squareToIndex(square){const raw=String(square||'');if(!/^[a-h][1-8]$/.test(raw))return-1;return indexOf(FILES.indexOf(raw[0]),Number(raw[1])-1);}
function indexToSquare(index){return `${FILES[fileOf(index)]}${rankOf(index)+1}`;}
function sliderSupports(piece,df,dr){if(!piece)return false;const diagonal=df!==0&&dr!==0;return piece.type==='q'||(diagonal&&piece.type==='b')||(!diagonal&&piece.type==='r');}

function addSlidingDestinations(board,from,color,directions,out){
  const ff=fileOf(from),fr=rankOf(from);
  for(const [df,dr] of directions){
    let file=ff+df,rank=fr+dr;
    while(inBounds(file,rank)){
      const to=indexOf(file,rank),target=board[to];
      if(!target)out.add(to);
      else{if(target.color!==color&&target.type!=='k')out.add(to);break;}
      file+=df;rank+=dr;
    }
  }
}

function pseudoDestinations(snapshot,from){
  const board=snapshot?.board;
  if(!Array.isArray(board)||board.length!==64)return new Set();
  const piece=board[from],out=new Set();
  if(!piece||piece.type==='k')return out;
  const file=fileOf(from),rank=rankOf(from);
  if(piece.type==='p'){
    const direction=piece.color==='w'?1:-1,startRank=piece.color==='w'?1:6;
    const oneRank=rank+direction;
    if(inBounds(file,oneRank)){
      const one=indexOf(file,oneRank);
      if(!board[one]){
        out.add(one);
        const twoRank=rank+direction*2;
        if(rank===startRank&&inBounds(file,twoRank)){
          const two=indexOf(file,twoRank);if(!board[two])out.add(two);
        }
      }
    }
    const ep=squareToIndex(snapshot?.enPassant);
    for(const df of[-1,1]){
      const tf=file+df,tr=rank+direction;if(!inBounds(tf,tr))continue;
      const to=indexOf(tf,tr),target=board[to];
      if(target&&target.color!==piece.color&&target.type!=='k')out.add(to);
      else if(to===ep){
        const captured=board[indexOf(tf,rank)];
        if(captured?.color!==piece.color&&captured?.type==='p')out.add(to);
      }
    }
  }else if(piece.type==='n'){
    for(const[df,dr]of[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]){
      const tf=file+df,tr=rank+dr;if(!inBounds(tf,tr))continue;
      const to=indexOf(tf,tr),target=board[to];if(!target||(target.color!==piece.color&&target.type!=='k'))out.add(to);
    }
  }else if(piece.type==='b')addSlidingDestinations(board,from,piece.color,[[1,1],[1,-1],[-1,1],[-1,-1]],out);
  else if(piece.type==='r')addSlidingDestinations(board,from,piece.color,[[1,0],[-1,0],[0,1],[0,-1]],out);
  else if(piece.type==='q')addSlidingDestinations(board,from,piece.color,DIRECTIONS,out);
  return out;
}

function classifyAbsolutePins(snapshot){
  const board=snapshot?.board;
  if(!Array.isArray(board)||board.length!==64)return Object.freeze([]);
  const pins=[];
  for(const color of['w','b']){
    const king=board.findIndex(piece=>piece?.color===color&&piece.type==='k');
    if(king<0)continue;
    const kingFile=fileOf(king),kingRank=rankOf(king);
    for(const[df,dr]of DIRECTIONS){
      let file=kingFile+df,rank=kingRank+dr,candidate=-1;
      while(inBounds(file,rank)){
        const index=indexOf(file,rank),piece=board[index];
        if(!piece){file+=df;rank+=dr;continue;}
        if(candidate<0){
          if(piece.color===color&&piece.type!=='k'){candidate=index;file+=df;rank+=dr;continue;}
          break;
        }
        if(piece.color===color)break;
        if(sliderSupports(piece,df,dr)){
          const ray=new Set();let rf=kingFile+df,rr=kingRank+dr;
          while(inBounds(rf,rr)){
            const ri=indexOf(rf,rr);ray.add(ri);if(ri===index)break;rf+=df;rr+=dr;
          }
          const destinations=pseudoDestinations(snapshot,candidate);
          const hasPinSafeMove=[...destinations].some(to=>ray.has(to));
          pins.push(Object.freeze({square:indexToSquare(candidate),color,piece:board[candidate].type,state:hasPinSafeMove?'partial':'full',pinner:indexToSquare(index)}));
        }
        break;
      }
    }
  }
  pins.sort((a,b)=>a.square.localeCompare(b.square));
  return Object.freeze(pins);
}

function installPinIceStyles(){
  if(typeof document==='undefined')return false;
  if(document.getElementById(PIN_ICE_STYLE_ID))return true;
  const style=document.createElement('style');style.id=PIN_ICE_STYLE_ID;
  style.textContent=`
.classic-pin-ice{position:absolute;z-index:3;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;opacity:.5;transform-origin:center;animation:rpchess-pin-ice-in 160ms ease-out both}
@keyframes rpchess-pin-ice-in{from{opacity:0;transform:scale(.92)}to{opacity:.5;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.classic-pin-ice{animation:none}}
`;
  document.head.append(style);return true;
}

function applyPinIce(board,snapshot){
  if(!board)return Object.freeze([]);
  installPinIceStyles();
  const pins=classifyAbsolutePins(snapshot),bySquare=new Map(pins.map(pin=>[pin.square,pin]));
  for(const cell of board.querySelectorAll('[data-square]')){
    const pin=bySquare.get(cell.dataset.square),existing=cell.querySelector(':scope > .classic-pin-ice');
    if(!pin){existing?.remove();delete cell.dataset.pinState;continue;}
    let overlay=existing;
    if(!overlay){overlay=document.createElement('img');overlay.alt='';overlay.draggable=false;overlay.setAttribute('aria-hidden','true');cell.append(overlay);}
    overlay.className=`classic-pin-ice classic-pin-ice--${pin.state}`;
    const source=PIN_ICE_ASSETS[pin.state];if(overlay.getAttribute('src')!==source)overlay.src=source;
    cell.dataset.pinState=pin.state;
  }
  return pins;
}

function queuePinIceRuntimeInstall(){
  if(typeof document==='undefined'||runtimeInstallQueued)return false;
  runtimeInstallQueued=true;let installed=false;
  const retry=()=>{if(installed)return;const ok=installPinIceRuntime();if(ok){installed=true;runtimeInstallQueued=false;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});
  for(const delay of[0,50,250,1000,2500])setTimeout(retry,delay);
  return true;
}

function installPinIceRuntime(){
  if(typeof document==='undefined')return false;
  const board=document.querySelector('[data-chess-board]'),api=globalThis.RPChessClassicChess;
  if(!board||!api?.snapshot){if(!runtimeInstallQueued)queuePinIceRuntimeInstall();return false;}
  if(board.__rpchessPinIceObserver)return true;
  installPinIceStyles();
  let scheduled=false;
  const apply=()=>{scheduled=false;applyPinIce(board,api.snapshot());};
  const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(apply);});
  observer.observe(board,{childList:true});
  Object.defineProperty(board,'__rpchessPinIceObserver',{value:observer,enumerable:false});
  apply();return true;
}

installPinIceRuntime();

export {PIN_ICE_ASSETS,PIN_ICE_STYLE_ID,pseudoDestinations,classifyAbsolutePins,installPinIceStyles,applyPinIce,queuePinIceRuntimeInstall,installPinIceRuntime};
