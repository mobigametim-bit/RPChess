# VK Games publication — progress

**Updated:** 2026-09-10  
**Current stage:** VK Games publication — real VK Web acceptance  
**Working branch:** `platform/vk-games`  
**Current runtime candidate:** `40fba371763113a31d94bc89287cda59dedf74a9`  
**Successful VK Hosting diagnostic deploy commit:** `24929f7482443f15fa666598f14a4dbe500a405f`  
**VK Hosting dev version:** `1789073236`  
**VK dev URL:** `https://stage-app54754579-d1b007975863.pages.vk-apps.ru/index.html`  
**VK App ID:** `54754579` (`app54754579`)  
**Draft PR:** #137  
**Canonical checklist:** `docs/platforms/VK_GAMES_PUBLICATION_PLAN.md`

This file is the compact operational handoff/status companion for agents. The canonical task definitions remain in `VK_GAMES_PUBLICATION_PLAN.md`; exact implementation/test evidence is recorded here so another agent can continue without re-auditing completed work.

## First real VK Hosting upload — COMPLETE WITH AUDIO LIMITATION

- [x] Owner configured `MINI_APPS_ACCESS_TOKEN` as a GitHub Actions Repository Secret; the value is not stored in source/docs.
- [x] First non-interactive `dev` deployment path was exercised from GitHub Actions.
- [x] Full `dist-vk` payload was initially rejected by VK Hosting at `apps.createGoHostingTask` with `15: Access denied: invalid file`.
- [x] Diagnostic upload excluded only the 5 `.mp3` files from the upload payload; source assets, canonical Web build and gameplay code were not deleted.
- [x] Diagnostic upload succeeded in GitHub Actions run `34527974937`, job `103042645832`.
- [x] VK Hosting version: `1789073236`.
- [x] Desktop/mobile/mvk dev endpoints were all updated to `https://stage-app54754579-d1b007975863.pages.vk-apps.ru/index.html`.
- [x] Temporary one-shot PR deploy job/marker was removed after success; future VK production deployment remains manual-only.
- [ ] Current dev preview has no MP3 music/SFX. This is diagnostic only; final VK release must resolve supported audio delivery/format instead of silently shipping without audio.
- [ ] Owner must now open the real VK dev build and perform acceptance.

## 0 — Current RPChess VK-readiness — COMPLETE

- [x] One shared repository / `main`.
- [x] Canonical static production build in `dist/`.
- [x] `gate:local` and browser test infrastructure present.
- [x] RPChess runs as a static Web application.
- [x] Runtime CSS/JS/assets are predominantly relative-path based.
- [x] Stockfish 18 JS/WASM is materialized into the production build with notices.
- [x] Run persistence is centralized in `game/js/run-persistence.mjs`.

## 1 — Shared platform foundation — COMPLETE

- [x] Created `platform/vk-games` from `main@d5ec1376048d2308fd54c9d81a6dc4590b053564`.
- [x] Shared gameplay remains in existing `game/` owners; no VK gameplay fork exists.
- [x] Added shared platform resolver/runtime boundary.
- [x] Web remains the default adapter.
- [x] VK has a dedicated adapter behind the shared platform contract.
- [x] Service boundaries exist for storage, ads, payments, analytics, social and lifecycle.
- [x] Foundation initializes the platform layer non-blockingly.
- [x] Gameplay owners do not call VK Bridge directly.
- [x] Canonical Tech Architecture documents the one-runtime/multiple-adapters rule.

## 2 — VK Game/App — COMPLETE FOR CURRENT INTEGRATION

- [x] Owner created the VK Game/App.
- [x] App ID received: `54754579`.
- [x] No protected/service keys were committed or passed into runtime source.
- [ ] Final platform toggles (Web/Mobile/OK) still require owner review in the VK panel before moderation. Current implementation targets VK Web first; Mobile remains a later real-client acceptance step.

## 3 — VK Bridge — COMPLETE FOR FIRST HOSTING CANDIDATE

- [x] Pinned VK Bridge browser runtime: `@vkontakte/vk-bridge` 3.0.2.
- [x] Real `VKPlatformAdapter` implemented.
- [x] `VKWebAppInit` is attempted before common Foundation bootstrap.
- [x] Init timeout/error handling is non-fatal to common gameplay.
- [x] Optional method support checking uses Bridge capability APIs.
- [x] VK calls stay inside the platform layer; shared gameplay remains SDK-independent.
- [x] Unsupported storage/ads/payments/analytics/social/lifecycle capabilities currently expose safe disabled fallbacks.
- [x] Existing Foundation regression was advanced from Stage 1 scaffold expectations to the Stage 3 Bridge contract.
- [x] Deterministic Node adapter test covers success, support checks, timeout and bridge-unavailable paths.
- [x] Deterministic browser mock covers successful `VKWebAppInit`.
- [x] Deterministic browser mock also covers rejected `VKWebAppInit`; the common menu must still render with no `pageerror`.

