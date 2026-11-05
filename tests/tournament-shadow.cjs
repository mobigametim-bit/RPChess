const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const {LocalShadowGame,SHADOW_SAVE_KEY,loadShadowGame,saveShadowGame,CLOCK_MS}=
   await import(pathToFileURL(path.join(__dirname,'../game/js/tournament-shadow-game.mjs')).href);
 const start=1_000_000;
 const noClock=new LocalShadowGame({mode:'unlimited',name:'Йо',commanderId:'pilgrim',
   race:'orcs',power:553,turnStartedAt:start});
 assert.equal(noClock.remainingFor('w',start+1_000_000),Infinity);
 assert.equal(noClock.move('e2','e4',null,start+1_000_000).ok,true);
 assert.equal(noClock.turn,'b');
 assert.equal(noClock.move('e7','e5',null,start+2_000_000).ok,true,
   'a shared device can play both colors without swapping account/session');
 assert.equal(noClock.turn,'w');
 assert.equal(noClock.snapshotWithoutTick().players[1].name,'Йо');
 assert.deepEqual(noClock.snapshotWithoutTick().players.map(x=>x.race),['orcs','orcs']);
 assert.deepEqual(noClock.snapshotWithoutTick().players.map(x=>x.commanderId),['pilgrim','pilgrim']);
 assert.equal(noClock.snapshotWithoutTick().rated,false);

 const timed=new LocalShadowGame({mode:'10+0',name:'Йо',turnStartedAt:start});
 assert.equal(timed.remainingFor('w',start+15000),CLOCK_MS-15000);
 assert.equal(timed.remainingFor('b',start+15000),CLOCK_MS);
 assert.equal(timed.move('e2','e4',null,start+15000).ok,true);
 assert.equal(timed.remainingFor('w',start+35000),CLOCK_MS-15000);
 assert.equal(timed.remainingFor('b',start+35000),CLOCK_MS-20000);
 assert.equal(timed.move('e7','e5',null,start+35000).ok,true);
 assert.equal(timed.remainingFor('b',start+80000),CLOCK_MS-20000,
   'the completed player clock stops on handoff');
 assert.equal(timed.turn,'w');
 assert.equal(timed.move('e2','e5',null,start+36000).ok,false,
   'illegal move must not pass');
 assert.equal(timed.moves.length,2);
 const saved=new Map();
 const storage={
  getItem:key=>saved.get(key)||null,
  setItem:(key,value)=>saved.set(key,value),
  removeItem:key=>saved.delete(key)
 };
 assert.equal(saveShadowGame(storage,timed),true);
 assert(saved.has(SHADOW_SAVE_KEY));
 const loaded=loadShadowGame(storage,start+35000);
 assert.equal(loaded?.turn,'w');
 assert.equal(loaded?.moves.length,2);
 assert.equal(loaded?.remaining.w,CLOCK_MS-15000);
 assert.equal(loaded?.remaining.b,CLOCK_MS-20000);
 loaded.tick(start+35000+CLOCK_MS-15000);
 assert.equal(loaded.status,'finished','clock expires even after reload or a background tab');
 assert.equal(loaded.result?.kind,'timeout');
 assert.equal(loaded.result?.winner,'b');
 assert.equal(loaded.move('g1','f3',null,start+CLOCK_MS+40000).ok,false,
   'no moves after flag');
 saveShadowGame(storage,loaded);
 assert.equal(saved.has(SHADOW_SAVE_KEY),false,'finished games cannot resume as live matches');

 const mated=new LocalShadowGame({mode:'unlimited',turnStartedAt:start});
 for(const [from,to] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']])
  assert.equal(mated.move(from,to,null,start+1).ok,true);
 assert.equal(mated.result?.kind,'checkmate');
 assert.equal(mated.result?.winner,'b');
 assert.equal(mated.status,'finished');
 assert.equal(mated.move('g1','f3').ok,false);
 assert.equal(LocalShadowGame.restore(mated.serialize(),{now:start+3})?.result?.winner,'b');
 const surrendered=new LocalShadowGame({turnStartedAt:start});
 assert.equal(surrendered.resign('w'),true);
 assert.deepEqual(surrendered.result,{kind:'resign',winner:'b'});
 const agreed=new LocalShadowGame({turnStartedAt:start});
 assert.equal(agreed.draw(),true);
 assert.deepEqual(agreed.result,{kind:'agreement',winner:null});
 assert.equal(agreed.draw(),false);
 assert.equal(LocalShadowGame.restore({...timed.serialize(),moves:[{from:'e2',to:'e5'}]}),null,
   'corrupted moves must never resume');
 assert.equal(LocalShadowGame.restore({...timed.serialize(),mode:'online'}),null);
 assert.equal(LocalShadowGame.restore({...timed.serialize(),remaining:{w:-1,b:0}}),null);
 console.log('TOURNAMENT SHADOW: offline hot-seat colors, ten-minute clocks, timeout, checkmate, draw, resign and replay persistence PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
