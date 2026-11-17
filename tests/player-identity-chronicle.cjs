const fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
class MemoryStorage{constructor(){this.map=new Map()}getItem(k){return this.map.has(k)?this.map.get(k):null}setItem(k,v){this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}}
(async()=>{
  const game=path.resolve(__dirname,'..','game'),url=(relative)=>pathToFileURL(path.join(game,relative)).href;
  const identity=await import(url('js/player-identity-core.mjs'));
  const chronicle=await import(url('js/chronicle-core.mjs'));
  const persistence=await import(url('js/run-persistence.mjs'));
  const storage=new MemoryStorage();

  assert.strictEqual(identity.normalizePlayerName('   Тимур   Воин  '),'Тимур Воин');
  assert.strictEqual(identity.normalizePlayerName('   '),'');
  assert(identity.normalizePlayerName('123456789012345678901234567890').length<=identity.PLAYER_NAME_MAX_LENGTH);

  let run=persistence.createRun({now:1000,id:'identity-run',playerName:'  Тимур  '});
  assert.strictEqual(run.playerName,'Тимур');
  const commanders=await import(url('js/commander-portraits.mjs'));
  const race=await import(url('js/race-assets.mjs'));
  assert.strictEqual(commanders.COMMANDERS.length,7,'all seven actual king portraits are selectable');
  const assetRoot=path.resolve(game,'assets/kings');
  for(const c of commanders.COMMANDERS){
    assert(fs.existsSync(path.join(game,c.portrait)),`king portrait missing: ${c.id}`);
    assert(c.portrait.endsWith('/portrait.webp'),`commander portrait must be compressed WebP: ${c.id}`);
    for(const color of ['w','b']){
      const asset=commanders.commanderPieceArt(c.id,color),data=fs.readFileSync(path.join(game,asset));
      assert(asset.endsWith(color==='w'?'/white.webp':'/black.webp'),`wrong king color mapping: ${c.id}/${color}`);
      assert.strictEqual(data.toString('ascii',0,4),'RIFF',`missing WebP signature: ${asset}`);
      assert.strictEqual(data.toString('ascii',8,12),'WEBP',`bad WebP file: ${asset}`);
      assert(data.length<100*1024,`king sprite not adequately compressed: ${asset}`);
    }
    const portrait=fs.readFileSync(path.join(game,c.portrait));
    assert(portrait.length<180*1024 && portrait.toString('ascii',8,12)==='WEBP',`uncompressed commander portrait: ${c.id}`);
    assert(c.descriptionRu&&c.descriptionEn&&c.titleRu&&c.titleEn,`localized commander bio incomplete: ${c.id}`);
  }
  assert.strictEqual(commanders.normalizeCommanderId('../bad/path'),'oathkeeper','user-controlled paths are never accepted');
  const chosen=persistence.createRun({id:'portrait-test',playerName:'Тест',commanderId:'wanderer_queen'});
  assert.strictEqual(chosen.commanderId,'wanderer_queen');
  assert.strictEqual(chosen.roster[0].id,'king.oathkeeper','chess rules rely on stable Run King ID');
  assert.strictEqual(chosen.roster[0].portrait,commanders.commanderPortrait('wanderer_queen'));
  assert.strictEqual(chosen.roster[0].name,commanders.commanderTitle('wanderer_queen'));
  assert.strictEqual(chosen.roster[0].commanderId,'wanderer_queen');
  assert.strictEqual(chosen.roster[0].pieceArt,commanders.commanderPieceArt('wanderer_queen','w'));
  assert.strictEqual(race.boardPieceArtForCharacter(chosen.roster[0],'w'),commanders.commanderPieceArt('wanderer_queen','w'));
  assert.strictEqual(race.boardPieceArtForCharacter(chosen.roster[0],'b'),commanders.commanderPieceArt('wanderer_queen','b'),
    'black-side player king must use unique dark chess sprite, never generic old king');
  const portraitStorage=new MemoryStorage();
  const stored=persistence.writeRun(chosen,portraitStorage,1200);
  assert.strictEqual(stored.commanderId,'wanderer_queen');
  const resumed=persistence.readRun(portraitStorage);
  assert.strictEqual(resumed.roster[0].portrait,commanders.commanderPortrait('wanderer_queen'),'hydration must not reset the chosen commander portrait');
  assert.strictEqual(resumed.roster[0].pieceArt,chosen.roster[0].pieceArt,'commander-specific piece asset must survive hydration');
  assert.strictEqual(resumed.roster[0].commanderId,'wanderer_queen',"existing run must restore king commander identity");
  assert.strictEqual(race.boardPieceArtForCharacter(resumed.roster[0],'b'),commanders.commanderPieceArt('wanderer_queen','b'));

  run=persistence.writeRun(run,storage,1000);
  assert.strictEqual(persistence.readRun(storage).playerName,'Тимур','player name must survive persistence');

  const legacy={...run};delete legacy.playerName;storage.setItem(persistence.RUN_STORAGE_KEY,JSON.stringify(legacy));
  assert.strictEqual(persistence.readRun(storage).playerName,'Воин','legacy runs must hydrate with a safe player-name fallback');

  assert.strictEqual(identity.personalizePlayerNarrative('Король перечитывает документ.','Тимур'),'Тимур перечитывает документ.');
  assert.strictEqual(identity.personalizePlayerNarrative('Пока Король не спрашивает, девочка молчит.','Тимур'),'Пока Тимур не спрашивает, девочка молчит.');
  assert.strictEqual(identity.personalizePlayerNarrative('Один из женихов подходит к Королю.','Тимур'),'Один из женихов подходит к вам.');
  assert.strictEqual(identity.personalizePlayerNarrative('В деревне Короля встречают колокольным звоном.','Тимур'),'В деревне вас встречают колокольным звоном.');
  assert.strictEqual(identity.personalizePlayerNarrative('КОРОЛЬ МОЖЕТ ПОГИБНУТЬ','Тимур'),'КОРОЛЬ МОЖЕТ ПОГИБНУТЬ','system chess/RPG warnings must stay system language');

  assert.strictEqual(chronicle.gloryForRun(35,900),17);
  assert.strictEqual(chronicle.gloryForRun(0,900),0);
  const completed={...persistence.createRun({now:2000,id:'completed-run',playerName:'Рагнар',commanderId:'ash_regent'}),journeyStep:35,ended:true,endReason:'starvation_king',updatedAt:2500,gloryV2:{version:2,events:[['battle','b1',5]]}};
  let result=chronicle.recordCompletedRun(completed,{power:900,storage,completedAt:2500});
  assert.strictEqual(result.changed,true);
  assert.strictEqual(result.record.glory,Math.floor(45*Math.sqrt(900/500)));
  assert.strictEqual(result.record.scoreVersion,2);
  assert.strictEqual(result.record.playerName,'Рагнар');
  assert.strictEqual(result.record.commanderId,'ash_regent');
  assert.strictEqual(chronicle.readChronicle(storage).history[0].commanderId,'ash_regent');
  assert.strictEqual(result.record.endReason,'starvation_king','new Chronicle entries preserve the final outcome');
  result=chronicle.recordCompletedRun(completed,{power:900,storage,completedAt:2600});
  assert.strictEqual(result.changed,false,'same completed run must be idempotent');
  result=chronicle.recordCompletedRun(completed,{power:1000,storage,completedAt:2700});
  assert.strictEqual(result.changed,false,'completed Glory and Power stay frozen after run end');
  assert.strictEqual(result.record.power,900);

  const second={...completed,id:'second-run',playerName:'Эдрик',journeyStep:40,updatedAt:3000};
  chronicle.recordCompletedRun(second,{power:640,storage,completedAt:3000});
  const best=chronicle.bestChronicleRun(chronicle.readChronicle(storage));
  assert(best&&best.runId==='completed-run','best v2 run is selected without legacy Glory');

  const active={...persistence.createRun({id:'active-run',playerName:'Алёна'}),gloryV2:{version:2,events:[['skirmish','s1',1]]},journeyStep:12,roster:persistence.createRun({id:'roster-copy'}).roster.map((hero,index)=>index===1?{...hero,status:'dead'}:hero)};
  const snapshot=chronicle.activeRunSnapshot(active,{power:777});
  assert.strictEqual(snapshot.playerName,'Алёна');
  assert.strictEqual(snapshot.commanderId,'oathkeeper');
  assert.strictEqual(snapshot.week,12);
  assert.strictEqual(snapshot.power,777);
  assert.strictEqual(snapshot.heroes,active.roster.length-1);
  assert.strictEqual(chronicle.activeLeaderboardRecord(active,{power:900}).glory,Math.floor(12*Math.sqrt(900/500)),
    'ongoing Journey earns Glory on achievements, not weeks');
  assert.strictEqual(chronicle.bestLeaderboardRecord(chronicle.readChronicle(storage),active,{power:900}).runId,'completed-run',
    'completed record stays on top if its Glory is higher');
  const improving={...active,journeyStep:50,gloryV2:{version:2,events:[
    ['battle','b1',5],['battle','b2',5],['battle','b3',5]
  ]}};
  assert.strictEqual(chronicle.bestLeaderboardRecord(chronicle.readChronicle(storage),improving,{power:1600}).runId,'active-run',
    'an unfinished Journey can overtake the completed personal best');
  assert.strictEqual(chronicle.readChronicle(storage).history.length,2,
    'ranking an active Journey must not add it to the completed Chronicle');

  const foundation=fs.readFileSync(path.join(game,'js/reboot-foundation.mjs'),'utf8');
  const ui=fs.readFileSync(path.join(game,'js/player-identity-chronicle.mjs'),'utf8');
  const events=fs.readFileSync(path.join(game,'js/events-app.mjs'),'utf8');
  const css=fs.readFileSync(path.join(game,'css/player-identity-chronicle.css'),'utf8');
  for(const token of ["import('./player-identity-chronicle.mjs')",'RPChessIdentityReady','openIdentityPrompt'])assert(foundation.includes(token),`foundation identity bootstrap missing ${token}`);
  for(const token of ['identity.title','data-player-identity-input','data-chronicle-panel','chronicle.current','chronicle.commanders','leaderboard.yourRank','chronicle.glory'])assert(ui.includes(token),`identity/chronicle UI missing ${token}`);
  assert(!ui.includes('Новое имя ещё ждёт своей дороги.'),'Chronicle must not show the removed empty current-run sentence');
  for(const token of ['personalizePlayerNarrative','personalizePlayerTitle','playerNameForRun'])assert(events.includes(token),`Events player-name integration missing ${token}`);
  for(const token of ['.chronicle-panel','.identity-panel','.chronicle-metric'])assert(css.includes(token),`identity/chronicle CSS missing ${token}`);
  assert(!ui.includes('renderPersonalChronicle(bestRoot)'),
    'profile mode must show global Great Commanders instead of replacing TOP-10 with personal run history');
  for(const token of ['chronicle.commanders','leaderboard.yourRank','leaderboard.top10','chronicle-leaderboard-row'])
    assert(ui.includes(token),`global Chronicle leaderboard missing ${token}`);
  const runtimeUI=fs.readFileSync(path.join(game,'localization/runtime-ui.mjs'),'utf8');
  for(const key of ['chronicle.personalHistory','chronicle.completedCount','chronicle.arenaEvents'])
    assert.strictEqual(runtimeUI.split(key).length,3,`both RU/EN must translate ${key}`);

  const leaderboard=await import(pathToFileURL(path.join(game,'../leaderboard-worker/src/index.mjs')).href);
  assert.strictEqual(leaderboard.validatedRecord({runId:'run-1',playerName:'Элиана',week:36,power:556,glory:14}).glory,14);
  assert.strictEqual(leaderboard.validatedRecord({runId:'run-1',playerName:'Элиана',week:36,power:556,glory:14,commanderId:'stone_crown'}).commanderId,'stone_crown');
  assert.strictEqual(leaderboard.validatedRecord({runId:'run-1',playerName:'Элиана',week:36,power:556,glory:14,commanderId:'../../unsafe'}).commanderId,'oathkeeper');
  assert(fs.readFileSync(path.join(game,'../leaderboard-worker/schema.sql'),'utf8').includes('commander_id TEXT NOT NULL DEFAULT'));
  assert(fs.readFileSync(path.join(game,'../leaderboard-worker/src/index.mjs'),'utf8').includes('commander_id AS commanderId'));
  assert(ui.includes('data-identity-commander')&&ui.includes('chronicle-leaderboard-avatar'),
    'creation modal and existing blue Chronicle flag must display commander portraits');

  assert.strictEqual(leaderboard.validatedRecord({runId:'run-1',playerName:'Элиана',week:36,power:556,glory:99}),null,'incorrect Glory must be rejected');
  assert.strictEqual(leaderboard.validatedRecord({runId:'run-1',playerName:'Элиана',week:-1,power:556,glory:0}),null,'negative weeks must be rejected');
  const vkSecret='local-test-secret';
  const signedLaunch='vk_app_id=54754579&vk_user_id=42';
  const vkSignature=require('node:crypto').createHmac('sha256',vkSecret).update(signedLaunch).digest('base64url');
  assert.strictEqual(await leaderboard.verifiedVKId(signedLaunch+'&sign='+vkSignature,vkSecret),'42','signed VK identity must be verified');
  assert.strictEqual(await leaderboard.verifiedVKId('vk_app_id=54754579&vk_user_id=43&sign='+vkSignature,vkSecret),null,'tampered VK user ID must be rejected');
  assert.strictEqual(await leaderboard.verifiedVKId('vk_app_id=54754580&vk_user_id=42&sign='+vkSignature,vkSecret),null,'VK app ID must match RPChess');
  // Browser CORS is limited to our exact game hosts; a different VK Mini App
  // must not be able to send cross-origin authenticated leaderboard requests.
  const allowedOrigins='https://mobigametim-bit.github.io,https://rpchess-race-pieces-preview.mobigametim.workers.dev';
  for(const origin of [
    'https://mobigametim-bit.github.io',
    'https://rpchess-race-pieces-preview.mobigametim.workers.dev',
    'https://stage-app54754579-2ccfb72929d1.pages.vk-apps.ru',
    'https://prod-app54754579-candidate.pages.vk-apps.com'
  ]){
    assert.strictEqual(leaderboard.trustedOrigin(origin,allowedOrigins),true,`RPChess origin rejected: ${origin}`);
    const preflight=await leaderboard.handler(new Request('https://api.example.test/v1/leaderboard/view',{
      method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}
    }),{ALLOWED_ORIGINS:allowedOrigins});
    assert.strictEqual(preflight.status,204);
    assert.strictEqual(preflight.headers.get('access-control-allow-origin'),origin,'VK mobile POST must pass CORS preflight');
    assert(preflight.headers.get('access-control-allow-methods').includes('POST'));
  }
  for(const origin of [
    'https://stage-app54754580-abcd.pages.vk-apps.ru',
    'https://app547545790.pages.vk-apps.com',
    'https://rpchess-race-pieces-preview.mobigametim.workers.dev.evil.test',
    'http://stage-app54754579-abcd.pages.vk-apps.ru',
    'https://evil.example'
  ]){
    assert.strictEqual(leaderboard.trustedOrigin(origin,allowedOrigins),false,`Untrusted origin accepted: ${origin}`);
    const rejected=await leaderboard.handler(new Request('https://api.example.test/v1/leaderboard',{headers:{Origin:origin}}),{ALLOWED_ORIGINS:allowedOrigins});
    assert.strictEqual(rejected.status,403,'Unexpected third-party site must not read the API');
  }

  // Glory v2 is profile-authenticated; anonymous VK reads must use only
  // the fresh public RPChess v3 board, never sign/submit the old score.
  const previousDocument=globalThis.document,previousFetch=globalThis.fetch;
  try{
    globalThis.document={querySelector:()=>({content:'https://rpchess-profile.example.test'})};
    const calls=[];
    globalThis.fetch=async(resource,options={})=>{
      calls.push({resource:String(resource),method:options.method||'GET'});
      return new Response(JSON.stringify({scoreVersion:2,
        top:[{rank:1,name:'New Journey',glory:147}],me:null}),{status:200});
    };
    const client=await import(url('js/leaderboard-client.mjs'));
    const result=await client.loadLeaderboard({force:true});
    assert.strictEqual(result.status,'ready');
    assert.strictEqual(result.top.length,1);
    assert.strictEqual(result.me,null,'no anonymous personal ranks');
    assert.deepStrictEqual(calls.map(call=>call.method),['GET'],
      'anonymous clients must never use the old signed VK leaderboard write API');
    assert(calls[0].resource.endsWith('/v1/leaderboard'));
    assert.strictEqual((await client.submitBestChronicle()).status,'unavailable',
      'only a verified RPChess profile may publish the new score');
    assert.strictEqual(client.signedLaunchQuery({vk_app_id:54754579,vk_user_id:42}),'',
      'unsigned VK identity remains untrusted');
  }finally{
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
    globalThis.fetch=previousFetch;
  }
  assert(ui.includes('leaderboard.notAuthenticated')&&ui.includes('leaderboard.notRanked'),
    'personal rank must distinguish unverified VK from authenticated players without a completed run');
  const translations=fs.readFileSync(path.join(game,'localization/runtime-ui.mjs'),'utf8');
  assert(translations.includes("'leaderboard.notAuthenticated':'Профиль не подтверждён'"),
    'Chronicle must use player-facing profile wording, not VK-specific legacy text');
  assert(translations.includes("'leaderboard.notAuthenticated':'Profile not verified'"),
    'English personal profile status must match the new verified identity wording');
  assert(translations.includes("'leaderboard.notRanked':'Нет результата'"));
  assert(fs.readFileSync(path.join(game,'../leaderboard-worker/src/index.mjs'),'utf8').includes('viewerAuthenticated:Boolean(id)'),
    'the API must distinguish verified users with no ranking from unsigned reads');

  // A locally finished Journey and a D1 rank are separate states.
  assert(ui.includes('leaderboard.syncConflict')&&ui.includes('leaderboard.syncPending')
    &&ui.includes('leaderboard.savedNotRanked'), 'Chronicle must distinguish sync failures from no rank');
  assert(ui.includes("retry.dataset.chronicleConflictRecovery=''")&&
    ui.includes('recoverCompletedChronicleRanking()'),
    'a verified conflicted Chronicle should offer explicit completed-run-only recovery');
  const conflictSource=fs.readFileSync(path.join(game,'js/profile-client.mjs'),'utf8');
  for(const contract of ['recoverCompletedChronicleRanking','status!==\'conflict\'',
    "request('/v1/profile')","method:'PUT'","revision:remote.revision",
    'history.length>=20',"error?.status===409","request('/v1/leaderboard/refresh'"])
    assert(conflictSource.includes(contract),'safe D1 conflict recovery missing '+contract);
  assert(translations.includes("'leaderboard.recoverBest':'Отправить лучший поход'")&&
    translations.includes("'leaderboard.recoverBest':'Publish best journey'"),
    'conflict recovery controls must be localized RU and EN');
  assert(ui.includes('retry.dataset.chronicleRankRetry')&&ui.includes('loadLeaderboard({force:true})'),
    'saved Journey should offer a no-replay leaderboard retry');
  const leaderboardClientSource=fs.readFileSync(path.join(game,'js/leaderboard-client.mjs'),'utf8');
  assert(leaderboardClientSource.includes('await pending;')&&
    leaderboardClientSource.includes('return loadLeaderboard({force:true});'),
    'explicit retry must not reuse an old in-flight leaderboard request');
  const profileClientSource=fs.readFileSync(path.join(game,'js/profile-client.mjs'),'utf8');
  assert(profileClientSource.includes('flushLatestChronicleForRanking')&&
    profileClientSource.includes('lastFingerprint===payloadFingerprint(localPayload())'),
    'profile leaderboard refresh must wait until the latest completed-run snapshot reaches D1');
  assert(translations.includes("'leaderboard.retry':'Повторить отправку'")
    &&translations.includes("'leaderboard.retry':'Retry upload'"),
    'rank recovery controls must be localized RU/EN');
  assert(ui.includes('chronicle-leaderboard-self')&&ui.includes('chronicle-leaderboard-list'));
  console.log('Player Identity, Chronicle, Great Commanders UI and server Glory checks: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
