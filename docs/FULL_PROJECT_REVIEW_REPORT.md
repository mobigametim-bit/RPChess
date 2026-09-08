# RPChess — Full Project Review Report

**Audit status:** REMEDIATION IN PROGRESS  
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit/remediation branch:** `audit/full-project-review-2026-09-08`  
**Started:** 2026-09-08

This report is the source of truth for the full technical/runtime/UI review and the remediation work that follows it. Production `main` remains untouched while changes are implemented and proved on the audit branch. Fixes are grouped by root cause; adding another patch layer to hide an ownership problem is explicitly out of scope.

## Severity

- **P0** — data loss, security issue, unrecoverable run corruption, production outage.
- **P1** — high regression risk, wrong state ownership, player-facing lifecycle/layout defect, release proof gap.
- **P2** — substantial technical debt/performance/maintainability problem with bounded current impact.
- **P3** — cleanup/documentation/tooling inefficiency.

## Mandatory UI contract

For every active player-facing screen and every supported adaptation:

1. the whole screen/frame composition must fit inside one viewport;
2. no child may escape its owning frame;
3. if frame content cannot fit, overflow must be handled **inside that frame** with a deliberate scroll area or carousel;
4. page-level scrolling is not a substitute for a correct gameplay layout;
5. RU and EN must satisfy the same geometry contract;
6. breakpoint transitions themselves must be checked, not only three nominal viewport sizes.

Canonical targets include desktop landscape, `1024×768` tablet landscape, `844×390` phone landscape, portrait rotate-device behavior, and boundary viewports around active media queries.

---

# Remediation tracker

Status meanings:

- **DONE — verification pending**: root-cause implementation is complete, but the affected regression/gate has not yet been rerun on the latest combined branch head.
- **IN PROGRESS**: part of the root cause has been removed, but meaningful work remains.
- **OPEN**: no final remediation implemented yet.
- **DECISION CLOSED**: product/engineering policy was resolved by the project owner; implementation follows that decision rather than the original proposed direction.

