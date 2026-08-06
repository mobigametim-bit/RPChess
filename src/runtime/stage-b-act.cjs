'use strict';

const { RngStreams, hash32 } = require('../core/determinism.cjs');

const STAGE_B_FORMAT = 'rpchess-stage-b-act';
const STAGE_B_SCHEMA_VERSION = 1;
const STAGE_B_STATUSES = Object.freeze(['draft', 'campaign', 'briefing', 'reward_choice', 'service', 'retreat', 'act_outcome', 'reorganization', 'complete', 'failed']);
const SERVICE_TYPES = Object.freeze(['shop', 'hospital', 'forge', 'camp']);
const REWARD_TYPES = Object.freeze(['relic', 'recruit', 'supplies', 'gold', 'heal', 'temporary', 'scouting', 'risky_event']);
const REGULAR_TYPES = Object.freeze(['p', 'n', 'b', 'r']);
const PIECE_NAMES = Object.freeze({ k: 'Король', q: 'Ферзь', r: 'Ладья', b: 'Слон', n: 'Конь', p: 'Пешка' });
const COMMAND_COSTS = Object.freeze({ k: 0, q: 5, r: 3, b: 2, n: 2, p: 1 });
const STAR_THRESHOLDS = Object.freeze({ regular: Object.freeze([3, 8, 14]), hero: Object.freeze([2, 6, 12]) });

const TALENT_PAIRS = Object.freeze({
  p: Object.freeze([
    Object.freeze([{ id: 'talent.pawn.steadfast', name: 'Стойкий строй', description: 'После выхода из резерва получает защиту до следующего хода.' }, { id: 'talent.pawn.vanguard', name: 'Передовой', description: 'Первый выход из резерва стоит на 1 приказ меньше.' }])
  ]),
  n: Object.freeze([
    Object.freeze([{ id: 'talent.knight.pathfinder', name: 'Следопыт', description: 'Перед боем раскрывает один тип опасности.' }, { id: 'talent.knight.raider', name: 'Налётчик', description: 'Первое взятие приносит 1 приказ.' }])
  ]),
  b: Object.freeze([
    Object.freeze([{ id: 'talent.bishop.warder', name: 'Хранитель линии', description: 'Начинает бой с усиленной защитой союзной линии.' }, { id: 'talent.bishop.seer', name: 'Провидец', description: 'Первое целевое разведывание в акте бесплатно.' }])
  ]),
  r: Object.freeze([
    Object.freeze([{ id: 'talent.rook.bulwark', name: 'Несокрушимый бастион', description: 'Первое тяжёлое ранение в акте становится лёгким.' }, { id: 'talent.rook.engineer', name: 'Полевой инженер', description: 'Кузница предлагает дополнительный вариант.' }])
  ]),
  q: Object.freeze([
    Object.freeze([{ id: 'talent.queen.command', name: 'Властный приказ', description: 'Максимум приказов увеличен на 1.' }, { id: 'talent.queen.diplomat', name: 'Военная дипломатия', description: 'Политические награды становятся выгоднее.' }])
  ]),
  k: Object.freeze([
    Object.freeze([{ id: 'talent.king.oath', name: 'Нерушимая клятва', description: 'Королевское отступление теряет меньше ресурсов.' }, { id: 'talent.king.standard', name: 'Живое знамя', description: 'Активные фигуры получают дополнительную заслугу после победы.' }])
  ])
});

