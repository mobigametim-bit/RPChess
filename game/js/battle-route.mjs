const eventsCss = document.querySelector('[data-events-css]');
if (eventsCss) eventsCss.href = 'css/events.css?v=20260829-events-3';

// Travel Choice is a critical run-shell surface. Its stylesheet must be present even when
// an unrelated encounter module fails during bootstrap.
if (!document.querySelector('[data-travel-choice-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/travel-choice.css?v=20260830-acceptance-1';
  link.dataset.travelChoiceCss = '';
  document.head.append(link);
}

const ROUTE_MODULES = Object.freeze([
  './resources-app.mjs',
  './battle-app.mjs',
  './settlement-app.mjs',
  './starvation-app.mjs',
  './events-app.mjs',
  './events/combat-art-continuity.mjs',
  './puzzles/puzzle-app.mjs',
  './travel-choice-app.mjs',
  './ux-consistency.mjs'
]);

// A failure in one optional/content module must not abort the rest of the run shell.
// Top-level await keeps RPChessRouteReady pending until every route module has either
// loaded or failed independently, so dependent transitions never race the listeners.
const results = await Promise.allSettled(ROUTE_MODULES.map((specifier) => import(specifier)));
const failures = [];
for (let index = 0; index < results.length; index += 1) {
  const result = results[index];
  if (result.status === 'rejected') {
    const specifier = ROUTE_MODULES[index];
    failures.push(Object.freeze({ specifier, reason: String(result.reason?.stack || result.reason || 'Unknown route bootstrap error') }));
    console.error(`[RPChess] Route module failed: ${specifier}`, result.reason);
  }
}

globalThis.RPChessRouteFailures = Object.freeze(failures);

export { ROUTE_MODULES };
