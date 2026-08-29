const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');

const root=path.resolve(__dirname,'..');
const stage=String(process.argv[2]||'').trim();
const npm=process.platform==='win32'?'npm.cmd':'npm';
const node=process.execPath;
const mapping={
  verify:[node,['-e',"require('./scripts/verify-source.cjs')(require('path').resolve('game'))"]],
  test:[npm,['test']],
  foundation:[node,['tests/reboot-foundation.cjs']],
  classicStatic:[node,['tests/classic-chess-static.cjs']],
  classicEngine:[node,['tests/classic-chess-engine.cjs']],
  ai:[node,['tests/chess-ai-adapter.cjs']],
  roster:[node,['tests/roster.cjs']],
  skirmish:[node,['tests/skirmish.cjs']],
  battle:[node,['tests/battle.cjs']],
  travel:[node,['tests/travel-choice.cjs']],
  resources:[node,['tests/resources.cjs']],
  settlement:[node,['tests/settlement.cjs']],
  starvation:[node,['tests/starvation.cjs']],
  events:[node,['tests/events.cjs']],
  build:[npm,['run','build']]
};
if(!mapping[stage]){console.error(`Unknown Cloudflare probe stage: ${stage}`);process.exit(2);}
const [command,args]=mapping[stage];
console.log(`[cloudflare probe] ${stage}`);
const result=spawnSync(command,args,{cwd:root,stdio:'inherit',env:process.env});
if(result.error){console.error(result.error);process.exit(1);}
if(result.status!==0)process.exit(result.status||1);
if(stage!=='build'){
  const dist=path.join(root,'dist');
  fs.rmSync(dist,{recursive:true,force:true});
  fs.mkdirSync(dist,{recursive:true});
  fs.writeFileSync(path.join(dist,'index.html'),`<!doctype html><meta charset="utf-8"><title>RPChess ${stage} probe PASS</title><pre>${stage}: PASS</pre>`);
}
console.log(`[cloudflare probe] ${stage}: PASS`);
