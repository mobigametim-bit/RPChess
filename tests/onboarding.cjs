const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const onboarding = fs.readFileSync(path.join(root, 'game/js/content/onboarding.mjs'), 'utf8');
const foundation = fs.readFileSync(path.join(root, 'game/js/reboot-foundation.mjs'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'game/js/cloud-save.mjs'), 'utf8');

const approved = ["identity","roster","travel","artifact","skirmishChess","battleChess","combatAftermath","event","settlement","puzzle","caravanChess","caravanReward","starvation","runEnd","chronicle","arenaCatalog","arenaFoe","arenaArtifact","arenaChess","arenaResult"];
const arrayMatch = onboarding.match(/const INCLUDED_HINTS = Object\.freeze\(\[([\s\S]*?)\]\);/);
assert(arrayMatch, 'Onboarding must expose the approved hint list');
const actual = [...arrayMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.deepStrictEqual(actual, approved, 'Onboarding scope must contain exactly 20 approved first-visit moments');

for (const excluded of ['starvation','chronicle','runEnd','skirmishAftermath','battleAftermath']) {
  assert(!actual.includes(excluded), `Excluded onboarding screen leaked into scope: ${excluded}`);
}
for (const token of [
  "'rpchess:run-new':['roster'",
  "'rpchess:travel-open':['travel'",
  "'rpchess:event-open':['event'",
  "'rpchess:settlement-open':['settlement'",
  "dismiss:'Понятно'",
  "dismiss:'Got it'",
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
console.log('First-run jester onboarding (20 moments), persistence, localization, accessibility and cloud wiring: PASS');