function freezeArray(values) { return Object.freeze(values.slice()); }
function freezeObject(value) { return Object.freeze({ ...(value || {}) }); }
function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return value;
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stableId(value, label) { const id = String(value || ''); if (!id) throw new Error(`${label} is required`); return id; }
function unique(values) { return [...new Set(values)]; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function regularRecord(id, type, source = 'doctrine_core') {
  return Object.freeze({
    id,
    kind: 'regular',
    type,
    name: PIECE_NAMES[type] || type,
    source,
    active: false,
    reserve: true,
    available: true,
    injury: null,
    skipBattles: 0,
    criticalRisk: false,
    stars: 0,
    merits: 0,
    talentChoices: freezeArray([]),
    talents: freezeArray([]),
    relicIds: freezeArray([]),
    relicSlots: 0,
    battlesActive: 0,
    battlesReserve: 0
  });
}

function heroRecord(hero, source = 'draft') {
  const type = String(hero.pieceType || hero.type || 'p').slice(0, 1).toLowerCase();
  return Object.freeze({
    id: stableId(hero.id || hero.heroId, 'hero id'),
    kind: 'hero',
    type,
    name: String(hero.name || hero.label || hero.nameKey || hero.id),
    source,
    active: false,
    reserve: true,
    available: true,
    injury: null,
    skipBattles: 0,
    criticalRisk: false,
    stars: 0,
    merits: 0,
    talentChoices: freezeArray([]),
    talents: freezeArray([]),
    relicIds: freezeArray(hero.relicIds || []),
    relicSlots: 0,
    battlesActive: 0,
    battlesReserve: 0
  });
}

function kingRecord(army) {
  return Object.freeze({
    id: `army:${army?.kingId || 'king.oathkeeper'}`,
    contentId: army?.kingId || 'king.oathkeeper',
    kind: 'king',
    type: 'k',
    name: 'Хранитель Клятвы',
    source: 'crown',
    active: true,
    reserve: false,
    available: true,
    injury: null,
    skipBattles: 0,
    criticalRisk: false,
    stars: 0,
    merits: 0,
    talentChoices: freezeArray([]),
    talents: freezeArray([]),
    relicIds: freezeArray([]),
    relicSlots: 1,
    battlesActive: 0,
    battlesReserve: 0
  });
}

function doctrineCore(army) {
  const doctrineId = army?.doctrineId || 'doctrine.fortress';
  if (doctrineId === 'doctrine.fortress') return freezeArray([
    regularRecord('regular:fortress-pawn-1', 'p'),
    regularRecord('regular:fortress-pawn-2', 'p'),
    regularRecord('regular:fortress-rook', 'r')
  ]);
  return freezeArray([regularRecord('regular:core-pawn', 'p'), regularRecord('regular:core-knight', 'n'), regularRecord('regular:core-bishop', 'b')]);
}

function deterministicHeroOffers(seed, heroes, preferredHeroId) {
  const normalized = heroes.map((hero) => ({ ...hero, id: hero.id || hero.heroId })).filter((hero) => hero.id);
  const preferred = normalized.find((hero) => hero.id === preferredHeroId);
  const rest = normalized.filter((hero) => hero.id !== preferredHeroId);
  const rng = new RngStreams(seed).get('stage-b.draft.heroes');
  const chosen = [...(preferred ? [preferred] : []), ...rng.shuffle(rest)].slice(0, 3);
  return freezeArray(chosen.map((hero) => Object.freeze({ id: hero.id, name: hero.name || hero.label || hero.nameKey || hero.id, pieceType: hero.pieceType || hero.type || 'pawn', relicIds: freezeArray(hero.relicIds || []) })));
}

function deterministicRegularOffers(seed) {
  const rng = new RngStreams(seed).get('stage-b.draft.regular');
  return freezeArray(rng.shuffle(REGULAR_TYPES).map((type, index) => Object.freeze({ id: `draft-regular:${type}:${index + 1}`, type, name: PIECE_NAMES[type], commandCost: COMMAND_COSTS[type] })));
}

function createStageBActState(options = {}) {
  const seed = Number(options.seed || 1);
  const act = Number(options.act || 1);
  const army = options.army || {};
  const heroCatalog = options.heroCatalog || (army.heroes || []).map((hero) => ({ id: hero.heroId, pieceType: hero.pieceType, relicIds: hero.relicIds, name: hero.nameKey }));
  const preferredHeroId = options.preferredHeroId || army.heroIds?.[0] || heroCatalog[0]?.id || null;
  const heroOffers = deterministicHeroOffers(seed, heroCatalog, preferredHeroId);
  const regularOffers = deterministicRegularOffers(seed);
  const core = doctrineCore(army);
  const roster = [kingRecord(army), ...core];
  return deepFreeze({
    format: STAGE_B_FORMAT,
    schemaVersion: STAGE_B_SCHEMA_VERSION,
    seed,
    act,
    difficulty: String(options.difficulty || 'normal'),
    status: options.skipDraft ? 'campaign' : 'draft',
    commandLimit: Number(options.commandLimit || 6),
    activeLimit: Number(options.activeLimit || 6),
    draft: Object.freeze({
      heroOffers,
      regularOffers,
      selectedHeroId: options.skipDraft || options.preselectPreferredHero ? preferredHeroId : null,
      selectedRegularId: options.skipDraft ? regularOffers[0]?.id || null : null,
      confirmed: Boolean(options.skipDraft),
      doctrineCoreIds: freezeArray(core.map((entry) => entry.id)),
      crownBonus: Object.freeze({ supplies: 2, relicId: null, pieceId: null }),
      warning: 'После подтверждения состав и реликвии нельзя менять до завершения боя.'
    }),
    roster: freezeArray(roster),
    briefing: null,
    pendingRewardOffers: freezeArray([]),
    rewardHistory: freezeArray([]),
    service: null,
    royalRetreat: Object.freeze({ used: 0, maximum: options.difficulty === 'hard' ? 0 : 1, status: 'available', lostNodeId: null, destinationNodeId: null, consequences: freezeArray([]) }),
    actOutcome: null,
    reorganization: null,
    storyFlags: freezeArray([]),
    politicalChoices: freezeArray([]),
    regionalRecruits: freezeArray([]),
    temporaryEffects: freezeArray([]),
    economy: Object.freeze({ goldEarned: 0, goldSpent: 0, suppliesEarned: 2, suppliesSpent: 0, serviceVisits: 0 }),
    history: freezeArray([Object.freeze({ index: 0, type: 'stage_b_created', seed, act, preferredHeroId })])
  });
}

function assertStageB(state) {
  if (!state || state.format !== STAGE_B_FORMAT || state.schemaVersion !== STAGE_B_SCHEMA_VERSION) throw new Error('invalid Stage B act state');
  if (!STAGE_B_STATUSES.includes(state.status)) throw new Error(`invalid Stage B status: ${state.status}`);
  return state;
}

function append(state, type, payload, patch) {
  const record = Object.freeze({ index: state.history.length, type, payload: deepFreeze(clone(payload || {})) });
  return deepFreeze({ ...state, ...patch, history: freezeArray([...state.history, record]) });
}

function chooseDraftHero(stateInput, heroId) {
  const state = assertStageB(stateInput);
  if (state.status !== 'draft') throw new Error('hero draft is closed');
  if (!state.draft.heroOffers.some((offer) => offer.id === heroId)) throw new Error('hero is not in the deterministic draft offer');
  return append(state, 'draft_hero_selected', { heroId }, { draft: Object.freeze({ ...state.draft, selectedHeroId: heroId }) });
}

function chooseDraftRegular(stateInput, regularId) {
  const state = assertStageB(stateInput);
  if (state.status !== 'draft') throw new Error('regular-piece draft is closed');
  if (!state.draft.regularOffers.some((offer) => offer.id === regularId)) throw new Error('regular piece is not in the deterministic draft offer');
  return append(state, 'draft_regular_selected', { regularId }, { draft: Object.freeze({ ...state.draft, selectedRegularId: regularId }) });
}

function applyDefaultActiveRoster(roster, activeLimit) {
  let spent = 0;
  return roster.map((entry) => {
    const mandatory = entry.kind === 'king';
    const cost = COMMAND_COSTS[entry.type] || 1;
    const active = mandatory || (spent + cost <= activeLimit);
    if (active && !mandatory) spent += cost;
    return Object.freeze({ ...entry, active, reserve: !active });
  });
}

function confirmDraft(stateInput) {
  const state = assertStageB(stateInput);
  if (state.status !== 'draft') throw new Error('draft is not active');
  const heroOffer = state.draft.heroOffers.find((offer) => offer.id === state.draft.selectedHeroId);
  const regularOffer = state.draft.regularOffers.find((offer) => offer.id === state.draft.selectedRegularId);
  if (!heroOffer || !regularOffer) throw new Error('select one hero and one ordinary piece before confirming the draft');
  const roster = [...state.roster, heroRecord(heroOffer), regularRecord(`regular:draft-${regularOffer.type}`, regularOffer.type, 'draft')];
  if (roster.length < 6 || roster.length > 8) throw new Error('Stage B starting roster must contain 6–8 figures');
  const activeRoster = applyDefaultActiveRoster(roster, state.commandLimit);
  return append(state, 'draft_confirmed', { heroId: heroOffer.id, regularId: regularOffer.id }, {
    status: 'campaign',
    roster: freezeArray(activeRoster),
    draft: Object.freeze({ ...state.draft, confirmed: true }),
    economy: Object.freeze({ ...state.economy, suppliesEarned: state.economy.suppliesEarned + state.draft.crownBonus.supplies })
  });
}

function rosterEntry(state, id) { return state.roster.find((entry) => entry.id === id) || null; }
function availableRoster(state) { return state.roster.filter((entry) => entry.available && entry.skipBattles <= 0); }
function commandSpent(entries) { return entries.filter((entry) => entry.active && entry.kind !== 'king').reduce((sum, entry) => sum + (COMMAND_COSTS[entry.type] || 1), 0); }

function createBattleBriefing(stateInput, node, scenario = {}, options = {}) {
  const state = assertStageB(stateInput);
  if (state.status !== 'campaign') throw new Error('battle briefing can start only from the campaign map');
  const available = availableRoster(state);
  const defaultActiveIds = available.filter((entry) => entry.active).slice(0, state.activeLimit).map((entry) => entry.id);
  const fixedIds = unique([state.roster.find((entry) => entry.kind === 'king')?.id, ...(options.fixedRosterIds || [])].filter(Boolean));
  const briefing = Object.freeze({
    nodeId: node.id,
    nodeType: node.type,
    title: options.title || (node.type === 'elite' ? 'Элитное столкновение' : 'Тактическое сражение'),
    missionType: node.intel?.missionType || 'тактическая задача',
    enemies: freezeArray(node.intel?.enemyArchetypes || []),
    enemyPositionsVisible: Boolean(options.enemyPositionsVisible ?? true),
    objects: freezeArray((Array.isArray(scenario.environment) ? scenario.environment : Object.values(scenario.environment?.entries || scenario.environment || {})).map((entry) => typeof entry === 'string' ? entry : entry.type).filter(Boolean)),
    danger: node.danger || 1,
    initiative: node.intel?.firstMove || 'player',
    enemyPositions: freezeArray((scenario.position?.pieces || scenario.pieces || []).filter((entry) => entry.side && entry.side !== (options.playerSide || 'w')).map((entry) => entry.square).filter(Boolean)),
    dangerCells: freezeArray((Array.isArray(scenario.environment) ? scenario.environment : Object.values(scenario.environment?.entries || scenario.environment || {})).filter((entry) => entry?.type === 'hazard' || entry?.dangerous).flatMap((entry) => entry.cells || [])),
    blockedCells: freezeArray([...(scenario.board?.blockers || []), ...(Array.isArray(scenario.environment) ? scenario.environment : Object.values(scenario.environment?.entries || scenario.environment || {})).filter((entry) => entry?.type === 'blocker').flatMap((entry) => entry.cells || [])]),
    winConditions: freezeArray((scenario.objectives || []).map((entry) => typeof entry === 'string' ? entry : entry.previewKey || entry.id).filter(Boolean)),
    lossConditions: freezeArray((scenario.failures || []).map((entry) => typeof entry === 'string' ? entry : entry.previewKey || entry.id).filter(Boolean)),
    activeRosterIds: freezeArray(defaultActiveIds),
    reserveRosterIds: freezeArray(available.map((entry) => entry.id).filter((id) => !defaultActiveIds.includes(id))),
    fixedRosterIds: freezeArray(fixedIds),
    deploymentZone: freezeArray(options.deploymentZone || []),
    ambush: Boolean(options.ambush),
    locked: false,
    warning: 'После подтверждения нельзя менять состав, реликвии и распределение резерва.'
  });
  return append(state, 'briefing_opened', { nodeId: node.id }, { status: 'briefing', briefing });
}

function setBriefingRoster(stateInput, activeRosterIds) {
  const state = assertStageB(stateInput);
  if (state.status !== 'briefing' || state.briefing?.locked) throw new Error('briefing roster is locked');
  const ids = unique((activeRosterIds || []).map(String));
  const available = new Set(availableRoster(state).map((entry) => entry.id));
  if (ids.some((id) => !available.has(id))) throw new Error('briefing contains unavailable figure');
  for (const fixedId of state.briefing.fixedRosterIds) if (!ids.includes(fixedId)) throw new Error(`fixed figure ${fixedId} must remain active`);
  if (ids.length > state.activeLimit) throw new Error(`active roster exceeds limit ${state.activeLimit}`);
  const entries = state.roster.map((entry) => Object.freeze({ ...entry, active: ids.includes(entry.id), reserve: !ids.includes(entry.id) }));
  if (commandSpent(entries) > state.commandLimit) throw new Error(`active roster exceeds command limit ${state.commandLimit}`);
  return append(state, 'briefing_roster_changed', { activeRosterIds: ids }, { roster: freezeArray(entries), briefing: Object.freeze({ ...state.briefing, activeRosterIds: freezeArray(ids), reserveRosterIds: freezeArray([...available].filter((id) => !ids.includes(id))) }) });
}

function confirmBriefing(stateInput) {
  const state = assertStageB(stateInput);
  if (state.status !== 'briefing' || !state.briefing) throw new Error('no active battle briefing');
  const active = state.roster.filter((entry) => entry.active && entry.available && entry.skipBattles <= 0);
  if (!active.some((entry) => entry.kind === 'king')) throw new Error('the king must be active');
  if (commandSpent(state.roster) > state.commandLimit) throw new Error('command limit exceeded');
  return append(state, 'briefing_confirmed', { nodeId: state.briefing.nodeId, activeRosterIds: active.map((entry) => entry.id) }, { status: 'campaign', briefing: Object.freeze({ ...state.briefing, locked: true }) });
}

function rewardWeights(state, context = {}) {
  const recent = state.rewardHistory.slice(-3).map((entry) => entry.type);
  const weights = {
    relic: recent.includes('relic') ? 10 : 22,
    recruit: state.roster.length >= 8 ? 4 : 17,
    supplies: 17,
    gold: 18,
    heal: state.roster.some((entry) => entry.injury) ? 22 : 8,
    temporary: 10,
    scouting: 11,
    risky_event: context.sideObjectiveCompleted ? 8 : 5
  };
  if (context.elite) { weights.relic += 14; weights.recruit += 6; }
  if (context.doctrineId === 'doctrine.fortress') weights.relic += 3;
  return weights;
}

function weightedUniqueTypes(rng, weights, count = 3) {
  const pool = Object.entries(weights).map(([type, weight]) => ({ type, weight }));
  const result = [];
  while (result.length < count && pool.length) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng.float() * total;
    let selectedIndex = pool.length - 1;
    for (let index = 0; index < pool.length; index += 1) { roll -= pool[index].weight; if (roll < 0) { selectedIndex = index; break; } }
    result.push(pool.splice(selectedIndex, 1)[0].type);
  }
  return result;
}

