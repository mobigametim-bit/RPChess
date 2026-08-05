'use strict';

function unavailable() {
  throw new Error('filesystem access is unavailable in the RPChess browser runtime');
}

module.exports = Object.freeze({
  readFileSync: unavailable,
  writeFileSync: unavailable,
  existsSync: unavailable,
  mkdirSync: unavailable,
  statSync: unavailable
});
