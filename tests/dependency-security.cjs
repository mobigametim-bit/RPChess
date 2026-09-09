const assert=require('assert'),fs=require('fs'),path=require('path');

const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));

function parts(value){return String(value||'').replace(/^v/,'').split(/[.-]/).slice(0,3).map((part)=>Number.parseInt(part,10)||0);}
function compare(left,right){const a=parts(left),b=parts(right);for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]-b[i];}return 0;}
function atLeast(value,floor){return compare(value,floor)>=0;}
function directSourceFiles(dir){
  const result=[];
  if(!fs.existsSync(dir))return result;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='dist'||entry.name==='.git')continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())result.push(...directSourceFiles(full));
    else if(/\.(?:cjs|mjs|js)$/.test(entry.name))result.push(full);
  }
  return result;
}

assert(pkg.devDependencies&&typeof pkg.devDependencies==='object','devDependencies contract missing');
assert.strictEqual(Object.prototype.hasOwnProperty.call(pkg.devDependencies,'adm-zip'),false,'unused vulnerable adm-zip must not return as a direct dependency');
assert.strictEqual(pkg.devDependencies.esbuild,'0.25.8','direct esbuild remains intentionally pinned until a separate upgrade is justified');
assert(pkg.devDependencies.wrangler,'Wrangler must remain explicit because Cloudflare deploy is a manual owner action');

for(const file of [...directSourceFiles(path.join(root,'game')),...directSourceFiles(path.join(root,'scripts')),...directSourceFiles(path.join(root,'tests'))]){
  if(file===__filename)continue;
  const source=fs.readFileSync(file,'utf8');
  assert(!/(?:from\s*['"]adm-zip['"]|require\(\s*['"]adm-zip['"]\s*\))/.test(source),`adm-zip runtime/tooling import must not return: ${path.relative(root,file)}`);
}

const installed=(name)=>lock.packages?.[`node_modules/${name}`]?.version||null;
const nested=(parent,name)=>lock.packages?.[`node_modules/${parent}/node_modules/${name}`]?.version||null;
const directEsbuild=installed('esbuild');
assert(directEsbuild,'direct esbuild lock entry missing');
assert(compare(directEsbuild,'0.27.3')<0||atLeast(directEsbuild,'0.28.1'),`esbuild ${directEsbuild} falls inside GHSA-g7r4-m6w7-qqqr affected range`);

const wrangler=installed('wrangler');
assert(wrangler,'Wrangler lock entry missing');
const wranglerEsbuild=nested('wrangler','esbuild');
assert(wranglerEsbuild&&atLeast(wranglerEsbuild,'0.28.1'),`Wrangler esbuild must stay at patched 0.28.1+ floor, got ${wranglerEsbuild}`);
const undici=installed('undici');
assert(undici&&atLeast(undici,'7.28.0'),`Undici must stay at the 7.28.0+ security release floor, got ${undici}`);
const ws=installed('ws');
assert(ws&&atLeast(ws,'8.21.0'),`ws must stay at the 8.21.0+ fragmentation DoS fix floor, got ${ws}`);
const pathToRegexp=installed('path-to-regexp');
assert(pathToRegexp&&atLeast(pathToRegexp,'6.3.0'),`path-to-regexp must stay at the 6.3.0+ backtracking fix floor, got ${pathToRegexp}`);

console.log(`Dependency security contract: PASS (esbuild ${directEsbuild}; wrangler ${wrangler}; nested esbuild ${wranglerEsbuild}; undici ${undici}; ws ${ws}; path-to-regexp ${pathToRegexp}; adm-zip direct edge removed)`);
