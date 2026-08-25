'use strict';

const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host-b9.cjs');
const runtimeState = require('../src/campaign/runtime-state.cjs');

const HERO_IDS = Object.freeze([
  'hero.aldric_wall','hero.mara_chain','hero.brother_orell',
  'hero.vael_hammer','hero.lady_sorn','hero.tomas_gate'
]);

async function campaignForSeed(seed) {
  const host=createBrowserRunSelectionHost({
    seed,
    profileId:'profile-1',
    storage:new MemoryKeyValueStorage(),
    deviceId:`prisoners-fixture-${seed}`,
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
  return runtime.getState().campaign;
}

function contentId(campaign,nodeId){return campaign.materializedContentByNode?.[nodeId]?.contentId||campaign.graph.nodesById?.[nodeId]?.contentId||null;}

(async()=>{
  let found=null;
  for(let seed=1;seed<=600&&!found;seed+=1){
    let campaign=await campaignForSeed(seed);
    const opening=runtimeState.availableRoutes(campaign).find((route)=>route.node?.type==='event'&&contentId(campaign,route.to)==='event.disputed_standard');
    if(!opening) continue;
    const path=[opening.to];
    campaign=runtimeState.travelTo(campaign,opening.to);
    campaign=runtimeState.completeNode(campaign,opening.to,{rewardClaimed:true});
    for(let depth=0;depth<14;depth+=1){
      const routes=runtimeState.availableRoutes(campaign);
      if(!routes.length) break;
      const direct=routes.find((route)=>route.node?.type==='event'&&contentId(campaign,route.to)==='event.prisoners_pass');
      if(direct){path.push(direct.to);found={seed,startPath:[opening.to],followupPath:path.slice(1),fullPath:path};break;}
      const eventRoute=routes.find((route)=>route.node?.type==='event');
      const route=eventRoute||routes.find((entry)=>entry.node?.type!=='boss')||routes[0];
      if(route.node?.type==='boss') break;
      path.push(route.to);
      campaign=runtimeState.travelTo(campaign,route.to);
      campaign=runtimeState.completeNode(campaign,route.to,{rewardClaimed:true});
      if(campaign.secret?.pendingDecision) campaign=runtimeState.declineSecret(campaign);
    }
  }
  assert.ok(found,'no deterministic disputed_standard → prisoners_pass fixture found in 600 seeds');
  console.log('[prisoners-chain-fixture] '+JSON.stringify(found));
  console.log('Prisoners follow-up fixture finder: PASS');
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