| Finding | Status | Remediation / current state |
|---|---|---|
| REV-001 Hero Notes owns unrelated UI patch chain | **DONE — verification pending** | Deleted `hero-notes-runtime.mjs`; Roster and Settlement render Hero Notes directly. Remaining compatibility presentation modules now load from explicit temporary `presentation-bootstrap.mjs`, so Hero Notes no longer owns global UI bootstrap. |
| REV-002 Market reads state back from DOM | **DONE — verification pending** | `settlement-app.mjs` now renders accepted Market row directly from `activeRun.currentSettlement` and `SETTLEMENT_SUPPLY_PRICE`; `post-pages-ui-review4.mjs` deleted. |
| REV-003 Resources render fan-out | **DONE — verification pending** | Removed Resources subtree `MutationObserver` and global document-click refresh; one coalescing RAF scheduler now reacts to semantic events. |
| REV-004 whole-document legacy localization | **IN PROGRESS** | Settlement and Resources now render keyed `t(...)` copy directly and subscribe to language changes. Remaining production screens still need migration before the global legacy observer can be deleted. |
| REV-005 obsolete source controls / hidden DOM | **OPEN** | Source/runtime ownership cleanup still required. |
| REV-006 runtime DOM reparenting | **OPEN** | Stable owner structures/slots still required for Classic moves, Skirmish actionbar and Battle CTA. |
| REV-007 canonical Pages gate covers 3/17 browser contracts | **OPEN** | Test truth must first be restored; then define fast PR smoke gate + broader milestone browser gate. |
| REV-008 stale browser contract requires page scroll | **DONE — verification pending** | Foundation/Roster audit contracts updated to the accepted one-screen rule instead of requiring page-level vertical scrolling. |
| REV-009 Supplies/Market global image retargeting | **DONE — verification pending** | HUD, Travel, Settlement, Event outcome and shared resource markup render `reward_supplies.png` directly; Market service retains `node_shop.png`; `supplies-resource-icon.mjs` deleted; shared UX retarget scanner removed. |
| REV-010 fragmented runtime hotfix CSS | **IN PROGRESS** | Market/review4 dynamic layer removed; Training rule moved into owner CSS; remaining review2/3/5/6/7, polish layers, `battle-route`, `ux-consistency`, `cross-scene-visuals` and landscape runtime CSS still need consolidation. |
| REV-011 Supplies optimizer makes asset larger | **DONE — verification pending** | Resource icon optimizer now keeps the original bytes when transformation is larger while still enforcing dimension/byte budgets. |
| REV-012 stale CURRENT_STATE SHA | **OPEN** | Intentionally deferred until final accepted remediation SHA. |
| REV-013 shared browser helper lifecycle drift | **DONE — verification pending** | `startNewRun()` now waits for the visible main menu/Identity/Roster and emits scene diagnostics instead of blindly clicking hidden nodes. Full 17-test rerun still required. |
| REV-014 responsive gate does not prove one-screen for every screen | **OPEN** | Reusable all-screen frame/viewport/internal-overflow geometry checker still required for RU/EN and breakpoint boundaries. |
| REV-015 persistence has no migration path | **DECISION CLOSED** | Project owner explicitly approved **not preserving old saves**. Do not build migration machinery. Replace this with an explicit reset-on-schema-change contract and regression test. |
| REV-016 repeated puzzle materialization / duplicate build inputs | **DONE — verification pending** | `gate:local` materializes the catalog once before materialized test/validate/build stages; duplicate Endless build inputs removed. |
| REV-017 generic Wrangler deploy path looks canonical | **DONE — docs pending** | Generic `npm run deploy` removed. Cloudflare is retained only as explicit manual `npm run deploy:cloudflare`; GitHub Pages remains canonical. |
| REV-018 legacy Vertical Slice stack | **OPEN — deletion authorized** | Project owner approved deletion after reachability/reference proof. |
| REV-019 CSS loading split between HTML and runtime JS | **OPEN** | Explicit stylesheet ownership/order still required after patch-layer consolidation. |
| REV-020 `rpchess:run-updated` is overly broad bus | **IN PROGRESS** | Resources now consumes semantic `scene-changed`/`settlement-updated`; Settlement emits source details. Broader event graph still needs reduction. |
| REV-021 historical docs conflict with current UI/deploy rules | **OPEN** | Final docs sync phase will add current-contract headers while retaining clearly marked history. |

### Remediation changes already landed on the audit branch

- Browser helper: visible-scene waiting + diagnostics.
- Foundation/Roster stale scroll-contract cleanup.
- Resource icon optimizer keeps smaller original.
- Puzzle materialization/build pipeline deduplication.
- Manual-only Cloudflare deploy naming.
- Settlement owner-level Market row, Supplies/Market art and keyed localization.
- Resources owner-level Supplies HUD, keyed copy, one scheduler and semantic event refresh.
- Roster and Settlement direct Hero Notes ownership.
- Travel and Event outcome direct Supplies art.
- Shared UX no longer performs global Supplies image replacement.
- Explicit temporary `presentation-bootstrap.mjs` isolates remaining compatibility UI layers.
- Deleted `hero-notes-runtime.mjs`, `post-pages-ui-review4.mjs`, `supplies-resource-icon.mjs`.
- Source verifier and targeted static contracts updated to reject those deleted layers and require the new ownership contracts.

**Important:** the latest combined branch state has not yet completed its milestone regression run. Items marked “DONE — verification pending” are implementation-complete but are not reported as verified until that run finishes.

---

# Confirmed findings

## REV-001 — P1 — Accepted UI was bootstrapped through unrelated Hero Notes code

`hero-notes-runtime.mjs` previously imported the full `post-pages-ui-*` chain plus Supplies patching, observed the app DOM, listened to run/settlement events and even triggered delayed Battle polish work. Module load order therefore acted as hidden dependency injection.

