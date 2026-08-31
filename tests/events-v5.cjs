const path=require('path'),assert=require('assert'),fs=require('fs'),{pathToFileURL}=require('url');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const game=path.join(root,'game');
  const data=await import(pathToFileURL(path.join(game,'js/events-data.mjs')).href);
  const core=await import(pathToFileURL(path.join(game,'js/events-core.mjs')).href);
  const v5=await import(pathToFileURL(path.join(game,'js/events/event-hero-choices-v5.mjs')).href);
  const persistence=await import(pathToFileURL(path.join(game,'js/run-persistence.mjs')).href);
  const settlement=await import(pathToFileURL(path.join(game,'js/settlement-core.mjs')).href);

  assert.strictEqual(v5.EVENT_HERO_CHOICE_COUNT,537,'Events v5 must contain exactly 537 named-hero variants');
  assert.strictEqual(Object.keys(v5.EVENT_HERO_CHOICES_V5).length,500,'Events v5 must cover all 500 events');
  assert.strictEqual(Object.keys(v5.HERO_DEFS).length,36,'Events v5 must map HERO-01..HERO-36');

  const heroCounts=new Map();
  const heroLines=[];
  for(const eventId of data.EVENT_IDS){
    const specs=v5.heroChoiceSpecsForEvent(eventId);
    assert(specs.length>=1&&specs.length<=2,`${eventId} must have 1-2 named-hero variants`);
    const rawEvent=data.eventById(eventId);
    assert(rawEvent,`${eventId} raw event must exist`);
    const normalized=core.normalizedEvent(eventId);
    assert(normalized,`${eventId} normalized event must exist`);
    const personal=normalized.choices.filter((choice)=>choice.requiredHeroId);
    assert.strictEqual(personal.length,specs.length,`${eventId} must materialize every v5 personal choice`);

    for(const spec of specs){
      heroCounts.set(spec.requiredHeroId,(heroCounts.get(spec.requiredHeroId)||0)+1);
      heroLines.push(spec.heroLine);
      assert(spec.heroLine&&spec.heroLine.trim(),`${eventId}/${spec.requiredHeroId} must have a hero line`);
      const rawBase=rawEvent.choices.find((choice)=>choice.id===spec.baseChoiceId);
      assert(rawBase,`${eventId} must contain source choice ${spec.baseChoiceId}`);
      const base=core.normalizeChoice(rawBase);
      const matches=personal.filter((choice)=>choice.requiredHeroId===spec.requiredHeroId&&choice.sourceChoiceId===spec.baseChoiceId);
      assert.strictEqual(matches.length,1,`${eventId}/${spec.requiredHeroId}/${spec.baseChoiceId} must materialize once`);
      const choice=matches[0];
      assert.strictEqual(choice.role,null,`${choice.id} must not retain an abstract role gate`);
      assert.strictEqual(choice.heroReaction,null,`${choice.id} must use only its v5 heroLine`);
      assert.strictEqual(choice.chance,base.chance,`${choice.id} chance must reuse source choice`);
      assert.deepStrictEqual(choice.cost,base.cost,`${choice.id} cost must reuse source choice`);
      const expectedEffects=(effects)=>effects.map((effect)=>{
        if((effect.type==='wound'||effect.type==='death')&&(effect.target==='roleHero'||effect.target==='king'))return{...effect,target:'heroId',heroId:spec.requiredHeroId};
        return{...effect};
      });
      assert.deepStrictEqual(choice.successEffects,expectedEffects(base.successEffects),`${choice.id} success mechanics must reuse source choice`);
      assert.deepStrictEqual(choice.failureEffects,expectedEffects(base.failureEffects),`${choice.id} failure mechanics must reuse source choice`);
      assert.deepStrictEqual(choice.alwaysEffects,expectedEffects(base.alwaysEffects),`${choice.id} always mechanics must reuse source choice`);
      if(base.role)assert(!normalized.choices.some((entry)=>entry.id===base.id),`${eventId} abstract role choice ${base.id} must be superseded`);
      else assert(normalized.choices.some((entry)=>entry.id===base.id),`${eventId} ordinary source choice ${base.id} must remain beside hero choice`);
    }
  }

  assert.strictEqual(heroCounts.size,36,'all 36 named heroes must have Event variants');
  for(const [heroId,count] of heroCounts)assert(count>=8,`${heroId} must appear in at least 8 Events v5 variants`);
  assert.strictEqual(new Set(heroLines).size,537,'Events v5 hero lines must not repeat verbatim');

  const route={id:'travel.event.v5',step:1,type:'event',label:'СОБЫТИЕ',stars:6,threatLabel:'',flavor:'',mechanicalHint:'',seed:'events-v5-seed',supplyCostAtSelection:1,supplyPaid:1};
  let run=persistence.createRun({id:'events-v5-availability',now:1});
  run={...run,gold:999,supplies:99,roster:run.roster.filter((hero)=>hero.id!=='hero.batu_cliff')};
  const batuChoice=core.normalizedEvent('E001').choices.find((choice)=>choice.requiredHeroId==='hero.batu_cliff');
  assert(batuChoice,'E001 must expose Batu personal variant');
  let availability=core.choiceAvailability(run,batuChoice);
  assert.strictEqual(availability.enabled,false);
  assert(availability.reason.includes('Бату Утёс')&&availability.reason.includes('НЕТ В ОТРЯДЕ'),'absent named hero must stay visible as a locked choice');

  const batu={id:'hero.batu_cliff',name:'Бату Утёс',pieceType:'rook',status:'healthy',isRunKing:false};
  run={...run,roster:[...run.roster,batu]};
  availability=core.choiceAvailability(run,batuChoice);assert.strictEqual(availability.enabled,true);assert.strictEqual(availability.hero.id,batu.id);
  run={...run,roster:run.roster.map((hero)=>hero.id===batu.id?{...hero,status:'wounded'}:hero)};
  availability=core.choiceAvailability(run,batuChoice);assert.strictEqual(availability.enabled,false);assert(availability.reason.includes('РАНЕН'));
  run={...run,roster:run.roster.map((hero)=>hero.id===batu.id?{...hero,status:'dead'}:hero)};
  availability=core.choiceAvailability(run,batuChoice);assert.strictEqual(availability.enabled,false);assert(availability.reason.includes('ПОГИБ'));

  const vaelProfile=settlement.RECRUIT_LIBRARY.find((hero)=>hero.id==='hero.vael_hammer');
  assert(vaelProfile,'Vael must exist in recruit library');
  let vaelFailure=null;
  for(let i=0;i<500&&!vaelFailure;i++){
    let candidate=persistence.createRun({id:`events-v5-vael-${i}`,now:i+10});
    const vael={...vaelProfile,status:'healthy',isRunKing:false};
    candidate={...candidate,gold:999,supplies:99,activeTravelChoice:{...route,seed:`vael-${i}`},currentTravelChoices:null,currentEvent:{routeId:route.id,eventId:'E010',choiceId:null,roll:null,success:null,resolved:false,outcome:null,combat:null},roster:[...candidate.roster.filter((hero)=>hero.id!==vael.id),vael]};
    const result=core.resolveEventChoice(candidate,'E010.H04');
    if(result.success&&result.outcome&&!result.outcome.success)vaelFailure=result;
  }
  assert(vaelFailure,'must find deterministic E010 failure case');
  assert.strictEqual(vaelFailure.run.roster.find((hero)=>hero.id==='hero.vael_hammer').status,'wounded','personalized wound risk must hit Vael specifically');

  let ergenFailure=null;
  for(let i=0;i<500&&!ergenFailure;i++){
    let candidate=persistence.createRun({id:`events-v5-ergen-${i}`,now:i+1000});
    const ergen={id:'hero.ergen_cloud',name:'Эрген Облако',pieceType:'king',status:'healthy',isRunKing:false};
    candidate={...candidate,gold:999,supplies:99,activeTravelChoice:{...route,seed:`ergen-${i}`},currentTravelChoices:null,currentEvent:{routeId:route.id,eventId:'E100',choiceId:null,roll:null,success:null,resolved:false,outcome:null,combat:null},roster:[...candidate.roster.filter((hero)=>hero.id!==ergen.id),ergen]};
    const result=core.resolveEventChoice(candidate,'E100.H36');
    if(result.success&&result.outcome&&!result.outcome.success)ergenFailure=result;
  }
  assert(ergenFailure,'must find deterministic E100 failure case');
  assert.strictEqual(ergenFailure.run.roster.find((hero)=>hero.id==='hero.ergen_cloud').status,'dead','E100 personal King-role risk must target Ergen, not the run King');
  const runKing=ergenFailure.run.roster.find((hero)=>hero.isRunKing);assert(runKing);assert.notStrictEqual(runKing.status,'dead','current run King must survive Ergen personal failure');
  assert.strictEqual(ergenFailure.run.ended,false,'non-runKing named King death must not end the run');

  const app=fs.readFileSync(path.join(game,'js/events-app.mjs'),'utf8');
  const css=fs.readFileSync(path.join(game,'css/events-v5.css'),'utf8');
  assert(app.includes('data-required-hero-id')||app.includes('dataset.requiredHeroId'),'Events UI must tag named hero choices');
  assert(app.includes('НЕТ В ОТРЯДЕ')&&app.includes('choice.heroLine'),'Events UI must show locked hero identity and hero line');
  assert(css.includes('.events-choice--hero-locked:disabled')&&css.includes('opacity:.78'),'locked hero choice must remain readable');

  console.log('Events v5 500/537 named-hero variants, locked visibility, exact hero risk and mechanic reuse: PASS');
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
