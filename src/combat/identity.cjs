'use strict';

const { DeterministicIdFactory } = require('../core/determinism.cjs');
const { squareToIndex, indexToSquare, coordinates, indexOf } = require('../core/chess/position.cjs');

function freezeRecord(record) {
  return Object.freeze({ ...record });
}

function normalizedMetadata(base, identity) {
  return Object.freeze({
    ...base,
    id: identity.id,
    side: identity.side,
    initialType: base.initialType || identity.initialType,
    currentType: base.currentType || identity.currentType,
    source: identity.source
  });
}

function createPieceIdentities(position, options = {}) {
  const provided = options.bySquare || {};
  const factory = new DeterministicIdFactory(`${options.battleId || 'battle'}_units`, options.seed || 1);
  const bySquare = {};
  const metadata = {};
  const usedIds = new Set();

  for (let index = 0; index < 64; index += 1) {
    const boardPiece = position.board[index];
    if (!boardPiece) continue;
    const square = indexToSquare(index);
    const providedId = provided[square];
    const id = providedId || factory.next(`${boardPiece.side}_${boardPiece.type}`);
    if (typeof id !== 'string' || !id) throw new TypeError(`invalid piece id on ${square}`);
    if (usedIds.has(id)) throw new Error(`duplicate piece id: ${id}`);
    usedIds.add(id);
    bySquare[square] = id;
    metadata[id] = normalizedMetadata(
      options.metadata && options.metadata[id] ? options.metadata[id] : {},
      {
        id,
        side: boardPiece.side,
        initialType: boardPiece.type,
        currentType: boardPiece.type,
        source: providedId ? 'provided' : 'generated'
      }
    );
  }

  for (const square of Object.keys(provided)) {
    const normalized = indexToSquare(squareToIndex(square));
    if (!position.board[squareToIndex(normalized)]) throw new Error(`identity provided for empty square: ${normalized}`);
  }

  return Object.freeze({
    format: 'rpchess-piece-identities',
    bySquare: freezeRecord(bySquare),
    metadata: freezeRecord(metadata)
  });
}

function identityAt(identities, square) {
  return identities.bySquare[indexToSquare(squareToIndex(square))] || null;
}

function metadataFor(identities, pieceId) {
  return identities.metadata[pieceId] || null;
}

function movePieceIdentities(identities, beforePosition, move) {
  const from = indexToSquare(squareToIndex(move.from));
  const to = indexToSquare(squareToIndex(move.to));
  const movingId = identities.bySquare[from];
  if (!movingId) throw new Error(`piece identity missing on ${from}`);

  const bySquare = { ...identities.bySquare };
  const metadata = { ...identities.metadata };
  let capturedId = bySquare[to] || null;
  let capturedSquare = capturedId ? to : null;
  delete bySquare[from];

  if (move.enPassant) {
    const toIndex = squareToIndex(to);
    const { x, y } = coordinates(toIndex);
    const captureIndex = indexOf(x, y + (beforePosition.sideToMove === 'w' ? 1 : -1));
    capturedSquare = indexToSquare(captureIndex);
    capturedId = bySquare[capturedSquare] || null;
    delete bySquare[capturedSquare];
  } else {
    delete bySquare[to];
  }

  bySquare[to] = movingId;
  if (move.promotion) metadata[movingId] = Object.freeze({ ...metadata[movingId], currentType: move.promotion });

  let rookMove = null;
  if (move.castle) {
    const rank = beforePosition.sideToMove === 'w' ? '1' : '8';
    const rookFrom = `${move.castle === 'king' ? 'h' : 'a'}${rank}`;
    const rookTo = `${move.castle === 'king' ? 'f' : 'd'}${rank}`;
    const rookId = bySquare[rookFrom];
    if (!rookId) throw new Error(`castling rook identity missing on ${rookFrom}`);
    delete bySquare[rookFrom];
    bySquare[rookTo] = rookId;
    rookMove = Object.freeze({ id: rookId, from: rookFrom, to: rookTo });
  }

  return Object.freeze({
    identities: Object.freeze({
      format: identities.format,
      bySquare: freezeRecord(bySquare),
      metadata: freezeRecord(metadata)
    }),
    movedId: movingId,
    capturedId,
    capturedSquare,
    rookMove
  });
}

function deployReserveIdentity(identities, entry, square) {
  const target = indexToSquare(squareToIndex(square));
  if (identities.bySquare[target]) throw new Error(`identity square occupied: ${target}`);
  if (identities.metadata[entry.id]) throw new Error(`piece identity already active: ${entry.id}`);
  return Object.freeze({
    format: identities.format,
    bySquare: freezeRecord({ ...identities.bySquare, [target]: entry.id }),
    metadata: freezeRecord({
      ...identities.metadata,
      [entry.id]: normalizedMetadata(entry.metadata || {}, {
        id: entry.id,
        side: entry.side,
        initialType: entry.type,
        currentType: entry.type,
        source: 'reserve'
      })
    })
  });
}

module.exports = {
  createPieceIdentities,
  identityAt,
  metadataFor,
  movePieceIdentities,
  deployReserveIdentity
};