**Remediation:** Hero Notes now belong to their actual renderers. The old runtime was deleted. Remaining compatibility presentation modules are explicitly isolated in `presentation-bootstrap.mjs` and will be removed as REV-010 is completed.

## REV-002 — P1 — Market accepted UI used DOM as a secondary state bus

The true Settlement renderer produced stock/price/button state; `post-pages-ui-review4.mjs` then parsed those values back from text and replaced the owner's DOM.

**Remediation:** `settlement-app.mjs` now renders the accepted product row directly from state/constants. No second Market renderer remains.

## REV-003 — P1 — Resource HUD had overlapping refresh paths

The previous runtime reacted to semantic events, every document click, subtree mutations, microtasks and zero-delay timers.

**Remediation:** global click and subtree MutationObserver fallbacks were removed; one coalescing scheduler is used for semantic lifecycle updates. Milestone runtime instrumentation will still measure fan-out across the whole application.

## REV-004 — P1 — Localization depends on whole-document post-render translation

The legacy path is still broadly `Russian authored DOM -> MutationObserver -> translateLegacy() -> mutate DOM`. This can produce transient Russian text in EN and makes final text geometry timing-dependent.

**Current remediation:** Settlement and Resources now render keyed messages directly. Migration must continue screen-by-screen before the global observer is deleted.

## REV-005 — P2 — Source DOM contains controls runtime later removes

Source HTML/renderers and accepted production DOM do not always describe the same interface. Runtime cleanup repeatedly removes obsolete Skirmish/Battle/Puzzle/Settlement/Event controls.

**Target:** delete obsolete controls in their source owners and remove runtime cleanup.

## REV-006 — P1 — Core layout uses runtime DOM reparenting

Accepted layouts move live interactive nodes between parents and keep stored “home” references. This makes event/CSS/accessibility behavior timing-dependent.

**Target:** owner renderers or stable slots must produce the accepted structure directly.

## REV-007 — P1 — Canonical Pages gate proves only 3 of 17 browser contracts

The full browser runner contains 17 contracts while canonical PR/main Pages currently runs only Classic Chess, responsive viewport and Settlement.

**Target:** repair stale/blocked contracts first, then keep a fast mandatory smoke matrix and a broader milestone/full-release gate.

## REV-008 — P2 — Reboot browser test contradicted the one-screen policy

The test required `overflowY=auto|scroll`, a document taller than the viewport and actual page scrolling.

**Remediation:** stale requirement removed from audit contracts; the accepted viewport/internal-overflow policy is now the target.

## REV-009 — P2 — Supplies/Market art was patched globally after render

A global runtime injected Market CSS, hid nested images, scanned multiple screens and rewrote `src` after rendering.

**Remediation:** true owners now render the correct asset directly; the scanner was deleted.

## REV-010 — P2 — UI hotfix CSS is fragmented across runtime style layers

There are still overlapping dynamic style blocks and `!important` rules in `battle-route`, remaining `post-pages-ui-*`, `ux-consistency`, `cross-scene-visuals`, landscape UI and related compatibility layers.

**Target:** migrate accepted declarations into screen-owned CSS and delete superseded layers after geometry parity for each screen.

## REV-011 — P3 — Resource icon optimizer enlarged a tiny runtime asset

Audit build previously reported roughly `1.3 KiB -> 3.7 KiB` for the Supplies icon.

**Remediation:** preserve the source when the transformed output is larger.

## REV-012 — P3 — Current-state documentation SHA is stale

`CURRENT_STATE.md` reflects an older production snapshot.

**Target:** update only after remediation is accepted/merged, avoiding churn on every audit commit.

## REV-013 — P1 — Shared browser lifecycle drift masked feature tests

Several feature contracts failed before entering their target scene because a shared helper clicked an existing but hidden `[data-new-game]` node.

**Remediation:** helper now requires visible expected scenes and prints active-scene diagnostics on failure. Full rerun will determine which remaining failures are real feature defects.

