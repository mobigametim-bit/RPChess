const fs = require('fs');
const path = require('path');
const verifySource = require('./verify-source.cjs');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'game');
const dist = path.join(root, 'dist');

require('./build-browser-runtime.cjs');
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
const runtimeBundle = path.join(dist, 'js/generated/iron-marches-runtime.bundle.js');
const entryPoint = path.join(dist, 'vertical-slice.html');
if (!fs.existsSync(runtimeBundle)) throw new Error('production browser runtime bundle is missing from dist');
if (!fs.existsSync(entryPoint)) throw new Error('production vertical slice entry is missing from dist');
console.log(`Prepared normalized RPChess source from ${source} in ${dist}`);
