# PHASE 0 STATUS — AUDIT AND PRODUCTION REGISTER

**Status:** complete for planning gate  
**Branch:** `audit/phase-0`  
**Implementation policy:** no mass gameplay rewrite has been started.

## Completed documents

- `CURRENT_STATE_AUDIT.md`
- `TARGET_ARCHITECTURE.md`
- `CONTENT_AND_ASSET_PRODUCTION_REGISTER.md`
- `CONTENT_GAP_SUMMARY.md`
- `DESKTOP_WRAPPER_DECISION.md`
- `IMPLEMENTATION_ROADMAP.md`
- `RELEASE_ACCEPTANCE_CHECKLIST.md`
- `TEST_STRATEGY.md`
- `DATA_FORMATS_AND_SCHEMAS.md`

## Register annexes

- foundations, regions, kings and doctrines;
- 36 named heroes and 18 political characters;
- 72 figure-bound relics;
- 140 authored events;
- 96 encounter modules and 15 boss kits;
- UI, kingdom, tutorial, audio, accessibility and Steam publication assets.

## Verified baseline

- packaged project inspected;
- all seven existing Node test suites pass;
- current Cloudflare deployment chain mapped;
- current source/content quantities inventoried;
- current combat behavior compared with the legal-chess target;
- persistence, localization, UI, input, platform and Steam gaps documented.

## Critical findings

1. The repository deploys an old source ZIP and mutates it with sequential string patches.
2. The current battle engine has chess-shaped movement but not legal chess/check/mate rules.
3. `core.js` and `ui.js` mix too many responsibilities for release-scale expansion.
4. Save safety, profiles, replay and Steam Cloud architecture are absent.
5. Current authored content is far below release minimums.

## Approved next work order

1. Normalize repository source and make the build reproducible without network asset downloads.
2. Add characterization/regression tests around the current playable loop.
3. Introduce deterministic RNG/ID and command/event boundaries.
4. Build the legal chess core behind independent tests.
5. Integrate systems incrementally while preserving a runnable build.

## Gate decision

Phase 0 planning requirements from the master brief are represented in the branch. Stage 1 may begin after this documentation branch is merged. No user decision is currently required; the implementation order follows `IMPLEMENTATION_ROADMAP.md`.
