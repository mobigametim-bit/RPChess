const fs=require('fs'),path=require('path');

const root=path.resolve(__dirname,'..');
const game=path.join(root,'game');
const ASSET_ROOTS=['generated_assets','assets','music','SFX'];
const TEXT_EXTENSIONS=new Set(['.html','.css','.js','.mjs','.cjs','.json']);
const MEDIA_EXTENSIONS=new Set(['.png','.jpg','.jpeg','.webp','.svg','.mp3','.wav','.ogg','.wasm','.otf']);
const PIECES=new Set(['pawn','knight','bishop','rook','queen','king']);
const RACES=new Set(['humans','elves','orcs','undead','dark_elves','dwarves','demons','angels','dragonborn','beastfolk','constructs','animals','fae','goblins']);

function walk(dir){
  if(!fs.existsSync(dir))return[];
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
function unix(value){return value.split(path.sep).join('/');}
function relativeToGame(full){return unix(path.relative(game,full));}
function isAsset(full){return MEDIA_EXTENSIONS.has(path.extname(full).toLowerCase());}
function isRuntimeText(full){
  if(!TEXT_EXTENSIONS.has(path.extname(full).toLowerCase()))return false;
  const relative=relativeToGame(full);
  return !ASSET_ROOTS.some((assetRoot)=>relative===assetRoot||relative.startsWith(`${assetRoot}/`));
}

const sourceFiles=walk(game).filter(isRuntimeText);
const sources=sourceFiles.map((full)=>({full,relative:relativeToGame(full),text:fs.readFileSync(full,'utf8')}));
const allSource=sources.map(({text})=>text).join('\n');
const assets=ASSET_ROOTS.flatMap((assetRoot)=>walk(path.join(game,assetRoot))).filter(isAsset);

function explicitReferences(relative){
  const normalized=unix(relative);
  const basename=path.posix.basename(normalized);
  const direct=sources.filter(({text})=>text.includes(normalized)).map(({relative})=>relative);
  if(direct.length)return direct;
  // CSS normally references ../generated_assets/foo.png; the normalized runtime suffix still matches.
  // A bare basename is accepted only when globally unique among runtime assets, avoiding false reachability.
  const sameBasename=assets.filter((full)=>path.basename(full)===basename);
  if(sameBasename.length===1){
    const bare=sources.filter(({text})=>text.includes(basename)).map(({relative})=>relative);
    if(bare.length)return bare;
  }
  return[];
}

function dynamicFamily(relative){
  const parts=unix(relative).split('/');
  if(parts[0]==='assets'&&parts[1]==='races'&&RACES.has(parts[2])){
    if(parts[3]==='board'&&['white.png','black.png'].includes(parts[4]))return'race-board-tiles';
    if(parts[3]==='pieces'){
      const filename=parts.at(-1)||'';
      const piece=filename.replace(/\.[^.]+$/,'');
      if(PIECES.has(piece))return'race-piece-art';
    }
  }
  if(parts[0]==='assets'&&parts[1]==='events'&&parts[2]==='register-04'&&parts[3]==='backgrounds')return'event-background-pool';
  if(parts[0]==='generated_assets'){
    const match=(parts[1]||'').match(/^unit_(pawn|knight|bishop|rook|queen|king)_(player|enemy)\.png$/);
    if(match)return'generated-core-piece-set';
  }
  return null;
}

const rows=assets.map((full)=>{
  const relative=relativeToGame(full);
  const refs=explicitReferences(relative);
  const family=dynamicFamily(relative);
  return {relative,bytes:fs.statSync(full).size,status:refs.length?'explicit':family?'dynamic-family':'candidate',family,refs};
});

const groups=Object.groupBy?Object.groupBy(rows,(row)=>row.status):rows.reduce((acc,row)=>((acc[row.status]||=[]).push(row),acc),{});
for(const name of ['explicit','dynamic-family','candidate'])if(!groups[name])groups[name]=[];
const bytes=(list)=>list.reduce((sum,row)=>sum+row.bytes,0);
const mib=(value)=>(value/1024/1024).toFixed(2);

console.log('RPChess production asset reachability inventory');
console.log(`runtime text sources: ${sourceFiles.length}`);
console.log(`assets: ${rows.length}; explicit ${groups.explicit.length}; dynamic-family ${groups['dynamic-family'].length}; candidates ${groups.candidate.length}`);
console.log(`candidate bytes: ${bytes(groups.candidate)} (${mib(bytes(groups.candidate))} MiB)`);
console.log('');
for(const row of groups.candidate.sort((a,b)=>b.bytes-a.bytes||a.relative.localeCompare(b.relative)))console.log(`CANDIDATE\t${row.bytes}\t${row.relative}`);
console.log('');
for(const [family,list] of Object.entries(groups['dynamic-family'].reduce((acc,row)=>((acc[row.family]||=[]).push(row),acc),{})).sort(([a],[b])=>a.localeCompare(b)))console.log(`DYNAMIC\t${family}\t${list.length}\t${mib(bytes(list))} MiB`);

if(process.argv.includes('--json')){
  const report={summary:{sources:sourceFiles.length,assets:rows.length,explicit:groups.explicit.length,dynamic:groups['dynamic-family'].length,candidates:groups.candidate.length,candidateBytes:bytes(groups.candidate)},candidates:groups.candidate,dynamicFamilies:groups['dynamic-family']};
  process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
}

module.exports={rows,candidates:groups.candidate,dynamicFamilies:groups['dynamic-family']};
