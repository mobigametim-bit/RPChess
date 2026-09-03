const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const piece=require('../scripts/piece-asset-runtime.cjs');
const portrait=require('../scripts/portrait-asset-runtime.cjs');
const background=require('../scripts/background-asset-runtime.cjs');
const pinIce=require('../scripts/pin-ice-asset-runtime.cjs');

const ROOT=path.resolve(__dirname,'..'),GAME=path.join(ROOT,'game'),DIST=path.join(ROOT,'dist');
function read(root,relative){return fs.readFileSync(path.join(root,relative));}
function hash(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function expectedPng(relative,maxSide,maxBytes){
  const source=read(GAME,relative),meta=piece.parsePng(source);
  if(meta.width<=maxSide&&meta.height<=maxSide&&source.length<=maxBytes)return source;
  return piece.optimizePngBuffer(source,maxSide).buffer;
}
function equal(relative,expected){
  const actual=read(DIST,relative);
  assert(actual.equals(expected),`${relative} cached build differs from canonical optimizer\nexpected ${hash(expected)}\nactual   ${hash(actual)}`);
}
assert(fs.existsSync(path.join(DIST,'index.html')),'dist must exist; run npm run build first');

equal('assets/races/humans/board/white.png',piece.optimizePngBuffer(read(GAME,'assets/races/humans/board/white.png'),384).buffer);
equal('assets/vfx/pin_ice_full.png',piece.optimizePngBuffer(read(GAME,'assets/vfx/pin_ice_full.png'),pinIce.PIN_ICE_RUNTIME_MAX_SIDE).buffer);
equal('assets/races/orcs/pieces/pawn.png',expectedPng('assets/races/orcs/pieces/pawn.png',piece.PIECE_RUNTIME_MAX_SIDE,piece.PIECE_RUNTIME_MAX_BYTES));
equal('assets/kings/oathkeeper/portrait.png',expectedPng('assets/kings/oathkeeper/portrait.png',portrait.PORTRAIT_RUNTIME_MAX_SIDE,portrait.PORTRAIT_RUNTIME_MAX_BYTES));
equal('assets/events/register-04/backgrounds/generic/forest_crossroad.png',background.optimizeBackgroundBuffer(read(GAME,'assets/events/register-04/backgrounds/generic/forest_crossroad.png'),background.BACKGROUND_RUNTIME_CHANNEL_BITS).buffer);

console.log('Runtime asset cached build parity: PASS — board, VFX, piece, portrait and background bytes match canonical transforms');
