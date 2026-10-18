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

  assert.deepStrictEqual([...mod.BOARD_PIECE_RACES],[...mod.RACE_TAGS],'all 14 race sets must use the new board art');
  for(const race of mod.BOARD_PIECE_RACES)for(const color of ['w','b'])for(const pieceType of mod.PIECE_TYPES){
    const src=mod.boardRacePiecePath(race,pieceType,color);
    const full=path.join(game,src);
    assert(fs.existsSync(full),`board sprite missing: ${src}`);
    const data=fs.readFileSync(full),png=parsePng(data);
    assert(png.width===256&&png.height===256&&data.length<=320*1024,`board sprite over budget: ${src}`);
  }
  assert.strictEqual(mod.racePiecePath('orcs','king','w'),mod.boardRacePiecePath('orcs','king','w'),'Arena squads now use new orc chess art');
  assert.strictEqual(mod.racePiecePath('humans','king','w'),mod.boardRacePiecePath('humans','king','w'),'Arena squads now use new human chess art');
  assert.strictEqual(mod.boardRacePiecePath('elves','pawn','b'),'assets/races/elves/pieces/board/black/pawn.png','new elven set must use color-specific chess art');
  assert.strictEqual(mod.boardPieceArtForCharacter({pieceType:'rook'},'b'),mod.boardRacePiecePath('humans','rook','b'),'unnamed pieces use new race chess art');
  assert.strictEqual(mod.boardPieceArtForCharacter({id:'king.oathkeeper',pieceType:'king',pieceArt:'assets/kings/oathkeeper/piece.png'},'w'),'assets/kings/oathkeeper/piece.png','named Run King must retain his existing personal board image');
  for(const id of ['oathkeeper','stone_crown','wanderer_queen','pilgrim','fox_prince','ash_regent','nameless_heir']){
    for(const color of ['w','b']){
      const chosen=mod.boardPieceArtForCharacter({id:'king.oathkeeper',isRunKing:true,commanderId:id,pieceType:'king',pieceArt:'assets/kings/oathkeeper/piece.png'},color);
      assert.strictEqual(chosen,`assets/kings/${id}/pieces/${color==='w'?'white':'black'}.webp`,
        `selected commander ${id} must use its own ${color} art on board`);
    }
  }
  assert.strictEqual(mod.boardPieceArtForCharacter({id:'hero.aldric_wall',pieceType:'rook',raceTag:'humans',pieceArt:'assets/heroes/aldric_wall/piece_badge.png'},'w'),'assets/heroes/aldric_wall/piece_badge.png','named heroes must retain their existing personal board badges');
  assert.strictEqual(mod.boardPieceArtForCharacter({pieceType:'bishop',pieceArt:'assets/heroes/example/piece_badge.png',boardPieceArt:'assets/heroes/example/board_custom.png'},'w'),'assets/heroes/example/board_custom.png','future explicitly supplied named board art takes precedence');
  const switched=[];const testImage={src:'',classList:{toggle(name,enabled){switched.push({name,enabled});}}};
  mod.setBoardPieceArt(testImage,mod.boardPieceArtForCharacter({pieceType:'rook',pieceArt:'assets/heroes/aldric_wall/piece_badge.png'},'w'));
  mod.setBoardPieceArt(testImage,mod.boardRacePiecePath('humans','rook','w'));
  mod.setBoardPieceArt(testImage,mod.boardPieceArtForCharacter({isRunKing:true,commanderId:'ash_regent'},'b'));
  assert.deepStrictEqual(switched,[{name:'classic-piece--new-race',enabled:false},{name:'classic-piece--new-race',enabled:true},{name:'classic-piece--new-race',enabled:true}],
    'named hero art must restore the glyph/aura while generic new race art suppresses it');

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

  console.log('Race board themes: PASS — 28 board tiles plus 168 PNG board sprites; all Arena catalog sprites unified');
})().catch((error)=>{console.error(error);process.exitCode=1;});
