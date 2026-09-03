const assert=require('assert');
const path=require('path');
const {pathToFileURL}=require('url');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const chess=await import(pathToFileURL(path.join(root,'game/js/classic-chess-engine.mjs')).href);
  const pin=await import(`${pathToFileURL(path.join(root,'game/js/king-pin-ice.mjs')).href}?test=${Date.now()}`);

  function classify(fen){
    const engine=new chess.ClassicChessEngine(fen);
    return pin.classifyAbsolutePins(engine.snapshot());
  }
  function stateAt(list,square){return list.find(item=>item.square===square)?.state||null;}

  assert.deepStrictEqual({...pin.PIN_ICE_ASSETS},{full:'assets/vfx/pin_ice_full.png',partial:'assets/vfx/pin_ice_partial.png'});

  const fullKnight=classify('4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1');
  assert.strictEqual(stateAt(fullKnight,'e2'),'full','knight shielding king from rook must be fully pinned');
  assert.strictEqual(fullKnight.find(item=>item.square==='e2')?.pinner,'e8');

  const partialRook=classify('4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert.strictEqual(stateAt(partialRook,'e2'),'partial','rook that can slide along pin ray must be partially pinned');

  const bothSides=classify('k3r3/n7/8/8/8/8/4R3/R3K3 w - - 0 1');
  assert.strictEqual(stateAt(bothSides,'e2'),'partial','white rook must be partially pinned');
  assert.strictEqual(stateAt(bothSides,'a7'),'full','black knight must still be shown as fully pinned on white turn');
  assert.deepStrictEqual(bothSides.map(item=>item.square).sort(),['a7','e2']);

  const blackTurn=classify('k3r3/n7/8/8/8/8/4R3/R3K3 b - - 0 1');
  assert.strictEqual(stateAt(blackTurn,'e2'),'partial','white pin remains visible on black turn');
  assert.strictEqual(stateAt(blackTurn,'a7'),'full','black pin remains visible on black turn');

  const blockedButNotPinned=classify('7k/8/8/8/8/4P3/4P3/4K3 w - - 0 1');
  assert.strictEqual(blockedButNotPinned.length,0,'ordinary blocked pieces must not receive ice');

  const wrongSlider=classify('4n2k/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert.strictEqual(wrongSlider.length,0,'a knight behind the shielding piece is not a line pin');

  const diagonalFull=classify('7k/8/8/8/7b/6N1/5K2/8 w - - 0 1');
  assert.strictEqual(stateAt(diagonalFull,'g3'),'full','knight on diagonal ray must be fully pinned by bishop');

  console.log('King pin ice: PASS — full/partial absolute pins for both sides independent of turn');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