function rewardPayload(type, rng, context = {}) {
  if (type === 'gold') return { gold: context.elite ? rng.int(18, 26) : rng.int(8, 15) };
  if (type === 'supplies') return { supplies: context.elite ? rng.int(4, 6) : rng.int(2, 4) };
  if (type === 'scouting') return { scouting: 1 };
  if (type === 'heal') return { heal: context.elite ? 'heavy' : 'light' };
  if (type === 'recruit') return { pieceType: rng.pick(REGULAR_TYPES) };
  if (type === 'relic') return { rarity: context.elite ? 'rare' : rng.pick(['common', 'uncommon']), relicId: `relic.offer.${hash32(`${context.nodeId || 'node'}:${rng.int(1, 999999)}`).toString(36)}` };
  if (type === 'temporary') return { effectId: rng.pick(['effect.temp_order_bonus', 'effect.temp_supply_discount', 'effect.temp_ward']) };
  return { eventId: `event.risky_reward.${hash32(`${context.nodeId || 'node'}:${rng.int(1, 999999)}`).toString(36)}` };
}

function generateRewardOffers(stateInput, context = {}) {
  const state = assertStageB(stateInput);
  const rng = new RngStreams(hash32(`${state.seed}:${state.act}:${context.nodeId || state.rewardHistory.length}:reward`)).get('offers');
  const types = weightedUniqueTypes(rng, rewardWeights(state, context), 3);
  const offers = types.map((type, index) => Object.freeze({ id: `reward:${context.nodeId || state.rewardHistory.length}:${index + 1}`, type, payload: Object.freeze(rewardPayload(type, rng, context)), improved: Boolean(context.sideObjectiveCompleted), title: rewardTitle(type), description: rewardDescription(type) }));
  return append(state, 'reward_offers_generated', { nodeId: context.nodeId || null, offerIds: offers.map((offer) => offer.id) }, { status: 'reward_choice', pendingRewardOffers: freezeArray(offers) });
}

