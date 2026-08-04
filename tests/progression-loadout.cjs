const assert = require('assert');
const {
  createFigureProgression,
  relicSlotCapacity,
  gainStar,
  choosePassiveTalent,
  chooseThirdStarPath,
  validateRelicDefinition,
  relicCompatible,
  acceptRelic,
  refuseRelic,
  removeRelic
} = require('../src/army/progression.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const relic = (id, pieceTypes, rarity = 'common', extra = {}) => ({
  id,
  rarity,
  recipientFilter: { pieceTypes, ...(extra.recipientFilter || {}) },
  action: extra.action || null,
  rawNumericPower: Boolean(extra.rawNumericPower)
});

test('stars are capped and first passive requires one star', () => {
  let figure = createFigureProgression({ pieceId: 'pawn_1', pieceType: 'p', stars: 0 });
  assert.throws(() => choosePassiveTalent(figure, 'talent.patient_step'), /at least one star/);
  figure = gainStar(figure);
  figure = choosePassiveTalent(figure, 'talent.patient_step');
  assert.strictEqual(figure.stars, 1);
  assert.strictEqual(figure.passiveTalentId, 'talent.patient_step');
  assert.throws(() => choosePassiveTalent(figure, 'talent.other'), /already has/);
  figure = gainStar(gainStar(figure));
  assert.strictEqual(figure.stars, 3);
  assert.throws(() => gainStar(figure), /already has three/);
});

test('ordinary recruit unlocks one relic slot at star two and never a second', () => {
  const oneStar = createFigureProgression({ pieceId: 'rook_1', pieceType: 'r', stars: 1, passiveTalentId: 'talent.wall' });
  assert.strictEqual(relicSlotCapacity(oneStar), 0);
  const twoStar = createFigureProgression({ ...oneStar, stars: 2 });
  assert.strictEqual(relicSlotCapacity(twoStar), 1);
  const threeStar = chooseThirdStarPath(createFigureProgression({ ...twoStar, stars: 3 }), 'talent_refinement', 'talent.wall.refined');
  assert.strictEqual(relicSlotCapacity(threeStar), 1);
  assert.throws(() => chooseThirdStarPath(createFigureProgression({ ...twoStar, stars: 3 }), 'second_relic_slot'), /ordinary recruit/);
});

test('named hero chooses talent refinement or second relic slot, never both', () => {
  const base = createFigureProgression({
    pieceId: 'hero_rook', pieceType: 'r', namedHero: true, stars: 3,
    passiveTalentId: 'talent.interpose', uniqueAbilityId: 'ability.hero.interpose'
  });
  const refined = chooseThirdStarPath(base, 'talent_refinement', 'talent.interpose.refined');
  assert.strictEqual(relicSlotCapacity(refined), 1);
  assert.strictEqual(refined.talentRefinementId, 'talent.interpose.refined');
  const secondSlot = chooseThirdStarPath(base, 'second_relic_slot');
  assert.strictEqual(relicSlotCapacity(secondSlot), 2);
  assert.strictEqual(secondSlot.talentRefinementId, null);
  assert.throws(() => createFigureProgression({ ...secondSlot, talentRefinementId: 'illegal' }), /talent refinement requires/);
});

test('active relic definition must replace a standard action and declare order cost', () => {
  assert.strictEqual(validateRelicDefinition(relic('relic.echo', ['r'], 'rare', {
    action: { id: 'action.echo', replacesStandardAction: true, orderCost: 2 }
  })), true);
  assert.throws(() => validateRelicDefinition(relic('relic.bad_action', ['r'], 'rare', {
    action: { id: 'action.bad', replacesStandardAction: false, orderCost: 0 }
  })), /replace the standard action/);
  assert.throws(() => validateRelicDefinition(relic('relic.raw_power', ['r'], 'rare', { rawNumericPower: true })), /forbidden/);
});

test('relic compatibility respects piece type, hero and tags', () => {
  const ordinary = createFigureProgression({ pieceId: 'knight_1', pieceType: 'n', stars: 2, tags: ['cavalry'] });
  const hero = createFigureProgression({ pieceId: 'hero_knight', pieceType: 'n', namedHero: true, stars: 2, tags: ['cavalry'] });
  const definition = relic('relic.hero_spur', ['n'], 'rare', {
    recipientFilter: { namedOnly: true, requiredTags: ['cavalry'] }
  });
  assert.strictEqual(relicCompatible(ordinary, definition), false);
  assert.strictEqual(relicCompatible(hero, definition), true);
  assert.strictEqual(relicCompatible(hero, relic('relic.rook_only', ['r'])), false);
});

