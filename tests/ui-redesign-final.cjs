const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),game=path.join(root,'game');
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');

(async()=>{
  const finalUi=read('game/js/ui-redesign-final.mjs');
  const finalCss=read('game/css/ui-redesign-final.css');
  const sideColorsCss=read('game/css/combat-side-colors.css');
  const resourcesCss=read('game/css/resources.css');
  const puzzlesCss=read('game/css/puzzles.css');
  const loader=read('game/js/post-redesign-playtest-pass1b.mjs');
  const travelApp=read('game/js/travel-choice-app.mjs');
  const travelCoreSource=read('game/js/travel-choice-core.mjs');
  const ux=read('game/js/ux-consistency.mjs');
  const crossScene=read('game/js/cross-scene-visuals.mjs');
  const events=read('game/js/events-app.mjs');
  const battleCore=read('game/js/battle-core.mjs');
  const battleMercenaries=read('game/js/battle-mercenaries.mjs');
  const build=read('scripts/build.cjs');
  const pkg=JSON.parse(read('package.json'));

  for(const relative of [
    'game/css/travel-choice-commandbar-pass.css','game/css/compact-run-screens-pass.css','game/css/compact-combat-ui-pass.css','game/css/compact-ui-pass3.css','game/css/compact-ui-pass4.css','game/css/post-redesign-playtest-pass1b.css',
    'game/js/travel-choice-commandbar-pass.mjs','game/js/compact-combat-ui-pass.mjs','game/js/compact-ui-pass3.mjs','game/js/compact-ui-pass4.mjs'
  ]) assert(!fs.existsSync(path.join(root,relative)),`${relative} must be removed after consolidation`);

  assert.strictEqual(loader.trim(),"import './ui-redesign-final.mjs';",'legacy loader may only delegate to the consolidated final redesign module');
  assert(finalUi.includes("CSS_HREF='css/ui-redesign-final.css?v=20260902-cleanup2'"),'final redesign stylesheet must be cache-busted');
  assert(finalUi.includes("SIDE_COLORS_CSS_HREF='css/combat-side-colors.css?v=20260903-aura1'"),'combat aura stylesheet must be cache-busted independently');
  assert(!finalUi.includes('MutationObserver')&&!finalUi.includes('LIVE_OVERRIDE_CSS'),'final redesign module must not rely on global observers or live injected CSS');
  assert(finalUi.includes('RPChessBattle?.battlePlan')&&finalUi.includes('RPChessSkirmish?.battlePlan'),'combat presentation must derive from canonical battlePlan state');
  assert(finalUi.includes("import { placeArmy } from './skirmish-core.mjs'")&&finalUi.includes('BLACK_GLYPHS'),'Skirmish preview must use canonical formation data and preserve black-side glyphs without observers');
  assert(finalUi.includes('GLYPHS_BY_COLOR')&&finalUi.includes('mark.dataset.pieceColor=side')&&finalUi.includes('syncBattleFormation(screen,color)'),'Battle/Skirmish prep technical glyphs must derive from encounter player color');
  assert(finalUi.includes("document.body.classList.toggle('run-combat-board-active',Boolean(kind))"),'persistent side aura must be enabled only while the shared board is an active run combat');
  assert(sideColorsCss.includes('.skirmish-card__tech-glyph[data-piece-color="w"]')&&sideColorsCss.includes('.battle-card__tech-glyph[data-piece-color="b"]'),'prep card glyphs must expose white/black presentation states');
  assert(sideColorsCss.includes('.skirmish-formation-cell[data-piece-color="b"]')&&sideColorsCss.includes('.battle-formation-cell span[data-piece-color="w"]'),'formation preview glyphs must expose white/black presentation states');
  assert(sideColorsCss.includes("--combat-aura-image:url('../assets/vfx/aura_white.png')")&&sideColorsCss.includes("--combat-aura-image:url('../assets/vfx/aura_black.png')"),'white/black combat pieces must use the supplied aura art');
  assert(!sideColorsCss.includes('radial-gradient'),'procedural radial combat glow must be fully replaced by aura assets');
  assert(sideColorsCss.includes('.classic-square--check:has(.classic-piece-marker)')&&sideColorsCss.includes("--combat-aura-image:url('../assets/vfx/aura_red.png')"),'check must replace side art with the supplied red aura');
  assert(sideColorsCss.includes('background-size:100% 100%'),'combat aura must fit the board square without changing its geometry');
  assert(finalUi.includes('OBSOLETE_HIDDEN_CONTROLS')&&finalUi.includes('removeObsoleteHiddenControls()'),'deprecated invisible scene controls must be removed from the runtime DOM instead of being kept as hidden hooks');
  for(const selector of ['[data-skirmish-back]','[data-battle-back]','[data-puzzle-roster]','[data-settlement-roster]','[data-settlement-settings]','[data-events-roster]','[data-events-settings]'])assert(finalUi.includes(`'${selector}'`),`${selector} must be included in invisible-control cleanup`);
  assert(finalCss.includes('.travel-choice-topbar--command')&&finalCss.includes('.events-copy-frame')&&finalCss.includes('.events-choice-frame'),'approved Travel and Events structures must live in one final stylesheet');
  assert(!finalCss.includes("content:'Тренировка'")&&!finalCss.includes('font-size:0'),'final stylesheet must not use text-replacement hacks for Training or hidden semantic labels');
  assert(!resourcesCss.includes('.travel-choice-card--puzzle .travel-choice-card__type')&&!resourcesCss.includes("content: 'ТРЕНИРОВКА'"),'legacy Resources CSS must not replace the semantic Training label with font-size:0 + ::after');
  assert(puzzlesCss.includes('html[lang="en"] .puzzle-heading .reboot-eyebrow:after')&&puzzlesCss.includes("content:'TRAINING'"),'Puzzle CSS must localize its generated Training label from document language');
  const battleActionbarStyle=crossScene.match(/\.battle-screen \.battle-actionbar\s*\{([\s\S]*?)\}/)?.[1]||'';
  assert(battleActionbarStyle.includes('display:none!important')&&!battleActionbarStyle.includes('display:flex!important'),'cross-scene visuals must not revive the legacy Battle actionbar on mobile');
  assert(!crossScene.includes('MutationObserver'),'cross-scene visual refresh must be lifecycle-driven, not a global subtree observer');
  assert(crossScene.includes("'rpchess:run-updated'")&&crossScene.includes("'rpchess:event-open'")&&crossScene.includes("'rpchess:run-continue'"),'cross-scene visual refresh must subscribe to canonical lifecycle events');

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
  assert(!battleMercenaries.includes('normalizeBattleCopy')&&!battleMercenaries.includes("replace(/\\s*Победа решится"),'Battle Mercenaries runtime must not rewrite canonical Battle copy with presentation regexes');
  assert(battleMercenaries.includes('if (start?.parentNode === actionbar) actionbar.insertBefore(actionCost, start);')&&battleMercenaries.includes('else actionbar.append(actionCost);'),'Mercenary action-cost hook must tolerate the Start CTA being relocated out of the legacy actionbar');

  for(const obsolete of ['travel-choice-commandbar-pass','compact-run-screens-pass','compact-combat-ui-pass','compact-ui-pass3','compact-ui-pass4']) assert(!build.includes(obsolete),`build must not package obsolete ${obsolete} layers`);
  assert(build.includes("'css/ui-redesign-final.css'")&&build.includes("'css/combat-side-colors.css'")&&build.includes("'js/ui-redesign-final.mjs'"),'production build must package the consolidated redesign and combat aura layer');
  for(const aura of ['aura_white.png','aura_black.png','aura_red.png'])assert(build.includes(`'assets/vfx/${aura}'`),`production build must package ${aura}`);
  assert(pkg.scripts['test:ui']==='node tests/ui-redesign-final.cjs','package must expose one final UI contract test');
  assert(pkg.scripts.test.includes('tests/aura-asset-runtime.cjs'),'main test command must verify combat aura source assets');
  assert(!pkg.scripts.test.includes('travel-choice-ui.cjs')&&!pkg.scripts.test.includes('compact-ui-pass4.cjs'),'main test command must not require superseded UI tests');

  console.log('Consolidated UI redesign contracts, side-colored aura presentation, canonical Travel gating and lifecycle presentation: PASS');
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1});
