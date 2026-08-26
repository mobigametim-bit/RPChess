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

  for (const relative of [
    'index.html',
    'BUILD_INFO.json',
    'css/reboot-foundation.css',
    'css/classic-chess.css',
    'js/reboot-foundation.mjs',
    'js/reboot-audio.mjs',
    'js/classic-chess-engine.mjs',
    'js/classic-chess-app.mjs',
    'fonts',
    'generated_assets',
    'music'
  ]) copy(relative);

  verifySource(dist);

  const rootHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  for (const token of ['iron-marches-runtime.bundle.js', 'vertical-slice-app.mjs', 'explicit-run-setup.mjs', 'ui-approved-campaign.mjs']) {
    if (rootHtml.includes(token)) throw new Error(`dist entry still contains legacy token: ${token}`);
  }
  if (fs.existsSync(path.join(dist, 'js/generated/iron-marches-runtime.bundle.js'))) {
    throw new Error('legacy Iron Marches runtime was accidentally packaged into Reboot dist');
  }

  for (const relative of [
    'css/classic-chess.css',
    'js/classic-chess-engine.mjs',
    'js/classic-chess-app.mjs',
    'js/reboot-audio.mjs',
    'music/echoes_iron_throne_01.mp3',
    'music/echoes_iron_throne_02.mp3',
    'music/echoes_iron_throne_03.mp3',
    'music/echoes_iron_throne_04.mp3'
  ]) {
    if (!fs.existsSync(path.join(dist, relative))) throw new Error(`Classic Chess build output missing: ${relative}`);
  }

  console.log(`Prepared RPChess Classic Chess distribution in ${dist}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
