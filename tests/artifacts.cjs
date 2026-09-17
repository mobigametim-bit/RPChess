const assert=require('assert');
const path=require('path');
const fs=require('fs');
const {pathToFileURL}=require('url');

(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const artifacts=await import(pathToFileURL(path.join(game,'js/artifact-core.mjs')).href);
  const persistence=await import(pathToFileURL(path.join(game,'js/run-persistence.mjs')).href);
  const settlement=await import(pathToFileURL(path.join(game,'js/settlement-core.mjs')).href);
  const engine=await import(pathToFileURL(path.join(game,'js/classic-chess-engine.mjs')).href);
  assert.strictEqual(artifacts.ARTIFACTS.length,3);
  const offerA=artifacts.deterministicArtifactOffer({seed:'artifact-test'}),offerB=artifacts.deterministicArtifactOffer({seed:'artifact-test'});
  assert.deepStrictEqual(offerA,offerB,'Settlement artifact offer must be deterministic');
  assert(offerA.charges>=1&&offerA.charges<=3);
  let run=persistence.createRun({id:'artifact-test',now:1});
  const choice={id:'settlement-1',seed:'artifact-test',type:'settlement',step:1,stars:1,label:'ПОСЕЛЕНИЕ',threatLabel:'НИЗКАЯ',flavor:'Тихий привал.',mechanicalHint:'Передышка.'};
  run={...run,activeTravelChoice:choice,currentSettlement:settlement.createSettlementState(run,choice),gold:500};
  const purchase=settlement.applyArtifactPurchase(run);
  assert(purchase.success,'offered artifact must be purchasable with gold');
  assert.strictEqual(purchase.run.currentSettlement.artifactOffer.sold,true);
  assert.strictEqual(artifacts.artifactCharges(purchase.run,purchase.artifact.id),purchase.chargesAdded);
  const selected=artifacts.applyCombatArtifactChoice(purchase.run,{combatType:'skirmish',encounterId:'skirmish-1',artifactId:purchase.artifact.id});
  assert(selected.success);
  assert.strictEqual(artifacts.artifactCharges(selected.run,purchase.artifact.id),Math.max(0,purchase.chargesAdded-1));
  const repeated=artifacts.applyCombatArtifactChoice(selected.run,{combatType:'skirmish',encounterId:'skirmish-1',artifactId:purchase.artifact.id});
  assert.strictEqual(repeated.reason,'already-chosen','same encounter selection must not consume a second charge');
  assert(persistence.isValidRun(selected.run),'artifact inventory and active combat choice must persist safely');
  const state=engine.parseFEN('4k3/8/8/8/2b5/8/4R3/4K3 w - - 0 1');
  assert.strictEqual(engine.countSquareAttackers(state,engine.squareToIndex('e2'),'b'),1,'one bishop must count as one attacker');
  const multi=engine.parseFEN('4k3/8/8/4q3/2b5/8/4R3/4K3 w - - 0 1');
  assert.strictEqual(engine.countSquareAttackers(multi,engine.squareToIndex('e2'),'b'),2,'bishop and queen must count separately');
  const ui=fs.readFileSync(path.join(game,'js/artifact-combat-ui.mjs'),'utf8'),css=fs.readFileSync(path.join(game,'css/artifacts.css'),'utf8'),battle=fs.readFileSync(path.join(game,'js/battle-app.mjs'),'utf8'),skirmish=fs.readFileSync(path.join(game,'js/skirmish-app.mjs'),'utf8');
  for(const source of [battle,skirmish]){assert(source.includes("chooseArtifact"),'both combat types must gate launch on artifact choice');assert(source.includes('renderThreatOverlay'),'both combat types must refresh threat overlay');}
  assert(ui.includes('classic-threat-fire')&&css.includes('pointer-events:none'),'overlay must remain non-interactive');
  console.log('Artifacts MVP core, charges, idempotent combat selection and threat counting: PASS');
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1});
