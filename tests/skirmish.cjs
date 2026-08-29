const assert=require('assert'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const skirmishAppSource=fs.readFileSync(path.join(root,'game/js/skirmish-app.mjs'),'utf8');
  assert(skirmishAppSource.includes("aftermathButton.textContent='Продолжить путь'"),'Skirmish aftermath CTA must say Продолжить путь');
  assert(skirmishAppSource.includes("function leaveAftermath(){audio()?.click?.();resetBattleState();globalThis.dispatchEvent(new CustomEvent('rpchess:travel-open'"),'Skirmish aftermath must route directly to Travel Choice');
  const rosterData=await import(pathToFileURL(path.join(root,'game/js/roster-data.mjs')).href);
  const difficulty=await import(pathToFileURL(path.join(root,'game/js/encounter-difficulty.mjs')).href);
  const skirmish=await import(pathToFileURL(path.join(root,'game/js/skirmish-core.mjs')).href);
  const roster=rosterData.createStarterRoster(),selected=skirmish.defaultCombatSelection(roster);
  assert.strictEqual(selected.length,6);const valid=skirmish.validateSelection(roster,selected);assert.strictEqual(valid.ok,true);assert.strictEqual(valid.points,13);assert.strictEqual(valid.count,6);assert.ok(selected.includes('king.oathkeeper'));
  assert.strictEqual(skirmish.validateSelection(roster,selected.filter(id=>id!=='king.oathkeeper')).reason,'king_required');
  const wounded=roster.map(c=>c.id==='hero.vael_hammer'?{...c,status:'wounded'}:c);assert.strictEqual(skirmish.validateSelection(wounded,selected).reason,'character_unavailable');
  const woundedKing=roster.map(c=>c.isRunKing?{...c,status:'wounded'}:c);assert(skirmish.defaultCombatSelection(woundedKing).includes('king.oathkeeper'));assert.strictEqual(skirmish.validateSelection(woundedKing,skirmish.defaultCombatSelection(woundedKing)).ok,true);
  const oversized=[roster[0],...Array.from({length:16},(_,i)=>({id:`pawn.${i}`,name:`Pawn ${i}`,pieceType:'pawn',commandCost:1,status:'healthy',isRunKing:false}))];assert.strictEqual(skirmish.validateSelection(oversized,oversized.map(x=>x.id)).reason,'piece_limit');
  const expensive=[roster[0],...Array.from({length:5},(_,i)=>({id:`queen.${i}`,name:`Queen ${i}`,pieceType:'queen',commandCost:9,status:'healthy',isRunKing:false}))];assert.strictEqual(skirmish.validateSelection(expensive,expensive.map(x=>x.id)).reason,'point_limit');

  assert.strictEqual(difficulty.starsText(6),'★★★★★★');
  assert.strictEqual(difficulty.starsText(12),'★★★★★★\u200B★★★★★★','12 stars must expose a single invisible 6+6 wrap point');
  assert.strictEqual(difficulty.starsText(99),'★★★★★★\u200B★★★★★★','star display must clamp at 12 and preserve the 6+6 fallback');

  globalThis.RPChessTravelEncounterOverride={type:'skirmish',seed:'test-seed',stars:12,playerColor:'b',enemyRaceTag:'orcs'};
  const encounter=skirmish.createEncounter({seed:'fallback',stars:2});assert.strictEqual(encounter.stars,12);assert.strictEqual(encounter.aiElo,2600);assert.strictEqual(encounter.playerColor,'b');assert.strictEqual(encounter.enemyRaceTag,'orcs');
  const planA=skirmish.createBattlePlan({roster,selectedIds:selected,encounter}),planB=skirmish.createBattlePlan({roster,selectedIds:selected,encounter});assert.strictEqual(planA.fen,planB.fen);assert.deepStrictEqual(planA.playerFormation,planB.playerFormation);assert.deepStrictEqual(planA.enemyFormation,planB.enemyFormation);assert.strictEqual(planA.playerColor,'b');assert.strictEqual(planA.enemyColor,'w');
  assert(planA.playerFormation.every(p=>['7','8'].includes(p.square[1])));assert(planA.enemyFormation.every(p=>['1','2'].includes(p.square[1])));
  assert(planA.playerFormation.filter(p=>p.pieceType==='pawn').every(p=>p.square[1]==='7'),'player pawns must stay on second rank');assert(planA.enemyFormation.filter(p=>p.pieceType==='pawn').every(p=>p.square[1]==='2'),'enemy pawns must stay on second rank');
  const conventional=skirmish.placeArmy(valid.members,'w',{seed:'random-deploy'}),repeat=skirmish.placeArmy(valid.members,'w',{seed:'random-deploy'});assert.deepStrictEqual(conventional,repeat,'deployment must be deterministic for same seed');assert(conventional.filter(p=>p.pieceType==='pawn').every(p=>p.square[1]==='2'));assert(conventional.filter(p=>p.pieceType!=='pawn').every(p=>['1','2'].includes(p.square[1])));
  const alternative=skirmish.placeArmy(valid.members,'w',{seed:'random-deploy-other'});assert.notDeepStrictEqual(conventional,alternative,'different encounter seeds should be able to change deployment');
  assert.ok(planA.enemyPoints<=39);assert.ok(planA.enemyFormation.length<=16);

  const run={id:'run-test',roster,ended:false};
  const winBlack=skirmish.applyBattleOutcome(run,{capturedIds:['hero.aldric_wall'],status:{type:'checkmate',winner:'b'},playerColor:'b'});assert.strictEqual(winBlack.roster.find(c=>c.id==='hero.aldric_wall').status,'wounded');assert.strictEqual(winBlack.roster.find(c=>c.isRunKing).status,'healthy');assert.strictEqual(winBlack.ended,false);
  const lossBlack=skirmish.applyBattleOutcome(run,{capturedIds:[],status:{type:'checkmate',winner:'w'},playerColor:'b'});assert.strictEqual(lossBlack.roster.find(c=>c.isRunKing).status,'dead');assert.strictEqual(lossBlack.ended,true);assert.strictEqual(lossBlack.endReason,'king_dead');
  console.log('Skirmish 12-level, aftermath→Travel, responsive 6+6 stars, deterministic random deployment, Black-side and wound contracts: PASS');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});