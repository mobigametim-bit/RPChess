const fs=require('fs');
const path=require('path');
const {parsePng,optimizePngBuffer,formatBytes}=require('./piece-asset-runtime.cjs');

const RESOURCE_ICON_RUNTIME_MAX_SIDE=192;
const RESOURCE_ICON_RUNTIME_MAX_BYTES=128*1024;
const RESOURCE_ICON_PATHS=Object.freeze([
  'generated_assets/reward_supplies.png'
]);

function inspect(root){
  return RESOURCE_ICON_PATHS.map((relative)=>{
    const full=path.join(root,relative);
    if(!fs.existsSync(full))throw new Error(`[resource icon asset] missing ${relative}`);
    const buffer=fs.readFileSync(full),png=parsePng(buffer);
    return {path:relative,bytes:buffer.length,width:png.width,height:png.height};
  });
}

function verify(root){
  const failures=[];
  for(const item of inspect(root)){
    if(item.width>RESOURCE_ICON_RUNTIME_MAX_SIDE||item.height>RESOURCE_ICON_RUNTIME_MAX_SIDE||item.bytes>RESOURCE_ICON_RUNTIME_MAX_BYTES){
      failures.push(`${item.path}: ${item.width}x${item.height}, ${item.bytes} bytes`);
    }
  }
  if(failures.length)throw new Error(`[resource icon asset budget] production resource icons exceed <= ${RESOURCE_ICON_RUNTIME_MAX_SIDE}px / <= ${RESOURCE_ICON_RUNTIME_MAX_BYTES} bytes:\n${failures.join('\n')}`);
  return true;
}

function optimize(root,{write=true}={}){
  const records=[];
  for(const item of inspect(root)){
    const full=path.join(root,item.path),source=fs.readFileSync(full);
    const optimized=optimizePngBuffer(source,RESOURCE_ICON_RUNTIME_MAX_SIDE);
    const sourceFitsDimensions=item.width<=RESOURCE_ICON_RUNTIME_MAX_SIDE&&item.height<=RESOURCE_ICON_RUNTIME_MAX_SIDE;
    const keepSource=sourceFitsDimensions&&source.length<=optimized.buffer.length;
    const output=keepSource?source:optimized.buffer;
    const width=keepSource?item.width:optimized.width;
    const height=keepSource?item.height:optimized.height;
    if(output.length>RESOURCE_ICON_RUNTIME_MAX_BYTES)throw new Error(`[resource icon asset budget] ${item.path}: ${output.length} bytes exceeds ${RESOURCE_ICON_RUNTIME_MAX_BYTES}`);
    if(write)fs.writeFileSync(full,output);
    records.push({path:item.path,before:item.bytes,after:output.length,sourceWidth:item.width,sourceHeight:item.height,width,height,keptSource:keepSource});
  }
  return records;
}

function parseArgs(argv){
  const args={root:path.resolve(__dirname,'..','dist'),verifyOnly:false};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--root'&&argv[i+1])args.root=path.resolve(argv[++i]);
    else if(argv[i]==='--verify-only')args.verifyOnly=true;
  }
  return args;
}

if(require.main===module){
  try{
    const args=parseArgs(process.argv.slice(2));
    if(args.verifyOnly){
      verify(args.root);
      const items=inspect(args.root);
      console.log(`Runtime resource icons: PASS — ${items.length} file(s), <= ${RESOURCE_ICON_RUNTIME_MAX_SIDE}px / <= ${formatBytes(RESOURCE_ICON_RUNTIME_MAX_BYTES)}`);
    }else{
      const records=optimize(args.root,{write:true});
      verify(args.root);
      const before=records.reduce((sum,item)=>sum+item.before,0),after=records.reduce((sum,item)=>sum+item.after,0);
      console.log(`Runtime resource icons: ${records.length}; ${formatBytes(before)} -> ${formatBytes(after)}; saved ${formatBytes(before-after)}`);
    }
  }catch(error){console.error(error.stack||error);process.exitCode=1;}
}

module.exports={RESOURCE_ICON_RUNTIME_MAX_SIDE,RESOURCE_ICON_RUNTIME_MAX_BYTES,RESOURCE_ICON_PATHS,inspect,verify,optimize};