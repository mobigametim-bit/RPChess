const path=require('path'),assert=require('assert'),fs=require('fs'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const data=await import(pathToFileURL(path.join(game,'js/events-data.mjs')).href);
  const core=await import(pathToFileURL(path.join(game,'js/events-core.mjs')).href);
  const narrative=await import(pathToFileURL(path.join(game,'js/event-narrative.mjs')).href);
  const raceAssets=await import(pathToFileURL(path.join(game,'js/race-assets.mjs')).href);
  const persistence=await import(pathToFileURL(path.join(game,'js/run-persistence.mjs')).href);
  const travel=await import(pathToFileURL(path.join(game,'js/travel-choice-core.mjs')).href);

  const canonicalBackgrounds={
    generic:['forest_crossroad.png','old_kings_road.png','roadside_shrine.png','abandoned_camp.png','ancient_ruins.png','stormy_bridge.png','moonlit_gravefield.png','market_square_twilight.png'],
    humans:['human_waystation.png','human_chapel_court.png'],elves:['elven_glade.png','elven_waystones.png'],orcs:['orc_war_camp.png','orc_trial_circle.png'],undead:['necropolis_gate.png','bone_court.png'],dark_elves:['obsidian_passage.png','spider_shrine.png'],dwarves:['dwarven_forgehall.png','dwarven_gate_road.png'],demons:['infernal_breach.png','ashen_altar.png'],angels:['sky_sanctuary.png','hall_of_halos.png'],dragonborn:['dragonborn_aerie.png','ember_tribunal.png'],beastfolk:['beastfolk_hunting_camp.png','moon_run_path.png'],constructs:['construct_foundry.png','silent_observatory.png'],animals:['wild_glen.png','riverbank_tracks.png'],fae:['fae_ring_garden.png','whispering_meadow.png'],goblins:['goblin_trade_nook.png','goblin_scrapyard_camp.png']
  };
  const canonicalFiles=Object.entries(canonicalBackgrounds).flatMap(([folder,files])=>files.map(file=>`assets/events/register-04/backgrounds/${folder}/${file}`));
  assert.strictEqual(canonicalFiles.length,36,'canonical Event background register must contain exactly 36 files');
  for(const relative of canonicalFiles)assert(fs.existsSync(path.join(game,relative)),`canonical Event background must exist: ${relative}`);
  assert.deepStrictEqual(Object.keys(raceAssets.BACKGROUND_POOLS).sort(),Object.keys(canonicalBackgrounds).sort());
  for(const [folder,files] of Object.entries(canonicalBackgrounds))assert.deepStrictEqual([...raceAssets.BACKGROUND_POOLS[folder]],[...files],`${folder} background pool must match canonical register`);

  assert.strictEqual(data.EVENT_CATALOG.length,100);assert.strictEqual(new Set(data.EVENT_IDS).size,100);
  const choices=data.EVENT_CATALOG.flatMap(e=>e.choices);assert.strictEqual(choices.length,415);
  for(const e of data.EVENT_CATALOG){
    assert(e.choices.length>=3&&e.choices.length<=5,`${e.id} must have 3-5 choices`);
    const story=narrative.literaryStory(e);assert(story.length>=4,`${e.id} must render a multi-paragraph literary scene`);assert(story.some(p=>/[«»]/.test(p)),`${e.id} literary scene must contain dialogue`);
    const background=raceAssets.eventBackgroundPath(e);assert(background.startsWith('assets/events/register-04/backgrounds/'));assert(fs.existsSync(path.join(game,background)),`${e.id} background must exist: ${background}`);
  }
  const animalBackground=raceAssets.eventBackgroundPath({id:'animal-background-contract',race:'Животные'});assert(/^assets\/events\/register-04\/backgrounds\/animals\/(wild_glen|riverbank_tracks)\.png$/.test(animalBackground),`Animals runtime must use canonical files: ${animalBackground}`);assert(fs.existsSync(path.join(game,animalBackground)));
  const faeBackground=raceAssets.eventBackgroundPath({id:'fae-background-contract',race:'Феи'});assert(/^assets\/events\/register-04\/backgrounds\/fae\/(fae_ring_garden|whispering_meadow)\.png$/.test(faeBackground),`Fae runtime must use canonical files: ${faeBackground}`);assert(fs.existsSync(path.join(game,faeBackground)));
  const goblinBackground=raceAssets.eventBackgroundPath({id:'goblin-background-contract',race:'Гоблины'});assert(/^assets\/events\/register-04\/backgrounds\/goblins\/(goblin_trade_nook|goblin_scrapyard_camp)\.png$/.test(goblinBackground),`Goblin runtime must use canonical files: ${goblinBackground}`);assert(fs.existsSync(path.join(game,goblinBackground)));
  const races=['Люди','Эльфы','Орки','Нежить','Тёмные эльфы','Гномы','Демоны','Ангелы','Дракониды','Зверолюди','Конструкты','Животные','Феи','Гоблины'];for(const race of races)assert.strictEqual(data.EVENT_CATALOG.filter(e=>e.race===race).length,6,`${race} must have six events`);
  const bag=core.shuffledEventIds('bag-test',0);assert.strictEqual(bag.length,100);assert.strictEqual(new Set(bag).size,100);assert.deepStrictEqual(bag,core.shuffledEventIds('bag-test',0));
  assert.deepStrictEqual(travel.PLAYABLE_TRAVEL_TYPES,['skirmish','battle','settlement','event','puzzle']);const samples={skirmish:0,battle:0,settlement:0,event:0,puzzle:0};for(let i=1;i<=5000;i++)for(const c of travel.createTravelChoices({runId:`prob-${i}`,step:1}))samples[c.type]++;for(const type of Object.keys(samples)){const ratio=samples[type]/15000;assert(ratio>.18&&ratio<.22,`${type} empirical ratio ${ratio} is not near 20%`);}

  let run=persistence.createRun({id:'events-economy-test',now:1});
  const route={id:'travel.event.manual',step:1,type:'event',label:'СОБЫТИЕ',stars:12,threatLabel:'ЛЕГЕНДАРНАЯ',flavor:'Событие.',mechanicalHint:'',seed:'event-economy-seed',supplyCostAtSelection:1,supplyPaid:1};
  run={...run,activeTravelChoice:route,currentTravelChoices:null,journeyStep:1};let created=core.createEventState(run,route);run={...created.run,currentEvent:{...created.state,eventId:'E002'}};
  const trade=core.resolveEventChoice(run,'E002.1');assert.strictEqual(trade.success,true);assert.strictEqual(trade.run.gold,62);assert.strictEqual(trade.run.supplies,12);const again=core.resolveEventChoice(trade.run,'E002.1');assert.strictEqual(again.reason,'already-resolved');assert.strictEqual(again.run.gold,62);

  let alwaysRun=persistence.createRun({id:'events-always-effect-test',now:2});alwaysRun={...alwaysRun,activeTravelChoice:{...route,seed:'always-effect-seed'},currentTravelChoices:null,journeyStep:1};created=core.createEventState(alwaysRun,alwaysRun.activeTravelChoice);alwaysRun={...created.run,currentEvent:{...created.state,eventId:'E018'}};
  const ambush=core.resolveEventChoice(alwaysRun,'E018.2');assert.strictEqual(ambush.success,true);const combat=ambush.run.currentEvent.combat;assert(combat);assert.strictEqual(combat.type,'skirmish');assert.strictEqual(combat.stars,12,'event threat modifier must clamp to the new 12-star ceiling');assert(['w','b'].includes(combat.playerColor));assert(combat.enemyRaceTag);assert(combat.enemyRoleRaces);assert(ambush.run.currentEvent.outcome.notes.includes('Начинается Стычка'));

  const kingRisks=[];for(const e of data.EVENT_CATALOG)for(const raw of e.choices){const c=core.normalizeChoice(raw),all=[...c.successEffects,...c.failureEffects,...c.alwaysEffects],kingDeath=all.some(x=>x.type==='death'&&x.target==='king');if(kingDeath){kingRisks.push(c.id);assert.strictEqual(c.kingRisk,true);assert(c.warnings.some(w=>w.includes('КОРОЛЬ')));}for(const effect of all)if(effect.type==='death'&&effect.target==='randomNonKing')assert.notStrictEqual(effect.target,'king');}assert.strictEqual(kingRisks.length,4);

  const base=persistence.createRun({id:'wounded-king',now:3}),woundedKing={...base,roster:base.roster.map(c=>c.isRunKing?{...c,status:'wounded'}:c)};const skirmish=await import(pathToFileURL(path.join(game,'js/skirmish-core.mjs')).href);const battle=await import(pathToFileURL(path.join(game,'js/battle-core.mjs')).href);assert(skirmish.defaultCombatSelection(woundedKing.roster).includes(woundedKing.roster.find(c=>c.isRunKing).id));assert(battle.defaultBattleSelection(woundedKing.roster).includes(woundedKing.roster.find(c=>c.isRunKing).id));
  console.log('Events 100/415, literary scenes, canonical 36-background register, 20% five-type Travel, 12-star combat, King risk and persistence: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});