const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),game=path.join(root,'game');
const visuals=fs.readFileSync(path.join(game,'js/cross-scene-visuals.mjs'),'utf8');
const route=fs.readFileSync(path.join(game,'js/battle-route.mjs'),'utf8');
const travel=fs.readFileSync(path.join(game,'js/travel-choice-app.mjs'),'utf8');
const build=fs.readFileSync(path.join(root,'scripts/build.cjs'),'utf8');
for(const token of [
  "generated_assets/scene_campaign.jpg",
  "generated_assets/splash_poster.jpg",
  "generated_assets/scene_reward.jpg",
  "generated_assets/scene_defeat.jpg",
  "SFX/win_fanfare.mp3",
  "assets/events/register-04/backgrounds/",
  "--travel-card-backdrop",
  "--settlement-scene-backdrop",
  "--classic-scene-backdrop",
  "calc(100vh - 126px)",
  "font-size:clamp(19.5px,1.575vw,25.5px)",
  "BrahmsGotischCyr",
  "RPChessSceneVisuals"
])assert(visuals.includes(token),`cross-scene visual contract missing: ${token}`);
assert(route.includes("import './cross-scene-visuals.mjs'"),'battle route must load cross-scene visuals');
assert(travel.includes("event:'generated_assets/node_story.png'"),'Travel event route must use node_story.png');
for(const token of ["'js/cross-scene-visuals.mjs'","'SFX'","'SFX/win_fanfare.mp3'","'generated_assets/node_story.png'","'generated_assets/scene_reward.jpg'","'generated_assets/scene_defeat.jpg'"])assert(build.includes(token),`production packager missing: ${token}`);
for(const relative of ['generated_assets/scene_campaign.jpg','generated_assets/scene_reward.jpg','generated_assets/scene_defeat.jpg','generated_assets/splash_poster.jpg','generated_assets/node_story.png','SFX/win_fanfare.mp3'])assert(fs.existsSync(path.join(game,relative)),`scene asset missing: ${relative}`);
console.log('Cross-scene backgrounds, reward/defeat scenes, story event icon, matched board sizing, fanfare/font and +50% piece glyph contract: PASS');