test('accepted relic is immediately assigned without shared inventory', () => {
  const figure = createFigureProgression({ pieceId: 'rook_1', pieceType: 'r', stars: 2 });
  const definition = relic('relic.echo_shield', ['r', 'k'], 'common');
  const accepted = acceptRelic(figure, definition);
  assert.strictEqual(accepted.progression.relics.length, 1);
  assert.deepStrictEqual(accepted.progression.relics[0], { id: 'relic.echo_shield', rarity: 'common', actionId: null });
  assert.deepStrictEqual(accepted.compensation, []);
  assert.throws(() => acceptRelic(accepted.progression, definition), /already equipped/);
});

test('relic cannot be equipped before its slot unlocks or to an incompatible figure', () => {
  const pawn = createFigureProgression({ pieceId: 'pawn_1', pieceType: 'p', stars: 1, passiveTalentId: 'talent.advance' });
  assert.throws(() => acceptRelic(pawn, relic('relic.pawn', ['p'])), /no unlocked relic slot/);
  const readyPawn = createFigureProgression({ ...pawn, stars: 2 });
  assert.throws(() => acceptRelic(readyPawn, relic('relic.rook', ['r'])), /incompatible/);
});

test('occupied slot requires explicit replacement and old relic leaves the run', () => {
  let figure = createFigureProgression({ pieceId: 'bishop_1', pieceType: 'b', stars: 2 });
  figure = acceptRelic(figure, relic('relic.old', ['b'], 'rare')).progression;
  assert.throws(() => acceptRelic(figure, relic('relic.new', ['b'], 'epic')), /replaceIndex is required/);
  const replaced = acceptRelic(figure, relic('relic.new', ['b'], 'epic'), { replaceIndex: 0 });
  assert.strictEqual(replaced.discarded.id, 'relic.old');
  assert.strictEqual(replaced.progression.relics[0].id, 'relic.new');
  assert.deepStrictEqual(replaced.compensation, [
    { type: 'gold', amount: 10 },
    { type: 'supplies', amount: 2 }
  ]);
});

test('named hero with second-slot path can equip exactly two relics', () => {
  let hero = createFigureProgression({
    pieceId: 'hero_queen', pieceType: 'q', namedHero: true, stars: 3,
    passiveTalentId: 'talent.court', uniqueAbilityId: 'ability.hero.contract',
    thirdStarPath: 'second_relic_slot'
  });
  hero = acceptRelic(hero, relic('relic.first', ['q'], 'rare')).progression;
  hero = acceptRelic(hero, relic('relic.second', ['q'], 'epic')).progression;
  assert.strictEqual(hero.relics.length, 2);
  assert.throws(() => acceptRelic(hero, relic('relic.third', ['q'], 'legendary')), /replaceIndex is required/);
});

test('refusal and removal return small rarity-based compensation choices', () => {
  const refused = refuseRelic(relic('relic.decline', ['p'], 'legendary'));
  assert.deepStrictEqual(refused.compensation, [
    { type: 'gold', amount: 28 },
    { type: 'supplies', amount: 5 }
  ]);
  let figure = createFigureProgression({ pieceId: 'pawn_1', pieceType: 'p', stars: 2 });
  figure = acceptRelic(figure, relic('relic.remove', ['p'], 'uncommon')).progression;
  const removed = removeRelic(figure, 0, 'replaced');
  assert.strictEqual(removed.progression.relics.length, 0);
  assert.strictEqual(removed.removed.id, 'relic.remove');
  assert.deepStrictEqual(removed.compensation, [
    { type: 'gold', amount: 7 },
    { type: 'supplies', amount: 1 }
  ]);
});

test('progression serialization round trip preserves policy invariants', () => {
  const original = createFigureProgression({
    pieceId: 'hero_rook', pieceType: 'r', namedHero: true, stars: 3,
    passiveTalentId: 'talent.wall', uniqueAbilityId: 'ability.wall',
    thirdStarPath: 'second_relic_slot', tags: ['fortress'],
    relics: [
      { id: 'relic.one', rarity: 'rare', actionId: null },
      { id: 'relic.two', rarity: 'epic', actionId: 'action.two' }
    ]
  });
  const restored = createFigureProgression(JSON.parse(JSON.stringify(original)));
  assert.deepStrictEqual(restored, original);
  assert.strictEqual(relicSlotCapacity(restored), 2);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}
console.log(`\nProgression and loadout: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
