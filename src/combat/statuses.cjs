'use strict';

const STATUS_DEFINITIONS = Object.freeze({
  ward: Object.freeze({ id: 'ward', category: 'primary', visible: true, geometryChange: false, defaultExpiry: null, consumable: true }),
  evasion: Object.freeze({ id: 'evasion', category: 'primary', visible: true, geometryChange: false, defaultExpiry: null, consumable: true }),
  guarded: Object.freeze({ id: 'guarded', category: 'primary', visible: true, geometryChange: false, defaultExpiry: null, consumable: true }),
  offered: Object.freeze({ id: 'offered', category: 'primary', visible: true, geometryChange: false, defaultExpiry: Object.freeze({ kind: 'actions', remaining: 2 }), consumable: false }),
  marked: Object.freeze({ id: 'marked', category: 'primary', visible: true, geometryChange: false, defaultExpiry: Object.freeze({ kind: 'side_actions', remaining: 2 }), consumable: false }),
  bound: Object.freeze({ id: 'bound', category: 'primary', visible: true, geometryChange: false, defaultExpiry: Object.freeze({ kind: 'side_actions', remaining: 1 }), consumable: false }),
  silenced: Object.freeze({ id: 'silenced', category: 'primary', visible: true, geometryChange: false, defaultExpiry: Object.freeze({ kind: 'side_actions', remaining: 2 }), consumable: false }),
  cursed: Object.freeze({ id: 'cursed', category: 'primary', visible: true, geometryChange: false, defaultExpiry: null, consumable: false }),
  provoked: Object.freeze({ id: 'provoked', category: 'primary', visible: true, geometryChange: false, defaultExpiry: Object.freeze({ kind: 'side_actions', remaining: 1 }), consumable: false })
});

function cloneExpiry(expiry) {
  if (expiry == null) return null;
  if (!['actions', 'side_actions', 'piece_actions'].includes(expiry.kind)) throw new Error(`unsupported status expiry kind: ${expiry.kind}`);
  if (!Number.isInteger(expiry.remaining) || expiry.remaining <= 0) throw new RangeError('status expiry remaining must be a positive integer');
  return Object.freeze({ kind: expiry.kind, remaining: expiry.remaining });
}

function freezeEntries(entries) {
  return Object.freeze(Object.fromEntries(Object.entries(entries).map(([pieceId, status]) => [pieceId, Object.freeze({ ...status })])));
}

function createStatusState(initial = {}) {
  const entries = {};
  for (const [pieceId, raw] of Object.entries(initial.entries || initial)) {
    if (!raw) continue;
    const definition = STATUS_DEFINITIONS[raw.id];
    if (!definition) throw new Error(`unknown status: ${raw.id}`);
    entries[pieceId] = Object.freeze({
      pieceId,
      id: definition.id,
      sourceId: raw.sourceId || null,
      appliedAtAction: Number.isInteger(raw.appliedAtAction) ? raw.appliedAtAction : 0,
      expiry: cloneExpiry(Object.prototype.hasOwnProperty.call(raw, 'expiry') ? raw.expiry : definition.defaultExpiry),
      data: Object.freeze({ ...(raw.data || {}) })
    });
  }
  return Object.freeze({ format: 'rpchess-status-state', entries: freezeEntries(entries) });
}

function statusFor(state, pieceId) {
  if (!state || state.format !== 'rpchess-status-state') throw new TypeError('invalid status state');
  return state.entries[pieceId] || null;
}

function hasStatus(state, pieceId, statusId = null) {
  const status = statusFor(state, pieceId);
  return Boolean(status && (statusId == null || status.id === statusId));
}

function applyPrimaryStatus(state, pieceId, statusId, options = {}) {
  if (!pieceId || typeof pieceId !== 'string') throw new TypeError('pieceId is required');
  const definition = STATUS_DEFINITIONS[statusId];
  if (!definition || definition.category !== 'primary') throw new Error(`unknown primary status: ${statusId}`);
  const current = statusFor(state, pieceId);
  if (current && !options.replace) throw new Error(`${pieceId} already has primary status ${current.id}`);
  const nextStatus = Object.freeze({
    pieceId,
    id: statusId,
    sourceId: options.sourceId || null,
    appliedAtAction: Number.isInteger(options.actionIndex) ? options.actionIndex : 0,
    expiry: cloneExpiry(Object.prototype.hasOwnProperty.call(options, 'expiry') ? options.expiry : definition.defaultExpiry),
    data: Object.freeze({ ...(options.data || {}) })
  });
  const next = createStatusState({ entries: { ...state.entries, [pieceId]: nextStatus } });
  return Object.freeze({ state: next, applied: nextStatus, replaced: current || null });
}

function removeStatus(state, pieceId, reason = 'removed') {
  const current = statusFor(state, pieceId);
  if (!current) return Object.freeze({ state, removed: null, reason });
  const entries = { ...state.entries };
  delete entries[pieceId];
  return Object.freeze({ state: createStatusState({ entries }), removed: current, reason });
}

function consumeStatus(state, pieceId, expectedId = null, reason = 'consumed') {
  const current = statusFor(state, pieceId);
  if (!current) throw new Error(`${pieceId} has no status to consume`);
  if (expectedId && current.id !== expectedId) throw new Error(`${pieceId} has ${current.id}, expected ${expectedId}`);
  if (!STATUS_DEFINITIONS[current.id].consumable) throw new Error(`${current.id} is not consumable`);
  return removeStatus(state, pieceId, reason);
}

function shouldTick(status, context) {
  if (!status.expiry) return false;
  if (status.expiry.kind === 'actions') return true;
  if (status.expiry.kind === 'piece_actions') return context.actedPieceId === status.pieceId;
  if (status.expiry.kind === 'side_actions') return context.sideByPiece[status.pieceId] === context.actingSide;
  return false;
}

function advanceStatuses(state, context) {
  if (!context || !['w', 'b'].includes(context.actingSide)) throw new TypeError('actingSide is required');
  const entries = {};
  const expired = [];
  const changed = [];
  for (const [pieceId, status] of Object.entries(state.entries)) {
    if (!shouldTick(status, context)) {
      entries[pieceId] = status;
      continue;
    }
    const remaining = status.expiry.remaining - 1;
    if (remaining <= 0) {
      expired.push(Object.freeze({ ...status, expirationReason: status.expiry.kind }));
      continue;
    }
    const updated = Object.freeze({ ...status, expiry: Object.freeze({ ...status.expiry, remaining }) });
    entries[pieceId] = updated;
    changed.push(updated);
  }
  return Object.freeze({
    state: createStatusState({ entries }),
    expired: Object.freeze(expired),
    changed: Object.freeze(changed)
  });
}

function statusView(state, pieceId) {
  const status = statusFor(state, pieceId);
  if (!status) return null;
  const definition = STATUS_DEFINITIONS[status.id];
  return Object.freeze({
    id: status.id,
    visible: definition.visible,
    geometryChange: definition.geometryChange,
    remaining: status.expiry ? status.expiry.remaining : null,
    expiryKind: status.expiry ? status.expiry.kind : null,
    sourceId: status.sourceId
  });
}

module.exports = {
  STATUS_DEFINITIONS,
  createStatusState,
  statusFor,
  hasStatus,
  applyPrimaryStatus,
  removeStatus,
  consumeStatus,
  advanceStatuses,
  statusView
};
