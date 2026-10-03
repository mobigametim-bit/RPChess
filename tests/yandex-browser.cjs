const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startNewRun } = require('./browser-test-helpers.cjs');
const root = path.resolve(__dirname, '../dist-yandex');
const mime = { '.html':'text/html', '.mjs':'text/javascript', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.wasm':'application/wasm', '.png':'image/png', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.otf':'font/otf' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

const mockSDK = `
window.__sdkLog=[];window.__sdkEvents={};window.__adMode='rewarded';
window.YaGames={async init(){return {
  environment:{i18n:{lang:'en'},app:{id:'123456'}},
  on(name,listener){window.__sdkEvents[name]=listener},
  features:{LoadingAPI:{ready(){window.__sdkLog.push('ready')}},GameplayAPI:{start(){window.__sdkLog.push('start')},stop(){window.__sdkLog.push('stop')}}},
  async getPlayer(){return {isAuthorized(){return true},getUniqueID(){return 'browser-tester'},
    async getData(){return window.__readCloud()},async setData(data,flush){if(!flush)throw Error('Flush expected');await window.__writeCloud(data)}}},
  adv:{async hideBannerAdv(){window.__sdkLog.push('hide')},
    showRewardedVideo({callbacks}){callbacks.onOpen();setTimeout(()=>{if(window.__adMode==='rewarded')callbacks.onRewarded();if(window.__adMode==='error')callbacks.onError(Error('No ad'));else callbacks.onClose()},30)},
    showFullscreenAdv({callbacks}){callbacks.onOpen();setTimeout(()=>callbacks.onClose(true),30)}}
}}};`;

if (require.main === module) (async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  server.unref();
  const url = `http://127.0.0.1:${server.address().port}/`;
  let cloud = {};
  let cloudWrites = 0;
  const browser = await chromium.launch({ headless:true });
  try {
    for (const viewport of [{ width:1280, height:720 }, { width:844, height:390 }]) {
      const context = await browser.newContext({ viewport, hasTouch:viewport.width === 844 });
      const page = await context.newPage();
      const errors = [], failed = [], external = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
      page.on('request', request => { if (!request.url().startsWith(url.slice(0, -1))) external.push(request.url()); });
      await page.exposeFunction('__readCloud', () => structuredClone(cloud));
      await page.exposeFunction('__writeCloud', data => { cloud = structuredClone(data); cloudWrites++; });
      await page.route('**/sdk.js', route => route.fulfill({ contentType:'text/javascript', body:mockSDK }));
      await page.goto(url, { waitUntil:'networkidle' });
      assert.equal(await page.evaluate(() => RPChessYandexReady), true);
      assert.equal(await page.locator('.yandex-loading').count(), 0);
      assert.equal(await page.locator('html[data-yandex-loading]').count(), 0);
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.equal(await page.title(), 'Heroes of Check & Mate');
      assert.match(await page.locator('[data-new-game]').innerText(), /Journey/i);
      assert.deepEqual(await page.evaluate(() => __sdkLog.filter(value => value === 'ready')), ['ready']);
      assert.equal(await page.evaluate(() => RPChessPlatform.kind), 'yandex');
      if (viewport.width === 844) {
        assert.equal(await page.locator('[data-continue-run]').isEnabled(), true, 'fresh mobile context restores the cloud run');
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('rpchess.reboot.v1.run')).artifacts),
          { 'vision.piercing':2, 'tactics.fork_master':3 });
      }
      await page.evaluate(() => RPChessI18n.setLanguage('ru'));
      await page.reload({ waitUntil:'networkidle' });
      await page.evaluate(() => RPChessYandexReady);
      assert.equal(await page.locator('html').getAttribute('lang'), 'ru', 'manual choice persists against portal EN');
      assert.equal(await page.title(), 'Герои Шаха и Мата');
      await page.evaluate(() => RPChessI18n.setLanguage('en'));
      await page.evaluate(() => RPChessClassicChess.newGame());
      await page.waitForFunction(() => RPChessPlatform.lifecycle.isPlayable());
      const before = await page.evaluate(() => RPChessClassicChess.engine.fen());
      await page.evaluate(() => __sdkEvents.game_api_pause());
      assert.equal(await page.evaluate(() => RPChessClassicChess.move('e2','e4').ok), false);
      assert.equal(await page.evaluate(() => RPChessClassicChess.engine.fen()), before);
      assert.equal(await page.evaluate(() => RPChessRebootAudio.hostActive), false);
      await page.evaluate(() => __sdkEvents.game_api_resume());
      assert.equal(await page.evaluate(() => RPChessClassicChess.move('e2','e4').ok), true);
      await page.evaluate(() => RPChessClassicChess.showMenu());
      await page.waitForFunction(() => !RPChessPlatform.lifecycle.isPlayable());
      const starts = await page.evaluate(() => __sdkLog.filter(value => value === 'start').length);
      await page.evaluate(() => { __sdkEvents.game_api_pause(); __sdkEvents.game_api_resume(); });
      assert.equal(await page.evaluate(() => __sdkLog.filter(value => value === 'start').length), starts);
      // Use the real local Stockfish worker. A completed search must not commit
      // a move while the SDK has paused the game.
      await page.evaluate(() => { RPChessClassicChess.newGame(null, { mode:'ai', playerColor:'b', aiElo:800 }); __sdkEvents.game_api_pause(); });
      await page.waitForTimeout(1000);
      assert.equal(await page.evaluate(() => RPChessClassicChess.engine.turn()), 'w');
      await page.evaluate(() => __sdkEvents.game_api_resume());
      await page.waitForFunction(() => RPChessClassicChess.engine.turn() === 'b', { timeout:30000 });
      await page.evaluate(() => RPChessClassicChess.showMenu());
      for (const mode of ['rewarded','closed','error']) {
        const status = await page.evaluate(async value => {
          __adMode = value;
          return (await RPChessPlatform.ads.show('reward')).status;
        }, mode);
        assert.equal(status, mode === 'rewarded' ? 'completed' : mode);
        assert.equal(await page.evaluate(() => RPChessRebootAudio.hostActive), true);
      }
      assert.equal(await page.evaluate(() => {
        const event = new MouseEvent('contextmenu', { bubbles:true, cancelable:true });
        document.querySelector('#app').dispatchEvent(event); return event.defaultPrevented;
      }), true);
      await page.locator('[data-arena-open]').click();
      assert.equal(await page.locator('[data-arena-foes] button').count(), 84);
      await page.screenshot({ path:path.resolve(__dirname, `../../yandex-arena-${viewport.width}.png`) });
      await page.locator('[data-arena-back]').click();
      if (viewport.width === 1280) {
        await startNewRun(page, { playerName:'Yandex Tester' });
        await page.evaluate(async () => {
          const { readRun, writeRun } = await import('./js/run-persistence.mjs');
          writeRun({ ...readRun(), artifacts:{ 'vision.piercing':2, 'tactics.fork_master':3 } });
          const { syncCloudNow } = await import('./js/cloud-save.mjs');
          if (!await syncCloudNow()) throw Error('Cloud write failed');
        });
      }
      assert.deepEqual(errors, [], 'no JS errors');
      assert.deepEqual(failed, [], 'every requested local file exists');
      assert.deepEqual(external, [], 'the game must not request GitHub Pages or remote game assets');
      await context.close();
      console.log(`PASS Yandex ${viewport.width}×${viewport.height}: startup, RU/EN, SDK pause, real bot, rewarded callbacks, Arena and cloud`);
    }
    assert.ok(cloudWrites > 0);
    console.log('PASS Yandex desktop-to-mobile cloud restore includes X-Ray and Fork Master');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });

module.exports = { mockSDK };
