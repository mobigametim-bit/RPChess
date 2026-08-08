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
    seed:3,
    profileId:'profile-1',
    storage:new MemoryKeyValueStorage(),
    deviceId:'stage-b-deployment-roster',
    stageB:true,
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
  const knightOffer=snapshot.stageB.draft.regularOffers.find((entry)=>entry.type==='n');
  assert.ok(knightOffer,'seed 3 must expose a knight regular draft offer');
  await runtime.dispatch({type:'ChooseDraftRegular',regularId:knightOffer.id});
  await runtime.dispatch({type:'ConfirmDraft'});
  snapshot=runtime.getSnapshot();
  const draftedKnight=snapshot.stageB.roster.find((entry)=>entry.kind==='regular'&&entry.type==='n'&&entry.source==='draft');
  assert.ok(draftedKnight,'confirmed Stage B roster must contain the drafted knight');
  assert.strictEqual(draftedKnight.active,false,'Fortress default command budget should initially leave this knight in reserve');
  const battleRoute=snapshot.campaign.routes.find((route)=>['battle','elite'].includes(route.type));
  assert.ok(battleRoute,'opening campaign must expose a battle route');
  await runtime.dispatch({type:'Travel',targetNodeId:battleRoute.to});
  snapshot=runtime.getSnapshot();
  assert.strictEqual(snapshot.status,'briefing');
  await runtime.dispatch({type:'ConfirmBriefing'});
  snapshot=runtime.getSnapshot();
  assert.strictEqual(snapshot.status,'deployment');
  assert.strictEqual(snapshot.deployment.commandLimit,snapshot.stageB.commandLimit,'deployment must use the Stage B army command limit');
  let knight=snapshot.deployment.units.find((unit)=>unit.type==='n'&&unit.metadata?.stageBRosterId===draftedKnight.id);
  assert.ok(knight,'drafted knight must remain available to the pre-battle deployment roster');
  assert.strictEqual(knight.inReserve,true,'inactive drafted knight should enter deployment as reserve until the player places it');
  assert.strictEqual(knight.source,'reserve');
  const occupied=new Set(snapshot.deployment.units.map((unit)=>unit.square).filter(Boolean));
  const target=snapshot.deployment.zone.find((square)=>!occupied.has(square));
  assert.ok(target,'deployment must expose a free square for the drafted knight');
  assert.ok(snapshot.deployment.commandSpent+knight.commandCost<=snapshot.deployment.commandLimit,'Stage B limit must leave legal budget for the reserve knight');
  await runtime.dispatch({type:'PlaceDeploymentUnit',unitId:knight.id,square:target});
  snapshot=runtime.getSnapshot();
  knight=snapshot.deployment.units.find((unit)=>unit.id===knight.id);
  assert.strictEqual(knight.square,target,'drafted knight must be placeable from reserve');
  assert.strictEqual(snapshot.deployment.commandSpent,knight.commandCost,'placing the reserve knight must spend its command cost');
  console.log('Stage B deployment roster availability: 2/2 passed.');
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1;});
