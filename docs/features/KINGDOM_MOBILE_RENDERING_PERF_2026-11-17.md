# Kingdom Journey — mobile rendering performance

**Date:** 2026-11-17
**Branch:** `perf/kingdom-mobile-rendering`
**Status:** implementation / automated QA; human acceptance **pending**
**Scope:** presentation only. No changes to rules, economy, world generation, save schema or art.

## Source-level bottlenecks (main at `efe8aac9`)

1. `kingdom-map-app.mjs::render()` discarded the entire tile DOM and five Canvas layers for inspector clicks, steps, zoom/pinch and camera changes.
2. `renderParchment()` and `renderParchmentFog()` redrew all terrain, roads, vegetation and fog even when world and camera were unchanged.
3. Every map render regenerated traveler itineraries through `createTravelers()` and restarted the Canvas animation.
4. The traveler animation tick evaluated every generated actor at approximately 30 FPS, even when the actor's entire itinerary was far outside the viewport.
5. The existing headless Chromium map benchmark is informational: it cannot establish Android/tablet FPS or memory usage.

## Change set (no visual redesign)

- **Inspector-only selection:** update only selected-cell class and inspector/action UI; the map, fog and traveler canvases retain identity.
- **Pinch zoom:** update the CSS scale during pointer movement; persist zoom and rebuild the viewport once on gesture completion.
- **Canvas reuse:** retain the five map Canvas nodes and their backing buffers across full renders; use a state/geometry signature for static parchment, overlays and fog. Avoid static painting when only a King movement phase or non-geographic state changed.
- **Traveler memoization:** a small LRU cache of deterministic itineraries, keyed by relevant road/ownership/encounter data. Changes to road network, settlement eligibility or ownership invalidate the cache.
- **Viewport itinerary culling:** derive a conservative envelope of entire traveler routes, including natural-road curves, and skip offscreen travelers during each animation tick. No limit is imposed on generated character numbers; simulation/gameplay remains untouched.
- **Diagnostics:** `[data-kingdom-world].dataset.lastRenderMs`, `staticMapReused`, `.km-travelers-layer.dataset.walkerCache` and `viewportWalkerCount`.
- **Minimal regression extension:** existing `tests/kingdom-map-browser.cjs` checks selection/return retain Canvas identities.

## Verification

1. `npm run gate:local` and focused real-Chromium Kingdom/Travel/Menu/Arena regressions.
2. QA Worker URL after successful CI: https://rpchess-kingdom-mobile-perf-preview.mobigametim.workers.dev/
3. Manually compare Android phone and tablet, preferably the same real run/save and zoom before/after:
   - select event cards repeatedly; inspect UI correctness, no freezes;
   - drag/pinch/zoom; check no empty uncovered edges after pinch;
   - move the King, reveal fog, build/visit settlements, return from Battle/Arena;
   - watch moving NPCs near viewport boundaries and after camera shifts;
   - test a larger kingdom over repeated journeys, RU/EN and VK embedded browser;
   - watch FPS, long frames, device heat and crashes; gather DevTools trace when available.
4. No artificial green FPS threshold is claimed from desktop CI. Release only after owner tests the isolated QA build on real devices and approves.

## Follow-up opportunities, only if measurements justify them

- Move terrain drawing into fixed-world-coordinate cached chunks to avoid large canvas redraw on camera changes.
- Cap backing-store resolution by actual on-screen pixel density (quality check required).
- Add coarse territory-ownership indexes if long-run profiles show array membership bottlenecks.
- Evaluate GoogleChrome/modern-web-guidance in the agent development setup, not in the shipped game bundle.

**Release gate:** separate draft PR → automated tests → owner device QA → explicit acceptance → release-approved full gate → merge → production publish.
