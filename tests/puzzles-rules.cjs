const path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{
  const game=path.resolve(__dirname,'..','game');
  const core=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-core.mjs')).href);
  const catalogModule=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-catalog.mjs')).href);
  const taxonomy=await import(pathToFileURL(path.join(game,'js/puzzles/puzzle-theme-catalog.mjs')).href);
  const known=Object.keys(taxonomy.PUZZLE_THEME_REGISTRY);
  assert(known.length>=70,'source Lichess tag vocabulary should be represented comprehensively');
  for(const tag of known){
    assert(['tactic','mate','special','endgame','phase','goal','length','origin'].includes(taxonomy.PUZZLE_THEME_REGISTRY[tag].group),`uncategorized Lichess theme: ${tag}`);
    assert(taxonomy.PUZZLE_THEME_REGISTRY[tag].ru&&taxonomy.PUZZLE_THEME_REGISTRY[tag].en,`missing RU/EN theme translation: ${tag}`);
    assert.strictEqual(taxonomy.namedPuzzleThemes({themes:[tag]},'ru')[0].key,tag);
    assert.strictEqual(taxonomy.namedPuzzleThemes({themes:[tag]},'en')[0].key,tag);
  }
  assert.strictEqual(taxonomy.featuredPuzzleTheme({themes:['endgame','fork','long']},'ru').label,'Вилка',
    'chess tactic should be shown before generic game phase and solution length');
  assert.strictEqual(taxonomy.featuredPuzzleTheme({themes:['mate','mateIn2','middlegame']},'en').group,'phase',
    'do not reprint a redundant mateIn2 tag as an additional theme');
  assert.deepStrictEqual(taxonomy.namedPuzzleThemes({themes:['unknownTheme']},'ru'),[],'unknown source tags must not be relabeled by guesswork');

  const catalog=catalogModule.PUZZLE_CATALOG;
  const allSourceTags=new Set(catalog.flatMap(p=>p.themes||[]));
  const availableTags=[...allSourceTags].filter(tag=>taxonomy.PUZZLE_THEME_REGISTRY[tag]);
  assert(availableTags.length>=20,'existing production tasks should expose many real Lichess categories');
  const tagged=catalog.find(p=>p.themes?.includes('fork'));
  assert(tagged&&taxonomy.featuredPuzzleTheme(tagged,'ru'),'existing Lichess fork puzzles should have a readable theme');

  assert(catalog.length>=12,'playable catalog must have real CC0 tasks across all star levels');assert(catalog.every(core.isNormalizedPuzzle));assert.deepStrictEqual([...new Set(catalog.map(p=>p.difficulty))].sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));assert.strictEqual(catalogModule.PUZZLE_SOURCE.license,'CC0');
  const expectedStars=[[1,1],[8,1],[9,2],[16,2],[17,3],[40,5],[48,6],[80,10],[88,11],[89,12],[999,12]];for(const [week,stars] of expectedStars)assert.strictEqual(core.puzzleStarsForWeek(week),stars,`legacy week helper ${week}`);
  assert.strictEqual(core.puzzleBaseGold(1),12);assert.strictEqual(core.puzzleBaseGold(12),45);assert.strictEqual(core.puzzleGoldReward(5,0),24);assert.strictEqual(core.puzzleGoldReward(5,1),17);assert.strictEqual(core.puzzleGoldReward(5,2),10);assert.strictEqual(core.puzzleGoldReward(5,3),0);assert.strictEqual(core.objectiveLabel({type:'material',targetPiece:'queen'}),'ВЫИГРАЙТЕ ♛');assert.strictEqual(core.objectiveLabel({type:'mate3'}),'МАТ В 3');
  for(let stars=1;stars<=12;stars++){const selected=core.selectPuzzle(catalog,{runId:'adaptive-exact',routeId:`stars-${stars}`,stars,week:999});assert.strictEqual(selected.difficulty,stars,`Puzzle card ★${stars} must open a ★${stars} task`);const repeat=core.selectPuzzle(catalog,{runId:'adaptive-exact',routeId:`stars-${stars}`,stars,week:1});assert.strictEqual(repeat.id,selected.id,'travel week must not affect adaptive selection');}
  const five=core.selectPuzzle(catalog,{runId:'fixed-five',routeId:'same-route',stars:5,week:1});const fiveLate=core.selectPuzzle(catalog,{runId:'fixed-five',routeId:'same-route',stars:5,week:999});assert.strictEqual(five.id,fiveLate.id);assert.strictEqual(five.difficulty,5);
  const state=core.createPuzzleState({puzzle:five,routeId:'same-route',stars:5,week:1});assert.strictEqual(state.stars,5,'Puzzle state must match concrete route difficulty');
  const bucket=catalog.filter(item=>item.difficulty===1).slice(0,48),history=[];assert.strictEqual(bucket.length,48,'catalog needs a compact ★1 sample');for(let index=0;index<bucket.length;index++){const args={runId:'no-repeat',routeId:`route-${index}`,stars:1,excludedIds:history};const selected=core.selectPuzzle(bucket,args);assert(!history.includes(selected.id),`Puzzle ${selected.id} repeated before ★1 sample exhaustion`);const repeat=core.selectPuzzle(bucket,args);assert.strictEqual(repeat.id,selected.id);history.push(selected.id);}assert.strictEqual(new Set(history).size,bucket.length);
  console.log('Puzzles concrete adaptive-star / reward / deterministic no-repeat rules: PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
