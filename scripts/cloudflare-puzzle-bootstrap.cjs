'use strict';
const {spawnSync}=require('child_process');

function run(command,args,options={}){
  const result=spawnSync(command,args,{stdio:'inherit',...options});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}

const probe=spawnSync('bash',['-lc','command -v zstd >/dev/null 2>&1'],{stdio:'inherit'});
if(probe.status!==0){
  console.error('Cloudflare generation bootstrap requires zstd in the build image.');
  process.exit(2);
}

console.log('Generating curated 2000-task Lichess CC0 catalog inside Cloudflare build workspace…');
run('bash',['-lc',[
  'set -euo pipefail',
  'curl -fL --retry 5 --retry-delay 5 https://database.lichess.org/lichess_db_puzzle.csv.zst',
  '| zstd -dc',
  '| node scripts/import-lichess-puzzles.cjs --stdin --output game/js/puzzles/puzzle-catalog.mjs --count 2000 --seed rpchess-puzzles-v1'
].join(' ')]);
run(process.execPath,['scripts/validate-puzzle-catalog.cjs']);
console.log('Cloudflare generation bootstrap: PASS');
