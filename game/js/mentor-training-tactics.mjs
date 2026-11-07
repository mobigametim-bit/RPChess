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
function tacticalEvidence(fen,pv,player,maxPlies=MAX_PV){
 if(!['w','b'].includes(player))throw Error('invalid_color');
 const board=new ClassicChessEngine(fen);
 const legal=[],events=[];
 let valueDiff=0,biggestLoss=null;
 const limit=Math.min(MAX_PV,Math.max(1,Math.floor(maxPlies)));
 for(const raw of Array.isArray(pv)?pv.slice(0,limit):[]){
  if(typeof raw!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(raw))break;
  const from=raw.slice(0,2),to=raw.slice(2,4),promote=raw.slice(4)||null;
  const mover=board.turn(),moving=board.pieceAt(from);
  const proposed=board.legalMoves(from).find(m=>m.to===to&&(!m.promotion||m.promotion===promote));
  if(!proposed||!moving)break;
  const capture=proposed.capture?board.pieceAt(proposed.capture):null;
  const beforePins=mover!==player?classifyAbsolutePins(board.snapshot()).filter(p=>p.color===player):[];
  const beforeForkTargets=mover!==player?forkTargets(board,from,mover):[];
  const played=board.move(from,to,promote);
  if(!played.ok)break;
  legal.push(raw);
  const ply=legal.length;
  if(capture){
   const swing=VALUES[capture.type]||0;
   valueDiff+=mover===player?-swing:swing;
   if(mover!==player&&(!biggestLoss||swing>biggestLoss.value))
    biggestLoss={ply,piece:capture.type,value:swing};
  }
  // Facts are about punishments by the opponent, not a success for the learner.
  if(mover!==player){
   if(played.status.type==='checkmate'&&played.status.winner===mover)
    events.push({kind:'mate_sequence',ply});
   else if(played.status.checked)
    events.push({kind:'check',ply});
   if(['n','b','r','q','p'].includes(moving.type)){
    const targets=forkTargets(board,to,mover);
    // New double attack on important pieces. For a pawn/slider this is
    // only an observed double attack, not proof that material must be won.
    if(targets.length>=2&&beforeForkTargets.length<2)
     events.push({kind:'fork',ply,piece:moving.type,
      targets:targets.map(t=>t.type).slice(0,3)});
   }
   const afterPins=classifyAbsolutePins(board.snapshot()).filter(p=>p.color===player);
   for(const pin of afterPins){
    if(!beforePins.some(prev=>prev.square===pin.square&&prev.pinner===pin.pinner))
     events.push({kind:'pin',ply,piece:pin.piece,pinner:board.pieceAt(pin.pinner)?.type||null});
   }
  }
  if(played.status.over)break;
 }
 if(legal.length&&valueDiff>=1&&biggestLoss)
  events.push({kind:'material_loss',ply:biggestLoss.ply,piece:biggestLoss.piece,net:valueDiff});
 // Avoid an implausibly long list of duplicate checks/pins/forks in model context.
 const unique=[],seen=new Set();
 for(const event of events){
  if(seen.has(event.kind))continue;
  seen.add(event.kind);unique.push(event);
 }
 return {line:legal,events:unique.slice(0,7),netMaterialLoss:Math.max(0,valueDiff)};
}
export {tacticalEvidence,attacks,forkTargets,MAX_PV};
