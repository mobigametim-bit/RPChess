'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const explicitSetup = fs.readFileSync(path.resolve(__dirname, '../game/js/explicit-run-setup.mjs'), 'utf8');
const commanderFinal = fs.readFileSync(path.resolve(__dirname, '../game/js/commander-selection-final.mjs'), 'utf8');

assert.strictEqual(
  (explicitSetup.match(/rpa-screen-header p/g) || []).length,
  0,
  'explicit run setup must not mutate commander screen copy owned by commander-selection-final; competing MutationObservers can freeze the UI'
);
assert.ok(
  commanderFinal.includes("setText(screen.querySelector('.rpa-screen-header p')"),
  'approved commander module must remain the single owner of commander subheading copy'
);
assert.ok(
  commanderFinal.includes('Короля и доктрину вы подтвердите отдельно'),
  'commander screen must still explain the explicit king/doctrine step to the player'
);
assert.ok(
  explicitSetup.includes("setTextIfChanged(launch,'К ВЫБОРУ КОРОЛЯ И ДОКТРИНЫ')"),
  'explicit setup CTA must remain user-facing and route to king/doctrine selection'
);

console.log('Commander observer ownership regression: PASS');