function rewardTitle(type) {
  return ({ relic: 'Реликвия', recruit: 'Пополнение', supplies: 'Припасы', gold: 'Золото', heal: 'Лечение', temporary: 'Временное усиление', scouting: 'Разведданные', risky_event: 'Рискованная возможность' })[type] || type;
}
function rewardDescription(type) {
  return ({ relic: 'Добавить подходящую реликвию в арсенал.', recruit: 'Принять новую обычную фигуру в армию.', supplies: 'Пополнить дорожные запасы.', gold: 'Получить средства для услуг и лавок.', heal: 'Снять ранение с одной фигуры.', temporary: 'Получить эффект до конца текущего акта.', scouting: 'Усилить разведку ближайших развилок.', risky_event: 'Открыть дополнительное событие с повышенной наградой.' })[type] || type;
}

function chooseRewardOffer(stateInput, offerId, options = {}) {
  const state = assertStageB(stateInput);
  if (state.status !== 'reward_choice') throw new Error('no reward choice is pending');
  const offer = state.pendingRewardOffers.find((entry) => entry.id === offerId);
  if (!offer) throw new Error('reward offer is not available');
  let roster = state.roster.slice();
  let temporaryEffects = state.temporaryEffects.slice();
  let storyFlags = state.storyFlags.slice();
  let economy = { ...state.economy };
  const payload = offer.payload;
  if (offer.type === 'recruit') roster.push(regularRecord(`regular:reward-${state.rewardHistory.length + 1}`, payload.pieceType, 'reward'));
  if (offer.type === 'heal') {
    const targetId = options.targetRosterId || roster.find((entry) => entry.injury)?.id;
    roster = roster.map((entry) => entry.id === targetId ? Object.freeze({ ...entry, injury: null, skipBattles: 0, available: true, criticalRisk: false }) : entry);
  }
  if (offer.type === 'relic') {
    const targetId = options.targetRosterId || roster.find((entry) => entry.kind === 'hero' && entry.relicIds.length < entry.relicSlots)?.id || roster.find((entry) => entry.relicIds.length < entry.relicSlots)?.id;
    roster = roster.map((entry) => entry.id === targetId ? Object.freeze({ ...entry, relicIds: freezeArray([...entry.relicIds, payload.relicId].slice(0, entry.relicSlots)) }) : entry);
  }
  if (offer.type === 'temporary') temporaryEffects.push(payload.effectId);
  if (offer.type === 'risky_event') storyFlags.push(`pending:${payload.eventId}`);
  if (offer.type === 'gold') economy.goldEarned += payload.gold;
  if (offer.type === 'supplies') economy.suppliesEarned += payload.supplies;
  const record = Object.freeze({ id: offer.id, type: offer.type, payload, nodeId: options.nodeId || null });
  return append(state, 'reward_selected', record, { status: 'campaign', roster: freezeArray(roster), pendingRewardOffers: freezeArray([]), rewardHistory: freezeArray([...state.rewardHistory, record]), temporaryEffects: freezeArray(unique(temporaryEffects)), storyFlags: freezeArray(unique(storyFlags)), economy: Object.freeze(economy) });
}

