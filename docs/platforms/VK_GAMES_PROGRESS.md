# VK Games publication — progress

**Updated:** 2026-09-10  
**Current stage:** VK Games publication — first real VK Hosting upload  
**Working branch:** `platform/vk-games`  
**Current code candidate:** `40fba371763113a31d94bc89287cda59dedf74a9`  
**VK App ID:** `54754579` (`app54754579`)  
**Draft PR:** #137  
**Canonical checklist:** `docs/platforms/VK_GAMES_PUBLICATION_PLAN.md`

This file is the compact operational handoff/status companion for agents. The canonical task definitions remain in `VK_GAMES_PUBLICATION_PLAN.md`; exact implementation/test evidence is recorded here so another agent can continue without re-auditing completed work.

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
- [x] `web`, `mobile` and `mvk` endpoints currently map to `index.html`.
- [x] No secret is stored in the config.
- [x] Manual-only `.github/workflows/vk-deploy.yml` exists; there is no push-triggered VK production deployment.
- [x] Deploy workflow always executes `gate:vk` before publishing and requires `MINI_APPS_ACCESS_TOKEN` from GitHub Actions Secrets.
- [x] Deploy tool is pinned at invocation to `@vkontakte/vk-miniapps-deploy@1.0.2`.

## 6 — Preview/testing — AUTOMATED PART COMPLETE; REAL VK ACCEPTANCE PENDING

Automated evidence for code candidate `40fba371763113a31d94bc89287cda59dedf74a9`:

- [x] VK validation workflow run `34504789713` — SUCCESS.
- [x] `gate:vk` — PASS.
- [x] VK adapter success/fallback Node contract — PASS.
- [x] Production `dist-vk` / config / Bridge / Stockfish packaging — PASS.
- [x] Mock successful `VKWebAppInit` browser smoke — PASS.
- [x] Common Reboot Foundation responsive browser acceptance on VK build — PASS.
- [x] Classic Chess + real Stockfish browser acceptance on VK build — PASS.
- [x] Mock rejected `VKWebAppInit` fallback — PASS; common menu remains usable.
- [x] Previous exact canonical Web/Pages run `34499856191` on `6a1f613c...` — SUCCESS after advancing the stale Stage-1 assertion.
- [x] Current code candidate canonical Web `gate:local` and artifact-size stages are PASS in run `34504789756`; its long Pages subpath Chromium smoke is separate PR validation and cannot deploy because the ref is not `main`.

Still intentionally open:

- [ ] Owner opens the first uploaded build inside real VK Web.
- [ ] Run practical smoke through New Run / Travel / Skirmish / Battle / Event / Puzzle / Settlement in real VK context.
- [ ] Verify save → reload in real VK context.
- [ ] Mobile Android/iOS smoke only if those platforms are enabled for the first release.
- [ ] VK Tunnel is not required yet because we have a deployable static candidate; use it only if real-container debugging becomes necessary.

## Deployment boundary / current blocker

The repository is technically ready for the **first VK Hosting upload** of App `54754579`.

The only external credential required to execute the prepared deploy workflow is `MINI_APPS_ACCESS_TOKEN`. It must be stored in **GitHub → Settings → Secrets and variables → Actions → Repository secrets** and must never be committed or pasted into project docs/chat. The official `vk-miniapps-deploy` tool accepts either its authorized user token or a service token for the deployable application.

After the secret exists, run the manual workflow **Deploy RPChess to VK Hosting** with environment `dev` first. Production stays manual-only.

## Next numbered/product decision

After the first real VK Web smoke, continue section 6 acceptance and then section 7 — decide first-release persistence policy:

- recommended first technical release: existing local save behind `platform.storage`;
- optional later iteration: VK cloud/platform storage after its current limits/conflict policy are designed and tested.

Do not merge `platform/vk-games` to `main` until the VK build has passed real VK Web acceptance or the owner explicitly authorizes an earlier merge.
