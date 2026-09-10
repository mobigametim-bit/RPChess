# RPChess — Full Project Review Report

**Audit status:** REMEDIATION COMPLETE — MERGE/DEPLOY NOT AUTHORIZED
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit/remediation branch:** `audit/full-project-review-2026-09-08`  
**Current remediation code head:** `2906aebf5c95f20620bc9691279f95fd65fe8544`
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
| REV-004 whole-document legacy localization | **DONE — verified** | All identified active dynamic surfaces localize at owner render time. Global localization `MutationObserver`, TreeWalker scan, DOM source WeakMaps and `localizeLegacyDocument` deleted in `fc74ac8b`. Explicit `translateLegacy(...)` remains only for authored/content values. |
| REV-005 obsolete source controls / hidden DOM | **DONE — verified** | Obsolete Skirmish/Battle/Puzzle/Event shortcuts and hidden controls deleted at source; generic cleanup removed. |
| REV-006 runtime DOM reparenting | **DONE — verified** | Battle Start, Classic Journal and Skirmish actionbar have stable owner/source slots. |
| REV-007 canonical Pages gate covers smoke subset | **DONE — verified** | The Pages/PR workflow intentionally keeps the fast smoke subset. Permanent `.github/workflows/full-project-review.yml` is `workflow_dispatch`-only and runs `gate:local` plus all 17 Chromium contracts for milestone/release validation, matching the accepted minimal-testing policy. |
| REV-008 stale page-scroll contract | **DONE — verified** | Geometry tests enforce one-screen behavior instead of scrolling. |
| REV-009 Supplies/Market image retargeting | **DONE — verified** | True owners render resource imagery; global scanner deleted. |
| REV-010 fragmented runtime hotfix CSS | **DONE — verified** | Review/polish chain, presentation bootstrap and route CSS-in-JS deleted; compact/aftermath rules are owner stylesheets. |
| REV-011 Supplies optimizer increases asset | **DONE — verified** | Optimizer keeps smaller source bytes. |
| REV-012 stale CURRENT_STATE SHA | **DONE — verified** | `CURRENT_STATE.md` records frozen production `main`, final remediation code SHA and the non-deployed audit boundary. |
| REV-013 browser helper lifecycle drift | **DONE — verified** | Shared helper waits for visible scenes; older full milestone passed 17/17. A separate Stockfish game-lifecycle race exposed by the strengthened responsive run is being remediated at the AI adapter owner rather than hidden in the helper. |
| REV-014 responsive gate incomplete | **DONE — verified** | Reusable geometry assertions + RU/EN/boundary matrices cover all targeted screens at canonical viewports and 1180/980 boundaries. Exact run `34451963848` passed the standalone responsive matrix and all 17 Chromium contracts. |
| REV-015 persistence migration policy | **DONE — verified** | Unsupported schema resets safely; no old-save preservation required. |
| REV-016 repeated puzzle materialization/build inputs | **DONE — verified** | Puzzle materialization deduplicated; duplicate build inputs removed. |
| REV-017 generic Wrangler deploy path | **DONE — verified** | Generic deploy removed; Cloudflare is explicit/manual-only; GitHub Pages is canonical and deploys only `refs/heads/main`. |
| REV-018 legacy Vertical Slice | **DONE — verified** | Standalone browser stack and unreachable `src/` domain/runtime/tests deleted after reachability proof; verifier blocks return. |
| REV-019 stylesheet ownership/load split | **DONE — verified** | Compact/aftermath styles are explicit owner inputs; Battle owns its compact CSS. |
| REV-020 broad `rpchess:run-updated` bus | **DONE — verified** | Semantic lifecycle bridge owns combat/Puzzle completion. Power, redesign, shared UX, cross-scene, Events and Travel no longer consume broad `run-updated` for state mutation or completion. Resources retains one documented broad listener solely as coalesced side-effect-free HUD projection; Roster retains a side-effect-free owner projection. Reentrancy-safe Node and Chromium stability contracts pass. |
| REV-021 historical docs conflict with current rules | **DONE — verified** | Current State, Roadmap, Changelog and numbered UI/persistence/assets/architecture docs are synchronized; historical receipts are explicitly non-authoritative for current policy. |

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
- `adm-zip` removed from `package.json` in `f04df06a` and stale lock metadata was reproducibly normalized in `e516c24b` without hand-editing integrity data.
- Permanent dependency-security contract `d83c27c9`, wired `c88dfac6`; current exact-checkout `npm ci`, `npm audit --package-lock-only` and `gate:local` execute successfully.
- Final tooling baseline from `87e595aa`: direct esbuild `0.28.2`; Wrangler `4.130.0` with nested esbuild `0.28.1`; `undici 7.29.0`; `sharp 0.35.4`; `ws 8.21.0`; `path-to-regexp 6.3.0`. Current npm audit reports 0 vulnerabilities.

