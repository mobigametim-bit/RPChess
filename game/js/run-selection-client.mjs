const SNAPSHOT_FORMAT = 'rpchess-run-selection-host-snapshot';
const COMMANDS = Object.freeze(['SelectKing', 'SelectDoctrine', 'ToggleHero', 'LockSelection']);

function validateRunSelectionSnapshot(snapshot) {
  if (!snapshot || snapshot.format !== SNAPSHOT_FORMAT || snapshot.schemaVersion !== 1) throw new Error('invalid run selection host snapshot');
  if (!['selecting', 'locked', 'ready'].includes(snapshot.status)) throw new Error(`invalid run selection status: ${snapshot.status}`);
  if (!snapshot.selection || snapshot.selection.format !== 'rpchess-run-selection-presenter') throw new Error('run selection presenter payload is missing');
  if (!Array.isArray(snapshot.selection.kings) || !Array.isArray(snapshot.selection.doctrines) || !Array.isArray(snapshot.selection.heroes)) throw new Error('run selection catalog is incomplete');
  if (snapshot.status === 'ready' && !snapshot.runtime) throw new Error('ready run selection is missing runtime snapshot');
  return snapshot;
}

function normalizeRunSelectionCommand(command) {
  if (!command || typeof command !== 'object') throw new Error('run selection command is required');
  const type = String(command.type || '');
  if (!COMMANDS.includes(type)) throw new Error(`unsupported run selection command: ${type}`);
  if (type === 'SelectKing') {
    const kingId = String(command.kingId || command.payload?.kingId || '');
    if (!kingId) throw new Error('SelectKing requires kingId');
    return Object.freeze({ type, kingId });
  }
  if (type === 'SelectDoctrine') {
    const doctrineId = String(command.doctrineId || command.payload?.doctrineId || '');
    if (!doctrineId) throw new Error('SelectDoctrine requires doctrineId');
    return Object.freeze({ type, doctrineId });
  }
  if (type === 'ToggleHero') {
    const heroId = String(command.heroId || command.payload?.heroId || '');
    if (!heroId) throw new Error('ToggleHero requires heroId');
    return Object.freeze({ type, heroId });
  }
  return Object.freeze({ type });
}

class RunSelectionClient extends EventTarget {
  constructor(options = {}) {
    super();
    if (typeof options.transport !== 'function') throw new Error('RunSelectionClient requires transport');
    this.transport = options.transport;
    this.snapshot = options.snapshot ? validateRunSelectionSnapshot(options.snapshot) : null;
    this.pending = false;
  }

  getSnapshot() { return this.snapshot; }

  setSnapshot(snapshot) {
    this.snapshot = validateRunSelectionSnapshot(snapshot);
    this.dispatchEvent(new CustomEvent('snapshot', { detail: this.snapshot }));
    return this.snapshot;
  }

  async dispatch(commandInput) {
    if (this.pending) throw new Error('a run selection command is already pending');
    const command = normalizeRunSelectionCommand(commandInput);
    this.pending = true;
    this.dispatchEvent(new CustomEvent('pending', { detail: { pending: true, command } }));
    try {
      const response = await this.transport(command);
      const snapshot = validateRunSelectionSnapshot(response?.snapshot || response);
      this.snapshot = snapshot;
      this.dispatchEvent(new CustomEvent('snapshot', { detail: snapshot }));
      if (snapshot.status === 'ready') this.dispatchEvent(new CustomEvent('ready', { detail: snapshot.runtime }));
      return snapshot;
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: { command, error } }));
      throw error;
    } finally {
      this.pending = false;
      this.dispatchEvent(new CustomEvent('pending', { detail: { pending: false, command } }));
    }
  }
}

function createRunSelectionTransport(host) {
  if (!host || typeof host.dispatch !== 'function') throw new Error('run selection host must expose dispatch');
  return async (command) => host.dispatch(command);
}

export {
  SNAPSHOT_FORMAT,
  COMMANDS,
  validateRunSelectionSnapshot,
  normalizeRunSelectionCommand,
  RunSelectionClient,
  createRunSelectionTransport
};
