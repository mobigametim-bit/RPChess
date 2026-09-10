const fs=require('fs');
const http=require('http');
const path=require('path');
const {spawn}=require('child_process');

const ROOT=path.resolve(__dirname,'..');
const RAW_DIST=String(process.env.RPCHESS_GATE_DIST||'dist').trim();
if(!RAW_DIST||path.isAbsolute(RAW_DIST)||RAW_DIST.split(/[\\/]+/).includes('..'))throw new Error(`Invalid RPCHESS_GATE_DIST: ${RAW_DIST}`);
const DIST=path.join(ROOT,RAW_DIST);
const HOST='127.0.0.1';
const PORT=Number(process.env.RPCHESS_GATE_PORT||4173);
const RAW_PREFIX=String(process.env.RPCHESS_GATE_PREFIX||'').trim();
const PREFIX=RAW_PREFIX?`/${RAW_PREFIX.replace(/^\/+|\/+$/g,'')}`:'';
const BASE=`http://${HOST}:${PORT}${PREFIX}${PREFIX?'/':''}`;
const DEFAULT_TESTS=[
  'reboot-foundation-browser.cjs',
  'classic-chess-browser.cjs',
  'race-board-themes-browser.cjs',
  'king-pin-ice-browser.cjs',
  'responsive-viewport-browser.cjs',
  'roster-browser.cjs',
  'skirmish-browser.cjs',
  'battle-browser.cjs',
  'combat-side-colors-browser.cjs',
  'combat-aura-move-sync-browser.cjs',
  'battle-animation-art-browser.cjs',
  'travel-choice-browser.cjs',
  'resources-browser.cjs',
  'settlement-browser.cjs',
  'starvation-browser.cjs',
  'events-browser.cjs',
  'puzzles-browser.cjs'
];
const OPTIONAL_TESTS=['vk-platform-browser.cjs'];
const ALLOWED_TESTS=new Set([...DEFAULT_TESTS,...OPTIONAL_TESTS]);
const requested=String(process.env.RPCHESS_BROWSER_TEST||'').trim();
const TESTS=requested?requested.split(',').map(item=>item.trim()).filter(Boolean):DEFAULT_TESTS;
for(const test of TESTS)if(!ALLOWED_TESTS.has(test))throw new Error(`Unknown RPChess browser test: ${test}`);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wasm':'application/wasm','.otf':'font/otf','.txt':'text/plain; charset=utf-8'};

function requirePrerequisites(){
  if(!fs.existsSync(path.join(DIST,'index.html')))throw new Error(`${RAW_DIST}/index.html is missing. Build the requested distribution first.`);
  try{require.resolve('playwright',{paths:[ROOT]});}catch{
    throw new Error('Playwright is not installed. Run: npm install --no-save --package-lock=false --ignore-scripts playwright@1.54.2 && npx playwright install chromium');
  }
}
function safeFile(url){
  let raw=decodeURIComponent(String(url||'/').split('?')[0]);
  if(PREFIX){
    if(raw===PREFIX)raw=`${PREFIX}/`;
    if(!raw.startsWith(`${PREFIX}/`))return null;
    raw=raw.slice(PREFIX.length);
  }
  const requested=raw==='/'?'index.html':raw.replace(/^\/+/, '');
  const resolved=path.resolve(DIST,requested);
  if(!resolved.startsWith(`${DIST}${path.sep}`)&&resolved!==DIST)return null;
  if(fs.existsSync(resolved)&&fs.statSync(resolved).isFile())return resolved;
  return path.join(DIST,'index.html');
}
function server(){
  return http.createServer((req,res)=>{
    const file=safeFile(req.url);
    if(!file){res.writeHead(404);res.end('Not Found');return;}
    fs.readFile(file,(error,buffer)=>{
      if(error){res.writeHead(500);res.end(String(error));return;}
      res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(buffer);
    });
  });
}
function run(test){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(ROOT,'tests',test)],{cwd:ROOT,stdio:'inherit',env:{...process.env,RPCHESS_ACCEPTANCE_URL:BASE}});
    child.on('error',reject);
    child.on('exit',(code,signal)=>code===0?resolve():reject(new Error(`${test} failed with ${signal||`exit ${code}`}`)));
  });
}
(async()=>{
  requirePrerequisites();
  const app=server();
  await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(PORT,HOST,resolve);});
  console.log(`[browser gate] dist=${RAW_DIST} ${BASE}`);
  try{
    for(const test of TESTS){console.log(`\n[browser gate] ${test}`);await run(test);}
    console.log(`\nRPChess ${requested?'targeted':'full'} real-Chromium regression: PASS`);
  }finally{
    await new Promise(resolve=>app.close(resolve));
  }
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
