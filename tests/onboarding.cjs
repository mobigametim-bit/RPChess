const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const onboarding = fs.readFileSync(path.join(root, 'game/js/content/onboarding.mjs'), 'utf8');
const foundation = fs.readFileSync(path.join(root, 'game/js/reboot-foundation.mjs'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'game/js/cloud-save.mjs'), 'utf8');

const approved = ['identity','roster','travel','skirmishPrep','skirmishChess','battlePrep','battleChess','event','settlement','puzzle'];
const arrayMatch = onboarding.match(/const INCLUDED_HINTS = Object\.freeze\(\[([\s\S]*?)\]\);/);
assert(arrayMatch, 'Onboarding must expose the approved hint list');
const actual = [...arrayMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.deepStrictEqual(actual, approved, 'Onboarding scope must contain exactly the ten approved screens');

for (const excluded of ['starvation','chronicle','runEnd','skirmishAftermath','battleAftermath']) {
  assert(!actual.includes(excluded), `Excluded onboarding screen leaked into scope: ${excluded}`);
}
for (const token of [
  "'rpchess:run-new':'roster'",
  "'rpchess:travel-open':'travel'",
  "'rpchess:skirmish-open':'skirmishPrep'",
  "'rpchess:battle-open':'battlePrep'",
  "'rpchess:event-open':'event'",
  "'rpchess:settlement-open':'settlement'",
  "'rpchess:puzzle-open':'puzzle'",
  "[data-skirmish-start]",
  "[data-battle-start]",
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

console.log('First-run onboarding scope, persistence, localization, accessibility and cloud wiring: PASS');