## Asset reachability cleanup

- `scripts/asset-orphan-inventory.cjs` added in `a497089f`; `npm run assets:orphans:report` exposed in `d7176767`. It has executed on an exact audit checkout. Its automatic candidate set is candidate-only: dynamic race-piece, race-board, Event-background and generated core-piece families remain protected, and ambiguous/planned source assets are not deleted from a literal-reference result alone.
- Production packaging now uses an explicit runtime allowlist/collectors instead of copying the entire source asset trees. `tests/runtime-assets-build.cjs` proves selected source/reserve assets stay out of `dist` while canonical runtime assets remain present.
- Music is explicitly owned by `reboot-audio.mjs`: exactly four `echoes_iron_throne_0N.mp3` tracks. SFX currently contains only `win_fanfare.mp3`, explicitly owned by cross-scene victory presentation.
- Six `generated_assets/commander_*.png` files were proven unreachable after Vertical Slice/approved-shell removal. Historical owners were `approved-shell-data.mjs`, `commander-selection-final.mjs` and Vertical Slice presentation; those runtime owners are absent on the audit branch. Removed in `905c9daa` → `7c3ca286`. Bytes removed: **857,650**.
- `ui_panel_frame.png` and `ui_panel_wide.png` were proven obsolete by the current frameless production invariant: active owner CSS is verifier-guarded against both files, and legacy `game/style.css` was deleted with Vertical Slice. Removed in `e1de42f1` + `dfd6651f`. Bytes removed: **91,263**.
- Five legacy map-node assets (`node_bargain`, `node_boss`, `node_event`, `node_repair`, `node_vault`) were proven unreachable. The legacy `approved-shell-data.mjs`/Vertical Slice route map owned boss/event/repair/vault; `node_bargain` had no production owner even on the frozen baseline. Current Travel keeps the five Reboot route icons `node_battle`, `node_elite`, `node_shop`, `node_story`, `node_training`. Removed in `1fecc0cc` → `9c9f0a66`. Bytes removed: **194,295**.
- Four legacy reward assets (`reward_artifact`, `reward_experience`, `reward_meta`, `reward_upgrade`) remain proven unreachable and removed. A later exact-checkout review caught that `reward_heal.png` and `reward_recruit.png` are current Settlement service art; both were restored from the frozen baseline, their owner CSS paths were corrected, and the existing Settlement regression now protects their presence. Net reward-family reduction: **122,305 bytes**.
- Eight legacy scene backgrounds (`scene_achievements`, `scene_bargain`, `scene_codex`, `scene_event`, `scene_repair`, `scene_settings`, `scene_training`, `scene_vault`) were proven owned only by deleted approved-shell/Vertical Slice presentation or removed legacy Event fallback. Current Reboot-owned `scene_training_ui`, `scene_victory`, Campaign/Battle/Shop/Reward/Defeat backgrounds are preserved. Removed in `879a0f27` → `d1384110`. Bytes removed: **1,123,762**.
- Proven source cleanup after restoring the two active Settlement service assets: **2,389,275 bytes (~2.28 MiB)** across **25 files**. No active race/piece/board/Event-background dynamic family was deleted.
- Legacy `ui_button_primary.png` is retained only as a source/reserve asset and excluded from production `dist`; Foundation/Language/Classic owner CSS now uses the canonical CSS-only obsidian/gold button contract.
- `tests/runtime-assets-build.cjs` now validates every local built CSS `url(...)` against an existing `dist` target, preventing a green build from shipping missing asset references.

## Responsive truth

