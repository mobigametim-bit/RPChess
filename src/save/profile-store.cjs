'use strict';

const {
  CURRENT_SAVE_SCHEMA,
  createSaveEnvelope,
  serializeSaveEnvelope,
  parseSaveEnvelope
} = require('./envelope.cjs');
const { assertStorageAdapter } = require('./storage.cjs');

const PROFILE_SLOTS = Object.freeze(['profile-1', 'profile-2', 'profile-3']);
const KIND_PRIORITY = Object.freeze({ current: 3, pending: 2, backup: 1 });

function normalizeProfileId(value) {
  const profileId = Number.isInteger(value) ? `profile-${value}` : String(value || '');
  if (!PROFILE_SLOTS.includes(profileId)) throw new Error('profile must be profile-1, profile-2 or profile-3');
  return profileId;
}

function freezeArray(values) {
  return Object.freeze(values.slice());
}

class AtomicProfileStore {
  constructor(options = {}) {
    this.storage = assertStorageAdapter(options.storage);
    this.namespace = options.namespace || 'rpchess.save';
    this.deviceId = String(options.deviceId || 'unknown-device');
    this.clock = typeof options.clock === 'function' ? options.clock : Date.now;
    this.schemaVersion = options.schemaVersion ?? CURRENT_SAVE_SCHEMA;
    this.migrations = options.migrations || null;
  }

  keys(profileIdInput) {
    const profileId = normalizeProfileId(profileIdInput);
    const prefix = `${this.namespace}.${profileId}`;
    return Object.freeze({
      profileId,
      current: `${prefix}.current`,
      pending: `${prefix}.pending`,
      backup: `${prefix}.backup`
    });
  }

  readCandidate(profileId, kind) {
    const key = this.keys(profileId)[kind];
    const raw = this.storage.getItem(key);
    if (raw == null) return Object.freeze({ kind, key, exists: false, valid: false, raw: null });
    const parsed = parseSaveEnvelope(raw);
    if (!parsed.ok) return Object.freeze({ kind, key, exists: true, valid: false, raw, reason: parsed.reason, message: parsed.message || null });
    if (parsed.envelope.profileId !== profileId) {
      return Object.freeze({ kind, key, exists: true, valid: false, raw, reason: 'profile_mismatch' });
    }
    return Object.freeze({ kind, key, exists: true, valid: true, raw, envelope: parsed.envelope });
  }

