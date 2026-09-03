const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
class MemoryStorage{constructor(){this.map=new Map()}getItem(k){return this.map.has(k)?this.map.get(k):null}setItem(k,v){this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}}
(async()=>{
  const game=path.resolve(__dirname,'..','game'),url=(relative)=>pathToFileURL(path.join(game,relative)).href;
  const persistence=await import(url('js/run-persistence.mjs'));
  const endless=await import(url('js/endless-run-core.mjs'));
  const rating=await import(url('js/player-rating.mjs'));
  const settlement=await import(url('js/settlement-core.mjs'));
  const storage=new MemoryStorage();

  let run=persistence.writeRun(persistence.createRun({now:1000,id:'endless-run-test'}),storage,1000);
  assert.deepStrictEqual(run.runStats,{goldEarned:0,skirmishWins:0,battleWins:0,puzzlesSolved:0,eventsResolved:0});

  run=persistence.writeRun({...run,skirmishCount:1,lastSkirmish:{result:'checkmate',winner:'w',playerColor:'w'}},storage,1100);
  assert.strictEqual(run.runStats.skirmishWins,1);
  run=persistence.writeRun({...run},storage,1150);
  assert.strictEqual(run.runStats.skirmishWins,1,'re-saving the same completed Skirmish must not double count');

  run=persistence.writeRun({...run,battleCount:1,lastBattle:{result:'checkmate',winner:'b',playerColor:'w'}},storage,1200);
  assert.strictEqual(run.runStats.battleWins,0,'Battle loss must not count as a win');
  run=persistence.writeRun({...run,battleCount:2,lastBattle:{result:'checkmate',winner:'w',playerColor:'w'}},storage,1250);
  assert.strictEqual(run.runStats.battleWins,1);

  run=persistence.writeRun({...run,gold:run.gold+33},storage,1300);
  assert.strictEqual(run.runStats.goldEarned,33);
  run=persistence.writeRun({...run,gold:run.gold-12},storage,1350);
  assert.strictEqual(run.runStats.goldEarned,33,'spending Gold must not reduce earned Gold');

  run=persistence.writeRun({...run,currentEvent:{routeId:'event-route-1',eventId:'event_001',resolved:true}},storage,1400);
  assert.strictEqual(run.runStats.eventsResolved,1);
  run=persistence.writeRun({...run,currentEvent:{...run.currentEvent}},storage,1450);
  assert.strictEqual(run.runStats.eventsResolved,1,'resolved Event must be counted once');

  run=persistence.writeRun({...run,lastPuzzle:{puzzleId:'lichess.test',routeId:'puzzle-route-1',result:'solved',errors:1,goldReward:12}},storage,1500);
  assert.strictEqual(run.runStats.puzzlesSolved,1);
  run=persistence.writeRun({...run,lastPuzzle:{...run.lastPuzzle}},storage,1550);
  assert.strictEqual(run.runStats.puzzlesSolved,1,'solved Puzzle must be counted once');

  const recruit=settlement.recruitProfile('hero.lady_sorn');
  assert(recruit,'test recruit must exist');
  run=persistence.writeRun({...run,roster:[...run.roster,{...recruit,status:'healthy',isRunKing:false}],journeyStep:17},storage,1600);
  run=persistence.writeRun({...run,ended:true,endReason:'starvation_king'},storage,1650);
  const summary=endless.summarizeRun(run,{power:777});
  assert.strictEqual(summary.weeks,17);
  assert.strictEqual(summary.goldEarned,33);
  assert.strictEqual(summary.skirmishWins,1);
  assert.strictEqual(summary.battleWins,1);
  assert.strictEqual(summary.puzzlesSolved,1);
  assert.strictEqual(summary.eventsResolved,1);
  assert.strictEqual(summary.heroesRecruited,1);
  assert.strictEqual(summary.finalPower,777);
  assert(summary.endReasonLabel.includes('припас'));
  assert.strictEqual(endless.endReasonLabel('king_solo_battle'),'Наемники не посчитались со словами одинокого короля без королевства и повесили вас на суку ближайшего дерева');

  rating.writePlayerRating({power:777,receipts:[]},storage);
  const nextRun=persistence.writeRun(persistence.createRun({now:2000,id:'endless-new-run'}),storage,2000);
  assert.deepStrictEqual(nextRun.runStats,{goldEarned:0,skirmishWins:0,battleWins:0,puzzlesSolved:0,eventsResolved:0},'new run must reset run statistics');
  assert.strictEqual(rating.readPlayerRating(storage).power,777,'new run must preserve profile Power');

  const app=fs.readFileSync(path.join(game,'js/endless-run-app.mjs'),'utf8');
  const css=fs.readFileSync(path.join(game,'css/endless-run.css'),'utf8');
  const starvation=fs.readFileSync(path.join(game,'js/starvation-app.mjs'),'utf8');
  const events=fs.readFileSync(path.join(game,'js/events-app.mjs'),'utf8');
  const route=fs.readFileSync(path.join(game,'js/battle-route.mjs'),'utf8');
  for(const token of ['ЗАБЕГ ЗАВЕРШЁН','ЗАРАБОТАНО ЗОЛОТА','ИТОГОВАЯ МОЩЬ','НОВАЯ ИГРА','ГЛАВНОЕ МЕНЮ','scene_defeat.jpg','queueMicrotask(() => open(storedRun))','RPChessEndlessRun'])assert(app.includes(token),`endless app missing ${token}`);
  assert(starvation.includes("button.textContent = kingDied ? 'ИТОГИ ЗАБЕГА'"));
  assert(starvation.includes('RPChessEndlessRun?.open?.(current)'));
  assert(events.includes("if(activeRun.ended)button.textContent='ИТОГИ ЗАБЕГА'"));
  assert(events.includes('RPChessEndlessRun?.open?.(current)'));
  assert(route.includes("import './endless-run-app.mjs'"));
  assert(!css.includes('ui_panel_frame.png')&&!css.includes('ui_panel_wide.png'));
  console.log('First Complete Endless Run statistics, reset, Power persistence and final summary contract: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
