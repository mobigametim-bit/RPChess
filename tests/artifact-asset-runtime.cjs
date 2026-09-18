const assert=require('assert');
const path=require('path');
const runtime=require('../scripts/artifact-asset-runtime.cjs');
const root=path.resolve(__dirname,'../game');
const report=runtime.inspectArtifactAssets(root);
assert.strictEqual(report.count,6,'artifact runtime contract must contain exactly six PNG files');
assert.strictEqual(runtime.ARTIFACT_RUNTIME_MAX_SIDE,256);
for(const item of report.records){assert(item.width===item.height,`${item.path} must be square`);assert(item.bytes>0,`${item.path} must not be empty`);assert([3,4,6].includes(item.colorType),`${item.path} must preserve alpha capability`);}
console.log(`Artifact asset contract: PASS — ${report.count} PNGs`);
