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

  assert.strictEqual(data.EVENT_CATALOG.length,500);
  assert.strictEqual(new Set(data.EVENT_IDS).size,500);
  assert.deepStrictEqual(data.EVENT_IDS,[...Array(500)].map((_,index)=>`E${String(index+1).padStart(3,'0')}`));
  const choices=data.EVENT_CATALOG.flatMap(e=>e.choices);assert.strictEqual(choices.length,2114);
  const v1=data.EVENT_CATALOG.slice(0,100),v4=data.EVENT_CATALOG.slice(100);
  assert.strictEqual(v4.length,400);
  assert.strictEqual(v4.flatMap(e=>e.choices).length,1699);

  for(const e of data.EVENT_CATALOG){
    assert(e.choices.length>=3&&e.choices.length<=5,`${e.id} must have 3-5 choices`);
    if(Number(e.id.slice(1))<=100){
      const story=narrative.literaryStory(e);
      assert(story.length>=4,`${e.id} must render a multi-paragraph literary scene`);
      assert(story.some(p=>/[«»]/.test(p)),`${e.id} literary scene must contain dialogue`);
    } else {
      assert(Array.isArray(e.storyParagraphs)&&e.storyParagraphs.length>=2,`${e.id} v4 scene must contain at least two authored paragraphs`);
      assert(e.storyParagraphs.every(p=>typeof p==='string'&&p.trim().length>0),`${e.id} v4 scene paragraphs must be non-empty`);
      assert(typeof e.tone==='string'&&e.tone.trim(),`${e.id} must preserve tone metadata`);
      assert(typeof e.actors==='string'&&e.actors.trim(),`${e.id} must preserve actors metadata`);
      for(const raw of e.choices){
        assert.strictEqual(raw.id.startsWith(`${e.id}.`),true,`${raw.id} must belong to ${e.id}`);
        assert(Array.isArray(raw.successEffects)&&Array.isArray(raw.failureEffects),`${raw.id} must ship explicit typed v4 effects`);
        if(raw.heroReaction){
          assert(raw.role,`${raw.id} hero reaction must remain role-gated`);
          assert.strictEqual(raw.heroReaction.role,raw.role,`${raw.id} hero reaction role must match mechanical role`);
        }
      }
    }
    const background=raceAssets.eventBackgroundPath(e);assert(background.startsWith('assets/events/register-04/backgrounds/'));assert(fs.existsSync(path.join(game,background)),`${e.id} background must exist: ${background}`);
  }
  assert.strictEqual(data.eventById('E131')?.race,'Дварфы');assert.strictEqual(data.eventById('E131')?.raceTag,'dwarves');
  const dragonbornAlias=v4.find(e=>e.race==='Драконорождённые');assert(dragonbornAlias);assert.strictEqual(dragonbornAlias.raceTag,'dragonborn');

  const animalBackground=raceAssets.eventBackgroundPath({id:'animal-background-contract',race:'Животные'});assert(/^assets\/events\/register-04\/backgrounds\/animals\/(wild_glen|riverbank_tracks)\.png$/.test(animalBackground),`Animals runtime must use canonical files: ${animalBackground}`);assert(fs.existsSync(path.join(game,animalBackground)));
  const faeBackground=raceAssets.eventBackgroundPath({id:'fae-background-contract',race:'Феи'});assert(/^assets\/events\/register-04\/backgrounds\/fae\/(fae_ring_garden|whispering_meadow)\.png$/.test(faeBackground),`Fae runtime must use canonical files: ${faeBackground}`);assert(fs.existsSync(path.join(game,faeBackground)));
  const goblinBackground=raceAssets.eventBackgroundPath({id:'goblin-background-contract',race:'Гоблины'});assert(/^assets\/events\/register-04\/backgrounds\/goblins\/(goblin_trade_nook|goblin_scrapyard_camp)\.png$/.test(goblinBackground),`Goblin runtime must use canonical files: ${goblinBackground}`);assert(fs.existsSync(path.join(game,goblinBackground)));
  const races=['Люди','Эльфы','Орки','Нежить','Тёмные эльфы','Гномы','Демоны','Ангелы','Дракониды','Зверолюди','Конструкты','Животные','Феи','Гоблины'];for(const race of races)assert.strictEqual(v1.filter(e=>e.race===race).length,6,`${race} must keep six accepted v1 events`);
  const bag=core.shuffledEventIds('bag-test',0);assert.strictEqual(bag.length,500);assert.strictEqual(new Set(bag).size,500);assert.deepStrictEqual(bag,core.shuffledEventIds('bag-test',0));
  assert.deepStrictEqual(travel.PLAYABLE_TRAVEL_TYPES,['skirmish','battle','settlement','event','puzzle']);const samples={skirmish:0,battle:0,settlement:0,event:0,puzzle:0};for(let i=1;i<=5000;i++)for(const c of travel.createTravelChoices({runId:`prob-${i}`,step:1}))samples[c.type]++;for(const type of Object.keys(samples)){const ratio=samples[type]/15000;assert(ratio>.18&&ratio<.22,`${type} empirical ratio ${ratio} is not near 20%`);}

  let run=persistence.createRun({id:'events-economy-test',now:1});
  const route={id:'travel.event.manual',step:1,type:'event',label:'СОБЫТИЕ',stars:12,threatLabel:'ЛЕГЕНДАРНАЯ',flavor:'Событие.',mechanicalHint:'',seed:'event-economy-seed',supplyCostAtSelection:1,supplyPaid:1};
  run={...run,activeTravelChoice:route,currentTravelChoices:null,journeyStep:1};let created=core.createEventState(run,route);run={...created.run,currentEvent:{...created.state,eventId:'E002'}};
  const trade=core.resolveEventChoice(run,'E002.1');assert.strictEqual(trade.success,true);assert.strictEqual(trade.run.gold,62);assert.strictEqual(trade.run.supplies,12);const again=core.resolveEventChoice(trade.run,'E002.1');assert.strictEqual(again.reason,'already-resolved');assert.strictEqual(again.run.gold,62);

  let alwaysRun=persistence.createRun({id:'events-always-effect-test',now:2});alwaysRun={...alwaysRun,activeTravelChoice:{...route,seed:'always-effect-seed'},currentTravelChoices:null,journeyStep:1};created=core.createEventState(alwaysRun,alwaysRun.activeTravelChoice);alwaysRun={...created.run,currentEvent:{...created.state,eventId:'E018'}};
  const ambush=core.resolveEventChoice(alwaysRun,'E018.2');assert.strictEqual(ambush.success,true);const combat=ambush.run.currentEvent.combat;assert(combat);assert.strictEqual(combat.type,'skirmish');assert.strictEqual(combat.stars,12,'event threat modifier must clamp to the new 12-star ceiling');assert(['w','b'].includes(combat.playerColor));assert(combat.enemyRaceTag);assert(combat.enemyRoleRaces);assert(ambush.run.currentEvent.outcome.notes.includes('Начинается Стычка'));

  const v4Sample=data.eventById('E101');assert(v4Sample);let v4Run=persistence.createRun({id:'events-v4-sample',now:4});v4Run={...v4Run,gold:100,activeTravelChoice:{...route,seed:'events-v4-sample-seed'},currentTravelChoices:null,journeyStep:1,currentEvent:{routeId:route.id,eventId:'E101',choiceId:null,roll:null,success:null,resolved:false,outcome:null,combat:null}};const v4Choice=core.resolveEventChoice(v4Run,'E101.1');assert.strictEqual(v4Choice.success,true);assert(v4Choice.run.gold<=86,'E101.1 must charge its authored 14 Gold cost');assert.strictEqual(v4Choice.run.supplies>=10,true);

  const kingRisks=[];for(const e of data.EVENT_CATALOG)for(const raw of e.choices){const c=core.normalizeChoice(raw),all=[...c.successEffects,...c.failureEffects,...c.alwaysEffects],kingDeath=all.some(x=>x.type==='death'&&x.target==='king');if(kingDeath){kingRisks.push(c.id);assert.strictEqual(c.kingRisk,true);assert(c.warnings.some(w=>w.includes('КОРОЛЬ')));}for(const effect of all)if(effect.type==='death'&&effect.target==='randomNonKing')assert.notStrictEqual(effect.target,'king');}assert.strictEqual(kingRisks.length,4);

  const base=persistence.createRun({id:'wounded-king',now:3}),woundedKing={...base,roster:base.roster.map(c=>c.isRunKing?{...c,status:'wounded'}:c)};const skirmish=await import(pathToFileURL(path.join(game,'js/skirmish-core.mjs')).href);const battle=await import(pathToFileURL(path.join(game,'js/battle-core.mjs')).href);assert(skirmish.defaultCombatSelection(woundedKing.roster).includes(woundedKing.roster.find(c=>c.isRunKing).id));assert(battle.defaultBattleSelection(woundedKing.roster).includes(woundedKing.roster.find(c=>c.isRunKing).id));
  console.log('Events 500/2114, v4 inline narrative, canonical 36-background register, 20% five-type Travel, 12-star combat, King risk and persistence: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
