const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  BACKGROUND_RUNTIME_EXPECTED_COUNT,
  CANONICAL_EVENT_BACKGROUND_COUNT,
  BACKGROUND_RUNTIME_WIDTH,
  BACKGROUND_RUNTIME_HEIGHT,
  BACKGROUND_RUNTIME_MAX_TOTAL_BYTES,
  collectBackgroundAssetPaths,
  inspectBackgroundAssets
} = require('../scripts/background-asset-runtime.cjs');

const root = path.resolve(__dirname, '..', 'game');
const paths = collectBackgroundAssetPaths(root);
assert.strictEqual(paths.length, BACKGROUND_RUNTIME_EXPECTED_COUNT, 'canonical background count must stay fail-closed');
assert.strictEqual(CANONICAL_EVENT_BACKGROUND_COUNT, 36, 'Event runtime keeps exactly 36 approved backgrounds');
assert.strictEqual(paths.length, 37, 'runtime includes 36 approved Event backgrounds plus the reserved Caravan backdrop');
assert(paths.includes('assets/events/register-04/sky_khanate/storm_over_caravan.png'), 'Caravan backdrop must stay inside the production background optimizer');
assert(!paths.some((relative) => relative.includes('/merfolk/')), 'unused Merfolk backgrounds must not enter the runtime optimization budget');

const source = inspectBackgroundAssets(root);
assert.strictEqual(source.count, 37, 'source inspection must cover Event backgrounds and the reserved Caravan backdrop');
assert(source.totalBytes > BACKGROUND_RUNTIME_MAX_TOTAL_BYTES, 'master payload should remain larger than the runtime budget; build optimization must not rewrite masters');
for (const record of source.records) {
  assert(record.width >= BACKGROUND_RUNTIME_WIDTH, `${record.path} must not be smaller than runtime width`);
  assert(record.height >= BACKGROUND_RUNTIME_HEIGHT, `${record.path} must not be smaller than runtime height`);
  const ratio = record.width / record.height;
  assert(Math.abs(ratio - (16 / 9)) < 0.01, `${record.path} must remain a 16:9 background`);
}

const implementation = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'background-asset-runtime.cjs'), 'utf8');
assert(implementation.includes('BACKGROUND_RUNTIME_WEBP_QUALITY = 55'), 'Event runtime uses approved strong WebP compression');
assert(implementation.includes("'WEBP'"), 'runtime background budget must validate WebP signatures');
assert(implementation.includes('assertBackgroundAssetBudget'), 'runtime background budget must fail closed after build transformation');


const remaining = JSON.parse(fs.readFileSync(path.resolve(__dirname,'..','docs/assets/remaining-backgrounds-webp-report.json'),'utf8'));
assert.strictEqual(remaining.count,59,'remaining scenery audit must include all 59 original JPEG backgrounds');
assert.strictEqual(remaining.converted,58,'all non-tiny scene and arena backgrounds must have WebP counterparts');
assert.strictEqual(remaining.retained,1,'already-optimized small Training JPEG is retained without size regression');
assert(remaining.savedPercent>=60,'remaining scene compression must meaningfully reduce its payload');
for(const item of remaining.files){
  assert(fs.existsSync(path.resolve(__dirname,'..',item.source)),'JPEG master missing: '+item.source);
  const deployed=path.resolve(__dirname,'..',item.runtime);
  assert(fs.existsSync(deployed),'scene runtime image missing: '+item.runtime);
  assert.strictEqual(fs.statSync(deployed).size,item.after,'scene background byte report drift: '+item.runtime);
  if(item.format==='webp'){
    const header=Buffer.alloc(12),fd=fs.openSync(deployed,'r');
    try{fs.readSync(fd,header,0,12,0);}finally{fs.closeSync(fd);}
    assert(header.toString('ascii',0,4)==='RIFF'&&header.toString('ascii',8,12)==='WEBP',
      'scene runtime image has invalid WebP signature: '+item.runtime);
  }
}

console.log(`background-asset-runtime: PASS (${source.count} masters, ${(source.totalBytes / 1024 / 1024).toFixed(2)} MiB source payload)`);
