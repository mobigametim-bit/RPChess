import { PIECE_VALUES } from './roster-data.mjs';

// Canonical formation is stored in white-side coordinates. The skirmish
// deployment mirrors the same files to ranks 8/7 when playerColor is black.
const FILES='abcdefgh';
const FORMATION_SQUARES=Object.freeze(['1','2'].flatMap(rank=>[...FILES].map(file=>file+rank)));
const BOARD_CAPACITY=16,POINT_CAPACITY=39,PAWN_CAPACITY=8;
const PREFERRED={
  king:['e1'],queen:['d1'],rook:['a1','h1'],bishop:['c1','f1'],
  knight:['b1','g1'],pawn:[...FILES].map(file=>file+'2')
};
function eligible(c){return c?.status==='healthy'||Boolean(c?.isRunKing&&c?.status==='wounded');}
function cost(c){return PIECE_VALUES[c.pieceType]??c.commandCost??0;}
function acceptable(members,c){
  return members.length<BOARD_CAPACITY
    &&members.reduce((sum,p)=>sum+cost(p),0)+cost(c)<=POINT_CAPACITY
    &&(c.pieceType!=='pawn'||members.filter(p=>p.pieceType==='pawn').length<PAWN_CAPACITY)
    &&(c.isRunKing||c.pieceType!=='king');
}
function normalizedFormation(run){
  const roster=Array.isArray(run?.roster)?run.roster:[];
  const byId=new Map(roster.filter(eligible).map(c=>[c.id,c]));
  const persisted=run?.rosterFormation;
  const stored=persisted?.squares&&typeof persisted.squares==='object'?persisted.squares:{};
  const reserved=new Set((Array.isArray(persisted?.reserveIds)?persisted.reserveIds:[]).filter(id=>byId.has(id)&&!byId.get(id).isRunKing));
  const squares={};const selected=[];const seen=new Set();
  // Preserve every valid manually assigned square, unless the character is
  // wounded/dead, reserved, duplicated or outside combat power limits.
  for(const square of FORMATION_SQUARES){
    const id=stored[square],c=byId.get(id);
    if(!c||seen.has(id)||reserved.has(id)||!acceptable(selected,c))continue;
    squares[square]=id;selected.push(c);seen.add(id);
  }
  const king=roster.find(c=>c.isRunKing&&eligible(c));
  // The Run King is always on the board, even if older saves were malformed.
  if(king&&!seen.has(king.id)){
    let dest=!squares.e1?'e1':FORMATION_SQUARES.find(square=>!squares[square]);
    if(!dest){
      dest=FORMATION_SQUARES.find(square=>byId.get(squares[square])?.isRunKing!==true);
      if(dest){seen.delete(squares[dest]);selected.splice(selected.findIndex(c=>c.id===squares[dest]),1);}
    }
    if(dest){squares[dest]=king.id;seen.add(king.id);selected.push(king);}
  }
  for(const c of roster){
    if(!eligible(c)||c.isRunKing||seen.has(c.id)||reserved.has(c.id)||!acceptable(selected,c))continue;
    const choices=[...(PREFERRED[c.pieceType]||[]),...FORMATION_SQUARES];
    const dest=choices.find(square=>!squares[square]);
    if(!dest)continue;
    squares[dest]=c.id;selected.push(c);seen.add(c.id);
  }
  return {squares,reserveIds:[...reserved],members:selected,
    bench:roster.filter(c=>eligible(c)&&!seen.has(c.id)),
    wounded:roster.filter(c=>c.status==='wounded'&&!c.isRunKing),
    dead:roster.filter(c=>c.status==='dead')};
}
function placementForColor(square,color='w'){
  if(!FORMATION_SQUARES.includes(square))return null;
  return color==='b'?square[0]+(9-Number(square[1])):square;
}
function moveFormation(run,id,destination){
  const current=normalizedFormation(run),byId=new Map((run?.roster||[]).map(c=>[c.id,c]));
  const c=byId.get(id);
  if(!c||!eligible(c))return {ok:false,reason:'unavailable'};
  if(destination!==null&&!FORMATION_SQUARES.includes(destination))return {ok:false,reason:'invalid_square'};
  if(destination===null&&c.isRunKing)return {ok:false,reason:'king_required'};
  const squares={...current.squares},reserved=new Set(current.reserveIds);
  const source=Object.keys(squares).find(square=>squares[square]===id);
  if(destination===source)return {ok:true,run};
  const displaced=destination?squares[destination]:null;
  if(!source&&displaced&&byId.get(displaced)?.isRunKing)
    return {ok:false,reason:'king_required'};
  if(source)delete squares[source];
  if(destination){
    squares[destination]=id;reserved.delete(id);
    if(displaced&&displaced!==id){
      if(source)squares[source]=displaced;
      else reserved.add(displaced);
    }
  }else reserved.add(id);
  const chosen=Object.values(squares).map(key=>byId.get(key)).filter(Boolean);
  const valid=chosen.length>=2&&chosen.length<=BOARD_CAPACITY
    &&chosen.reduce((sum,p)=>sum+cost(p),0)<=POINT_CAPACITY
    &&chosen.filter(p=>p.pieceType==='pawn').length<=PAWN_CAPACITY;
  if(!valid)return {ok:false,reason:chosen.length<2?'minimum_force':'capacity'};
  return {ok:true,run:{...run,rosterFormation:{squares,reserveIds:[...reserved]}}};
}
function formationSelectedIds(run){return Object.values(normalizedFormation(run).squares);}
export {FORMATION_SQUARES,normalizedFormation,placementForColor,moveFormation,formationSelectedIds};
