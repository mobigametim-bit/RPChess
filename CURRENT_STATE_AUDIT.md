# CURRENT_STATE_AUDIT.md

**Project:** RPChess  
**Audit phase:** Phase 0 — current-state audit  
**Document status:** v0.1, initial technical inventory; implementation changes are intentionally paused  
**Audited baseline:** packaged web build 1.3.3 plus the deployment patch chain currently applied from GitHub through 1.3.9

## 1. Executive summary

RPChess is currently a compact, playable browser roguelite prototype with a functional campaign loop, deterministic seeded node generation, simplified chess-like movement, combat abilities, rewards, events, shops, persistence, two-language UI, Canvas rendering, music, SFX, and a working Cloudflare deployment pipeline.

It is **not yet a release-grade chess roguelite** under the target design. The largest gap is not presentation but the game rules and production architecture: the current combat engine uses chess-shaped movement on a 6×6 tactical board, but it does not implement legal chess positions, check, checkmate, stalemate, castling, en passant, full pawn rules, or self-check prevention. The current campaign and content volumes are small, and the source of truth is still a packaged ZIP transformed by deployment-time patch scripts rather than a normal source tree.

The existing prototype should be preserved as a behavioral reference and vertical prototype. It should not be discarded, but several core modules must be isolated and replaced behind tests before full production.

## 2. Verification and launch status

### Completed verification

- Extracted and inspected the full 1.3.3 package.
- Verified the standalone HTML entry points and source modules.
- Executed all seven packaged Node test suites successfully:
  - smoke tests;
  - UI contract tests;
  - UI render tests;
  - fantasy asset audit;
  - fantasy scene render tests;
  - music tests;
  - Cyrillic font tests.
- Confirmed that the Cloudflare repository build uses `scripts/build.cjs`, extracts the packaged build into `dist`, applies a chain of UI/audio hotfixes, and publishes `dist` through Wrangler.
- Confirmed that the current repository is writable and a dedicated audit branch has been created.

### Pending launch verification

A local visual Chromium launch was attempted in the audit container, but Chromium did not exit because the container lacks a working system D-Bus environment. This is an environment limitation, not evidence of an RPChess failure. Visual browser verification therefore remains **pending in this audit environment**. The existing Cloudflare build and the user's browser screenshots demonstrate that the game does launch outside the container.

## 3. Current project map

### Repository-level deployment structure

- `RPChess_Standalone_1.3.3_Web_Deploy.zip` — packaged source currently treated as the deployment payload.
- `scripts/build.cjs` — extracts the ZIP, downloads the supplied victory fanfare, applies patch scripts, validates `index.html`, prepares `dist`.
- `scripts/scene-layout-patch.cjs` — deployment-time scene layout transformation.
- `scripts/ui-polish-patch.cjs` — deployment-time UI/relic transformation.
- `scripts/ui-hotfix-1.3.6.cjs` — reward-card and typography correction.
- `scripts/ui-hotfix-1.3.8.cjs` — choice typography and procedural victory sound patch.
- `scripts/ui-hotfix-1.3.9.cjs` — supplied MP3 fanfare integration.
- `package.json` — `adm-zip` and `wrangler`; build and deploy scripts.
- `wrangler.toml` — static asset deployment from `dist` with SPA fallback.

### Packaged application structure

- `index.html` — primary browser entry point.
- `RPChess.html` — portable/offline bundled entry point in the full package.
- `style.css` — all UI styling, layout, responsiveness, animation, fantasy skins.
- `js/main.js` — application bootstrap and legacy aliases.
- `js/data.js` — compact content registry.
- `js/core.js` — game state, campaign, battle simulation, AI, save logic, rewards, events, shops and progression.
- `js/ui.js` — DOM screens, Canvas board rendering, input binding, animation, audio and music managers.
- `js/display_font.js` — legacy/display-font compatibility layer.
- `generated_assets/` — UI, scene, node, reward, commander and piece artwork.
- `music/` — four MP3 tracks.
- `SFX/win_fanfare.mp3` — added at deployment time.
- `tests/` — seven lightweight Node-based suites in the full offline package.

### Current scale

The full package contains approximately:

- 256 files;
- 211 generated assets;
- 4 music tracks;
- 7 test files;
- 5 JavaScript runtime modules;
- about 2,100 lines across runtime JavaScript, CSS and HTML;
- `core.js`: ~698 lines;
- `ui.js`: ~391 lines;
- `data.js`: ~123 lines;
- `style.css`: ~821 lines before deployment hotfix appendices.

