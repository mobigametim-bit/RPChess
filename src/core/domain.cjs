'use strict';

function freezeCopy(value) {
  if (value === null || typeof value !== 'object') return value;
  const copy = Array.isArray(value)
    ? value.map(freezeCopy)
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freezeCopy(item)]));
  return Object.freeze(copy);
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

class DomainEnvelopeFactory {
  constructor(options) {
    if (!options || !options.idFactory) throw new TypeError('idFactory is required');
    this.idFactory = options.idFactory;
    this.sequence = Number.isSafeInteger(options.sequence) && options.sequence >= 0 ? options.sequence : 0;
  }

  command(type, payload = {}, metadata = {}) {
    return this.create('command', type, payload, metadata);
  }

  event(type, payload = {}, metadata = {}) {
    return this.create('event', type, payload, metadata);
  }

  create(kind, type, payload, metadata) {
    const sequence = this.sequence;
    this.sequence += 1;
    return Object.freeze({
      format: `rpchess-domain-${kind}`,
      schemaVersion: 1,
      id: this.idFactory.next(kind),
      sequence,
      type: requireText(type, 'type'),
      payload: freezeCopy(payload || {}),
      metadata: freezeCopy(metadata || {})
    });
  }

  snapshot() {
    return {
      format: 'rpchess-domain-envelope-factory',
      sequence: this.sequence,
      idFactory: this.idFactory.snapshot()
    };
  }
}

module.exports = { freezeCopy, DomainEnvelopeFactory };
