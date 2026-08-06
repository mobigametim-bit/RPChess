const assert = require('assert');
const {
  createStageBActState,
  chooseDraftHero,
  chooseDraftRegular,
  confirmDraft,
  createBattleBriefing,
  setBriefingRoster,
  confirmBriefing,
  generateRewardOffers,
  chooseRewardOffer,
  createServiceState,
  useService,
  applyBattleResults,
  chooseTalent,
  beginRoyalRetreat,
  completeRoyalRetreat,
  beginActOutcome,
  chooseActOutcome,
  updateReorganization,
  confirmReorganization,
  stageBSnapshot,
  restoreStageB,
  commandSpent
} = require('../src/runtime/stage-b-act.cjs');

const heroes = [
  { id: 'hero.aldric_wall', name: 'Альдрик Стена', pieceType: 'r', relicIds: ['relic.echo_shield'] },
  { id: 'hero.mara_chain', name: 'Мара Цепь', pieceType: 'p' },
  { id: 'hero.vael_hammer', name: 'Ваэль Молот', pieceType: 'n' },
  { id: 'hero.lady_sorn', name: 'Леди Сорн', pieceType: 'q' }
];
const army = { kingId: 'king.oathkeeper', doctrineId: 'doctrine.fortress', heroIds: ['hero.aldric_wall'], heroes };

function fresh() {
  return createStageBActState({ seed: 9042, act: 1, army, heroCatalog: heroes, preferredHeroId: 'hero.aldric_wall' });
}

let state = fresh();
assert.strictEqual(state.status, 'draft');
assert.strictEqual(state.draft.heroOffers.length, 3);
assert.strictEqual(state.draft.regularOffers.length, 4);
assert.strictEqual(state.draft.heroOffers[0].id, 'hero.aldric_wall');
state = chooseDraftHero(state, 'hero.aldric_wall');
state = chooseDraftRegular(state, state.draft.regularOffers[0].id);
state = confirmDraft(state);
assert.strictEqual(state.status, 'campaign');
assert.ok(state.roster.length >= 6 && state.roster.length <= 8);
assert.ok(state.roster.filter((entry) => entry.active).length >= 5);
assert.ok(commandSpent(state.roster) <= state.commandLimit);
assert.throws(() => chooseDraftHero(state, 'hero.mara_chain'), /closed/);

const briefingNode = { id: 'l1_n1', type: 'battle', danger: 2, intel: { missionType: 'удержание рубежа', enemyArchetypes: ['пехота', 'стрелки'], specialPieces: true, environment: 'укрепления', firstMove: 'enemy', rewardCategory: 'реликвия', risks: ['засада'] } };
state = createBattleBriefing(state, briefingNode, { objectives: ['Удержать ключевую клетку'], failures: ['Мат вашему королю'], board: { blockers: ['d4'] }, environment: [{ type: 'hazard', cells: ['e4'] }] });
assert.strictEqual(state.status, 'briefing');
assert.strictEqual(state.briefing.initiative, 'enemy');
assert.ok(state.briefing.dangerCells.includes('e4'));
assert.ok(state.briefing.blockedCells.includes('d4'));
const availableEntries = state.roster.filter((entry) => entry.available);
const kingId = availableEntries.find((entry) => entry.kind === 'king').id;
const activeIds = [kingId];
let spent = 0;
for (const entry of availableEntries.filter((item) => item.id !== kingId)) {
  const cost = ({ p: 1, n: 2, b: 2, r: 3, q: 5 }[entry.type] || 1);
  if (activeIds.length < state.activeLimit && spent + cost <= state.commandLimit) { activeIds.push(entry.id); spent += cost; }
}
state = setBriefingRoster(state, activeIds);
assert.ok(commandSpent(state.roster) <= state.commandLimit);
state = confirmBriefing(state);
assert.strictEqual(state.status, 'campaign');
assert.strictEqual(state.briefing.locked, true);

