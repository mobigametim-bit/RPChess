from pathlib import Path

ui=Path("game/localization/ui.mjs")
s=ui.read_text(encoding="utf-8")
pairs=[
("'battle.runEnd.text':'{name} пал в битве. Забег завершён.','battle.mercenary.quoteTitle'",
 "'battle.runEnd.text':'{name} пал в битве. Забег завершён.','battle.runEnd.text.soloKing':'Наемники не посчитались со словами одинокого короля без королевства и повесили вас на суку ближайшего дерева','battle.mercenary.quoteTitle'"),
("'battle.runEnd.text':'{name} fell in battle. The run is over.','battle.mercenary.quoteTitle'",
 "'battle.runEnd.text':'{name} fell in battle. The run is over.','battle.runEnd.text.soloKing':'The mercenaries paid no heed to the words of a lone king without a kingdom and hanged you from the nearest tree.','battle.mercenary.quoteTitle'")
]
for old,new in pairs:
    assert s.count(old)==1, old
    s=s.replace(old,new)
ui.write_text(s,encoding="utf-8")

app=Path("game/js/battle-app.mjs")
s=app.read_text(encoding="utf-8")
old="runEndScreen.querySelector('[data-battle-run-end-text]').textContent=t('battle.runEnd.text',{name:contentText(king?.name||t('piece.king'))});"
new="const textKey=activeRun.endReason==='king_solo_battle'?'battle.runEnd.text.soloKing':'battle.runEnd.text';runEndScreen.querySelector('[data-battle-run-end-text]').textContent=t(textKey,{name:contentText(king?.name||t('piece.king'))});"
assert s.count(old)==1
app.write_text(s.replace(old,new),encoding="utf-8")

