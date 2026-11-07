/* Tactical evidence from a REPLAYED Stockfish PV, never from unverified text.
 * Events in a principal variation are examples, not claims that every reply is forced.
 * Do not include the best alternative BEFORE the player's mistake.
 */
import { ClassicChessEngine } from './classic-chess-engine.mjs';
import { classifyAbsolutePins } from './king-pin-ice.mjs';

const FILES='abcdefgh';
const VALUES={p:1,n:3,b:3,r:5,q:9,k:0};
const FORK_TARGETS=new Set(['n','b','r','q','k']);
const MAX_PV=20;
function opposite(color){return color==='w'?'b':'w';}
function coord(square){return {f:FILES.indexOf(square[0]),r:Number(square[1])-1};}
function attacks(board,from,to){
 const attacker=board.pieceAt(from),target=board.pieceAt(to);
 if(!attacker||!target||attacker.color===target.color||from===to)return false;
 const a=coord(from),b=coord(to),dx=b.f-a.f,dy=b.r-a.r;
 if(attacker.type==='n')return Math.abs(dx)*Math.abs(dy)===2;
 if(attacker.type==='p')return Math.abs(dx)===1&&dy===(attacker.color==='w'?1:-1);
 if(attacker.type==='k')return Math.max(Math.abs(dx),Math.abs(dy))===1;
 const diag=Math.abs(dx)===Math.abs(dy),orth=(dx===0||dy===0);
 if(!diag&&!orth)return false;
 if(attacker.type==='b'&&!diag||attacker.type==='r'&&!orth||
    !['b','r','q'].includes(attacker.type))return false;
 const sf=Math.sign(dx),sr=Math.sign(dy);
 for(let f=a.f+sf,r=a.r+sr;f!==b.f||r!==b.r;f+=sf,r+=sr){
  if(board.pieceAt(FILES[f]+(r+1)))return false;
 }
 return true;
}
function forkTargets(board,at,color){
 const attacked=[];
 for(let rank=1;rank<=8;rank++)for(const file of FILES){
  const target=file+rank,p=board.pieceAt(target);
  if(p&&p.color!==color&&FORK_TARGETS.has(p.type)&&attacks(board,at,target))
   attacked.push({square:target,type:p.type});
 }
 return attacked;
}

