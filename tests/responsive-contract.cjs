const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'game');
const FINAL_CSS = fs.readFileSync(path.join(GAME, 'css', 'ui-redesign-final.css'), 'utf8');

function walk(dir, extension) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(target, extension);
    return target.endsWith(extension) ? [target] : [];
  });
}

const cssFiles = walk(path.join(GAME, 'css'), '.css');
const jsFiles = walk(path.join(GAME, 'js'), '.mjs');
const css = cssFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

assert(/@media\(min-width:901px\) and \(max-width:1180px\)/.test(FINAL_CSS), 'intermediate-width contract is missing');
for (const token of [
  '.travel-choice-screen .travel-choice-topbar--command{grid-template-columns:1fr!important;}',
  'body.skirmish-active .skirmish-layout{grid-template-columns:minmax(0,1fr) minmax(320px,.72fr)!important;}',
  'body.skirmish-active .skirmish-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}',
  'body.battle-prep-compact-active .battle-layout{grid-template-columns:minmax(0,1fr) minmax(360px,.8fr)!important;gap:12px!important;}',
  'body.battle-prep-compact-active .battle-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}',
  '@media(pointer:coarse)',
  '.skirmish-selection>.skirmish-actionbar .skirmish-start{min-height:44px!important;}'
]) assert(FINAL_CSS.includes(token), `responsive final CSS missing ${token}`);

const userAgentSniffs = jsFiles.filter((file) => /navigator\s*\.\s*userAgent|userAgentData/.test(fs.readFileSync(file, 'utf8')));
assert.deepStrictEqual(userAgentSniffs, [], `production UA sniffing is forbidden: ${userAgentSniffs.join(', ')}`);
assert(!/body[^{}]*\{[^{}]*transform\s*:\s*scale\(/i.test(css), 'app-wide transform scaling is forbidden');

const mediaQueries = [...css.matchAll(/@media\s*\(([^)]+)\)/g)];
const breakpoints = [...new Set(mediaQueries.flatMap((match) => [...match[1].matchAll(/(?:min|max)-width\s*:\s*(\d+)px/g)].map((value) => Number(value[1]))))].sort((a, b) => b - a);
const containerQueries = (css.match(/@container\b/g) || []).length;

console.log(`Responsive contract: PASS — ${cssFiles.length} CSS files, ${mediaQueries.length} media queries, ${breakpoints.length} width breakpoints (${breakpoints.join(', ')}), ${containerQueries} container queries, no production UA sniffing or app-wide scale`);
