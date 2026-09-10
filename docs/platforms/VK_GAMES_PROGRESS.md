# VK Games publication — progress

**Updated:** 2026-09-11  
**Current stage:** VK Games publication — real VK mobile audio acceptance  
**Working branch:** `platform/vk-games`  
**Current mobile-audio runtime candidate:** `974c418709d31b644fa27eda8a4a6f198fc636ef`  
**Current branch head after one-shot cleanup:** `5a976cf003809bb42c2ab06641efb7412b2f27fb`  
**VK Hosting mobile-audio dev version:** `1789078875`  
**VK dev URL:** `https://stage-app54754579-f861812c54e4.pages.vk-apps.ru/index.html`  
**VK App ID:** `54754579` (`app54754579`)  
**Draft PR:** #137  
**Canonical checklist:** `docs/platforms/VK_GAMES_PUBLICATION_PLAN.md`

This file is the compact operational handoff/status companion for agents. The canonical task definitions remain in `VK_GAMES_PUBLICATION_PLAN.md`; exact implementation/test evidence is recorded here so another agent can continue without re-auditing completed work.

## VK mobile music regression — FIX DEPLOYED; HUMAN ACCEPTANCE PENDING

Observed in the real VK clients:

- [x] Owner verified that music works in the VK desktop client/browser build.
- [x] Owner reported that music did not start in the VK mobile version; tablet remained untested.
- [x] The shared external audio origin was therefore reachable from the deployed game, narrowing the issue to mobile media activation rather than VK Hosting packaging.

Root cause and fix:

- [x] Previous Foundation registered audio activation only once on the first `pointerdown`/`keydown`.
- [x] `HTMLMediaElement.play()` rejection was swallowed. A mobile WebView `NotAllowedError` on that first attempt therefore left background music permanently paused for the session.
- [x] `RebootAudio` now tracks playback success/failure (`musicPlaybackUnlocked`, `musicPlayPending`, `lastMusicPlayError`) and retries playback from later trusted user gestures until it succeeds.
- [x] Foundation now keeps lightweight `pointerdown`, `pointerup`, `touchend`, `click` and `keydown` activation handlers alive. Once music is already playing, `RebootAudio` short-circuits without issuing another `play()`.
- [x] The same gesture path also gives a suspended WebAudio context a chance to resume after mobile lifecycle changes.
- [x] Existing `tests/vk-platform-browser.cjs` was extended instead of creating a new suite. It deterministically rejects the first `play()` with `NotAllowedError` and requires a later real Playwright click to unlock music.
- [x] VK validation run `34535999482` — SUCCESS, including `VK mobile music user-gesture retry regression: PASS`, Foundation responsive acceptance, Classic+real Stockfish and Bridge failure fallback.
- [x] VK deploy run `34536590824` — validation SUCCESS + dev deploy SUCCESS.
- [x] VK Hosting version `1789078875` created.
- [x] Desktop/mobile/mvk dev endpoints updated to `https://stage-app54754579-f861812c54e4.pages.vk-apps.ru/index.html`.
- [x] Temporary one-shot mobile-audio deploy job/PR marker was removed immediately after successful upload; permanent VK deployment remains manual-only.
- [ ] Owner must now reopen/refresh the real VK mobile app and verify that music starts after a normal tap/click inside the game.
- [ ] Verify generated UI SFX separately.
- [ ] Verify `SFX/win_fanfare.mp3` separately when a victory screen is reached.

## VK Hosting audio constraint and external delivery — COMPLETE FOR DEV

Observed and reproduced:

- [x] VK Hosting rejected the full payload containing 5 MP3 files with `15: Access denied: invalid file`.
- [x] The same build uploaded successfully after excluding those MP3 files, proving the blocker was the Hosting media payload rather than RPChess runtime/Bridge/Stockfish.
- [x] Owner manually verified the first real VK build: gameplay/UI worked; only music and SFX were missing as expected.

Implemented solution:

