'use strict';

const { hash32 } = require('../core/determinism.cjs');
const { legalWardAwareCommands, executeWardAwareCommand } = require('../combat/ward-protection.cjs');
const { resolveAiProfile } = require('./profiles.cjs');
const { evaluateBattleState } = require('./evaluate.cjs');

const BUDGET_ABORT = Symbol('ai-budget-abort');

function commandKey(command) {
  if (!command || typeof command !== 'object') throw new Error('command is required');
  const payload = command.payload || {};
  if (command.type === 'MovePiece') return `move:${payload.from}:${payload.to}:${payload.promotion || '-'}`;
  if (command.type === 'DeployReserve') return `reserve:${payload.entryId}:${payload.square}`;
  return `${command.type}:${JSON.stringify(payload)}`;
}

function deterministicNoise(seed, key, amplitude) {
  if (!amplitude) return 0;
  const unit = hash32(`${seed}:${key}`) / 4294967295;
  return (unit * 2 - 1) * amplitude;
}

function tacticalOrder(result, command, perspective) {
  let score = 0;
  for (const event of result.events) {
    if (event.type === 'CheckmateDeclared') score += event.payload.winner === perspective ? 100000 : -100000;
    else if (event.type === 'PieceCaptured') score += event.payload.bySide === perspective ? 1000 : -1000;
    else if (event.type === 'KingChecked') score += event.payload.checkedSide === perspective ? -300 : 300;
    else if (event.type === 'PawnPromoted') score += event.payload.side === perspective ? 800 : -800;
    else if (event.type === 'ReserveDeployed') score += event.payload.side === perspective ? 60 : -60;
    else if (event.type === 'CapturePrevented') score += event.payload.attackerId ? 20 : 0;
  }
  return score;
}

function createBudget(profile, options = {}) {
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const startedAt = Number(now());
  const requestedTime = options.timeBudgetMs ?? profile.timeBudgetMs;
  const timeBudgetMs = Number.isFinite(requestedTime) && requestedTime > 0 ? requestedTime : 0;
  const maxNodes = options.maxNodes ?? profile.maxNodes;
  if (!Number.isInteger(maxNodes) || maxNodes < 1) throw new Error('AI maxNodes must be a positive integer');
  return {
    now,
    startedAt,
    deadline: timeBudgetMs ? startedAt + timeBudgetMs : Infinity,
    maxNodes,
    nodes: 0,
    abortedBy: null
  };
}

function consumeNode(budget) {
  if (budget.nodes >= budget.maxNodes) {
    budget.abortedBy = 'nodes';
    throw BUDGET_ABORT;
  }
  if (Number(budget.now()) >= budget.deadline) {
    budget.abortedBy = 'time';
    throw BUDGET_ABORT;
  }
  budget.nodes += 1;
}

function resolveCommandProvider(options = {}) {
  const provider = options.commandProvider || legalWardAwareCommands;
  if (typeof provider !== 'function') throw new Error('AI commandProvider must be a function');
  return provider;
}

function resolveCommandExecutor(options = {}) {
  const executor = options.commandExecutor || executeWardAwareCommand;
  if (typeof executor !== 'function') throw new Error('AI commandExecutor must be a function');
  return executor;
}

function orderedChildren(state, perspective, options = {}) {
  const provider = resolveCommandProvider(options);
  const executor = resolveCommandExecutor(options);
  const commands = provider(state).slice().sort((a, b) => commandKey(a).localeCompare(commandKey(b)));
  const children = commands.map((command) => {
    const result = executor(state, command);
    if (!result || !result.state || !Array.isArray(result.events)) throw new Error('AI commandExecutor must return {state, events}');
    return { command, key: commandKey(command), result, order: tacticalOrder(result, command, perspective) };
  });
  const maximizing = state.position.sideToMove === perspective;
  children.sort((a, b) => (maximizing ? b.order - a.order : a.order - b.order) || a.key.localeCompare(b.key));
  return children;
}

