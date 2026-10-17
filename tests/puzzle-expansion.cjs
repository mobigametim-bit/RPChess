const assert=require('assert'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {STAR_TARGETS,TYPE_TARGETS,allocate}=require('../scripts/curate-lichess-30000.cjs');
(async()=>{
  const repo=path.resolve(__dirname,'..'),core=await import(pathToFileURL(path.join(repo,'game/js/puzzles/puzzle-core.mjs')).href);
  const legacy=await import(pathToFileURL(path.join(repo,'game/js/puzzles/puzzle-catalog.mjs')).href);
  const reportPath=path.join(repo,'game/js/puzzles/catalog-data/puzzle-expansion-report.json');
  const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):null;
  const quotas=allocate(legacy.PUZZLE_CATALOG);
  assert.strictEqual(Object.values(quotas).reduce((a,b)=>a+b,0),18502);
  if(!report){console.log('30K catalog acceptance: pending Lichess download, verified exact quotas');return;}
  assert.strictEqual(report.total,30000);assert.strictEqual(report.legacy,11498);
  const all=[...legacy.PUZZLE_CATALOG],ids=new Set(all.map(p=>p.sourceId));
  for(let star=1;star<=12;star++){
    const mod=await import(pathToFileURL(path.join(repo,'game/js/puzzles/extra-star-'+String(star).padStart(2,'0')+'.mjs')).href);
    for(const p of mod.EXTRA_PUZZLES){
      assert(core.isNormalizedPuzzle(p),'invalid new task '+p.id);
      assert.strictEqual(p.difficulty,star);
      assert(!ids.has(p.sourceId),'duplicate source puzzle '+p.sourceId);
      ids.add(p.sourceId);all.push(p);
    }
    assert.strictEqual(all.filter(p=>p.difficulty===star).length,STAR_TARGETS[star-1],'star quota '+star);
  }
  assert.strictEqual(all.length,30000);
  for(const [type,target] of Object.entries(TYPE_TARGETS))assert.strictEqual(all.filter(p=>p.type===type).length,target,'goal quota '+type);
  assert(new Set(all.flatMap(p=>p.themes)).size>=60,'expanded catalogue should preserve diverse official Lichess source tags');
  console.log('30K Lichess catalog acceptance: PASS, 30,000 unique, 12 levels, 7 goals, original 11,498 intact');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
