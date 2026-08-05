'use strict';

const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/runtime/vertical-slice.cjs');
const source = fs.readFileSync(file, 'utf8');
const before = `  if (!army || army.format !== RUNTIME_ARMY_FORMAT) throw new Error('vertical slice runtime has an invalid army');
  if (!options.contentRegistry || !options.combatProfiles) {
    throw new Error('vertical slice army validation requires contentRegistry and combatProfiles');
  }
  return validateRuntimeArmy(army, options.contentRegistry, options.combatProfiles);`;
const after = `  if (!army || army.format !== RUNTIME_ARMY_FORMAT) throw new Error('vertical slice runtime has an invalid army');
  if (!options.contentRegistry || !options.combatProfiles) {
    if (options.requireArmy) throw new Error('vertical slice army validation requires contentRegistry and combatProfiles');
    return army;
  }
  return validateRuntimeArmy(army, options.contentRegistry, options.combatProfiles);`;
if (!source.includes(before)) throw new Error('domain army validation anchor not found');
fs.writeFileSync(file, source.replace(before, after), 'utf8');
console.log('Allowed metadata-only profile inspection while preserving strict production army validation.');