state = generateRewardOffers(state, { nodeId: 'l1_n1', sideObjectiveCompleted: true });
assert.strictEqual(state.status, 'reward_choice');
assert.strictEqual(state.pendingRewardOffers.length, 3);
assert.strictEqual(new Set(state.pendingRewardOffers.map((entry) => entry.type)).size, 3);
const picked = state.pendingRewardOffers[0];
state = chooseRewardOffer(state, picked.id, { nodeId: 'l1_n1' });
assert.strictEqual(state.status, 'campaign');
assert.strictEqual(state.rewardHistory.length, 1);

state = createServiceState(state, 'camp', { nodeId: 'l2_n1' });
assert.strictEqual(state.status, 'service');
const campOffer = state.service.offers.find((entry) => entry.action === 'grant_merit');
const heroId = state.roster.find((entry) => entry.kind === 'hero').id;
state = useService(state, campOffer.id, { gold: campOffer.cost, targetRosterId: heroId });
assert.strictEqual(state.status, 'campaign');
assert.ok(state.roster.find((entry) => entry.id === heroId).merits >= 2);

state = applyBattleResults(state, { victory: true, activeRosterIds: state.roster.filter((entry) => entry.active).map((entry) => entry.id), capturedRosterIds: [heroId], sideObjectiveCompleted: true });
const wounded = state.roster.find((entry) => entry.id === heroId);
assert.strictEqual(wounded.injury, 'heavy');
assert.strictEqual(wounded.available, false);
const talentEntry = state.roster.find((entry) => entry.talentChoices.length);
if (talentEntry) {
  const choice = talentEntry.talentChoices[0].options[0].id;
  state = chooseTalent(state, talentEntry.id, choice);
  assert.ok(state.roster.find((entry) => entry.id === talentEntry.id).talents.includes(choice));
}

state = beginRoyalRetreat(state, { nodeId: 'l4_n2', destinationNodeId: 'l6_n1', lossGold: 5, lossSupplies: 2 });
assert.strictEqual(state.status, 'retreat');
assert.strictEqual(state.royalRetreat.used, 1);
state = completeRoyalRetreat(state);
assert.strictEqual(state.status, 'campaign');
state = beginRoyalRetreat(state, { nodeId: 'l7_n1' });
assert.strictEqual(state.status, 'failed');

let victory = fresh();
victory = confirmDraft(chooseDraftRegular(chooseDraftHero(victory, 'hero.aldric_wall'), victory.draft.regularOffers[0].id));
victory = beginActOutcome(victory, { regionalRecruitId: 'hero.mara_chain' });
assert.strictEqual(victory.status, 'act_outcome');
victory = chooseActOutcome(victory, victory.actOutcome.choices[0].id);
assert.strictEqual(victory.status, 'reorganization');
assert.ok(victory.regionalRecruits.includes('hero.mara_chain'));
const reorgAvailable = victory.roster.filter((entry) => entry.available);
const active = [reorgAvailable.find((entry) => entry.kind === 'king').id];
let reorgSpent = 0;
for (const entry of reorgAvailable.filter((item) => item.kind !== 'king')) {
  const cost = ({ p: 1, n: 2, b: 2, r: 3, q: 5 }[entry.type] || 1);
  if (active.length < victory.activeLimit && reorgSpent + cost <= victory.commandLimit) { active.push(entry.id); reorgSpent += cost; }
}
victory = updateReorganization(victory, active);
victory = confirmReorganization(victory);
assert.strictEqual(victory.status, 'complete');
assert.deepStrictEqual(restoreStageB(stageBSnapshot(victory)), victory);

const deterministicA = stageBSnapshot(fresh());
const deterministicB = stageBSnapshot(fresh());
assert.deepStrictEqual(deterministicA, deterministicB);
console.log('Stage B act: draft, briefing, rewards, services, injuries, talents, retreat and reorganization passed.');
