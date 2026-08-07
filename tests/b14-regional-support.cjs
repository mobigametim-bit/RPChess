'use strict';

const assert = require('assert');
const { eligibleRegionalSupportOptions, spendRegionalSupport } = require('../src/runtime/regional-support-b14.cjs');

(function main() {
  const support = Object.freeze({ regionId: 'region.iron_marches', charges: 1, maximum: 2, directions: Object.freeze(['казна', 'производство']) });
  const candidates = [
    { id:'treasury_grant', forceId:'crown', title:'Королевская субсидия', description:'Авторская помощь казны.', exactEffect:{ gold:25 }, contextId:'region.thorn_covenant:shop' },
    { id:'forge_repair', forceId:'forge_council', title:'Мастера горна', description:'Авторский ремонт.', exactEffect:{ repair:true }, contextId:'region.thorn_covenant:service' },
    { id:'military_scout', forceId:'military_council', title:'Разведчики', description:'Не подходит чистой Короне.', exactEffect:{ scout:true }, contextId:'region.thorn_covenant:map' }
  ];

  const crown = eligibleRegionalSupportOptions({ governmentId:'crown', support, candidates });
  assert.deepStrictEqual(crown.map((entry) => entry.id), ['treasury_grant']);
  assert.deepStrictEqual(crown[0].exactEffect, { gold:25 });

  const coalition = eligibleRegionalSupportOptions({ governmentId:'crown_forge', support, candidates });
  assert.deepStrictEqual(coalition.map((entry) => entry.id), ['treasury_grant', 'forge_repair']);
  assert.strictEqual(coalition.length, 2);

  const spent = spendRegionalSupport(support, coalition[0]);
  assert.strictEqual(spent.support.charges, 0);
  assert.strictEqual(spent.support.maximum, 2);
  assert.strictEqual(spent.support.history[0].optionId, 'treasury_grant');
  assert.throws(() => spendRegionalSupport({ ...support, charges:0 }, coalition[0]), /no charges/);
  assert.throws(() => spendRegionalSupport(support, { id:'hidden_effect' }), /exact authored effect/);

  console.log('B14 regional support: government directions, authored 1–2 context choices, exact effect visibility and charge spending passed.');
})();
