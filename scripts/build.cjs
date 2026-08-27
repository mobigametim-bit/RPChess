const fs = require('fs');
const path = require('path');
const verifySource = require('./verify-source.cjs');
const { prepareStockfishAssets } = require('./stockfish-assets.cjs');

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
    'css/chess-ai-polish.css',
    'css/roster.css',
    'css/skirmish.css',
    'css/battle.css',
    'css/travel-choice.css',
    'js/reboot-foundation.mjs',
    'js/reboot-audio.mjs',
    'js/classic-chess-engine.mjs',
    'js/classic-chess-app.mjs',
    'js/chess-ai-adapter.mjs',
    'js/roster-data.mjs',
    'js/run-persistence.mjs',
    'js/roster-app.mjs',
    'js/skirmish-core.mjs',
    'js/skirmish-app.mjs',
    'js/battle-core.mjs',
    'js/battle-app.mjs',
    'js/battle-route.mjs',
    'js/travel-choice-core.mjs',
    'js/travel-choice-app.mjs',
    'assets/kings/oathkeeper',
    'assets/heroes/aldric_wall',
    'assets/heroes/mara_chain',
    'assets/heroes/nemea_quill',
    'assets/heroes/brother_orell',
    'assets/heroes/vael_hammer',
    'fonts',
    'generated_assets',
    'music'
  ]) copy(relative);

  const stockfish = await prepareStockfishAssets(dist);
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
    'css/chess-ai-polish.css',
    'css/roster.css',
    'css/skirmish.css',
    'css/battle.css',
    'css/travel-choice.css',
    'js/classic-chess-engine.mjs',
    'js/classic-chess-app.mjs',
    'js/chess-ai-adapter.mjs',
    'js/roster-data.mjs',
    'js/run-persistence.mjs',
    'js/roster-app.mjs',
    'js/skirmish-core.mjs',
    'js/skirmish-app.mjs',
    'js/battle-core.mjs',
    'js/battle-app.mjs',
    'js/battle-route.mjs',
    'js/travel-choice-core.mjs',
    'js/travel-choice-app.mjs',
    'js/reboot-audio.mjs',
    'assets/kings/oathkeeper/portrait.png',
    'assets/kings/oathkeeper/piece.png',
    'assets/heroes/aldric_wall/portrait.png',
    'assets/heroes/aldric_wall/piece_badge.png',
    'assets/heroes/mara_chain/portrait.png',
    'assets/heroes/mara_chain/piece_badge.png',
    'assets/heroes/nemea_quill/portrait.png',
    'assets/heroes/nemea_quill/piece_badge.png',
    'assets/heroes/brother_orell/portrait.png',
    'assets/heroes/brother_orell/piece_badge.png',
    'assets/heroes/vael_hammer/portrait.png',
    'assets/heroes/vael_hammer/piece_badge.png',
    'music/echoes_iron_throne_01.mp3',
    'music/echoes_iron_throne_02.mp3',
    'music/echoes_iron_throne_03.mp3',
    'music/echoes_iron_throne_04.mp3',
    'vendor/stockfish/stockfish-18-lite-single.js',
    'vendor/stockfish/stockfish-18-lite-single.wasm',
    'vendor/stockfish/COPYING.txt',
    'vendor/stockfish/SOURCE.txt'
  ]) {
    if (!fs.existsSync(path.join(dist, relative))) throw new Error(`Travel Choice build output missing: ${relative}`);
  }

  console.log(`Prepared RPChess Travel Choice distribution in ${dist}; Stockfish ${stockfish.version}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
