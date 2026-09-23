import { seededRandom } from './travel-choice-core.mjs';

const ARTIFACTS = Object.freeze([
  Object.freeze({ id:'threat.defense', name:'Амулет чутья защиты', description:'Показывает угрозы вашим фигурам.', nameKey:'artifacts.threatDefense.name', descriptionKey:'artifacts.threatDefense.description', mode:'player', icon:'assets/artifacts/threat_sense/amulet_defense.png', pricePerCharge:18 }),
  Object.freeze({ id:'threat.attack', name:'Амулет чутья атаки', description:'Показывает угрозы фигурам противника.', nameKey:'artifacts.threatAttack.name', descriptionKey:'artifacts.threatAttack.description', mode:'enemy', icon:'assets/artifacts/threat_sense/amulet_attack.png', pricePerCharge:18 }),
  Object.freeze({ id:'threat.great', name:'Великий амулет чутья', description:'Показывает угрозы обеим армиям.', nameKey:'artifacts.threatGreat.name', descriptionKey:'artifacts.threatGreat.description', mode:'both', icon:'assets/artifacts/threat_sense/amulet_great.png', pricePerCharge:30 })
]);
const ARTIFACT_BY_ID = Object.freeze(Object.fromEntries(ARTIFACTS.map((artifact)=>[artifact.id,artifact])));
const FIRE_BY_THREAT = Object.freeze({ 1:'assets/artifacts/threat_sense/threat_fire_1_yellow.png', 2:'assets/artifacts/threat_sense/threat_fire_2_orange.png', 3:'assets/artifacts/threat_sense/threat_fire_3_plus_red.png' });

function artifactById(id){ return ARTIFACT_BY_ID[id] || null; }
function normalizeArtifacts(value){
  if(!value || typeof value!=='object' || Array.isArray(value)) return {};
  const result={};
  for(const [id,charges] of Object.entries(value)) if(artifactById(id) && Number.isInteger(charges) && charges>0) result[id]=charges;
  return result;
}
function isArtifactInventory(value){ return JSON.stringify(normalizeArtifacts(value))===JSON.stringify(value||{}); }
function artifactCharges(run,id){ return normalizeArtifacts(run?.artifacts)[id] || 0; }
function ownedArtifacts(run){ return ARTIFACTS.filter((artifact)=>artifactCharges(run,artifact.id)>0); }
function deterministicArtifactOffer({seed}={}){
  if(!seed) throw new Error('Artifact offer requires a settlement seed');
  const random=seededRandom(`${seed}:settlement:artifact`),artifact=ARTIFACTS[Math.floor(random()*ARTIFACTS.length)],charges=1+Math.floor(random()*3);
  return { id:artifact.id, charges, price:artifact.pricePerCharge*charges, sold:false };
}
function isArtifactOffer(value){ return Boolean(value&&typeof value==='object'&&artifactById(value.id)&&Number.isInteger(value.charges)&&value.charges>=1&&value.charges<=3&&Number.isInteger(value.price)&&value.price>0&&typeof value.sold==='boolean'); }
function applyArtifactPurchase(run){
  const offer=run?.currentSettlement?.artifactOffer;
  if(!isArtifactOffer(offer)) return {run,success:false,spent:0,reason:'no-offer'};
  if(offer.sold) return {run,success:false,spent:0,reason:'sold-out'};
  if((run.gold||0)<offer.price) return {run,success:false,spent:0,reason:'insufficient-gold'};
  const artifacts=normalizeArtifacts(run.artifacts);
  artifacts[offer.id]=(artifacts[offer.id]||0)+offer.charges;
  return {run:{...run,gold:run.gold-offer.price,artifacts,currentSettlement:{...run.currentSettlement,artifactOffer:{...offer,sold:true}}},success:true,spent:offer.price,chargesAdded:offer.charges,artifact:artifactById(offer.id),reason:'purchased'};
}
function isCombatArtifactChoice(value){ return value===null || Boolean(value&&typeof value==='object'&&['battle','skirmish','caravan'].includes(value.combatType)&&typeof value.encounterId==='string'&&value.encounterId&&((value.artifactId===null)||Boolean(artifactById(value.artifactId)))); }
function applyCombatArtifactChoice(run,{combatType,encounterId,artifactId=null}={}){
  if(!run || !['battle','skirmish','caravan'].includes(combatType) || !encounterId || !isCombatArtifactChoice({combatType,encounterId,artifactId})) return {run,success:false,reason:'invalid-choice',choice:null};
  const existing=run.combatArtifactChoice;
  if(existing?.combatType===combatType&&existing.encounterId===encounterId) return {run,success:true,reason:'already-chosen',choice:existing};
  const artifacts=normalizeArtifacts(run.artifacts);
  if(artifactId){
    if(!artifacts[artifactId]) return {run,success:false,reason:'no-charges',choice:null};
    artifacts[artifactId]-=1; if(!artifacts[artifactId]) delete artifacts[artifactId];
  }
  const choice={combatType,encounterId,artifactId};
  return {run:{...run,artifacts,combatArtifactChoice:choice},success:true,reason:'chosen',choice};
}
function clearCombatArtifactChoice(run){ return run ? {...run,combatArtifactChoice:null} : run; }
function artifactForCombat(run,{combatType,encounterId}={}){ const choice=run?.combatArtifactChoice; return choice?.combatType===combatType&&choice.encounterId===encounterId&&choice.artifactId?artifactById(choice.artifactId):null; }

export { ARTIFACTS, FIRE_BY_THREAT, artifactById, artifactCharges, ownedArtifacts, normalizeArtifacts, isArtifactInventory, deterministicArtifactOffer, isArtifactOffer, applyArtifactPurchase, isCombatArtifactChoice, applyCombatArtifactChoice, clearCombatArtifactChoice, artifactForCombat };
