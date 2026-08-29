const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),game=path.join(root,'game');
const visuals=fs.readFileSync(path.join(game,'js/cross-scene-visuals.mjs'),'utf8');
const route=fs.readFileSync(path.join(game,'js/battle-route.mjs'),'utf8');
const build=fs.readFileSync(path.join(root,'scripts/build.cjs'),'utf8');
const glyphAudit=JSON.parse(fs.readFileSync(path.join(root,'content/audits/technical_piece_glyph_contract.json'),'utf8'));
for(const token of [
  "generated_assets/scene_campaign.jpg",
  "generated_assets/splash_poster.jpg",
  "generated_assets/scene_victory.jpg",
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
for(const token of ["'js/cross-scene-visuals.mjs'","'SFX'","'SFX/win_fanfare.mp3'","'generated_assets/scene_victory.jpg'"])assert(build.includes(token),`production packager missing: ${token}`);
for(const relative of ['generated_assets/scene_campaign.jpg','generated_assets/scene_victory.jpg','generated_assets/splash_poster.jpg','SFX/win_fanfare.mp3'])assert(fs.existsSync(path.join(game,relative)),`scene asset missing: ${relative}`);
assert.strictEqual(glyphAudit.rebootAcceptance?.requestedScaleChange,1.5,'Reboot technical piece glyph must preserve the accepted +50% scale');
assert.strictEqual(glyphAudit.rebootAcceptance?.boardGlyphCss,'clamp(19.5px, 1.575vw, 25.5px)','glyph audit and runtime CSS must stay synchronized');
console.log('Cross-scene backgrounds, matched board sizing, victory fanfare/font and +50% piece glyph contract: PASS');
