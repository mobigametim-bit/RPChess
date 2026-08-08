'use strict';

const assert = require('assert');
const { MemoryKeyValueStorage } = require('../src/save/storage.cjs');
const { createBrowserRunSelectionHost } = require('../src/browser/iron-marches-browser-host-b9.cjs');
const runtimeState = require('../src/campaign/runtime-state.cjs');
const eventSource = require('../content/events/iron_marches_production.json');

const EVENT_IDS = eventSource.events.map((event) => event.id).sort();
const MAX_SEED = 350;

async function startCampaign(seed, preferredDraftHeroId = null) {
  const host = createBrowserRunSelectionHost({
    seed,
    profileId:'profile-1',
    storage:new MemoryKeyValueStorage(),
    deviceId:`target-fixture-${seed}-${preferredDraftHeroId || 'default'}`,
    stageB:true,
    availableHeroIds:['hero.aldric_wall','hero.mara_chain','hero.vael_hammer']
  });
  await host.dispatch({ type:'SelectKing', kingId:'king.oathkeeper' });
  await host.dispatch({ type:'SelectDoctrine', doctrineId:'doctrine.fortress' });
  await host.dispatch({ type:'ToggleHero', heroId:'hero.aldric_wall' });
  await host.dispatch({ type:'LockSelection' });
  const runtime = host.getRuntimeHost();
  let snapshot = runtime.getSnapshot();
  const heroOffer = snapshot.stageB.draft.heroOffers.find((entry)=>entry.id === preferredDraftHeroId) || snapshot.stageB.draft.heroOffers[0];
  await runtime.dispatch({ type:'ChooseDraftHero', heroId:heroOffer.id });
  snapshot = runtime.getSnapshot();
  await runtime.dispatch({ type:'ChooseDraftRegular', regularId:snapshot.stageB.draft.regularOffers[0].id });
  await runtime.dispatch({ type:'ConfirmDraft' });
  return runtime;
}

function campaignWithPlanningResources(campaign) {
  return Object.freeze({ ...campaign, supplies:99, gold:999 });
}

function routeContent(campaign, route) {
  return campaign.materializedContentByNode?.[route.to] || null;
}

function serviceType(campaign, route) {
  const node = campaign.graph.nodesById[route.to];
  if (['shop','hospital','forge','camp'].includes(node?.type)) return node.type;
  const entry = routeContent(campaign, route);
  return entry?.details?.serviceType || entry?.serviceType || null;
}

function discoverAlongGreedyPath(initialCampaign, seed, fixtures) {
  let campaign = campaignWithPlanningResources(initialCampaign);
  const path = [];
  for (let depth=0; depth<12; depth+=1) {
    const routes = runtimeState.availableRoutes(campaign).slice().sort((a,b)=>a.to.localeCompare(b.to));
    if (!routes.length) break;
    for (const route of routes) {
      const entry = routeContent(campaign, route);
      if (entry?.type === 'event' && EVENT_IDS.includes(entry.contentId) && !fixtures.events[entry.contentId]) {
        fixtures.events[entry.contentId] = { seed, path:[...path, route.to] };
      }
      const type = serviceType(campaign, route);
      if (['forge','camp'].includes(type) && !fixtures.services[type]) fixtures.services[type] = { seed, path:[...path, route.to], type };

      if (!fixtures.secret) {
        try {
          let probe = runtimeState.travelTo(campaign, route.to);
          probe = runtimeState.completeNode(probe, route.to, { rewardClaimed:true });
          probe = runtimeState.checkSecretAfterNode(probe, route.to);
          if (probe.secret?.pendingDecision) fixtures.secret = { seed, path:[...path, route.to] };
        } catch (_error) {}
      }
    }

    const nonBoss = routes.filter((route)=>campaign.graph.nodesById[route.to]?.type !== 'boss');
    const eventRoute = nonBoss.find((route)=>routeContent(campaign, route)?.type === 'event');
    const chosen = eventRoute || nonBoss[0] || routes[0];
    const chosenNode = campaign.graph.nodesById[chosen.to];
    if (chosenNode?.type === 'boss') break;
    campaign = runtimeState.travelTo(campaign, chosen.to);
    path.push(chosen.to);
    campaign = runtimeState.completeNode(campaign, chosen.to, { rewardClaimed:true });
    campaign = runtimeState.checkSecretAfterNode(campaign, chosen.to);
    if (campaign.secret?.pendingDecision) {
      if (!fixtures.secret) fixtures.secret = { seed, path:path.slice() };
      campaign = runtimeState.decideSecret(campaign, 'decline');
    }
  }
}

async function findPieceFixture(type, preferredDraftHeroId = null) {
  for (let seed=1; seed<=MAX_SEED; seed+=1) {
    const runtime = await startCampaign(seed, preferredDraftHeroId);
    let snapshot = runtime.getSnapshot();
    const battleRoute = snapshot.campaign.routes.find((route)=>['battle','elite'].includes(route.type));
    if (!battleRoute) continue;
    await runtime.dispatch({ type:'Travel', targetNodeId:battleRoute.to });
    snapshot = runtime.getSnapshot();
    if (snapshot.status !== 'briefing') continue;
    await runtime.dispatch({ type:'ConfirmBriefing' });
    snapshot = runtime.getSnapshot();
    if (snapshot.status !== 'deployment' || !snapshot.deployment?.canConfirm) continue;
    await runtime.dispatch({ type:'ConfirmDeployment' });
    snapshot = runtime.getSnapshot();
    if (snapshot.status !== 'scenario') continue;
    const bySquare = new Map((snapshot.scenario.pieces || []).map((piece)=>[piece.square,piece]));
    const command = (snapshot.scenario.legalCommands || []).find((candidate)=>candidate.type === 'MovePiece' && bySquare.get(candidate.payload.from)?.type === type);
    if (command) return { seed, path:[battleRoute.to], move:command.payload, scenarioId:snapshot.scenario.scenarioId, draftHeroId:preferredDraftHeroId };
  }
  return null;
}

(async()=>{
  const fixtures = { events:{}, services:{}, secret:null, pieces:{} };
  for (let seed=1; seed<=MAX_SEED; seed+=1) {
    const runtime = await startCampaign(seed);
    discoverAlongGreedyPath(runtime.getState().campaign, seed, fixtures);
    const completeEvents = EVENT_IDS.every((id)=>fixtures.events[id]);
    if (completeEvents && fixtures.services.forge && fixtures.services.camp && fixtures.secret) break;
  }
  fixtures.pieces.pawn = await findPieceFixture('p', 'hero.mara_chain');
  fixtures.pieces.knight = await findPieceFixture('n', 'hero.vael_hammer');

  console.log('[target-fixtures]');
  console.log(JSON.stringify(fixtures,null,2));
  for (const id of EVENT_IDS) assert.ok(fixtures.events[id], `missing deterministic path for ${id}`);
  assert.ok(fixtures.services.forge, 'missing forge fixture');
  assert.ok(fixtures.services.camp, 'missing camp fixture');
  assert.ok(fixtures.secret, 'missing secret fixture');
  assert.ok(fixtures.pieces.pawn, 'missing pawn move fixture');
  assert.ok(fixtures.pieces.knight, 'missing knight move fixture');
  console.log('Iron Marches targeted fixture plan: PASS');
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
