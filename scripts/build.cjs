const fs = require('fs');
const path = require('path');
const verifySource = require('./verify-source.cjs');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'game');
const dist = path.join(root, 'dist');

verifySource(source);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  if (entry.name === 'SOURCE_BASELINE.md') continue;
  fs.cpSync(path.join(source, entry.name), path.join(dist, entry.name), {
    recursive: true,
    force: true
  });
}

verifySource(dist);
console.log(`Prepared normalized RPChess source from ${source} in ${dist}`);
