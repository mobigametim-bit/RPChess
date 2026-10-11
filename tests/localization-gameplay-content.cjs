const assert=require('assert');
const path=require('path');
const {pathToFileURL}=require('url');
(async()=>{
  const load=file=>import(pathToFileURL(path.join(__dirname,'../game/js',file)).href);
  const {translateLegacy}=await load('i18n.mjs');
  const {STARTER_TEMPLATES,PIECE_LABELS,STATUS_LABELS}=await load('roster-data.mjs');
  const {RECRUIT_LIBRARY}=await load('settlement-core.mjs');
  const {HERO_NOTES}=await load('content/hero-notes.mjs');
  const travel=await load('travel-choice-core.mjs');
  const {createEncounter}=await load('skirmish-core.mjs');
  const {createBattleEncounter}=await load('battle-core.mjs');
  const {RACE_LABELS,RACE_TAGS,combatTheme}=await load('race-assets.mjs');
  let checked=0; const missing=[];
  const check=(value,label)=>{
    if(typeof value!=='string'||!value.trim())return;
    const en=translateLegacy(value,'en');
    if(/[А-Яа-яЁё]|\[missing:/u.test(en))missing.push(`${label}: ${en}`);
    assert.strictEqual(translateLegacy(value,'ru'),value,`${label}: RU content remains intact`);
    checked++;
  };
  for(const hero of [...STARTER_TEMPLATES,...RECRUIT_LIBRARY])for(const field of ['name','origin','description'])check(hero[field],`${hero.id}.${field}`);
  assert.strictEqual(RECRUIT_LIBRARY.length,33);
  assert.strictEqual(Object.keys(HERO_NOTES).length,37);
  for(const [id,note]of Object.entries(HERO_NOTES))check(note,`${id}.note`);
  for(const registry of [PIECE_LABELS,STATUS_LABELS,RACE_LABELS,travel.ENCOUNTER_LABELS,travel.MECHANICAL_HINTS,travel.THREAT_LABELS])for(const [key,value]of Object.entries(registry))check(value,key);
  for(const [type,flavors]of Object.entries(travel.FLAVOR_POOLS))for(const flavor of flavors)check(flavor,`${type}.flavor`);
  for(let stars=1;stars<=12;stars++)for(const create of [createEncounter,createBattleEncounter]){
    const encounter=create({seed:`localization:${stars}`,stars});
    for(const field of ['label','tactic','description','sideNarrative'])check(encounter[field],`${encounter.id}.${field}`);
  }
  for(const raceTag of RACE_TAGS)for(const playerColor of ['w','b'])check(combatTheme({seed:'localization',raceTag,playerColor}).sideNarrative,`${raceTag}.${playerColor}.narrative`);
  assert.deepStrictEqual([...new Set(missing)],[]);
  console.log(`Gameplay translation corpus: PASS (${checked} hero, route, threat and combat strings)`);
})().catch(error=>{console.error(error);process.exitCode=1;});