## 4. Runtime architecture and state flow

### Entry and composition

`main.js` loads the stored profile, constructs `Game`, creates `UI`, exposes legacy aliases, and renders the initial screen.

### State ownership

`Game` owns:

- profile;
- active run;
- active battle;
- listeners;
- save operations;
- campaign generation;
- battle rules;
- AI;
- progression and rewards.

`UI` reads and mutates `Game` directly through public methods. It also owns:

- current view;
- selection state;
- screen rendering;
- Canvas rendering;
- transient VFX;
- audio and music managers;
- DOM event binding.

### Persistence

- Profile is serialized to `localStorage`.
- One primary save key and one legacy key are supported.
- Migration currently uses shallow object merging into a default profile.
- Save is synchronous and non-atomic.
- A parse failure resets to defaults.
- Export/import exists as JSON text.
- There is no independent backup slot, checksum, transactional write, file-based profile layer, or Steam Cloud adapter.

### Content loading

Most gameplay content is held in `data.js` as JavaScript objects. There are no formal schemas, reference validation, content pack versioning, localization keys, or separate authoring files.

## 5. Implemented-system inventory

Legend:

- **Works** — behaves consistently for the current prototype scope.
- **Partial** — usable, but below target design.
- **Placeholder** — demonstrates a concept but is not production-ready.
- **Refactor required** — implementation is valuable but unsafe to scale as-is.
- **Missing** — no meaningful implementation.

| System | Status | Audit finding |
|---|---|---|
| Offline HTML5 launch | Works | Static HTML/CSS/JS package runs without backend. |
| Cloudflare web deployment | Works, fragile | Automated, but based on extracting a binary ZIP and mutating it with patch scripts. |
| Deterministic RNG | Partial | Seeded xorshift RNG exists; not every generated identifier/action is deterministic because UID generation uses time and `Math.random`. |
| Campaign loop | Works for prototype | Three acts, five route steps plus boss; node choices and progression are functional. |
| Campaign map | Partial | Choice cards rather than a full graph/map; limited route topology and no robust path validation. |
| Events | Placeholder | Four events total, one secret. Authoring format is embedded JS. |
| Rewards | Works for prototype | Choose one of three; limited types and no assignment workflow required by final relic design. |
| Shops | Partial | Artifact/heal/recruit stock; no shop categories, reroll economy, regional state or stock persistence model. |
| Economy | Partial | Gold and meta fragments; no strategic supplies layer. |
| Roster | Partial | Persistent within a run; hard count cap; no command-cost budget, reserve workflow or comparison/replacement screen. |
| Wounds | Placeholder | Boolean wounded state only. No severity, timers, scars or critical outcomes. |
| Commanders | Partial | Six commander-like archetypes exist. Target design requires independent kings and doctrines. |
| Doctrines | Missing | Current commanders mix leader, doctrine and ability roles. |
| Kings | Missing as designed | A generic board king exists; no seven selectable king archetypes. |
| Named heroes | Missing | No portrait-backed persistent hero system. |
| Relics | Partial, incompatible with target | Twelve global run artifacts. Target requires relics assigned to individual pieces with immediate equip/replace/refuse flow. |
| Talents | Placeholder | One upgrade string per recruit from a small hard-coded pool. |
| Chess movement geometry | Partial | Pawn, knight, bishop, rook, queen and king movement patterns exist. |
| Full chess legality | Missing | No attack map, check, self-check prevention, checkmate, stalemate, castling, en passant or complete pawn opening logic. |
| Board size | Prototype-specific | Main board is 6×6, not target 8×8. |
| Captures | Partial | Immediate removal exists, but shields/guards can cancel a capture and invisible units can be untargetable; this conflicts with the target chess core. |
| HP/damage | Correctly absent | Normal units do not use HP or numeric damage. |
| Boss phases | Placeholder | One Dark King with phase counter, wards and telegraphed lines. |
| Alternative objectives | Partial | Eliminate, extract and survive exist; completion validation is limited. |
| Pre-battle placement | Missing | Positions are generated/fixed directly at battle start. |
| Order points | Partial | Combat points exist and fuel abilities; economy and rules need redesign. |
| Reserve | Missing | No reserve deployment workflow. |
| AI | Placeholder | Greedy one-ply move scoring; executes all enemy pieces sequentially per enemy phase. |
| Turn structure | Conflicts with target | Player can act with multiple pieces before manually ending the turn; enemy then moves all active pieces. Target requires one player action, one enemy action. |
| Procedural validation | Missing | No solvability/legality validator or batch seed report. |
| Save during battle | Partial | Battle state is embedded in the run save; no atomic or recovery guarantees. |
| Profiles | Missing | Only one profile. |
| Localization | Partial | Russian/English strings are embedded in code/data; no key-based localization system or plural rules. |
| Accessibility | Partial | UI scale, reduced motion and a colorblind flag exist; no text scale, remapping, controller focus system or contrast/VFX controls. |
| Controller/Steam Deck | Missing | Mouse-oriented DOM/Canvas controls only. |
| Audio | Partial | Master and music volume; procedural SFX plus music playlist and supplied fanfare. No separate UI/environment/effects buses. |
| Replay | Missing | Short rewind snapshot history is not a deterministic replay system. |
| Editor | Missing | No authoring UI or scenario schema. |
| Workshop | Missing | No Steam Workshop adapter or package validator. |
| Steam integration | Missing | No Steamworks adapter, Cloud, achievements, leaderboards or Workshop runtime. |
| Desktop wrapper | Missing | No selected or validated wrapper. |
| Achievements | Prototype only | Twenty local achievements; no Steam mapping or release-grade tracking architecture. |
| Infinite mode | Missing | No cycle-based endless campaign. |
| Weekly act | Missing | No fixed-version shared seed pipeline or leaderboards. |
| Tutorials | Missing | No interactive tutorial chapters. |
| Factions/regions/story | Missing at target scale | No six region/faction campaign implementation. |

