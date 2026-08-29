'use strict';
const {spawnSync}=require('child_process');

const result=spawnSync('git',['push','--dry-run','origin','HEAD:content/puzzles-2000'],{stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
console.log('Cloudflare Git remote dry-run push: PASS');
