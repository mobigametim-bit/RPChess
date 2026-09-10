# RPChess — VK Games platform layer

**Status:** App ID received (`54754579`). Platform foundation is active; VK Bridge integration and dedicated VK build are implemented on `platform/vk-games`. No VK deploy is performed automatically.

RPChess keeps one shared game in `game/`. VK-specific integration stays behind `game/js/platform/` and the dedicated `dist-vk` build overlay.

## Rules

- Do not fork or copy gameplay modules for VK.
- Do not call `VKWebApp*` / `bridge.send(...)` directly from Battle, Skirmish, Events, Resources, Settlement, Puzzles or other gameplay owners.
- Shared gameplay/UI/localization/assets remain common for Web and VK.
- Platform-specific capabilities are exposed only through the platform adapter.
- The default Web build must continue to resolve `web-platform.mjs` and must not load VK Bridge.
- Optional/unsupported VK methods are checked through `supportsAsync` and return safe fallback results rather than breaking gameplay.
- `VKWebAppInit` is issued from the VK platform adapter during the dedicated VK bootstrap; failure/timeout resolves to a non-fatal platform state.

## Current adapter surface

`platform.init()` resolves one adapter and exposes boundaries for:

- `storage`
- `ads`
- `payments`
- `analytics`
- `social`
- `lifecycle`

The service boundaries are present now. Storage/ads/payments/social integrations remain disabled (`supported: false`) until their dedicated checklist stages.

## VK Bridge packaging

RPChess is a bundle-less static runtime, so the VK build uses the official browser distribution of `@vkontakte/vk-bridge` rather than a bare npm import in the browser.

Pinned version: **3.0.2**.

Files kept under `platforms/vk/vendor/`:

- `vk-bridge-3.0.2.browser.min.js` — official browser bundle;
- `VK_BRIDGE_LICENSE.txt` — MIT license notice;
- `vk-bridge-mock.js` — RPChess deterministic development/test mock (not the VK package).

The canonical Web `dist/` does not receive these files. `scripts/build-vk.cjs` copies only the selected real/mock bundle into `dist-vk/vendor/vk-bridge/browser.min.js`.

## Build commands

- `npm run build` → canonical Web build in `dist/`.
- `npm run build:vk` → builds Web baseline, then materializes the VK overlay in `dist-vk/`.
- `npm run build:vk:mock` → same VK build but with deterministic local Bridge mock.
- `npm run gate:vk` → VK adapter Node contract + real VK build + packaging checks.
- `npm run test:browser:vk` → targeted Chromium smoke against an already prepared `dist-vk` (the CI workflow first prepares the mock build).

`vk-hosting-config.json` is intentionally kept at repository root because the official VK deploy utility reads it there. Current `app_id`: `54754579`; `static_path`: `dist-vk`.

## Deployment

No token, service key or user access token is stored in Git. The current repository stage prepares and validates the package only. Actual `vk-miniapps-deploy` publication remains an explicit owner-triggered action after the build is tested in the VK project.

## Source of truth

See `docs/platforms/VK_GAMES_PUBLICATION_PLAN.md` and `docs/platforms/VK_GAMES_PROGRESS.md`.
