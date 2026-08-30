const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const data=await import(pathToFileURL(path.join(game,'js/events-data.mjs')).href);
  const core=await import(pathToFileURL(path.join(game,'js/events-core.mjs')).href);
  const v3=await import(pathToFileURL(path.join(game,'js/events/event-content-v3.mjs')).href);

  const authored=v3.EVENT_CONTENT_V3;
  const ids=Object.keys(authored);
  assert.strictEqual(ids.length,100,'Events v3 must contain exactly 100 events');
  assert.deepStrictEqual(ids.sort(),[...data.EVENT_IDS].sort(),'Events v3 IDs must match the canonical event catalog');
  const authoredChoices=ids.flatMap(id=>Object.entries(authored[id].choices||{}).map(([choiceId,choice])=>({eventId:id,choiceId,...choice})));
  assert.strictEqual(authoredChoices.length,415,'Events v3 must contain exactly 415 choice labels');
  assert.strictEqual(ids.filter(id=>Boolean(authored[id].kingReaction)).length,30,'Events v3 must contain exactly 30 King reactions');
  assert.strictEqual(authoredChoices.filter(choice=>Boolean(choice.heroReaction)).length,103,'Events v3 must contain exactly 103 hero reactions');
  assert(!JSON.stringify(authored).includes('[HERO REACTION]'),'editorial HERO markers must never ship to runtime content');
  assert(!JSON.stringify(authored).includes('[KING REACTION]'),'editorial KING markers must never ship to runtime content');

  const mechanicsKeys=['id','chance','role','cost','successCost','successEffects','failureEffects','alwaysEffects','kingRisk','warnings'];
  for(const sourceEvent of data.EVENT_CATALOG){
    const base=core.normalizedEvent(sourceEvent.id);
    const shown=v3.applyEventContentV3(base);
    const override=authored[sourceEvent.id];
    assert(override,`${sourceEvent.id} must have v3 content`);
    assert.strictEqual(shown.title,override.title,`${sourceEvent.id} title must come from v3`);
    assert.deepStrictEqual(shown.storyParagraphs,override.storyParagraphs,`${sourceEvent.id} scene must match v3 exactly`);
    assert(shown.storyParagraphs.length>=2,`${sourceEvent.id} v3 scene must have multiple paragraphs`);
    assert.strictEqual(shown.choices.length,base.choices.length,`${sourceEvent.id} choice count must not change`);
    for(const baseChoice of base.choices){
      const presented=shown.choices.find(choice=>choice.id===baseChoice.id);
      const choiceOverride=override.choices[baseChoice.id];
      assert(presented&&choiceOverride,`${baseChoice.id} must exist in v3 presentation`);
      assert.strictEqual(presented.action,choiceOverride.action,`${baseChoice.id} action must use v3 copy`);
      for(const key of mechanicsKeys)assert.deepStrictEqual(presented[key],baseChoice[key],`${baseChoice.id} must preserve mechanical field ${key}`);
      if(choiceOverride.heroReaction){
        assert(baseChoice.role,`${baseChoice.id} hero reaction must be tied to a role-gated choice`);
        assert.strictEqual(choiceOverride.heroReaction.role,baseChoice.role,`${baseChoice.id} hero reaction role must match mechanical role`);
      }
    }
  }

  const named=v3.formatHeroReaction({role:'rook',text:'{rookName} держит строй.'},{id:'hero.aldric_wall',name:'Альдрик Стена',portrait:'assets/heroes/aldric_wall/portrait.png'});
  assert.strictEqual(named,'Альдрик Стена держит строй.','named personalized hero must replace the role placeholder');
  const fallback=v3.formatHeroReaction({role:'rook',text:'{rookName} держит строй.'},{id:'unit.rook',name:'Ладья',portrait:'generated_assets/unit_rook_player.png'});
  assert.strictEqual(fallback,'Ваша Ладья держит строй.','non-personalized hero must use the authored generic fallback');
  const missing=v3.formatHeroReaction({role:'bishop',text:'{bishopName} изучает знаки.'},null);
  assert.strictEqual(missing,'Ваш Слон изучает знаки.','missing personalized hero must use the role fallback');

  console.log('Events v3 100/415, 30 King reactions, 103 role reactions and mechanics isolation: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
