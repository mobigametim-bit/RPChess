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
  for(const artifact of artifacts.ARTIFACTS)assert(artifact.nameKey&&artifact.descriptionKey,'each artifact must expose localization keys');
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
  assert(ui.includes("modal.addEventListener('click'")&&ui.includes("event.preventDefault();finishChoice"),'artifact cards must use guarded capture delegation');
  const transition=ui.slice(ui.indexOf('const finishChoice='),ui.indexOf('// Capture delegation'));
  assert(transition.indexOf('onChoose?.')<transition.indexOf('modal.remove()'),'artifact modal must close only after the combat launch callback succeeds');
  assert(ui.includes("t('artifacts.choice.failed')")&&css.includes('.artifact-choice-status'),'failed combat launch must stay retryable and visible');
  // DOM regression: same position, newly rendered cells (selection / thinking / animation).
  const {chooseArtifact,renderThreatOverlay}=await import(pathToFileURL(path.join(game,'js/artifact-combat-ui.mjs')).href);
  class FakeElement{
    constructor(tag){this.tag=tag;this.dataset={};this.attributes={};this.children=[];this.listeners={};this.hidden=false;this.removed=false;this.disabled=false;this.className='';this.classList={values:new Set(),add:(name)=>this.classList.values.add(name),remove:(name)=>this.classList.values.delete(name)};}
    set innerHTML(value){this.html=value;if(this.dataset.artifactChoiceModal!==undefined){this.status=new FakeElement('div');this.status.hidden=true;this.grid=new FakeElement('div');}}
    setAttribute(name,value){this.attributes[name]=String(value);}
    querySelector(selector){if(selector==='.artifact-choice-grid')return this.grid||null;if(selector==='[data-artifact-choice-status]')return this.status||null;if(selector==='button')return this.grid?.children[0]||null;return null;}
    querySelectorAll(selector){return selector==='[data-artifact-choice]'?this.children:[];}
    append(...nodes){this.children.push(...nodes);}
    addEventListener(type,listener){this.listeners[type]=listener;}
    contains(node){return node===this||this.grid?.children.includes(node)||false;}
    closest(selector){return selector==='[data-artifact-choice]'&&this.dataset.artifactChoice!==undefined?this:null;}
    focus(){this.focused=true;}
    remove(){this.removed=true;}
  }
  const choiceClasses=new Set(),choiceDocument={
    modal:null,head:{append(){}},body:{classList:{add:(name)=>choiceClasses.add(name),remove:(name)=>choiceClasses.delete(name)},append(node){choiceDocument.modal=node;}},
    querySelector(){return null;},createElement(tag){return new FakeElement(tag);}
  };
  const choicePreviousDocument=globalThis.document;
  globalThis.document=choiceDocument;
  try{
    let chosenRun=null;
    chooseArtifact({run:purchase.run,combatType:'skirmish',encounterId:'skirmish-dom',onChoose:(next)=>{chosenRun=next;}});
    const modal=choiceDocument.modal,artifactButton=modal.grid.children[0];let prevented=false;
    modal.listeners.click({target:artifactButton,preventDefault(){prevented=true;}});
    assert(prevented&&modal.removed&&!choiceClasses.has('reboot-modal-open'),'owned artifact click must close the modal after launch');
    assert.strictEqual(artifacts.artifactCharges(chosenRun,purchase.artifact.id),Math.max(0,purchase.chargesAdded-1),'owned artifact click must consume one charge');
    const previousConsoleError=console.error;console.error=()=>{};
    try{
      chooseArtifact({run:purchase.run,combatType:'skirmish',encounterId:'skirmish-dom-failure',onChoose:()=>{throw new Error('launch failed');}});
      const failedModal=choiceDocument.modal;failedModal.listeners.click({target:failedModal.grid.children[0],preventDefault(){}});
      assert(!failedModal.removed&&!failedModal.status.hidden&&failedModal.status.textContent,'failed launch must keep a visible retryable modal');
      assert(failedModal.grid.children.every(button=>!button.disabled),'failed launch must re-enable every choice');
    }finally{console.error=previousConsoleError;}
  }finally{if(choicePreviousDocument===undefined)delete globalThis.document;else globalThis.document=choicePreviousDocument;}
  let mutations=0;
  const cells=new Map();
  const makeCell=square=>({dataset:{square},children:[],querySelectorAll(){return this.children;},append(node){node.parent=this;this.children.push(node);mutations++;}});
  function rebuild(){cells.clear();for(let i=0;i<64;i++){const square=engine.indexToSquare(i);cells.set(square,makeCell(square));}}
  const board={querySelectorAll(){return [...cells.values()];}};
  const previousDocument=globalThis.document;
  globalThis.document={createElement(){return {dataset:{},attrs:{},getAttribute(k){return this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;mutations++;},remove(){this.parent.children=this.parent.children.filter(n=>n!==this);mutations++;}};}};
  try {
    for(const color of ['w','b']){
      const artifact={mode:color==='w'?'player':'enemy'};
      rebuild();renderThreatOverlay(board,state,artifact,color);
      assert.strictEqual(cells.get('e2').children[0]?.dataset.attackers,'1');
      const stable=mutations;renderThreatOverlay(board,state,artifact,color);
      assert.strictEqual(mutations,stable,'observer reconciliation must reach a mutation-free fixed point');
      rebuild();renderThreatOverlay(board,state,artifact,color);
      assert.strictEqual(cells.get('e2').children.length,1,'same FEN after board replacement must restore fire');
      renderThreatOverlay(board,multi,artifact,color);
      assert.strictEqual(cells.get('e2').children[0]?.dataset.attackers,'2','new attack count must replace level');
      renderThreatOverlay(board,state,null,color);
      assert.strictEqual([...cells.values()].flatMap(c=>c.children).length,0,'no artifact must remove all fires');
    }
  } finally {if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
  for(const source of [battle,skirmish]){
    const launch=source.slice(source.indexOf('function launchBattle'),source.indexOf('function startBattle'));
    assert(launch.indexOf("new CustomEvent('rpchess:combat-started'")>launch.indexOf('newGame('),'combat lifecycle must fire after the delayed actual board launch');
  }
  const finalUi=fs.readFileSync(path.join(game,'js/ui-redesign-final.mjs'),'utf8');
  assert(finalUi.includes("addEventListener('rpchess:combat-started',schedule)"),'combat classes / HUD must refresh after artifact choice');
  const vm=require('vm'),listeners=new Map(),classes=new Map(),frames=[];
  const classicScreen={hidden:true};
  const context={readRun:()=>null,PIECE_GLYPHS:{},subscribe:()=>{},matchMedia:()=>({matches:true}),
    requestAnimationFrame:fn=>frames.push(fn),queueMicrotask:fn=>fn(),
    addEventListener:(name,fn)=>listeners.set(name,fn),
    document:{readyState:'loading',addEventListener:()=>{},querySelectorAll:()=>[],
      querySelector:selector=>selector==='[data-classic-screen]'?classicScreen:selector.endsWith('-css]')?{}:null,
      body:{classList:{toggle:(name,enabled)=>classes.set(name,enabled)}}}};
  vm.createContext(context);
  vm.runInContext(finalUi.replace(/^import .*;\n/gm,''),context);
  for(const kind of ['Battle','Skirmish']){
    context.RPChessBattle=null;context.RPChessSkirmish=null;
    context[`RPChess${kind}`]={battlePlan:{}};classicScreen.hidden=false;
    listeners.get('rpchess:combat-started')();frames.splice(0).forEach(fn=>fn());
    assert.strictEqual(classes.get('compact-combat-active'),true,'delayed combat launch must restore the main layout');
    assert.strictEqual(classes.get('run-combat-board-active'),true,'delayed combat launch must hide resources via the canonical CSS');
    classicScreen.hidden=true;listeners.get('rpchess:combat-completed')();frames.splice(0).forEach(fn=>fn());
    assert.strictEqual(classes.get('run-combat-board-active'),false,'leaving combat must release combat presentation');
  }
  const market=fs.readFileSync(path.join(game,'js/settlement-app.mjs'),'utf8');
  assert.strictEqual((market.match(/marketProductCard\(\{/g)||[]).length,3,'supplies and artifacts must use the same card renderer');
  assert(!market.includes('class="settlement-supply-card"'),'market must no longer use the legacy one-product row layout');
  console.log('Artifacts MVP core, charges, idempotent combat selection and threat counting: PASS');
})().catch((error)=>{console.error(error.stack||error);process.exitCode=1});
