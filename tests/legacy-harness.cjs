const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
  clear() { this.values.clear(); }
}

function loadLegacyRuntime(options = {}) {
  const root = options.root || path.resolve(__dirname, '..', 'game');
  const storage = options.storage || new MemoryStorage();
  const window = {};
  const context = vm.createContext({
    window,
    localStorage: storage,
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Object,
    Array,
    Set,
    Map,
    Number,
    String,
    Boolean,
    Error
  });
  window.window = window;
  window.localStorage = storage;

  for (const relative of ['js/data.js', 'js/core.js']) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    vm.runInContext(source, context, { filename: relative });
  }

  if (!window.NC_DATA || !window.NC) {
    throw new Error('Legacy RPChess runtime failed to initialize.');
  }

  return {
    NC: window.NC,
    data: window.NC_DATA,
    storage,
    window,
    context
  };
}

function normalizeChoices(choices) {
  return choices.map(({ type, danger, secret, seed }) => ({ type, danger, secret, seed }));
}

function normalizeBattle(battle) {
  return {
    size: battle.size,
    seed: battle.seed,
    objectiveType: battle.objectiveType,
    phase: battle.phase,
    round: battle.round,
    blocked: [...battle.blocked].sort(),
    units: battle.units.map((unit) => ({
      type: unit.type,
      team: unit.team,
      x: unit.x,
      y: unit.y,
      level: unit.level,
      phases: unit.phases,
      shield: unit.shield
    })).sort((a, b) => `${a.team}:${a.type}:${a.x}:${a.y}`.localeCompare(`${b.team}:${b.type}:${b.x}:${b.y}`))
  };
}

module.exports = {
  MemoryStorage,
  loadLegacyRuntime,
  normalizeChoices,
  normalizeBattle
};
