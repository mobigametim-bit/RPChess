const fs=require('fs'),path=require('path');
function fail(message){throw new Error(`[reboot source verification] ${message}`)}
function read(root,relative){return fs.readFileSync(path.join(root,relative),'utf8')}
function requireFile(root,relative){const full=path.join(root,relative);if(!fs.existsSync(full)||!fs.statSync(full).isFile())fail(`missing required file: ${relative}`)}
function requireTokens(source,tokens,label){for(const token of tokens)if(!source.includes(token))fail(`${label} contract missing: ${token}`)}
module.exports=function verifySource(root){
  const required=['index.html','BUILD_INFO.json','css/reboot-foundation.css','css/classic-chess.css','css/chess-ai-polish.css','css/roster.css','css/skirmish.css','css/battle.css','css/travel-choice.css','css/resources.css','css/settlement.css','css/starvation.css','css/events.css','css/puzzles.css','css/ux-consistency.css','js/reboot-foundation.mjs','js/reboot-audio.mjs','js/classic-chess-engine.mjs','js/classic-chess-app.mjs','js/chess-ai-adapter.mjs','js/roster-data.mjs','js/run-persistence.mjs','js/roster-app.mjs','js/encounter-difficulty.mjs','js/race-assets.mjs','js/event-narrative.mjs','js/skirmish-core.mjs','js/skirmish-app.mjs','js/battle-core.mjs','js/battle-app.mjs','js/battle-route.mjs','js/travel-choice-core.mjs','js/travel-choice-app.mjs','js/ux-consistency.mjs','js/resources-core.mjs','js/resources-app.mjs','js/settlement-core.mjs','js/settlement-app.mjs','js/starvation-core.mjs','js/starvation-app.mjs','js/events-data.mjs','js/events-core.mjs','js/events-app.mjs','js/puzzles/puzzle-core.mjs','js/puzzles/puzzle-catalog.mjs','js/puzzles/puzzle-app.mjs','fonts/BrahmsGotischCyr.otf','generated_assets/title_wordmark.png','generated_assets/splash_poster.jpg','generated_assets/node_battle.png','generated_assets/node_elite.png','generated_assets/node_shop.png','generated_assets/node_event.png','generated_assets/node_training.png','generated_assets/reward_gold.png','music/echoes_iron_throne_01.mp3','music/echoes_iron_throne_02.mp3','music/echoes_iron_throne_03.mp3','music/echoes_iron_throne_04.mp3','assets/kings/oathkeeper/portrait.png','assets/kings/oathkeeper/piece.png'];
  for(let i=1;i<=10;i++)required.push(`js/events/event-data-${String(i).padStart(2,'0')}.mjs`);
  for(const side of ['player','enemy'])for(const piece of ['pawn','knight','bishop','rook','queen','king'])required.push(`generated_assets/unit_${piece}_${side}.png`);
  const pieces=['pawn','knight','bishop','rook','queen','king'],races=['elves','orcs','undead','dark_elves','dwarves','demons','angels','dragonborn','beastfolk','constructs','animals','fae','goblins'];
  for(const piece of pieces){required.push(`assets/races/humans/pieces/white/${piece}.png`);required.push(`assets/races/humans/pieces/black/${piece}.png`);}
  for(const race of races)for(const piece of pieces)required.push(`assets/races/${race}/pieces/${piece}.png`);
  const backgrounds={generic:['forest_crossroad.png','old_kings_road.png','roadside_shrine.png','abandoned_camp.png','ancient_ruins.png','stormy_bridge.png','moonlit_gravefield.png','market_square_twilight.png'],humans:['human_waystation.png','human_chapel_court.png'],elves:['elven_glade.png','elven_waystones.png'],orcs:['orc_war_camp.png','orc_trial_circle.png'],undead:['necropolis_gate.png','bone_court.png'],dark_elves:['obsidian_passage.png','spider_shrine.png'],dwarves:['dwarven_forgehall.png','dwarven_gate_road.png'],demons:['infernal_breach.png','ashen_altar.png'],angels:['sky_sanctuary.png','hall_of_halos.png'],dragonborn:['dragonborn_aerie.png','ember_tribunal.png'],beastfolk:['beastfolk_hunting_camp.png','moon_run_path.png'],constructs:['construct_foundry.png','silent_observatory.png'],animals:['wild_glen.png','riverbank_tracks.png'],fae:['fae_ring_garden.png','whispering_meadow.png'],goblins:['goblin_trade_nook.png','goblin_scrapyard_camp.png']};
  const canonicalBackgrounds=Object.entries(backgrounds).flatMap(([folder,files])=>files.map(file=>`assets/events/register-04/backgrounds/${folder}/${file}`));
  if(canonicalBackgrounds.length!==36)fail(`canonical Event background register must contain 36 files, got ${canonicalBackgrounds.length}`);
  canonicalBackgrounds.forEach(relative=>required.push(relative));
  required.forEach(relative=>requireFile(root,relative));

  const info=JSON.parse(read(root,'BUILD_INFO.json'));
  if(!String(info.version||'').startsWith('3.1.0-puzzles'))fail(`unexpected Puzzles version: ${info.version||'missing'}`);
  if(info.active_feature_branch!=='feature/puzzles')fail(`unexpected active feature branch: ${info.active_feature_branch||'missing'}`);
  if(!['pending-puzzles-preview.2','accepted-2026-08-29'].includes(String(info.human_acceptance||'')))fail(`unexpected Puzzles human acceptance state: ${info.human_acceptance||'missing'}`);

  const index=read(root,'index.html');
  for(const forbidden of ['iron-marches-runtime.bundle.js','vertical-slice-app.mjs','ui-approved-campaign.mjs','explicit-run-setup.mjs'])if(index.includes(forbidden))fail(`index.html still references legacy runtime: ${forbidden}`);
  const foundation=read(root,'css/reboot-foundation.css');requireTokens(foundation,['BrahmsGotischCyr','--ui-panel-safe-left','--ui-panel-safe-right','.ui-panel-safe','.ui-panel-surface'],'frameless foundation');
  const foundationJs=read(root,'js/reboot-foundation.mjs');requireTokens(foundationJs,["import('./battle-route.mjs')",'RPChessRouteReady','css/travel-choice.css?v=20260830-acceptance-2'],'non-blocking foundation and critical Travel CSS');
  const route=read(root,'js/battle-route.mjs');requireTokens(route,["import './resources-app.mjs'","import './battle-app.mjs'","import './settlement-app.mjs'","import './starvation-app.mjs'","import './events-app.mjs'","import './puzzles/puzzle-app.mjs'","import './travel-choice-app.mjs'","import './ux-consistency.mjs'"],'journey bootstrap');

  const difficulty=read(root,'js/encounter-difficulty.mjs');requireTokens(difficulty,['MAX_ENCOUNTER_STARS = 12','elo: 400','elo: 2600','difficultyForStars','value.slice(0, 6)'],'12-level difficulty');
  const travel=read(root,'js/travel-choice-core.mjs');requireTokens(travel,['PLAYABLE_TRAVEL_TYPES','skirmish','battle','settlement','event','puzzle','puzzleStarsForWeek','Array.from({length:TRAVEL_CHOICE_COUNT','playerColor','enemyRaceTag'],'Travel five-type core');
  const travelApp=read(root,'js/travel-choice-app.mjs');requireTokens(travelApp,['rpchess:event-open','rpchess:puzzle-open','СЛОЖНОСТЬ ЗАДАЧИ','Неделя путешествия','СЛУЧАЙНЫЙ БОЕЦ ПОГИБНЕТ','starsText'],'Puzzles Travel runtime');
  for(const forbidden of ['ИСХОД НЕИЗВЕСТЕН','3–5 РЕШЕНИЙ','ВЫБРАТЬ ПУТЬ','Каждая карточка выбирается независимо','Куда двигаться дальше?','Шаг путешествия'])if(travelApp.includes(forbidden))fail(`Travel UX still contains removed copy: ${forbidden}`);
  const travelCss=read(root,'css/travel-choice.css');requireTokens(travelCss,["'BrahmsGotischCyr'",'.travel-choice-heading h1'],'Travel fantasy typography');
  const uxConsistency=read(root,'js/ux-consistency.mjs');requireTokens(uxConsistency,['reward_gold.png','node_shop.png','board-coordinate-frame','RPChessResourceIcons'],'shared board/resource UX');
  const uxConsistencyCss=read(root,'css/ux-consistency.css');requireTokens(uxConsistencyCss,['.resource-inline-icon','.board-coordinate-frame','.puzzles-active .puzzle-board'],'shared board/resource CSS');

  const puzzleCore=read(root,'js/puzzles/puzzle-core.mjs');requireTokens(puzzleCore,['DIFFICULTY_TABLE','puzzleStarsForWeek','puzzleBaseGold','puzzleGoldReward','selectPuzzle','isPuzzleState','applyPuzzleReward','ВЫИГРАЙТЕ'],'Puzzle core');
  const puzzleCatalog=read(root,'js/puzzles/puzzle-catalog.mjs');requireTokens(puzzleCatalog,['Lichess Open Database Puzzles',"license:'CC0'",'PUZZLE_CATALOG'],'Puzzle CC0 catalog');
  const puzzleApp=read(root,'js/puzzles/puzzle-app.mjs');requireTokens(puzzleApp,['ClassicChessEngine','rpchess:puzzle-open','Неверный ход','errors >= 3','rewardSettled','resumeSession','playForcedReply','Восстанавливаем ответ соперника…','Продолжить путь','Lichess Open Database · CC0'],'Puzzle scene');
  if(/hint/i.test(puzzleApp))fail('Puzzles v1 must not introduce hint UI/mechanics');
  const puzzleCss=read(root,'css/puzzles.css');requireTokens(puzzleCss,['body.puzzles-active','.puzzle-board','.puzzle-outcome','@media(max-width:700px)'],'Puzzle frameless/mobile CSS');
  const persistence=read(root,'js/run-persistence.mjs');requireTokens(persistence,['isPuzzleState','currentPuzzle','lastPuzzle'],'Puzzle persistence');

  const racesSource=read(root,'js/race-assets.mjs');requireTokens(racesSource,["humans/pieces/${color==='w'?'white':'black'}",'RACE_TAG_BY_LABEL','BACKGROUND_POOLS','eventBackgroundPath','wild_glen.png','riverbank_tracks.png','fae_ring_garden.png','whispering_meadow.png','goblin_trade_nook.png','goblin_scrapyard_camp.png','mixedRoleRaces','deterministicPlayerColor','pieceArtForTheme'],'race assets runtime');
  for(const obsolete of ['fae_moonwell.png','fae_mushroom_court.png','goblin_bomb_yard.png','goblin_scrap_market.png'])if(racesSource.includes(obsolete))fail(`race assets runtime still references obsolete Event background: ${obsolete}`);
  const eventsData=read(root,'js/events-data.mjs');requireTokens(eventsData,['EVENTS_01','EVENTS_10','EVENT_CATALOG','EVENT_IDS','normalizeRaceTag'],'Events catalog index');
  const narrative=read(root,'js/event-narrative.mjs');requireTokens(narrative,['literaryStory','dialogue','atmosphere','closing'],'literary Events narrative');
  const eventsCore=read(root,'js/events-core.mjs');requireTokens(eventsCore,['EVENT_COUNT = 100','shuffledEventIds','resolveEventChoice','event_king','markEventCombatStarted','eventCombatCompleted','clampStars','combatTheme'],'Events core');
  const eventsApp=read(root,'js/events-app.mjs');requireTokens(eventsApp,['dataset.eventsScreen','events-outcome-modal','eventBackgroundPath','literaryStory','data-events-background','new URL(assetPath, document.baseURI).href','css/events.css?v=20260829-events-4','rpchess:event-open','RPChessEvents'],'Events UI explicit backdrop');
  if(eventsApp.includes("setProperty('--events-background'"))fail('Events UI still uses legacy CSS-variable background injection');
  const eventsCss=read(root,'css/events.css');requireTokens(eventsCss,['.events-backdrop','.events-backdrop img',"'BrahmsGotischCyr'",'.events-outcome-modal','@media(max-width:760px)'],'Events CSS explicit backdrop');
  if(eventsCss.includes('background-image:var(--events-background,none)'))fail('Events CSS still uses legacy background variable renderer');

  const skirmishCore=read(root,'js/skirmish-core.mjs');requireTokens(skirmishCore,['MAX_ENCOUNTER_STARS','placeArmy(army,color,{seed','pawns.forEach','playerColor','enemyRoleRaces'],'Skirmish 12-level random deployment');
  const skirmishApp=read(root,'js/skirmish-app.mjs');requireTokens(skirmishApp,['Сложность ${encounter.stars} из 12','battlePlan.playerColor','pieceArtForTheme','оборона чёрными'],'Skirmish black-side/race UI');
  const battleCore=read(root,'js/battle-core.mjs');requireTokens(battleCore,['MAX_ENCOUNTER_STARS','playerColor','enemyRaceTag','BATTLE_TIERS'],'Battle 12-level race core');
  const battleApp=read(root,'js/battle-app.mjs');requireTokens(battleApp,['Сложность ${encounter.stars} из 12','battlePlan.playerColor','racePiecePath','pieceArtForTheme','оборона чёрными'],'Battle black-side/race UI');

  for(const cssPath of ['css/roster.css','css/skirmish.css','css/battle.css','css/travel-choice.css','css/resources.css','css/settlement.css','css/starvation.css','css/events.css','css/puzzles.css','css/ux-consistency.css']){
    const css=read(root,cssPath);
    if(css.includes('ui_panel_frame.png')||css.includes('ui_panel_wide.png'))fail(`${cssPath} violates frameless invariant`);
  }
  return true;
};
