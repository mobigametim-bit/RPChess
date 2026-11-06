const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173/';
const output=path.resolve(__dirname,'../test-results/mentor-training');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:30000});
  await page.locator('[data-mentor-open]').click();
  await page.locator('[data-mentor-screen]:not([hidden])').waitFor();
  assert.equal(await page.locator('[data-mentor-id]').count(),12);
  assert.equal(await page.locator('.mentor-pair').count(),6);
  await page.locator('[data-mentor-id="3"]').click();
  assert((await page.locator('.mentor-selected-name').textContent()).includes('Эйрин'));
  assert((await page.locator('.mentor-selected-level').textContent()).includes('800'));
  await page.screenshot({path:path.join(output,'setup-landscape.png'),animations:'disabled'});
  await page.locator('[data-mentor-action="start"]').click();
  assert.equal(await page.locator('[data-mentor-square]').count(),64);
  assert.equal(await page.locator('.mentor-board [data-square]').count(),64);
  const tile=await page.locator('.mentor-board [data-square="a8"]').evaluate(node=>getComputedStyle(node).backgroundImage);
  assert(tile.includes('/fae/board/'),'mentor squares use the selected race tile set: '+tile);
  const size=await page.locator('.mentor-board').evaluate(node=>{
   const rect=node.getBoundingClientRect();
   return {height:rect.height,width:rect.width,screenHeight:innerHeight};
  });
  assert(Math.abs(size.width-size.height)<4,'landscape chessboard is square');
  assert(size.height>=size.screenHeight-3,'landscape chessboard fills viewport height: '+JSON.stringify(size));
  assert.equal(await page.locator('.mentor-journal-head [data-board-view-toggle]').count(),1,'same board-view switch as Tournament');
  await page.locator('.mentor-journal-head [data-board-view-switch]').check({force:true});
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.simplePieces),'1');
  await page.locator('.mentor-journal-head [data-board-view-switch]').uncheck({force:true});
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.simplePieces),'0');
  await page.evaluate(()=>{
   const original=Element.prototype.animate;
   window.__mentorFlightCount=0;
   Element.prototype.animate=function(...args){
    if(this.classList?.contains('mentor-flight'))window.__mentorFlightCount++;
    return original.apply(this,args);
   };
  });
  assert.equal(await page.locator('.mentor-piece').count(),32);
  const initial=await page.evaluate(()=>window.RPChessMentorTraining.state.fen);
  await page.locator('[data-mentor-square="e2"]').click();
  await page.locator('[data-mentor-square="e4"]').click();
  await page.waitForFunction(()=>window.RPChessMentorTraining.state.moves.length>=2,{timeout:30000});
  const played=await page.evaluate(()=>window.RPChessMentorTraining.state);
  assert.equal(played.moves[0].uci,'e2e4');
  assert.notEqual(played.fen,initial);
  await page.screenshot({path:path.join(output,'battle-landscape.png'),animations:'disabled'});
  await page.locator('.mentor-journal [data-mentor-action="prev"]').click();
  assert.equal(await page.evaluate(()=>window.RPChessMentorTraining.state.cursor),1);
  await page.locator('.mentor-journal [data-mentor-action="next"]').click();
  assert.equal(await page.evaluate(()=>window.RPChessMentorTraining.state.cursor),2);
  await page.locator('.mentor-journal [data-mentor-action="prev"]').click();
  await page.locator('.mentor-journal [data-mentor-action="prev"]').click();
  assert.equal(await page.evaluate(()=>window.RPChessMentorTraining.state.fen),initial);
  const source=await page.locator('[data-mentor-square="d2"]').boundingBox();
  const target=await page.locator('[data-mentor-square="d4"]').boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);
  await page.mouse.down();
  await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:6});
  assert.equal(await page.locator('.rpchess-piece-drag-ghost').count(),1,'drag must show shared piece ghost');
  await page.mouse.up();
  await page.waitForFunction(()=>window.RPChessMentorTraining.state.moves.length>=2,{timeout:30000});
  const branch=await page.evaluate(()=>window.RPChessMentorTraining.state);
  assert.equal(branch.moves[0].uci,'d2d4','dragging from the past replaces the old main line');
  assert(await page.evaluate(()=>window.__mentorFlightCount)>=2,'both player and Stockfish moves animate with Tournament timing');
  assert.equal(await page.locator('.mentor-feedback-grade').count()&&
   (await page.locator('.mentor-feedback-grade').innerText()).includes('cp'),false,
   'centipawn loss must not be shown to the player');
  assert.equal(branch.cursor,branch.moves.length);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'battle-portrait.png'),animations:'disabled'});
  const metrics=await page.evaluate(()=>{
   const root=document.querySelector('[data-mentor-screen]'),board=root.querySelector('.mentor-board').getBoundingClientRect();
   return {boardWidth:board.width,boardHeight:board.height,screenWidth:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  assert(Math.abs(metrics.boardWidth-metrics.boardHeight)<4,'portrait board square');
  assert(metrics.screenWidth<=metrics.viewport+4,'portrait has no horizontal overflow: '+JSON.stringify(metrics));
  assert.equal(await page.locator('.mentor-mobile-toggle [data-board-view-toggle]').count(),1,
   'portrait has an accessible board art switch');
  await page.locator('[data-mentor-action="journal"]').first().click();
  assert(await page.locator('.mentor-journal').evaluate(e=>e.classList.contains('is-open')),'portrait journal opens');
  await page.locator('.mentor-journal [data-mentor-action="journal"]').click();
  await page.locator('[data-mentor-action="catalog"]').click();
  assert.equal(await page.locator('[data-mentor-id]').count(),12);
  await page.screenshot({path:path.join(output,'setup-portrait.png'),animations:'disabled'});
  await page.locator('[data-mentor-color="b"]').click();
  await page.locator('[data-mentor-action="start"]').click();
  await page.waitForFunction(()=>window.RPChessMentorTraining.state.moves.length>=1,{timeout:30000});
  assert.equal((await page.evaluate(()=>window.RPChessMentorTraining.state)).moves[0].color,'w','computer opens for black player');
  assert.equal(errors.length,0,'browser errors: '+errors.join('\n'));
  console.log('Mentor training real Stockfish, history branch, 12 mentors and phone: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});