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
  assert.strictEqual(mod.NAMED_PAWN_IDS.length,8,'every uploaded pawn needs its own named identity');
  assert.strictEqual(mod.NAMED_PAWN_ROLES.length,5,'a named pawn must have its default art plus all four promotion types');
  const pawnTypes={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q'};
  for(const id of mod.NAMED_PAWN_IDS)for(const color of ['w','b'])for(const role of mod.NAMED_PAWN_ROLES){
    const hero={id:`hero.${id}`,pieceType:'pawn',pieceArt:`assets/heroes/${id}/piece_badge.png`};
    const expected=`assets/heroes/${id}/pieces/${color==='w'?'white':'black'}/${role}.webp`;
    const art=mod.boardPieceArtForCharacter(hero,color,pawnTypes[role]);
    assert.strictEqual(art,expected,`wrong named pawn art after promotion: ${id}/${color}/${role}`);
    const bytes=fs.readFileSync(path.join(game,art));
    assert(bytes.length<=42*1024&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP',
      `missing or invalid compressed promotion art ${art}`);
  }
  // Six named knights: 6 portraits + 12 side-specific chess pieces.
  assert.strictEqual(mod.NAMED_KNIGHT_IDS.length,6,'all six supplied named knights must be registered');
  for(const id of mod.NAMED_KNIGHT_IDS){
    const hero={id:`hero.${id}`,pieceType:'knight',portrait:`assets/heroes/${id}/portrait.png`};
    const portrait=`assets/heroes/${id}/portrait_named.webp`;
    assert.strictEqual(mod.heroPortraitArt(hero),portrait,`old saves must get new portrait for ${id}`);
    assert(fs.readFileSync(path.join(game,portrait)).toString('ascii',0,4)==='RIFF',`missing named portrait ${portrait}`);
    for(const color of ['w','b']){
      const expected=`assets/heroes/${id}/pieces/${color==='w'?'white':'black'}/knight.webp`;
      assert.strictEqual(mod.boardPieceArtForCharacter(hero,color),expected,`named knight art must use side-specific image for ${id}`);
      const buffer=fs.readFileSync(path.join(game,expected));
      assert(buffer.length<42*1024&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP',
        `invalid optimized named knight WebP: ${expected}`);
    }
  }
  assert.strictEqual(mod.namedKnightPieceArt({id:'hero.aldric_wall',pieceType:'rook'},'rook','w'),null,
    'non-knights must not use knight art');
  // Six named rooks; same stable-ID override as the named pawns, bishops and knights.
  assert.strictEqual(mod.NAMED_ROOK_IDS.length,6,'all six supplied rook heroes must be registered');
  for(const id of mod.NAMED_ROOK_IDS){
    const legacy={id:`hero.${id}`,pieceType:'rook',portrait:`assets/heroes/${id}/portrait.png`,pieceArt:`assets/heroes/${id}/piece_badge.png`};
    const portrait=`assets/heroes/${id}/portrait_named.webp`;
    assert.strictEqual(mod.heroPortraitArt(legacy),portrait,`old saves need named rook portrait ${id}`);
    const portraitBytes=fs.readFileSync(path.join(game,portrait));
    assert(portraitBytes.length<=160*1024&&portraitBytes.toString('ascii',0,4)==='RIFF',
      `invalid optimized rook portrait ${portrait}`);
    for(const color of ['w','b']){
      const expected=`assets/heroes/${id}/pieces/${color==='w'?'white':'black'}/rook.webp`;
      assert.strictEqual(mod.boardPieceArtForCharacter(legacy,color,'r'),expected,
        `wrong named rook sprite: ${id} ${color}`);
      assert.strictEqual(mod.namedRookPieceArt(legacy,'rook',color),expected);
      const spriteBytes=fs.readFileSync(path.join(game,expected));
      assert(spriteBytes.length<=42*1024&&spriteBytes.toString('ascii',0,4)==='RIFF'&&spriteBytes.toString('ascii',8,12)==='WEBP',
        `invalid compressed rook sprite ${expected}`);
    }
  }
  assert.strictEqual(mod.namedRookPieceArt({id:'hero.vael_hammer',pieceType:'knight'},'knight','w'),null,
    'non-rooks should not use named rook piece art');
  // All six named Queens (white/black and portraits) override stale saved art by ID.
  assert.strictEqual(mod.NAMED_QUEEN_IDS.length,6,'all six queen identities must be registered');
  for(const id of mod.NAMED_QUEEN_IDS){
    const oldSave={id:`hero.${id}`,pieceType:'queen',portrait:`assets/heroes/${id}/portrait.png`,pieceArt:'old-hero-badge.png'};
    const portrait=`assets/heroes/${id}/portrait_named.webp`;
    assert.strictEqual(mod.heroPortraitArt(oldSave),portrait,`named Queen old save must use new portrait: ${id}`);
    const portraitBytes=fs.readFileSync(path.join(game,portrait));
    assert(portraitBytes.length<=160*1024&&portraitBytes.toString('ascii',0,4)==='RIFF',
      `missing/oversized named Queen portrait: ${portrait}`);
    for(const color of ['w','b']){
      const expected=`assets/heroes/${id}/pieces/${color==='w'?'white':'black'}/queen.webp`;
      assert.strictEqual(mod.boardPieceArtForCharacter(oldSave,color,'q'),expected,`named Queen side mismatch: ${id}/${color}`);
      assert.strictEqual(mod.namedQueenPieceArt(oldSave,'queen',color),expected);
      const bytes=fs.readFileSync(path.join(game,expected));
      assert(bytes.length<=42*1024&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP',
        `missing/invalid named Queen sprite: ${expected}`);
    }
  }
  assert.strictEqual(mod.namedQueenPieceArt({id:'hero.ergen_cloud',pieceType:'rook'},'rook','w'),null,
    'other hero IDs must not receive queen art');
  assert.strictEqual(mod.boardPieceArtForCharacter({id:'hero.ergen_cloud',pieceType:'knight',pieceArt:'assets/heroes/ergen_cloud/piece_badge.png'},'w'),'assets/heroes/ergen_cloud/piece_badge.png',
    'unreplaced named heroes must retain their existing personal board badges');
  assert.strictEqual(mod.boardPieceArtForCharacter({pieceType:'bishop',pieceArt:'assets/heroes/example/piece_badge.png',boardPieceArt:'assets/heroes/example/board_custom.png'},'w'),'assets/heroes/example/board_custom.png','future explicitly supplied named board art takes precedence');
  const switched=[];const testImage={src:'',classList:{toggle(name,enabled){switched.push({name,enabled});}}};
  mod.setBoardPieceArt(testImage,mod.boardPieceArtForCharacter({pieceType:'rook',pieceArt:'assets/heroes/aldric_wall/piece_badge.png'},'w'));
  mod.setBoardPieceArt(testImage,mod.boardRacePiecePath('humans','rook','w'));
  mod.setBoardPieceArt(testImage,mod.boardPieceArtForCharacter({isRunKing:true,commanderId:'ash_regent'},'b'));
  mod.setBoardPieceArt(testImage,mod.boardPieceArtForCharacter({id:'hero.mara_chain',pieceType:'pawn'},'b','queen'));
  mod.setBoardPieceArt(testImage,mod.boardPieceArtForCharacter({id:'hero.aldric_wall',pieceType:'rook'},'b'));
  mod.setBoardPieceArt(testImage,mod.boardPieceArtForCharacter({id:'hero.ysra_moss',pieceType:'queen'},'w'));
  assert.deepStrictEqual(switched,[{name:'classic-piece--new-race',enabled:false},{name:'classic-piece--new-race',enabled:true},{name:'classic-piece--new-race',enabled:true},{name:'classic-piece--new-race',enabled:true},{name:'classic-piece--new-race',enabled:true},{name:'classic-piece--new-race',enabled:true}],
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

  console.log('Race board themes: PASS — 28 board tiles, 168 race sprites and 80 named pawn/promotion sprites, 12 knight, 12 rook and 12 queen named sprites');
})().catch((error)=>{console.error(error);process.exitCode=1;});
