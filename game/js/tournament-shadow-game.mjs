/* Local hot-seat Tournament: two humans, one fixed-orientation chessboard.
 * Never sends moves or results to PvP, RPChess ID, D1, ratings or Arena.
 * Save only a replayable move list + clock anchors in the device's local store. */
import { ClassicChessEngine } from './classic-chess-engine.mjs';

const SHADOW_SAVE_KEY='rpchess.reboot.v1.tournament-shadow';
const SHADOW_VERSION=1;
const CLOCK_MS=600000;
const MAX_MOVES=1000;
const MODES=new Set(['unlimited','10+0']);
const COLORS=new Set(['w','b']);
function boundedName(value){
 return String(value||'Воин').trim().slice(0,24)||'Воин';
}
function validTime(value){return Number.isSafeInteger(value)&&value>=0&&value<=CLOCK_MS;}
function validateMoves(raw){
 return Array.isArray(raw)&&raw.length<=MAX_MOVES&&raw.every(move=>
  move&&typeof move.from==='string'&&/^[a-h][1-8]$/.test(move.from)
  &&typeof move.to==='string'&&/^[a-h][1-8]$/.test(move.to)
  &&(move.promotion==null||/^[qrbn]$/.test(move.promotion)));
}
class LocalShadowGame {
 constructor({mode='unlimited',name='Воин',commanderId='oathkeeper',race='humans',power=500,
   moves=[],remaining=null,turnStartedAt=Date.now(),terminal=null}={}){
  if(!MODES.has(mode)||!validateMoves(moves))throw Error('Invalid shadow match');
  this.mode=mode;this.name=boundedName(name);this.commanderId=commanderId;
  this.race=race;this.power=Number.isFinite(power)?Math.max(0,Math.floor(power)):500;
  this.chess=new ClassicChessEngine();this.moves=[];
  this.remaining=mode==='10+0'?
   remaining==null?{w:CLOCK_MS,b:CLOCK_MS}:
    validTime(remaining.w)&&validTime(remaining.b)?{w:remaining.w,b:remaining.b}:null
   :{w:null,b:null};
  if(!this.remaining)throw Error('Invalid shadow clock');
  if(!Number.isSafeInteger(turnStartedAt)||turnStartedAt<0)throw Error('Invalid clock anchor');
  this.turnStartedAt=turnStartedAt;this.status='playing';this.result=null;
  for(const move of moves){
   if(this.status!=='playing')throw Error('Moves after finished shadow game');
   const result=this.chess.move(move.from,move.to,move.promotion||null);
   if(!result.ok)throw Error('Corrupt shadow move history');
   this.moves.push({from:move.from,to:move.to,...(move.promotion?{promotion:move.promotion}:{})});
   if(result.status.over)this.finish(result.status.type,result.status.winner);
  }
  if(terminal){
   if(terminal.kind==='timeout'&&COLORS.has(terminal.winner)&&mode==='10+0')
    this.finish('timeout',terminal.winner);
   else if(terminal.kind==='resign'&&COLORS.has(terminal.winner))
    this.finish('resign',terminal.winner);
   else if(terminal.kind==='agreement'&&terminal.winner===null)
    this.finish('agreement',null);
   else if(!this.result||terminal.kind!==this.result.kind||terminal.winner!==this.result.winner)
    throw Error('Invalid shadow terminal result');
  }
 }
 get turn(){return this.chess.turn();}
 get isTimed(){return this.mode==='10+0';}
 finish(kind,winner){
  if(this.status==='finished')return;
  this.status='finished';this.result={kind,winner};
 }
 remainingFor(color,now=Date.now()){
  if(!this.isTimed)return Infinity;
  const used=this.status==='playing'&&this.turn===color
   ?Math.max(0,now-this.turnStartedAt):0;
  return Math.max(0,this.remaining[color]-used);
 }
 tick(now=Date.now()){
  if(this.isTimed&&this.status==='playing'&&this.remainingFor(this.turn,now)<=0){
   this.remaining[this.turn]=0;
   this.finish('timeout',this.turn==='w'?'b':'w');
  }
  return this.snapshotWithoutTick(now);
 }
 snapshotWithoutTick(now=Date.now()){
  return {
   shadow:true,status:this.status,mode:this.mode,playerColor:'w',turn:this.turn,
   players:[
    {name:this.name,color:'w',race:this.race,commanderId:this.commanderId,displayPower:this.power,power:500},
    {name:this.name,color:'b',race:this.race,commanderId:this.commanderId,displayPower:this.power,power:500}
   ],
   remaining:{w:this.remainingFor('w',now),b:this.remainingFor('b',now)},
   moves:this.moves.map(move=>({...move})),
   result:this.result?{...this.result}:null,rated:false
  };
 }
 move(from,to,promotion=null,now=Date.now()){
  this.tick(now);
  if(this.status!=='playing')return {ok:false,reason:'finished'};
  const turn=this.turn,clock=this.remainingFor(turn,now);
  const result=this.chess.move(from,to,promotion);
  if(!result.ok)return result;
  if(this.isTimed)this.remaining[turn]=clock;
  this.turnStartedAt=now;
  this.moves.push({from,to,...(promotion?{promotion}:{})});
  if(result.status.over)this.finish(result.status.type,result.status.winner);
  return result;
 }
 resign(color=this.turn,now=Date.now()){
  this.tick(now);
  if(this.status!=='playing'||!COLORS.has(color))return false;
  this.finish('resign',color==='w'?'b':'w');return true;
 }
 draw(now=Date.now()){
  this.tick(now);
  if(this.status!=='playing')return false;
  this.finish('agreement',null);return true;
 }
 serialize(){
  return {version:SHADOW_VERSION,mode:this.mode,name:this.name,
    commanderId:this.commanderId,race:this.race,power:this.power,
    moves:this.moves.map(move=>({...move})),remaining:{...this.remaining},
    turnStartedAt:this.turnStartedAt,...(this.result?{terminal:{...this.result}}:{})};
 }
 static restore(raw,{now=Date.now()}={}){
  if(!raw||raw.version!==SHADOW_VERSION)return null;
  try{
   const game=new LocalShadowGame(raw);
   game.tick(now);
   return game;
  }catch{return null;}
 }
}
function loadShadowGame(storage,now=Date.now()){
 try{
  const raw=storage?.getItem(SHADOW_SAVE_KEY);
  return raw?LocalShadowGame.restore(JSON.parse(raw),{now}):null;
 }catch{return null;}
}
function saveShadowGame(storage,game){
 try{
  if(!storage)return false;
  if(!game||game.status==='finished')storage.removeItem(SHADOW_SAVE_KEY);
  else storage.setItem(SHADOW_SAVE_KEY,JSON.stringify(game.serialize()));
  return true;
 }catch{return false;}
}
export {LocalShadowGame,SHADOW_SAVE_KEY,CLOCK_MS,loadShadowGame,saveShadowGame};
