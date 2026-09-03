const assert=require('assert');
const path=require('path');
const runtime=require('../scripts/pin-ice-asset-runtime.cjs');

const root=path.resolve(__dirname,'../game');
const report=runtime.inspectPinIceAssets(root);
assert.strictEqual(report.count,2,'pin ice contract must contain exactly two source assets');
assert.deepStrictEqual([...runtime.PIN_ICE_FILES],['assets/vfx/pin_ice_full.png','assets/vfx/pin_ice_partial.png']);
assert.strictEqual(runtime.PIN_ICE_RUNTIME_MAX_SIDE,384);
for(const item of report.records){
  assert(item.bytes>0,`${item.path} must not be empty`);
  assert(item.width>0&&item.height>0,`${item.path} must have valid dimensions`);
  assert([3,4,6].includes(item.colorType),`${item.path} must preserve a transparent-capable PNG format`);
}
console.log(`Pin ice asset contract: PASS — ${report.count} PNGs, ${(report.totalBytes/1024/1024).toFixed(2)} MiB source`);
