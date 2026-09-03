const assert=require('assert');
const path=require('path');
const runtime=require('../scripts/aura-asset-runtime.cjs');

const root=path.resolve(__dirname,'../game');
const report=runtime.inspectAuraAssets(root);
assert.strictEqual(report.count,3,'combat aura contract must contain exactly three source assets');
assert.deepStrictEqual([...runtime.AURA_FILES],[
  'assets/vfx/aura_white.png',
  'assets/vfx/aura_black.png',
  'assets/vfx/aura_red.png'
]);
assert.strictEqual(runtime.AURA_RUNTIME_MAX_SIDE,384);
for(const item of report.records){
  assert(item.bytes>0,`${item.path} must not be empty`);
  assert(item.width>0&&item.height>0,`${item.path} must have valid dimensions`);
  assert.strictEqual(item.width,item.height,`${item.path} must be square`);
  assert([3,4,6].includes(item.colorType),`${item.path} must preserve a transparent-capable PNG format`);
}
console.log(`Combat aura asset contract: PASS — ${report.count} PNGs, ${(report.totalBytes/1024/1024).toFixed(2)} MiB source`);
