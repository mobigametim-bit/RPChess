const fs=require('fs'),path=require('path'),verifySource=require('./verify-source.cjs'),{prepareStockfishAssets}=require('./stockfish-assets.cjs');
const root=path.resolve(__dirname,'..'),source=path.join(root,'game'),dist=path.join(root,'dist');
function copy(relative){const from=path.join(source,relative),to=path.join(dist,relative);if(!fs.existsSync(from))throw new Error(`missing Reboot build input: ${relative}`);fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(from,to,{recursive:true,force:true});}
async function main(){
  verifySource(source);
  fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
  for(const relative of [
    'index.html','BUILD_INFO.json',
    'css/reboot-foundation.css','css/ui-redesign-first-three.css','css/player-identity-chronicle.css','css/classic-chess.css','css/chess-ai-polish.css','css/roster.css','css/skirmish.css','css/battle.css','css/endless-run.css','css/travel-choice.css','css/ui-redesign-final.css','css/player-rating.css','css/resources.css','css/settlement.css','css/starvation.css','css/events.css','css/events-v5.css','css/puzzles.css','css/ux-consistency.css','css/playtest-fixes.css',
    'js/reboot-foundation.mjs','js/reboot-audio.mjs','js/player-identity-core.mjs','js/chronicle-core.mjs','js/player-identity-chronicle.mjs','js/classic-chess-engine.mjs','js/classic-chess-app.mjs','js/chess-ai-adapter.mjs','js/roster-data.mjs','js/run-persistence.mjs','js/roster-app.mjs',
    'js/encounter-difficulty.mjs','js/player-rating.mjs','js/player-rating-runtime.mjs','js/endless-run-core.mjs','js/endless-run-app.mjs','js/race-assets.mjs','js/event-narrative.mjs','js/content',
    'js/skirmish-core.mjs','js/skirmish-app.mjs','js/battle-core.mjs','js/battle-app.mjs','js/battle-mercenaries.mjs','js/battle-route.mjs','js/travel-choice-core.mjs','js/travel-choice-app.mjs','js/ux-consistency.mjs','js/post-redesign-playtest-pass1b.mjs','js/ui-redesign-final.mjs','js/cross-scene-visuals.mjs',
    'js/resources-core.mjs','js/resources-app.mjs','js/settlement-core.mjs','js/settlement-app.mjs','js/starvation-core.mjs','js/starvation-app.mjs','js/events-data.mjs','js/events-core.mjs','js/events-app.mjs','js/events','js/puzzles',
    'assets/kings/oathkeeper','assets/heroes','assets/races','assets/events','fonts','generated_assets','music','SFX'
  ])copy(relative);
  const stockfish=await prepareStockfishAssets(dist);
  verifySource(dist);
  const rootHtml=fs.readFileSync(path.join(dist,'index.html'),'utf8');
  for(const token of ['iron-marches-runtime.bundle.js','vertical-slice-app.mjs','explicit-run-setup.mjs','ui-approved-campaign.mjs'])if(rootHtml.includes(token))throw new Error(`dist entry still contains legacy token: ${token}`);
  if(fs.existsSync(path.join(dist,'js/generated/iron-marches-runtime.bundle.js')))throw new Error('legacy Iron Marches runtime was accidentally packaged into Reboot dist');
  for(const relative of [
    'css/ui-redesign-first-three.css','css/events.css','css/events-v5.css','css/puzzles.css','css/ux-consistency.css','css/playtest-fixes.css','css/ui-redesign-final.css','css/player-rating.css','css/endless-run.css','css/player-identity-chronicle.css','js/player-identity-core.mjs','js/chronicle-core.mjs','js/player-identity-chronicle.mjs','js/endless-run-core.mjs','js/endless-run-app.mjs','js/events-data.mjs','js/events-core.mjs','js/events-app.mjs','js/puzzles/puzzle-core.mjs','js/puzzles/puzzle-catalog.mjs','js/puzzles/puzzle-app.mjs','js/ux-consistency.mjs','js/post-redesign-playtest-pass1b.mjs','js/ui-redesign-final.mjs','js/cross-scene-visuals.mjs','js/encounter-difficulty.mjs','js/player-rating.mjs','js/player-rating-runtime.mjs','js/race-assets.mjs','js/event-narrative.mjs','js/content/content-registry.mjs','js/battle-mercenaries.mjs',
    ...Array.from({length:10},(_,i)=>`js/events/event-data-${String(i+1).padStart(2,'0')}.mjs`),
    'assets/races/humans/pieces/white/king.png','assets/races/humans/pieces/black/king.png','assets/races/orcs/pieces/pawn.png','assets/events/register-04/backgrounds/generic/forest_crossroad.png','generated_assets/node_training.png','generated_assets/node_story.png','generated_assets/scene_campaign.jpg','generated_assets/scene_victory.jpg','generated_assets/scene_reward.jpg','generated_assets/scene_defeat.jpg','SFX/win_fanfare.mp3',
    'vendor/stockfish/stockfish-18-lite-single.js','vendor/stockfish/stockfish-18-lite-single.wasm','vendor/stockfish/COPYING.txt','vendor/stockfish/SOURCE.txt'
  ])if(!fs.existsSync(path.join(dist,relative)))throw new Error(`Power build output missing: ${relative}`);
  console.log(`Prepared RPChess Power/adaptive encounters distribution in ${dist}; Stockfish ${stockfish.version}`);
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