## 4 — Separate VK build — COMPLETE FOR FIRST HOSTING CANDIDATE

- [x] `npm run build:vk` exists.
- [x] Build starts from the canonical Web production pipeline.
- [x] VK output is isolated in `dist-vk/`; canonical `dist/` remains Web-only.
- [x] VK build contains `index.html`, CSS/JS/localization/runtime assets, Stockfish JS/WASM and license notices.
- [x] VK build injects platform config, pinned Bridge bundle and `vk-bootstrap.mjs` before common Foundation.
- [x] Build rejects root-absolute HTML/CSS runtime URLs.
- [x] Stockfish JS/WASM packaging is asserted in the VK build contract.
- [x] Canonical Web build is asserted not to contain VK bootstrap.

## 5 — VK Hosting config — COMPLETE FOR FIRST HOSTING CANDIDATE

- [x] Root `vk-hosting-config.json` exists.
- [x] `static_path` = `dist-vk`.
- [x] `app_id` = `54754579`.
- [x] `noprompt` = `true` for CI/non-interactive deployment.
- [x] `web`, `mobile` and `mvk` endpoints currently map to `index.html`.
- [x] No secret is stored in the config.
- [x] Manual-only `.github/workflows/vk-deploy.yml` exists; there is no push-triggered VK production deployment.
- [x] Deploy workflow always executes `gate:vk` before publishing and requires `MINI_APPS_ACCESS_TOKEN` from GitHub Actions Secrets.
- [x] Deploy tool is pinned at invocation to `@vkontakte/vk-miniapps-deploy@1.0.2`.

## 6 — Preview/testing — REAL VK DEV BUILD AVAILABLE; HUMAN ACCEPTANCE PENDING

Automated evidence for runtime candidate `40fba371763113a31d94bc89287cda59dedf74a9`:

- [x] VK validation workflow run `34504789713` — SUCCESS.
- [x] `gate:vk` — PASS.
- [x] VK adapter success/fallback Node contract — PASS.
- [x] Production `dist-vk` / config / Bridge / Stockfish packaging — PASS.
- [x] Mock successful `VKWebAppInit` browser smoke — PASS.
- [x] Common Reboot Foundation responsive browser acceptance on VK build — PASS.
- [x] Classic Chess + real Stockfish browser acceptance on VK build — PASS.
- [x] Mock rejected `VKWebAppInit` fallback — PASS; common menu remains usable.
- [x] Previous exact canonical Web/Pages run `34499856191` on `6a1f613c...` — SUCCESS after advancing the stale Stage-1 assertion.
- [x] Local manual server exists: after `npm run build:vk`, run `node scripts/serve-vk.cjs`; `.wasm` is served as `application/wasm`.
- [x] Manual full VK browser review workflow exists and reuses the complete existing Chromium matrix against `dist-vk` before moderation/release.
- [x] Real VK Hosting `dev` upload succeeded without MP3 in run `34527974937`.

Human acceptance still open:

- [ ] Owner opens `https://stage-app54754579-d1b007975863.pages.vk-apps.ru/index.html` in the real VK development context / browser.
- [ ] Practical smoke through New Run / Travel / Skirmish / Battle / Event / Puzzle / Settlement.
- [ ] Save → reload verified in real VK context.
- [ ] Confirm expected lack of audio in this diagnostic preview; do not treat it as an audio regression in gameplay source.
- [ ] Full VK browser review workflow executed before moderation candidate freeze.
- [ ] Mobile Android/iOS smoke only if those platforms are enabled for the first release.

## Current blockers / next work

1. Human-check the live VK dev build.
2. Resolve VK Hosting MP3 incompatibility for final VK delivery while preserving audio in other platforms.
3. Continue section 7 persistence decision after the real VK smoke.
4. Keep `platform/vk-games` unmerged until real VK Web acceptance or explicit owner authorization.

Do not merge `platform/vk-games` to `main` until the VK build has passed real VK Web acceptance or the owner explicitly authorizes an earlier merge.
