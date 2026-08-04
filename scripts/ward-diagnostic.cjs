const fs = require('fs');
const path = require('path');
const { parseFen, toFen } = require('../src/core/chess/position.cjs');
const { createBattleState } = require('../src/combat/battle.cjs');
const { applyWardStatus, executeWardAwareCommand } = require('../src/combat/ward-protection.cjs');

const move = (from, to, promotion = null) => ({ type: 'MovePiece', payload: { from, to, promotion } });
const snapshot = (label, state, events = []) => ({
  label,
  fen: toFen(state.position),
  sideToMove: state.position.sideToMove,
  actionIndex: state.actionIndex,
  identities: state.identities.bySquare,
  statuses: state.statuses.entries,
  events: events.map((event) => ({ type: event.type, payload: event.payload }))
});

let state = createBattleState({
  battleId: 'ward-diagnostic', seed: 52,
  position: parseFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'),
  identitiesBySquare: { e1: 'king_w', e8: 'king_b', e4: 'pawn_w', d5: 'pawn_b' }
});
const output = [snapshot('created', state)];
state = applyWardStatus(state, 'pawn_b').state;
output.push(snapshot('ward-applied', state));
let result = executeWardAwareCommand(state, move('e4', 'd5'));
state = result.state;
output.push(snapshot('capture-prevented', state, result.events));
result = executeWardAwareCommand(state, move('e8', 'f8'));
state = result.state;
output.push(snapshot('black-king-moved', state, result.events));
result = executeWardAwareCommand(state, move('e4', 'd5'));
state = result.state;
output.push(snapshot('second-capture', state, result.events));

const target = path.resolve(__dirname, '..', 'diagnostics', 'ward-diagnostic.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(output, null, 2));
console.log(target);
