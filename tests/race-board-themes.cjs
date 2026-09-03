const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');
const {parsePng}=require('../scripts/piece-asset-runtime.cjs');
const {BOARD_RACES,BOARD_FILES,collectBoardAssetPaths}=require('../scripts/board-asset-runtime.cjs');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const game=path.join(root,'game');
  const mod=await import(`${pathToFileURL(path.join(game,'js','race-assets.mjs')).href}?race-board-test=${Date.now()}`);

  assert.deepStrictEqual([...mod.RACE_TAGS],[...BOARD_RACES],'race board themes must cover the canonical 14 races');
  assert.deepStrictEqual({...mod.BOARD_TILE_FILES},{light:'white.png',dark:'black.png'},'board tile filenames must remain white.png / black.png');
  assert.strictEqual(mod.raceBoardTiles('mixed'),null,'mixed has no dedicated board and must fall back to neutral');

  const paths=collectBoardAssetPaths(game);
  assert.strictEqual(paths.length,28,'all 14 races must provide white.png + black.png');
  for(const race of BOARD_RACES){
    const tiles=mod.raceBoardTiles(race);
    assert.strictEqual(tiles.raceTag,race);
    assert.strictEqual(tiles.light,`assets/races/${race}/board/white.png`);
    assert.strictEqual(tiles.dark,`assets/races/${race}/board/black.png`);
    for(const file of BOARD_FILES){
      const full=path.join(game,'assets','races',race,'board',file);
      assert.ok(fs.existsSync(full),`missing ${race}/${file}`);
      const png=parsePng(fs.readFileSync(full));
      assert.strictEqual(png.width,png.height,`${race}/${file} must be square`);
    }
  }

  const properties={};
  const board={dataset:{},style:{setProperty(name,value){properties[name]=value;},removeProperty(name){delete properties[name];}}};
  const applied=mod.applyRaceBoardTheme(board,'orcs');
  assert.strictEqual(board.dataset.boardRace,'orcs');
  assert.strictEqual(properties['--board-light-tile'],'url("assets/races/orcs/board/white.png")');
  assert.strictEqual(properties['--board-dark-tile'],'url("assets/races/orcs/board/black.png")');
  assert.strictEqual(applied.raceTag,'orcs');

  mod.applyRaceBoardTheme(board,null);
  assert.ok(!('boardRace' in board.dataset),'neutral classic board must clear race marker');
  assert.ok(!('--board-light-tile' in properties));
  assert.ok(!('--board-dark-tile' in properties));

  globalThis.RPChessBattle={battlePlan:{encounter:{enemyRaceTag:'fae'}}};
  assert.strictEqual(mod.currentCombatBoardRace(),'fae','Battle must drive board race from encounter.enemyRaceTag');
  delete globalThis.RPChessBattle;
  globalThis.RPChessSkirmish={battlePlan:{encounter:{enemyRaceTag:'undead'}}};
  assert.strictEqual(mod.currentCombatBoardRace(),'undead','Skirmish must drive board race from encounter.enemyRaceTag');
  delete globalThis.RPChessSkirmish;

  const source=fs.readFileSync(path.join(game,'js','race-assets.mjs'),'utf8');
  assert.ok(source.includes('.classic-board[data-board-race] .classic-square--light'),'runtime CSS must target light cells under a themed board');
  assert.ok(source.includes('.classic-board[data-board-race] .classic-square--dark'),'runtime CSS must target dark cells under a themed board');
  assert.ok(source.includes('linear-gradient(145deg,#c3b995,#aa9f7c)'),'light cell must retain neutral fallback');
  assert.ok(source.includes('linear-gradient(145deg,#4d585d,#374349)'),'dark cell must retain neutral fallback');

  console.log('Race board themes: PASS — 28 PNGs, 14 race pairs, square sources, combat binding and neutral fallback');
})().catch((error)=>{console.error(error);process.exitCode=1;});