function minimax(state, depth, alpha, beta, perspective, profile, options, budget, ply) {
  consumeNode(budget);
  if (depth <= 0 || state.status !== 'active') {
    return evaluateBattleState(state, perspective, {
      ply,
      reserveDiscount: profile.reserveDiscount,
      mobilityWeight: profile.mobilityWeight,
      statusWeight: profile.statusWeight,
      objectiveEvaluator: options.objectiveEvaluator
    });
  }

  const children = orderedChildren(state, perspective, options);
  if (!children.length) {
    return evaluateBattleState(state, perspective, {
      ply,
      reserveDiscount: profile.reserveDiscount,
      mobilityWeight: profile.mobilityWeight,
      statusWeight: profile.statusWeight,
      objectiveEvaluator: options.objectiveEvaluator
    });
  }

  const maximizing = state.position.sideToMove === perspective;
  let best = maximizing ? -Infinity : Infinity;
  for (const child of children) {
    const value = minimax(child.result.state, depth - 1, alpha, beta, perspective, profile, options, budget, ply + 1);
    if (maximizing) {
      if (value > best) best = value;
      if (best > alpha) alpha = best;
    } else {
      if (value < best) best = value;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  return best;
}

function chooseAiCommand(state, options = {}) {
  if (!state || state.format !== 'rpchess-battle-state') throw new Error('valid battle state is required');
  if (state.status !== 'active') return Object.freeze({ command: null, reason: 'battle_completed', candidates: Object.freeze([]), nodes: 0 });
  const profile = resolveAiProfile(options.profile || 'tactician');
  const perspective = options.perspective || state.position.sideToMove;
  if (perspective !== state.position.sideToMove) throw new Error('AI perspective must match the side to move');
  const seed = options.seed ?? hash32(`${state.battleId}:${state.actionIndex}:${profile.id}`);
  const budget = createBudget(profile, options);
  const root = orderedChildren(state, perspective, options);
  if (!root.length) return Object.freeze({ command: null, reason: 'no_legal_command', candidates: Object.freeze([]), nodes: 0 });

  const candidates = [];
  let completedDepth = 0;
  let bestAtLastCompleteDepth = null;
  const targetDepth = options.depth ?? profile.depth;
  if (!Number.isInteger(targetDepth) || targetDepth < 1 || targetDepth > 5) throw new Error('AI search depth must be an integer from 1 to 5');

  for (let depth = 1; depth <= targetDepth; depth += 1) {
    const iteration = [];
    let iterationComplete = true;
    for (const child of root) {
      try {
        const baseScore = minimax(child.result.state, depth - 1, -Infinity, Infinity, perspective, profile, options, budget, 1);
        const noise = deterministicNoise(seed, child.key, profile.rootNoise);
        iteration.push(Object.freeze({ command: child.command, key: child.key, baseScore, noise, score: baseScore + noise, depth }));
      } catch (error) {
        if (error !== BUDGET_ABORT) throw error;
        iterationComplete = false;
        break;
      }
    }
    if (!iterationComplete || iteration.length !== root.length) break;
    iteration.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    completedDepth = depth;
    bestAtLastCompleteDepth = iteration[0];
    candidates.length = 0;
    candidates.push(...iteration);
  }

  if (!bestAtLastCompleteDepth) {
    const fallback = root[0];
    bestAtLastCompleteDepth = Object.freeze({
      command: fallback.command,
      key: fallback.key,
      baseScore: tacticalOrder(fallback.result, fallback.command, perspective),
      noise: deterministicNoise(seed, fallback.key, profile.rootNoise),
      score: tacticalOrder(fallback.result, fallback.command, perspective),
      depth: 0
    });
    candidates.push(bestAtLastCompleteDepth);
  }

  return Object.freeze({
    command: bestAtLastCompleteDepth.command,
    key: bestAtLastCompleteDepth.key,
    score: bestAtLastCompleteDepth.score,
    profile: profile.id,
    perspective,
    seed,
    completedDepth,
    targetDepth,
    nodes: budget.nodes,
    maxNodes: budget.maxNodes,
    abortedBy: budget.abortedBy,
    candidates: Object.freeze(candidates.slice())
  });
}

module.exports = {
  BUDGET_ABORT,
  commandKey,
  deterministicNoise,
  tacticalOrder,
  createBudget,
  resolveCommandProvider,
  resolveCommandExecutor,
  orderedChildren,
  chooseAiCommand
};