- Geometry helper rejects page overflow, nonzero window scroll and frame/viewport escapes.
- Portrait stale setup fixed `71c3f39b`; real 3px portrait overflow fixed `480ec6f3`; Language selector fixed `24e7414d`.
- Responsive suite explicitly covers weak surfaces in `e37f3771`. Exact Chromium validation later exposed a real `1366×768` RU main-menu overflow; root cause was a fixed `52px` height subtraction that did not match responsive outer padding. Owner CSS fix `25fde16b` now subtracts the actual responsive vertical padding.
- The same strengthened suite exposed an `844×390` RU Chronicle vertical escape. `983e8907` resets the inherited menu-column `min-height`; targeted menu + Chronicle proof passed.
- Run `34391754411` then exposed an `844×390 RU` Skirmish aftermath CTA at `bottom=398.59` for a `390px` viewport. `8c78f6d8` reduced the owner panel padding and run `34395341890` moved the CTA to `bottom=393.59`, proving the same owner defect remained by only ~3.6px. `8768d55c` tightened only that compact owner padding.
- Run `34396935134` progressed past the Skirmish aftermath fix and exposed a separate `844×390 RU` Battle aftermath panel escape (`top=25.25`, `bottom=405.25`, `height=380`, internal `scrollHeight=614`). `aa65be13` moved the accepted compact aftermath grid out of the deleted runtime injection and into `battle-compact.css`, the Battle owner stylesheet.
- Run `34400237429` on `aa65be13` kept `gate:local` green and progressed through the prior Battle aftermath geometry assertions. The next failure was not a viewport escape: `1024×768 RU` collected `RuntimeError: unreachable` from the Stockfish WASM worker while rapidly replacing combat games. `316d567b` isolated Stockfish requests by operation/lifecycle epoch and hardened stale-worker callback handling; final run `34451963848` later verified the fix.
- `7a620abf` corrected the compact Event choice heading in the true owner stylesheet after the later landscape rule had won the cascade with `!important`.
- `87e595aa` completed workflow/asset/dependency cleanup and changed the Resources test transition to the semantic `rpchess:resources-updated` path. Run `34417319096` passed the full responsive matrix and the first 15 all-browser contracts; Events then timed out because its fixture still expected the removed broad run listener.
- `2906aebf` corrects that stale fixture to reopen the mutated Event through `rpchess:event-open`. Runtime Events remains correctly free of a broad state listener.

## Legacy / build / deployment

- Vertical Slice Stage 1 `d46ca26e`; Stage 2 `5351eb77`.
- Production build explicitly packages owner localization and semantic lifecycle bridge.
- Unsupported save schema resets safely.
- GitHub Pages audit auto-deploy is disabled; `main` remains canonical.
- Pages/PR uses a fast mandatory smoke browser subset; `.github/workflows/full-project-review.yml` is the permanent manual milestone/release 17-contract gate.
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
- Semantic lifecycle (`6aaa8422` → `9f08c276`) + browser instrumentation `a447df1d`: implementation/contracts complete. Current exact-checkout `gate:local` executes the lifecycle Node contract successfully; browser loop verification remains part of the full Chromium gate.
- Dependency security (`f04df06a` → `e516c24b`): direct vulnerable ZIP install edge removed, lock metadata normalized through npm, and exact-checkout `npm ci` + dependency-security + `gate:local` PASS.
- Asset inventory tooling (`a497089f`, `d7176767`) executed on an exact audit checkout. Its broad automatic candidate set includes manifest-driven/source-reserve assets and is never a bulk-delete list. Corrected proven cleanup remains 25 files / 2,389,275 bytes after restoring active Settlement heal/recruit art.
- `3431c48c` / run `34391754411`: `gate:local` PASS; responsive FAIL at `844×390 RU` Skirmish aftermath CTA (`bottom=398.59`, viewport 390); all-browser step skipped.
- `8c78f6d8` / run `34395341890`: `gate:local` PASS; responsive progressed to the same `844×390 RU` Skirmish aftermath CTA at `bottom=393.59`; all-browser step skipped. This iteration reduced the measured overflow by 5px but did not claim a browser PASS.
- `0f812690` / run `34396935134`: `gate:local` PASS; responsive progressed past Skirmish and exposed `844×390 RU` Battle aftermath panel (`top=25.25`, `bottom=405.25`, `scrollHeight=614`); all-browser step skipped.
- `aa65be13` / run `34400237429`: `gate:local` PASS; prior Battle aftermath geometry assertions no longer failed. Responsive later FAILed at `1024×768 RU` on a Stockfish WASM `RuntimeError: unreachable`; no full responsive or all-browser PASS is claimed.
- `7a620abf` / run `34408548508`: `gate:local` PASS and full responsive RU/EN/boundary PASS; all-browser progressed through Travel and exposed the stale Resources fixture.
- `87e595aa` / run `34417319096`: `gate:local` PASS, full responsive RU/EN/boundary PASS, first 15 all-browser contracts PASS; Events fixture timed out while waiting for an owner refresh from broad `rpchess:run-updated`; Puzzles did not start.
- `2906aebf` / run `34451963848`: `npm ci`, canonical local gate, standalone responsive RU/EN/boundary matrix and **all 17 Chromium contracts PASS**, including Events and Puzzles.

