const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'game');
const ENTRYPOINTS = [
  'js/reboot-foundation.mjs',
  'js/roster-app.mjs',
  'js/classic-chess-app.mjs',
  'js/skirmish-app.mjs',
];

function read(relativePath) {
  return fs.readFileSync(path.join(GAME, relativePath), 'utf8');
}

function resolveImport(from, specifier) {
  if (!specifier.startsWith('.')) return null;
  const candidate = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  const variants = path.posix.extname(candidate)
    ? [candidate]
    : [`${candidate}.mjs`, `${candidate}.js`, path.posix.join(candidate, 'index.mjs')];
  return variants.find((file) => fs.existsSync(path.join(GAME, file))) || null;
}

function importsFrom(relativePath) {
  const source = read(relativePath);
  const imports = new Set();
  const patterns = [
    /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const resolved = resolveImport(relativePath, match[1]);
      if (resolved) imports.add(resolved);
    }
  }
  return [...imports];
}

const graph = new Map();
const visit = (relativePath) => {
  if (graph.has(relativePath)) return;
  const imports = importsFrom(relativePath);
  graph.set(relativePath, imports);
  imports.forEach(visit);
};
ENTRYPOINTS.forEach(visit);

const visiting = new Set();
const visited = new Set();
function assertAcyclic(node, trail = []) {
  if (visiting.has(node)) {
    const start = trail.indexOf(node);
    assert.fail(`Production module cycle: ${[...trail.slice(start), node].join(' -> ')}`);
  }
  if (visited.has(node)) return;
  visiting.add(node);
  for (const dependency of graph.get(node) || []) assertAcyclic(dependency, [...trail, node]);
  visiting.delete(node);
  visited.add(node);
}
ENTRYPOINTS.forEach((entrypoint) => assertAcyclic(entrypoint));

const foundation = read('js/reboot-foundation.mjs');
const travelCssIndex = foundation.indexOf('data-travel-choice-css');
const routeImportIndex = foundation.indexOf("import('./battle-route.mjs')");
assert(travelCssIndex >= 0, 'Foundation must own Travel CSS loading');
assert(routeImportIndex >= 0, 'Foundation must load the battle route');
assert(travelCssIndex < routeImportIndex, 'Travel CSS must be installed before the battle route loads');

const battleRoute = read('js/battle-route.mjs');
assert(!battleRoute.includes('data-travel-choice-css'), 'Battle route must not duplicate Travel CSS loading');
assert(!battleRoute.includes('eventsCss.href'), 'Battle route must not rewrite the Events CSS cache version');

console.log(`Code health runtime tests PASS (${graph.size} production modules, no cycles)`);
