const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const game = path.join(root, 'game');
  const assets = await import(pathToFileURL(path.join(game, 'js/race-assets.mjs')).href);
  const css = fs.readFileSync(path.join(game, 'css/events.css'), 'utf8');
  const appSource = fs.readFileSync(path.join(game, 'js/events-app.mjs'), 'utf8');

  const demonPath = assets.eventBackgroundPath({ id: 'E-DEMON-VISUAL', race: 'Демоны' });
  assert(/^assets\/events\/register-04\/backgrounds\/demons\/(infernal_breach|ashen_altar)\.png$/.test(demonPath), `unexpected Demon Event background: ${demonPath}`);

  assert(appSource.includes('class="events-backdrop"'), 'Event scene must own a dedicated artwork layer instead of relying on the scene background shorthand');
  assert(appSource.includes('data-events-background'), 'Event scene must render an explicit background image element');
  assert(appSource.includes('new URL(assetPath, document.baseURI).href'), 'Event background URL must be resolved explicitly against the page origin');
  assert(appSource.includes("css/events.css?v=20260830-events-v3"), 'Event v3 runtime itself must cache-bust the updated stylesheet');
  assert(appSource.includes('data-events-king-reaction'), 'Event v3 scene must expose the King reaction layer');
  assert(appSource.includes('formatHeroReaction'), 'Event v3 scene must render role-gated hero reactions');
  assert(!appSource.includes("setProperty('--events-background'"), 'legacy CSS-variable background injection must not return');

  assert(css.includes('.events-backdrop img'), 'Event backdrop image must have an explicit cover rendering rule');
  assert(css.includes('width:min(980px,68vw)'), 'desktop reading panel must reserve a large exposed artwork region');
  assert(css.includes('rgba(3,7,13,.05)'), 'right side of the desktop artwork must remain only lightly graded');
  assert(css.includes('.events-reaction--king'), 'Event v3 must style the King voice layer');
  assert(css.includes('.events-choice__reaction'), 'Event v3 must style the hero voice layer');
  assert(!css.includes('background-image:var(--events-background,none)'), 'legacy background variable renderer must not return');
  assert(!css.includes('rgba(4,7,12,.94)'), 'old near-opaque Event fullscreen veil must not return');

  console.log('Events v3 explicit backdrop, King/hero voice layers and runtime cache-busting contract: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
