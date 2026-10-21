/* Real Chromium portrait capture of actual RPChess scenes, not generated images.
   Input and navigation use the same runtime and saved-run fixtures as existing QA. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {startNewRun}=require('./browser-test-helpers.cjs');
const url=process.env.RPCHESS_ACCEPTANCE_URL||'http://127.0.0.1:4173';
const dir=process.env.RPCHESS_PORTRAIT_SCREENSHOT_DIR||'test-results/portrait-ui';
const key='rpchess.reboot.v1.run';
const sizes=[[390,844],[768,1024]];
const eventRoute={id:'manual.portrait.event',step:1,type:'event',label:'СОБЫТИЕ',stars:12,threatLabel:'ЛЕГЕНДАРНАЯ',flavor:'Необычная встреча на дороге.',mechanicalHint:'',seed:'manual-event-seed',supplyCostAtSelection:1,supplyPaid:1};
const puzzleRoute={id:'manual.portrait.puzzle',step:1,type:'puzzle',label:'ЗАДАЧА',stars:1,threatLabel:'СЛОЖНОСТЬ ★1',flavor:'На дороге обнаружена позиция, требующая точного решения.',mechanicalHint:'Шахматная задача с конкретной целью.',seed:'manual-puzzle-mate1',supplyCostAtSelection:1,supplyPaid:1};
function battleRoute(i){return {id:'manual.portrait.battle.'+i,step:1,type:'battle',label:'БИТВА',stars:6,threatLabel:'ОПАСНАЯ',flavor:'Вражеская армия закрыла дорогу.',mechanicalHint:'Полная армия',seed:'portrait-battle-'+i,difficultyModel:'power-v1',playerColor:'w',enemyColor:'b',enemyRaceTag:'orcs',enemyRoleRaces:Object.fromEntries(['pawn','knight','bishop','rook','queen','king'].map(role=>[role,'orcs']))};}
async function ready(page){
  await page.locator('[data-game-loading]').waitFor({state:'hidden',timeout:28000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(180);
}
async function capture(page,name){
  await ready(page);
  const geometry=await page.evaluate(()=>{
    const width=document.documentElement.scrollWidth;
    const active=[...document.querySelectorAll('#app>main')].find(n=>!n.hidden);
    const logos=active?.classList.contains('reboot-menu-screen')?[]:[...(active?.querySelectorAll('[data-brand-logo]')||[])].filter(node=>getComputedStyle(node).display!=='none');
    return {width,viewport:innerWidth,active:active?.className,visibleLogos:logos.length,orientationLock:!!document.querySelector('[data-orientation-lock]')&&getComputedStyle(document.querySelector('[data-orientation-lock]')).display!=='none'};
  });
  assert(!geometry.orientationLock,'Portrait must not show rotate-device overlay');
  assert.equal(geometry.visibleLogos,0,`${name}: non-menu logo must be hidden`);
  assert(geometry.width<=geometry.viewport+3,`${name}: horizontal overflow ${JSON.stringify(geometry)}`);
  const size=page.viewportSize(),suffix=`${size.width}x${size.height}`;
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,`${suffix}-${name}.png`),fullPage:true,animations:'disabled',timeout:30000});
  console.log(`PORTRAIT SCREENSHOT ${suffix}-${name}: ${geometry.active}`);
}
async function menu(page){
  await page.goto(url,{waitUntil:'networkidle'});
  await ready(page);
  await page.evaluate(k=>localStorage.removeItem(k),key);
  await page.reload({waitUntil:'networkidle'});
  await ready(page);
}
async function run(page){
  await menu(page);
  await startNewRun(page,{playerName:'Portrait Tester'});
  await page.locator('[data-roster-screen]:not([hidden])').waitFor();
}
async function seeded(page,route,eventId=null){
  await run(page);
  await page.evaluate(({k,route,eventId})=>{
    const r=JSON.parse(localStorage.getItem(k));
    r.supplies=10;r.currentTravelChoices=null;r.activeTravelChoice=route;
    r.currentSettlement=null;r.currentPuzzle=null;
    r.currentEvent=eventId?{routeId:route.id,eventId,choiceId:null,roll:null,success:null,resolved:false,outcome:null,combat:null}:null;
    localStorage.setItem(k,JSON.stringify(r));
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
  },{k:key,route,eventId});
  await page.locator('[data-roster-travel]').click();
}
async function capturePhoneOrTablet(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:width<600});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await menu(page);
    await capture(page,'01-main-menu');
    const arenaProbe=await page.locator('[data-arena-open]').evaluate(node=>{
      const rect=node.getBoundingClientRect();
      return {hidden:node.hidden,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
        style:{display:getComputedStyle(node).display,visibility:getComputedStyle(node).visibility},
        menuHidden:node.closest('[data-reboot-foundation]')?.hidden,
        parentStyle:getComputedStyle(node.parentElement).display,
        appMain:[...document.querySelectorAll('#app>main')].filter(n=>!n.hidden).map(n=>n.className),
        ancestors:(()=>{const out=[];for(let p=node;p&&out.length<9;p=p.parentElement){const q=p.getBoundingClientRect(),c=getComputedStyle(p);
          out.push({tag:p.tagName,className:String(p.className).slice(0,90),hidden:p.hidden,display:c.display,visibility:c.visibility,opacity:c.opacity,rect:[q.x,q.y,q.width,q.height]});}
          return out;})(),
        portraitCss:!!document.querySelector('link[data-portrait-ui-css]'),
        portraitFileStatus:[...document.styleSheets].some(x=>String(x.href||'').includes('portrait-ui.css'))};
    });
    console.log('PORTRAIT ARENA MENU CLICK PROBE',JSON.stringify(arenaProbe));
    assert(!arenaProbe.menuHidden&&arenaProbe.rect.width>=120&&arenaProbe.rect.height>=44&&arenaProbe.style.display!=='none',
      'Arena menu control must be accessible in portrait '+JSON.stringify(arenaProbe));
    await page.locator('[data-arena-open]').click({timeout:10000});
    await page.locator('[data-arena-screen]:not([hidden])').waitFor();
    const arenaGrid=await page.locator('[data-arena-foes]').evaluate(root=>({columns:getComputedStyle(root).gridTemplateColumns.split(' ').filter(Boolean).length,flow:getComputedStyle(root).overflowY,scrollHeight:root.scrollHeight,clientHeight:root.clientHeight,items:root.children.length}));
    assert.equal(arenaGrid.columns,3,`Three Arena foes per row: ${JSON.stringify(arenaGrid)}`);
    assert(arenaGrid.items>=80&&arenaGrid.scrollHeight>arenaGrid.clientHeight&&arenaGrid.flow==='auto',`Arena must scroll downward through foes: ${JSON.stringify(arenaGrid)}`);
    await capture(page,'02-arena-rivals');
    await page.locator('[data-arena-foes] button:not([disabled])').first().click();
    await page.locator('[data-arena-dialog]:not([hidden])').waitFor();
    await capture(page,'03-arena-opponent');
    await run(page);
    await capture(page,'04-roster-formation');
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    const travel=await page.evaluate(async()=>{
      const card=document.querySelector('[data-travel-choice]'),icon=card.querySelector('.travel-choice-card__icon'),flavor=card.querySelector('.travel-choice-card__flavor');
      // A nonempty CSS url() is not enough: check that every route artwork loads.
      const backdropLoaded=await Promise.all([...document.querySelectorAll('[data-travel-choice]')].map(async choice=>{
        const style=getComputedStyle(choice.querySelector('.travel-choice-card__visual')).backgroundImage;
        const url=style.match(/url\\(["']?([^"')]+)["']?\\)/)?.[1];
        if(!url)return false;
        try{const image=new Image();image.src=url;await image.decode();return image.naturalWidth>0;}
        catch{return false;}
      }));
      const backdrop=card.querySelector('.travel-choice-card__visual');
      const command=document.querySelector('[data-travel-commandbar]'),portrait=document.querySelector('[data-travel-run-portrait]');
      const controls=['[data-travel-roster]','[data-travel-settings]','[data-travel-menu]'].map(s=>document.querySelector(s).getBoundingClientRect());
      const resources=document.querySelector('[data-travel-inline-resources]');
      const resourceIcon=document.querySelector('.travel-choice-inline-resource__icon');
      const resourceValue=document.querySelector('.travel-choice-inline-resource strong');
      const starCard=[...document.querySelectorAll('[data-travel-choice]')].find(c=>c.querySelector('.travel-choice-card__threat>strong'));
      const title=starCard?.querySelector('.travel-choice-card__type')?.getBoundingClientRect();
      const stars=starCard?.querySelector('.travel-choice-card__threat>strong')?.getBoundingClientRect();
      const c=card.getBoundingClientRect(),i=icon.getBoundingClientRect();
      const cmd=command.getBoundingClientRect(),p=portrait.getBoundingClientRect(),res=resources.getBoundingClientRect();
      return {
        noFlavor:getComputedStyle(flavor).display==='none',
        iconTop:i.top-c.top,iconRight:c.right-i.right,
        artBackdrop:backdropLoaded.length>0&&backdropLoaded.every(Boolean),
        noDifficultyLabel:![...document.querySelectorAll('.travel-choice-card__difficulty small')].some(n=>n.textContent.trim()),
        starsBesideTitle:!stars||(stars.left>=title.right-5&&Math.abs(stars.top-title.top)<26),
        buttonsStacked:controls.every((r,j)=>j===0||(r.top>=controls[j-1].bottom-2&&Math.abs(r.left-controls[0].left)<3)),
        portraitDoubled:p.width>=103&&p.height>=103,
        portraitCentered:Math.abs((p.top+p.bottom-cmd.top-cmd.bottom)/2)<8,
        resourcesCentered:Math.abs((res.top+res.bottom-cmd.top-cmd.bottom)/2)<30,
        resourceDoubled:resourceIcon.getBoundingClientRect().width>=59&&parseFloat(getComputedStyle(resourceValue).fontSize)>=35
      };
    });
    assert(Object.values(travel).every(Boolean),`Travel portrait refinements: ${JSON.stringify(travel)}`);
    await capture(page,'05-journey-routes');

    await seeded(page,eventRoute,'E001');
    await page.locator('[data-events-screen]:not([hidden])').waitFor();
    await capture(page,'06-event-choice');
    await page.locator('[data-event-choice]:not([disabled])').first().click();
    await page.locator('[data-events-outcome]:not([hidden])').waitFor();
    await capture(page,'07-event-outcome');

    await seeded(page,puzzleRoute);
    await page.locator('[data-puzzle-screen]:not([hidden])').waitFor();
    const puzzle=page.locator('[data-puzzle-board]');
    await puzzle.waitFor();
    const board=await puzzle.boundingBox();
    assert(board&&Math.abs(board.width-board.height)<=3,`Training chess board square: ${JSON.stringify(board)}`);
    const taskPanel=await page.locator('[data-puzzle-screen] .puzzle-layout>.puzzle-panel').first().boundingBox();
    assert(board.y+board.height<=taskPanel.y+10,`Training board must precede task/reward: board=${JSON.stringify(board)} task=${JSON.stringify(taskPanel)}`);
    await capture(page,'08-training-board');

    // Deterministic settlement route: the random travel generator is allowed
    // to offer 0 settlements and must not silently omit a key UX screenshot.
    await run(page);
    await page.evaluate(({k,routes})=>{
      const r=JSON.parse(localStorage.getItem(k));
      r.currentTravelChoices=routes;r.activeTravelChoice=null;r.currentSettlement=null;
      localStorage.setItem(k,JSON.stringify(r));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    },{k:key,routes:[
      {id:'manual.portrait.settlement',step:1,type:'settlement',label:'ПОСЕЛЕНИЕ',
        stars:1,threatLabel:'БЕЗОПАСНО',flavor:'Дорога ведёт к месту, где путники могут найти передышку.',
        mechanicalHint:'Место для передышки и подготовки.',seed:'portrait-settlement-2026',difficultyModel:'power-v1'},
      battleRoute(7),battleRoute(8)
    ]});
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await page.locator('[data-travel-type="settlement"]').click();
    await page.locator('[data-settlement-screen]:not([hidden])').waitFor();
    const nav=page.locator('[data-settlement-tabs]');
    assert.equal(await nav.locator('button').count(),3,'Settlement must have three icon tabs');
    const continueButton=await page.locator('[data-settlement-continue]').boundingBox();
    const navBox=await nav.boundingBox();
    assert(continueButton.y+continueButton.height<=navBox.y+5,'Continue must be above Settlement tabs');
    const visiblePanel=async name=>page.locator(`[data-settlement-screen] .settlement-service--${name}`).evaluate(node=>getComputedStyle(node).display!=='none');
    assert(await visiblePanel('tavern')&&!await visiblePanel('healer')&&!await visiblePanel('market'),'Tavern selected by default');
    await capture(page,'09-settlement-tavern');
    await page.locator('[data-settlement-tab="healer"]').click();
    assert(await visiblePanel('healer')&&!await visiblePanel('tavern'),'Healer selected');
    await capture(page,'09-settlement-healer');
    await page.locator('[data-settlement-tab="market"]').click();
    assert(await visiblePanel('market')&&!await visiblePanel('healer'),'Market selected');
    await capture(page,'09-settlement-market');

    await run(page);
    await page.evaluate(({k,routes})=>{
      const r=JSON.parse(localStorage.getItem(k));
      r.currentTravelChoices=routes;r.activeTravelChoice=null;
      localStorage.setItem(k,JSON.stringify(r));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    },{k:key,routes:[battleRoute(1),battleRoute(2),battleRoute(3)]});
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await page.locator('[data-travel-type="battle"]').first().click();
    await page.locator('[data-artifact-choice-modal]:not([hidden])').waitFor();
    await page.locator('[data-artifact-choice="none"]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    await capture(page,'10-battle-chess');
    const combatBoard=await page.locator('[data-chess-board]').boundingBox();
    assert(combatBoard&&Math.abs(combatBoard.width-combatBoard.height)<=3,`Chess board must be square: ${JSON.stringify(combatBoard)}`);
    await page.evaluate(()=>globalThis.RPChessBattle.finishBattle({over:true,type:'stalemate',winner:null}));
    await page.locator('[data-battle-aftermath]:not([hidden])').waitFor();
    await capture(page,'11-battle-result');
    await page.evaluate(k=>{
      const r=JSON.parse(localStorage.getItem(k));
      r.ended=true;r.endReason='starvation_king';r.journeyStep=18;
      r.runStats={goldEarned:188,skirmishWins:2,battleWins:1,caravansDefended:1,puzzlesSolved:4,eventsResolved:5};
      globalThis.RPChessEndlessRun.open(r);
    },key);
    await page.locator('[data-endless-run-screen]:not([hidden])').waitFor();
    await capture(page,'12-journey-summary');
    assert.deepEqual(errors,[],`Portrait browser JS errors at ${width}x${height}: ${errors.join('; ')}`);
  }finally{await page.close();}
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    for(const [width,height] of sizes)await capturePhoneOrTablet(browser,width,height);
    console.log('Portrait mobile/tablet: key scenes and square boards PASS');
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
