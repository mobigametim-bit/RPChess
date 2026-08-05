'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deploymentPath = path.join(root, 'src/runtime/deployment-gate.cjs');
let source = fs.readFileSync(deploymentPath, 'utf8');
const before = "    statuses: originalBattle.statuses,\n    orderPoints: originalBattle.orderPoints,";
const after = "    statuses: originalBattle.statuses,\n    abilities: originalBattle.abilities,\n    orderPoints: originalBattle.orderPoints,";
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('deployment ability preservation insertion point missing');
  source = source.replace(before, after);
  fs.writeFileSync(deploymentPath, source);
}

const packagePath = path.join(root, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const marker = 'node tests/iron-marches-abilities.cjs';
const addition = 'node tests/deployment-ability-preservation.cjs';
if (!packageJson.scripts.test.includes(addition)) {
  if (!packageJson.scripts.test.includes(marker)) throw new Error('ability test marker missing');
  packageJson.scripts.test = packageJson.scripts.test.replace(marker, `${marker} && ${addition}`);
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

console.log('Deployment ability preservation applied.');
