# DESKTOP_WRAPPER_DECISION.md

**Decision status:** Conditional recommendation after documentation review; implementation requires proof-of-concept gate.  
**Reviewed:** 2026-08-04  
**Target:** Windows Steam release, mandatory Steam Deck/Proton testing, HTML5/Canvas/Web Audio core retained.

## 1. Executive decision

**Recommended first implementation candidate: Electron with a sandboxed renderer, context isolation, a minimal preload bridge, and Steamworks access confined to the main process.**

This recommendation is conditional on a proof of concept that passes:

- Steam initialization and offline fallback;
- overlay;
- achievements;
- Cloud file operations/conflict metadata;
- leaderboards;
- Workshop publish/subscribe/update;
- controller input and glyph switching;
- Windows package launch through Steam;
- Steam Deck through Proton;
- memory and startup budgets.

**Fallback candidate: a custom CEF/native host** if the Node Steamworks binding cannot reliably cover Workshop, leaderboard replay attachment, Cloud conflicts or Steam Deck/Proton.

**Tauri 2 is not selected as the first candidate** despite its small application shell because it uses the operating system webview rather than shipping a fixed Chromium runtime. RPChess needs highly predictable Canvas/Web Audio/browser behavior across Windows and Proton, and Tauri’s Windows WebView2 dependency either relies on an installed runtime or adds roughly 180 MB when a fixed runtime is bundled. Rust Steamworks bindings are active and attractive, so Tauri remains a viable experiment if its Steam Deck behavior is proven early.

**NW.js is not selected** because it offers fewer security boundaries by design, encourages direct Node access from the DOM, and does not provide a decisive advantage over Electron for this project.

## 2. Non-negotiable architecture rule

The HTML5 game must never import Electron, Tauri, NW.js or Steamworks directly.

The game depends on a platform interface:

```ts
interface PlatformAdapter {
  files: FileStore;
  cloud: CloudService;
  achievements: AchievementService;
  leaderboards: LeaderboardService;
  workshop: WorkshopService;
  overlay: OverlayService;
  lifecycle: LifecycleService;
}
```

Browser builds receive null/browser implementations. Desktop builds inject Steam-capable implementations.

## 3. Steam requirements

The target release brief requires:

- Steam achievements;
- Steam Cloud;
- leaderboards;
- Workshop;
- offline startup;
- controller/Steam Deck;
- clean shutdown and paths.

Valve documents Steamworks as an optional but recommended native API with official C++ support. Steam Workshop requires a game-side upload or authoring path and loading downloaded content from disk. Leaderboards are persistent per-application records and can attach UGC such as replay data. Steam Cloud can operate through Auto-Cloud or API-level file operations.

For RPChess, API-level Cloud access is preferable because the game must show local/cloud metadata and resolve conflicts before replacement. Auto-Cloud alone does not provide the desired in-game conflict UX.

## 4. Candidate comparison

| Criterion | Electron | NW.js | Tauri 2 | Custom CEF/native host |
|---|---|---|---|---|
| HTML/CSS/Canvas compatibility | Excellent; bundled Chromium | Excellent; bundled Chromium | Good but system-webview dependent | Excellent; controlled Chromium |
| Web Audio consistency | High | High | Depends on WebView2/WebKit versions | High |
| Existing web-code migration | Lowest effort | Low effort | Moderate; JS↔Rust bridge | High effort |
| Steamworks integration | Community native Node module or custom addon | Community Node module/Greenworks/steamworks.js | Rust `steamworks` crate/custom plugin | Direct official C++ API |
| Workshop complexity | Medium; binding coverage must be proven | Medium | Medium–high | High engineering, highest control |
| Cloud conflict/file access | Straightforward in main process | Straightforward | Strong through Rust backend | Strong |
| Renderer security | Strong when sandboxed + context isolation + preload | Weaker default model; Node callable from DOM | Strong capability model | Depends on implementation |
| Runtime size | Large; ships Chromium + Node | Large; ships Chromium + Node | Small unless fixed WebView2 bundled | Large |
| Memory | Highest of candidates in simple configuration | Similar/high | Lower shell overhead | Tunable but engineering-heavy |
| Chromium version consistency | High | High | Low/medium across OS | High |
| Windows packaging | Mature ecosystem | Mature enough | Mature | Custom |
| Proton/Steam Deck predictability | Must test; many Electron games work, but no assumption allowed | Must test | Higher uncertainty for Windows WebView2 under Proton | Must test; controllable runtime |
| Update/support burden | Regular Electron/native-module rebuilds | Runtime/native-module matching | Rust/webview/plugin maintenance | Highest |
| Recommended role | First PoC | Not selected | Secondary PoC | Fallback if binding gaps block release |

## 5. Electron design

### Process model

Electron embeds Chromium and Node.js and separates the main process from renderer processes. The renderer should remain sandboxed and isolated. Steamworks, filesystem and operating-system access belong in the main process or a dedicated utility process.

