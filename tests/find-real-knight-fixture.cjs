'use strict';
const assert=require('assert');
const {MemoryKeyValueStorage}=require('../src/save/storage.cjs');
const {createBrowserRunSelectionHost}=require('../src/browser/iron-marches-browser-host-b9.cjs');
const HERO_IDS=['hero.aldric_wall','hero.mara_chain','hero.brother_orell','hero.vael_hammer','hero.lady_sorn','hero.tomas_gate'];

async function start(seed){
 const host=createBrowserRunSelectionHost({seed,profileId:'profile-1',storage:new MemoryKeyValueStorage(),deviceId:`real-knight-${seed}`,stageB:true,availableHeroIds:HERO_IDS});
 await host.dispatch({type:'SelectKing',kingId:'king.oathkeeper'});
 await host.dispatch({type:'SelectDoctrine',doctrineId:'doctrine.fortress'});
 await host.dispatch({type:'ToggleHero',heroId:'hero.aldric_wall'});
 await host.dispatch({type:'LockSelection'});
 const runtime=host.getRuntimeHost();
 let s=runtime.getSnapshot();
 await runtime.dispatch({type:'ChooseDraftHero',heroId:s.stageB.draft.heroOffers[0].id});
 s=runtime.getSnapshot();
 await runtime.dispatch({type:'ChooseDraftRegular',regularId:s.stageB.draft.regularOffers[0].id});
 await runtime.dispatch({type:'ConfirmDraft'});
 return runtime;
}

(async()=>{
 for(let seed=1;seed<=80;seed+=1){
   const runtime=await start(seed); let s=runtime.getSnapshot();
   const route=s.campaign.routes.find((r)=>['battle','elite'].includes(r.type));
   if(!route)continue;
   await runtime.dispatch({type:'Travel',targetNodeId:route.to}); s=runtime.getSnapshot();
   if(s.status!=='briefing')continue;
   await runtime.dispatch({type:'ConfirmBriefing'}); s=runtime.getSnapshot();
   if(s.status!=='deployment'||!s.deployment?.canConfirm)continue;
   await runtime.dispatch({type:'ConfirmDeployment'}); s=runtime.getSnapshot();
   if(s.status!=='scenario')continue;
   const bySquare=new Map((s.scenario.pieces||[]).map((p)=>[p.square,p]));
   const command=(s.scenario.legalCommands||[]).find((c)=>c.type==='MovePiece'&&bySquare.get(c.payload.from)?.type==='n');
   if(command){
     const fixture={seed,path:[route.to],move:command.payload,scenarioId:s.scenario.scenarioId,draftHeroId:s.stageB.draft.selectedHeroId,draftRegularId:s.stageB.draft.selectedRegularId};
     console.log('[real-knight-fixture] '+JSON.stringify(fixture));
     console.log('Real six-hero knight fixture: PASS');
     return;
   }
 }
 assert.fail('no real six-hero UI-equivalent knight fixture in seeds 1..80');
})().catch((e)=>{console.error(e.stack||e);process.exitCode=1;});
