'use strict';

const { createSaveEnvelope, verifySaveEnvelope } = require('./envelope.cjs');

class SaveMigrationRegistry {
  constructor(targetVersion) {
    if (!Number.isInteger(targetVersion) || targetVersion < 1) throw new Error('targetVersion must be a positive integer');
    this.targetVersion = targetVersion;
    this.steps = new Map();
  }

  register(fromVersion, migrate) {
    if (!Number.isInteger(fromVersion) || fromVersion < 1) throw new Error('fromVersion must be a positive integer');
    if (fromVersion >= this.targetVersion) throw new Error('migration must lead toward targetVersion');
    if (typeof migrate !== 'function') throw new Error('migration must be a function');
    if (this.steps.has(fromVersion)) throw new Error(`migration already registered for version ${fromVersion}`);
    this.steps.set(fromVersion, migrate);
    return this;
  }

  canMigrate(fromVersion) {
    if (!Number.isInteger(fromVersion) || fromVersion < 1 || fromVersion > this.targetVersion) return false;
    for (let version = fromVersion; version < this.targetVersion; version += 1) {
      if (!this.steps.has(version)) return false;
    }
    return true;
  }

  migrate(envelope, options = {}) {
    const verified = verifySaveEnvelope(envelope);
    if (!verified.ok) throw new Error(`cannot migrate invalid save: ${verified.reason}`);
    if (envelope.schemaVersion > this.targetVersion) throw new Error('cannot downgrade a future save schema');
    if (envelope.schemaVersion === this.targetVersion) {
      return Object.freeze({ envelope, applied: Object.freeze([]), changed: false });
    }
    if (!this.canMigrate(envelope.schemaVersion)) {
      throw new Error(`missing migration path from ${envelope.schemaVersion} to ${this.targetVersion}`);
    }

    let payload = envelope.payload;
    const applied = [];
    for (let version = envelope.schemaVersion; version < this.targetVersion; version += 1) {
      payload = this.steps.get(version)(payload, Object.freeze({
        fromVersion: version,
        toVersion: version + 1,
        profileId: envelope.profileId
      }));
      applied.push(Object.freeze({ fromVersion: version, toVersion: version + 1 }));
    }

    const migrated = createSaveEnvelope({
      schemaVersion: this.targetVersion,
      profileId: envelope.profileId,
      revision: envelope.revision + 1,
      savedAt: options.savedAt ?? Date.now(),
      deviceId: options.deviceId || envelope.deviceId,
      parentChecksum: envelope.checksum,
      payload
    });
    return Object.freeze({ envelope: migrated, applied: Object.freeze(applied), changed: true });
  }
}

module.exports = { SaveMigrationRegistry };