```text
RPChess renderer (HTML5 game)
        ↓ typed contextBridge API
Electron preload
        ↓ validated IPC
Electron main process
        ↓
Platform services / Steamworks / files
```

### Security configuration

Required baseline:

```js
new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: PRELOAD_PATH
  }
});
```

The Steamworks.js README shows a renderer configuration using `nodeIntegration: true` and `contextIsolation: false`, but this must not be copied into RPChess. A public issue in that project explicitly calls out the security risk and proposes using preload/contextBridge. RPChess should load the native Steam module in the main process and expose a small validated API.

### Native binding strategy

Candidate: `steamworks.js`, because it is explicitly designed for NW.js/Electron and uses current prebuilt native binaries. It is community-maintained rather than official Valve middleware, so every required interface must be verified against its declaration files and a Spacewar test application.

If any mandatory feature is incomplete:

1. add a narrow native addon for the missing Steamworks interfaces; or
2. move to the CEF/native fallback rather than weakening game requirements.

### Electron risks

- package and memory size;
- native module must match Electron ABI/platform;
- security mistakes if Node is exposed to renderer;
- Chromium updates can require native-binding rebuilds;
- overlay behavior must be tested in packaged builds, not only dev mode.

## 6. Tauri 2 assessment

Tauri uses a Rust backend and an operating-system webview: WebView2 on Windows and WebKitGTK on Linux. Its shell can be very small, and active Rust Steamworks bindings exist. This is attractive for file integrity, Steam API ownership and memory.

Risks for RPChess:

- browser/rendering behavior depends on system webview version;
- a fixed WebView2 runtime materially increases installer size;
- Windows build under Proton must be tested very early;
- Workshop and overlay need a custom Tauri plugin/bridge;
- team must maintain Rust code and JS/Rust contracts.

Tauri should receive a short secondary PoC only if Electron fails memory/startup targets or Steamworks binding requirements.

## 7. NW.js assessment

NW.js combines Chromium and Node and allows Node modules to be called directly from DOM code. This can make initial integration simple but works against the desired platform boundary and renderer security. Steam binding options exist, but there is no clear production advantage over Electron for RPChess.

NW.js is therefore rejected unless a later benchmark demonstrates a unique overlay or Steam Deck advantage.

## 8. Custom CEF/native host assessment

A custom C++ host using CEF provides:

- fixed Chromium runtime;
- direct official Steamworks SDK integration;
- complete control of file paths, lifecycle and overlay integration;
- no Node dependency.

Costs:

- highest engineering and maintenance burden;
- custom build/update/IPC/security work;
- more difficult debugging and packaging;
- larger schedule risk for a small team.

This is the fallback when Steam feature completeness cannot be reached safely through Electron bindings.

## 9. Proof-of-concept plan

### PoC A — Electron

Build a minimal wrapper around a static RPChess test page.

Tests:

1. initialize Spacewar app ID in development;
2. display Steam user name through preload bridge;
3. unlock/read a test achievement;
4. write/read/delete a Cloud test file;
5. create/find/upload/download a leaderboard score;
6. create/update/query a Workshop test item;
7. open overlay and Workshop page;
8. detect Steam Deck if available;
9. save files to correct user-data location;
10. launch with Steam absent and use null adapter;
11. package Windows x64;
12. run package through Steam and Proton;
13. record idle/battle memory and startup time.

### PoC B — Tauri only if needed

Repeat the same contract tests with a Rust Steamworks plugin and Windows package under Proton.

### Decision gate

Electron becomes final only if every mandatory feature passes or has a bounded, maintainable implementation plan. Package size alone is not a rejection criterion; reliability and Steam feature coverage are more important.

## 10. Recommended implementation boundary

```text
src/platform/capabilities.ts
src/platform/browserAdapter.ts
apps/desktop/electron/main.ts
apps/desktop/electron/preload.ts
apps/desktop/electron/services/files.ts
apps/desktop/electron/services/steam.ts
apps/desktop/electron/services/cloud.ts
apps/desktop/electron/services/workshop.ts
apps/desktop/electron/services/leaderboards.ts
```

The renderer API should expose domain operations such as `saveProfile`, `unlockAchievement`, and `publishChallenge`, not arbitrary filesystem paths or generic IPC execution.

## 11. Final recommendation

Proceed with **Electron as the first desktop wrapper PoC**, using strict isolation and main-process Steamworks integration. Keep **Tauri 2 as a measured secondary option** and **custom CEF/native host as the feature-completeness fallback**. Do not commit the project permanently to any wrapper until the Steam feature matrix and Steam Deck/Proton PoC pass.

## 12. References reviewed

- Electron official introduction, process model and sandbox documentation.
- Tauri 2 official architecture, Windows installer and WebView2 distribution documentation.
- NW.js official documentation.
- Valve Steamworks API, Cloud, Workshop and Leaderboards documentation.
- `ceifa/steamworks.js` repository and security discussion.
- `steamworks` Rust crate documentation.
