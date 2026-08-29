const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const game = path.join(root, 'game');
  const assets = await import(pathToFileURL(path.join(game, 'js/race-assets.mjs')).href);
  const css = fs.readFileSync(path.join(game, 'css/events.css'), 'utf8');
  const routeSource = fs.readFileSync(path.join(game, 'js/battle-route.mjs'), 'utf8');

  const demonPath = assets.eventBackgroundPath({ id: 'E-DEMON-VISUAL', race: 'Демоны' });
  assert(/^assets\/events\/register-04\/backgrounds\/demons\/(infernal_breach|ashen_altar)\.png$/.test(demonPath), `unexpected Demon Event background: ${demonPath}`);
  assert(css.includes('background-image:var(--events-background,none)'), 'Event scene must render the authored background as an explicit background-image layer');
  assert(css.includes('rgba(5,12,22,.34)'), 'desktop Event panel must leave a visibly transparent side for scene art');
  assert(!css.includes('rgba(4,7,12,.94)'), 'old near-opaque Event fullscreen veil must not return');
  assert(routeSource.includes('css/events.css?v=20260829-events-3'), 'stable preview must cache-bust the corrected Events visual stylesheet');

  console.log('Events authored background mapping, visibility and cache-busting contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