---

# Release boundary / owner decisions

All review remediation findings are closed on the audit branch. Remaining actions are intentionally outside autonomous remediation:

1. perform any desired human playtest of the audit candidate;
2. merge into `main` only after explicit owner approval;
3. let the guarded Pages workflow validate/deploy the approved `main` merge;
4. run Cloudflare only after a separate explicit owner command.

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
7. **DONE — verified:** 12-loop Chromium listener/render/node stability proof passes in the exact final browser run.

## Phase C — validation/tooling
8. **DONE — verified:** dead direct `adm-zip` dependency removed, lock metadata normalized reproducibly and dependency-security passes under `npm ci`/`gate:local`.
9. **DONE — verified:** 25 positively unreachable files remain removed (**2.28 MiB net**); ambiguous/planned assets are preserved outside `dist`, legacy image CTA is excluded, and built CSS asset reachability fails closed.
10. **DONE — verified:** lock metadata normalization completed in `e516c24b` without hand-editing integrity data.
11. **DONE — verified:** strengthened responsive matrix plus all 17 Chromium contracts pass on `2906aebf`.

## Phase D — final integration/docs
12. **DONE:** evidence-backed regressions from the final gate are fixed.
13. **DONE:** `docs/CURRENT_STATE.md` records the final code candidate while keeping production `main` explicit.
14. **DONE:** historical docs and architecture/UI/persistence/deployment rules are synchronized.
15. **PERMANENT:** do not merge `main` or deploy Cloudflare without explicit owner instruction.

## Next actions

1. Offer the audit candidate for human playtest if requested.
2. Wait for explicit owner approval before merging into `main`.
3. After an approved merge, verify the main-only Pages production run.
4. Keep Cloudflare manual-only until a separate explicit owner request.

Every subsequent remediation checkpoint must update this report and end with a concrete numbered **Next actions** list.

### Responsive owner checkpoint — da8e0a56

- `e42b5ad834defe31e9cd7a5f4d34e147aaa8ccdd` removed the remaining runtime `landscape-ui-redesign.mjs` CSS injection, moved compact-combat viewport ownership into the static landscape stylesheet, and passed exact-checkout `gate:local` plus targeted `1024×768 RU` combat geometry.
- `da8e0a56e136d450bef633d52682b2274c0ee2ee` restores the accepted owner-scoped `body.events-active` Event landscape contract in static `landscape-ui-redesign.css` after that runtime-style removal.
- Existing `events.cjs` now prevents scoped Event choice rails from returning to two columns.
- Exact-checkout `gate:local`: **PASS**.
- Targeted Event Chromium (`1024×768 RU`, `844×390 RU`): **PASS**.
- Full responsive/all-Chromium validation continues after this checkpoint; no full-browser PASS is claimed here.
- `main`, Pages deployment policy and Cloudflare remain untouched.

**Дальнейшие действия:**
1. Run the complete strengthened RU/EN/boundary responsive matrix on this implementation lineage.
2. If responsive is green, run all Chromium contracts on the same implementation; otherwise fix only the next evidence-backed owner defect.
3. Normalize `package-lock.json` reproducibly through npm and prove `npm ci` plus dependency security.
4. Finish evidence-backed asset inventory and keep ambiguous/planned assets.
5. Remove temporary audit helpers/workflows, then finalize `CURRENT_STATE.md` and historical/deployment documentation.

### Skirmish aftermath checkpoint — 8768d55c

