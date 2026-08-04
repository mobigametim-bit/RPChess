const assert = require('assert');
const {
  normalizeSeed,
  deriveSeed,
  XorShift32,
  RngStreams,
  DeterministicIdFactory
} = require('../src/core/determinism.cjs');
const { DomainEnvelopeFactory } = require('../src/core/domain.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('xorshift32 preserves the characterized legacy sequence', () => {
  const rng = new XorShift32(123456);
  assert.deepStrictEqual(
    [rng.nextU32(), rng.nextU32(), rng.nextU32(), rng.nextU32(), rng.nextU32()],
    [3044438244, 372467569, 561134079, 2951787001, 2151050974]
  );
});

test('seed normalization is stable and non-zero', () => {
  assert.strictEqual(normalizeSeed(123), 123);
  assert.notStrictEqual(normalizeSeed(0), 0);
  assert.strictEqual(normalizeSeed('123'), 123);
});

test('named streams are reproducible and independent', () => {
  const a = new RngStreams(42);
  const b = new RngStreams(42);
  const campaignA = [a.get('campaign-map').nextU32(), a.get('campaign-map').nextU32()];
  const campaignB = [b.get('campaign-map').nextU32(), b.get('campaign-map').nextU32()];
  assert.deepStrictEqual(campaignA, campaignB);
  assert.notStrictEqual(deriveSeed(42, 'campaign-map'), deriveSeed(42, 'reward-offers'));
  assert.notStrictEqual(a.get('reward-offers').nextU32(), campaignA[0]);
});

test('using one stream does not advance another stream', () => {
  const first = new RngStreams(991);
  const second = new RngStreams(991);
  first.get('campaign-map').nextU32();
  first.get('campaign-map').nextU32();
  assert.strictEqual(first.get('event-selection').nextU32(), second.get('event-selection').nextU32());
});

test('RNG stream snapshot resumes the exact sequence', () => {
  const original = new RngStreams(2026);
  original.get('shop-stock').nextU32();
  original.get('reward-offers').nextU32();
  const snapshot = JSON.parse(JSON.stringify(original.snapshot()));
  const expected = [
    original.get('shop-stock').nextU32(),
    original.get('reward-offers').nextU32(),
    original.get('reward-offers').nextU32()
  ];
  const restored = new RngStreams(2026).restore(snapshot);
  assert.deepStrictEqual([
    restored.get('shop-stock').nextU32(),
    restored.get('reward-offers').nextU32(),
    restored.get('reward-offers').nextU32()
  ], expected);
});

test('deterministic IDs are stable, namespaced and restorable', () => {
  const first = new DeterministicIdFactory('run', 777);
  assert.strictEqual(first.next('piece'), 'run_ll_piece_0');
  assert.strictEqual(first.next('piece'), 'run_ll_piece_1');
  assert.strictEqual(first.next('node'), 'run_ll_node_0');
  const snapshot = JSON.parse(JSON.stringify(first.snapshot()));
  const restored = DeterministicIdFactory.fromSnapshot(snapshot);
  assert.strictEqual(restored.next('piece'), 'run_ll_piece_2');
  assert.strictEqual(restored.next('node'), 'run_ll_node_1');
});

test('command and event envelopes use one deterministic sequence', () => {
  const ids = new DeterministicIdFactory('battle', 99);
  const factory = new DomainEnvelopeFactory({ idFactory: ids });
  const command = factory.command('MovePiece', { pieceId: 'piece_1', to: { x: 4, y: 4 } }, { actor: 'player' });
  const event = factory.event('PieceMoved', { pieceId: 'piece_1', from: { x: 4, y: 6 }, to: { x: 4, y: 4 } });
  assert.strictEqual(command.sequence, 0);
  assert.strictEqual(event.sequence, 1);
  assert.strictEqual(command.id, 'battle_2r_command_0');
  assert.strictEqual(event.id, 'battle_2r_event_0');
  assert.strictEqual(Object.isFrozen(command), true);
  assert.strictEqual(Object.isFrozen(command.payload.to), true);
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
console.log(`\nDeterministic foundations: ${tests.length - failures}/${tests.length} passed.`);
if (failures) process.exitCode = 1;
