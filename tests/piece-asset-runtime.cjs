const assert=require('assert');
const fs=require('fs'),os=require('os'),path=require('path');
const runtime=require('../scripts/piece-asset-runtime.cjs');
const rgba=Buffer.alloc(1024*1024*4);
for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const i=(y*1024+x)*4;rgba[i]=x%256;rgba[i+1]=y%256;rgba[i+2]=(x+y)%256;rgba[i+3]=(x+y)%17===0?0:255;}
const png=runtime.encodeRgbaPng(1024,1024,rgba);
const decoded=runtime.decodePng(png);assert.strictEqual(decoded.width,1024);assert.strictEqual(decoded.height,1024);
const optimized=runtime.optimizePngBuffer(png);assert.strictEqual(optimized.width,256);assert.strictEqual(optimized.height,256);assert(optimized.buffer.length<runtime.PIECE_RUNTIME_MAX_BYTES);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rpchess-piece-budget-'));
for(const relative of ['assets/heroes/test/piece_badge.png','assets/races/orcs/pieces/pawn.png','assets/kings/oathkeeper/piece.png']){const full=path.join(tmp,relative);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,png);}
const report=runtime.optimizePieceAssets(tmp);assert.strictEqual(report.count,3);assert(report.savedBytes>0);runtime.assertPieceAssetBudget(tmp);
assert.throws(()=>runtime.assertPieceAssetBudget(tmp,{maxSide:128}),/piece asset budget/);
console.log(`Piece asset runtime optimizer: PASS (${report.count} fixtures, ${report.savedPercent.toFixed(1)}% saved)`);