function piecesOn(board,color){
 const result=[];
 for(let rank=1;rank<=8;rank++)for(const file of FILES){
  const at=file+rank,p=board.pieceAt(at);
  if(p?.color===color)result.push({at,p});
 }
 return result;
}
function defenders(board,square,color){
 return piecesOn(board,color).filter(({at})=>at!==square&&attacks(board,at,square));
}
function pawnPassed(board,square,color){
 const p=coord(square);
 for(const {at,p:enemy} of piecesOn(board,opposite(color))){
  if(enemy.type!=='p')continue;
  const e=coord(at);
  if(Math.abs(e.f-p.f)<=1&&(color==='w'?e.r>p.r:e.r<p.r))return false;
 }
 return true;
}
function slidingAttacks(board,color){
 const result=[];
 for(const {at,p} of piecesOn(board,color)){
  if(!['b','r','q'].includes(p.type))continue;
  for(const {at:target,p:victim} of piecesOn(board,opposite(color))){
   if(attacks(board,at,target))result.push({from:at,to:target,piece:p.type,target:victim.type});
  }
 }
 return result;
}
function skewerPatterns(board,at,color){
 const attacker=board.pieceAt(at);
 if(!['r','b','q'].includes(attacker?.type))return [];
 const origin=coord(at),patterns=[];
 const directions=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
 for(const [df,dr] of directions){
  if(attacker.type==='r'&&df&&dr||attacker.type==='b'&&(!df||!dr))continue;
  let first=null,f=origin.f+df,r=origin.r+dr;
  while(f>=0&&f<8&&r>=0&&r<8){
   const sq=FILES[f]+(r+1),piece=board.pieceAt(sq);
   if(piece){
    if(piece.color===color)break;
    if(!first)first={square:sq,piece};
    else {
     if(first.piece.type==='k'||VALUES[first.piece.type]>VALUES[piece.type])
      patterns.push({front:first.square,back:sq,frontType:first.piece.type,backType:piece.type});
     break;
    }
   }
   f+=df;r+=dr;
  }
 }
 return patterns;
}
function tacticalEvidence(fen,pv,player,maxPlies=MAX_PV){
 if(!['w','b'].includes(player))throw Error('invalid_color');
 const board=new ClassicChessEngine(fen),legal=[],events=[];
 let valueDiff=0,biggestLoss=null;
 const limit=Math.min(MAX_PV,Math.max(1,Math.floor(maxPlies)));
 for(const raw of Array.isArray(pv)?pv.slice(0,limit):[]){
  if(typeof raw!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(raw))break;
  const from=raw.slice(0,2),to=raw.slice(2,4),promote=raw.slice(4)||null;
  const mover=board.turn(),moving=board.pieceAt(from);
  const proposed=board.legalMoves(from).find(m=>m.to===to&&(!m.promotion||m.promotion===promote));
  if(!proposed||!moving)break;
  const capture=proposed.capture?board.pieceAt(proposed.capture):null;
  const before=new ClassicChessEngine(board.fen()); // Immutable pre-move position for fact checks.
  const beforePins=mover!==player?classifyAbsolutePins(before.snapshot()).filter(p=>p.color===player):[];
  const beforeFork=mover!==player?forkTargets(before,from,mover):[];
  const beforeRays=mover!==player?slidingAttacks(before,mover):[];
  const victimGuards=capture&&mover!==player
   ?piecesOn(before,player).filter(({at,p})=>at!==proposed.capture&&p.type!=='k'&&attacks(before,proposed.capture,at))
   :[];
  const result=board.move(from,to,promote);
  if(!result.ok)break;
  legal.push(raw);
  const ply=legal.length,common={ply,from,to,piece:moving.type};
  if(capture){
   const swing=VALUES[capture.type]||0;
   valueDiff+=mover===player?-swing:swing;
   if(mover!==player&&(!biggestLoss||swing>biggestLoss.value))
    biggestLoss={...common,value:swing,piece:capture.type};
  }
  if(mover!==player){
   const king=piecesOn(board,player).find(({p})=>p.type==='k')?.at;
   const kingAttackers=king?piecesOn(board,mover).filter(({at})=>attacks(board,at,king)):[];
   if(result.status.type==='checkmate'&&result.status.winner===mover){
    events.push({...common,kind:'mate_sequence',targetSquares:king?[king]:[]});
    if(king&&to[1]===king[1]&&(player==='w'?king[1]==='1':king[1]==='8')&&['r','q'].includes(moving.type)&&attacks(board,to,king))
     events.push({...common,kind:'back_rank_mate',targetSquares:[king]});
   }else if(result.status.checked){
    events.push({...common,kind:'check',targetSquares:king?[king]:[]});
    if(kingAttackers.length>=2)events.push({...common,kind:'double_check',targetSquares:king?[king]:[]});
   }
   if(['n','b','r','q','p'].includes(moving.type)){
    const targets=forkTargets(board,to,mover);
    if(targets.length>=2&&beforeFork.length<2)
     events.push({...common,kind:'fork',targets:targets.map(t=>t.type).slice(0,3),targetSquares:targets.map(t=>t.square).slice(0,3)});
   }
   const afterPins=classifyAbsolutePins(board.snapshot()).filter(p=>p.color===player);
   for(const pin of afterPins){
    if(!beforePins.some(prev=>prev.square===pin.square&&prev.pinner===pin.pinner))
     events.push({...common,kind:'pin',piece:pin.piece,pinner:board.pieceAt(pin.pinner)?.type||null,
      attackerSquare:pin.pinner,targetSquares:[pin.square]});
   }
   const afterRays=slidingAttacks(board,mover);
   const opened=afterRays.filter(ray=>!beforeRays.some(old=>old.from===ray.from&&old.to===ray.to)&&
      before.pieceAt(from)?.color===mover&&ray.from!==to&&ray.from!==from);
   // After an opponent moves away, a different stationary slider can now attack.
   for(const ray of opened){
    if(!attacks(before,ray.from,ray.to))
     events.push({...common,kind:ray.target==='k'&&result.status.checked?'discovered_check':'discovered_attack',
      attackerSquare:ray.from,targetSquares:[ray.to],target:ray.target});
   }
   if(capture?.color===player){
    events.push({...common,kind:'capture',piece:capture.type,targetSquares:[proposed.capture]});
    if(!defenders(before,proposed.capture,player).length)
     events.push({...common,kind:'undefended_capture',piece:capture.type,targetSquares:[proposed.capture]});
   }
   const exposed=victimGuards.filter(({at})=>board.pieceAt(at)?.color===player&&
      !defenders(board,at,player).length&&
      piecesOn(board,mover).some(({at:enemy})=>attacks(board,enemy,at)));
   if(exposed.length){
    const targets=exposed.map(({at})=>at);
    events.push({...common,kind:exposed.length>=2?'overloaded_defender':'removed_defender',
      targetSquares:targets,targets:exposed.map(({p})=>p.type)});
   }
   if(proposed.capture&&proposed.capture!==to)events.push({...common,kind:'en_passant',targetSquares:[proposed.capture]});
   if(promote)events.push({...common,kind:'promotion',promotion:promote,targetSquares:[to]});
   if(moving.type==='p'&&!promote&&(mover==='w'?Number(to[1])===7:Number(to[1])===2)&&pawnPassed(board,to,mover))
    events.push({...common,kind:'advanced_passed_pawn',targetSquares:[to]});
   for(const pattern of skewerPatterns(board,to,mover))
    events.push({...common,kind:'skewer_pattern',targetSquares:[pattern.front,pattern.back],
      targets:[pattern.frontType,pattern.backType]});
   // A move to a previously empty square can obstruct an opponent's active sliding line.
   if(!before.pieceAt(to)){
    const lost=slidingAttacks(before,player).find(old=>board.pieceAt(old.from)?.color===player&&
       board.pieceAt(old.to)?.color===mover&&!attacks(board,old.from,old.to));
    if(lost)events.push({...common,kind:'interference',targetSquares:[lost.from,lost.to]});
   }
  }
  if(result.status.over)break;
 }
 if(legal.length&&valueDiff>=1&&biggestLoss)
  events.push({...biggestLoss,kind:'material_loss',net:valueDiff,targetSquares:[biggestLoss.to]});
 // One validated example for each family; never claim a single PV is forced.
 const unique=[],seen=new Set();
 for(const event of events){
  if(seen.has(event.kind))continue;
  seen.add(event.kind);unique.push(event);
 }
 return {line:legal,events:unique.slice(0,24),netMaterialLoss:Math.max(0,valueDiff)};
}

export {tacticalEvidence,attacks,forkTargets,MAX_PV};
