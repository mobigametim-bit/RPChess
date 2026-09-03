const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const game=path.join(root,'game');
  const mod=await import(`${pathToFileURL(path.join(game,'js','race-assets.mjs')).href}?race-board-test=${Date.now()}`);
  const races=['humans','elves','orcs','undead','dark_elves','dwarves','demons','angels','dragonborn','beastfolk','constructs','animals','fae','goblins'];

  assert.deepStrictEqual([...mod.RACE_TAGS],races,'race board themes must cover the canonical 14 races');
  assert.deepStrictEqual({...mod.BOARD_TILE_FILES},{light:'white.png',dark:'black.png'},'board tile filenames must remain white.png / black.png');
  assert.strictEqual(mod.raceBoardTiles('mixed'),null,'mixed has no dedicated board and must fall back to neutral');

  for(const race of races){
    const tiles=mod.raceBoardTiles(race);
    assert.strictEqual(tiles.raceTag,race);
    assert.strictEqual(tiles.light,`assets/races/${race}/board/white.png`);
    assert.strictEqual(tiles.dark,`assets/races/${race}/board/black.png`);
    assert.ok(fs.existsSync(path.join(game,'assets','races',race,'board','.gitkeep')),`missing prepared board folder for ${race}`);
  }

  const properties={};
  const board={
    dataset:{},
    style:{
      setProperty(name,value){properties[name]=value;},
      removeProperty(name){delete properties[name];}
    }
  };
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
  assert.ok(source.includes('linear-gradient(145deg,#c3b995,#aa9f7c)'),'light cell must keep a neutral fallback if an asset is not present yet');
  assert.ok(source.includes('linear-gradient(145deg,#4d585d,#374349)'),'dark cell must keep a neutral fallback if an asset is not present yet');

  console.log('Race board themes: PASS — 14 race folders, white/black paths, combat race binding and neutral fallback');
})().catch((error)=>{console.error(error);process.exitCode=1;});
