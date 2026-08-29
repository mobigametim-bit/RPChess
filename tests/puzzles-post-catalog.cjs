const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
function memoryStorage(){const data=new Map();return{getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)}}
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const catalogModule=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const persistence=await import(pathToFileURL(path.join(game,'js/run-persistence.mjs')).href);
  const {ClassicChessEngine}=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href);
  const catalog=catalogModule.PUZZLE_CATALOG;
  const mate1=catalog.find(p=>p.type==='mate1');
  const mateEngine=new ClassicChessEngine(mate1.fen);
  const legalMates=mateEngine.legalMoves().filter(move=>{const test=new ClassicChessEngine(mate1.fen);const result=test.move(move.from,move.to,move.promotion);return result.ok&&result.status.type==='checkmate'&&result.status.winner===mate1.side;});
  assert(legalMates.length>=1,'mate1 must expose at least one legal mating move');
  for(let stars=1;stars<=12;stars++){
    const args={runId:'stable',routeId:`route-${stars}`,stars,week:(stars-1)*8+1};
    const a=core.selectPuzzle(catalog,args),b=core.selectPuzzle(catalog,args);
    assert.strictEqual(a.id,b.id,'selection must be deterministic');
    assert.strictEqual(a.difficulty,stars,'selection should stay in current star pool when available');
  }
  const rewardPuzzle=catalog.find(p=>p.difficulty===5) || catalog[0];
  const baseRun=persistence.createRun({id:'puzzle-reward-run',now:100});
  const activeChoice={id:'travel.puzzle.reward',step:33,type:'puzzle',label:'ЗАДАЧА',stars:5,threatLabel:'СЛОЖНОСТЬ ★5',flavor:'Задача.',mechanicalHint:'Шахматная задача с конкретной целью.',seed:'puzzle-reward-seed',supplyCostAtSelection:1,supplyPaid:1};
  const initialState=core.createPuzzleState({puzzle:rewardPuzzle,routeId:activeChoice.id,stars:5,week:33});
  const solvedState=core.resolvedPuzzleState({...initialState,errors:1},'solved');
  const firstSettlement=core.applyPuzzleReward({...baseRun,journeyStep:33,activeTravelChoice:activeChoice,currentPuzzle:solvedState},solvedState);
  assert.strictEqual(firstSettlement.changed,true);assert.strictEqual(firstSettlement.reward,17);assert.strictEqual(firstSettlement.state.rewardSettled,true);assert.strictEqual(firstSettlement.run.gold,baseRun.gold+17);
  const secondSettlement=core.applyPuzzleReward(firstSettlement.run,firstSettlement.state);
  assert.strictEqual(secondSettlement.changed,false);assert.strictEqual(secondSettlement.reward,0);assert.strictEqual(secondSettlement.run.gold,firstSettlement.run.gold,'reward settlement must be idempotent');
  const storage=memoryStorage();persistence.writeRun(firstSettlement.run,storage,200);const reloaded=persistence.readRun(storage);assert(reloaded);assert.strictEqual(reloaded.currentPuzzle.rewardSettled,true);assert.strictEqual(reloaded.currentPuzzle.result,'solved');assert.strictEqual(reloaded.gold,firstSettlement.run.gold);
  const appSource=fs.readFileSync(path.join(game,'js/puzzles/puzzle-app.mjs'),'utf8');
  assert(appSource.includes("rpchess:puzzle-open"));
  assert(!/hint/i.test(appSource),'Puzzles v1 must not introduce hint UI/mechanics');
  assert(appSource.includes("'Неверный ход'"));
  assert(/errors\s*>=\s*3/.test(appSource));
  assert(appSource.includes('rewardSettled'));
  assert(appSource.includes('resumeSession')&&appSource.includes('playForcedReply'),'reload during persisted opponent reply must self-resume');
  assert(appSource.includes('Восстанавливаем ответ соперника…'));
  console.log('Puzzles post-catalog selection/reward/persistence/runtime contracts: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
