const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const onboarding = fs.readFileSync(path.join(root, 'game/js/content/onboarding.mjs'), 'utf8');
const foundation = fs.readFileSync(path.join(root, 'game/js/reboot-foundation.mjs'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'game/js/cloud-save.mjs'), 'utf8');

const approved = ["identity","roster","kingdomMap","kingdomCastle","kingdomProduction","artifact","skirmishChess","battleChess","event","settlement","puzzle","caravanChess","starvation","chronicle","arenaCatalog","arenaFoe","arenaArtifact","arenaChess"];
const arrayMatch = onboarding.match(/const INCLUDED_HINTS = Object\.freeze\(\[([\s\S]*?)\]\);/);
assert(arrayMatch, 'Onboarding must expose the approved hint list');
const actual = [...arrayMatch[1].matchAll(/[\x27\x22]([^\x27\x22]+)[\x27\x22]/g)].map((match) => match[1]);
assert.deepStrictEqual(actual, approved, 'Onboarding scope must contain exactly 18 useful first-visit moments');

for (const excluded of ['skirmishPrep','battlePrep','caravanPrep','travel',
  'combatAftermath','caravanReward','runEnd','arenaResult']) {
  assert(!actual.includes(excluded), `Excluded onboarding screen leaked into scope: ${excluded}`);
}
for (const token of [
  "'rpchess:run-new':['roster'",
  "'rpchess:kingdom-map-shown':['kingdomMap'",
  "'rpchess:kingdom-castle-inspected':['kingdomCastle'",
  "'rpchess:kingdom-production-collected':['kingdomProduction'"
  "'rpchess:event-open':['event'",
  "'rpchess:settlement-shown':['settlement'"
  "ru:'Понятно'",
  "en:'Got it'",
  "role=\"dialog\"",
  "aria-modal=\"true\"",
  "rpchess:tutorial-updated"
]) assert(onboarding.includes(token), `Onboarding contract missing ${token}`);

assert(onboarding.includes("const TUTORIAL_STORAGE_KEY = 'rpchess.reboot.v1.tutorial'"), 'Tutorial persistence key missing');
assert(onboarding.includes('overflow:hidden'), 'Compact onboarding card must forbid internal scrolling');
assert(foundation.includes("import('./content/onboarding.mjs')"), 'Foundation must load onboarding after cloud reconciliation');
assert(foundation.includes('onboarding?.activateOnboarding?.()'), 'New Game must activate onboarding');
assert(foundation.includes("onboarding?.showHint?.('identity')"), 'New Game must show the identity hint');
assert(foundation.indexOf("import('./content/onboarding.mjs')") > foundation.indexOf('const cloudReady'), 'Onboarding must be sequenced behind Cloud Save');
assert(cloud.includes("const TUTORIAL_STORAGE_KEY = 'rpchess.reboot.v1.tutorial'"), 'Cloud Save must sync tutorial flags');
assert(cloud.includes("'rpchess:tutorial-updated'"), 'Cloud autosync must react to tutorial updates');

assert(!actual.includes('skirmishPrep')&&!actual.includes('battlePrep')&&!actual.includes('caravanPrep'),'removed deployment screen hints must never reappear');
assert(onboarding.includes('jester-patrick.webp'),'approved jester portrait missing');
assert(onboarding.includes('rpchess:arena-catalog-shown'),'Arena first-visit tutorial wiring missing');
assert(!onboarding.includes('Three roads')&&!onboarding.includes('Три дороги'),
  'Deprecated three-road instructions must not appear in the Kingdom onboarding copy');
console.log('First-run jester onboarding (18 moments), persistence, localization, accessibility and cloud wiring: PASS');
