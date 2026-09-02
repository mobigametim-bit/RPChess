const path=require('path');
const {optimizePieceAssets,assertPieceAssetBudget,formatBytes,PIECE_RUNTIME_MAX_SIDE,PIECE_RUNTIME_MAX_BYTES}=require('./piece-asset-runtime.cjs');
const args=process.argv.slice(2);
const rootArg=args.indexOf('--root');
const root=path.resolve(rootArg>=0&&args[rootArg+1]?args[rootArg+1]:'game');
const write=args.includes('--write');
const verifyOnly=args.includes('--verify-only');
if(verifyOnly){assertPieceAssetBudget(root);console.log(`Piece asset budget PASS: <=${PIECE_RUNTIME_MAX_SIDE}px, <=${formatBytes(PIECE_RUNTIME_MAX_BYTES)} per runtime piece`);process.exit(0);}
const report=optimizePieceAssets(root,{write});
console.log(`Piece assets: ${report.count}`);
console.log(`Before: ${formatBytes(report.beforeBytes)}`);
console.log(`${write?'After':'Projected'}: ${formatBytes(report.afterBytes)}`);
console.log(`Saved: ${formatBytes(report.savedBytes)} (${report.savedPercent.toFixed(1)}%)`);
for(const item of report.records.filter(item=>!item.skipped).sort((a,b)=>(b.before-b.after)-(a.before-a.after)).slice(0,20)) console.log(`${item.path}: ${item.sourceWidth}x${item.sourceHeight} ${formatBytes(item.before)} -> ${item.width}x${item.height} ${formatBytes(item.after)}`);
if(write) assertPieceAssetBudget(root);
