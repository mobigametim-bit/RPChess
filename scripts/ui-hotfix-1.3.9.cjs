const fs = require('fs');
const path = require('path');

module.exports = function applyUiHotfix139(dist) {
  const uiPath = path.join(dist, 'js', 'ui.js');
  const buildInfoPath = path.join(dist, 'BUILD_INFO.json');
  let ui = fs.readFileSync(uiPath, 'utf8');

  if (!ui.includes('playWinFanfare(){')) {
    const defeatNeedle = "defeat(){this.sweep(320,70,.45,'sawtooth',.05);}";
    const defeatReplacement = "defeat(){this.sweep(320,70,.45,'sawtooth',.05);} playWinFanfare(){const v=Math.max(0,Math.min(1,Number(this.game.profile.settings.masterVolume??.55)));if(v<=0)return;if(!this.winFanfare){this.winFanfare=new Audio('SFX/win_fanfare.mp3');this.winFanfare.preload='auto';}this.winFanfare.volume=v;try{this.winFanfare.pause();this.winFanfare.currentTime=0;}catch(e){}const p=this.winFanfare.play();if(p&&typeof p.catch==='function')p.catch(()=>{});}";
    if (!ui.includes(defeatNeedle)) throw new Error('AudioManager defeat method was not found.');
    ui = ui.replace(defeatNeedle, defeatReplacement);
  }

  ui = ui.replace("if(fx.battleWon){this.audio.battleVictory();return;}", "if(fx.battleWon)return;");

  if (!ui.includes('const fanfareKey=')) {
    const renderNeedle = "      const type=this.screenType();\n      const map=";
    const renderReplacement = "      const type=this.screenType();\n      const r=this.game.run;\n      const fanfareKey=type==='reward'?`reward:${r?.seed||''}:${r?.act||0}:${r?.step||0}:${r?.stats?.battles||0}`:(type==='run_complete'&&r?.act>3?`victory:${r?.seed||''}:${r?.stats?.battles||0}`:null);\n      if(fanfareKey&&fanfareKey!==this.lastFanfareKey){this.lastFanfareKey=fanfareKey;setTimeout(()=>this.audio.playWinFanfare(),80);}\n      const map=";
    if (!ui.includes(renderNeedle)) throw new Error('render screen anchor was not found.');
    ui = ui.replace(renderNeedle, renderReplacement);
  }

  fs.writeFileSync(uiPath, ui);

  if (fs.existsSync(buildInfoPath)) {
    const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
    info.version = '1.3.9';
    info.build_name = 'RPChess Fantasy Edition 1.3.9 Win Fanfare Asset';
    info.notes = 'Uses the supplied win_fanfare.mp3 on every post-battle reward screen and on the final victory screen, once per completed battle.';
    fs.writeFileSync(buildInfoPath, JSON.stringify(info, null, 2));
  }

  if (!ui.includes("new Audio('SFX/win_fanfare.mp3')") || !ui.includes("type==='reward'") || !ui.includes("type==='run_complete'")) {
    throw new Error('RPChess 1.3.9 fanfare patch validation failed.');
  }

  console.log('Applied RPChess 1.3.9 win fanfare asset patch.');
};
