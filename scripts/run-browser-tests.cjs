const fs=require('fs');
const http=require('http');
const path=require('path');
const {spawn}=require('child_process');

const ROOT=path.resolve(__dirname,'..');
const DIST=path.join(ROOT,'dist');
const HOST='127.0.0.1';
const PORT=Number(process.env.RPCHESS_GATE_PORT||4173);
const BASE=`http://${HOST}:${PORT}`;
const DEFAULT_TESTS=[
  'reboot-foundation-browser.cjs',
  'classic-chess-browser.cjs',
  'race-board-themes-browser.cjs',
  'roster-browser.cjs',
  'skirmish-browser.cjs',
  'battle-browser.cjs',
  'battle-animation-art-browser.cjs',
  'travel-choice-browser.cjs',
  'resources-browser.cjs',
  'settlement-browser.cjs',
  'starvation-browser.cjs',
  'events-browser.cjs',
  'puzzles-browser.cjs'
];
const requested=String(process.env.RPCHESS_BROWSER_TEST||'').trim();
const TESTS=requested?requested.split(',').map(item=>item.trim()).filter(Boolean):DEFAULT_TESTS;
for(const test of TESTS)if(!DEFAULT_TESTS.includes(test))throw new Error(`Unknown RPChess browser test: ${test}`);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wasm':'application/wasm','.otf':'font/otf'};

function requirePrerequisites(){
  if(!fs.existsSync(path.join(DIST,'index.html')))throw new Error('dist/index.html is missing. Run npm run gate:local first.');
  try{require.resolve('playwright',{paths:[ROOT]});}catch{
    throw new Error('Playwright is not installed. Run: npm install --no-save --package-lock=false --ignore-scripts playwright@1.54.2 && npx playwright install chromium');
  }
}
function safeFile(url){
  const raw=decodeURIComponent(String(url||'/').split('?')[0]);
  const requested=raw==='/'?'index.html':raw.replace(/^\/+/, '');
  const resolved=path.resolve(DIST,requested);
  if(!resolved.startsWith(`${DIST}${path.sep}`)&&resolved!==DIST)return null;
  if(fs.existsSync(resolved)&&fs.statSync(resolved).isFile())return resolved;
  return path.join(DIST,'index.html');
}
function server(){
  return http.createServer((req,res)=>{
    const file=safeFile(req.url);
    if(!file){res.writeHead(403);res.end('Forbidden');return;}
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
  console.log(`[browser gate] ${BASE}`);
  try{
    for(const test of TESTS){console.log(`\n[browser gate] ${test}`);await run(test);}
    console.log(`\nRPChess ${requested?'targeted':'full'} real-Chromium regression: PASS`);
  }finally{
    await new Promise(resolve=>app.close(resolve));
  }
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