css=Path("game/css/landscape-ui-redesign.css")
s=css.read_text(encoding="utf-8")
marker="/* Solo-King Battle run-end: one-viewport owner contract. */"
assert marker not in s
s += r'''

/* Solo-King Battle run-end: one-viewport owner contract. */
@media (orientation: landscape) {
  html[data-landscape-ui='1'] .battle-run-end {
    width:100vw !important;
    height:100dvh !important;
    min-height:0 !important;
    max-height:100dvh !important;
    padding:0 !important;
    overflow:hidden !important;
    box-sizing:border-box !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-shell {
    position:relative !important;
    width:100% !important;
    height:100% !important;
    min-height:0 !important;
    max-height:100% !important;
    margin:0 !important;
    padding:8px 10px !important;
    display:grid !important;
    place-items:center !important;
    overflow:hidden !important;
    box-sizing:border-box !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-logo {
    position:absolute !important;
    top:8px !important;
    left:10px !important;
    width:min(140px,14vw) !important;
    margin:0 !important;
    z-index:3 !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-panel {
    width:min(1380px,100%) !important;
    min-height:0 !important;
    max-height:calc(100dvh - 16px) !important;
    overflow:hidden !important;
    box-sizing:border-box !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-panel::after {
    min-height:0 !important;
  }
}
@media (orientation: landscape) and (max-width:1180px) {
  html[data-landscape-ui='1'] .battle-run-end .battle-logo { width:min(118px,13vw) !important; }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-panel {
    height:100% !important;
    max-height:100% !important;
    grid-template-columns:minmax(0,1.22fr) minmax(220px,.78fr) !important;
    grid-template-areas:'result art' 'eyebrow art' 'text art' 'columns art' 'button art' !important;
    grid-template-rows:auto auto auto minmax(0,1fr) auto !important;
    column-gap:18px !important;
    row-gap:6px !important;
    align-content:center !important;
    padding:clamp(14px,2.2vw,24px) !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-panel>h1 { font-size:clamp(46px,6vw,68px) !important; }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-panel>p {
    margin-top:0 !important;
    font-size:13px !important;
    line-height:1.35 !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-run-end-metrics {
    grid-area:columns !important;
    grid-template-columns:repeat(3,minmax(0,1fr)) !important;
    gap:7px !important;
    margin:12px 0 0 !important;
    align-self:start !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-run-end-metrics>section {
    min-height:0 !important;
    padding:7px 8px !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-run-end-metrics h2 {
    margin:0 0 5px !important;
    font-size:clamp(16px,2vw,21px) !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-button {
    min-height:42px !important;
    margin:8px 0 0 !important;
  }
}
@media (orientation: landscape) and (max-width:980px) and (max-height:520px) {
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-shell { padding:5px 7px !important; }
  html[data-landscape-ui='1'] .battle-run-end .battle-logo { display:none !important; }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-panel {
    width:100% !important;
    height:100% !important;
    max-height:100% !important;
    grid-template-columns:minmax(0,1.2fr) minmax(245px,.8fr) !important;
    grid-template-areas:'result columns' 'eyebrow columns' 'text columns' 'button columns' !important;
    grid-template-rows:auto auto minmax(0,1fr) auto !important;
    column-gap:12px !important;
    row-gap:3px !important;
    align-content:stretch !important;
    padding:8px 10px !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-panel::after { display:none !important; }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-panel>h1 {
    margin:0 !important;
    font-size:clamp(32px,9vh,44px) !important;
    line-height:.92 !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-panel>.reboot-eyebrow {
    margin:0 !important;
    font-size:9px !important;
    line-height:1.1 !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-panel>p {
    margin:0 !important;
    max-width:none !important;
    font-size:11px !important;
    line-height:1.25 !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-run-end-metrics {
    grid-area:columns !important;
    align-self:stretch !important;
    height:100% !important;
    min-height:0 !important;
    display:grid !important;
    grid-template-columns:1fr !important;
    grid-template-rows:repeat(3,minmax(0,1fr)) !important;
    gap:5px !important;
    margin:0 !important;
    padding:0 !important;
    border:0 !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-run-end-metrics>section {
    min-height:0 !important;
    display:grid !important;
    grid-template-columns:minmax(0,1fr) auto !important;
    align-items:center !important;
    gap:6px !important;
    padding:5px 7px !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-run-end-metrics h2 {
    margin:0 !important;
    font-size:clamp(14px,3.7vh,18px) !important;
    line-height:1 !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-run-end-metrics .battle-aftermath-empty {
    font-size:clamp(20px,6vh,28px) !important;
    line-height:1 !important;
    text-align:right !important;
  }
  html[data-landscape-ui='1'] .battle-run-end .battle-aftermath-button {
    justify-self:start !important;
    width:min(300px,100%) !important;
    min-height:36px !important;
    margin:3px 0 0 !important;
    font-size:16px !important;
  }
}
'''
css.write_text(s,encoding="utf-8")

