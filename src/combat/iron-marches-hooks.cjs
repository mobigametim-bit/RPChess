'use strict';

const { applyPrimaryStatus, statusFor } = require('./statuses.cjs');
const { gainOrderPoints } = require('./order-points.cjs');
const { updatePassive } = require('./abilities.cjs');

function freezeArray(values) { return Object.freeze(values.slice()); }

function applyMovePassives(state, resolution, movingPiece, capturedId, factory, events) {
  let statuses = resolution.statuses || state.statuses;
  let abilities = resolution.abilities || state.abilities;
  let orderPoints = resolution.orderPoints || state.orderPoints;

  if (!capturedId && movingPiece?.type === 'n') {
    const passive = abilities.passives?.find((candidate) => candidate.kind === 'evasion_after_non_capture'
      && candidate.ownerId === resolution.actedPieceId
      && !candidate.consumed);
    if (passive && !statusFor(statuses, passive.ownerId)) {
      const applied = applyPrimaryStatus(statuses, passive.ownerId, 'evasion', {
        sourceId: passive.sourceId,
        actionIndex: state.actionIndex,
        data: { effectId: passive.effectId }
      });
      statuses = applied.state;
      abilities = updatePassive(abilities, passive.instanceId, { consumed: true });
      events.push(factory.event('StatusApplied', {
        battleId: state.battleId,
        pieceId: passive.ownerId,
        statusId: 'evasion',
        sourceId: passive.sourceId,
        expiry: null
      }));
      events.push(factory.event('RelicEffectConsumed', {
        battleId: state.battleId,
        effectId: passive.effectId,
        ownerId: passive.ownerId,
        reason: 'first_non_capture_knight_move'
      }));
    }
  }

  if (capturedId) {
    const offered = statusFor(state.statuses, capturedId);
    if (offered?.id === 'offered') {
      const rewardSide = offered.data.rewardSide;
      const rewardOrders = Number(offered.data.rewardOrders || 2);
      const gained = gainOrderPoints(orderPoints[rewardSide], rewardOrders, 'voluntary_sacrifice');
      orderPoints = Object.freeze({ ...orderPoints, [rewardSide]: gained.pool });
      events.push(factory.event('VoluntarySacrificeResolved', {
        battleId: state.battleId,
        pieceId: capturedId,
        rewardSide,
        requestedOrders: rewardOrders,
        changedBy: gained.changedBy
      }));
      events.push(factory.event('OrderPointsChanged', {
        battleId: state.battleId,
        side: rewardSide,
        changedBy: gained.changedBy,
        current: gained.pool.current,
        reason: 'voluntary_sacrifice'
      }));
    }
  }

  return Object.freeze({ statuses, abilities, orderPoints });
}

function advanceScenarioRules(input, nextActionIndex, factory, battleId, events) {
  if (!input) return null;
  const baseBlockedSquares = freezeArray(input.baseBlockedSquares || []);
  const retained = [];
  for (const blocker of input.blockers || []) {
    if (blocker.expiresAfterAction != null && blocker.expiresAfterAction <= nextActionIndex) {
      events.push(factory.event('BoardTopologyChanged', {
        battleId,
        ownerId: blocker.ownerId || null,
        sourceId: blocker.sourceId,
        square: blocker.square,
        operation: 'expire',
        durationActions: 0
      }));
    } else {
      retained.push(blocker);
    }
  }
  return Object.freeze({
    ...input,
    baseBlockedSquares,
    blockers: freezeArray(retained),
    blockedSquares: freezeArray([...new Set([...baseBlockedSquares, ...retained.map((record) => record.square)])])
  });
}

module.exports = { applyMovePassives, advanceScenarioRules };
