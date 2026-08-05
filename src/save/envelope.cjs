'use strict';

const { normalizeJson, stableStringify, sha256 } = require('./checksum.cjs');

const CURRENT_SAVE_SCHEMA = 1;

function envelopeBody(input) {
  return {
    schemaVersion: input.schemaVersion,
    profileId: input.profileId,
    revision: input.revision,
    savedAt: input.savedAt,
    deviceId: input.deviceId,
    parentChecksum: input.parentChecksum || null,
    payload: input.payload
  };
}

function validateEnvelopeShape(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('save envelope must be an object');
  if (!Number.isInteger(envelope.schemaVersion) || envelope.schemaVersion < 1) throw new Error('invalid save schemaVersion');
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(String(envelope.profileId || ''))) throw new Error('invalid profileId');
  if (!Number.isInteger(envelope.revision) || envelope.revision < 1) throw new Error('invalid save revision');
  if (!Number.isInteger(envelope.savedAt) || envelope.savedAt < 0) throw new Error('invalid savedAt');
  if (typeof envelope.deviceId !== 'string' || !envelope.deviceId.trim()) throw new Error('invalid deviceId');
  if (envelope.parentChecksum !== null && !/^[a-f0-9]{64}$/.test(String(envelope.parentChecksum))) throw new Error('invalid parentChecksum');
  if (!/^[a-f0-9]{64}$/.test(String(envelope.checksum || ''))) throw new Error('invalid checksum');
  normalizeJson(envelope.payload);
  return envelope;
}

function createSaveEnvelope(options = {}) {
  const body = envelopeBody({
    schemaVersion: options.schemaVersion ?? CURRENT_SAVE_SCHEMA,
    profileId: options.profileId,
    revision: options.revision,
    savedAt: options.savedAt ?? Date.now(),
    deviceId: options.deviceId,
    parentChecksum: options.parentChecksum || null,
    payload: normalizeJson(options.payload)
  });
  const envelope = Object.freeze({ ...body, checksum: sha256(body) });
  validateEnvelopeShape(envelope);
  return envelope;
}

function verifySaveEnvelope(envelope, options = {}) {
  try {
    validateEnvelopeShape(envelope);
    const expected = sha256(envelopeBody(envelope));
    if (expected !== envelope.checksum) return Object.freeze({ ok: false, reason: 'checksum_mismatch' });
    if (options.maxSchemaVersion && envelope.schemaVersion > options.maxSchemaVersion) {
      return Object.freeze({ ok: false, reason: 'future_schema' });
    }
    return Object.freeze({ ok: true, envelope: Object.freeze(normalizeJson(envelope)) });
  } catch (error) {
    return Object.freeze({ ok: false, reason: 'invalid_shape', message: error.message });
  }
}

function serializeSaveEnvelope(envelope) {
  const verified = verifySaveEnvelope(envelope);
  if (!verified.ok) throw new Error(`cannot serialize invalid save envelope: ${verified.reason}`);
  return stableStringify(envelope);
}

function parseSaveEnvelope(text, options = {}) {
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch (error) {
    return Object.freeze({ ok: false, reason: 'invalid_json', message: error.message });
  }
  return verifySaveEnvelope(parsed, options);
}

module.exports = {
  CURRENT_SAVE_SCHEMA,
  envelopeBody,
  validateEnvelopeShape,
  createSaveEnvelope,
  verifySaveEnvelope,
  serializeSaveEnvelope,
  parseSaveEnvelope
};
