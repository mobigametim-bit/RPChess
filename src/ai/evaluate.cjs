'use strict';

const { gameStatus } = require('../core/chess/rules.cjs');
const { legalWardAwareCommands } = require('../combat/ward-protection.cjs');

const PIECE_VALUES = Object.freeze({ p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 });
const STATUS_VALUES = Object.freeze({ ward: 55, marked: -28, bound: -70, silenced: -45, cursed: -52, provoked: -18 });

function sideSign(side, perspective) {
  return side === perspective ? 1 : -1;
}

function terminalScore(state, perspective, ply = 0) {
  if (state.status !== 'completed') return null;
  const winner = state.result && state.result.winner;
  if (!winner) return 0;
  return winner === perspective ? 100000 - ply : -100000 + ply;
}

function materialScore(state, perspective) {
  let score = 0;
  for (const piece of state.position.board) {
    if (!piece) continue;
    score += sideSign(piece.side, perspective) * PIECE_VALUES[piece.type];
  }
  return score;
}

function reserveScore(state, perspective, discount = 0.85) {
  let score = 0;
  for (const entry of state.reserve || []) {
    const value = PIECE_VALUES[entry.type] || 0;
    score += sideSign(entry.side, perspective) * value * discount;
  }
  return score;
}

function orderPointScore(state, perspective) {
  const own = state.orderPoints?.[perspective]?.current || 0;
  const otherSide = perspective === 'w' ? 'b' : 'w';
  const enemy = state.orderPoints?.[otherSide]?.current || 0;
  return (own - enemy) * 18;
}

function statusScore(state, perspective, weight = 22) {
  let score = 0;
  for (const [pieceId, status] of Object.entries(state.statuses?.byPiece || {})) {
    const side = state.identities?.metadata?.[pieceId]?.side;
    if (!side) continue;
    const value = STATUS_VALUES[status.id] ?? 0;
    score += sideSign(side, perspective) * value * (weight / 22);
  }
  return score;
}

function checkScore(state, perspective) {
  const status = gameStatus(state.position);
  if (status.state !== 'check') return 0;
  return state.position.sideToMove === perspective ? -42 : 42;
}

function mobilityScore(state, perspective, weight = 3) {
  if (state.status !== 'active') return 0;
  const commandCount = legalWardAwareCommands(state).length;
  return (state.position.sideToMove === perspective ? commandCount : -commandCount) * weight;
}

function evaluateBattleState(state, perspective, options = {}) {
  if (!['w', 'b'].includes(perspective)) throw new Error('evaluation perspective must be w or b');
  const terminal = terminalScore(state, perspective, options.ply || 0);
  if (terminal !== null) return terminal;
  let score = 0;
  score += materialScore(state, perspective);
  score += reserveScore(state, perspective, options.reserveDiscount ?? 0.85);
  score += orderPointScore(state, perspective);
  score += statusScore(state, perspective, options.statusWeight ?? 22);
  score += checkScore(state, perspective);
  score += mobilityScore(state, perspective, options.mobilityWeight ?? 3);
  if (typeof options.objectiveEvaluator === 'function') {
    const objective = Number(options.objectiveEvaluator(state, perspective));
    if (!Number.isFinite(objective)) throw new Error('objective evaluator must return a finite number');
    score += objective;
  }
  return score;
}

module.exports = {
  PIECE_VALUES,
  STATUS_VALUES,
  terminalScore,
  materialScore,
  reserveScore,
  orderPointScore,
  statusScore,
  checkScore,
  mobilityScore,
  evaluateBattleState
};
