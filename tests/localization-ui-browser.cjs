const assert = require('assert');
require('./onboarding-disabled-preload.cjs');
const { chromium } = require('playwright');
const url = process.env.RPCHESS_ACCEPTANCE_URL || 'http://127.0.0.1:4173';
const cyrillic = /[А-Яа-яЁё]/u;

async function language(page, code) {
  // Switching language is a user action; the new asset mask must finish before
  // interacting with the incoming scene's controls and accessibility labels.
  await page.locator('[data-game-loading]').waitFor({ state:'hidden', timeout:25000 });
  try {
    await page.evaluate(async code => (await import('./js/i18n.mjs')).setLanguage(code), code);
  } catch (error) {
    console.error(`[localization] language switch ${code} failed (current URL: ${page.url()})`);
    throw error;
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function english(page, label) {
  const leaks = await page.evaluate(() => {
    const visible = node => node && !node.closest('[hidden],script,style,[data-language-option="ru"]') && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
    const values = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) if (visible(node.parentElement)) values.push(node.textContent);
    for (const node of document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) if (visible(node)) {
      for (const attr of ['aria-label','title','alt','placeholder']) values.push(node.getAttribute(attr) || '');
    }
    return [...new Set(values.map(value => value.replaceAll('Тимур','').trim()).filter(value => /[А-Яа-яЁё]|\[missing:/u.test(value)))];
  });
  assert.deepStrictEqual(leaks, [], `${label}: English text and accessibility labels`);
}
async function roundtrip(page, label) {
  console.log(`[localization] ${label}`);
  await language(page, 'ru');
  await language(page, 'en');
  await english(page, label);
  await language(page, 'ru');
  await language(page, 'en');
  await english(page, `${label} after repeated switch`);
}
async function seed(page, type, index = 0, eventId = null) {
  await page.evaluate(async ({type,index,eventId}) => {
    await globalThis.RPChessRouteReady;
    const {createRun,writeRun} = await import('./js/run-persistence.mjs');
    const {createTravelChoices} = await import('./js/travel-choice-core.mjs');
    let run = createRun({id:`localization:${type}:${index}`,playerName:'Тимур'});
    run.gold = 900; run.supplies = 9;
    if (type) {
      run.activeTravelChoice = {...createTravelChoices({runId:run.id,types:[type]})[0],supplyCostAtSelection:1,supplyPaid:1};
      run.journeyStep = 1;
    }
    if (type === 'settlement') {
      const {createSettlementState,RECRUIT_LIBRARY} = await import('./js/settlement-core.mjs');
      run.currentSettlement = {...createSettlementState(run,run.activeTravelChoice),offers:RECRUIT_LIBRARY.slice(index,index+3).map(hero=>hero.id)};
      run.roster = run.roster.map(hero=>({...hero,status:hero.isRunKing?'healthy':'wounded'}));
    }
    if (type === 'event') run.currentEvent = {routeId:run.activeTravelChoice.id,eventId,choiceId:null,roll:null,success:null,resolved:false,outcome:null,combat:null};
    writeRun(run);
    dispatchEvent(new CustomEvent('rpchess:run-updated'));
    if (['skirmish','battle'].includes(type)) globalThis.RPChessTravelEncounterOverride = run.activeTravelChoice;
    if (type) dispatchEvent(new CustomEvent(`rpchess:${type==='event'?'event':type}-open`,{detail:{choice:run.activeTravelChoice}}));
  }, {type,index,eventId});
}
(async () => {
  const browser = await chromium.launch({headless:true});
  const errors = [];
  async function fresh() {
    const page = await browser.newPage({viewport:{width:1653,height:900}});
    page.on('pageerror', error=>errors.push(error.message));
    let initialNavigation = true;
    page.on('framenavigated', frame => {
      if (frame !== page.mainFrame()) return;
      if (initialNavigation) { initialNavigation = false; return; }
      console.warn(`[localization] unexpected main-frame navigation to ${frame.url()}`);
    });
    await page.goto(url,{waitUntil:'networkidle'});
    await page.evaluate(async()=>{await globalThis.RPChessRouteReady;});
    return page;
  }
  try {
    let page = await fresh();
    await roundtrip(page,'menu and empty Chronicle');
    await page.evaluate(()=>globalThis.RPChessOpenSettings());
    await roundtrip(page,'settings');
    await page.close();

    page = await fresh();
    await seed(page,null);
    await page.evaluate(()=>globalThis.RPChessRoster.continueRun());
    await roundtrip(page,'roster');
    const ids = await page.evaluate(async()=>{
      const {RECRUIT_LIBRARY}=await import('./js/settlement-core.mjs');
      const {readRun,writeRun}=await import('./js/run-persistence.mjs');
      const run=readRun();writeRun({...run,roster:[run.roster.find(hero=>hero.isRunKing),...RECRUIT_LIBRARY]});
      dispatchEvent(new CustomEvent('rpchess:run-updated'));return RECRUIT_LIBRARY.map(hero=>hero.id);
    });
    for(const id of ids) {
      await page.evaluate(async id=>{const {readRun,writeRun}=await import('./js/run-persistence.mjs');writeRun({...readRun(),selectedCharacterId:id});globalThis.RPChessRoster.syncRun();globalThis.RPChessRoster.render();},id);
      await english(page,`roster detail ${id}`);
    }
    assert.strictEqual(ids.length,33);
    await page.close();

    page = await fresh();
    for(let index=0;index<33;index+=3){
      await seed(page,'settlement',index);
      await roundtrip(page,`Settlement heroes ${index+1}–${index+3}`);
      assert.strictEqual(await page.locator('.settlement-recruit').count(),3);
    }
    await language(page,'ru');
    await page.locator('[data-settlement-heal]').first().click();
    await language(page,'en');
    await english(page,'healing resource notification');
    await page.close();

    for(const type of ['skirmish','battle','caravan']) {
      page = await fresh();
      await seed(page,type);
      const api=type==='skirmish'?'RPChessSkirmish':'RPChessBattle';
      const prefix=type==='skirmish'?'skirmish':'battle';
      await page.locator('[data-artifact-choice-modal]').waitFor();
      assert.strictEqual(await page.locator(`[data-${prefix}-screen]`).isHidden(),true,`${type} must skip preparation`);
      const chosen=await page.evaluate(name=>globalThis[name].selectedIds,api);
      assert(chosen.includes('king.oathkeeper'),`${type} automatic roster selection must keep the King`);
      await roundtrip(page,`${type} automatic deployment and artifact choice`);
      await page.locator('[data-artifact-choice="none"]').click();
      await page.locator('[data-classic-screen]:not([hidden])').waitFor();
      await roundtrip(page,`${type} chessboard`);
      await page.evaluate(api=>{const combat=globalThis[api];combat.finishBattle({over:true,type:'checkmate',winner:combat.battlePlan.playerColor});},api);
      await roundtrip(page,`${type} aftermath and rewards`);
      await page.close();
    }

    page = await fresh();
    for(const type of ['skirmish','battle','event','settlement','puzzle','caravan']) {
      await page.evaluate(async type=>{
        const {createRun,writeRun}=await import('./js/run-persistence.mjs');
        const {createTravelChoices}=await import('./js/travel-choice-core.mjs');
        const run=createRun({id:`travel-locale:${type}`,playerName:'Тимур'});
        writeRun({...run,currentTravelChoices:createTravelChoices({runId:run.id,types:[type]})});
        globalThis.RPChessTravelChoice.open();
      },type);
      await roundtrip(page,`travel ${type}`);
    }
    await page.close();

    for(const eventId of ['E001','E147','E291','E500']) {
      page = await fresh();
      await seed(page,'event',0,eventId);
      await roundtrip(page,`event ${eventId}`);
      await page.locator('[data-event-choice]:not([disabled])').first().click();
      await page.locator('[data-events-outcome]:not([hidden])').waitFor();
      await roundtrip(page,`event ${eventId} outcome`);
      await page.close();
    }

    page = await fresh();
    await seed(page,'puzzle');
    await roundtrip(page,'puzzle');
    await page.close();

    page = await fresh();
    await seed(page,null);
    await page.evaluate(async()=>{
      const {readRun,writeRun}=await import('./js/run-persistence.mjs');
      const {createTravelChoices}=await import('./js/travel-choice-core.mjs');
      const {resolveStarvation}=await import('./js/starvation-core.mjs');
      const run=readRun();run.activeTravelChoice={...createTravelChoices({runId:run.id,types:['settlement']})[0],supplyCostAtSelection:1,supplyPaid:0};
      const result=resolveStarvation(run);writeRun(result.run);globalThis.RPChessStarvation.open(result.run);
    });
    await roundtrip(page,'starvation');
    await page.evaluate(async()=>{const {readRun,writeRun}=await import('./js/run-persistence.mjs');const run=writeRun({...readRun(),ended:true,endReason:'king_dead'});globalThis.RPChessEndlessRun.open(run);});
    await roundtrip(page,'journey summary');
    await page.close();

    page = await fresh();
    await seed(page,null);
    await page.evaluate(async()=>{
      const {readRun}=await import('./js/run-persistence.mjs');
      const {ARTIFACTS}=await import('./js/artifact-core.mjs');
      const {chooseArtifact}=await import('./js/artifact-combat-ui.mjs');
      const run=readRun();run.artifacts=Object.fromEntries(ARTIFACTS.map(artifact=>[artifact.id,3]));
      chooseArtifact({run,combatType:'battle',encounterId:'locale-artifacts',onChoose:()=>{}});
    });
    await roundtrip(page,'owned artifact choice');
    await page.locator('[data-artifact-choice="none"]').click();
    await page.evaluate(async()=>{
      const {readRun}=await import('./js/run-persistence.mjs');
      const {showCaravanRewards}=await import('./js/caravan-reward-ui.mjs');
      const {ARTIFACTS}=await import('./js/artifact-core.mjs');
      const run=readRun();run.currentCaravan={offers:[{id:'gold',kind:'gold',amount:40},{id:'supplies',kind:'supplies',amount:3},{id:'hero',kind:'hero',heroId:'hero.maeve_root'},{id:'healing',kind:'healing',heroId:'hero.aldric_wall'},{id:'artifact',kind:'artifact',artifactId:ARTIFACTS[0].id,amount:3}]};
      showCaravanRewards(run,()=>true);
    });
    await roundtrip(page,'all caravan reward types');
    await page.close();

    page = await fresh();
    await page.locator('[data-arena-open]').click();
    await roundtrip(page,'Arena catalog');
    await page.locator('[data-arena-foes] button').first().click();
    await roundtrip(page,'Arena opponent');
    await page.evaluate(async()=>{
      const core=await import('./js/arena-core.mjs');
      const state=core.chooseArtifact(core.newMatch(core.emptyArena(),core.OPPONENTS[0].id,'locale-match'),null);
      localStorage.setItem(core.ARENA_KEY,JSON.stringify(core.finishMatch(state,'win')));
      globalThis.RPChessArena.enter();
    });
    await roundtrip(page,'Arena result');
    await page.locator('[data-arena-action="continue"]').click();
    await page.evaluate(async()=>{
      const core=await import('./js/arena-core.mjs');
      localStorage.setItem(core.ARENA_KEY,JSON.stringify(core.emptyArena()));
      globalThis.RPChessArena.enter();
      const squad=document.querySelector('[data-arena-squad="elves"]');squad.disabled=false;squad.click();
    });
    assert((await page.locator('[data-arena-notice]').innerText()).includes('honor shards'));
    await roundtrip(page,'Arena insufficient shards notice');
    await page.close();
    assert.deepStrictEqual(errors,[],'localization switching must not throw');
    console.log('RU/EN real DOM audit: menu, settings, 33 hero details/recruits, healer, travel, combat, dialogs, events, puzzle, starvation, summary, Arena: PASS');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
