# RPChess — Full Project Review Report

**Audit status:** REMEDIATION IN PROGRESS  
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit/remediation branch:** `audit/full-project-review-2026-09-08`  
**Current remediation code head:** `d13841104cd3467cd3413182f3d49c3b0c8eba86`  
**Started:** 2026-09-08

This document is the source of truth for remediation. `main` remains untouched. Cloudflare remains manual-only. Do not restore compatibility patch layers, post-render DOM rewrites, runtime DOM reparenting, whole-document UI workarounds or broad state-mutating event consumers to conceal ownership problems.

## Mandatory UI contract

For every active player-facing screen and supported adaptation:

1. whole screen/frame composition fits one viewport;
2. no child escapes its owning frame;
3. unavoidable overflow is deliberate and contained inside the owner;
4. page scrolling is not a gameplay-layout substitute;
5. RU/EN satisfy the same geometry contract;
6. breakpoint transitions are tested, not only nominal viewport sizes.

Canonical targets: `1920×1080`, `1366×768`, `1280×720`, `1024×768`, `844×390`, boundaries around `1180/980`, and portrait rotate-device behavior.

---

# Remediation tracker

Status meanings: **DONE — verified**, **DONE — verification pending**, **IN PROGRESS**, **OPEN**, **DECISION CLOSED**.

| Finding | Status | Current state |
|---|---|---|
| REV-001 Hero Notes owns unrelated patch chain | **DONE — verified** | Hero Notes rendered by true owners; compatibility runtime deleted. |
| REV-002 Market reads state back from DOM | **DONE — verified** | Settlement renders Market from canonical state. |
| REV-003 Resources render fan-out | **DONE — verified** | Global Resources observer/click fan-out removed; coalesced owner scheduler remains. |
| REV-004 whole-document legacy localization | **DONE — verification pending** | All identified active dynamic surfaces localize at owner render time. Global localization `MutationObserver`, TreeWalker scan, DOM source WeakMaps and `localizeLegacyDocument` deleted in `fc74ac8b`. Explicit `translateLegacy(...)` remains only for authored/content values. |
| REV-005 obsolete source controls / hidden DOM | **DONE — verification pending** | Obsolete Skirmish/Battle/Puzzle/Event shortcuts and hidden controls deleted at source; generic cleanup removed. |
| REV-006 runtime DOM reparenting | **DONE — verification pending** | Battle Start, Classic Journal and Skirmish actionbar have stable owner/source slots. |
| REV-007 canonical Pages gate covers smoke subset | **OPEN** | Pages is safe (`main` push only). Full 17-contract milestone/release gate remains manual because connector exposes no `workflow_dispatch`. |
| REV-008 stale page-scroll contract | **DONE — verified** | Geometry tests enforce one-screen behavior instead of scrolling. |
| REV-009 Supplies/Market image retargeting | **DONE — verified** | True owners render resource imagery; global scanner deleted. |
| REV-010 fragmented runtime hotfix CSS | **DONE — verification pending** | Review/polish chain, presentation bootstrap and route CSS-in-JS deleted; compact/aftermath rules are owner stylesheets. |
| REV-011 Supplies optimizer increases asset | **DONE — verified** | Optimizer keeps smaller source bytes. |
| REV-012 stale CURRENT_STATE SHA | **OPEN** | Deferred to final accepted remediation SHA. |
| REV-013 browser helper lifecycle drift | **DONE — verified** | Shared helper waits for visible scenes; older full milestone passed 17/17. |
| REV-014 responsive gate incomplete | **DONE — verification pending** | Reusable geometry assertions + RU/EN/boundary matrices cover Battle aftermath, Starvation, Puzzle/Training, Classic setup and Endless summary (`e37f3771`). Current full Chromium execution pending. |
| REV-015 persistence migration policy | **DONE — verified** | Unsupported schema resets safely; no old-save preservation required. |
| REV-016 repeated puzzle materialization/build inputs | **DONE — verified** | Puzzle materialization deduplicated; duplicate build inputs removed. |
| REV-017 generic Wrangler deploy path | **DONE — docs pending** | Generic deploy removed; Cloudflare explicit/manual; GitHub Pages canonical. |
| REV-018 legacy Vertical Slice | **DONE — verification pending** | Standalone browser stack and unreachable `src/` domain/runtime/tests deleted after reachability proof; verifier blocks return. |
| REV-019 stylesheet ownership/load split | **DONE — verification pending** | Compact/aftermath styles are explicit owner inputs; Battle owns its compact CSS. |
| REV-020 broad `rpchess:run-updated` bus | **DONE — verification pending** | Semantic lifecycle bridge owns combat/Puzzle completion. Power, redesign, shared UX, cross-scene, Events and Travel no longer consume broad `run-updated` for state mutation or completion. Resources retains one documented broad listener solely as coalesced side-effect-free HUD projection; Roster retains a side-effect-free owner projection. Reentrancy-safe 12-transition Node contract and 12-loop Chromium listener/render/node stability contract are committed but current browser execution is pending. |
| REV-021 historical docs conflict with current rules | **OPEN** | Final documentation synchronization remains after code/gate completion. |

