'use strict';
const {spawnSync}=require('child_process');

// One-off non-mutating probe: verify whether the Cloudflare Git build checkout
// has credentials capable of pushing back to the current content branch.
// Do not print remote URLs or credential-helper output.
const branch='content/puzzles-2000';
const result=spawnSync('git',['push','--dry-run','origin',`HEAD:${branch}`],{
  encoding:'utf8',
  stdio:['ignore','pipe','pipe']
});
if(result.status!==0){
  console.error('Cloudflare Git push dry-run: FAIL');
  process.exit(42);
}
console.log('Cloudflare Git push dry-run: PASS');
