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
  // Stub only browser TTS: tests need neither a speaker nor external audio calls.
  await page.addInitScript(()=>{
   window.__mentorSpeechEvents=[];window.__mentorSpeechLast=null;
   const synth={
    getVoices:()=>[
     {name:'Russian female',lang:'ru-RU',localService:true},
     {name:'Microsoft Pavel',lang:'ru-RU',localService:false},
     {name:'US English female',lang:'en-US',localService:true},
     {name:'Google UK English Male',lang:'en-GB',localService:false}
    ],
    cancel:()=>window.__mentorSpeechEvents.push({type:'cancel'}),
    speak:utterance=>{
     window.__mentorSpeechLast=utterance;
     window.__mentorSpeechEvents.push({type:'speak',text:utterance.text,
      language:utterance.lang,rate:utterance.rate,voice:utterance.voice?.lang,voiceName:utterance.voice?.name});
    }
   };
   Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});
   Object.defineProperty(window,'SpeechSynthesisUtterance',{
    value:class SpeechSynthesisUtteranceStub{constructor(text){this.text=text;}},
    configurable:true
   });
  });
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:30000});
  await page.locator('[data-mentor-open]').click();
  await page.locator('[data-mentor-screen]:not([hidden])').waitFor();
  assert.equal(await page.locator('[data-mentor-id]').count(),12);
  assert.equal(await page.locator('.mentor-pair').count(),6);

  async function verifySquareMentorCards(columns){
   // Catalog DOM is rebuilt on every view switch; icons decode asynchronously.
   await page.waitForFunction(()=>{
    const icons=[...document.querySelectorAll('.mentor-choice .mentor-power-icon'),
     ...document.querySelectorAll('.mentor-selected .mentor-power-icon')];
    return icons.length===13&&icons.every(img=>img.complete&&img.naturalWidth>0);
   },null,{timeout:10000});
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
  const speak=page.locator('[data-mentor-action="speech"]');
  assert.equal(await speak.count(),1,'speaker appears beside the mentor title');
  assert.equal(await speak.isDisabled(),false,'speaker is available with visible mentor text');
  assert.equal(await speak.getAttribute('aria-label'),'Озвучить текст наставника');
  await speak.click();
  assert.equal(await speak.getAttribute('aria-pressed'),'true');
  const spoken=await page.evaluate(()=>window.__mentorSpeechEvents.find(e=>e.type==='speak'));
  assert(spoken.text.includes('Продолжайте партию'),'only displayed mentor text is spoken');
  assert.equal(spoken.language,'ru-RU');
  assert.equal(spoken.voice,'ru-RU');
  assert.equal(spoken.rate,1.5,'speech runs at 150% normal speed');
   assert.equal(spoken.voiceName,'Microsoft Pavel',
   'Pavel wins over the default local Russian female voice');
  // The shared speech controller must prefer the requested UK male voice
  // over default en-US voices without another backend or LLM request.
  const englishVoice=await page.evaluate(async()=>{
   const {createMentorSpeech}=await import('./js/mentor-training-speech.mjs');
   const panel=document.createElement('section');
   panel.innerHTML='<p class="mentor-feedback-text">Check the next move.</p>';
   const narration=createMentorSpeech({
    getRoot:()=>panel,getLanguage:()=> 'en',translate:key=>key
   });
   panel.insertAdjacentHTML('beforeend',narration.buttonMarkup());
   narration.toggle();
   const selection={name:window.__mentorSpeechLast.voice?.name,
    lang:window.__mentorSpeechLast.lang,rate:window.__mentorSpeechLast.rate};
   narration.stop();
   return selection;
  });
  assert.deepEqual(englishVoice,{name:'Google UK English Male',lang:'en-GB',rate:1.5},
   'Google UK English Male is preferred and utterance uses its actual locale');
  await speak.click();
  assert.equal(await speak.getAttribute('aria-pressed'),'false');
  assert((await page.evaluate(()=>window.__mentorSpeechEvents)).some(e=>e.type==='cancel'));
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
  await page.route('https://rpchess-mentor-api-v2-preview.mobigametim.workers.dev/v2/explain',async route=>{
   const headers={'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type, X-Mentor-Session',
    'Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(route.request().method()==='OPTIONS')
    return route.fulfill({status:204,headers});
   mockedMentorCalls++;
   await new Promise(resolve=>setTimeout(resolve,750));
   if(mockedMentorCalls===1)
    return route.fulfill({status:503,contentType:'application/json',headers,
     body:JSON.stringify({error:'model_chain_failed',reason:'broker_timeout',
      attempts:[{model:'deepseek-ai/DeepSeek-V4-Flash-0731',reason:'broker_timeout'}]})});
   const fact='Соперник может поставить мат следующим ходом.';
   const advice='Перед ходом проверяй самый сильный ответ соперника. Что ещё ты мог упустить?';
   return route.fulfill({status:200,contentType:'application/json',headers,
    body:JSON.stringify({contractVersion:2,grade:'blunder',source:'minimax',
     model:'MiniMaxAI/MiniMax-M2.7',attempts:2,factId:'mate_sequence:d8h4',
     verifiedFact:fact,advice,explanation:fact+' '+advice})});
  });
  await page.locator('[data-mentor-open]').click();
  const mentorRequest=page.waitForRequest(req=>req.url().endsWith('/v2/explain')&&req.method()==='POST',{timeout:60000});
  await page.locator('[data-mentor-square="g2"]').click();
  await page.locator('[data-mentor-square="g4"]').click();
  await page.waitForFunction(()=>window.__mentorDepthSearch.includes('go movetime 1700'),null,{timeout:30000});
  await page.waitForFunction(()=>window.RPChessMentorTraining.state.lesson==='mate_sequence',null,{timeout:30000});
  const observed=await mentorRequest;
  const detail=observed.postDataJSON();
  assert.equal(detail.version,2);
  assert.equal(detail.grade,'blunder','winning-chance grade is shared with API');
  assert(detail.continuation?.depth>=7,'only deep verified tactics reach paid mentor');
  assert.equal(detail.continuation.pv[0],'d8h4');
  assert.equal(detail.verifiedThreat.kind,'mate_sequence');
  await page.waitForFunction(()=>document.querySelector('[data-mentor-action="retry-explanation"]')&&
   window.RPChessMentorTraining.state.moves[2]?.mentorSource==='fallback',null,{timeout:15000});
  assert.equal(mockedMentorCalls,1,'first request arrives before the learner has answered');
  const afterFailure=await page.evaluate(()=>window.RPChessMentorTraining.state.moves[2]);
  assert.equal(afterFailure.mentorReason,'broker_timeout');
  await page.locator('[data-mentor-action="retry-explanation"]').click();
  await page.waitForFunction(()=>window.RPChessMentorTraining.state.moves[2]?.mentorSource==='minimax',null,{timeout:15000});
  const afterSuccess=await page.evaluate(()=>window.RPChessMentorTraining.state.moves[2]);
  assert.equal(afterSuccess.mentorModel,'MiniMaxAI/MiniMax-M2.7');
  assert.equal(mockedMentorCalls,2,'manual retry uses the stored verified v2 fact');
  assert.equal(await page.locator('.mentor-ai-label').textContent(),'Объяснение ИИ');
  assert((await page.locator('.mentor-ai-explanation').textContent()).includes('Перед ходом проверяй'),
   'AI text is visible while the tactical question is still unanswered');
  assert.equal(await page.locator('.mentor-learning-question').count(),1,
   'the verified question remains interactive beneath the AI text');
  assert.equal(await page.locator('[data-mentor-action="correction-start"]').count(),0,
   'improvement exercise is not visible before the learner solves the threat');
  // An inaccurate move keeps the rival on move without letting it reply.
  await page.waitForFunction(()=>window.RPChessMentorTraining.state.lesson==='mate_sequence',null,{timeout:15000});
  let paused=await page.evaluate(()=>window.RPChessMentorTraining.state);
  assert(paused.paused,'the rival turn is paused on a classified error');
  assert.equal(paused.moves.length,3,'the rival must NOT answer before the learner resolves the lesson');
  assert.equal(await page.locator('[data-mentor-action="lesson-start"]').count(),0,
   'the question opens automatically without an extra button');
  assert(await page.locator('.mentor-learning-question').count(),'question displayed immediately');
  assert.equal(await page.locator('[data-mentor-square="d8"] .mentor-piece').count(),1,
   'the real board after the player move still shows black queen on d8');
  await page.setViewportSize({width:390,height:844});
  assert((await page.locator('.mentor-learning-question').isVisible()),
   'the automatic question must be visible on phones');
  const lessonBoardBounds=await page.locator('.mentor-board').boundingBox();
  assert(lessonBoardBounds?.width<=390,'paused lesson board fits a portrait phone');
  await page.screenshot({path:path.join(output,'battle-automatic-lesson-portrait.png'),animations:'disabled'});
  await page.locator('[data-mentor-square="e8"]').click();
  assert.equal(mockedMentorCalls,2,'incorrect guess does not issue additional LLM requests');
  assert(await page.locator('[data-mentor-square="e8"] .mentor-lesson-aura--wrong').count(),
   'wrong rival piece flashes with red aura');
  assert((await page.locator('[data-mentor-board-burst="e8"].mentor-lesson-burst--wrong').textContent())
   .includes('Это другая фигура.'),'large red text emerges from the incorrect piece');
  assert.equal(await page.locator('.mentor-learning-response').count(),0,
   'click feedback never duplicates in the mentor panel');
  assert.equal(await page.locator('[data-mentor-board-burst="e8"]').count(),1,
   'top-rank wrong answer must fly to board center');
  const pathToCenter=await page.locator('[data-mentor-board-burst="e8"]').evaluate(node=>({
   animation:getComputedStyle(node).animationName,
   final:node.getAnimations()[0]?.effect?.getKeyframes()?.at(-1)
  }));
  assert.equal(pathToCenter.animation,'mentor-feedback-to-center');
  assert.equal(pathToCenter.final.left,'50%');
  assert.equal(pathToCenter.final.top,'50%');
  await page.screenshot({path:path.join(output,'battle-wrong-red-aura-portrait.png'),animations:'disabled'});
  await page.setViewportSize({width:1280,height:800});
  await page.locator('[data-mentor-action="lesson-hint"]').click();
  assert(await page.locator('.mentor-learning-hint').count(),'graded hint appears on demand');
  await page.locator('[data-mentor-square="d8"]').click();
  assert(await page.locator('[data-mentor-square="d8"] .mentor-lesson-aura--correct').count(),
   'correct rival piece flashes with green aura');
  assert((await page.locator('[data-mentor-board-burst="d8"].mentor-lesson-burst--correct').textContent())
   .includes('Верно, ты нашёл нужную фигуру!'),'green confirmation emerges from the chosen queen');
  assert.equal(await page.locator('[data-mentor-board-burst="d8"]').count(),1,
   'top-rank right answer must fly to board center');

  assert((await page.locator('.mentor-learning-mentor-note').textContent()).includes('Перед ходом проверяй'));
  const displayedNarration=(await page.locator('[data-mentor-ai-explanation]').textContent()).trim();
  const callsBeforeNarration=mockedMentorCalls;
  await page.locator('[data-mentor-action="speech"]').click();
  const narration=await page.evaluate(()=>window.__mentorSpeechLast.text);
  assert.equal(narration,displayedNarration,'TTS reads the displayed AI explanation verbatim');
  assert.equal(mockedMentorCalls,callsBeforeNarration,'speech must not make another Gonka request');
  assert.equal(await page.locator('[data-mentor-action="speech"]').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>window.__mentorSpeechLast.onend());
  assert.equal(await page.locator('[data-mentor-action="speech"]').getAttribute('aria-pressed'),'false',
   'completed speech resets the toggle');
  assert.equal(await page.locator('.mentor-feedback-grade + .mentor-ai-block .mentor-ai-explanation').count(),1,
   'independent AI explanation must follow error grade');
  assert.equal(await page.locator('.mentor-learning .mentor-learning-mentor-note').count(),0);
  const mentorNoteMetrics=await page.locator('.mentor-ai-explanation').evaluate(el=>({
   size:parseFloat(getComputedStyle(el).fontSize),
   tracking:parseFloat(getComputedStyle(el).letterSpacing)
  }));
  assert(mentorNoteMetrics.size>=18&&mentorNoteMetrics.tracking>0,'AI text font/tracking increased');
  assert(await page.locator('[data-mentor-square="d8"] .mentor-lesson-aura--correct').count()||afterSuccess,
   'correct rival piece is verified and the early AI advice remains visible');

  await page.waitForFunction(()=>document.querySelector('.mentor-learning-answer')?.textContent?.includes('d8–h4')
   &&document.querySelector('[data-mentor-square="h4"].mentor-lesson-target'),null,{timeout:4000});
  assert.equal(await page.locator('.mentor-learning-hint').count(),0,
   'hints disappear from the final mentor explanation');
  assert.equal(await page.locator('.mentor-learning-instruction').count(),0);
  assert.equal(await page.locator('.mentor-learning-response').count(),0);
  assert.equal(await page.locator('.mentor-learning-question').count(),0,
   'the final explanation contains no redundant question or repeated success label');
  assert.equal(await page.locator('[data-mentor-square="e1"].mentor-lesson-threat').count(),1,
   'revealed mate shows the actual threatened king');
  assert.equal((await page.evaluate(()=>window.RPChessMentorTraining.state)).moves.length,3,
   'rival is still paused while the learner reads the explanation');
  await page.screenshot({path:path.join(output,'battle-interactive-mate-lesson.png'),animations:'disabled'});
  // After spotting the verified danger the learner may voluntarily repair
  // the move from an isolated pre-blunder FEN, never overwriting the game.
  const originalGame=await page.evaluate(()=>window.RPChessMentorTraining.state);
  const bestCorrection=originalGame.moves[2].mentorPayload.before.bestMove;
  assert.match(bestCorrection,/^[a-h][1-8][a-h][1-8][qrbn]?$/);
  await page.locator('[data-mentor-action="correction-start"]').click();
  assert.equal(await page.locator('.mentor-correction').count(),1,'repair exercise opens only after answer');
  const strongButton=page.locator('[data-mentor-action="correction-strong"]');
  assert.equal(await strongButton.isDisabled(),true,'strong move is initially gated for 10 seconds');
  assert.match((await strongButton.textContent()).trim(),/Сильный ход \(10\)/,'countdown starts at ten');
  assert(await page.locator('.mentor-correction .mentor-learning-instruction').textContent()
   .then(text=>text.includes('сыгранная партия останется неизменной')));
  assert.equal(await page.locator('[data-mentor-square="g2"] .mentor-piece').count(),1,
   'pre-error board restores pawn on g2 instead of g4');
  assert.equal((await page.evaluate(()=>window.RPChessMentorTraining.state)).fen,originalGame.fen,
   'correction board never writes into the original game state');
  await page.locator('[data-mentor-square="'+bestCorrection.slice(0,2)+'"]').click();
  await page.locator('[data-mentor-square="'+bestCorrection.slice(2,4)+'"]').click();
  await page.waitForFunction(()=>window.RPChessMentorTraining.state.correction?.accepted,null,{timeout:12000});
  const correctionSquare=bestCorrection.slice(2,4);
  assert.equal(await page.locator('.mentor-correction-result.is-correct').count(),0,
   'successful move message must emerge from the figure, not duplicate in mentor panel');
  assert.equal((await page.locator('[data-mentor-board-burst="'+correctionSquare+'"].mentor-lesson-burst--correct').textContent()).trim(),
   'Хорошее решение!','corrected figure emits short green praise');
  assert.equal(await page.locator('[data-mentor-board-burst="'+correctionSquare+'"]').count(),
   1,'correction burst heads to center at any rank');
  assert.deepEqual(await page.evaluate(()=>window.RPChessMentorTraining.state.moves.map(m=>m.uci)),
   originalGame.moves.map(m=>m.uci),'successful practice must not replace the real game');
  await page.screenshot({path:path.join(output,'battle-correction-success.png'),animations:'disabled'});
  await page.locator('[data-mentor-action="correction-back"]').click();
  assert.equal(await page.locator('.mentor-learning-answer').count(),1,'can return to verified explanation');
  // Reload during a solved lesson/correction must not silently execute the
  // rival reply or force the player to repeat the already-solved threat quiz.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-mentor-open]').click();
  await page.locator('.mentor-learning-answer').waitFor({timeout:12000});
  const restored=await page.evaluate(()=>window.RPChessMentorTraining.state);
  assert.equal(restored.moves.length,3);
  assert(restored.paused,'reload preserves the active pause');
  assert.equal(await page.locator('[data-mentor-action="correction-start"]').count(),1,
   'reload preserves the completed lesson and optional correction');
  await page.locator('[data-mentor-action="correction-start"]').click();
  // Replaying the original blunder is legal but NOT an acceptable repair.
  await page.locator('[data-mentor-square="g2"]').click();
  await page.locator('[data-mentor-square="g4"]').click();
  await page.waitForFunction(()=>window.RPChessMentorTraining.state.correction?.outcome==='wrong',null,{timeout:12000});
  assert.equal(await page.locator('.mentor-correction-result.is-wrong').count(),0,
   'rejected correction must not be repeated in the mentor panel');
  assert((await page.locator('[data-mentor-board-burst="g2"].mentor-lesson-burst--wrong').textContent())
   .includes('недостаточно улучшает позицию'),
   'red rejected-move feedback emerges from the original piece');
  assert.equal(await page.locator('[data-mentor-board-burst="g2"]').count(),1,
   'feedback on the second rank flies to board center');
  assert.equal((await page.evaluate(()=>window.RPChessMentorTraining.state)).moves.length,3);
  const hintButton=page.locator('[data-mentor-action="correction-strong"]');
  assert.equal(await hintButton.isDisabled(),true,'new correction has its own 10-second delay');
  await page.waitForFunction(()=>{
   const hint=document.querySelector('[data-mentor-action="correction-strong"]');
   return hint&&!hint.disabled&&hint.textContent.trim()==='Сильный ход';
  },null,{timeout:13000});
  await hintButton.click();
  assert((await page.locator('.mentor-correction-best').textContent()).includes(
   bestCorrection.slice(0,2)+'–'+bestCorrection.slice(2)),
   'Stockfish best move is revealed in the pre-error practice position');
  assert.equal(await page.locator('[data-mentor-square="'+bestCorrection.slice(2,4)+'"] .mentor-piece').count(),1,
   'Stockfish best-move figure appears at the correct destination');
  assert.equal(await page.locator('[data-mentor-square="'+bestCorrection.slice(0,2)+'"].is-last').count(),1);
  assert.equal(await page.locator('[data-mentor-square="'+bestCorrection.slice(2,4)+'"].is-last').count(),1);
  assert.deepEqual(await page.evaluate(()=>window.RPChessMentorTraining.state.moves.map(m=>m.uci)),
   originalGame.moves.map(m=>m.uci),'best-move reveal does not alter real game history');
  await page.screenshot({path:path.join(output,'battle-correction-strong-move.png'),animations:'disabled'});
  await page.locator('[data-mentor-action="correction-again"]').click();
  assert.equal(await page.locator('.mentor-correction-best').count(),0,
   'other variant restores the original practice position');
  assert.equal(await page.locator('[data-mentor-square="g2"] .mentor-piece').count(),1);
  await page.locator('[data-mentor-action="correction-close"]').click();
  await page.waitForFunction(()=>window.RPChessMentorTraining.state.moves.length>3,null,{timeout:25000});
  const afterResume=await page.evaluate(()=>window.RPChessMentorTraining.state);
  assert(!afterResume.paused,'explicit continue releases the rival turn');
  assert.equal(afterResume.moves[3].color,'b','rival responds only AFTER the learner continues');
  await page.evaluate(()=>window.RPChessMentorTraining.back());
  assert.equal((await page.evaluate(()=>window.RPChessMentorTraining.state)).cursor,3,
   'history review is still available after the paused turn is released');
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
  // Scholar's mate: the move is final immediately, but the result dialog
  // waits for the two royal auras and the defeated king's fall (3 seconds).
  const mateSetup=['e2e4','e7e5','d1h5','b8c6','f1c4','g8f6'];
  await saveMentorPosition(mateSetup);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-mentor-open]').click();
  await page.locator('[data-mentor-square="h5"]').click();
  const mateClickAt=Date.now();
  await page.locator('[data-mentor-square="f7"]').click();
  assert.equal(await page.locator('[data-mentor-result]').count(),0,
   'the result window must not appear immediately after the final move');
  const loser=page.locator('[data-mentor-square="e8"].mentor-king-defeated');
  const victor=page.locator('[data-mentor-square="e1"].mentor-king-victorious');
  assert.equal(await loser.count(),1,'losing king marked defeated');
  assert.equal(await victor.count(),1,'winning king marked victorious');
  const kings=await page.evaluate(()=>{
   const losing=document.querySelector('.mentor-king-defeated');
   const winning=document.querySelector('.mentor-king-victorious');
   return {fall:getComputedStyle(losing.querySelector('.mentor-piece')).animationName,
    red:getComputedStyle(losing,'::before').backgroundImage,
    green:getComputedStyle(winning,'::before').backgroundImage};
  });
  assert.equal(kings.fall,'mentor-mate-king-fall');
  assert(kings.red.includes('radial-gradient'),'red aura glows behind defeated king');
  assert(kings.green.includes('radial-gradient'),'green aura glows behind victorious king');
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('[data-mentor-result]').count(),0,
   'royal animations remain visible before the result dialog');
  const matrix=await loser.locator('.mentor-piece').evaluate(node=>getComputedStyle(node).transform);
  const angle=matrix.startsWith('matrix(')&&matrix.endsWith(')')
   ?matrix.slice(7,-1).split(',').map(Number):null;
  assert(angle&&Math.abs(angle[0])<.03&&Math.abs(angle[1]-1)<.03&&
   Math.abs(angle[2]+1)<.03&&Math.abs(angle[3])<.03,
   'defeated king must lie at 90 degrees: '+matrix);
  await page.locator('[data-mentor-result] h2').waitFor({timeout:15000});
  assert(Date.now()-mateClickAt>=2700,'the result must wait approximately three seconds');
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
  assert.equal(await page.locator('[data-mentor-square="e1"].is-check.mentor-king-defeated').count(),1);
  assert.equal(await page.locator('[data-mentor-square="e8"].mentor-king-victorious').count(),1);
  await page.locator('.mentor-result-actions [data-mentor-action="leave"]').click();
  assert.equal(await page.locator('[data-mentor-screen]:not([hidden])').count(),0,
   'Main menu button leaves mentor training');
  // Stage 4: an actual browser session with a synthetic positional error.
  // Mock ONLY the review worker's quick scores; the rival's ChessAIAdapter
  // remains a real Stockfish worker. No paid LLM request is allowed.
  const positionalPage=await browser.newPage({viewport:{width:1280,height:800}});
  const positionalErrors=[];positionalPage.on('pageerror',e=>positionalErrors.push(e.message));
  await positionalPage.addInitScript(()=>{
   const send=Worker.prototype.postMessage;
   window.__mentorPositionalDeepCalls=0;
   Worker.prototype.postMessage=function(message,...args){
    if(message==='setoption name MultiPV value 2')this.__mentorIsReview=true;
    if(this.__mentorIsReview&&typeof message==='string'&&message.startsWith('position fen '))
     this.__mentorPosition=message.slice('position fen '.length);
    if(this.__mentorIsReview&&message==='go movetime 1700')
     window.__mentorPositionalDeepCalls++;
    if(this.__mentorIsReview&&message==='go movetime 260'){
     const opponentToMove=this.__mentorPosition?.split(' ')[1]==='b';
     const best=opponentToMove?'e7e5':'d2d4';
     const cp=opponentToMove?400:0;
     queueMicrotask(()=>{
      this.onmessage?.({data:'info depth 12 multipv 1 score cp '+cp+' pv '+best});
      this.onmessage?.({data:'bestmove '+best});
     });
     return;
    }
    return send.call(this,message,...args);
   };
  });
  let positionalCalls=0;
  await positionalPage.route('https://rpchess-mentor-api-v2-preview.mobigametim.workers.dev/v2/explain',
   async route=>{positionalCalls++;await route.abort();});
  await positionalPage.goto(url,{waitUntil:'domcontentloaded'});
  await positionalPage.locator('[data-game-loading]').waitFor({state:'hidden',timeout:30000});
  await positionalPage.evaluate(()=>localStorage.removeItem('rpchess.mentor-training.v1'));
  await positionalPage.locator('[data-mentor-open]').click();
  await positionalPage.locator('[data-mentor-action="start"]').click();
  await positionalPage.locator('[data-mentor-square="e2"]').click();
  await positionalPage.locator('[data-mentor-square="e4"]').click();
  await positionalPage.waitForFunction(()=>{
   const state=window.RPChessMentorTraining.state;
   return state.moves.length>=2&&state.moves[0].grade==='blunder';
  },null,{timeout:30000});
  const positionalState=await positionalPage.evaluate(()=>window.RPChessMentorTraining.state);
  assert.equal(positionalState.moves[0].threatStatus,'unverified_or_positional');
  assert.equal(positionalState.paused,false,'a grading error with quiet reply must never stop the rival');
  assert.equal(positionalState.moves[1].color,'b','real rival worker responds after positional error');
  assert.equal(await positionalPage.locator('.mentor-learning-question').count(),0,
   'no synthetic tactical quiz after an ordinary positional error');
  assert.equal(await positionalPage.evaluate(()=>window.__mentorPositionalDeepCalls),0,
   'no extra 1700ms search on an obvious non-tactical error');
  assert.equal(positionalCalls,0,'positional comments must not invoke paid LLM broker');
  assert.equal(await positionalPage.locator('[data-mentor-action="before-error"]').count(),0,
   'positional response is a short comment, not a tactical rewind exercise');
  assert((await positionalPage.locator('.mentor-feedback-text').textContent()).includes('непосредственная тактическая угроза не подтверждена'),
   'short local explanation is shown');
  assert.equal(positionalErrors.length,0,'positional browser errors '+positionalErrors.join('\n'));
  await positionalPage.screenshot({path:path.join(output,'battle-positional-error-continues.png'),animations:'disabled'});
  await positionalPage.close();
  assert.equal(errors.length,0,'browser errors: '+errors.join('\n'));
  console.log('Mentor training real Stockfish, history branch, 12 mentors and phone: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});