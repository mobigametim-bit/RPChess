'use strict';

const assert = require('assert');
const {
  normalizeScenarioCandidate,
  scenarioEligibility,
  scenarioWeight,
  selectProductionScenario,
  generateProductionActGraph,
  materializeLevel
} = require('../src/campaign/production-map.cjs');

const candidates = [
  {
    id: 'scenario.iron_hold',
    baseWeight: 2,
    regionIds: ['region.iron_marches'],
    phases: ['early', 'mid'],
    branchProfiles: ['fortified'],
    danger: { minimum: 1, maximum: 4 },
    requiredFacts: ['story.wall_intact'],
    excludedFacts: ['story.wall_fallen'],
    factorWeights: {
      region: { 'region.iron_marches': 2 },
      phase: { early: 3, mid: 1 },
      danger: { '2': 1.5 },
      branchProfile: { fortified: 2 },
      board: { compact: 1.25 },
      objective: { hold: 2 },
      environment: { battlement: 1.5 }
    },
    optionalObjectiveRequirements: { minimumRosterSize: 5, requiredPieceTypes: ['r'] },
    metadata: { boardId: 'compact', objectiveId: 'hold', environmentId: 'battlement' }
  },
  {
    id: 'scenario.open_field',
    baseWeight: 4,
    regionIds: ['region.iron_marches'],
    phases: ['early'],
    branchProfiles: ['direct'],
    danger: { minimum: 1, maximum: 3 },
    incompatibleScenarioIds: ['scenario.iron_hold']
  },
  {
    id: 'scenario.foreign',
    baseWeight: 100,
    regionIds: ['region.thorn_covenant']
  }
];

const normalized = normalizeScenarioCandidate(candidates[0]);
assert.strictEqual(normalized.id, 'scenario.iron_hold');
assert.strictEqual(normalized.optionalObjectiveRequirements.minimumRosterSize, 5);

const context = {
  regionId: 'region.iron_marches',
  phase: 'early',
  danger: 2,
  branchProfile: 'fortified',
  boardId: 'compact',
  objectiveId: 'hold',
  environmentId: 'battlement',
  storyFacts: ['story.wall_intact']
};
const weight = scenarioWeight(candidates[0], context);
assert.strictEqual(weight.eligible, true);
assert.strictEqual(weight.weight, 108);
assert.strictEqual(weight.factors.length, 7);
assert.strictEqual(scenarioEligibility(candidates[0], { ...context, storyFacts: ['story.wall_fallen'] }).eligible, false);
assert.strictEqual(scenarioEligibility(candidates[2], context).reason, 'region');
assert.strictEqual(scenarioEligibility(candidates[1], { ...context, branchProfile: 'direct', adjacentScenarioIds: ['scenario.iron_hold'] }).reason, 'scenario_incompatibility');

const selectedA = selectProductionScenario({ seed: 9042, candidates, context });
const selectedB = selectProductionScenario({ seed: 9042, candidates, context });
assert.deepStrictEqual(selectedA, selectedB);
assert.strictEqual(selectedA.scenarioId, 'scenario.iron_hold');
assert.deepStrictEqual(selectedA.optionalObjectiveRequirements, { minimumRosterSize: 5, requiredPieceTypes: ['r'] });
assert.strictEqual(selectProductionScenario({ seed: 1, candidates, excludedScenarioIds: ['scenario.iron_hold'], context }), null);

const graph = generateProductionActGraph({ rootSeed: 7007, regionId: 'region.iron_marches' });
const source = graph.nodes.find((node) => (graph.outgoing[node.id] || []).some((edgeId) => {
  const target = graph.nodesById[graph.edgesById[edgeId].to];
  return target.type === 'battle' || target.type === 'elite';
}));
assert.ok(source);
const materialized = materializeLevel(graph, source.id, {}, {
  contentPools: { scenarioCandidates: candidates, encounters: candidates.map((candidate) => candidate.id) },
  storyFacts: ['story.wall_intact'],
  boardId: 'compact',
  objectiveId: 'hold',
  environmentId: 'battlement'
});
for (const entry of Object.values(materialized.materializedByNode).filter((value) => ['battle', 'elite'].includes(value.type))) {
  assert.ok(entry.contentId);
  assert.ok(entry.details.scenarioSelection);
  assert.ok(Array.isArray(entry.details.scenarioSelection.appliedFactors));
}

console.log('B9 scenario selector: eligibility, author-driven factor weights, incompatibilities, deterministic selection and materialization passed.');
