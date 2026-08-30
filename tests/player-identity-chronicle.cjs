const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
class MemoryStorage{constructor(){this.map=new Map()}getItem(k){return this.map.has(k)?this.map.get(k):null}setItem(k,v){this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}}
(async()=>{
  const game=path.resolve(__dirname,'..','game'),url=(relative)=>pathToFileURL(path.join(game,relative)).href;
  const identity=await import(url('js/player-identity-core.mjs'));
  const chronicle=await import(url('js/chronicle-core.mjs'));
  const persistence=await import(url('js/run-persistence.mjs'));
  const storage=new MemoryStorage();

  assert.strictEqual(identity.normalizePlayerName('   Тимур   Воин  '),'Тимур Воин');
  assert.strictEqual(identity.normalizePlayerName('   '),'');
  assert(identity.normalizePlayerName('123456789012345678901234567890').length<=identity.PLAYER_NAME_MAX_LENGTH);

  let run=persistence.createRun({now:1000,id:'identity-run',playerName:'  Тимур  '});
  assert.strictEqual(run.playerName,'Тимур');
  run=persistence.writeRun(run,storage,1000);
  assert.strictEqual(persistence.readRun(storage).playerName,'Тимур','player name must survive persistence');

  const legacy={...run};delete legacy.playerName;storage.setItem(persistence.RUN_STORAGE_KEY,JSON.stringify(legacy));
  assert.strictEqual(persistence.readRun(storage).playerName,'Воин','legacy runs must hydrate with a safe player-name fallback');

  assert.strictEqual(identity.personalizePlayerNarrative('Король перечитывает документ.','Тимур'),'Тимур перечитывает документ.');
  assert.strictEqual(identity.personalizePlayerNarrative('Пока Король не спрашивает, девочка молчит.','Тимур'),'Пока Тимур не спрашивает, девочка молчит.');
  assert.strictEqual(identity.personalizePlayerNarrative('Один из женихов подходит к Королю.','Тимур'),'Один из женихов подходит к вам.');
  assert.strictEqual(identity.personalizePlayerNarrative('В деревне Короля встречают колокольным звоном.','Тимур'),'В деревне вас встречают колокольным звоном.');
  assert.strictEqual(identity.personalizePlayerNarrative('КОРОЛЬ МОЖЕТ ПОГИБНУТЬ','Тимур'),'КОРОЛЬ МОЖЕТ ПОГИБНУТЬ','system chess/RPG warnings must stay system language');

  assert.strictEqual(chronicle.gloryForRun(35,900),17);
  assert.strictEqual(chronicle.gloryForRun(0,900),0);
  const completed={...persistence.createRun({now:2000,id:'completed-run',playerName:'Рагнар'}),journeyStep:35,ended:true,endReason:'starvation_king',updatedAt:2500};
  let result=chronicle.recordCompletedRun(completed,{power:900,storage,completedAt:2500});
  assert.strictEqual(result.changed,true);
  assert.strictEqual(result.record.glory,17);
  assert.strictEqual(result.record.playerName,'Рагнар');
  assert(!Object.prototype.hasOwnProperty.call(result.record,'endReason'),'Chronicle must not store/display the run-end reason');
  result=chronicle.recordCompletedRun(completed,{power:900,storage,completedAt:2600});
  assert.strictEqual(result.changed,false,'same completed run must be idempotent');
  result=chronicle.recordCompletedRun(completed,{power:1000,storage,completedAt:2700});
  assert.strictEqual(result.changed,true,'same run may refresh its final Power if rating settlement lands later');
  assert.strictEqual(result.record.power,1000);

  const second={...completed,id:'second-run',playerName:'Эдрик',journeyStep:40,updatedAt:3000};
  chronicle.recordCompletedRun(second,{power:640,storage,completedAt:3000});
  const best=chronicle.bestChronicleRun(chronicle.readChronicle(storage));
  assert(best&&best.runId==='completed-run','best run must use Glory, then week, then Power ordering');

  const active={...persistence.createRun({id:'active-run',playerName:'Алёна'}),journeyStep:12,roster:persistence.createRun({id:'roster-copy'}).roster.map((hero,index)=>index===1?{...hero,status:'dead'}:hero)};
  const snapshot=chronicle.activeRunSnapshot(active,{power:777});
  assert.strictEqual(snapshot.playerName,'Алёна');
  assert.strictEqual(snapshot.week,12);
  assert.strictEqual(snapshot.power,777);
  assert.strictEqual(snapshot.heroes,active.roster.length-1);

  const foundation=fs.readFileSync(path.join(game,'js/reboot-foundation.mjs'),'utf8');
  const ui=fs.readFileSync(path.join(game,'js/player-identity-chronicle.mjs'),'utf8');
  const events=fs.readFileSync(path.join(game,'js/events-app.mjs'),'utf8');
  const css=fs.readFileSync(path.join(game,'css/player-identity-chronicle.css'),'utf8');
  for(const token of ["import('./player-identity-chronicle.mjs')",'RPChessIdentityReady','openIdentityPrompt'])assert(foundation.includes(token),`foundation identity bootstrap missing ${token}`);
  for(const token of ['Кто ты, воин?','data-player-identity-input','data-chronicle-panel','ТЕКУЩИЙ ПОХОД','ЛУЧШИЙ ПОХОД','СЛАВА'])assert(ui.includes(token),`identity/chronicle UI missing ${token}`);
  for(const token of ['personalizePlayerNarrative','personalizePlayerTitle','playerNameForRun'])assert(events.includes(token),`Events player-name integration missing ${token}`);
  for(const token of ['.chronicle-panel','.identity-panel','.chronicle-metric'])assert(css.includes(token),`identity/chronicle CSS missing ${token}`);
  console.log('Player Identity persistence, Event narrative personalization, Chronicle Glory/history and UI contract: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
