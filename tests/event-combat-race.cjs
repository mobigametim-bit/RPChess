const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const skirmish=await import(pathToFileURL(path.join(game,'js/skirmish-core.mjs')).href);
  const battle=await import(pathToFileURL(path.join(game,'js/battle-core.mjs')).href);
  const raceAssets=await import(pathToFileURL(path.join(game,'js/race-assets.mjs')).href);
  const dragonbornRoles=Object.freeze({pawn:'dragonborn',knight:'dragonborn',bishop:'dragonborn',rook:'dragonborn',queen:'dragonborn',king:'dragonborn'});
  const faeRoles=Object.freeze({pawn:'fae',knight:'fae',bishop:'fae',rook:'fae',queen:'fae',king:'fae'});

  globalThis.RPChessTravelEncounterOverride={type:'skirmish',seed:'stale-fae-skirmish',stars:6,enemyRaceTag:'fae',enemyRoleRaces:faeRoles,mixedArmy:false,playerColor:'w'};
  globalThis.RPChessEvents={state:{combat:{type:'skirmish',seed:'event-dragonborn-skirmish',stars:6,enemyRaceTag:'dragonborn',enemyRoleRaces:dragonbornRoles,mixedArmy:false,playerColor:'w'}}};
  const skirmishEncounter=skirmish.createEncounter({seed:'fallback-skirmish',stars:1});
  assert.strictEqual(skirmishEncounter.seed,'event-dragonborn-skirmish','active Event combat must override stale Travel encounter state');
  assert.strictEqual(skirmishEncounter.enemyRaceTag,'dragonborn','Skirmish enemy race must match source Event race');
  assert.deepStrictEqual({...skirmishEncounter.enemyRoleRaces},{...dragonbornRoles},'every Skirmish enemy role must use the source Event race');
  for(const pieceType of Object.keys(dragonbornRoles))assert(raceAssets.pieceArtForTheme(skirmishEncounter,pieceType,skirmishEncounter.enemyColor).includes('/dragonborn/'),`Skirmish ${pieceType} board art must use dragonborn assets`);

  globalThis.RPChessTravelEncounterOverride={type:'battle',seed:'stale-fae-battle',stars:8,enemyRaceTag:'fae',enemyRoleRaces:faeRoles,mixedArmy:false,playerColor:'b'};
  globalThis.RPChessEvents={state:{combat:{type:'battle',seed:'event-dragonborn-battle',stars:8,enemyRaceTag:'dragonborn',enemyRoleRaces:dragonbornRoles,mixedArmy:false,playerColor:'b'}}};
  const battleEncounter=battle.createBattleEncounter({seed:'fallback-battle',stars:1});
  assert.strictEqual(battleEncounter.seed,'event-dragonborn-battle','active Event Battle must override stale Travel encounter state');
  assert.strictEqual(battleEncounter.enemyRaceTag,'dragonborn','Battle enemy race must match source Event race');
  assert.deepStrictEqual({...battleEncounter.enemyRoleRaces},{...dragonbornRoles},'every Battle enemy role must use the source Event race');
  for(const pieceType of Object.keys(dragonbornRoles))assert(raceAssets.pieceArtForTheme(battleEncounter,pieceType,battleEncounter.enemyColor).includes('/dragonborn/'),`Battle ${pieceType} board art must use dragonborn assets`);

  delete globalThis.RPChessEvents;
  delete globalThis.RPChessTravelEncounterOverride;
  console.log('Event → Skirmish/Battle source race continuity and board art: PASS');
})().catch((error)=>{delete globalThis.RPChessEvents;delete globalThis.RPChessTravelEncounterOverride;console.error(error.stack||error);process.exitCode=1;});