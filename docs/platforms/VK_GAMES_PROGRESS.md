# VK Games publication — progress

**Updated:** 2026-09-10  
**Current stage:** VK Games publication  
**Working branch:** `platform/vk-games`  
**Implementation head:** `3e8ebf5bffe3f8d3fcdfef1dc2529888fda6151d`  
**Draft PR:** #137  
**Canonical checklist:** `docs/platforms/VK_GAMES_PUBLICATION_PLAN.md`

This file is a compact handoff/status companion for agents. The canonical task definitions remain in `VK_GAMES_PUBLICATION_PLAN.md`; completed iteration evidence is recorded here when a full checklist rewrite is unnecessary.

## 0 — Current RPChess VK-readiness

- [x] One shared repository / `main`.
- [x] Canonical static production build in `dist/`.
- [x] `gate:local` and browser test infrastructure present.
- [x] RPChess already runs as a static Web application.
- [x] Runtime CSS/JS/assets are predominantly relative-path based.
- [x] Stockfish 18 JS/WASM is materialized into the production build with notices.
- [x] Run persistence is centralized in `game/js/run-persistence.mjs`.
- [ ] VK Bridge — intentionally deferred to checklist section 3.
- [ ] `build:vk` — intentionally deferred to section 4.
- [ ] `vk-hosting-config.json` — deferred to section 5 after `app_id` exists.
- [ ] VK Game/App + `app_id` — owner action in section 2.

**Result:** section 0 readiness audit complete. The remaining unchecked items are later integration stages, not failures of the current Web baseline.

## 1 — Shared platform foundation

- [x] Created `platform/vk-games` from `main@d5ec1376048d2308fd54c9d81a6dc4590b053564`.
- [x] Shared gameplay remains in the existing `game/` owners; no VK gameplay fork was created.
- [x] Added `game/js/platform/platform.mjs` as the platform resolver/runtime boundary.
- [x] Added `game/js/platform/web-platform.mjs`; Web is the default adapter.
- [x] Added `game/js/platform/vk-platform.mjs` as an SDK-free VK scaffold.
- [x] Added service boundaries for storage, ads, payments, analytics, social and lifecycle.
- [x] `reboot-foundation.mjs` initializes the platform layer non-blockingly and exposes `RPChessPlatformReady`.
- [x] Production packager includes `js/platform` and verifies the adapter files exist in `dist`.
- [x] Existing Foundation regression was extended; no redundant test suite was created.
- [x] Added `platforms/vk/README.md` with the rule that gameplay owners may not call VK Bridge directly.
- [x] Draft PR #137 opened to trigger the existing PR validation workflow.
- [x] Exact PR run `34494916398`: `npm ci` + canonical `gate:local`/build passed on `3e8ebf5b...`; Pages subpath browser smoke continues as the final PR validation stage.

## Next dependency

The next numbered checklist item is **2 — create the VK Game/App in the VK developer panel and obtain `app_id`**. This is an owner action. After `app_id` is available, implementation can continue with section 3 (real VK Bridge + early `VKWebAppInit`), then section 4 (`build:vk`) and section 5 (VK Hosting config).
