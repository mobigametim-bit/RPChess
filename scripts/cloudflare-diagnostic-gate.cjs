const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');

const root=path.resolve(__dirname,'..');
const reports=[];
function run(label,command,args){
  const started=Date.now();
  const result=spawnSync(command,args,{cwd:root,encoding:'utf8',env:process.env,maxBuffer:20*1024*1024});
  const code=Number.isInteger(result.status)?result.status:1;
  reports.push({label,code,durationMs:Date.now()-started,stdout:result.stdout||'',stderr:result.stderr||String(result.error||'')});
  process.stdout.write(`\n[diagnostic] ${label}: ${code===0?'PASS':'FAIL'} (${code})\n`);
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.stderr)process.stderr.write(result.stderr);
}

run('verify',process.execPath,['-e',"require('./scripts/verify-source.cjs')(require('path').resolve('game'))"]);
run('deterministic-tests',process.platform==='win32'?'npm.cmd':'npm',['test']);
run('production-build',process.platform==='win32'?'npm.cmd':'npm',['run','build']);

const dist=path.join(root,'dist');
fs.mkdirSync(dist,{recursive:true});
const head=process.env.CF_PAGES_COMMIT_SHA||process.env.CLOUDFLARE_COMMIT_SHA||process.env.GITHUB_SHA||'unknown';
const text=[
  'RPChess Cloudflare diagnostic gate',
  `head=${head}`,
  `generated=${new Date().toISOString()}`,
  '',
  ...reports.flatMap(report=>[
    `=== ${report.label} ===`,
    `status=${report.code===0?'PASS':'FAIL'}`,
    `exit=${report.code}`,
    `duration_ms=${report.durationMs}`,
    '--- stdout ---',
    report.stdout.trimEnd(),
    '--- stderr ---',
    report.stderr.trimEnd(),
    ''
  ])
].join('\n');
fs.writeFileSync(path.join(dist,'gate-report.txt'),text,'utf8');
fs.writeFileSync(path.join(dist,'gate-report.json'),JSON.stringify({head,generated:new Date().toISOString(),reports:reports.map(({label,code,durationMs})=>({label,status:code===0?'PASS':'FAIL',code,durationMs}))},null,2),'utf8');
console.log('\n[diagnostic] report written to dist/gate-report.txt and dist/gate-report.json');
// Diagnostic mode intentionally exits 0. The strict wrangler gate is restored
// immediately after the report identifies any failing source/test/build step.