- Run `34391754411` on `3431c48c` proved the first compact Skirmish aftermath failure at `844×390 RU`: CTA `bottom=398.59` in a 390px viewport.
- `8c78f6d876e72ef82981c3bf39f72991b9c4b204` reduced only the owner panel vertical padding. Exact-checkout `gate:local` remained **PASS**.
- Run `34395341890` proved the same CTA moved to `bottom=393.59`; the measured overflow shrank by 5px, but responsive remained **FAIL**, so no browser verification status was upgraded.
- `8768d55ce285ba65617e270e16a9ccc0a55ee856` reduces the compact owner vertical padding from 4px to 1px. No runtime patch layer or cross-screen CSS was added.
- REV-007 is now **DONE — verified** from repository workflow evidence: Pages stays the fast mandatory smoke gate and the existing manual `full-project-review.yml` runs all 17 Chromium contracts.
- Dependency/lock cleanup is also **DONE — verified**: current `npm ci`, dependency-security and `gate:local` pass after the `e516c24b` lock normalization.
- `main` and Cloudflare remain untouched.

**Дальнейшие действия:**
1. Validate `8768d55c` with the complete responsive RU/EN/boundary matrix.
2. If green, run the complete Chromium contract set on the same lineage; otherwise fix only the next exact measured geometry defect.
3. Complete conservative asset classification and preserve all ambiguous/planned/source-reserve files.
4. Remove temporary/duplicate audit workflows after final browser evidence.
5. Synchronize `CURRENT_STATE.md`, remaining GitHub docs and Notion on the final accepted candidate SHA.

### Battle aftermath / Stockfish lifecycle checkpoint — 316d567b

- Run `34396935134` on `0f812690` progressed past the Skirmish fix and exposed the separate `844×390 RU` Battle aftermath owner defect: panel `top=25.25`, `bottom=405.25`, `height=380`, internal `scrollHeight=614` in a 390px viewport.
- `aa65be13b641f1648bc21e0031edafeeebb217a9` restores the accepted compact Battle aftermath grid in `battle-compact.css`, the true owner stylesheet, rather than reintroducing the deleted runtime CSS injection.
- Run `34400237429` on `aa65be13` kept exact-checkout `gate:local` **PASS** and progressed beyond the prior Battle aftermath geometry assertions. The next failure was a `1024×768 RU` browser pageerror from Stockfish WASM: `RuntimeError: unreachable`.
- Root cause is an AI adapter lifecycle race exposed by rapid Skirmish→Battle game replacement: `stop()` previously canceled only an active search, so an older `chooseMove()` still awaiting Stockfish initialization could resume beside the replacement game and interleave UCI commands.
- `316d567bb606c1aa5e3b60a14a3ea0649a90c680` adds separate operation/lifecycle epochs, invalidates stale game requests even while initialization is pending, ignores callbacks from destroyed workers, and makes destroy/re-initialization race-safe.
- Existing `tests/chess-ai-adapter.cjs` is extended with stop-during-initialization and destroy/reuse regressions; no new test suite was added.
- This was an intermediate checkpoint. Final run `34451963848` subsequently passed the complete responsive matrix and all 17 Chromium contracts. `main` and Cloudflare remained untouched.

**Checkpoint closure:** completed by `2906aebf` / run `34451963848`; remaining actions are the owner-controlled merge/deploy decisions listed above.

### Final Event contract checkpoint — 2906aebf

- Run `34417319096` on `87e595aa` proved the complete responsive RU/EN/boundary matrix and the first 15 contracts in the full Chromium sequence. It then timed out in `events-browser.cjs`; Puzzles did not start.
- The timeout was not a runtime ownership defect. The EN fixture directly replaced E147 with E291 in localStorage and expected the Event owner to react to broad `rpchess:run-updated`, although REV-020 deliberately removed that state-mutating subscription.
- `2906aebf5c95f20620bc9691279f95fd65fe8544` changes only the existing browser fixture: after the direct persistence mutation it reopens Events through canonical `rpchess:event-open`.
- Local source verification, the complete Node/static/content/puzzle suite and `npm audit --package-lock-only` pass; audit reports 0 vulnerabilities.
- Exact run `34451963848` passed `npm ci`, `gate:local`, Playwright/Chromium installation, the standalone responsive RU/EN/boundary matrix and all 17 Chromium contracts. Events and Puzzles both report explicit PASS markers.
- `main`, GitHub Pages production and Cloudflare remain untouched.

**Дальнейшие действия:**
1. Offer a human playtest path if requested.
2. Merge into `main` only after explicit owner approval.
3. Verify the guarded Pages build/deploy after any approved merge.
4. Keep Cloudflare manual-only until a separate explicit owner request.
