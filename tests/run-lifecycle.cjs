const assert=require('assert'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');

class MemoryStorage{constructor(){this.map=new Map()}getItem(k){return this.map.has(k)?this.map.get(k):null}setItem(k,v){this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}}
class TestCustomEvent extends Event{constructor(type,{detail=null}={}){super(type);this.detail=detail}}

(async()=>{
  const root=path.resolve(__dirname,'..'),game=path.join(root,'game'),url=(relative)=>pathToFileURL(path.join(game,relative)).href;
  const storage=new MemoryStorage(),bus=new EventTarget();
  globalThis.localStorage=storage;
  globalThis.CustomEvent=TestCustomEvent;
  globalThis.addEventListener=bus.addEventListener.bind(bus);
  globalThis.removeEventListener=bus.removeEventListener.bind(bus);
  globalThis.dispatchEvent=bus.dispatchEvent.bind(bus);

  const persistence=await import(url('js/run-persistence.mjs'));
  let run=persistence.writeRun(persistence.createRun({now:1000,id:'lifecycle-contract'}),storage,1000);
  const completions=[];
  addEventListener('rpchess:combat-completed',(event)=>{
    completions.push(event.detail);
    // Derived consumers are allowed to persist/notify synchronously. The lifecycle bridge
    // must commit its snapshot before dispatch so this nested notification cannot replay.
    dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:'derived-consumer'}}));
  });

  const lifecycle=await import(`${url('js/run-lifecycle-events.mjs')}?contract=semantic-stability`);
  for(let index=1;index<=12;index++){
    if(index%2===1){
      const count=(run.battleCount||0)+1;
      run=persistence.writeRun({...run,battleCount:count,lastBattle:{result:'checkmate',winner:'w',playerColor:'w',encounterStars:1}},storage,1000+index);
    }else{
      const count=(run.skirmishCount||0)+1;
      run=persistence.writeRun({...run,skirmishCount:count,lastSkirmish:{result:'checkmate',winner:'w',playerColor:'w',encounterStars:1}},storage,1000+index);
    }
    dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:`loop-${index}`}}));
  }

  assert.strictEqual(completions.length,12,'12 combat transitions must emit exactly 12 semantic completion events');
  assert.deepStrictEqual(completions.map(({kind})=>kind),Array.from({length:12},(_,i)=>i%2===0?'battle':'skirmish'),'semantic combat kind must match the canonical counter transition');
  assert.deepStrictEqual(completions.filter(({kind})=>kind==='battle').map(({count})=>count),[1,2,3,4,5,6]);
  assert.deepStrictEqual(completions.filter(({kind})=>kind==='skirmish').map(({count})=>count),[1,2,3,4,5,6]);

  for(let index=0;index<10;index++)dispatchEvent(new CustomEvent('rpchess:run-updated',{detail:{source:'no-state-change'}}));
  assert.strictEqual(completions.length,12,'repeated run notifications without a state transition must not fan out semantic combat events');
  assert.strictEqual(lifecycle.default,undefined);
  assert.deepStrictEqual(globalThis.RPChessRunLifecycle.snapshot(),{
    runId:'lifecycle-contract',battleCount:6,skirmishCount:6,puzzleKey:null,puzzleResolved:false
  });

  const source=fs.readFileSync(path.join(game,'js/run-lifecycle-events.mjs'),'utf8');
  const events=fs.readFileSync(path.join(game,'js/events-app.mjs'),'utf8');
  const travel=fs.readFileSync(path.join(game,'js/travel-choice-app.mjs'),'utf8');
  const resources=fs.readFileSync(path.join(game,'js/resources-app.mjs'),'utf8');
  assert(source.includes("completed.push(['rpchess:puzzle-resolved'"),'lifecycle bridge must expose the queued semantic Puzzle completion path');
  assert(source.indexOf('previous = next;')<source.indexOf('for (const [name, detail] of completed) dispatch(name, detail)'),'bridge must commit its snapshot before notifying reentrant consumers');
  assert(events.includes("addEventListener('rpchess:combat-completed',syncRun)")&&!events.includes("addEventListener('rpchess:run-updated',syncRun)"),'Events combat completion must consume the semantic event only');
  assert(travel.includes("addEventListener('rpchess:combat-completed',syncCombatCompletion)")&&!travel.includes("addEventListener('rpchess:run-updated'"),'Travel combat-route cleanup must consume semantic completion and must not retain a broad run listener');
  assert(!travel.includes('RPChessPower?.settle?.(activeRun)'),'Travel must not duplicate Power settlement owned by the semantic Power runtime');
  assert(resources.includes("addEventListener('rpchess:combat-completed',syncCombatState)")&&resources.includes("addEventListener('rpchess:run-updated',scheduleRender)"),'Resources must split semantic settlement from its one justified render-only run projection');
  assert(!resources.includes("addEventListener('rpchess:run-updated',syncCombatState)"),'broad run updates must never settle or mutate combat rewards');
  console.log('Semantic run lifecycle 12-loop/reentrancy and journey-consumer ownership contract: PASS');
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1});
