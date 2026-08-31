const path=require('path'),assert=require('assert'),fs=require('fs'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const data=await import(pathToFileURL(path.join(game,'js/events-data.mjs')).href);
  const core=await import(pathToFileURL(path.join(game,'js/events-core.mjs')).href);
  const v3=await import(pathToFileURL(path.join(game,'js/events/event-content-v3.mjs')).href);

  const authored=v3.EVENT_CONTENT_V3;
  const ids=Object.keys(authored);
  const legacyIds=data.EVENT_IDS.filter(id=>Number(id.slice(1))<=100);
  assert.strictEqual(ids.length,100,'Events v3 overlay must remain the accepted 100-event presentation layer');
  assert.deepStrictEqual(ids.sort(),[...legacyIds].sort(),'Events v3 IDs must match the accepted E001-E100 slice of the expanded catalog');
  const authoredChoices=ids.flatMap(id=>Object.entries(authored[id].choices||{}).map(([choiceId,choice])=>({eventId:id,choiceId,...choice})));
  assert.strictEqual(authoredChoices.length,415,'Events v3 must contain exactly 415 accepted choice labels');
  assert.strictEqual(ids.filter(id=>Boolean(authored[id].kingReaction)).length,30,'Events v3 must contain exactly 30 King reactions');
  assert.strictEqual(authoredChoices.filter(choice=>Boolean(choice.heroReaction)).length,103,'Events v3 must contain exactly 103 hero reactions');
  assert(!JSON.stringify(authored).includes('[HERO REACTION]'),'editorial HERO markers must never ship to runtime content');
  assert(!JSON.stringify(authored).includes('[KING REACTION]'),'editorial KING markers must never ship to runtime content');

  const mechanicsKeys=['id','chance','role','cost','successCost','successEffects','failureEffects','alwaysEffects','kingRisk','warnings'];
  for(const eventId of legacyIds){
    const sourceEvent=data.eventById(eventId);
    const base=core.normalizedEvent(sourceEvent.id);
    const shown=v3.applyEventContentV3(base);
    const override=authored[sourceEvent.id];
    assert(override,`${sourceEvent.id} must have v3 content`);
    assert.strictEqual(shown.title,override.title,`${sourceEvent.id} title must come from v3`);
    assert.deepStrictEqual(shown.storyParagraphs,override.storyParagraphs,`${sourceEvent.id} scene must match v3 exactly`);
    assert(shown.storyParagraphs.length>=2,`${sourceEvent.id} v3 scene must have multiple paragraphs`);
    assert.strictEqual(shown.choices.length,base.choices.length,`${sourceEvent.id} choice count must not change during v3 presentation`);
    for(const baseChoice of base.choices){
      const presented=shown.choices.find(choice=>choice.id===baseChoice.id);
      const sourceChoiceId=baseChoice.sourceChoiceId||baseChoice.id;
      const choiceOverride=override.choices[sourceChoiceId];
      assert(presented&&choiceOverride,`${baseChoice.id} must retain a valid v3 source presentation`);
      if(baseChoice.requiredHeroId){
        assert.strictEqual(presented.heroReaction,null,`${baseChoice.id} personal v5 choice must not duplicate the old abstract v3 reaction`);
      }else{
        assert.strictEqual(presented.action,choiceOverride.action,`${baseChoice.id} ordinary action must use v3 copy`);
      }
      for(const key of mechanicsKeys)assert.deepStrictEqual(presented[key],baseChoice[key],`${baseChoice.id} must preserve mechanical field ${key}`);
      if(choiceOverride.heroReaction&&!baseChoice.requiredHeroId){
        assert(baseChoice.role,`${baseChoice.id} legacy hero reaction must remain tied to a role-gated choice`);
        assert.strictEqual(choiceOverride.heroReaction.role,baseChoice.role,`${baseChoice.id} hero reaction role must match mechanical role`);
      }
    }
  }

  const app=fs.readFileSync(path.join(game,'js/events-app.mjs'),'utf8');
  assert(app.includes('choice.sourceChoiceId')&&app.includes('EVENT_CONTENT_V3'),'Events v5 UI must reuse accepted v3 action copy for personal variants');

  const v4=data.eventById('E101');
  assert(v4&&Array.isArray(v4.storyParagraphs),'E101 must exist as inline v4 content');
  assert.strictEqual(v3.applyEventContentV3(v4),v4,'v3 overlay must leave E101-E500 inline v4 content untouched');

  const named=v3.formatHeroReaction({role:'rook',text:'{rookName} держит строй.'},{id:'hero.aldric_wall',name:'Альдрик Стена',portrait:'assets/heroes/aldric_wall/portrait.png'});
  assert.strictEqual(named,'Альдрик Стена держит строй.','named personalized hero must replace the role placeholder');
  const fallback=v3.formatHeroReaction({role:'rook',text:'{rookName} держит строй.'},{id:'unit.rook',name:'Ладья',portrait:'generated_assets/unit_rook_player.png'});
  assert.strictEqual(fallback,'Ваша Ладья держит строй.','non-personalized hero must use the authored generic fallback');
  const missing=v3.formatHeroReaction({role:'bishop',text:'{bishopName} изучает знаки.'},null);
  assert.strictEqual(missing,'Ваш Слон изучает знаки.','missing personalized hero must use the role fallback');

  console.log('Events v3 accepted presentation preserved under Events v5 named-hero overlay: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