---

# Major remediation completed

## Architecture / presentation ownership

- Hero Notes, Market and Resources moved to true owners.
- Roster/Travel/Battle/Puzzle/Settlement/Starvation/Skirmish/Endless compact presentation moved to owner CSS/DOM.
- Battle Start CTA is source-owned; legacy actionbar/counters/action-cost removed.
- Classic Journal and Skirmish actionbar stay in stable source slots; runtime reparenting removed.
- `post-pages-ui-polish.mjs`, `presentation-bootstrap.mjs`, review2–review7, polish constraints and other compatibility modules deleted.
- Skirmish/Battle aftermath rules live in owner compact CSS.
- `battle-route.mjs` is imports-only and loads semantic lifecycle first.
- Battle Mercenary debt resolves inside Battle completion before aftermath render; Mercenaries no longer patches aftermath or listens to broad run updates.

## Localization ownership

Completed owner migrations:

- Roster `7432aa43`, regression `6ea67719`.
- Travel `7216b01c`.
- Starvation `ef0fb91e`, regression `d7ab7123`.
- Puzzle registry `6eba6011`, owner `187ce871`, semantic kicker `337fa7d5`, regression `c6a59c75`, verifier `b3ae7599`.
- Events registry `d2b7bac3`, owner `1234cd07`, regression `7c95fd05`.
- Skirmish registry `d69ca389`, owner `75d6a70f`, regression `dedb1a72`.
- Battle registry `9222fceb`, owner `bd7ce73f`, Mercenary cleanup `9bea349d`.
- Classic registry `f37994ac`, owner `5ac0afb5`, fix `00a48e09`, regression `d885e2e5`.
- Shared runtime registry `5568ce5d`; Endless `b916736c`; Power `ce766967`; shared UX `2e0699af`; formation titles `ffdf174a`.
- Whole-document localization removed `fc74ac8b`.
- Permanent i18n ownership gate `c88fa577`, wired in `6b88b94d`.
- Stale Endless regression synchronized `30755415`.

`translateLegacy(...)` is intentionally retained as an explicit render-time helper for authored Event prose, character names/descriptions and domain labels; it is not a document scanner.

## Semantic lifecycle ownership

- Semantic bridge `run-lifecycle-events.mjs` introduced `6aaa8422`; loaded first in route `2e1968e5`.
- It derives `rpchess:combat-completed` from Battle/Skirmish counter transitions and `rpchess:puzzle-resolved` from a new Puzzle resolution.
- Power moved off broad `run-updated` in `15ac7458`.
- Final redesign moved off broad `run-updated` in `ee05e0ad`.
- Cross-scene visuals moved off broad `run-updated` in `328ee91d`.
- Shared UX moved off broad `run-updated` in `7dbdc171`.
- Existing UI contract synchronized `aa801cab`; bridge packaged `a8af96fa`; verifier synchronized `dada4d10`.
- Reentrancy bug found during review and fixed `27b1c892`: bridge commits its snapshot before notifying semantic consumers.
- Permanent lifecycle regression `c86d763e`, wired `b29b763e`, executes 12 alternating Battle/Skirmish transitions, nested derived `run-updated`, and ten no-state-change notifications.
- Events moved to semantic combat completion `1158b857`; regression `3e354cfb`.
- Resources split `b3ef74a5`: semantic combat/recovery owns reward settlement; broad `run-updated` is render-only. Regression `54c8ddc9`.
- Travel cleanup `f4f706ad`: duplicate Power settlement removed; completed combat route cleanup now uses `rpchess:combat-completed`.
- Lifecycle regression strengthened `9f08c276`.
- Existing `travel-choice-browser.cjs` extended `a447df1d` with 12 Roster↔Travel loops and listener/render/node stability probes.

## Dependency / tooling security