function createServiceState(stateInput, serviceType, options = {}) {
  const state = assertStageB(stateInput);
  if (!SERVICE_TYPES.includes(serviceType)) throw new Error('unsupported service type');
  const rng = new RngStreams(hash32(`${state.seed}:${state.act}:${options.nodeId || serviceType}:service`)).get(serviceType);
  const offers = [];
  if (serviceType === 'shop') offers.push({ id: 'shop.relic', action: 'buy_relic', cost: rng.int(10, 18), title: 'Купить реликвию' }, { id: 'shop.supplies', action: 'buy_supplies', cost: 6, title: 'Купить 3 припаса' });
  if (serviceType === 'hospital') offers.push({ id: 'hospital.light', action: 'heal_light', cost: 5, title: 'Снять лёгкое ранение' }, { id: 'hospital.heavy', action: 'heal_heavy', cost: 12, title: 'Вылечить тяжёлое ранение' });
  if (serviceType === 'forge') offers.push({ id: 'forge.upgrade', action: 'forge_relic', cost: 10, title: 'Усилить реликвию' }, { id: 'forge.slot', action: 'add_slot', cost: 16, title: 'Подготовить дополнительный слот' });
  if (serviceType === 'camp') offers.push({ id: 'camp.recover', action: 'recover_skip', cost: 2, title: 'Снять пропуск следующего боя' }, { id: 'camp.merit', action: 'grant_merit', cost: 5, title: 'Провести тренировку' });
  const service = Object.freeze({ type: serviceType, nodeId: options.nodeId || null, offers: freezeArray(offers.map(Object.freeze)), warning: 'В этом акте появление других типов услуг не гарантировано.' });
  return append(state, 'service_entered', { serviceType, nodeId: service.nodeId }, { status: 'service', service });
}

