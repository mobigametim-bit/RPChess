const fs = require('fs');
const path = require('path');
const verifySource = require('./verify-source.cjs');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'game');
const dist = path.join(root, 'dist');

function copy(relative) {
  const from = path.join(source, relative);
  const to = path.join(dist, relative);
  if (!fs.existsSync(from)) throw new Error(`missing Reboot build input: ${relative}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
}

async function main() {
  verifySource(source);

  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  // Reboot Foundation ships only the active shell and reusable visual assets.
  // Legacy Iron Marches gameplay remains preserved in archive/iron-marches-v1,
  // but is deliberately excluded from the production distribution.
  copy('index.html');
  copy('BUILD_INFO.json');
  copy('css/reboot-foundation.css');
  copy('js/reboot-foundation.mjs');
  copy('fonts');
  copy('generated_assets');

  verifySource(dist);

  const rootHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const forbidden = [
    'iron-marches-runtime.bundle.js',
    'vertical-slice-app.mjs',
    'explicit-run-setup.mjs',
    'ui-approved-campaign.mjs'
  ];
  for (const token of forbidden) {
    if (rootHtml.includes(token)) throw new Error(`dist entry still contains legacy token: ${token}`);
  }

  if (fs.existsSync(path.join(dist, 'js/generated/iron-marches-runtime.bundle.js'))) {
    throw new Error('legacy Iron Marches runtime was accidentally packaged into Reboot dist');
  }

  console.log(`Prepared RPChess Reboot Foundation distribution in ${dist}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
