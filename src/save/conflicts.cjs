'use strict';

const { verifySaveEnvelope } = require('./envelope.cjs');

function validOrNull(envelope, side) {
  if (envelope == null) return Object.freeze({ side, exists: false, valid: false, envelope: null });
  const verified = verifySaveEnvelope(envelope);
  return verified.ok
    ? Object.freeze({ side, exists: true, valid: true, envelope: verified.envelope })
    : Object.freeze({ side, exists: true, valid: false, envelope: null, reason: verified.reason });
}

function resolveSaveConflict(localEnvelope, cloudEnvelope) {
  const local = validOrNull(localEnvelope, 'local');
  const cloud = validOrNull(cloudEnvelope, 'cloud');

  if (!local.exists && !cloud.exists) return Object.freeze({ state: 'empty', winner: null, local, cloud });
  if (local.exists && !local.valid) return Object.freeze({ state: 'invalid_local', winner: cloud.valid ? 'cloud' : null, local, cloud });
  if (cloud.exists && !cloud.valid) return Object.freeze({ state: 'invalid_cloud', winner: local.valid ? 'local' : null, local, cloud });
  if (!local.exists) return Object.freeze({ state: 'cloud_only', winner: 'cloud', local, cloud });
  if (!cloud.exists) return Object.freeze({ state: 'local_only', winner: 'local', local, cloud });

  const a = local.envelope;
  const b = cloud.envelope;
  if (a.profileId !== b.profileId) return Object.freeze({ state: 'profile_mismatch', winner: null, local, cloud });
  if (a.checksum === b.checksum) return Object.freeze({ state: 'synchronized', winner: 'either', local, cloud });
  if (a.parentChecksum === b.checksum) return Object.freeze({ state: 'local_descends_from_cloud', winner: 'local', local, cloud });
  if (b.parentChecksum === a.checksum) return Object.freeze({ state: 'cloud_descends_from_local', winner: 'cloud', local, cloud });

  const suggested = a.revision !== b.revision
    ? (a.revision > b.revision ? 'local' : 'cloud')
    : (a.savedAt > b.savedAt ? 'local' : b.savedAt > a.savedAt ? 'cloud' : null);
  return Object.freeze({
    state: 'diverged',
    winner: null,
    suggested,
    requiresUserChoice: true,
    local,
    cloud
  });
}

module.exports = { resolveSaveConflict };