function useService(stateInput, offerId, options = {}) {
  const state = assertStageB(stateInput);
  if (state.status !== 'service' || !state.service) throw new Error('no service is active');
  const offer = state.service.offers.find((entry) => entry.id === offerId);
  if (!offer) throw new Error('service offer is unavailable');
  if (Number(options.gold || 0) < offer.cost) throw new Error('not enough gold for service');
  const targetId = options.targetRosterId;
  let roster = state.roster.slice();
  if (offer.action === 'heal_light') roster = roster.map((entry) => entry.id === targetId && entry.injury === 'light' ? Object.freeze({ ...entry, injury: null, skipBattles: 0, available: true }) : entry);
  if (offer.action === 'heal_heavy') roster = roster.map((entry) => entry.id === targetId && entry.injury === 'heavy' ? Object.freeze({ ...entry, injury: null, skipBattles: 0, available: true, criticalRisk: false }) : entry);
  if (offer.action === 'recover_skip') roster = roster.map((entry) => entry.id === targetId ? Object.freeze({ ...entry, skipBattles: 0, available: true }) : entry);
  if (offer.action === 'grant_merit') roster = roster.map((entry) => entry.id === targetId ? applyMerits(entry, 2, 'camp_training') : entry);
  if (offer.action === 'add_slot') roster = roster.map((entry) => entry.id === targetId ? Object.freeze({ ...entry, relicSlots: Math.min(3, entry.relicSlots + 1) }) : entry);
  const economy = Object.freeze({ ...state.economy, goldSpent: state.economy.goldSpent + offer.cost, serviceVisits: state.economy.serviceVisits + 1 });
  return append(state, 'service_used', { serviceType: state.service.type, offerId, targetRosterId: targetId || null, cost: offer.cost }, { status: 'campaign', service: null, roster: freezeArray(roster), economy });
}

function skipBattleRecovery(entry) {
  if (entry.skipBattles <= 0) return entry;
  const skipBattles = entry.skipBattles - 1;
  return Object.freeze({ ...entry, skipBattles, available: skipBattles <= 0 && entry.injury !== 'heavy' });
}

function starFor(entry, merits) {
  const thresholds = entry.kind === 'hero' ? STAR_THRESHOLDS.hero : STAR_THRESHOLDS.regular;
  let stars = 0;
  for (let index = 0; index < thresholds.length; index += 1) if (merits >= thresholds[index]) stars = index + 1;
  return Math.min(3, stars);
}

function authoredTalentPair(entry, star) {
  const pairSet = TALENT_PAIRS[entry.type] || TALENT_PAIRS.p;
  const base = pairSet[Math.min(pairSet.length - 1, Math.max(0, star - 1))] || pairSet[0];
  return freezeArray(base.map((talent) => Object.freeze({ ...talent, star })));
}

function applyMerits(entry, amount, reason) {
  const merits = Math.max(0, entry.merits + amount);
  const stars = starFor(entry, merits);
  const choices = entry.talentChoices.slice();
  const shouldOffer = entry.kind === 'hero' ? stars > entry.stars : (entry.stars < 2 && stars >= 2);
  if (shouldOffer) choices.push(Object.freeze({ star: entry.kind === 'hero' ? stars : 2, options: authoredTalentPair(entry, entry.kind === 'hero' ? stars : 2), reason }));
  const relicSlots = entry.kind === 'hero' ? (stars >= 3 ? Math.max(entry.relicSlots, 2) : stars >= 1 ? Math.max(entry.relicSlots, 1) : entry.relicSlots) : (stars >= 2 ? Math.max(entry.relicSlots, 1) : entry.relicSlots);
  return Object.freeze({ ...entry, merits, stars, relicSlots, talentChoices: freezeArray(choices) });
}

