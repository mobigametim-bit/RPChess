const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),game=path.join(root,'game');
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');

(async()=>{
  const finalUi=read('game/js/ui-redesign-final.mjs');
  const finalCss=read('game/css/ui-redesign-final.css');
  const loader=read('game/js/post-redesign-playtest-pass1b.mjs');
  const travelApp=read('game/js/travel-choice-app.mjs');
  const travelCoreSource=read('game/js/travel-choice-core.mjs');
  const ux=read('game/js/ux-consistency.mjs');
  const events=read('game/js/events-app.mjs');
  const battleCore=read('game/js/battle-core.mjs');
  const build=read('scripts/build.cjs');
  const pkg=JSON.parse(read('package.json'));

  for(const relative of [
    'game/css/travel-choice-commandbar-pass.css','game/css/compact-run-screens-pass.css','game/css/compact-combat-ui-pass.css','game/css/compact-ui-pass3.css','game/css/compact-ui-pass4.css','game/css/post-redesign-playtest-pass1b.css',
    'game/js/travel-choice-commandbar-pass.mjs','game/js/compact-combat-ui-pass.mjs','game/js/compact-ui-pass3.mjs','game/js/compact-ui-pass4.mjs'
  ]) assert(!fs.existsSync(path.join(root,relative)),`${relative} must be removed after consolidation`);

  assert.strictEqual(loader.trim(),"import './ui-redesign-final.mjs';",'legacy loader may only delegate to the consolidated final redesign module');
  assert(finalUi.includes("CSS_HREF='css/ui-redesign-final.css?v=20260902-cleanup2'"),'final redesign stylesheet must be cache-busted');
  assert(!finalUi.includes('MutationObserver')&&!finalUi.includes('LIVE_OVERRIDE_CSS'),'final redesign module must not rely on global observers or live injected CSS');
  assert(finalUi.includes('RPChessBattle?.battlePlan')&&finalUi.includes('RPChessSkirmish?.battlePlan'),'combat presentation must derive from canonical battlePlan state');
  assert(finalUi.includes("import { placeArmy } from './skirmish-core.mjs'")&&finalUi.includes('BLACK_GLYPHS'),'Skirmish preview must use canonical formation data and preserve black-side glyphs without observers');
  assert(finalCss.includes('.travel-choice-topbar--command')&&finalCss.includes('.events-copy-frame')&&finalCss.includes('.events-choice-frame'),'approved Travel and Events structures must live in one final stylesheet');
  assert(!finalCss.includes("content:'Тренировка'")&&!finalCss.includes('font-size:0'),'final stylesheet must not use text-replacement hacks for Training or hidden semantic labels');

  const gateIndex=travelApp.indexOf('if(!canSelectTravelChoice(current,choice).ok)');
  const paymentIndex=travelApp.indexOf('applyTravelSupplyCost(current)');
  assert(gateIndex>=0&&paymentIndex>gateIndex,'Skirmish eligibility must be rechecked before Travel spends Supplies');
  assert(travelApp.includes("import { TRAVEL_SUPPLY_COST, applyTravelSupplyCost, combatGoldReward } from './resources-core.mjs'")&&travelApp.includes("import { puzzleBaseGold } from './puzzles/puzzle-core.mjs'"),'Travel reward/cost presentation must use canonical economy formulas directly');
  assert(travelApp.includes("choice.type==='puzzle'?'Тренировка':choice.label"),'Training label must be rendered semantically by Travel');
  assert(travelApp.includes('data-travel-inline-gold')&&travelApp.includes('data-travel-inline-supplies')&&travelApp.includes('renderResources()'),'Travel command resources must have one canonical screen renderer');
  assert(travelCoreSource.includes('canSelectTravelChoice')&&travelCoreSource.includes('skirmish_requires_companion'),'Skirmish availability rule must live in Travel core');

  const travel=await import(pathToFileURL(path.join(game,'js/travel-choice-core.mjs')).href);
  const skirmishChoice=travel.createTravelChoices({runId:'ui-cleanup-skirmish',step:1,types:['skirmish'],playerPower:500})[0];
  const king={id:'king',isRunKing:true,status:'healthy'};
  const healthyHero={id:'hero',isRunKing:false,status:'healthy'};
  const woundedHero={id:'wounded',isRunKing:false,status:'wounded'};
  assert.deepStrictEqual(travel.canSelectTravelChoice({roster:[king]},skirmishChoice),{ok:false,reason:'skirmish_requires_companion'});
  assert.deepStrictEqual(travel.canSelectTravelChoice({roster:[king,woundedHero]},skirmishChoice),{ok:false,reason:'skirmish_requires_companion'});
  assert.deepStrictEqual(travel.canSelectTravelChoice({roster:[king,healthyHero]},skirmishChoice),{ok:true,reason:null});

  assert(!ux.includes('MutationObserver')&&!ux.includes('activeCombatPresentation'),'shared UX must be lifecycle-driven and must not remember combat type from a Start click');
  assert(ux.includes('function activeCombat()')&&ux.includes('RPChessBattle?.battlePlan')&&ux.includes('RPChessSkirmish?.battlePlan'),'shared combat summary must derive from canonical runtime state');
  assert(ux.includes("'rpchess:run-updated'")&&ux.includes("'rpchess:travel-open'")&&ux.includes("'rpchess:event-open'"),'shared UX refresh must be connected to lifecycle events');

  assert(events.includes("state:'missing'")&&events.includes("state:'wounded'")&&events.includes("state:'dead'")&&events.includes('button.dataset.heroState = heroState.state'),'Event hero locks must expose distinct semantic states');
  assert(events.includes("if (!hero) return { hero:null, name, state:'missing', locked:true, label:'🔒' }"),'missing Event hero must show only the lock in the upper strip');
  assert(!battleCore.includes('Победа решится по классическим шахматным правилам.'),'Battle copy cleanup must live in encounter data rather than presentation regex replacement');

  for(const obsolete of ['travel-choice-commandbar-pass','compact-run-screens-pass','compact-combat-ui-pass','compact-ui-pass3','compact-ui-pass4']) assert(!build.includes(obsolete),`build must not package obsolete ${obsolete} layers`);
  assert(build.includes("'css/ui-redesign-final.css'")&&build.includes("'js/ui-redesign-final.mjs'"),'production build must package the consolidated redesign');
  assert(pkg.scripts['test:ui']==='node tests/ui-redesign-final.cjs','package must expose one final UI contract test');
  assert(!pkg.scripts.test.includes('travel-choice-ui.cjs')&&!pkg.scripts.test.includes('compact-ui-pass4.cjs'),'main test command must not require superseded UI tests');

  console.log('Consolidated UI redesign contracts, canonical Travel gating and lifecycle presentation: PASS');
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
