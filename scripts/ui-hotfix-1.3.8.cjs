const fs = require('fs');
const path = require('path');

module.exports = function applyUiHotfix138(dist) {
  const uiPath = path.join(dist, 'js', 'ui.js');
  const cssPath = path.join(dist, 'style.css');
  const buildInfoPath = path.join(dist, 'BUILD_INFO.json');

  let ui = fs.readFileSync(uiPath, 'utf8');
  let css = fs.readFileSync(cssPath, 'utf8');

  if (!ui.includes('battleVictory(){')) {
    const audioNeedle = "win(){this.tone(620,.12,'sine',.06);setTimeout(()=>this.tone(930,.18,'sine',.06),100);} error(){this.tone(90,.12,'square',.04);}";
    const audioReplacement = "win(){this.tone(620,.12,'sine',.06);setTimeout(()=>this.tone(930,.18,'sine',.06),100);} battleVictory(){this.tone(392,.18,'triangle',.055);setTimeout(()=>this.tone(523.25,.2,'triangle',.06),140);setTimeout(()=>this.tone(659.25,.22,'sine',.07),280);setTimeout(()=>{this.tone(783.99,.38,'sine',.075);this.tone(523.25,.38,'triangle',.04);},430);} error(){this.tone(90,.12,'square',.04);}";
    if (!ui.includes(audioNeedle)) throw new Error('AudioManager win/error methods were not found.');
    ui = ui.replace(audioNeedle, audioReplacement);
  }

  if (!ui.includes('battleWon:false')) {
    const fxNeedle = 'telegraphs:[],texts:[],phaseChanged:false,roundChanged:false,hint:this.pendingFxHint};';
    const fxReplacement = 'telegraphs:[],texts:[],phaseChanged:false,roundChanged:false,battleWon:false,hint:this.pendingFxHint};';
    if (!ui.includes(fxNeedle)) throw new Error('Battle FX state declaration was not found.');
    ui = ui.replace(fxNeedle, fxReplacement);
  }

  if (!ui.includes("fx.battleWon=prev.status==='active'&&next.status==='won'")) {
    const prevNeedle = "if(!prev){for(const u of Object.values(next.units).filter(u=>u.alive))fx.spawns.push(u);fx.phaseChanged=true;return fx;}";
    const prevReplacement = `${prevNeedle}fx.battleWon=prev.status==='active'&&next.status==='won';`;
    if (!ui.includes(prevNeedle)) throw new Error('Battle snapshot comparison anchor was not found.');
    ui = ui.replace(prevNeedle, prevReplacement);
  }

  if (!ui.includes('if(fx.battleWon){this.audio.battleVictory();return;}')) {
    const audioFxNeedle = 'playFxAudio(fx,event){if(!fx)return;';
    const audioFxReplacement = 'playFxAudio(fx,event){if(!fx)return;if(fx.battleWon){this.audio.battleVictory();return;}';
    if (!ui.includes(audioFxNeedle)) throw new Error('playFxAudio method was not found.');
    ui = ui.replace(audioFxNeedle, audioFxReplacement);
  }

  const marker = '/* 1.3.8 — larger choice text and board victory fanfare */';
  if (!css.includes(marker)) {
    css += `

${marker}
/* Large framed event/bargain options: 50% larger text with enough vertical room. */
.choice-list .choice {
  font-size:1.5em !important;
  line-height:1.18 !important;
  min-height:112px !important;
  padding:18px 30px !important;
}
.choice-list .choice strong,
.choice-list .choice > span {
  font-size:1em !important;
  line-height:1.18 !important;
  word-break:normal !important;
  overflow-wrap:normal !important;
  hyphens:none !important;
}
@media (max-width:700px) {
  .choice-list .choice {
    font-size:1.28em !important;
    min-height:96px !important;
    padding:14px 20px !important;
  }
}
`;
  }

  fs.writeFileSync(uiPath, ui);
  fs.writeFileSync(cssPath, css);

  if (fs.existsSync(buildInfoPath)) {
    const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
    info.version = '1.3.8';
    info.build_name = 'RPChess Fantasy Edition 1.3.8 Choice Text and Victory Fanfare';
    info.notes = 'Increased framed choice-button text by 50 percent and added a dedicated victory fanfare when a tactical board is completed successfully.';
    fs.writeFileSync(buildInfoPath, JSON.stringify(info, null, 2));
  }

  if (!ui.includes('battleVictory(){') || !ui.includes('fx.battleWon') || !css.includes('.choice-list .choice')) {
    throw new Error('RPChess 1.3.8 hotfix validation failed.');
  }

  console.log('Applied RPChess 1.3.8 choice text and victory fanfare hotfix.');
};