function applyBattleResults(stateInput, result = {}) {
  const state = assertStageB(stateInput);
  const capturedIds = new Set(result.capturedRosterIds || []);
  const activeIds = new Set(result.activeRosterIds || state.roster.filter((entry) => entry.active).map((entry) => entry.id));
  const meritLog = [];
  let roster = state.roster.map(skipBattleRecovery).map((entry) => {
    let next = entry;
    if (capturedIds.has(entry.id) && entry.kind !== 'king') {
      const injury = entry.kind === 'hero' ? 'heavy' : 'light';
      next = Object.freeze({ ...next, injury, skipBattles: injury === 'light' ? 1 : 0, available: false, criticalRisk: injury === 'heavy' && Boolean(result.criticalRisk) });
    }
    const active = activeIds.has(entry.id);
    const amount = result.victory ? (active ? 2 : 1) : (active ? 1 : 0);
    if (amount) { next = applyMerits(next, amount + (result.sideObjectiveCompleted && active ? 1 : 0), result.sideObjectiveCompleted ? 'battle_and_side_objective' : 'battle'); meritLog.push({ rosterId: entry.id, amount, active }); }
    return Object.freeze({ ...next, battlesActive: next.battlesActive + (active ? 1 : 0), battlesReserve: next.battlesReserve + (active ? 0 : 1) });
  });
  return append(state, 'battle_results_applied', { victory: Boolean(result.victory), capturedRosterIds: [...capturedIds], merits: meritLog }, { roster: freezeArray(roster) });
}

function chooseTalent(stateInput, rosterId, talentId) {
  const state = assertStageB(stateInput);
  const entry = rosterEntry(state, rosterId);
  if (!entry) throw new Error('unknown roster figure');
  const pending = entry.talentChoices[0];
  if (!pending || !pending.options.some((option) => option.id === talentId)) throw new Error('talent is not currently offered');
  const roster = state.roster.map((record) => record.id === rosterId ? Object.freeze({ ...record, talents: freezeArray([...record.talents, talentId]), talentChoices: freezeArray(record.talentChoices.slice(1)), relicSlots: record.kind === 'hero' ? (record.stars >= 3 ? Math.max(record.relicSlots, 2) : record.stars >= 1 ? Math.max(record.relicSlots, 1) : record.relicSlots) : (record.stars >= 2 ? Math.max(record.relicSlots, 1) : record.relicSlots) }) : record);
  return append(state, 'talent_selected', { rosterId, talentId, star: pending.star }, { roster: freezeArray(roster) });
}

function beginRoyalRetreat(stateInput, options = {}) {
  const state = assertStageB(stateInput);
  const immediateFailure = state.difficulty === 'hard' || state.royalRetreat.used >= state.royalRetreat.maximum;
  if (immediateFailure) return append(state, 'run_failed_after_defeat', { nodeId: options.nodeId || null, difficulty: state.difficulty }, { status: 'failed', royalRetreat: Object.freeze({ ...state.royalRetreat, status: 'exhausted', lostNodeId: options.nodeId || null }) });
  const lossGold = Math.max(0, Number(options.lossGold ?? 5));
  const lossSupplies = Math.max(0, Number(options.lossSupplies ?? 2));
  const consequences = freezeArray(['Узел закрыт без награды', `Потеряно золота: ${lossGold}`, `Потеряно припасов: ${lossSupplies}`, 'Полученные ранения сохраняются']);
  return append(state, 'royal_retreat_started', { nodeId: options.nodeId || null, destinationNodeId: options.destinationNodeId || null, lossGold, lossSupplies }, { status: 'retreat', royalRetreat: Object.freeze({ used: state.royalRetreat.used + 1, maximum: state.royalRetreat.maximum, status: 'pending', lostNodeId: options.nodeId || null, destinationNodeId: options.destinationNodeId || null, consequences }) });
}

function completeRoyalRetreat(stateInput) {
  const state = assertStageB(stateInput);
  if (state.status !== 'retreat' || state.royalRetreat.status !== 'pending') throw new Error('no royal retreat is pending');
  return append(state, 'royal_retreat_completed', { destinationNodeId: state.royalRetreat.destinationNodeId }, { status: 'campaign', royalRetreat: Object.freeze({ ...state.royalRetreat, status: state.royalRetreat.used >= state.royalRetreat.maximum ? 'exhausted' : 'available' }) });
}

function beginActOutcome(stateInput, options = {}) {
  const state = assertStageB(stateInput);
  const choices = freezeArray(options.choices || [
    Object.freeze({ id: 'support_marches', title: 'Поддержать военный совет', consequence: 'Железные Марши сохранят дисциплину и потребуют дальнейшей верности.' }),
    Object.freeze({ id: 'reform_marches', title: 'Начать реформу', consequence: 'Регион получит новые права, но старые командиры запомнят решение.' }),
    Object.freeze({ id: 'claim_crown', title: 'Подчинить Марши короне', consequence: 'Королевская власть усилится ценой недовольства местных клятв.' })
  ]);
  const outcome = Object.freeze({ choices, selectedChoiceId: null, regionalRecruitId: options.regionalRecruitId || 'hero.aldric_wall', summary: options.summary || 'Железный Регент повержен. Теперь судьба Маршей зависит от решения короля.' });
  return append(state, 'act_outcome_opened', { choices: choices.map((entry) => entry.id) }, { status: 'act_outcome', actOutcome: outcome });
}

