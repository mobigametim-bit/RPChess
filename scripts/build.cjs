const {makePwaIcons}=require('./pwa-icons.cjs');
const fs=require('fs'),path=require('path'),verifySource=require('./verify-source.cjs'),{prepareStockfishAssets}=require('./stockfish-assets.cjs'),{assertPieceAssetBudget,collectPieceAssetPaths,formatBytes}=require('./piece-asset-runtime.cjs'),{assertPortraitAssetBudget,collectPortraitAssetPaths}=require('./portrait-asset-runtime.cjs'),{assertBackgroundAssetBudget,collectBackgroundAssetPaths}=require('./background-asset-runtime.cjs'),{assertBoardAssetBudget,collectBoardAssetPaths}=require('./board-asset-runtime.cjs'),{assertPinIceAssetBudget}=require('./pin-ice-asset-runtime.cjs'),{assertAuraAssetBudget}=require('./aura-asset-runtime.cjs'),{assertArtifactAssetBudget,ARTIFACT_FILES}=require('./artifact-asset-runtime.cjs'),{assertBrandLogoAssetBudget}=require('./brand-logo-asset-runtime.cjs'),{materializeRuntimeAssets,cacheText}=require('./runtime-assets-build.cjs'),{inspectRuntimeAssetCache}=require('./runtime-asset-cache.cjs'),{collectKingdomMapAssetPaths,assertKingdomMapAssetBudget}=require('./kingdom-map-asset-runtime.cjs');
const root=path.resolve(__dirname,'..'),source=path.join(root,'game'),dist=path.join(root,'dist');
const INCLUDE_ATLAS_LAB=process.env.RPCHESS_INCLUDE_ATLAS_LAB==='1';
const GENERATED_RUNTIME_ASSETS=Object.freeze([
  'node_battle.png','node_elite.png','node_shop.png','node_story.png','node_training.png',
  'reward_gold.png','reward_heal.png','reward_recruit.png','reward_supplies.png',
  'scene_battle.webp','scene_campaign.webp','scene_defeat.webp','scene_reward.webp','scene_shop.webp','scene_training_ui.jpg','scene_victory.webp',
  'splash_poster.webp','logo_ru.png','logo_en.png'
].map(name=>`generated_assets/${name}`));
const COMMANDER_IDS=Object.freeze(['oathkeeper','stone_crown','wanderer_queen','pilgrim','fox_prince','ash_regent','nameless_heir']);
const COMMANDER_ART=Object.freeze(COMMANDER_IDS.flatMap(id=>[`assets/kings/${id}/portrait.webp`,`assets/kings/${id}/pieces/white.webp`,`assets/kings/${id}/pieces/black.webp`]));
const NAMED_PAWN_IDS=Object.freeze(['daro_last','kael_cinder','mara_chain','nemea_quill','puck_ember','renzo_bridge','saran_dawn','elio_silk']);
const NAMED_PAWN_ART=Object.freeze(NAMED_PAWN_IDS.flatMap(id=>['white','black'].flatMap(side=>['pawn','knight','bishop','rook','queen'].map(role=>`assets/heroes/${id}/pieces/${side}/${role}.webp`))));
const NAMED_PAWN_PORTRAITS=Object.freeze(NAMED_PAWN_IDS.map(id=>`assets/heroes/${id}/portrait_named.webp`));
const NAMED_BISHOP_IDS=Object.freeze(["altana_bow","brother_orell","velka_urn","deacon_mirel","seraph_lyra","briar_sister","old_marin"]);
const NAMED_BISHOP_ART=Object.freeze(NAMED_BISHOP_IDS.flatMap(id=>['white','black'].map(side=>`assets/heroes/${id}/pieces/${side}/bishop.webp`)));
const NAMED_BISHOP_PORTRAITS=Object.freeze(NAMED_BISHOP_IDS.map(id=>`assets/heroes/${id}/portrait_named.webp`));
const NAMED_KNIGHT_IDS=Object.freeze(['vael_hammer','orion_step','roan_stag','suri_ash','temur_wind','tessa_gull']);
const NAMED_KNIGHT_ART=Object.freeze(NAMED_KNIGHT_IDS.flatMap(id=>['white','black'].map(side=>`assets/heroes/${id}/pieces/${side}/knight.webp`)));
const NAMED_KNIGHT_PORTRAITS=Object.freeze(NAMED_KNIGHT_IDS.map(id=>`assets/heroes/${id}/portrait_named.webp`));
const NAMED_ROOK_IDS=Object.freeze(['aldric_wall','batu_cliff','ivar_lens','cassian_coin','maeve_root','rat_banner']);
const NAMED_ROOK_ART=Object.freeze(NAMED_ROOK_IDS.flatMap(id=>['white','black'].map(side=>`assets/heroes/${id}/pieces/${side}/rook.webp`)));
const NAMED_ROOK_PORTRAITS=Object.freeze(NAMED_ROOK_IDS.map(id=>`assets/heroes/${id}/portrait_named.webp`));
const NAMED_QUEEN_IDS=Object.freeze(['abbess_celene','viola_mask','empress_nahla','ysra_moss','lady_sorn','khulan_star']);
const NAMED_QUEEN_ART=Object.freeze(NAMED_QUEEN_IDS.flatMap(id=>['white','black'].map(side=>`assets/heroes/${id}/pieces/${side}/queen.webp`)));
const NAMED_QUEEN_PORTRAITS=Object.freeze(NAMED_QUEEN_IDS.map(id=>`assets/heroes/${id}/portrait_named.webp`));
function copy(relative){const from=path.join(source,relative),to=path.join(dist,relative);if(!fs.existsSync(from))throw new Error(`missing Reboot build input: ${relative}`);fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(from,to,{recursive:true,force:true});}
const MUSIC_EXTENSIONS=new Set(['.mp3','.ogg','.wav']);
// Noncommercial Freesound CC BY-NC track: keep source+attribution for audit,
// but never ship it in an advertising-supported commercial distribution.
const NON_COMMERCIAL_MUSIC=new Set(['epic_music3.mp3']);
function collectMusicTracks(directory=path.join(source,'music')){
  if(!fs.existsSync(directory))return [];
  const tracks=[];
  const visit=(current)=>{
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const absolute=path.join(current,entry.name);
      if(entry.isDirectory()){visit(absolute);continue;}
      if(!entry.isFile()||!MUSIC_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))continue;
      const relative=path.relative(directory,absolute).split(path.sep).join('/');
      if(NON_COMMERCIAL_MUSIC.has(relative))continue;
      tracks.push(`music/${relative}`);
    }
  };
  visit(directory);
  return tracks.sort((left,right)=>left.localeCompare(right,'en'));
}
function writeMusicCatalog(){
  const tracks=collectMusicTracks();
  const target=path.join(dist,'js/music-catalog.mjs');
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,`const MUSIC_TRACKS = Object.freeze(${JSON.stringify(tracks,null,2)});\n\nexport { MUSIC_TRACKS };\n`,'utf8');
  return tracks;
}
async function main(){
  verifySource(source);
  fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
  for(const relative of [
    'index.html','manifest.webmanifest','offline.html','service-worker.js','pwa/icon-source.png','js/pwa-install.mjs','BUILD_INFO.json','css/arena.css','css/mentor-training.css','css/king-mate-polish.css','css/battle-mercenary-dialog.css','css/tournament.css','css/tournament-v4.css','css/finished-game-review.css','css/combat-centered-layout.css','css/piece-drag.css','js/arena-core.mjs','js/arena-app.mjs','js/mentor-training-app.mjs','js/mentor-training-speech.mjs','js/mentor-training-history.mjs','js/mentor-training-motion.mjs','js/mentor-training-feedback-core.mjs','js/mentor-training-feedback-v2.mjs','js/mentor-training-feedback-client.mjs','js/mentor-training-tactics.mjs','js/mentor-training-teaching.mjs','js/mentor-training-exchange.mjs','js/mentor-training-threat.mjs','js/mentor-training-copy.mjs','js/tournament-app.mjs','js/api-route.mjs','js/tournament-shadow-game.mjs','js/finished-game-review.mjs','assets/arena','assets/ui/royal_run_flag.png','assets/ui/jester-patrick.webp','assets/ui/orc-mercenary-recruiter.png','assets/relics/merchants_scale.png','assets/relics/banner_nine.png','assets/relics/diplomat_seal.png','assets/regions/ashen_dominion/boss_arena.webp',
    'css/screen-loading.css','css/reboot-foundation.css','css/main-menu-approved.css','css/hud-nav-icons.css','css/language.css','css/ui-redesign-first-three.css','css/player-identity-chronicle.css','css/classic-chess.css','css/chess-ai-polish.css','css/roster.css','css/roster-formation.css','css/skirmish.css','css/skirmish-compact.css','css/battle.css','css/caravan.css','css/battle-compact.css','css/endless-run.css','css/endless-run-compact.css','css/travel-choice.css','css/travel-choice-compact.css','css/kingdom-map.css','css/ui-redesign-final.css','css/combat-side-colors.css','css/player-rating.css','css/resources.css','css/settlement.css','css/settlement-compact.css','css/starvation.css','css/starvation-compact.css','css/events.css','css/events-v5.css','css/puzzles.css','css/puzzles-compact.css','css/ux-consistency.css','css/playtest-fixes.css','css/landscape-ui-redesign.css','css/portrait-ui.css','css/kingdom-roster-polish.css','css/simplified-pieces.css','css/artifacts.css','css/font-goznak.css',
    'js/screen-loading.mjs','js/reboot-foundation.mjs','js/kingdom-menu-preview.mjs','js/gamepush-sdk.mjs','js/gamepush-meta-sync.mjs','js/profile-client.mjs','js/reboot-audio.mjs','js/platform.mjs','js/cloud-save.mjs','js/i18n.mjs','js/brand-logo.mjs','localization','js/player-identity-core.mjs','js/commander-portraits.mjs','js/chronicle-core.mjs','js/leaderboard-client.mjs','js/player-identity-chronicle.mjs','js/endless-run-core.mjs','js/endless-run-app.mjs','js/classic-chess-engine.mjs','js/classic-chess-app.mjs','js/piece-drag.mjs','js/king-pin-ice.mjs','js/chess-ai-adapter.mjs','js/roster-data.mjs','js/run-persistence.mjs','js/combat-checkpoint.mjs','js/run-lifecycle-events.mjs','js/roster-app.mjs','js/roster-formation-core.mjs','js/roster-formation-ui.mjs','js/fork-master-core.mjs','js/artifact-core.mjs','js/artifact-combat-ui.mjs',
    'js/encounter-difficulty.mjs','js/power-elo.mjs','js/player-rating.mjs','js/player-rating-runtime.mjs','js/race-assets.mjs','js/fantasy-piece.mjs','js/board-view-toggle.mjs','js/event-narrative.mjs','js/event-literary-outcome.mjs','js/content',
    'js/kingdom-map-assets.mjs','js/kingdom-road-network.mjs','js/kingdom-road-paving.mjs','js/kingdom-road-travelers.mjs','js/kingdom-traveler-renderer.mjs','js/kingdom-map-overlay.mjs','js/kingdom-fog-visibility.mjs','js/kingdom-world-config.mjs','js/kingdom-world-core.mjs','js/kingdom-geography.mjs','js/kingdom-parchment-core.mjs','js/kingdom-parchment-app.mjs','js/skirmish-core.mjs','js/skirmish-obstacles.mjs','js/skirmish-app.mjs','js/chess960.mjs','js/caravan-core.mjs','js/caravan-reward-ui.mjs','js/battle-core.mjs','js/battle-app.mjs','js/battle-mercenaries.mjs','js/battle-route.mjs','js/combat-menu.mjs','js/travel-choice-core.mjs','js/travel-choice-app.mjs','js/kingdom-map-core.mjs','js/kingdom-bandit-core.mjs','js/kingdom-entry-rollback.mjs','js/kingdom-industry-core.mjs','js/kingdom-economy-config.mjs','js/kingdom-army-core.mjs','js/kingdom-map-app.mjs','js/ux-consistency.mjs','js/post-redesign-playtest-pass1b.mjs','js/ui-redesign-final.mjs','js/cross-scene-visuals.mjs','js/landscape-ui-redesign.mjs',
    'js/resources-core.mjs','js/resources-app.mjs','js/settlement-core.mjs','js/settlement-app.mjs','js/starvation-core.mjs','js/starvation-app.mjs','js/events-data.mjs','js/events-core.mjs','js/events-app.mjs','js/events','js/puzzles',
    'assets/ui/main-menu-journey.png','assets/ui/main-menu-arena.png','assets/ui/main-menu-tournament.png',
    'assets/ui/build_outpost_128.png','assets/ui/build_settlement_128.png',
    'assets/ui/main-menu-mentor.png','assets/ui/main-menu-settings.png','assets/ui/main-menu-language.png',
    'assets/ui/hud-main-menu.png','assets/ui/hud-squad.png','assets/ui/settlement_entrance_64x64.png',
    'assets/kingdom-travelers/walkers_64.png','assets/kingdom-production/industry-atlas.png','assets/pieces/fantasy','assets/vfx/pin_ice_full.png','assets/vfx/pin_ice_partial.png','assets/vfx/aura_white.png','assets/vfx/aura_black.png','assets/vfx/aura_red.png','assets/artifacts','assets/boards/obstacles','assets/boards/neutral/tile_light.png','assets/boards/neutral/tile_dark.png','assets/doctrines/cavalry/emblem.png','assets/doctrines/royal_court/emblem.png','fonts','music','SFX',
    ...collectKingdomMapAssetPaths(source),...collectBoardAssetPaths(source),...collectPieceAssetPaths(source),...collectPortraitAssetPaths(source),...collectBackgroundAssetPaths(source),...COMMANDER_ART,...NAMED_PAWN_ART,...NAMED_PAWN_PORTRAITS,...NAMED_BISHOP_ART,...NAMED_BISHOP_PORTRAITS,...NAMED_KNIGHT_ART,...NAMED_KNIGHT_PORTRAITS,...NAMED_ROOK_ART,...NAMED_ROOK_PORTRAITS,...NAMED_QUEEN_ART,...NAMED_QUEEN_PORTRAITS,...GENERATED_RUNTIME_ASSETS
  ])copy(relative);
  // The 2.22 MiB authoring lab is separate from the public game.
  // Keep it in the isolated feature preview through RPCHESS_INCLUDE_ATLAS_LAB=1.
  if(INCLUDE_ATLAS_LAB){
    copy('atlas-lab.html');
    copy('js/kingdom-economy-lab.mjs');
  }
  // Offline puzzle shards are the shipped runtime; the source gzip is only
  // needed to regenerate their catalog and must not be copied into the game.
  fs.rmSync(path.join(dist,'js/puzzles/catalog-data'),{recursive:true,force:true});
  // Experimental artwork is optional until the approved seven sheets arrive in
  // the repo; never make classic production builds depend on its presence.
  if(fs.existsSync(path.join(source,'assets/kingdom-parchment'))){
    copy('assets/kingdom-parchment');
    // The extra groups have artist-chosen names. Build a deterministic catalog
    // from actual SVG files instead of guessing 48 filenames in runtime code.
    const root=path.join(source,'assets/kingdom-parchment');
    const groups={};
    for(const entry of fs.readdirSync(root,{withFileTypes:true})){
      if(!entry.isDirectory()||['road_segments','river_segments'].includes(entry.name))continue;
      const files=fs.readdirSync(path.join(root,entry.name))
        .filter(name=>/\.(svg|png)$/i.test(name)).sort();
      if(files.length)groups[entry.name]=files;
    }
    fs.writeFileSync(path.join(dist,'assets/kingdom-parchment/extra-manifest.json'),
      JSON.stringify({version:1,groups},null,2));
  }
  // Remove excluded tracks from the output immediately after directory copy.
  // The review-only source remains unchanged, and the catalog omits it too.
  for(const filename of NON_COMMERCIAL_MUSIC)fs.rmSync(path.join(dist,'music',filename),{force:true});
  for(const master of collectBackgroundAssetPaths(source))copy(master.replace(/\.png$/,'.webp'));
  makePwaIcons(source,dist);
  const musicTracks=writeMusicCatalog();
  for(const filename of NON_COMMERCIAL_MUSIC){
    if(fs.existsSync(path.join(dist,'music',filename))||musicTracks.includes('music/'+filename))
      throw new Error('Commercial distribution contains blocked noncommercial music: '+filename);
  }
  console.log(`Runtime music catalog: ${musicTracks.length} track${musicTracks.length===1?'':'s'}`);
  const runtime=materializeRuntimeAssets(dist);
  const kingdomAssets=assertKingdomMapAssetBudget(dist);
  console.log(`Runtime Kingdom sprites: ${kingdomAssets.count} vector 128px SVG, ${formatBytes(kingdomAssets.totalBytes)} total`);
  assertBoardAssetBudget(dist);
  assertPinIceAssetBudget(dist);
  assertAuraAssetBudget(dist);
  assertArtifactAssetBudget(dist);
  assertBrandLogoAssetBudget(dist);
  assertPieceAssetBudget(dist);
  assertPortraitAssetBudget(dist);
  assertBackgroundAssetBudget(dist);
  console.log(`Runtime board assets: ${runtime.boards.count}; ${formatBytes(runtime.boards.beforeBytes)} -> ${formatBytes(runtime.boards.afterBytes)}; saved ${formatBytes(runtime.boards.savedBytes)} (${runtime.boards.savedPercent.toFixed(1)}%); cache ${cacheText(runtime.boards)}`);
  console.log(`Runtime pin ice assets: ${runtime.pinIce.count}; ${formatBytes(runtime.pinIce.beforeBytes)} -> ${formatBytes(runtime.pinIce.afterBytes)}; saved ${formatBytes(runtime.pinIce.savedBytes)} (${runtime.pinIce.savedPercent.toFixed(1)}%); cache ${cacheText(runtime.pinIce)}`);
  console.log(`Runtime aura assets: ${runtime.auras.count}; ${formatBytes(runtime.auras.beforeBytes)} -> ${formatBytes(runtime.auras.afterBytes)}; saved ${formatBytes(runtime.auras.savedBytes)} (${runtime.auras.savedPercent.toFixed(1)}%); cache ${cacheText(runtime.auras)}`);
  console.log(`Runtime artifact assets: ${runtime.artifacts.count}; ${formatBytes(runtime.artifacts.beforeBytes)} -> ${formatBytes(runtime.artifacts.afterBytes)}; saved ${formatBytes(runtime.artifacts.savedBytes)} (${runtime.artifacts.savedPercent.toFixed(1)}%); cache ${cacheText(runtime.artifacts)}`);
  console.log(`Runtime Arena icons: ${runtime.arena.count}; ${formatBytes(runtime.arena.beforeBytes)} -> ${formatBytes(runtime.arena.afterBytes)}; cache ${cacheText(runtime.arena)}`);
  console.log(`Runtime run flag: ${runtime.runFlag.count}; ${formatBytes(runtime.runFlag.beforeBytes)} -> ${formatBytes(runtime.runFlag.afterBytes)}; cache ${cacheText(runtime.runFlag)}`);
  console.log(`Runtime brand logos: ${runtime.brandLogos.count}; ${formatBytes(runtime.brandLogos.beforeBytes)} -> ${formatBytes(runtime.brandLogos.afterBytes)}; saved ${formatBytes(runtime.brandLogos.savedBytes)} (${runtime.brandLogos.savedPercent.toFixed(1)}%); cache ${cacheText(runtime.brandLogos)}`);
  console.log(`Runtime piece assets: ${runtime.pieces.count}; ${formatBytes(runtime.pieces.beforeBytes)} -> ${formatBytes(runtime.pieces.afterBytes)}; saved ${formatBytes(runtime.pieces.savedBytes)} (${runtime.pieces.savedPercent.toFixed(1)}%); cache ${cacheText(runtime.pieces)}`);
  console.log(`Runtime portrait assets: ${runtime.portraits.count}; ${formatBytes(runtime.portraits.beforeBytes)} -> ${formatBytes(runtime.portraits.afterBytes)}; saved ${formatBytes(runtime.portraits.savedBytes)} (${runtime.portraits.savedPercent.toFixed(1)}%); cache ${cacheText(runtime.portraits)}`);
  console.log(`Runtime background assets: ${runtime.backgrounds.count}; ${formatBytes(runtime.backgrounds.beforeBytes)} -> ${formatBytes(runtime.backgrounds.afterBytes)}; saved ${formatBytes(runtime.backgrounds.savedBytes)} (${runtime.backgrounds.savedPercent.toFixed(1)}%); cache ${cacheText(runtime.backgrounds)}`);
  const cacheInfo=inspectRuntimeAssetCache();
  console.log(`Runtime asset cache: ${cacheInfo.files} entries, ${formatBytes(cacheInfo.bytes)}, ${cacheInfo.root}`);
  const stockfish=await prepareStockfishAssets(dist);
  verifySource(dist);
  const rootHtml=fs.readFileSync(path.join(dist,'index.html'),'utf8');
  for(const token of ['iron-marches-runtime.bundle.js','vertical-slice-app.mjs','explicit-run-setup.mjs','ui-approved-campaign.mjs'])if(rootHtml.includes(token))throw new Error(`dist entry still contains legacy token: ${token}`);
  if(fs.existsSync(path.join(dist,'js/generated/iron-marches-runtime.bundle.js')))throw new Error('legacy Iron Marches runtime was accidentally packaged into Reboot dist');
  for(const relative of [
    ...(INCLUDE_ATLAS_LAB?['atlas-lab.html','js/kingdom-economy-lab.mjs']:[]),'manifest.webmanifest','offline.html','service-worker.js','js/pwa-install.mjs','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','css/finished-game-review.css','css/mentor-training.css','js/mentor-training-app.mjs','js/mentor-training-speech.mjs','js/mentor-training-history.mjs','js/mentor-training-motion.mjs','js/mentor-training-feedback-core.mjs','js/mentor-training-feedback-v2.mjs','js/mentor-training-feedback-client.mjs','js/mentor-training-tactics.mjs','js/mentor-training-teaching.mjs','js/mentor-training-exchange.mjs','js/mentor-training-threat.mjs','js/mentor-training-copy.mjs','css/language.css','css/ui-redesign-first-three.css','css/events.css','css/events-v5.css','css/puzzles.css','css/puzzles-compact.css','css/ux-consistency.css','css/playtest-fixes.css','css/ui-redesign-final.css','css/combat-side-colors.css','css/battle-compact.css','css/travel-choice-compact.css','css/player-rating.css','css/endless-run.css','css/endless-run-compact.css','css/skirmish-compact.css','css/settlement-compact.css','css/starvation-compact.css','css/player-identity-chronicle.css','css/landscape-ui-redesign.css','css/portrait-ui.css','css/kingdom-roster-polish.css','css/simplified-pieces.css','css/tournament.css','css/tournament-v4.css','js/tournament-app.mjs','js/tournament-shadow-game.mjs','js/finished-game-review.mjs','js/cloud-save.mjs','js/kingdom-industry-core.mjs','assets/kingdom-production/industry-atlas.png','js/combat-checkpoint.mjs','js/player-identity-core.mjs','js/chronicle-core.mjs','js/leaderboard-client.mjs','js/player-identity-chronicle.mjs','js/endless-run-core.mjs','js/endless-run-app.mjs','js/events-data.mjs','js/events-core.mjs','js/events-app.mjs','js/puzzles/puzzle-core.mjs','js/puzzles/puzzle-catalog.mjs','js/puzzles/puzzle-theme-catalog.mjs','js/puzzles/puzzle-app.mjs','js/ux-consistency.mjs','js/post-redesign-playtest-pass1b.mjs','js/ui-redesign-final.mjs','js/cross-scene-visuals.mjs','js/landscape-ui-redesign.mjs','js/encounter-difficulty.mjs','js/power-elo.mjs','js/player-rating.mjs','js/player-rating-runtime.mjs','js/run-lifecycle-events.mjs','js/race-assets.mjs','js/fantasy-piece.mjs','js/board-view-toggle.mjs','js/king-pin-ice.mjs','js/event-narrative.mjs','js/content/content-registry.mjs','js/battle-mercenaries.mjs',
    ...Array.from({length:10},(_,i)=>`js/events/event-data-${String(i+1).padStart(2,'0')}.mjs`),
    ...collectKingdomMapAssetPaths(source),'assets/ui/royal_run_flag.png',...COMMANDER_ART,...NAMED_PAWN_ART,...NAMED_BISHOP_ART,...NAMED_BISHOP_PORTRAITS,...NAMED_KNIGHT_ART,...NAMED_KNIGHT_PORTRAITS,...NAMED_ROOK_ART,...NAMED_ROOK_PORTRAITS,...NAMED_QUEEN_ART,...NAMED_QUEEN_PORTRAITS,
    'assets/kings/oathkeeper/portrait.png','assets/kings/stone_crown/portrait.png','assets/kings/wanderer_queen/portrait.png','assets/kings/pilgrim/portrait.png','assets/kings/fox_prince/portrait.png','assets/kings/ash_regent/portrait.png','assets/kings/nameless_heir/portrait.png',
    'assets/regions/ashen_dominion/boss_arena.webp','assets/races/humans/board/white.png','assets/races/humans/board/black.png','assets/pieces/fantasy','assets/vfx/pin_ice_full.png','assets/vfx/pin_ice_partial.png','assets/vfx/aura_white.png','assets/vfx/aura_black.png','assets/vfx/aura_red.png','assets/races/humans/pieces/white/king.png','assets/races/humans/pieces/black/king.png','assets/races/orcs/pieces/pawn.png','assets/events/register-04/backgrounds/generic/forest_crossroad.webp','assets/events/register-04/sky_khanate/storm_over_caravan.webp','assets/doctrines/cavalry/emblem.png','assets/doctrines/royal_court/emblem.png','generated_assets/node_training.png','generated_assets/node_story.png','generated_assets/scene_campaign.webp','generated_assets/scene_victory.webp','generated_assets/scene_reward.webp','generated_assets/scene_defeat.webp','generated_assets/logo_ru.png','generated_assets/logo_en.png','SFX/win_fanfare.mp3',
    'vendor/stockfish/stockfish-18-lite-single.js','vendor/stockfish/stockfish-18-lite-single.wasm','vendor/stockfish/COPYING.txt','vendor/stockfish/SOURCE.txt'
  ])if(!fs.existsSync(path.join(dist,relative)))throw new Error(`Power build output missing: ${relative}`);
  // PNG-only production: conversion is mandatory in every distribution.
  const {convertParchment}=require('./prepare-parchment-raster.cjs');
  const parchmentReport=convertParchment(dist);
  if(parchmentReport.count!==112)throw Error('Expected 112 PNG parchment sprites');
  const parchmentOut=path.join(root,'test-results/parchment-raster-report.json');
  fs.mkdirSync(path.dirname(parchmentOut),{recursive:true});
  fs.writeFileSync(parchmentOut,JSON.stringify(parchmentReport,null,2)+'\n');
  const {printBuildSizeReport}=require('./build-size-report.cjs');
  printBuildSizeReport(dist,path.join(root,'test-results','build-size-report.json'));
  console.log(`Prepared RPChess Power/adaptive encounters distribution in ${dist}; Stockfish ${stockfish.version}`);
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
