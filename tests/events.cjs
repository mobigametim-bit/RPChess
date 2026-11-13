const path=require('path'),assert=require('assert'),fs=require('fs'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const data=await import(pathToFileURL(path.join(game,'js/events-data.mjs')).href);
  const core=await import(pathToFileURL(path.join(game,'js/events-core.mjs')).href);
  const editorial=await import(pathToFileURL(path.join(game,'js/event-literary-outcome.mjs')).href);
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
    const background=raceAssets.eventBackgroundPath(e);assert(background.startsWith('assets/events/register-04/backgrounds/'));assert(fs.existsSync(path.join(game,background.replace(/\.webp$/,'.png'))),`${e.id} background must exist: ${background}`);
  }
  assert.strictEqual(data.eventById('E131')?.race,'Дварфы');assert.strictEqual(data.eventById('E131')?.raceTag,'dwarves');
  const dragonbornAlias=v4.find(e=>e.race==='Драконорождённые');assert(dragonbornAlias);assert.strictEqual(dragonbornAlias.raceTag,'dragonborn');

  const animalBackground=raceAssets.eventBackgroundPath({id:'animal-background-contract',race:'Животные'});assert(/^assets\/events\/register-04\/backgrounds\/animals\/(wild_glen|riverbank_tracks)\.webp$/.test(animalBackground),`Animals runtime must use canonical files: ${animalBackground}`);assert(fs.existsSync(path.join(game,animalBackground.replace(/\.webp$/,'.png'))));
  const faeBackground=raceAssets.eventBackgroundPath({id:'fae-background-contract',race:'Феи'});assert(/^assets\/events\/register-04\/backgrounds\/fae\/(fae_ring_garden|whispering_meadow)\.webp$/.test(faeBackground),`Fae runtime must use canonical files: ${faeBackground}`);assert(fs.existsSync(path.join(game,faeBackground.replace(/\.webp$/,'.png'))));
  const goblinBackground=raceAssets.eventBackgroundPath({id:'goblin-background-contract',race:'Гоблины'});assert(/^assets\/events\/register-04\/backgrounds\/goblins\/(goblin_trade_nook|goblin_scrapyard_camp)\.webp$/.test(goblinBackground),`Goblin runtime must use canonical files: ${goblinBackground}`);assert(fs.existsSync(path.join(game,goblinBackground.replace(/\.webp$/,'.png'))));
  const races=['Люди','Эльфы','Орки','Нежить','Тёмные эльфы','Гномы','Демоны','Ангелы','Дракониды','Зверолюди','Конструкты','Животные','Феи','Гоблины'];for(const race of races)assert.strictEqual(v1.filter(e=>e.race===race).length,6,`${race} must keep six accepted v1 events`);
  const bag=core.shuffledEventIds('bag-test',0);assert.strictEqual(bag.length,500);assert.strictEqual(new Set(bag).size,500);assert.deepStrictEqual(bag,core.shuffledEventIds('bag-test',0));
  assert.deepStrictEqual(travel.PLAYABLE_TRAVEL_TYPES,['skirmish','battle','settlement','event','puzzle','caravan']);const samples={skirmish:0,battle:0,settlement:0,event:0,puzzle:0,caravan:0};for(let i=1;i<=5000;i++)for(const c of travel.createTravelChoices({runId:`prob-${i}`,step:1}))samples[c.type]++;for(const type of Object.keys(samples)){const ratio=samples[type]/15000;assert(ratio>.15&&ratio<.185,`${type} empirical ratio ${ratio} is not near 1/6`);}

  let run=persistence.createRun({id:'events-economy-test',now:1});
  const route={id:'travel.event.manual',step:1,type:'event',label:'СОБЫТИЕ',stars:12,threatLabel:'ЛЕГЕНДАРНАЯ',flavor:'Событие.',mechanicalHint:'',seed:'event-economy-seed',supplyCostAtSelection:1,supplyPaid:1};
  run={...run,activeTravelChoice:route,currentTravelChoices:null,journeyStep:1};let created=core.createEventState(run,route);run={...created.run,currentEvent:{...created.state,eventId:'E002'}};
  const trade=core.resolveEventChoice(run,'E002.1');assert.strictEqual(trade.success,true);assert.strictEqual(trade.run.gold,62);assert.strictEqual(trade.run.supplies,32);const again=core.resolveEventChoice(trade.run,'E002.1');assert.strictEqual(again.reason,'already-resolved');assert.strictEqual(again.run.gold,62);

  let alwaysRun=persistence.createRun({id:'events-always-effect-test',now:2});alwaysRun={...alwaysRun,activeTravelChoice:{...route,seed:'always-effect-seed'},currentTravelChoices:null,journeyStep:1};created=core.createEventState(alwaysRun,alwaysRun.activeTravelChoice);alwaysRun={...created.run,currentEvent:{...created.state,eventId:'E018'}};
  const soloKing={...alwaysRun,roster:alwaysRun.roster.filter(hero=>hero.isRunKing)};
  const ambushChoice=core.normalizedEvent('E018').choices.find(c=>c.id==='E018.2');
  assert.equal(core.choiceAvailability(soloKing,ambushChoice).enabled,false,
    'Event choice that can start Skirmish must be disabled for solo King');
  assert.equal(core.resolveEventChoice(soloKing,'E018.2').reason,'skirmish-needs-companion',
    'Event resolution cannot launch a solo-King Skirmish');
  const ambush=core.resolveEventChoice(alwaysRun,'E018.2');assert.strictEqual(ambush.success,true);const combat=ambush.run.currentEvent.combat;assert(combat);assert.strictEqual(combat.type,'skirmish');assert.strictEqual(combat.stars,12,'event threat modifier must clamp to the new 12-star ceiling');assert(['w','b'].includes(combat.playerColor));assert(combat.enemyRaceTag);assert(combat.enemyRoleRaces);assert(ambush.run.currentEvent.outcome.notes.includes('Начинается Стычка'));

  const v4Sample=data.eventById('E101');assert(v4Sample);let v4Run=persistence.createRun({id:'events-v4-sample',now:4});v4Run={...v4Run,gold:100,activeTravelChoice:{...route,seed:'events-v4-sample-seed'},currentTravelChoices:null,journeyStep:1,currentEvent:{routeId:route.id,eventId:'E101',choiceId:null,roll:null,success:null,resolved:false,outcome:null,combat:null}};const v4Choice=core.resolveEventChoice(v4Run,'E101.1');assert.strictEqual(v4Choice.success,true);assert(v4Choice.run.gold<=86,'E101.1 must charge its authored 14 Gold cost');assert.strictEqual(v4Choice.run.supplies>=10,true);

  // Legacy events: guaranteed blood-price wound, refundable bond, and goblin Gold reward.
  const legacyRun=(eventId,tag)=>{const seedRun=persistence.createRun({id:`legacy-${tag}`,now:5});return {...seedRun,gold:100,journeyStep:1,activeTravelChoice:{...route,seed:`legacy-${tag}-seed`},currentEvent:{routeId:route.id,eventId,choiceId:null,roll:null,success:null,resolved:false,outcome:null,combat:null}};};
  const bloodChoice=core.normalizedEvent('E037').choices.find(c=>c.id==='E037.3');
  assert.deepStrictEqual(bloodChoice.successEffects,[{type:'wound',target:'randomNonKing'},{type:'gold',delta:50}],'E037.3 must wound a non-King before paying 50 Gold');
  const bloodRun=legacyRun('E037','blood'),soloBlood={...bloodRun,roster:bloodRun.roster.filter(hero=>hero.isRunKing)},woundedBlood={...bloodRun,roster:bloodRun.roster.map(hero=>hero.isRunKing?hero:{...hero,status:'wounded'})};
  for(const blocked of [soloBlood,woundedBlood]){assert.strictEqual(core.choiceAvailability(blocked,bloodChoice).enabled,false,'E037.3 must require a healthy non-King');assert.strictEqual(core.resolveEventChoice(blocked,'E037.3').reason,'wound-needs-companion','blocked blood-price may not award Gold');}
  const bloodResult=core.resolveEventChoice(bloodRun,'E037.3');
  assert.strictEqual(bloodResult.run.gold,bloodRun.gold+50);
  assert.strictEqual(bloodResult.run.roster.filter(hero=>!hero.isRunKing&&hero.status==='wounded').length,bloodRun.roster.filter(hero=>!hero.isRunKing&&hero.status==='wounded').length+1,'exactly one companion must be wounded');
  assert.strictEqual(bloodResult.run.roster.find(hero=>hero.isRunKing).status,bloodRun.roster.find(hero=>hero.isRunKing).status,'King is immune to blood price');
  assert.strictEqual(core.resolveEventChoice(bloodResult.run,'E037.3').reason,'already-resolved','replay must not pay or wound twice');

  const bond=core.resolveEventChoice(legacyRun('E044','bond'),'E044.1');
  assert.strictEqual(bond.run.gold,100,'E044.1 must refund the entire 12 Gold bond');
  assert.strictEqual(bond.outcome.combat,null,'E044.1 must remain a safe passage');

  const goblinChoice=core.normalizedEvent('E084').choices.find(c=>c.id==='E084.2');
  assert.deepStrictEqual(goblinChoice.successEffects,[{type:'gold',delta:20}],'E084.2 success must award 20 Gold, map is narrative-only');
  const goblinSample=(success)=>{for(let index=0;index<300;index++){const candidate=legacyRun('E084',`goblin-${index}`),roll=core.deterministicRoll(candidate,candidate.currentEvent,goblinChoice);if((roll<=goblinChoice.chance)===success)return candidate;}throw Error('Cannot find both deterministic goblin outcomes');};
  const goblinWin=goblinSample(true),goblinLose=goblinSample(false);
  const goblinReward=core.resolveEventChoice(goblinWin,'E084.2'),goblinFight=core.resolveEventChoice(goblinLose,'E084.2');
  assert.strictEqual(goblinReward.run.gold,120,'E084.2 success must actually add 20 Gold');
  assert.strictEqual(goblinReward.outcome.combat,null);
  assert.strictEqual(goblinFight.run.gold,100,'E084.2 failure must not grant Gold');
  assert.strictEqual(goblinFight.outcome.combat?.type,'skirmish','E084.2 failure must still trigger Skirmish');

  // Editorial catalog is runtime-only prose: every base choice and every authored
  // branch/fallback must exist without changing Event mechanics.
  assert.strictEqual(Object.keys(editorial.LITERARY_OUTCOMES).length,2114);
  assert.strictEqual(Object.keys(editorial.LITERARY_OUTCOMES_EN).length,2114,'All 2114 choices require EN literary entries');
  const editedStrings=[];
  let basicBranches=0, fallbackBranches=0;
  for(const event of data.EVENT_CATALOG)for(const choice of event.choices){
    const row=editorial.LITERARY_OUTCOMES[choice.id];
    assert(row&&typeof row.s==='string'&&row.s.trim(),`Missing literary success ${choice.id}`);
    editedStrings.push(row.s);basicBranches++;
    if(choice.chance<100){assert(typeof row.f==='string'&&row.f.trim(),`Missing literary failure ${choice.id}`);editedStrings.push(row.f);basicBranches++;}
    else assert(!row.f,`Guaranteed choice must not invent a failure text: ${choice.id}`);
    for(const prose of Object.values(row.v||{})){assert(typeof prose==='string'&&prose.trim());editedStrings.push(prose);fallbackBranches++;}
  }
  assert.strictEqual(basicBranches,3388);
  assert.strictEqual(fallbackBranches,376);
  assert.strictEqual(new Set(editedStrings).size,3764,'All 3764 authored outcome texts must remain unique');
  let englishCount=0;
  for(const [id,ru] of Object.entries(editorial.LITERARY_OUTCOMES)){
    const en=editorial.LITERARY_OUTCOMES_EN[id];
    assert(en,'Missing EN literary row '+id);
    assert.deepStrictEqual(Object.keys(en).sort(),Object.keys(ru).sort(),'EN/RO outcome branch mismatch '+id);
    for(const key of ['s','f']){
      if(!ru[key])continue;
      assert(typeof en[key]==='string'&&en[key].trim(),'Missing translated '+id+'.'+key);
      assert(!/[А-Яа-яЁё]/u.test(en[key]),'Cyrillic in EN outcome '+id+'.'+key);
      const tok=x=>(x.match(/\\{\\{(?:heroName|affectedHeroName)\\}\\}/g)||[]).sort();
      assert.deepStrictEqual(tok(en[key]),tok(ru[key]),'EN name placeholder parity '+id+'.'+key);
      englishCount++;
    }
    for(const [key,ruFallback] of Object.entries(ru.v||{})){
      const translated=en.v?.[key];
      assert(typeof translated==='string'&&translated.trim(),'Missing EN fallback '+id+'.'+key);
      assert(!/[А-Яа-яЁё]/u.test(translated),'Cyrillic in EN fallback '+id+'.'+key);
      const tok=x=>(x.match(/\\{\\{(?:heroName|affectedHeroName)\\}\\}/g)||[]).sort();
      assert.deepStrictEqual(tok(translated),tok(ruFallback),'EN fallback placeholder parity '+id+'.'+key);
      englishCount++;
    }
  }
  assert.strictEqual(englishCount,3764,'All EN literary branches and fallbacks must be present');


  const bloodNarrative=editorial.literaryOutcomeForEvent(core.normalizedEvent('E037'),bloodResult.outcome,bloodResult.run,'ru');
  const actualVictim=bloodResult.outcome.effectReceipts.find(receipt=>receipt.type==='wound');
  assert(actualVictim?.targetId&&actualVictim?.targetName,'Event outcome must preserve real victim receipt');
  assert(bloodNarrative.includes(actualVictim.targetName),'Literary text must name the actually wounded fighter');
  const names=await import(pathToFileURL(path.join(game,'localization/events/en-v5-names.mjs')).href);
  const enName=raw=>names.EVENT_EN_V5_NAMES[raw]||raw;
  const translatedVictim=enName(actualVictim.targetName);
  const bloodEnNarrative=editorial.literaryOutcomeForEvent(core.normalizedEvent('E037'),bloodResult.outcome,bloodResult.run,'en',enName);
  assert(bloodEnNarrative.includes(translatedVictim),'EN prose must use the established localized name of the actual casualty');
  assert(!/[А-Яа-яЁё]/u.test(bloodEnNarrative),'EN literary outcome must not display Cyrillic from hero names');
  assert.strictEqual(editorial.literaryOutcomeForEvent(core.normalizedEvent('E037'),{...bloodResult.outcome,effectReceipts:undefined},bloodResult.run,'ru'),'','Legacy save without receipts must show notes only');
  const goblinNarrative=editorial.literaryOutcomeForEvent(core.normalizedEvent('E084'),goblinReward.outcome,goblinReward.run,'ru');
  assert(goblinNarrative.includes('золото')||goblinNarrative.includes('монеты'),'E084.2 must narrate its real Gold reward');
  assert(goblinReward.outcome.effectReceipts.some(receipt=>receipt.type==='gold'&&receipt.delta===20));
  const noTargetRow=editorial.LITERARY_OUTCOMES['E037.1'];
  assert.strictEqual(editorial.literaryOutcomeForEvent(core.normalizedEvent('E037'),
    {choiceId:'E037.1',success:false,effectReceipts:[{type:'death',skipped:true}],heroId:null},
    bloodRun,'ru'),noTargetRow.v.nf,'Missing target must use the authored fallback, not falsely claim a death');
  assert.strictEqual(editorial.literaryOutcomeForEvent(core.normalizedEvent('E037'),
    {choiceId:'E037.1',success:false,effectReceipts:[{type:'death',skipped:true}],heroId:null},
    bloodRun,'en',enName),editorial.LITERARY_OUTCOMES_EN['E037.1'].v.nf,'EN missing-target fallback must be localized');
  const recruitFallbackId=Object.keys(editorial.LITERARY_OUTCOMES).find(id=>editorial.LITERARY_OUTCOMES[id].v?.rs);
  assert(recruitFallbackId);
  const recruitEvent=core.normalizedEvent(recruitFallbackId.split('.')[0]);
  const recruitChoice=recruitEvent.choices.find(choice=>choice.id===recruitFallbackId||choice.sourceChoiceId===recruitFallbackId);
  assert(recruitChoice,'A v5 replacement must still resolve its base literary choice');
  const recruitFallback=editorial.literaryOutcomeForEvent(recruitEvent,
    {choiceId:recruitChoice.id,success:true,effectReceipts:[{type:'recruit',unavailable:true,delta:18}],heroId:null},
    bloodRun,'ru');
  assert.strictEqual(recruitFallback,editorial.LITERARY_OUTCOMES[recruitFallbackId].v.rs,
    'No eligible recruit must use the 18 Gold fallback instead of claiming a hero joined');
  assert.strictEqual(editorial.literaryOutcomeForEvent(recruitEvent,
    {choiceId:recruitChoice.id,success:true,effectReceipts:[{type:'recruit',unavailable:true,delta:18}],heroId:null},
    bloodRun,'en',enName),editorial.LITERARY_OUTCOMES_EN[recruitFallbackId].v.rs,
    'EN no-recruit fallback must be its own translated string');
  let personalCount=0;
  for(const eventId of data.EVENT_IDS)for(const choice of core.normalizedEvent(eventId).choices){
    if(!choice.requiredHeroId)continue;
    personalCount++;
    assert(editorial.LITERARY_OUTCOMES[choice.sourceChoiceId]&&editorial.LITERARY_OUTCOMES_EN[choice.sourceChoiceId],`Personal event ${choice.id} must reuse its sourceChoiceId prose in both languages`);
  }
  assert.strictEqual(personalCount,537,'All Events v5 personal choices must map to literary source data');

  const kingRisks=[];for(const e of data.EVENT_CATALOG)for(const raw of e.choices){const c=core.normalizeChoice(raw),all=[...c.successEffects,...c.failureEffects,...c.alwaysEffects],kingDeath=all.some(x=>x.type==='death'&&x.target==='king');if(kingDeath){kingRisks.push(c.id);assert.strictEqual(c.kingRisk,true);assert(c.warnings.some(w=>w.includes('КОРОЛЬ')));}for(const effect of all)if(effect.type==='death'&&effect.target==='randomNonKing')assert.notStrictEqual(effect.target,'king');}assert.strictEqual(kingRisks.length,4);

  const base=persistence.createRun({id:'wounded-king',now:3}),woundedKing={...base,roster:base.roster.map(c=>c.isRunKing?{...c,status:'wounded'}:c)};const skirmish=await import(pathToFileURL(path.join(game,'js/skirmish-core.mjs')).href);const battle=await import(pathToFileURL(path.join(game,'js/battle-core.mjs')).href);assert(skirmish.defaultCombatSelection(woundedKing.roster).includes(woundedKing.roster.find(c=>c.isRunKing).id));assert(battle.defaultBattleSelection(woundedKing.roster).includes(woundedKing.roster.find(c=>c.isRunKing).id));

  const appSource=fs.readFileSync(path.join(game,'js/events-app.mjs'),'utf8');
  assert(appSource.includes('data-events-literary')&&appSource.includes('literaryOutcomeForEvent(event, outcome, activeRun, currentLanguage(), localizeEventSource)'),'Centered Event modal must render bilingual literary outcome and localize hero names');
  const resourcesSource=fs.readFileSync(path.join(game,'js/ux-consistency.mjs'),'utf8');
  assert(resourcesSource.includes('suppl(?:y|ies)')&&resourcesSource.includes('iconize:iconizeText'),
    'shared resource iconizer must recognize both Supply and Supplies and expose explicit Event rendering');
  assert(appSource.includes('RPChessResourceIcons?.iconize?.(choices)'),
    'Event choices must iconize resource labels immediately after each render');
  assert(appSource.includes("'wound-needs-companion'")&&appSource.includes("'skirmish-needs-companion'"),'blocked E037.3 choice must show the existing localized healthy-fighter requirement');
  assert(appSource.includes("RPChessResourceIcons?.iconize?.(screen.querySelector('[data-events-outcome-notes]'))"),
    'Event outcome resource notes must use the same icon treatment');
  const landscapeCss=fs.readFileSync(path.join(game,'css/landscape-ui-redesign.css'),'utf8');
  const uiSource=fs.readFileSync(path.join(game,'localization/ui.mjs'),'utf8');
  assert(appSource.includes("import { subscribe, t, translateLegacy } from './i18n.mjs'"),'Events owner must consume semantic i18n directly while retaining explicit content translation');
  assert(appSource.includes("t('events.ariaLabel')")&&appSource.includes("t('events.choice.guaranteed')")&&appSource.includes("t('events.guaranteedOutcome')"),'Event chrome/chance/outcome copy must be owner-keyed');
  assert(appSource.includes("t('events.hero.deadLocked',{name})")&&appSource.includes("t('events.hero.woundedLocked',{name})"),'hero-state presentation must be owner-keyed');
  assert(appSource.includes('presentEventText(paragraph)')&&appSource.includes('translateLegacy(String(value ?? \'\'))'),'authored Event narrative must keep explicit content translation rather than moving into UI keys');
  assert(appSource.includes('subscribe(() =>')&&appSource.includes('renderStaticCopy()'),'Events owner must refresh its own chrome/content on language change');
  assert(!appSource.includes("localizeEventSource(outcome.success ? 'УСПЕХ' : 'НЕУДАЧА')")&&!appSource.includes("localizeEventSource('ПРОДОЛЖИТЬ ПУТЬ')"),'Events runtime must not rely on legacy DOM/content translation for keyed chrome');
  assert(appSource.includes("addEventListener('rpchess:combat-completed',syncRun)"),'Events must complete Event combat from the semantic combat lifecycle');
  assert(!appSource.includes("addEventListener('rpchess:run-updated',syncRun)"),'Events must not subscribe to broad run-updated for combat completion');
  const eventChoiceLandscapeBlocks=[...landscapeCss.matchAll(/body\.events-active \.events-choices\s*\{([^}]*)\}/g)].map(([,block])=>block);
  assert(eventChoiceLandscapeBlocks.length>=2,'landscape owner must define scoped tablet and phone Event choice rails');
  assert(eventChoiceLandscapeBlocks.every(block=>!block.includes('repeat(2')),'scoped Event landscape rails must never return to two columns');
  assert(eventChoiceLandscapeBlocks.every(block=>block.includes('grid-template-columns: minmax(0,1fr)')),'scoped Event landscape rails must remain one readable column');
  for(const key of ["'events.kicker'","'events.choice.successChance'","'events.hero.deadLocked'","'events.roll'"])assert(uiSource.includes(key),`Events i18n registry missing ${key}`);

  console.log('Events 500/2114, v4 inline narrative, canonical 36-background register, 20% five-type Travel, 12-star combat, King risk, persistence, owner-keyed chrome and semantic combat lifecycle: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