- [x] Added shared `game/js/platform/audio-assets.mjs` resolver.
- [x] Canonical Web keeps the same relative/local audio paths.
- [x] VK production build sets `audioBaseUrl = https://mobigametim-bit.github.io/RPChess`.
- [x] Four background tracks in `reboot-audio.mjs` resolve through `audioAssetUrl()`.
- [x] Victory fanfare `SFX/win_fanfare.mp3` resolves through the same platform audio layer.
- [x] Production `dist-vk` automatically strips Hosting-disallowed media extensions from the upload bundle; no deploy-time diagnostic deletion is required anymore.
- [x] VK mock builds retain local audio so browser tests remain deterministic and independent of an external origin.
- [x] `tests/vk-build.cjs` asserts that Web retains all 5 MP3 files, production VK embeds no audio/video media, and the VK runtime config contains the external audio base URL.
- [x] Audio externalization validation run `34533393436` — SUCCESS, including Chromium success/failure Bridge paths.
- [x] Real audio-CDN VK Hosting dev deploy run `34533856283` — SUCCESS; Hosting version `1789076770`.

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
- [ ] Final platform toggles (Web/Mobile/OK) still require owner review before moderation. Current implementation targets VK Web first.

## 3 — VK Bridge — COMPLETE FOR FIRST HOSTING CANDIDATE

- [x] Pinned VK Bridge browser runtime: `@vkontakte/vk-bridge` 3.0.2.
- [x] Real `VKPlatformAdapter` implemented.
- [x] `VKWebAppInit` is attempted before common Foundation bootstrap.
- [x] Init timeout/error handling is non-fatal to common gameplay.
- [x] Optional method support checking uses Bridge capability APIs.
- [x] VK calls stay inside the platform layer; shared gameplay remains SDK-independent.
- [x] Deterministic Node/browser tests cover success, support checks, unavailable/rejected Bridge and common-menu fallback.

## 4 — Separate VK build — COMPLETE

- [x] `npm run build:vk` exists.
- [x] Build starts from the canonical Web production pipeline.
- [x] VK output is isolated in `dist-vk/`; canonical `dist/` remains Web-only.
- [x] VK build contains game code/assets, localization, Stockfish JS/WASM and license notices.
- [x] VK build injects platform config, pinned Bridge bundle and `vk-bootstrap.mjs` before common Foundation.
- [x] VK Hosting media is externalized instead of embedded.
- [x] Canonical Web build remains unchanged and retains local audio.

## 5 — VK Hosting config — COMPLETE

- [x] Root `vk-hosting-config.json` exists.
- [x] `static_path` = `dist-vk`.
- [x] `app_id` = `54754579`.
- [x] `noprompt` = `true` for CI/non-interactive deployment.
- [x] `web`, `mobile` and `mvk` endpoints map to `index.html`.
- [x] No secret is stored in the config.
- [x] Manual-only `.github/workflows/vk-deploy.yml` exists; there is no push-triggered VK production deployment.
- [x] Deploy flow requires `MINI_APPS_ACCESS_TOKEN` from GitHub Actions Secrets and runs `gate:vk` before publishing.

## 6 — Preview/testing — REAL VK BUILD AVAILABLE

Automated evidence:

- [x] Base VK validation run `34504789713` — SUCCESS.
- [x] Canonical Web/Pages run `34499856191` — SUCCESS.
- [x] First real VK Hosting diagnostic run `34527974937` — SUCCESS without embedded MP3.
- [x] Audio externalization validation run `34533393436` — SUCCESS.
- [x] Audio-enabled VK Hosting deploy run `34533856283` — SUCCESS; version `1789076770`.
- [x] Mobile audio retry validation run `34535999482` — SUCCESS.
- [x] Mobile audio fix deploy run `34536590824` — SUCCESS; version `1789078875`.
- [x] Bridge success + rejected-init fallbacks are covered by Chromium.
- [x] Classic Chess + real Stockfish works in VK browser test build.
- [x] Owner confirmed real VK gameplay/UI works and desktop music works.

Human acceptance still open for current version `1789078875`:

- [ ] Music plays inside real VK mobile after normal user interaction.
- [ ] UI SFX works in real VK mobile.
- [ ] Victory fanfare plays from the external audio origin.
- [ ] Tablet smoke if tablet is part of the intended first-release coverage.
- [ ] Recheck New Run / Travel / Skirmish / Battle / Event / Puzzle / Settlement after the audio-layer change.
- [ ] Save → reload verified in real VK context.
- [ ] Full VK browser review workflow executed before moderation candidate freeze.

## Current blockers / next work

1. Owner reopens/refreshes VK App `54754579` on mobile and tests music on Hosting version `1789078875`.
2. Verify UI SFX and victory fanfare as separate paths.
3. If mobile music is confirmed, record human acceptance and continue save/reload + remaining real VK flow checks.
4. Decide whether GitHub Pages remains the temporary audio origin for first release or move audio to production object storage/CDN before moderation.
5. Continue section 7 persistence decision.
6. Keep `platform/vk-games` unmerged until real VK acceptance or explicit owner authorization.