- Reachability review proved `adm-zip` was a dead direct dev dependency; Stockfish downloads integrity-pinned JS/WASM directly.
- `adm-zip` removed from `package.json` in `f04df06a`; old lock metadata remains pending reproducible regeneration.
- Permanent dependency-security contract `d83c27c9`, wired `c88dfac6`.
- Contract records current tooling floors: direct esbuild `0.25.8` outside reviewed `>=0.27.3 <0.28.1` range; Wrangler nested esbuild `0.28.1`; `undici 7.28.0`; `ws 8.21.0`; `path-to-regexp 6.3.0`.

## Asset reachability cleanup

- `scripts/asset-orphan-inventory.cjs` added in `a497089f`; `npm run assets:orphans:report` exposed in `d7176767`. It classifies production media as explicit reference, known dynamic family, or candidate. It intentionally protects dynamic race-piece, race-board, Event-background and generated core-piece families from literal-only false positives. The inventory command is not yet in `gate:local` because its first full execution on an exact audit checkout is still pending.
- Music is explicitly owned by `reboot-audio.mjs`: exactly four `echoes_iron_throne_0N.mp3` tracks. SFX currently contains only `win_fanfare.mp3`, explicitly owned by cross-scene victory presentation.
- Six `generated_assets/commander_*.png` files were proven unreachable after Vertical Slice/approved-shell removal. Historical owners were `approved-shell-data.mjs`, `commander-selection-final.mjs` and Vertical Slice presentation; those runtime owners are absent on the audit branch. Removed in `905c9daa` → `7c3ca286`. Bytes removed: **857,650**.
- `ui_panel_frame.png` and `ui_panel_wide.png` were proven obsolete by the current frameless production invariant: active owner CSS is verifier-guarded against both files, and legacy `game/style.css` was deleted with Vertical Slice. Removed in `e1de42f1` + `dfd6651f`. Bytes removed: **91,263**.
- Five legacy map-node assets (`node_bargain`, `node_boss`, `node_event`, `node_repair`, `node_vault`) were proven unreachable. The legacy `approved-shell-data.mjs`/Vertical Slice route map owned boss/event/repair/vault; `node_bargain` had no production owner even on the frozen baseline. Current Travel keeps the five Reboot route icons `node_battle`, `node_elite`, `node_shop`, `node_story`, `node_training`. Removed in `1fecc0cc` → `9c9f0a66`. Bytes removed: **194,295**.
- Six legacy reward assets (`reward_artifact`, `reward_experience`, `reward_heal`, `reward_meta`, `reward_recruit`, `reward_upgrade`) were proven unreachable. `reward_heal`/`reward_meta` were old Vertical Slice/Army Foundation resource substitutes; `reward_recruit` was owned only by deleted review2 compatibility presentation; artifact/experience/upgrade had no production owner. Current Reboot keeps `reward_gold.png` and `reward_supplies.png`. Removed in `9861f533` → `a3adc5c1`. Bytes removed: **191,338**.
- Eight legacy scene backgrounds (`scene_achievements`, `scene_bargain`, `scene_codex`, `scene_event`, `scene_repair`, `scene_settings`, `scene_training`, `scene_vault`) were proven owned only by deleted approved-shell/Vertical Slice presentation or removed legacy Event fallback. Current Reboot-owned `scene_training_ui`, `scene_victory`, Campaign/Battle/Shop/Reward/Defeat backgrounds are preserved. Removed in `879a0f27` → `d1384110`. Bytes removed: **1,123,762**.
- Proven asset reduction: **2,458,308 bytes (~2.34 MiB)** across 27 files. No active race/piece/board/Event-background dynamic family was deleted.

## Responsive truth

- Geometry helper rejects page overflow, nonzero window scroll and frame/viewport escapes.
- Portrait stale setup fixed `71c3f39b`; real 3px portrait overflow fixed `480ec6f3`; Language selector fixed `24e7414d`.
- Responsive suite explicitly covers weak surfaces in `e37f3771`.

## Legacy / build / deployment

- Vertical Slice Stage 1 `d46ca26e`; Stage 2 `5351eb77`.
- Production build explicitly packages owner localization and semantic lifecycle bridge.
- Unsupported save schema resets safely.
- GitHub Pages audit auto-deploy is disabled; `main` remains canonical.
- Cloudflare has not been deployed during remediation.

---

# Verification history