test=Path("tests/responsive-viewport-browser.cjs")
s=test.read_text(encoding="utf-8")
anchor="\nasync function auditPrepAndCombat(browser, width, height, language) {"
assert s.count(anchor)==1
fn=r'''

async function auditSoloKingBattleRunEnd(browser, width, height, language) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error)));
  const label = `${width}x${height} ${language.toUpperCase()} solo-King Battle run end`;
  try {
    await freshMenu(page);
    await setLanguage(page, language);
    await startNewRun(page, { playerName: `Solo King ${width} ${language}` });
    await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      const enemyRoleRaces = { pawn:'orcs', knight:'orcs', bishop:'orcs', rook:'orcs', queen:'orcs', king:'orcs' };
      run.currentTravelChoices = [{ id:'responsive.solo-king.battle', step:1, type:'battle', label:'БИТВА', stars:6, threatLabel:'ОПАСНАЯ', flavor:'Дорогу перекрывает полностью развёрнутая армия противника.', mechanicalHint:'Полная армия противника.', seed:'responsive-solo-king-battle-seed', difficultyModel:'power-v1', playerColor:'w', enemyColor:'b', enemyRaceTag:'orcs', enemyRoleRaces, sideNarrative:'Ваш отряд перехватывает инициативу и первым выходит на поле.' }];
      run.activeTravelChoice = null;
      localStorage.setItem(key, JSON.stringify(run));
      dispatchEvent(new CustomEvent('rpchess:run-updated'));
    }, RUN_KEY);
    await page.locator('[data-roster-travel]').click();
    await page.locator('[data-travel-choice-screen]:not([hidden])').waitFor();
    await page.locator('[data-travel-type="battle"]').first().click();
    await page.locator('[data-battle-screen]:not([hidden])').waitFor();
    const kingId = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).roster.find((character) => character.isRunKing).id, RUN_KEY);
    const cards = page.locator('[data-battle-character]');
    for (let index = 0; index < await cards.count(); index += 1) {
      const card = cards.nth(index);
      if ((await card.getAttribute('data-battle-character')) !== kingId) await card.click();
    }
    await page.locator('[data-battle-start]').click();
    await page.locator('[data-classic-screen]:not([hidden])').waitFor();
    const participants = await page.evaluate(() => globalThis.RPChessBattle.battlePlan?.participants || []);
    assert.deepStrictEqual(participants, [kingId], `${label}: Battle must contain only the named King`);
    await page.evaluate(() => globalThis.RPChessBattle.finishBattle({ over:true, type:'stalemate', winner:null }));
    await page.locator('[data-battle-run-end]:not([hidden])').waitFor();
    const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_KEY);
    assert.strictEqual(persisted.ended, true, `${label}: run must end`);
    assert.strictEqual(persisted.endReason, 'king_solo_battle', `${label}: solo-King end reason must be preserved`);
    assert.strictEqual(persisted.roster.find((character) => character.isRunKing).status, 'dead', `${label}: King must die after the completed Battle`);
    const expectedText = language === 'en'
      ? 'The mercenaries paid no heed to the words of a lone king without a kingdom and hanged you from the nearest tree.'
      : 'Наемники не посчитались со словами одинокого короля без королевства и повесили вас на суку ближайшего дерева';
    assert.strictEqual((await page.locator('[data-battle-run-end-text]').innerText()).trim(), expectedText, `${label}: reason copy mismatch`);
    await assertPageFitsViewport(page, label);
    await assertViewportContained(page, '[data-battle-run-end]:not([hidden])', `${label} screen`);
    await assertViewportContained(page, '.battle-run-end .battle-aftermath-panel', `${label} panel`);
    for (const selector of ['[data-battle-run-end-title]','[data-battle-run-end-text]','[data-battle-run-metric="combats"]','[data-battle-run-metric="healthy"]','[data-battle-run-metric="wounded"]','[data-battle-run-end-continue]']) {
      await assertViewportContained(page, selector, `${label} ${selector}`);
    }
    await assertFrameContains(page, '.battle-run-end .battle-aftermath-panel', ['[data-battle-run-end-title]','[data-battle-run-end-text]','[data-battle-run-metric]','[data-battle-run-end-continue]'], `${label} ownership`);
    const overflow = await page.locator('.battle-run-end .battle-aftermath-panel').evaluate((panel) => ({ scrollHeight:panel.scrollHeight, clientHeight:panel.clientHeight, overflowY:getComputedStyle(panel).overflowY }));
    assert(overflow.scrollHeight <= overflow.clientHeight + 1, `${label}: panel content must fit without scrolling (${overflow.scrollHeight} > ${overflow.clientHeight})`);
    assert(!['auto','scroll'].includes(overflow.overflowY), `${label}: panel must not own an internal scrollbar`);
    assert.deepStrictEqual(errors, [], `${label} browser errors:\n${errors.join('\n')}`);
  } finally {
    await page.close();
  }
}
'''
s=s.replace(anchor,fn+anchor)
loop="      for (const [width, height] of [[1180, 820], [1024, 768], [844, 390]]) await auditPrepAndCombat(browser, width, height, language);"
assert s.count(loop)==1
s=s.replace(loop,"      for (const [width, height] of [[1366, 768], [1024, 768], [844, 390]]) await auditSoloKingBattleRunEnd(browser, width, height, language);\n"+loop)
test.write_text(s,encoding="utf-8")
