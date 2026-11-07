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

  async function verifySquareMentorCards(columns){
   const layout=await page.evaluate(()=>{
    const scroll=document.querySelector('.mentor-catalog-scroll');
    const choices=[...document.querySelectorAll('.mentor-choice')];
    const sizes=choices.map(node=>{
     const rect=node.getBoundingClientRect();
     return {width:rect.width,height:rect.height};
    });
    const icons=[...document.querySelectorAll('.mentor-choice .mentor-power-icon')];
    const selected=document.querySelector('.mentor-selected .mentor-power-icon');
    return {columns:getComputedStyle(scroll).gridTemplateColumns.split(' ').length,
     sizes,icons:icons.map(x=>({src:x.getAttribute('src'),loaded:x.complete&&x.naturalWidth>0})),
     selected:{src:selected?.getAttribute('src'),loaded:selected?.complete&&selected.naturalWidth>0},
     text:document.querySelector('.mentor-setup').textContent};
   });
   assert.equal(layout.columns,columns,'mentor pairs must keep a responsive grid');
   assert.equal(layout.sizes.length,12);
   for(const size of layout.sizes)
    assert(size.width>70&&Math.abs(size.width-size.height)<2.5,
     'mentor card must be square: '+JSON.stringify(size));
   assert.equal(layout.icons.length,12);
   for(const icon of layout.icons){
    assert.equal(icon.src,'generated_assets/node_battle.png','use the existing Arena power icon');
    assert.equal(icon.loaded,true,'power icon must be loaded and visible');
   }
   assert.equal(layout.selected.src,'generated_assets/node_battle.png');
   assert.equal(layout.selected.loaded,true,'selected mentor power icon must load');
   assert(!/\bElo\b/.test(layout.text),'setup must display power icons, not Elo labels');
  }
  await verifySquareMentorCards(2);
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
  await verifySquareMentorCards(1);
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
  let mockedMentorCalls=0;
  await page.route('https://rpchess-mentor-api-preview.mobigametim.workers.dev/v1/explain',async route=>{
   const headers={'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type, X-Mentor-Session',
    'Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(route.request().method()==='OPTIONS')
    return route.fulfill({status:204,headers});
   mockedMentorCalls++;
   await new Promise(resolve=>setTimeout(resolve,750)); // Inspect visible pending state.
   if(mockedMentorCalls===1)
    return route.fulfill({status:503,contentType:'application/json',headers,
     body:JSON.stringify({error:'model_chain_failed',reason:'broker_timeout',
      attempts:[{model:'deepseek-ai/DeepSeek-V4-Flash-0731',reason:'broker_timeout'}]})});
   return route.fulfill({status:200,contentType:'application/json',headers,
    body:JSON.stringify({grade:'blunder',source:'minimax',model:'MiniMaxAI/MiniMax-M2.7',attempts:2,
     explanation:'Ход допускает быструю атаку на короля. Посмотри, какие защитники теперь не могут помочь. Попробуй найти, что следовало учесть до этого решения.'})});
  });
  await page.locator('[data-mentor-open]').click();
  const mentorRequest=page.waitForRequest(req=>req.url().endsWith('/v1/explain')&&req.method()==='POST',{timeout:45000});
  await page.locator('[data-mentor-square="g2"]').click();
  await page.locator('[data-mentor-square="g4"]').click();
  await page.waitForFunction(()=>window.__mentorDepthSearch.includes('go movetime 1700'),null,{timeout:30000});
  const observed=await mentorRequest;
  await page.locator('.mentor-feedback-head .mentor-thinking').waitFor({timeout:3000});
  assert.equal((await page.locator('.mentor-thinking').textContent()).trim(),'Думаю…');
  assert(await page.locator('.mentor-thinking').evaluate(node=>getComputedStyle(node).animationName!=='none'),
   'the mentor thinking label blinks while the API request is pending');
  const detail=observed.postDataJSON();
  assert.equal(detail.grade,'blunder','real Stockfish identifies a known mate-in-one blunder');
  assert(detail.continuation?.depth>=5,'deep search depth must reach a usable value');
  assert(detail.continuation?.pv.length>=1&&detail.continuation.pv.length<=20,
   'deep search emits up to 20 half-moves after the blunder');
  assert.equal(detail.continuation.pv[0],'d8h4','deep line should begin with mate in one');
  await page.waitForFunction(()=>document.querySelector('[data-mentor-action="retry-explanation"]')&&
   document.querySelector('.mentor-feedback-text')?.textContent?.includes('Зевок.'),
   null,{timeout:15000});
  const afterFailure=await page.evaluate(()=>window.RPChessMentorTraining.state.moves.findLast(m=>m.grade==='blunder'&&m.color==='w'));
  assert.equal(afterFailure.mentorSource,'fallback','an unsuccessful broker call must not masquerade as AI');
  assert.equal(await page.locator('.mentor-thinking').count(),0,'thinking label disappears when fallback is ready');
  assert.equal(afterFailure.mentorReason,'broker_timeout','the reason is available for debugging');
  await page.locator('[data-mentor-action="retry-explanation"]').click();
  await page.waitForFunction(()=>document.querySelector('.mentor-feedback-text')?.textContent?.includes('быструю атаку'),
   null,{timeout:15000});
  const afterSuccess=await page.evaluate(()=>window.RPChessMentorTraining.state.moves.findLast(m=>m.grade==='blunder'&&m.color==='w'));
  assert.equal(afterSuccess.mentorSource,'minimax','a successful backup model is recorded');
  assert.equal(afterSuccess.mentorModel,'MiniMaxAI/MiniMax-M2.7');
  assert.equal(mockedMentorCalls,2,'manual retry does not require replaying a move');
  assert.equal(await page.locator('[data-mentor-action="retry-explanation"]').count(),0,'retry disappears on success');
  await page.screenshot({path:path.join(output,'battle-deep-mentor-response.png'),animations:'disabled'});
  // The computed line can be explored without modifying actual training moves.
  const playedHistory=await page.evaluate(()=>window.RPChessMentorTraining.state.moves.map(m=>m.uci));
  await page.locator('[data-mentor-action="open-variation"]').click();
  assert.equal(await page.locator('.mentor-variation:not([hidden])').count(),1,'variation panel opens');
  assert.equal(await page.locator('[data-mentor-line="1"]').count(),1,'every PV ply is clickable');
  await page.locator('[data-mentor-line="1"]').click();
  assert(await page.locator('[data-mentor-line="1"]').evaluate(e=>e.classList.contains('is-active')),
   'clicking an engine move selects that exact board position');
  assert.equal(await page.locator('[data-mentor-square="h4"] .mentor-piece').count(),1,
   'first PV move places the enemy queen on h4');
  assert.deepEqual(await page.evaluate(()=>window.RPChessMentorTraining.state.moves.map(m=>m.uci)),
   playedHistory,'PV inspection must not change the real move history');
  await page.screenshot({path:path.join(output,'battle-clickable-stockfish-line.png'),animations:'disabled'});
  await page.locator('[data-mentor-action="close-variation"]').click();
  assert.equal(await page.locator('.mentor-variation:not([hidden])').count(),0,
   'closing analysis restores the live board');
  assert.deepEqual(await page.evaluate(()=>window.RPChessMentorTraining.state.moves.map(m=>m.uci)),
   playedHistory,'returning to the game keeps moves intact');
  // The same king-check aura as Arena/Tournament must be visible during
  // an ordinary (non-terminal) check, independently of player orientation.
  const saveMentorPosition=async(seq,player='w')=>page.evaluate(({seq,player})=>{
   localStorage.setItem('rpchess.mentor-training.v1',JSON.stringify({
    version:1,selected:1,color:player,playing:true,
    moves:seq.map((uci,i)=>({uci,color:i%2?'b':'w'})),cursor:seq.length
   }));
  },{seq,player});
  await saveMentorPosition(['e2e4','e7e5','f2f4','e5f4','g1f3','d8h4']);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-mentor-open]').click();
  const checkedKing=page.locator('[data-mentor-square="e1"].is-check');
  await checkedKing.waitFor({timeout:15000});
  const checkVfx=await checkedKing.evaluate(node=>{
   const style=getComputedStyle(node,'::after');
   const image=node.querySelector('.mentor-piece.classic-piece');
   const simple=node.querySelector('.rpchess-fantasy-piece');
   return {image:style.backgroundImage,opacity:style.opacity,content:style.content,
    auraLayer:Number(style.zIndex),pieceLayer:Number(getComputedStyle(image).zIndex),
    simpleLayer:Number(getComputedStyle(simple).zIndex)};
  });
  assert(checkVfx.image.includes('aura_red.png'),'checked king must use the shared red aura art');
  assert(Number(checkVfx.opacity)>=.7,'red aura must be visible, not fully transparent');
  assert(checkVfx.auraLayer<checkVfx.pieceLayer,'red check aura must be BEHIND the king image');
  assert(checkVfx.auraLayer<checkVfx.simpleLayer,'red check aura must be BEHIND the simplified king');
  assert.equal(await page.locator('[data-mentor-result]').count(),0,'a check without mate must not end the game');
  await page.screenshot({path:path.join(output,'battle-red-check-aura.png'),animations:'disabled'});
  // Scholar's mate: the player makes the final move, game ends instantly,
  // without awaiting the move-evaluation worker or a paid Gonka call.
  const mateSetup=['e2e4','e7e5','d1h5','b8c6','f1c4','g8f6'];
  await saveMentorPosition(mateSetup);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-mentor-open]').click();
  await page.locator('[data-mentor-square="h5"]').click();
  await page.locator('[data-mentor-square="f7"]').click();
  await page.locator('[data-mentor-result] h2').waitFor({timeout:15000});
  assert.equal((await page.locator('[data-mentor-result] h2').textContent()).trim(),'Победа!');
  assert.equal(await page.locator('.mentor-result-actions button').count(),3);
  const actions=await page.locator('.mentor-result-actions button').allTextContents();
  assert.deepEqual(actions.map(x=>x.trim()),['Анализировать','Главное меню','К наставникам']);
  assert(await page.locator('[data-mentor-square="e8"].is-check').count(),
   'checkmate must keep the checked king red');
  const terminal=await page.evaluate(()=>window.RPChessMentorTraining.state);
  assert.equal(terminal.moves.length,7,'the winning move is in the saved game history');
  assert.equal(terminal.cursor,7);
  await page.screenshot({path:path.join(output,'battle-mentor-victory.png'),animations:'disabled'});
  // The win must still be visible after reload, with review accessible.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-mentor-open]').click();
  await page.locator('[data-mentor-result]').waitFor({timeout:15000});
  await page.locator('[data-mentor-action="result-review"]').click();
  await page.locator('[data-finished-review]').waitFor({timeout:15000});
  assert.equal(await page.locator('[data-finished-review] [data-review-square]').count(),64,
   'Mentor reuses the actual Arena/Tournament completed-game review overlay');
  assert.match((await page.locator('[data-finished-review] h2').first().textContent()),/Анализ партии/);
  await page.screenshot({path:path.join(output,'battle-mentor-finished-analysis.png'),animations:'disabled'});
  await page.locator('[data-finished-review] [data-review-action="close"]').click();
  assert.equal(await page.locator('[data-mentor-result]').count(),1,'closing review returns to the result');
  await page.setViewportSize({width:390,height:844});
  const resultBounds=await page.locator('.mentor-result-panel').boundingBox();
  assert(resultBounds&&resultBounds.width<=390&&resultBounds.x>=-2,
   'result panel fits portrait view without horizontal clipping');
  await page.screenshot({path:path.join(output,'battle-mentor-victory-portrait.png'),animations:'disabled'});
  await page.locator('.mentor-result-actions [data-mentor-action="catalog"]').click();
  assert.equal(await page.locator('[data-mentor-id]').count(),12,'Mentors button returns to preparation screen');
  // Computer checkmate / defeat uses the same result UI and shows the check aura.
  await saveMentorPosition(['f2f3','e7e5','g2g4','d8h4']);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-mentor-open]').click();
  assert.equal((await page.locator('[data-mentor-result] h2').textContent()).trim(),'Поражение');
  assert.equal(await page.locator('[data-mentor-square="e1"].is-check').count(),1);
  await page.locator('.mentor-result-actions [data-mentor-action="leave"]').click();
  assert.equal(await page.locator('[data-mentor-screen]:not([hidden])').count(),0,
   'Main menu button leaves mentor training');
  assert.equal(errors.length,0,'browser errors: '+errors.join('\n'));
  console.log('Mentor training real Stockfish, history branch, 12 mentors and phone: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});