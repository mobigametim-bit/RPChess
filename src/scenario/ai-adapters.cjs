'use strict';

const { legalWardAwareCommands, executeWardAwareCommand } = require('../combat/ward-protection.cjs');

function sameCommand(left, right) {
  if (!left || !right || left.type !== right.type) return false;
  const a = left.payload || {};
  const b = right.payload || {};
  if (left.type === 'MovePiece') {
    return a.from === b.from && a.to === b.to && (a.promotion || null) === (b.promotion || null);
  }
  if (left.type === 'DeployReserve') return a.entryId === b.entryId && a.square === b.square;
  return JSON.stringify(a) === JSON.stringify(b);
}

function scenarioCommandProvider(scenario) {
  if (!scenario || scenario.format !== 'rpchess-scenario-state') throw new Error('valid scenario state is required');
  return (battle) => legalWardAwareCommands(battle, { rules: scenario.rules });
}

function scenarioCommandExecutor(scenario) {
  if (!scenario || scenario.format !== 'rpchess-scenario-state') throw new Error('valid scenario state is required');
  const provider = scenarioCommandProvider(scenario);
  return (battle, command) => {
    if (!provider(battle).some((candidate) => sameCommand(candidate, command))) {
      throw new Error('AI command is not legal under scenario environment rules');
    }
    return executeWardAwareCommand(battle, command, { rules: scenario.rules });
  };
}

function scenarioAiOptions(scenario) {
  return Object.freeze({
    commandProvider: scenarioCommandProvider(scenario),
    commandExecutor: scenarioCommandExecutor(scenario)
  });
}

module.exports = {
  sameCommand,
  scenarioCommandProvider,
  scenarioCommandExecutor,
  scenarioAiOptions
};