- Full Review #8 (`34262502407`, `d5820573`): `gate:local` PASS, **17/17 Chromium PASS**.
- Full Review #9 (`34265688360`, `b63726eb`): `gate:local` PASS, **17/17 Chromium PASS**.
- Owner migration #10 (`34266676368`, `8e7c4675`): local PASS; Classic/Settlement/Puzzles 3/3 PASS.
- Save schema #11 (`34267715267`, `2ced5f67`): local/persistence PASS.
- Pages #91 (`34330513111`, `0c4156bc`), #92 (`34341624633`, `71c3f39b`), #93 (`34342233234`, `480ec6f3`): current-at-the-time local/build PASS; browser runs exposed issues subsequently fixed.
- Pages audit auto-trigger removed `496bfac9`.
- One-off full-review trigger `0931aebb` produced no check run through connector; restored manual-only `51464246`.
- Localization completion (`f37994ac` → `30755415`): implementation/static contracts complete; no fresh full gate claimed.
- Semantic lifecycle (`6aaa8422` → `9f08c276`) + browser instrumentation `a447df1d`: implementation/contracts complete; **no fresh execution PASS is claimed** for current head.
- Dependency security (`f04df06a` → `c88dfac6`): direct vulnerable ZIP install edge removed; contract not yet executed in current CI; lock metadata normalization pending.
- Asset inventory tooling (`a497089f`, `d7176767`) passed standalone Node syntax validation during remediation, but no exact-checkout full inventory execution or current build/Chromium PASS is claimed yet. All 27 deletions through `d1384110` were based on explicit owner/non-reachability evidence, not on an unreviewed automated candidate list.
- No full 17-contract Chromium PASS is claimed for current head.

---

# Open verification / cleanup items

1. Inspect the remaining `generated_assets` UI/logo/special-unit families and delete only additional positive non-reachability candidates.
2. Execute `npm run assets:orphans:report` on an exact audit checkout and reconcile candidates with manual owner proof.
3. Normalize `package-lock.json` reproducibly so stale `adm-zip` metadata disappears without hand-editing integrity data.
4. Execute targeted lifecycle/Travel/security/assets contracts, then full current `gate:local` + all 17 Chromium contracts.
5. Final `CURRENT_STATE.md`, deployment/history docs and Notion synchronization after accepted final SHA.

---

# Autonomous remediation plan

## Phase A — localization
1. **DONE:** all active owner localization migrations.
2. **DONE:** whole-document localization observer/scan deletion.
3. **DONE:** permanent i18n ownership gate and stale regression synchronization.

## Phase B — lifecycle/performance
4. **DONE:** semantic completion bridge and first-import ownership.
5. **DONE:** broad state-mutating consumer removal/split.
6. **DONE:** bridge reentrancy fix + permanent 12-transition regression.
7. **DONE — verification pending:** 12-loop Chromium listener/render/node stability proof committed.

## Phase C — validation/tooling
8. **DONE — verification pending:** dead direct `adm-zip` dependency removed and dependency-security contract added.
9. **IN PROGRESS:** asset reachability inventory. Reproducible tooling exists; 27 positively unreachable files removed (**2.34 MiB**).
10. Normalize lock metadata reproducibly; do not hand-edit integrity graph.
11. Run targeted regressions and then `gate:local` + all 17 Chromium contracts when executable.

## Phase D — final integration/docs
12. Fix only evidence-backed regressions from final gate.
13. Update `docs/CURRENT_STATE.md` to final accepted SHA.
14. Mark historical docs clearly and synchronize architecture/UI/persistence/deployment into Notion.
15. Do not merge `main` or deploy Cloudflare without explicit owner instruction.

## Next actions

1. Finish reachability proof for remaining `generated_assets`: logo/wordmark, secondary/danger buttons, checkbox/chip/divider/sliders and special-unit images; preserve anything with explicit/current owner evidence.
2. Run `npm run assets:orphans:report` on the first executable exact audit checkout and reconcile every candidate with manual proof before any further bulk deletion.
3. Normalize `package-lock.json` at the first reproducible lockfile-generation opportunity; do not manually alter integrity records.
4. Run targeted lifecycle/Travel/security/assets checks and then full `gate:local` + all 17 Chromium contracts; update verification-pending findings only from actual results.
5. Finish `CURRENT_STATE.md`, deployment/history docs/Notion synchronization and final release-readiness report.
6. Keep `main` frozen and Cloudflare manual-only until explicit owner direction.

Every subsequent remediation checkpoint must update this report and end with a concrete numbered **Next actions** list.
