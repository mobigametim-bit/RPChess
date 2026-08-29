const {spawnSync}=require('child_process');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const tests=['tests/puzzle-importer.cjs','tests/puzzles-rules.cjs','tests/puzzles-catalog-a.cjs','tests/puzzles-catalog-b.cjs','tests/puzzles.cjs'];
const results=[];
for(const test of tests){
  const started=Date.now();
  const run=spawnSync(process.execPath,[test],{cwd:root,encoding:'utf8',env:process.env,maxBuffer:4*1024*1024});
  results.push({test,status:run.status,signal:run.signal,durationMs:Date.now()-started,stdout:run.stdout||'',stderr:run.stderr||'',error:run.error?String(run.error.stack||run.error):null});
}
const report={generatedAt:new Date().toISOString(),failed:results.some(r=>r.status!==0||r.error),results};
const out=path.join(root,'game','generated_assets','puzzle-test-report.json');
fs.writeFileSync(out,JSON.stringify(report,null,2));
console.log(`Puzzle diagnostic report: ${path.relative(root,out)}; failed=${report.failed}`);
