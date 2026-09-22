import { chess960BackRank, chess960Fen } from './chess960.mjs';
import { createBattlePlan, defaultBattleSelection, applyBattleOutcome } from './battle-core.mjs';
import { combatTheme, hashString } from './race-assets.mjs';
import { difficultyForStars, clampStars } from './encounter-difficulty.mjs';
import { seededRandom } from './travel-choice-core.mjs';
import { ARTIFACTS, artifactById } from './artifact-core.mjs';
import { RECRUIT_LIBRARY, recruitProfile } from './settlement-core.mjs';

export const CARAVAN_ICON = 'assets/doctrines/cavalry/emblem.png';
export const CARAVAN_BACKGROUND = 'assets/events/register-04/sky_khanate/storm_over_caravan.png';
const TYPES = { r:'rook', n:'knight', b:'bishop', q:'queen', k:'king', p:'pawn' };

export function createCaravanState(run, choice) {
  if (choice?.type !== 'caravan') throw new Error('Caravan route required');
  if (run.currentCaravan?.routeId === choice.id) return run.currentCaravan;
  const stars = clampStars(choice.stars), difficulty = difficultyForStars(stars);
  const encounter = { ...combatTheme({ seed:choice.seed, playerColor:choice.playerColor, raceTag:choice.enemyRaceTag }),
    id:choice.id, seed:choice.seed, stars, aiElo:difficulty.elo, tactic:difficulty.tactic, label:difficulty.label,
    positionIndex:hashString(`${choice.seed}:chess960`) % 960 };
  return { routeId:choice.id, encounter, phase:'preparation', selectedIds:defaultBattleSelection(run.roster), moves:[], offers:[], claimedReward:null };
}
export function createCaravanPlan(options) {
  const plan = createBattlePlan(options), rank = chess960BackRank(plan.encounter.positionIndex);
  function place(formation, color) {
    const queues = Object.fromEntries(Object.values(TYPES).map(type => [type, formation.filter(p => p.pieceType === type)]));
    return [...rank, ...'pppppppp'].map((code, i) => ({ ...queues[TYPES[code]].shift(), square:`${'abcdefgh'[i % 8]}${i < 8 ? (color === 'w' ? 1 : 8) : (color === 'w' ? 2 : 7)}` }));
  }
  return { ...plan, chess960:true, fen:chess960Fen(plan.encounter.positionIndex),
    playerFormation:place(plan.playerFormation, plan.playerColor), enemyFormation:place(plan.enemyFormation, plan.enemyColor) };
}
export function caravanRewardOffers(run, encounter) {
  const random = seededRandom(`${encounter.seed}:caravan:rewards`);
  const pick = list => list[Math.floor(random() * list.length)];
  const artifact = pick(ARTIFACTS);
  const pool = [
    { kind:'gold', amount:40 + encounter.stars * 10 },
    { kind:'supplies', amount:3 + Math.floor(encounter.stars / 3) },
    { kind:'artifact', artifactId:artifact.id, amount:1 + Math.floor(encounter.stars / 5) }
  ];
  const wounded = run.roster.filter(c => !c.isRunKing && c.status === 'wounded');
  if (wounded.length) pool.push({ kind:'healing', heroId:pick(wounded).id });
  const available = RECRUIT_LIBRARY.filter(c => !run.roster.some(member => member.id === c.id));
  if (available.length) pool.push({ kind:'hero', heroId:pick(available).id });
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3).map(reward => ({ ...reward, id:`${encounter.id}:reward:${reward.kind}` }));
}
export function finishCaravan(run, { capturedIds, status, plan }) {
  const state = run.currentCaravan;
  if (!state || state.phase !== 'combat' || !status?.over || plan.encounter.id !== state.routeId) return run;
  const outcome = applyBattleOutcome(run, { capturedIds, status, playerColor:plan.playerColor, participantIds:plan.participants, freeMercenaries:true });
  const lastCaravan = { ...outcome.lastBattle, encounterId:state.routeId, encounterStars:state.encounter.stars, playerColor:plan.playerColor, goldReward:0 };
  const next = { ...run, roster:outcome.roster, caravanCount:(run.caravanCount || 0) + 1, lastCaravan, combatArtifactChoice:null };
  const won = status?.type === 'checkmate' && status.winner === plan.playerColor;
  next.currentCaravan = { ...state, phase:won ? 'reward' : 'aftermath', status,
    offers:won ? caravanRewardOffers(next, state.encounter) : [] };
  return next;
}
export function claimCaravanReward(run, rewardId) {
  const state = run?.currentCaravan;
  if (!state || state.phase !== 'reward' || state.claimedReward) return { run, success:false };
  const reward = state.offers.find(r => r.id === rewardId);
  if (!reward) return { run, success:false };
  const next = { ...run };
  if (reward.kind === 'gold') next.gold += reward.amount;
  else if (reward.kind === 'supplies') next.supplies += reward.amount;
  else if (reward.kind === 'artifact') next.artifacts = { ...run.artifacts, [reward.artifactId]:(run.artifacts[reward.artifactId] || 0) + reward.amount };
  else if (reward.kind === 'healing') {
    if (!run.roster.some(c => c.id === reward.heroId && c.status === 'wounded' && !c.isRunKing)) return {run,success:false};
    next.roster = run.roster.map(c => c.id === reward.heroId ? { ...c, status:'healthy' } : c);
  } else if (reward.kind === 'hero') {
    if (!recruitProfile(reward.heroId) || run.roster.some(c => c.id === reward.heroId)) return {run,success:false};
    next.roster = [...run.roster, { ...recruitProfile(reward.heroId) }];
  } else return { run, success:false };
  next.currentCaravan = { ...state, phase:'aftermath', claimedReward:reward };
  next.lastCaravan = { ...run.lastCaravan, reward, goldReward:reward.kind === 'gold' ? reward.amount : 0 };
  return { run:next, success:true };
}
export function isCaravanState(state) {
  if (state == null) return true;
  const e = state.encounter;
  return Boolean(typeof state.routeId === 'string' && e?.id === state.routeId && typeof e.seed === 'string' &&
    Number.isInteger(e.positionIndex) && e.positionIndex >= 0 && e.positionIndex < 960 &&
    Number.isInteger(e.stars) && e.stars >= 1 && e.stars <= 12 && ['w','b'].includes(e.playerColor) &&
    ['preparation','artifact','combat','reward','aftermath'].includes(state.phase) &&
    Array.isArray(state.selectedIds) && state.selectedIds.every(id => typeof id === 'string') &&
    Array.isArray(state.moves) && state.moves.every(m => /^[a-h][1-8]$/.test(m.from) && /^[a-h][1-8]$/.test(m.to) && (!m.promotion || /^[qrbn]$/.test(m.promotion))) &&
    Array.isArray(state.offers) && state.offers.every(r => typeof r.id === 'string' &&
      (['gold','supplies'].includes(r.kind) ? Number.isInteger(r.amount) && r.amount > 0 :
       r.kind === 'artifact' ? Boolean(artifactById(r.artifactId)) && Number.isInteger(r.amount) && r.amount > 0 :
       ['hero','healing'].includes(r.kind) && typeof r.heroId === 'string')));
}
