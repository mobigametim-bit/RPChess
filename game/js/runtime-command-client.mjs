const SNAPSHOT_FORMAT = 'rpchess-presenter-snapshot';
const SNAPSHOT_SCHEMA_VERSION = 1;
const CLIENT_COMMANDS = Object.freeze([
  'Travel',
  'PlaceDeploymentUnit',
  'RemoveDeploymentUnit',
  'ConfirmDeployment',
  'ChooseEvent',
  'PlayerCommand',
  'BeginBossPhase',
  'ClaimReward',
  'SaveCheckpoint'
]);

function validatePresenterSnapshot(snapshot) {
  if (!snapshot || snapshot.format !== SNAPSHOT_FORMAT) throw new Error('invalid RPChess presenter snapshot');
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) throw new Error('unsupported RPChess presenter snapshot schema');
  if (!['campaign', 'deployment', 'event', 'scenario', 'boss', 'boss_transition', 'reward', 'complete', 'failed'].includes(snapshot.status)) {
    throw new Error(`invalid presenter status: ${snapshot.status}`);
  }
  if (!snapshot.campaign || !Array.isArray(snapshot.campaign.nodes) || !Array.isArray(snapshot.campaign.routes)) {
    throw new Error('presenter snapshot is missing campaign data');
  }
  if (snapshot.status === 'deployment' && (!snapshot.deployment || !snapshot.scenario)) throw new Error('presenter deployment snapshot is incomplete');
  if (snapshot.status === 'event' && (!snapshot.event || !Array.isArray(snapshot.event.choices))) {
    throw new Error('presenter event snapshot is missing choices');
  }
  if (['boss', 'boss_transition'].includes(snapshot.status) && !snapshot.boss) {
    throw new Error('presenter boss snapshot is missing phase data');
  }
  if (snapshot.status === 'boss' && !snapshot.scenario) {
    throw new Error('presenter boss snapshot is missing active scenario data');
  }
  return snapshot;
}

function normalizeClientCommand(command) {
  if (!command || typeof command !== 'object') throw new Error('runtime command is required');
  const type = String(command.type || '');
  if (!CLIENT_COMMANDS.includes(type)) throw new Error(`unsupported runtime command: ${type}`);
  if (type === 'Travel') {
    const targetNodeId = String(command.targetNodeId || command.payload?.targetNodeId || '');
    if (!targetNodeId) throw new Error('Travel requires targetNodeId');
    return Object.freeze({ type, targetNodeId });
  }
  if (type === 'PlaceDeploymentUnit') {
    const unitId = String(command.unitId || command.payload?.unitId || '');
    const square = String(command.square || command.payload?.square || '');
    if (!unitId || !square) throw new Error('PlaceDeploymentUnit requires unitId and square');
    return Object.freeze({ type, payload: Object.freeze({ unitId, square }) });
  }
  if (type === 'RemoveDeploymentUnit') {
    const unitId = String(command.unitId || command.payload?.unitId || '');
    if (!unitId) throw new Error('RemoveDeploymentUnit requires unitId');
    return Object.freeze({ type, payload: Object.freeze({ unitId }) });
  }
  if (type === 'ChooseEvent') {
    const choiceId = String(command.choiceId || command.payload?.choiceId || '');
    if (!choiceId) throw new Error('ChooseEvent requires choiceId');
    return Object.freeze({ type, choiceId });
  }
  if (type === 'PlayerCommand') {
    const request = command.request || command.payload?.request;
    if (!request || typeof request.type !== 'string') throw new Error('PlayerCommand requires request');
    return Object.freeze({
      type,
      request: Object.freeze({
        type: request.type,
        payload: Object.freeze({ ...(request.payload || {}) })
      })
    });
  }
  return Object.freeze({ type });
}

class RuntimeCommandClient extends EventTarget {
  constructor(options = {}) {
    super();
    if (typeof options.transport !== 'function') throw new Error('RuntimeCommandClient requires a transport function');
    this.transport = options.transport;
    this.snapshot = options.snapshot ? validatePresenterSnapshot(options.snapshot) : null;
    this.pending = false;
    this.sequence = 0;
  }

  getSnapshot() {
    return this.snapshot;
  }

  setSnapshot(snapshot) {
    this.snapshot = validatePresenterSnapshot(snapshot);
    this.dispatchEvent(new CustomEvent('snapshot', { detail: this.snapshot }));
    return this.snapshot;
  }

  async dispatch(commandInput) {
    if (this.pending) throw new Error('a runtime command is already pending');
    const command = normalizeClientCommand(commandInput);
    const sequence = ++this.sequence;
    this.pending = true;
    this.dispatchEvent(new CustomEvent('pending', { detail: { pending: true, command, sequence } }));
    try {
      const response = await this.transport(command, { sequence, snapshot: this.snapshot });
      const snapshot = validatePresenterSnapshot(response?.snapshot || response);
      this.snapshot = snapshot;
      this.dispatchEvent(new CustomEvent('snapshot', { detail: snapshot }));
      this.dispatchEvent(new CustomEvent('resolved', { detail: { command, sequence, response, snapshot } }));
      return snapshot;
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: { command, sequence, error } }));
      throw error;
    } finally {
      this.pending = false;
      this.dispatchEvent(new CustomEvent('pending', { detail: { pending: false, command, sequence } }));
    }
  }
}

function createLocalRuntimeTransport(host) {
  if (!host || typeof host.dispatch !== 'function') throw new Error('local runtime host must expose dispatch(command)');
  return async (command) => host.dispatch(command);
}

export {
  SNAPSHOT_FORMAT,
  SNAPSHOT_SCHEMA_VERSION,
  CLIENT_COMMANDS,
  validatePresenterSnapshot,
  normalizeClientCommand,
  RuntimeCommandClient,
  createLocalRuntimeTransport
};