function chooseActOutcome(stateInput, choiceId) {
  const state = assertStageB(stateInput);
  if (state.status !== 'act_outcome' || !state.actOutcome?.choices.some((choice) => choice.id === choiceId)) throw new Error('act outcome choice is unavailable');
  const politicalChoices = freezeArray([...state.politicalChoices, choiceId]);
  const regionalRecruits = freezeArray(unique([...state.regionalRecruits, state.actOutcome.regionalRecruitId]));
  const roster = state.roster.map((entry) => entry.injury === 'light' ? Object.freeze({ ...entry, injury: null, skipBattles: 0, available: true }) : entry);
  const carrySupplyCap = 10;
  const compensation = Math.max(0, Number(state.economy.suppliesEarned - state.economy.suppliesSpent) - carrySupplyCap);
  const reorganization = Object.freeze({
    activeRosterIds: freezeArray(roster.filter((entry) => entry.active && entry.available).map((entry) => entry.id)),
    reserveRosterIds: freezeArray(roster.filter((entry) => !entry.active || !entry.available).map((entry) => entry.id)),
    commandLimit: state.commandLimit,
    supplyCarryCap: carrySupplyCap,
    excessSupplyCompensation: compensation,
    heavyInjuries: freezeArray(roster.filter((entry) => entry.injury === 'heavy').map((entry) => entry.id)),
    temporaryEffectsCleared: freezeArray(state.temporaryEffects),
    nextRegionScaling: Object.freeze({ act: state.act + 1, armyStrength: roster.reduce((sum, entry) => sum + entry.stars + (entry.kind === 'hero' ? 2 : 1), 0), enemyBonus: clamp(Math.floor(roster.reduce((sum, entry) => sum + entry.stars, 0) / 5), 0, 3) }),
    lockedTalentIds: freezeArray(roster.flatMap((entry) => entry.talents)),
    confirmed: false
  });
  return append(state, 'act_outcome_selected', { choiceId, regionalRecruitId: state.actOutcome.regionalRecruitId }, { status: 'reorganization', actOutcome: Object.freeze({ ...state.actOutcome, selectedChoiceId: choiceId }), politicalChoices, regionalRecruits, roster: freezeArray(roster), temporaryEffects: freezeArray([]), reorganization });
}

function updateReorganization(stateInput, activeRosterIds) {
  const state = assertStageB(stateInput);
  if (state.status !== 'reorganization' || state.reorganization?.confirmed) throw new Error('inter-act reorganization is unavailable');
  const ids = unique((activeRosterIds || []).map(String));
  const available = new Set(state.roster.filter((entry) => entry.available).map((entry) => entry.id));
  if (ids.some((id) => !available.has(id))) throw new Error('reorganization includes unavailable figure');
  if (!ids.some((id) => rosterEntry(state, id)?.kind === 'king')) throw new Error('king must remain active');
  const roster = state.roster.map((entry) => Object.freeze({ ...entry, active: ids.includes(entry.id), reserve: !ids.includes(entry.id) }));
  if (commandSpent(roster) > state.commandLimit) throw new Error('reorganization exceeds command limit');
  return append(state, 'reorganization_changed', { activeRosterIds: ids }, { roster: freezeArray(roster), reorganization: Object.freeze({ ...state.reorganization, activeRosterIds: freezeArray(ids), reserveRosterIds: freezeArray(state.roster.map((entry) => entry.id).filter((id) => !ids.includes(id))) }) });
}

function confirmReorganization(stateInput) {
  const state = assertStageB(stateInput);
  if (state.status !== 'reorganization' || !state.reorganization) throw new Error('no inter-act reorganization is active');
  if (commandSpent(state.roster) > state.commandLimit) throw new Error('reorganization exceeds command limit');
  return append(state, 'reorganization_confirmed', { activeRosterIds: state.reorganization.activeRosterIds }, { status: 'complete', reorganization: Object.freeze({ ...state.reorganization, confirmed: true }) });
}

function stageBSnapshot(stateInput) { return clone(assertStageB(stateInput)); }
function restoreStageB(snapshot) { return deepFreeze(clone(assertStageB(snapshot))); }

module.exports = {
  STAGE_B_FORMAT,
  STAGE_B_SCHEMA_VERSION,
  STAGE_B_STATUSES,
  SERVICE_TYPES,
  REWARD_TYPES,
  REGULAR_TYPES,
  PIECE_NAMES,
  COMMAND_COSTS,
  STAR_THRESHOLDS,
  TALENT_PAIRS,
  createStageBActState,
  assertStageB,
  chooseDraftHero,
  chooseDraftRegular,
  confirmDraft,
  availableRoster,
  commandSpent,
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
  restoreStageB
};
