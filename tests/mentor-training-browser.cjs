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
  // Check the actual PNG response, not just the race name in computed CSS.
  // A relative url() consumed from /css/ silently requests /css/assets/...
  async function checkLiveRaceTile(race){
   for(const [square,filename] of [['a8','white.png'],['a7','black.png']]){
    const result=await page.locator('.mentor-board [data-square="'+square+'"]').evaluate(async node=>{
     const cssImage=getComputedStyle(node).backgroundImage;
     const resolved=cssImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1]||'';
     if(!resolved)return {cssImage,resolved,status:null,mime:null};
     const response=await fetch(resolved,{cache:'no-store'});
     return {cssImage,resolved,status:response.status,mime:response.headers.get('content-type')};
    });
    assert(result.resolved.includes('/assets/races/'+race+'/board/'+filename),'wrong race tile: '+JSON.stringify(result));
    assert(!result.resolved.includes('/css/assets/'),'tile URL resolved relative to CSS, not document: '+JSON.stringify(result));
    assert.equal(result.status,200,'race tile must load, not fall back to plain colors: '+JSON.stringify(result));
    assert.match(result.mime||'',/image\/png/,'race tile must be a real PNG: '+JSON.stringify(result));
   }
  }
  await checkLiveRaceTile('fae');
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
  const feedbackGradeText=await page.locator('.mentor-feedback-grade').allTextContents();
  assert(feedbackGradeText.every(value=>!/(?:^|\\s)\\d+\\s*cp\\b/i.test(value)),
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
  // Reported regression: elf mentor ("Сильвена") showed beige default tiles.
  await page.locator('[data-mentor-action="catalog"]').click();
  await page.locator('[data-mentor-id="9"]').click();
  await page.locator('[data-mentor-color="w"]').click();
  await page.locator('[data-mentor-action="start"]').click();
  await checkLiveRaceTile('elves');
  await page.setViewportSize({width:1280,height:800});
  await page.screenshot({path:path.join(output,'battle-elven-race-tiles.png'),animations:'disabled'});
  // An actual blunder after 1.f3 e5 2.g4 must trigger the 1700 ms
  // secondary Stockfish search. Mock only the paid API response.
  await page.evaluate(()=>localStorage.setItem('rpchess.mentor-training.v1',JSON.stringify({
   version:1,selected:1,color:'w',playing:true,
   moves:[{uci:'f2f3',color:'w'},{uci:'e7e5',color:'b'}],cursor:2
  })));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-mentor-open]').waitFor({timeout:30000});
  await page.evaluate(()=>{
   const original=Worker.prototype.postMessage;
   window.__mentorDepthSearch=[];
   Worker.prototype.postMessage=function(message,...args){
    if(typeof message==='string'&&message.startsWith('go movetime '))
     window.__mentorDepthSearch.push(message);
    return original.call(this,message,...args);
   };
  });
  await page.route('https://rpchess-mentor-api-preview.mobigametim.workers.dev/v1/explain',async route=>{
   const headers={'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type, X-Mentor-Session',
    'Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(route.request().method()==='OPTIONS')
    return route.fulfill({status:204,headers});
   return route.fulfill({status:200,contentType:'application/json',headers,
    body:JSON.stringify({grade:'blunder',
     explanation:'Ход допустил матовую угрозу. Проверь, какие поля возле короля остались без защиты.'})});
  });
  await page.locator('[data-mentor-open]').click();
  const mentorRequest=page.waitForRequest(req=>req.url().endsWith('/v1/explain')&&req.method()==='POST',{timeout:45000});
  await page.locator('[data-mentor-square="g2"]').click();
  await page.locator('[data-mentor-square="g4"]').click();
  await page.waitForFunction(()=>window.__mentorDepthSearch.includes('go movetime 1700'),null,{timeout:30000});
  const observed=await mentorRequest;
  const detail=observed.postDataJSON();
  assert.equal(detail.grade,'blunder','real Stockfish identifies a known mate-in-one blunder');
  assert(detail.continuation?.depth>=5,'deep search depth must reach a usable value');
  assert(detail.continuation?.pv.length>=1&&detail.continuation.pv.length<=20,
   'deep search emits up to 20 half-moves after the blunder');
  assert.equal(detail.continuation.pv[0],'d8h4','deep line should begin with mate in one');
  await page.waitForFunction(()=>document.querySelector('.mentor-feedback-text')?.textContent?.includes('матовую угрозу'),
   null,{timeout:15000});
  await page.screenshot({path:path.join(output,'battle-deep-mentor-response.png'),animations:'disabled'});
  assert.equal(errors.length,0,'browser errors: '+errors.join('\n'));
  console.log('Mentor training real Stockfish, history branch, 12 mentors and phone: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});