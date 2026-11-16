/* Regression for opt-in GamePush VK ads. No live VK account/ad credentials.
 * Usage: node tests/gamepush-vk-ad-routing.cjs ready|failed|untrusted
 * One process per case ensures the SDK boot state cannot bleed between cases. */
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const mode=process.argv[2];
if(!['ready','failed','untrusted'].includes(mode))throw Error('Unknown ad case');

(async()=>{
  const listeners=new Map(),nativeCalls=[],sdkCalls=[];
  const on=(type,listener)=>{
    if(!listeners.has(type))listeners.set(type,new Set());
    listeners.get(type).add(listener);
  };
  const off=(type,listener)=>listeners.get(type)?.delete(listener);
  const event=(type,detail,source=null)=>({type,detail,source,
    data:detail,origin:'https://vk.com'});
  const emit=(type,value)=>{for(const handler of listeners.get(type)||[])handler(value);};
  const parent={
    postMessage(message){
      nativeCalls.push(message.handler);
      if(!message.params?.request_id)return;
      const answer={
        type:message.handler+'Result',
        data:{request_id:message.params.request_id,result:nextNativeResult,
          ...(message.handler==='SetSupportedHandlers'?{supportedHandlers:[
            'VKWebAppInit','VKWebAppCheckBannerAd','VKWebAppShowBannerAd',
            'VKWebAppHideBannerAd','VKWebAppShowNativeAds'
          ]}:{})}
      };
      queueMicrotask(()=>emit('message',event('message',answer,parent)));
    }
  };
  const realHost=mode!=='untrusted';
  globalThis.parent=parent;
  globalThis.location={
    search:'?vk_app_id=54754579&rpchess_gamepush=1',
    hostname:'rpchess-gamepush-preview.mobigametim.workers.dev'
  };
  globalThis.document={
    referrer:realHost?'https://vk.com/app54754579':'',
    hidden:false,visibilityState:'visible',
    addEventListener:on,
    removeEventListener:off,
    head:{
      appendChild(){
        queueMicrotask(()=>globalThis.onGPInit(fakeSDK));
      }
    },
    createElement(){return {remove(){}};}
  };
  globalThis.addEventListener=on;
  globalThis.removeEventListener=off;
  globalThis.dispatchEvent=evt=>{emit(evt.type,evt);return true;};
  globalThis.localStorage={getItem:()=>null,setItem(){}};
  globalThis.RPChessFeatureFlags={};
  let nextNativeResult=true,nextSDKResult=true;
  const fakeSDK={
    player:{
      ready:mode==='ready'?Promise.resolve():{then(_resolve,reject){reject(new Error('400 invalid player data userId not found'));}},
      id:mode==='ready'?1234:null,
      isLoggedIn:mode==='ready'
    },
    platform:{type:'VK_GAMES'},
    ads:{
      isRewardedAvailable:true,isFullscreenAvailable:true,isStickyAvailable:true,
      showSticky(){sdkCalls.push('sticky-show');return Promise.resolve();},
      closeSticky(){sdkCalls.push('sticky-hide');return Promise.resolve();},
      showRewardedVideo(){
        sdkCalls.push('reward');
        if(nextSDKResult==='error')return Promise.reject(Error('SDK declined'));
        return Promise.resolve(nextSDKResult);
      },
      showFullscreen(){
        sdkCalls.push('interstitial');
        if(nextSDKResult==='error')return Promise.reject(Error('SDK declined'));
        return Promise.resolve();
      }
    },
    on(){},
    gameStart(){return Promise.resolve();}
  };
  const module=await import(pathToFileURL(path.join(__dirname,'..','game/js/platform.mjs')).href);
  const {platform}=module;
  assert.equal(platform.gamepush.enabled,true);
  assert.equal(platform.ads.backend,'none','GP loading may not trigger a competing native ad call');
  assert.equal((await platform.ads.show('reward')).status,'unavailable');
  await platform.init();
  const ready=await platform.gamepush.init();
  if(mode==='ready'){
    assert.equal(ready,true);
    assert.equal(platform.ads.backend,'gamepush');
    assert.equal(platform.ads.diagnostics.backend,'gamepush');
    assert.equal(await platform.ads.check('reward'),true);
    assert.equal((await platform.ads.show('reward')).status,'completed');
    nextSDKResult=false;
    assert.equal((await platform.ads.show('reward')).status,'closed','cancel is not rewarded');
    nextSDKResult='error';
    assert.equal((await platform.ads.show('reward')).status,'error');
    nextSDKResult=true;
    assert.equal((await platform.ads.show('interstitial')).status,'completed');
    fakeSDK.ads.isRewardedAvailable=false;
    assert.equal((await platform.ads.show('reward')).status,'unavailable',
      'inventory exhaustion cannot switch to native ads');
    assert.deepEqual(sdkCalls,['reward','reward','reward','interstitial']);
    assert(!nativeCalls.includes('VKWebAppShowNativeAds'),
      'healthy GamePush must never dispatch the same ad through VK Bridge');
    assert.equal(await platform.ads.banner.check(),true);
    assert.equal((await platform.ads.banner.show()).status,'shown');
    assert.equal((await platform.ads.banner.show()).status,'shown','repeated same-scene shows must be idempotent');
    assert.equal(platform.ads.banner.backend,'gamepush');
    assert.equal((await platform.ads.banner.hide()).status,'hidden');
    assert.equal((await platform.ads.banner.hide()).status,'hidden');
    assert.deepEqual(sdkCalls.slice(-2),['sticky-show','sticky-hide'],
      'GamePush sticky should show and close once, without VK Bridge fallback');
    assert(!nativeCalls.includes('VKWebAppShowBannerAd'),'healthy GamePush must own its banners');
  }else if(mode==='failed'){
    assert.equal(ready,false,'VK SDK player auth failure must be reported');
    assert.equal(platform.gamepush.status,'unavailable');
    assert.equal(platform.ads.backend,'vk-bridge');
    assert.equal(platform.ads.diagnostics.vkHostConfirmed,true);
    nextNativeResult=true;
    assert.equal((await platform.ads.show('reward')).status,'completed');
    nextNativeResult=false;
    assert.notEqual((await platform.ads.show('reward')).status,'completed','false result never gives reward');
    assert.equal((await platform.ads.show('interstitial')).status,'error');
    assert.deepEqual(nativeCalls.filter(x=>x==='VKWebAppShowNativeAds').length,3);
    assert.equal(sdkCalls.length,0,'failed SDK is never called to show ads');
    nextNativeResult=true;
    assert.equal(await platform.ads.banner.check(),true);
    assert.equal((await platform.ads.banner.show()).status,'shown');
    assert.equal(platform.ads.banner.backend,'vk-bridge');
    assert.equal((await platform.ads.banner.hide()).status,'hidden');
    assert.equal(nativeCalls.filter(x=>x==='VKWebAppCheckBannerAd').length,1);
    assert.equal(nativeCalls.filter(x=>x==='VKWebAppShowBannerAd').length,1);
    assert.equal(nativeCalls.filter(x=>x==='VKWebAppHideBannerAd').length,1);
    nextNativeResult=false;
    assert.equal((await platform.ads.banner.show()).status,'unavailable',
      'a failed banner availability check must not show a placeholder');
    assert.equal(nativeCalls.filter(x=>x==='VKWebAppShowBannerAd').length,1,
      'unavailable inventory must not try a second banner show');
    await platform.ads.banner.hide();
  }else{
    assert.equal(ready,false);
    assert.equal(platform.ads.backend,'none','forged VK query alone is not a verified VK host');
    assert.equal((await platform.ads.show('reward')).status,'unavailable');
    assert.equal(nativeCalls.length,0,'an untrusted Web preview never receives VK-native ad calls');
    assert.equal(await platform.ads.banner.check(),false);
    assert.equal((await platform.ads.banner.show()).status,'unavailable');
    assert.equal(nativeCalls.length,0,'untrusted Web must not dispatch banner requests');
    await platform.ads.banner.hide();
  }
  // The same controller covers both Journey screens and calm menus, but
  // never combat, the Arena chessboard or a blocking dialog.
  const {chooseStickyScene}=await import(
    pathToFileURL(path.join(__dirname,'..','game/js/content/sticky-banner.mjs')).href);
  let view={dataset:{rebootFoundation:''},querySelector:()=>null};
  globalThis.innerWidth=1366;globalThis.innerHeight=768;
  globalThis.document.querySelector=()=>null;
  globalThis.document.querySelectorAll=()=>[view];
  for(const [dataset,expected] of [
    [{rebootFoundation:''},'menu'],[{rosterScreen:''},'roster'],
    [{settlementScreen:''},'settlement'],
    [{kingdomMapScreen:''},'journey-map'],
    [{travelChoiceScreen:''},'journey-choice']]){
    view.dataset=dataset;
    assert.equal(chooseStickyScene(),expected);
  }
  view.dataset={arenaScreen:''};
  view.querySelector=selector=>
    selector==='[data-arena-catalog]'?{hidden:false}:{hidden:true};
  assert.equal(chooseStickyScene(),'arena-catalog');
  view.querySelector=selector=>
    selector==='[data-arena-catalog]'?{hidden:true}:{hidden:false};
  assert.equal(chooseStickyScene(),null,'Arena battle must hide sticky');
  view.dataset={classicScreen:''};
  assert.equal(chooseStickyScene(),null,'chessboard must never be ad eligible');
  view.dataset={kingdomMapScreen:''};
  globalThis.document.querySelector=selector=>
    selector.includes('.reboot-modal')?{hidden:false}:null;
  assert.equal(chooseStickyScene(),null,'modals hide sticky even on the Journey map');
  globalThis.document.querySelector=()=>null;
  globalThis.innerHeight=490;
  assert.equal(chooseStickyScene(),null,'cramped landscape scenes must not be covered');

  const diag=JSON.stringify(platform.gamepush.diagnostics)+JSON.stringify(platform.ads.diagnostics);
  assert(!diag.includes('userId not found'),'SDK failure message must not leak into diagnostics');
  assert(!diag.includes('1234'),'SDK player ID must not leak into diagnostics');
  console.log('GAMEPUSH VK ADS '+mode.toUpperCase()+' PASS — one backend, conservative rewards, safe diagnostics');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
