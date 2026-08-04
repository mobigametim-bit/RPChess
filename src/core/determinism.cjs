'use strict';

const FALLBACK_SEED = 0x6d2b79f5;
const normalizeSeed = (seed) => ((Number(seed) >>> 0) || FALLBACK_SEED);

function hash32(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || FALLBACK_SEED;
}

function deriveSeed(rootSeed, streamName, version = 1) {
  if (typeof streamName !== 'string' || !streamName) throw new TypeError('stream name is required');
  return hash32(`${version}:${normalizeSeed(rootSeed)}:${streamName}`);
}

class XorShift32 {
  constructor(seed) { this.state = normalizeSeed(seed); }
  nextU32() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }
  float() { return this.nextU32() / 4294967296; }
  int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new RangeError('invalid integer range');
    return min + Math.floor(this.float() * (max - min + 1));
  }
  pick(items) {
    if (!Array.isArray(items) || !items.length) throw new RangeError('pick requires a non-empty array');
    return items[Math.floor(this.float() * items.length)];
  }
  shuffle(items) {
    if (!Array.isArray(items)) throw new TypeError('shuffle requires an array');
    const output = items.slice();
    for (let index = output.length - 1; index > 0; index -= 1) {
      const swap = this.int(0, index);
      [output[index], output[swap]] = [output[swap], output[index]];
    }
    return output;
  }
  snapshot() { return { algorithm: 'xorshift32', state: this.state >>> 0 }; }
  restore(snapshot) {
    if (!snapshot || snapshot.algorithm !== 'xorshift32') throw new TypeError('invalid RNG snapshot');
    this.state = normalizeSeed(snapshot.state);
    return this;
  }
}

class RngStreams {
  constructor(rootSeed, version = 1) {
    this.rootSeed = normalizeSeed(rootSeed);
    this.version = version;
    this.streams = new Map();
  }
  get(name) {
    if (!this.streams.has(name)) this.streams.set(name, new XorShift32(deriveSeed(this.rootSeed, name, this.version)));
    return this.streams.get(name);
  }
  snapshot() {
    const streams = {};
    for (const name of [...this.streams.keys()].sort()) streams[name] = this.streams.get(name).snapshot();
    return { format: 'rpchess-rng-streams', rootSeed: this.rootSeed, version: this.version, streams };
  }
  restore(snapshot) {
    if (!snapshot || snapshot.format !== 'rpchess-rng-streams') throw new TypeError('invalid stream snapshot');
    if (normalizeSeed(snapshot.rootSeed) !== this.rootSeed || snapshot.version !== this.version) throw new Error('stream snapshot mismatch');
    this.streams.clear();
    for (const name of Object.keys(snapshot.streams || {}).sort()) {
      this.streams.set(name, new XorShift32(1).restore(snapshot.streams[name]));
    }
    return this;
  }
}

const cleanIdPart = (value) => String(value || 'id').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'id';

class DeterministicIdFactory {
  constructor(namespace, seed, counters = {}) {
    this.namespace = cleanIdPart(namespace);
    this.seed = normalizeSeed(seed);
    this.counters = new Map(Object.entries(counters).map(([key, value]) => [cleanIdPart(key), value]));
  }
  next(prefix = 'id') {
    const key = cleanIdPart(prefix);
    const counter = this.counters.get(key) || 0;
    this.counters.set(key, counter + 1);
    return `${this.namespace}_${this.seed.toString(36)}_${key}_${counter.toString(36)}`;
  }
  snapshot() {
    return {
      format: 'rpchess-id-factory',
      namespace: this.namespace,
      seed: this.seed,
      counters: Object.fromEntries([...this.counters.entries()].sort(([a], [b]) => a.localeCompare(b)))
    };
  }
  static fromSnapshot(snapshot) {
    if (!snapshot || snapshot.format !== 'rpchess-id-factory') throw new TypeError('invalid ID snapshot');
    return new DeterministicIdFactory(snapshot.namespace, snapshot.seed, snapshot.counters);
  }
}

module.exports = { FALLBACK_SEED, normalizeSeed, hash32, deriveSeed, XorShift32, RngStreams, DeterministicIdFactory };