## 6. Critical technical problems

### P0-A — The repository does not contain a normal source tree

The deployed game is reconstructed from an old ZIP and then modified with sequential text-replacement scripts. This creates several risks:

- the deployed result is not directly reviewable in GitHub;
- patches depend on exact string matches;
- older changes can silently stop applying;
- testing the true final `dist` is difficult;
- binary assets and source history are mixed into a release archive;
- contributors cannot work on normal source files;
- release builds are not reproducible without Google Drive availability for the fanfare download.

**Required action:** materialize the latest transformed `dist` into a real source directory, keep assets in the repository or release storage, and make the build copy/validate source instead of mutating an archive.

### P0-B — Current rules are not legal chess

The project uses chess movement shapes, but legality is based only on geometric destination generation. The engine does not know whether a king is attacked or whether a move leaves the player's king in check. Current victory is king removal or enemy elimination, not checkmate.

**Required action:** build an isolated, deterministic chess-rules module with full attack maps and legal move filtering, lock behavior with tests, and then integrate scenario exceptions through explicit rule modules.

### P0-C — `core.js` mixes nearly every gameplay responsibility

Campaign generation, AI, battle simulation, progression, events, rewards, storage interaction and achievements live in one class. Expanding content at release scale would create high regression risk.

### P0-D — Save safety is insufficient

`localStorage.setItem` is a single synchronous write with no staging key, checksum, backup, migration registry or damaged-save recovery. The target release requires multiple profiles, desktop files and Steam Cloud conflict handling.

### P0-E — Content is too small and embedded

The current baseline has:

- 4 events;
- 12 artifacts;
- 6 combined commander archetypes;
- no doctrines;
- no target king roster;
- no named heroes;
- one primary boss concept;
- no faction/region content framework.

### P0-F — UI and runtime are tightly coupled

The UI directly renders string templates and binds events after every full-screen rerender. Canvas rendering, audio, view routing and game interaction coexist in a single UI class. This is manageable for the prototype but not for controller support, accessibility, editor screens, replays or Steam Deck navigation.

## 7. Technical debt classification

### Category 1 — Keep with minor changes

- Xorshift-style seeded RNG concept.
- Static/offline HTML5 delivery.
- Canvas 2D rendering approach.
- Basic asset path conventions.
- Music playlist concept.
- Existing art assets as prototype/foundation assets.
- Lightweight event/listener concept.
- Immediate deterministic chess-style captures as a design principle.

### Category 2 — Keep after local refactor

- Campaign run state shape.
- Reward and shop screen flows.
- Commander selection UI as a future king/doctrine selection foundation.
- Canvas piece drawing and board coordinate handling.
- Existing export/import UI.
- Current achievements as prototype telemetry examples.
- Scene/header presentation components.

### Category 3 — Dangerous to expand without serious restructuring

