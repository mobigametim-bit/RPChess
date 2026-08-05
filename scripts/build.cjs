const fs = require('fs');
const path = require('path');
const verifySource = require('./verify-source.cjs');
const buildBrowserRuntime = require('./build-browser-runtime.cjs');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'game');
const dist = path.join(root, 'dist');

async function main() {
  await buildBrowserRuntime();
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
  const isolatedEntry = path.join(dist, 'vertical-slice.html');
  const rootEntry = path.join(dist, 'index.html');
  if (!fs.existsSync(runtimeBundle)) throw new Error('production browser runtime bundle is missing from dist');
  if (!fs.existsSync(isolatedEntry)) throw new Error('production vertical slice entry is missing from dist');
  if (!fs.existsSync(rootEntry)) throw new Error('root browser entry is missing from dist');
  const rootHtml = fs.readFileSync(rootEntry, 'utf8');
  if (!rootHtml.includes('js/generated/iron-marches-runtime.bundle.js') || !rootHtml.includes('js/vertical-slice-app.mjs')) {
    throw new Error('root browser entry does not launch the production vertical slice');
  }
  if (!rootHtml.includes('style.css') || !rootHtml.includes('css/approved-visual-shell.css')) {
    throw new Error('root browser entry is missing the approved prototype visual shell');
  }
  if (rootHtml.includes('js/core.js') || rootHtml.includes('js/main.js')) {
    throw new Error('root browser entry still launches the legacy client');
  }
  console.log(`Prepared normalized RPChess source from ${source} in ${dist}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
