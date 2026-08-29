const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TESTS = Object.freeze(['tests/puzzles-diagnostic.cjs']);
const requested = Number.parseInt(process.env.RPCHESS_TEST_CONCURRENCY || '1', 10);
const CONCURRENCY = 1;
function runTest(relative) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [relative], { cwd: ROOT, env: process.env, stdio: ['ignore','pipe','pipe'] });
    let stdout='',stderr=''; const startedAt=Date.now();
    child.stdout.on('data',c=>{stdout+=c}); child.stderr.on('data',c=>{stderr+=c});
    child.on('error',e=>resolve({relative,code:1,duration:Date.now()-startedAt,stdout,stderr:`${stderr}${e.stack||e}`}));
    child.on('close',(code,signal)=>resolve({relative,code:code==null?1:code,signal:signal||null,duration:Date.now()-startedAt,stdout,stderr}));
  });
}
(async()=>{
  const result=await runTest(TESTS[0]);
  const output=`${result.stdout||''}${result.stderr||''}`.trim(); if(output) console.log(output);
  if(result.code!==0){console.error(`FAIL: ${result.relative} exited ${result.code}`);process.exitCode=1;return;}
  console.log('Puzzles diagnostic shard: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