- `Game` class.
- `UI` class.
- embedded localization strings;
- embedded content registry;
- `localStorage` persistence;
- deployment-time patch chain;
- greedy AI inside the game state class;
- battle snapshot rewind implementation.

### Category 4 — Replace as isolated modules

- chess legality and game-ending rules;
- save/profile/file/Cloud abstraction;
- deterministic replay command log;
- scenario schema and validator;
- procedural campaign graph generator and batch validator;
- AI search/evaluation layer;
- controller/focus/input abstraction;
- Steam platform adapter;
- localization service and catalogs.

## 8. Preliminary target architecture

The following is provisional until the audit is complete:

```text
src/
  app/
  core/
    chess/
    rules/
    state/
    commands/
  combat/
  ai/
  campaign/
  procedural/
  content/
    schemas/
    catalogs/
    localization/
  army/
  heroes/
  relics/
  doctrines/
  kings/
  factions/
  kingdom/
  save/
  replay/
  audio/
  rendering/
  ui/
  input/
  accessibility/
  editor/
  platform/
    browser/
    desktop/
    steam/
  tests/
  tools/
assets/
public/
```

The first migration principle is: **extract behavior behind stable interfaces before changing behavior**.

## 9. Audit plan

### Audit pass A — repository and build reproducibility

- Reconstruct final deployed output from the patch chain.
- Compare packaged source against transformed deployed source.
- Replace build-time Drive dependency with a tracked/release asset strategy.
- Produce a file manifest and source-of-truth decision.

### Audit pass B — chess and combat behavior

- Enumerate every move rule and exception.
- Build position fixtures for all current piece types.
- Document target-vs-current conflicts.
- Define the compatibility boundary for old save data.

### Audit pass C — campaign, content and economy

- Trace all run state transitions.
- Enumerate node generation probabilities.
- Enumerate content pools and unlock gates.
- Measure content repetition and run length.

### Audit pass D — UI, input, accessibility and performance

- Inventory every screen and control.
- Check 16:9, 16:10, 1280×800 and localization overflow.
- Inspect listener lifetime and rerender behavior.
- Profile Canvas allocation and long-session state growth.

### Audit pass E — persistence and platform

- Test corrupted JSON, interrupted writes and legacy migration.
- Define three-profile storage format.
- Identify desktop and Steam adapter requirements.

### Audit pass F — content and asset production register

- Match every target system/screen/content family to existing assets.
- Produce file-by-file P0/P1/P2 register.
- Add generation prompts, technical specs and acceptance criteria.

## 10. Documents to be produced

1. `CURRENT_STATE_AUDIT.md` — this document, to be expanded to final audit status.
2. `TARGET_ARCHITECTURE.md`.
3. `CONTENT_AND_ASSET_PRODUCTION_REGISTER.md`.
4. `CONTENT_GAP_SUMMARY.md`.
5. `DESKTOP_WRAPPER_DECISION.md`.
6. `IMPLEMENTATION_ROADMAP.md`.
7. `RELEASE_ACCEPTANCE_CHECKLIST.md`.
8. `TEST_STRATEGY.md`.
9. `DATA_FORMATS_AND_SCHEMAS.md`.

## 11. Immediate next actions

1. Stop feature implementation except diagnostics and audit tooling.
2. Materialize the true current deployed source as an auditable source tree.
3. Add an automated build verification that fails when any deployment patch does not apply.
4. Produce the complete chess-rules gap matrix.
5. Produce the first full content/asset inventory.
6. Finish `CURRENT_STATE_AUDIT.md` and only then begin `CONTENT_AND_ASSET_PRODUCTION_REGISTER.md`.

## 12. Current risks

- The prototype's current combat behavior conflicts with the target design in several foundational areas.
- A direct rewrite would risk losing working campaign/UI behavior; an adapter-and-tests migration is safer.
- The requested release scope is large: campaign, meta-progression, editor, Workshop, weekly mode, replay, Steam Cloud and Steam Deck are each substantial systems.
- Current official content is far below the requested minimum, so content production must run in parallel with engine work after the register is approved.
- The current build is not self-contained because the fanfare is downloaded during deployment from Google Drive.
- Steam Deck and controller requirements may strongly influence desktop wrapper selection and UI architecture.

---

**Audit conclusion at v0.1:** preserve the prototype as a working reference, but do not scale the current monolithic game/runtime directly. The first production milestone must be a reproducible source tree plus a fully tested legal-chess core integrated behind the existing UI loop.
