'use strict';

const assert = require('assert');
const { defaultMaterialization } = require('../src/campaign/production-map.cjs');

const graph = { regionId: 'region.iron_marches' };
function node(type, contentSeed) {
  return {
    id: `node.${type}`,
    type,
    phase: 'mid',
    danger: 3,
    branchProfile: 'fortified',
    contentSeed,
    contentVersion: 1,
    layer: 4
  };
}

const event = defaultMaterialization(node('event', 101), graph, {
  sourceNodeId: 'source',
  selectorState: { revision: 2 },
  participantIds: ['regular.1'],
  selectEvent: ({ seed, selectorState, excludedEventIds }) => {
    assert.strictEqual(seed, 101);
    assert.deepStrictEqual(selectorState, { revision: 2 });
    assert.deepStrictEqual(excludedEventIds, ['event.previous']);
    return {
      eventId: 'event.production',
      eventVersion: 7,
      variantId: 'linked_favorable',
      participantId: 'hero.aldric_wall',
      percentages: [65, 35],
      snapshot: { stageId: 'decision', visibleChoiceIds: ['a', 'b'] },
      selectorState: { revision: 3, assignedNodeId: 'node.event' }
    };
  }
}, new Set(['event.previous']));
assert.strictEqual(event.contentId, 'event.production');
assert.strictEqual(event.contentVersion, 7);
assert.strictEqual(event.details.eventVersion, 7);
assert.strictEqual(event.details.variantId, 'linked_favorable');
assert.strictEqual(event.details.participantId, 'hero.aldric.wall');
assert.deepStrictEqual(event.details.percentages, [65, 35]);
assert.deepStrictEqual(event.details.snapshot, { stageId: 'decision', visibleChoiceIds: ['a', 'b'] });
assert.deepStrictEqual(event.selectorState, { revision: 3, assignedNodeId: 'node.event' });

const battle = defaultMaterialization(node('battle', 202), graph, {
  sourceNodeId: 'source',
  selectScenario: ({ seed, contentVersion, excludedScenarioIds, storyFacts }) => {
    assert.strictEqual(seed, 202);
    assert.strictEqual(contentVersion, 1);
    assert.deepStrictEqual(excludedScenarioIds, ['scenario.previous']);
    assert.deepStrictEqual(storyFacts, ['story.wall_intact']);
    return {
      scenarioId: 'scenario.production',
      scenarioVersion: 4,
      weight: 8,
      totalWeight: 20,
      appliedFactors: [{ key: 'phase', value: 'mid', multiplier: 2 }],
      optionalObjectiveRequirements: { requiredPieceTypes: ['r'] },
      metadata: { board: { width: 8, height: 8 } },
      snapshot: {
        enemies: [{ id: 'enemy.1', type: 'r' }],
        deployment: [{ unitId: 'enemy.1', square: 'd6' }],
        environment: [{ id: 'wall.1', square: 'e5' }],
        objectives: [{ id: 'hold_gate' }],
        reward: { category: 'relic' }
      }
    };
  },
  storyFacts: ['story.wall_intact']
}, new Set(['scenario.previous']));
assert.strictEqual(battle.contentId, 'scenario.production');
assert.strictEqual(battle.contentVersion, 4);
assert.strictEqual(battle.details.scenarioVersion, 4);
assert.strictEqual(battle.details.scenarioSelection.snapshot.enemies[0].id, 'enemy.1');
assert.strictEqual(battle.details.scenarioSelection.snapshot.deployment[0].square, 'd6');
assert.strictEqual(battle.details.scenarioSelection.snapshot.environment[0].square, 'e5');
assert.strictEqual(battle.details.scenarioSelection.optionalObjectiveRequirements.requiredPieceTypes[0], 'r');

const service = defaultMaterialization(node('hospital', 303), graph, {
  sourceNodeId: 'source',
  selectService: ({ seed, serviceType }) => {
    assert.strictEqual(seed, 303);
    assert.strictEqual(serviceType, 'hospital');
    return {
      serviceId: 'service.field_hospital',
      serviceVersion: 2,
      inventory: [{ id: 'treatment.light', price: 15 }],
      parameters: { treatmentSlots: 2 }
    };
  }
}, new Set());
assert.strictEqual(service.contentId, 'service.field_hospital');
assert.strictEqual(service.contentVersion, 2);
assert.strictEqual(service.details.serviceType, 'hospital');
assert.strictEqual(service.details.inventory[0].id, 'treatment.light');
assert.strictEqual(service.details.parameters.treatmentSlots, 2);

const reloaded = JSON.parse(JSON.stringify({ event, battle, service }));
assert.deepStrictEqual(reloaded.event.details.snapshot, event.details.snapshot);
assert.deepStrictEqual(reloaded.battle.details.scenarioSelection.snapshot, battle.details.scenarioSelection.snapshot);
assert.deepStrictEqual(reloaded.service.details.inventory, service.details.inventory);

console.log('B9 materialization snapshots: versioned event, scenario, enemies, deployment, environment, service and reload persistence passed.');