## REV-014 — P1 — Responsive gate is not yet an exhaustive geometry proof

Existing helpers mostly prove horizontal overflow/reachability; `scrollIntoView()` can conceal page-level vertical overflow.

**Target:** common assertion must prove document/scene/frame containment and explicitly recognize only deliberate internal scroll/carousel containers.

## REV-015 — P2 — Persistence version evolution policy was undefined

Current v1 state normalizes within the same version but does not migrate incompatible versions.

**Product decision:** old saves do not need preservation. Therefore the correct target is **explicit fail-safe reset on unsupported schema version**, not migration compatibility. Add clear version/reset behavior and tests before a future schema bump.

## REV-016 — P2 — Gate/build repeated puzzle materialization and duplicate copy inputs

The large puzzle catalog was regenerated multiple times inside one gate, and Endless files appeared twice in the build manifest.

**Remediation:** materialize once per gate path and reuse the generated artifact; deduplicate build inputs.

## REV-017 — P2 — Generic deploy command implied Cloudflare was canonical

GitHub Pages is production, while `npm run deploy` still meant Wrangler.

**Remediation:** Cloudflare remains available only through an explicit manual command. No automatic Cloudflare deployment is intended.

## REV-018 — P2 — Legacy Vertical Slice application remains in repository

A substantial pre-Reboot application exists outside the production build, including old aggressive refresh patterns.

**Product decision:** deletion authorized after reference/reachability proof.

## REV-019 — P2 — Stylesheet loading ownership is split

Some CSS is linked in HTML, while many active modules dynamically append stylesheets at evaluation time.

**Target:** one explicit production stylesheet order/ownership model; lazy CSS only if a measured payload benefit justifies it.

## REV-020 — P2 — `rpchess:run-updated` is an overly broad cross-system bus

Many independent writes dispatch the same event; consumers reread broad state/DOM to infer what changed.

**Target:** narrower semantic events or typed change details and one scheduler per owner. Resources/Settlement cleanup has started this migration.

## REV-021 — P2 — Feature docs contain historical rules conflicting with current policy

Travel/Battle/history still contain former page-scroll and old GitHub Actions/hosting contracts without sufficiently strong current-vs-historical separation.

**Target:** current-contract headers + clearly marked immutable historical receipts.

---

# Positive controls from the frozen baseline

Before remediation, canonical deterministic/domain/build checks were green for core chess legality, AI, Roster, Battle, Skirmish, Travel, Settlement, Events, Starvation, Puzzles persistence/domain behavior, Event localization corpus, 11,498-puzzle validation and production asset budgets. The highest-risk debt is concentrated in presentation lifecycle/ownership, localization, test truth and cleanup rather than chess legality.

---

# Runtime/UI verification status

The audit-only workflow is **manual-dispatch only** and never deploys.

## Last completed full browser audit before remediation

| Browser contract | Result | Interpretation |
|---|---:|---|
| Reboot Foundation | FAIL | stale page-scroll assertion — code updated since this run |
| Classic Chess | PASS | real Stockfish path works |
| Race board themes | PASS | themed Battle/Skirmish cells/assets work |
| King pin ice | PASS | pin overlays/runtime assets work |
| Responsive viewport | PASS | existing nominal/breakpoint assertions passed |
| Roster | FAIL | stale lifecycle/page-scroll contract — code updated since this run |
| Skirmish | FAIL | blocked by shared helper — helper updated since this run |
| Battle | FAIL | blocked by shared helper — helper updated since this run |
| Combat side colors | PASS | presentation works |
| Combat aura move sync | PASS | timing works |
| Battle animation art | PASS | continuity works |
| Travel Choice | FAIL | blocked by shared helper — helper updated since this run |
| Resources | FAIL | blocked by shared helper — helper updated since this run |
| Settlement | PASS | desktop/tablet/mobile containment + internal Market scroll + RU/EN |
| Starvation | FAIL | blocked by shared helper — helper updated since this run |
| Events | FAIL | blocked by shared helper — helper updated since this run |
| Puzzles | FAIL | blocked by shared helper — helper updated since this run |

