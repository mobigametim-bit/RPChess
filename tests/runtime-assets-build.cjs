const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const piece=require('../scripts/piece-asset-runtime.cjs');
const portrait=require('../scripts/portrait-asset-runtime.cjs');
const background=require('../scripts/background-asset-runtime.cjs');
const pinIce=require('../scripts/pin-ice-asset-runtime.cjs');
const aura=require('../scripts/aura-asset-runtime.cjs');

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

for(const relative of fs.readdirSync(path.join(DIST,'css')).filter((name)=>name.endsWith('.css'))){
  const cssPath=path.join(DIST,'css',relative);
  const source=fs.readFileSync(cssPath,'utf8');
  for(const match of source.matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g)){
    const reference=match[2].trim().split(/[?#]/,1)[0];
    if(!reference||/^(?:data:|https?:|\/\/|#)/i.test(reference))continue;
    const target=path.resolve(path.dirname(cssPath),reference);
    assert(target.startsWith(`${DIST}${path.sep}`),`${relative} contains an out-of-dist asset URL: ${reference}`);
    assert(fs.existsSync(target),`${relative} references a local asset missing from dist: ${reference}`);
  }
}

equal('assets/races/humans/board/white.png',piece.optimizePngBuffer(read(GAME,'assets/races/humans/board/white.png'),384).buffer);
equal('assets/vfx/pin_ice_full.png',piece.optimizePngBuffer(read(GAME,'assets/vfx/pin_ice_full.png'),pinIce.PIN_ICE_RUNTIME_MAX_SIDE).buffer);
equal('assets/vfx/aura_white.png',piece.optimizePngBuffer(read(GAME,'assets/vfx/aura_white.png'),aura.AURA_RUNTIME_MAX_SIDE).buffer);
equal('assets/races/orcs/pieces/pawn.png',expectedPng('assets/races/orcs/pieces/pawn.png',piece.PIECE_RUNTIME_MAX_SIDE,piece.PIECE_RUNTIME_MAX_BYTES));
equal('assets/kings/oathkeeper/portrait.png',expectedPng('assets/kings/oathkeeper/portrait.png',portrait.PORTRAIT_RUNTIME_MAX_SIDE,portrait.PORTRAIT_RUNTIME_MAX_BYTES));
equal('assets/events/register-04/backgrounds/generic/forest_crossroad.png',background.optimizeBackgroundBuffer(read(GAME,'assets/events/register-04/backgrounds/generic/forest_crossroad.png'),background.BACKGROUND_RUNTIME_CHANNEL_BITS).buffer);

for(const relative of [
  'assets/heroes/aldric_wall/ability_icon.png',
  'assets/kings/oathkeeper/command_icon.png',
  'assets/events/register-04/contract_three_seals.png',
  'generated_assets/ui_button_primary.png',
  'generated_assets/ui_button_secondary.png',
  'generated_assets/unit_boss_king_enemy.png'
])assert(!fs.existsSync(path.join(DIST,relative)),`${relative} is a source/reserve asset and must not be shipped in dist`);

console.log('Runtime asset cached build parity: PASS — canonical assets match transforms and source/reserve assets stay out of dist');
