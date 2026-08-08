'use strict';

const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host-b9.cjs');
const runtimeState = require('../src/campaign/runtime-state.cjs');
const eventSource = require('../content/events/iron_marches_production.json');

const HERO_IDS = Object.freeze([
  'hero.aldric_wall','hero.mara_chain','hero.brother_orell',
  'hero.vael_hammer','hero.lady_sorn','hero.tomas_gate'
]);
const EVENT_IDS = eventSource.events.map((event) => event.id).sort();

async function start(seed) {
  const host = createBrowserRunSelectionHost({
    seed,
    profileId:'profile-1',
    storage:new MemoryKeyValueStorage(),
    deviceId:`direct-fixture-${seed}`,
    stageB:true,
    availableHeroIds:HERO_IDS
  });
  await host.dispatch({ type:'SelectKing', kingId:'king.oathkeeper' });
  await host.dispatch({ type:'SelectDoctrine', doctrineId:'doctrine.fortress' });
  await host.dispatch({ type:'ToggleHero', heroId:'hero.aldric_wall' });
  await host.dispatch({ type:'LockSelection' });
  const runtime = host.getRuntimeHost();
  let snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type:'ChooseDraftHero', heroId:snapshot.stageB.draft.heroOffers[0].id });
  snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type:'ChooseDraftRegular', regularId:snapshot.stageB.draft.regularOffers[0].id });
  await runtime.dispatch({ type:'ConfirmDraft' });
  return runtime;
}

function serviceType(campaign, route) {
  const node = campaign.graph.nodesById[route.to];
  if (['shop','hospital','forge','camp'].includes(node?.type)) return node.type;
  const materialized = campaign.materializedContentByNode?.[route.to];
  return materialized?.details?.serviceType || materialized?.serviceType || null;
}

(async()=>{
  const found = { events:{}, services:{}, secret:null };
  for (let seed=1; seed<=500; seed+=1) {
    const runtime = await start(seed);
    const campaign = runtime.getState().campaign;
    const routes = runtimeState.availableRoutes(campaign);
    for (const route of routes) {
      const entry = campaign.materializedContentByNode?.[route.to];
      if (entry?.type === 'event' && EVENT_IDS.includes(entry.contentId) && !found.events[entry.contentId]) {
        found.events[entry.contentId] = { seed, path:[route.to] };
      }
      const type = serviceType(campaign, route);
      if (['forge','camp'].includes(type) && !found.services[type]) found.services[type] = { seed, path:[route.to], type };
      if (!found.secret) {
        try {
          let probe = runtimeState.travelTo(campaign, route.to);
          probe = runtimeState.completeNode(probe, route.to, { rewardClaimed:true });
          probe = runtimeState.checkSecretAfterNode(probe, route.to);
          if (probe.secret?.pendingDecision) found.secret = { seed, path:[route.to] };
        } catch (_error) {}
      }
    }
    if (EVENT_IDS.every((id)=>found.events[id]) && found.services.forge && found.services.camp && found.secret) break;
  }
  console.log('[direct-targeted-fixtures]');
  console.log(JSON.stringify(found,null,2));
  for (const id of EVENT_IDS) assert.ok(found.events[id], `missing direct-start fixture for ${id}`);
  assert.ok(found.services.forge, 'missing direct-start forge fixture');
  assert.ok(found.services.camp, 'missing direct-start camp fixture');
  assert.ok(found.secret, 'missing direct-start secret fixture');
  console.log('Direct-start targeted fixture finder: PASS');
})().catch((error)=>{ console.error(error.stack || error); process.exitCode=1; });