**Old total: 8 PASS / 9 FAIL.** These numbers are now stale and must be replaced by the next milestone run.

## UI screen/adaptation evidence matrix

Legend: **PROVEN** = direct evidence of the required geometry; **PARTIAL** = useful coverage exists but not exhaustive; **BLOCKED** = old dedicated test was blocked by setup; **OPEN** = explicit audit still required.

| Screen / surface | Desktop | Tablet 1024×768 | Mobile 844×390 | RU/EN | Gap |
|---|---:|---:|---:|---:|---|
| Main menu | PARTIAL | PARTIAL | PARTIAL | PARTIAL | exhaustive vertical/frame assertion pending |
| Settings modal | PARTIAL | PARTIAL | PARTIAL | PARTIAL | frame containment pending |
| Language modal | OPEN | OPEN | OPEN | n/a | geometry matrix pending |
| Player Identity | OPEN | OPEN | OPEN | PARTIAL | explicit frame containment pending |
| Roster | PARTIAL | PARTIAL | PARTIAL | PARTIAL | updated dedicated contract must rerun |
| Chronicle | PARTIAL | PARTIAL | PARTIAL | PARTIAL | vertical containment pending |
| Travel Choice | PARTIAL | PARTIAL | PROVEN compact | PARTIAL | full RU/EN/boundary sweep pending |
| Skirmish prep | PARTIAL | PARTIAL | PROVEN compact | PARTIAL | full RU/EN/frame sweep pending |
| Skirmish combat | PROVEN board | PROVEN board | PROVEN board | PARTIAL | language sweep pending |
| Skirmish aftermath | PARTIAL | PARTIAL | PROVEN compact | PARTIAL | full matrix pending |
| Battle prep | PARTIAL | PARTIAL | PROVEN compact | PARTIAL | full matrix pending |
| Battle combat | PROVEN board | PROVEN board | PROVEN board | PARTIAL | language sweep pending |
| Battle aftermath | PARTIAL | PARTIAL | PARTIAL | PARTIAL | explicit frame matrix pending |
| Settlement | PROVEN | PROVEN | PROVEN | PROVEN | rerun required after owner refactor |
| Event | PARTIAL | PARTIAL | PARTIAL | PARTIAL | full frames/languages/boundaries pending |
| Starvation | BLOCKED (old run) | BLOCKED | BLOCKED | PARTIAL | rerun helper-fixed test + geometry matrix |
| Puzzle / Training | BLOCKED/PARTIAL | BLOCKED/PARTIAL | BLOCKED/PARTIAL | PARTIAL | rerun + board/panel geometry sweep |
| Classic setup/game | PARTIAL | PARTIAL | PARTIAL | PARTIAL | setup modal matrix pending |
| Endless summary | OPEN | OPEN | OPEN | PARTIAL | explicit one-screen/internal-overflow audit pending |
| Portrait lock | PROVEN | PROVEN where applicable | PROVEN | RU proven; EN verify | EN geometry check pending |

---

# Open verification items

1. **Dependency security:** classify previously reported two high-severity advisories as production-relevant or dev-only.
2. **Observer/listener/event fan-out:** measure callbacks/render scheduling over repeated full route loops.
3. **Leak stability:** repeat route loops 10+ times and compare listener/node counts.
4. **Asset orphan inventory:** build a runtime reference graph for generated assets, music/SFX and legacy masters.
5. **Latest remediation regression:** run deterministic gate after verifier/test ownership changes, then one full browser milestone run.

---

# Further steps after this review

These are the active autonomous remediation steps, ordered to minimize regressions.

## Phase A — restore complete test/UI truth