  inspect(profileIdInput) {
    const profileId = normalizeProfileId(profileIdInput);
    const candidates = ['current', 'pending', 'backup'].map((kind) => this.readCandidate(profileId, kind));
    const valid = candidates.filter((candidate) => candidate.valid).sort((a, b) =>
      b.envelope.revision - a.envelope.revision
      || b.envelope.savedAt - a.envelope.savedAt
      || KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind]
    );
    return Object.freeze({
      profileId,
      candidates: freezeArray(candidates),
      best: valid[0] || null,
      corrupt: freezeArray(candidates.filter((candidate) => candidate.exists && !candidate.valid))
    });
  }

  commitEnvelope(profileIdInput, envelope) {
    const profileId = normalizeProfileId(profileIdInput);
    if (envelope.profileId !== profileId) throw new Error('envelope profile does not match target slot');
    const keys = this.keys(profileId);
    const raw = serializeSaveEnvelope(envelope);

    this.storage.setItem(keys.pending, raw);
    const staged = this.readCandidate(profileId, 'pending');
    if (!staged.valid || staged.envelope.checksum !== envelope.checksum) {
      throw new Error('pending save verification failed');
    }

    const current = this.readCandidate(profileId, 'current');
    if (current.valid) this.storage.setItem(keys.backup, current.raw);

    this.storage.setItem(keys.current, raw);
    const committed = this.readCandidate(profileId, 'current');
    if (!committed.valid || committed.envelope.checksum !== envelope.checksum) {
      throw new Error('current save verification failed');
    }
    this.storage.removeItem(keys.pending);
    return committed.envelope;
  }

  migrateIfNeeded(envelope) {
    if (envelope.schemaVersion > this.schemaVersion) {
      return Object.freeze({ ok: false, reason: 'future_schema', envelope });
    }
    if (envelope.schemaVersion === this.schemaVersion) {
      return Object.freeze({ ok: true, changed: false, envelope, applied: freezeArray([]) });
    }
    if (!this.migrations) return Object.freeze({ ok: false, reason: 'migration_required', envelope });
    try {
      const result = this.migrations.migrate(envelope, { savedAt: this.clock(), deviceId: this.deviceId });
      return Object.freeze({ ok: true, ...result });
    } catch (error) {
      return Object.freeze({ ok: false, reason: 'migration_failed', message: error.message, envelope });
    }
  }

  load(profileIdInput, options = {}) {
    const profileId = normalizeProfileId(profileIdInput);
    const inspection = this.inspect(profileId);
    if (!inspection.best) {
      return Object.freeze({
        status: inspection.corrupt.length ? 'corrupt' : 'empty',
        profileId,
        envelope: null,
        payload: null,
        recoveredFrom: null,
        diagnostics: inspection
      });
    }

    const migration = this.migrateIfNeeded(inspection.best.envelope);
    if (!migration.ok) {
      return Object.freeze({
        status: migration.reason,
        profileId,
        envelope: inspection.best.envelope,
        payload: null,
        recoveredFrom: inspection.best.kind,
        diagnostics: inspection,
        message: migration.message || null
      });
    }

    let envelope = migration.envelope;
    let status = 'loaded';
    let recoveredFrom = inspection.best.kind === 'current' ? null : inspection.best.kind;
    const repair = options.repair !== false;

    if (migration.changed) {
      envelope = this.commitEnvelope(profileId, envelope);
      status = 'migrated';
      recoveredFrom = inspection.best.kind;
    } else if (repair && inspection.best.kind !== 'current') {
      envelope = this.commitEnvelope(profileId, envelope);
      status = 'recovered';
    }

    return Object.freeze({
      status,
      profileId,
      envelope,
      payload: envelope.payload,
      recoveredFrom,
      diagnostics: inspection,
      migrations: migration.applied || freezeArray([])
    });
  }

  save(profileIdInput, payload) {
    const profileId = normalizeProfileId(profileIdInput);
    const inspection = this.inspect(profileId);
    let previous = inspection.best?.envelope || null;
    if (previous) {
      const migration = this.migrateIfNeeded(previous);
      if (!migration.ok) throw new Error(`cannot save profile with ${migration.reason}`);
      if (migration.changed) previous = this.commitEnvelope(profileId, migration.envelope);
    }

    const envelope = createSaveEnvelope({
      schemaVersion: this.schemaVersion,
      profileId,
      revision: (previous?.revision || 0) + 1,
      savedAt: this.clock(),
      deviceId: this.deviceId,
      parentChecksum: previous?.checksum || null,
      payload
    });
    return this.commitEnvelope(profileId, envelope);
  }

  delete(profileIdInput) {
    const keys = this.keys(profileIdInput);
    this.storage.removeItem(keys.current);
    this.storage.removeItem(keys.pending);
    this.storage.removeItem(keys.backup);
  }

  listProfiles() {
    return freezeArray(PROFILE_SLOTS.map((profileId) => {
      const inspection = this.inspect(profileId);
      const envelope = inspection.best?.envelope || null;
      return Object.freeze({
        profileId,
        status: envelope ? (inspection.corrupt.length ? 'available_with_diagnostics' : 'available') : (inspection.corrupt.length ? 'corrupt' : 'empty'),
        revision: envelope?.revision || 0,
        savedAt: envelope?.savedAt || null,
        schemaVersion: envelope?.schemaVersion || null,
        checksum: envelope?.checksum || null
      });
    }));
  }
}

module.exports = {
  PROFILE_SLOTS,
  normalizeProfileId,
  AtomicProfileStore
};
