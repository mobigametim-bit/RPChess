'use strict';

const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host-b9.cjs');

const HERO_IDS = Object.freeze([
  'hero.aldric_wall','hero.mara_chain','hero.brother_orell',
  'hero.vael_hammer','hero.lady_sorn','hero.tomas_gate'
]);

(async()=>{
  const host=createBrowserRunSelectionHost({
    seed:1,
    profileId:'profile-1',
    storage:new MemoryKeyValueStorage(),
    deviceId:'production-event-travel',
    stageB:true,
    forceNew:true,
    availableHeroIds:HERO_IDS
  });
  await host.dispatch({type:'SelectKing',kingId:'king.oathkeeper'});
  await host.dispatch({type:'SelectDoctrine',doctrineId:'doctrine.fortress'});
  await host.dispatch({type:'ToggleHero',heroId:'hero.aldric_wall'});
  await host.dispatch({type:'LockSelection'});
  const runtime=host.getRuntimeHost();
  let snapshot=runtime.getSnapshot();
  await runtime.dispatch({type:'ChooseDraftHero',heroId:snapshot.stageB.draft.heroOffers[0].id});
  snapshot=runtime.getSnapshot();
  await runtime.dispatch({type:'ChooseDraftRegular',regularId:snapshot.stageB.draft.regularOffers[0].id});
  await runtime.dispatch({type:'ConfirmDraft'});
  snapshot=runtime.getSnapshot();
  const route=snapshot.campaign.routes.find((entry)=>entry.type==='event');
  assert.ok(route,'seed 1 must expose a direct event route');
  assert.strictEqual(route.to,'l1_n2');
  await runtime.dispatch({type:'Travel',targetNodeId:route.to});
  snapshot=runtime.getSnapshot();
  assert.strictEqual(snapshot.status,'event','production event travel must enter the event UI state');
  assert.strictEqual(snapshot.event?.eventId,'event.cracked_bell');
  assert.ok(snapshot.event?.choices?.length>=2,'production event must expose choices');
  assert.strictEqual(runtime.getState().productionEvent?.state?.eventId,'event.cracked_bell');
  console.log('Production event browser travel: 1/1 passed.');
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
