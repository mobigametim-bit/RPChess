# Localized screen loading and asset readiness

Status: IMPLEMENTED; pending CI, browser verification, and human acceptance (do not merge yet).

## User-visible behavior
- Display a full-viewport solid black loading screen before any game screen.
- Center the pre-existing `generated_assets/logo_ru.png` or `logo_en.png` based on the saved RU/EN language, and show blinking `ЗАГРУЗКА...` / `LOADING...`.
- Fade out only after current-screen styles, visible images and image backgrounds are loaded/decoded. Respect reduced-motion settings.
- On changing main screens, show the mask only when current viewport artwork or styles need loading, not when already cached.
- Never preload the complete game content registry (hundreds of backgrounds/portraits) at startup: limit waiting to current-screen assets.
- Nonfatal asset failures are logged and do not leave the user trapped on black forever; startup has a 20-second safety release.

## Implementation
- `game/index.html`: early persisted-language detection and loading mask.
- `game/css/screen-loading.css`: full-screen style, logo scaling and blinking text.
- `game/js/screen-loading.mjs`: current-screen asset and stylesheet readiness gate; observes changes of top-level `main[hidden]` views.
- `scripts/build.cjs`: package both loader files for Pages, VK, and Yandex builds.
- `tests/reboot-foundation.cjs`: extend existing regression contract rather than creating a new permanent suite.

## QA checklist
1. Throttle network on a fresh browser session; verify there is no partially drawn menu before the loading screen clears.
2. Switch Russian to English, reload, and verify English logo + LOADING, then switch back to Russian.
3. First navigation to Journey/Roster/Arena with an empty browser cache should not show partially drawn icons or backgrounds.
4. Repeat navigation with a warm cache; no redundant flicker of the loading screen.
5. Simulate one missing image: loading screen eventually clears (error logged), no permanent black screen.
6. Reduced Motion / OS prefers-reduced-motion: text doesn't blink, fade is disabled.
7. Verify narrow viewport and VK iframe/standalone Pages contexts.

No change to chess rules, saves, monetization, or game balance. `main` remains untouched until acceptance.