1. **Run the deterministic local gate on the current combined remediation head** and fix only real contract failures; do not restore deleted architecture just to satisfy stale tests.
2. Run the repaired 17-contract Chromium suite once at the next milestone and reclassify every result after actual target-scene entry.
3. Build one reusable geometry checker for every active screen at `1920×1080`, `1366×768`, `1280×720`, `1024×768`, `844×390`, breakpoint boundaries (±1–2px) and portrait lock sizes.
4. Run the same geometry matrix in **RU and EN**.
5. Record overflow ownership for every constrained frame. Any overflowing content without internal scroll/carousel becomes a concrete UI defect.
6. Explicitly close weak surfaces: Language, Identity, Chronicle, Battle aftermath, Starvation, Puzzle/Training, Classic setup and Endless summary.

## Phase B — remove presentation/runtime debt

7. Inventory remaining responsibilities in `post-pages-ui-polish(-constraints)` and review2/3/5/6/7.
8. Move each accepted rule into its actual screen-owned CSS/renderer and delete the compatibility module immediately after parity proof.
9. Move Battle/aftermath CSS out of `battle-route.mjs`; remove its hidden-attribute MutationObserver by having scene owners set semantic state/classes.
10. Remove obsolete controls from source owners and then delete runtime `.remove()` cleanup.
11. Replace Classic/Skirmish/Battle DOM reparenting with stable owner structures/slots.
12. Consolidate stylesheet loading into an explicit production order after compatibility layers are gone.

## Phase C — localization/event lifecycle

13. Continue owner-keyed localization: Roster → Travel → Starvation → Events/Puzzles → Battle/Skirmish → remaining active surfaces.
14. After each migrated screen passes RU/EN geometry parity, remove that screen's reliance on legacy DOM translation.
15. Once all active production screens are keyed, delete the whole-document legacy MutationObserver and retain only intentional compatibility translation if any data corpus still requires it.
16. Map `rpchess:*` events and replace broad `run-updated` fan-out with narrower semantic changes where useful.
17. Instrument 10+ route loops and prove stable callback/render/node counts.

## Phase D — persistence/tooling/legacy cleanup

18. Implement the owner-approved **reset-on-unsupported-schema** policy; no migration/backward-save preservation is required. Add only the minimal regression proving safe reset behavior.
19. Complete dependency security classification.
20. Generate asset orphan/reference inventory and remove only proven unused assets.
21. Delete the authorized legacy Vertical Slice application/runtime/tests after reference proof.
22. Keep Cloudflare manual-only (`deploy:cloudflare`); GitHub Pages remains canonical.

## Phase E — validation and integration

23. Use minimum sufficient targeted tests during each cleanup block.
24. At meaningful architecture milestones, run the complete Chromium matrix rather than after every small commit.
25. Before integration, run the complete browser matrix, canonical Pages gate and a representative manual playthrough.
26. Any genuinely player-visible layout change that cannot be proven as parity is shown to the project owner for Human Acceptance before merge.
27. Do **not** merge to `main` without explicit user instruction.

## Phase F — final documentation synchronization

28. Update `docs/CURRENT_STATE.md` to final accepted production SHA.
29. Add current-contract headers to numbered feature docs; keep old hosting/CI/scroll material only under clearly marked historical sections.
30. Synchronize final architecture/UI/persistence/deployment state into Notion.
31. Add final architecture ownership note for scene navigation, run persistence, resources, localization, responsive layout, asset presentation and deployment gates.

---

# Current simplification order

1. Prove the current remediation head with deterministic tests.
2. Restore trustworthy full browser results and exhaustive geometry truth.
3. Finish deletion of compatibility presentation modules by moving rules into true owners.
4. Remove obsolete DOM and reparenting.
5. Finish keyed localization and remove global legacy observation.
6. Reduce broad event/render fan-out and prove no leaks.
7. Apply explicit save-reset policy, dependency/asset cleanup and delete Vertical Slice.
8. Final RU/EN all-screen matrix + Pages gate + documentation synchronization.

Every subsequent remediation report must update this tracker and include a concrete **Next actions** list.