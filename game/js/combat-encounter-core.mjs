// Shared Battle/Skirmish encounter contract. Preserve the existing hash and
// Event-over-Travel priority: IDs and seeds are persisted by combat checkpoints.
import { combatTheme } from './race-assets.mjs';

function hashSeed(input){let h=2166136261;for(const c of String(input)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function validEncounterOverride(value,expectedType){return Boolean(value&&value.type===expectedType&&value.seed);}
function takeTravelEncounterOverride(expectedType){
  if(typeof globalThis==='undefined')return null;
  const eventOverride=globalThis.RPChessEvents?.state?.combat;
  const travelOverride=globalThis.RPChessTravelEncounterOverride;
  const o=validEncounterOverride(eventOverride,expectedType)?eventOverride:(validEncounterOverride(travelOverride,expectedType)?travelOverride:null);
  if(!o)return null;
  try{delete globalThis.RPChessTravelEncounterOverride;}catch{globalThis.RPChessTravelEncounterOverride=null;}
  return o;
}

function resolveCombatTheme(resolvedSeed,o){
  const generatedTheme=combatTheme({seed:resolvedSeed,raceTag:o?.enemyRaceTag||null,playerColor:o?.playerColor,mixed:Boolean(o?.mixedArmy)});
  const theme={...generatedTheme,...(o?.enemyRoleRaces?{enemyRoleRaces:o.enemyRoleRaces}:{}),...(o?.enemyRaceTag?{enemyRaceTag:o.enemyRaceTag}:{}),...(o?.sideNarrative?{sideNarrative:o.sideNarrative}:{})};
  return theme;
}

export {hashSeed,takeTravelEncounterOverride,resolveCombatTheme};
