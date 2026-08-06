'use strict';

const { hash32 } = require('../core/determinism.cjs');
const { SERVICE_TYPES, freezeArray, deepFreeze } = require('./production-map-contract.cjs');
const { secretContentType } = require('./production-map-materialization.cjs');

function eligibleSecretSource(state, nodeId) {
  const node = state.graph.nodesById[nodeId];
  return Boolean(node && state.graph.secretChecks[nodeId] && !SERVICE_TYPES.includes(node.type) && !['elite', 'boss', 'start'].includes(node.type));
}
function checkSecretAfterNode(state, nodeId) {
  if (state.secret.discovered || state.secret.completed || state.secret.declined) return state;
  if (!eligibleSecretSource(state, nodeId) || state.secret.checksByNode[nodeId]) return state;
  const check = state.graph.secretChecks[nodeId];
  const roll = (hash32(`${check.checkSeed}:roll`) % 100) + 1;
  const found = roll <= check.chance;
  const checksByNode = { ...state.secret.checksByNode, [nodeId]: deepFreeze({ roll, chance: check.chance, found }) };
  const discovered = found ? deepFreeze({
    id: `secret_${hash32(`${check.contentSeed}:id`).toString(36)}`,
    sourceNodeId: nodeId, contentSeed: check.contentSeed,
    contentType: secretContentType(check.contentSeed), opaque: true
  }) : null;
  return deepFreeze({ ...state,
    secret: deepFreeze({ ...state.secret, checksByNode, discovered, pendingDecision: discovered }),
    history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'secret_check', nodeId, roll, found })]) });
}
function decideSecret(state, decision) {
  if (!state.secret.pendingDecision) throw new Error('there is no pending secret-node decision');
  if (!['enter', 'decline'].includes(decision)) throw new Error('secret decision must be enter or decline');
  if (decision === 'decline') return deepFreeze({ ...state,
    secret: deepFreeze({ ...state.secret, pendingDecision: null, declined: true }),
    history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'secret_declined', nodeId: state.secret.discovered.id })]) });
  if (state.supplies < 1) throw new Error('entering the secret node requires 1 supply');
  return deepFreeze({ ...state, supplies: state.supplies - 1,
    secret: deepFreeze({ ...state.secret, pendingDecision: null, active: deepFreeze({ ...state.secret.discovered, returnNodeId: state.currentNodeId }) }),
    history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'secret_entered', nodeId: state.secret.discovered.id, cost: 1 })]) });
}
function completeSecret(state) {
  if (!state.secret.active) throw new Error('no secret node is active');
  return deepFreeze({ ...state,
    secret: deepFreeze({ ...state.secret, active: null, completed: true }),
    history: freezeArray([...state.history, deepFreeze({ index: state.history.length, type: 'secret_completed', nodeId: state.secret.discovered.id, returnedTo: state.currentNodeId, returnCost: 0 })]) });
}

module.exports = { eligibleSecretSource, checkSecretAfterNode, decideSecret, completeSecret };
