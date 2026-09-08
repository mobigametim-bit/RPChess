# RPChess — Full Project Review Report

**Audit status:** IN PROGRESS  
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit branch:** `audit/full-project-review-2026-09-08`  
**Started:** 2026-09-08

This report records findings from the full technical/runtime/UI review. The audit intentionally does not patch production problems as they are discovered: first the ownership/dependency graph and complete finding set are established, then fixes should be grouped by root cause rather than layered as more hotfixes.

The audit branch is isolated from production. Production game code remains frozen to the baseline while review evidence, audit-only checks and the remediation plan are collected.

## Severity

- **P0** — data loss, security issue, unrecoverable run corruption, production outage.
- **P1** — high regression risk, wrong state ownership, player-facing lifecycle/layout defect, release proof gap.
- **P2** — substantial technical debt/performance/maintainability problem with bounded current impact.
- **P3** — cleanup/documentation/tooling inefficiency.

## Mandatory UI contract used by this audit

For every active player-facing screen and every supported adaptation:

1. the whole screen/frame composition must fit inside one viewport;
2. no child may escape its owning frame;
3. if frame content cannot fit, overflow must be handled **inside that frame** with a deliberate scroll area or carousel;
4. page-level scrolling is not a substitute for a correct gameplay layout;
5. RU and EN must satisfy the same geometry contract;
6. breakpoint transitions themselves must be checked, not only three nominal viewport sizes.

Canonical targets include desktop landscape, `1024×768` tablet landscape, `844×390` phone landscape and portrait rotate-device behavior, plus boundary viewports around active media queries.

---

# Confirmed findings

## REV-001 — P1 — Accepted UI is bootstrapped through an unrelated Hero Notes patch chain

**Area:** architecture / UI ownership / runtime lifecycle  
**Evidence:** `game/js/content/hero-notes-runtime.mjs`

`hero-notes-runtime.mjs` imports, in order, all of these unrelated presentation layers before importing the actual hero-note data:

- `post-pages-ui-polish-constraints.mjs`
- `post-pages-ui-polish.mjs`
- `post-pages-ui-review2.mjs`
- `post-pages-ui-review3.mjs`
- `post-pages-ui-review4.mjs`
- `post-pages-ui-review5.mjs`
- `post-pages-ui-review6.mjs`
- `post-pages-ui-review7.mjs`
- `supplies-resource-icon.mjs`

The same module then owns an application-wide `MutationObserver`, run/settlement listeners and a delayed Battle polish refresh.

**Why this matters:** module load order is acting as hidden UI dependency injection. A semantic content module is now the de-facto bootstrap owner of cross-scene layout behavior. Future changes to Hero Notes can accidentally alter Market/Training/Combat/Settlement presentation.

**Root-cause direction:** introduce one explicit presentation bootstrap (or, preferably, move accepted behavior into each screen owner) and remove the patch imports from Hero Notes.

**Do not fix by:** creating `post-pages-ui-review8.mjs`.

---

## REV-002 — P1 — Market accepted UI reads state back from the DOM and rewrites the true owner's DOM

**Area:** state ownership / Settlement / UI  
**Evidence:** `game/js/settlement-app.mjs`, `game/js/post-pages-ui-polish.mjs`, `game/js/content/post-pages-ui-review4.mjs`

`settlement-app.mjs` is the actual Settlement owner and renders stock, price and button state. Afterwards presentation patches parse stock/price from rendered text, create another Market presentation and replace the owner's children.

**Why this matters:** the DOM becomes a secondary state bus. Localization, icon selection, button lifecycle and stock/price changes can desynchronize based on scheduling order. This is the same class of ownership error that caused the recent Market/Supplies icon regression.

**Root-cause direction:** render the accepted product row directly from `settlement-app.mjs` using `activeRun/currentSettlement` and canonical pricing constants. Remove the DOM parsing/replacement layers after parity is proven.

---

## REV-003 — P1 — Resource HUD has overlapping observer/event/click/microtask/timeout render paths

**Area:** runtime performance / lifecycle  
**Evidence:** `game/js/resources-app.mjs`

The resource runtime refreshes from semantic events, every document click, a subtree `MutationObserver`, microtasks, zero-delay timers and delayed combat-reward work. A single semantic transition can therefore fan out into several redundant DOM passes.

**Root-cause direction:** make scene/run/resource events the only refresh triggers, keep one coalescing scheduler, and remove global click + subtree-observer fallbacks once owners emit reliable lifecycle events.

---

## REV-004 — P1 — Localization still depends on whole-document post-render DOM translation

**Area:** localization / runtime performance / architecture  
**Evidence:** `game/js/i18n.mjs`, `tests/localization-foundation.cjs`

Much of runtime localization follows:

`Russian source string -> render DOM -> MutationObserver -> translateLegacy() -> mutate text/attributes`

`i18n.mjs` observes `document.documentElement` across subtree text/attribute mutations. The canonical keyed UI registry reported by the gate currently contains only **17 UI keys** even though the legacy translation corpus is much larger.

**Why this matters:** newly generated copy can remain Russian until a post-render pass catches it; components cannot know final text width at render time; correctness depends on Russian source phrasing remaining recognizable.

**Root-cause direction:** active production screen owners should render semantic `t(key, params)` messages directly. Keep the legacy translator only as a migration compatibility layer, shrink its observation scope progressively, then remove the document-wide observer.

---

## REV-005 — P2 — Source DOM contains controls that accepted runtime immediately removes

**Area:** hidden/obsolete DOM / source-of-truth  
**Evidence:** `game/index.html`, `game/js/ui-redesign-final.mjs`

Canonical source still contains controls such as `[data-skirmish-back]`, while runtime cleanup removes obsolete Skirmish/Battle/Puzzle/Settlement/Event controls.

**Risk:** source HTML and accepted runtime DOM describe different products. Tests/hooks can depend on nodes production removes.

**Root-cause direction:** delete obsolete controls at their owner/source renderer. Retain DOM hooks only when a real runtime consumer requires them.

---

## REV-006 — P1 — Core screen layout is implemented by runtime DOM reparenting

**Area:** UI lifecycle / architecture  
**Evidence:** `game/js/ui-redesign-final.mjs`

Accepted layout moves live nodes between parents, including Classic moves, Skirmish actionbar and Battle start CTA, while storing original parent/nextSibling references.

**Risk:** component ownership, event bubbling, CSS selectors and accessibility relationships depend on refresh timing and current parentage.

**Root-cause direction:** make owning renderers emit the accepted structure directly, or use stable layout slots that do not require moving live interactive controls.

---

## REV-007 — P1 — Canonical Pages gate proves only 3 of 17 browser contracts

**Area:** CI / release proof / regression coverage  
**Evidence:** `.github/workflows/pages.yml`, `scripts/run-browser-tests.cjs`

The default real-Chromium runner defines **17** browser contracts. The canonical PR/main workflow runs only:

`classic-chess-browser.cjs,responsive-viewport-browser.cjs,settlement-browser.cjs`

Thus 14 existing browser contracts do not participate in canonical PR/production gating.

**Root-cause direction:** after stale browser contracts are repaired, define a fast mandatory smoke matrix plus a reliable broader browser gate appropriate to risk.

---

## REV-008 — P2 — Existing Reboot browser contract contradicts the accepted one-screen UI policy

**Area:** test debt / UI contract  
**Evidence:** `tests/reboot-foundation-browser.cjs`

The test explicitly requires page-level vertical scrolling at a small viewport (`overflowY=auto|scroll`, document taller than viewport and actual window scroll). Current approved project policy requires the opposite: gameplay/screen composition fits one viewport and overflow belongs inside constrained frames.

**Classification:** stale test, not evidence that current `overflow:hidden` UI is wrong.

**Root-cause direction:** rewrite the test around viewport containment and explicit internal scroll containers.

---

## REV-009 — P2 — Supplies/Market presentation is implemented as global image retargeting + injected CSS

**Area:** UI ownership / regression risk  
**Evidence:** `game/js/content/supplies-resource-icon.mjs`

The runtime injects Market background CSS, hides nested images, scans unrelated screens and rewrites image `src`, contains context exclusions, schedules double `requestAnimationFrame`, and listens to broad events plus capture-phase clicks.

**Root-cause direction:** each owner should render the correct semantic asset once. Remove this scanner after Travel/HUD/Settlement/Event owners all use canonical Supplies art directly.

---

## REV-010 — P2 — UI hotfix CSS is fragmented across runtime style layers

**Area:** CSS ownership / maintainability  
**Evidence:** `battle-route.mjs`, `post-pages-ui-polish.mjs`, `post-pages-ui-polish-constraints.mjs`, `post-pages-ui-review2..7.mjs`, `ux-consistency.mjs`, `cross-scene-visuals.mjs`, `landscape-ui-redesign.mjs`, `supplies-resource-icon.mjs`

Multiple production modules inject `<style>` blocks with overlapping responsive selectors and extensive `!important`. `battle-route.mjs` itself contains a large amount of accepted phone Battle/aftermath CSS even though it is nominally route/bootstrap code.

**Risk:** final UI cannot be derived from canonical stylesheets alone; load/specificity order is behavioral state.

**Root-cause direction:** consolidate accepted rules into screen-owned CSS files and delete superseded declarations as parity is proven.

---

## REV-011 — P3 — Resource icon optimizer enlarges the tiny Supplies runtime file

**Area:** asset pipeline  
**Evidence:** audit `npm run gate:local` log

Current build reported:

`Runtime resource icons: 1; 1.3 KiB -> 3.7 KiB; saved -2358 B`

Budget is still safe, but the optimizer is counterproductive for this input.

**Root-cause direction:** preserve original bytes when transformed output is larger while still enforcing dimension/size budgets.

---

## REV-012 — P3 — Current-state documentation SHA is stale

**Area:** documentation  
**Evidence:** `docs/CURRENT_STATE.md`

The operational doc still names `bc84d4b5...` while this review is frozen from current `main@e92831ca...`.

**Root-cause direction:** synchronize after the audit/fix cycle stabilizes, rather than chasing every audit commit.

---

## REV-013 — P1 — Shared browser-test lifecycle drift masks seven feature contracts

**Area:** test infrastructure / release proof  
**Evidence:** audit run #3, `tests/browser-test-helpers.cjs`

Seven feature contracts (`Skirmish`, `Battle`, `Travel`, `Resources`, `Starvation`, `Events`, `Puzzles`) fail before reaching the feature under test. They all time out on the same helper action:

`page.locator('[data-new-game]').click()` -> element exists but is not visible.

`Roster` reaches a later reload/continue transition and then finds `[data-continue-run]` in DOM but not visible.

**Interpretation:** these failures primarily prove scene/test lifecycle drift, not seven independent gameplay regressions.

**Root-cause direction:** repair the audit/test helper so it explicitly waits for or navigates to the intended visible scene before acting; then reclassify only failures that occur after target scene entry.

---

## REV-014 — P1 — Current responsive gate does not prove the one-screen contract for every screen

**Area:** UI verification / release proof  
**Evidence:** `tests/responsive-viewport-browser.cjs`

The responsive test passes a broad viewport matrix, but generic checks are weaker than the new policy:

- `assertNoHorizontalOverflow()` checks horizontal overflow only;
- `assertReachable()` calls `scrollIntoView()`, which can hide vertical page-overflow defects by scrolling the document;
- Menu, Roster, Chronicle and several modal/special screens are therefore not universally proven to fit a viewport without page scrolling;
- explicit no-scroll checks exist only for selected compact Travel/Skirmish/Battle/aftermath states.

**Root-cause direction:** create a common geometry assertion for every active scene: document `scrollHeight <= clientHeight + tolerance`, scene rect inside viewport, and every designated frame either contains all children or owns deliberate internal scrolling/carousel behavior.

---

## REV-015 — P2 — Persistence hydrates v1 but has no real schema migration path

**Area:** save system / state evolution  
**Evidence:** `game/js/run-persistence.mjs`, `game/js/player-rating.mjs`

Run and Player Rating both use schema version `1`. They normalize fields within v1, but a version mismatch is treated as invalid/missing state (`readRun()` -> `null`; rating -> default profile). There is no ordered migration registry, backup key or recovery path.

**Risk:** the first unavoidable breaking persistence change can silently reset a long run/Power profile if migration is not designed alongside the version bump.

**Root-cause direction:** before schema v2, add explicit versioned migrators, backup/recovery diagnostics and migration tests.

---

## REV-016 — P2 — Gate/build repeats puzzle materialization and contains duplicate build inputs

**Area:** CI/build efficiency / maintainability  
**Evidence:** `package.json`, `scripts/build.cjs`

The 11,498-puzzle catalog is materialized repeatedly in one `gate:local` path: once from `npm test`, again from `puzzles:validate`, and again from `build`. `build.cjs` also lists `endless-run-core.mjs` and `endless-run-app.mjs` twice in its copy manifest.

**Root-cause direction:** materialize once into a deterministic artifact consumed by tests/validation/build; deduplicate the build manifest.

---

## REV-017 — P2 — Generic Wrangler deploy path remains although GitHub Pages is canonical production

**Area:** deployment / tooling  
**Evidence:** `package.json`, `.github/workflows/pages.yml`, `docs/CURRENT_STATE.md`

Canonical production is GitHub Pages, yet `wrangler` remains a dev dependency, `wrangler.toml` remains at repository root and generic `npm run deploy` still means `wrangler deploy`.

Keeping Cloudflare compatibility may be intentional, but the generic command makes the legacy path look canonical.

**Root-cause direction:** rename to an explicit legacy/preview command and document it, or remove Wrangler if no longer required.

---

## REV-018 — P2 — A second legacy Vertical Slice application stack remains outside the production build

**Area:** dead/legacy code / repository complexity  
**Evidence:** `game/vertical-slice.html`, legacy runtime modules/tests, `scripts/build.cjs`

The repository still contains a substantial pre-Reboot/Vertical Slice stack. Some legacy modules use aggressive refresh patterns such as a subtree `MutationObserver` **plus** `setInterval(refresh, 250)`.

The current production build intentionally does not package `vertical-slice.html` and rejects legacy runtime tokens in `dist`, so this is repository debt rather than current production performance debt.

**Root-cause direction:** mark the legacy tree explicitly archived/non-production or remove it after proving no assets/data are still needed. Review tooling should distinguish reachable production modules from repository-only legacy modules.

---

## REV-019 — P2 — Stylesheet ownership/loading is split between HTML and runtime JavaScript

**Area:** CSS/bootstrap architecture  
**Evidence:** `game/index.html`, `reboot-foundation.mjs`, `battle-app.mjs`, `resources-app.mjs`, `settlement-app.mjs`, `events-app.mjs`, `puzzles/puzzle-app.mjs`, `landscape-ui-redesign.mjs`, others

Only a subset of CSS is linked directly in `index.html`. Many active systems dynamically append `<link rel="stylesheet">` elements at module evaluation time (Travel, Power, Resources, Settlement, Starvation, Events, Puzzles, Identity/Chronicle, Landscape UI, etc.).

**Risk:** final CSS presence/order depends on async module bootstrap and contributes to load-order/specificity complexity.

**Root-cause direction:** define one explicit production stylesheet manifest/order. Keep lazy feature CSS only if a measured payload benefit justifies an explicit loading contract.

---

## REV-020 — P2 — `rpchess:run-updated` is becoming a generic cross-system bus

**Area:** event architecture / state ownership  
**Evidence:** Roster, Settlement, Events, Puzzles, Battle, Skirmish, Resources, Power and Mercenary runtimes

Many independent owners persist state and then dispatch the same broad `rpchess:run-updated` event. Several owners also render immediately, while subscribers schedule their own refreshes through microtasks/timeouts/observers.

The event therefore means many different things: run creation, purchases, event resolution, puzzle persistence, battle aftermath, debt settlement and more.

**Risk:** one state write can trigger an unpredictable number of unrelated presentation passes; consumers must reread broad state/DOM to infer what changed.

**Root-cause direction:** keep one authoritative run store/write API but expose narrower semantic events or a typed change-set, with one render scheduler per owner.

---

## REV-021 — P2 — Numbered feature documentation contains historical rules that conflict with current UI/deployment policy

**Area:** documentation drift  
**Evidence:** `docs/03_TRAVEL_SYSTEM.md`, `docs/06_BATTLE.md`, `docs/CHANGELOG.md`

Examples on current `main`:

- Travel docs still describe mobile cards vertically with page-level vertical scroll;
- Battle docs still describe mobile vertical scroll and contain historical “GitHub Actions not used” receipts;
- older changelog entries preserve the former global vertical-scroll contract.

Historical receipts are useful, but current-vs-historical scope is not always obvious inside feature docs.

**Root-cause direction:** retain immutable history under clearly marked historical sections, while adding a current-contract header to each active feature doc that defers to `CURRENT_STATE.md` for deployment/responsive rules.

---

# Positive controls already proven

The project is not globally unhealthy. On the frozen baseline the canonical local gate passed all deterministic/domain/build checks, including:

- **164 reachable production modules with no import cycles**;
- Classic chess engine acceptance;
- AI adapter;
- Roster, Battle, Skirmish, Travel, Settlement, Events, Starvation and Puzzles domain/persistence regressions;
- complete Event localization corpus checks;
- 11,498-puzzle catalogue validation;
- production asset-budget verification;
- runtime asset cache parity.

The highest-value debt is concentrated in **presentation lifecycle/ownership**, **legacy localization**, **test/release proof**, and **cleanup of historical UI layers**, rather than chess legality or core deterministic economy logic.

---

# Runtime/UI verification status

The temporary audit-only workflow never deploys and does not touch `main`. It is now **manual-dispatch only**, so report edits no longer launch another 30+ minute browser matrix.

## Full browser audit run #3

- `npm run gate:local`: **PASS**
- Playwright/Chromium installation: **PASS**
- all 17 browser contracts were allowed to run even after earlier failures.

| Browser contract | Result | Audit interpretation |
|---|---:|---|
| Reboot Foundation | FAIL | stale page-scroll assertion (REV-008) |
| Classic Chess | PASS | real Stockfish production path works |
| Race board themes | PASS | themed Battle/Skirmish cells/assets work |
| King pin ice | PASS | pin overlays/runtime assets work |
| Responsive viewport | PASS | broad nominal/breakpoint matrix passes its existing assertions |
| Roster | FAIL | hidden Continue lifecycle/test drift; mobile assertion also expects page scroll |
| Skirmish | FAIL | shared New Game helper cannot reach visible button before target assertions |
| Battle | FAIL | same shared helper failure |
| Combat side colors | PASS | side/aura/check presentation works |
| Combat aura move sync | PASS | move animation/aura timing works |
| Battle animation art | PASS | personalized moving-piece art continuity works |
| Travel Choice | FAIL | same shared helper failure |
| Resources | FAIL | same shared helper failure |
| Settlement | PASS | one-viewport desktop/tablet/mobile + internal Market scroll + RU/EN + resource/service art |
| Starvation | FAIL | same shared helper failure |
| Events | FAIL | same shared helper failure |
| Puzzles | FAIL | same shared helper failure |

**Totals: 8 PASS / 9 FAIL.**

The nine red results must not be flattened into nine gameplay regressions. One is a confirmed stale UI contract and most others are blocked by shared scene/test setup before the feature is exercised.

## UI screen/adaptation review matrix — current evidence

Legend: **PROVEN** = current evidence directly proves the stated geometry contract; **PARTIAL** = useful coverage exists but the new one-screen rule is not exhaustive; **BLOCKED** = dedicated test currently fails before entering the target scene; **OPEN** = dedicated audit still required.

| Screen / surface | Desktop | Tablet 1024×768 | Mobile 844×390 | RU/EN | Status / gap |
|---|---:|---:|---:|---:|---|
| Main menu | PARTIAL | PARTIAL | PARTIAL | PARTIAL | horizontal/reachability checked; explicit vertical one-screen assertion still needed |
| Settings modal | PARTIAL | PARTIAL | PARTIAL | PARTIAL | close/reachability checked; full modal-frame containment still needed |
| Language modal | OPEN | OPEN | OPEN | n/a | dedicated geometry check needed |
| Player Identity modal | OPEN | OPEN | OPEN | PARTIAL | lifecycle works in passing responsive test; explicit frame containment missing |
| Roster | PARTIAL | PARTIAL | PARTIAL | PARTIAL | horizontal/reachability works; old dedicated test still expects page scroll |
| Chronicle | PARTIAL | PARTIAL | PARTIAL | PARTIAL | reachable/horizontal check exists; vertical containment missing |
| Travel Choice | PARTIAL | PARTIAL | PROVEN compact landscape | PARTIAL | compact 3-card one-row/no-page-scroll proven; old docs/test history conflicts |
| Skirmish prep | PARTIAL | PARTIAL | PROVEN compact landscape | PARTIAL | compact full formation + CTA proven; all-language frame ownership still needs sweep |
| Skirmish combat | PROVEN board geometry | PROVEN board geometry | PROVEN board geometry | PARTIAL | edge-to-edge square board / no coordinate gutter proven |
| Skirmish aftermath | PARTIAL | PARTIAL | PROVEN compact landscape | PARTIAL | six survivor rows + CTA no-page-scroll proven in compact mode |
| Battle prep | PARTIAL | PARTIAL | PROVEN compact landscape | PARTIAL | no-scroll compact prep contract present/passing |
| Battle combat | PROVEN board geometry | PROVEN board geometry | PROVEN board geometry | PARTIAL | same board contract as run combat |
| Battle aftermath | PARTIAL | PARTIAL | PARTIAL | PARTIAL | needs explicit frame-by-frame matrix |
| Settlement | PROVEN | PROVEN | PROVEN | PROVEN RU/EN | strongest screen contract; internal Market scroll fallback verified |
| Event | PARTIAL | PARTIAL | PARTIAL | PARTIAL | choice rail containment/readability exists; all frames/languages/boundaries still needed |
| Starvation | BLOCKED | BLOCKED | BLOCKED | PARTIAL | dedicated browser contract blocked by shared helper drift |
| Puzzle / Training | BLOCKED/PARTIAL | BLOCKED/PARTIAL | BLOCKED/PARTIAL | PARTIAL | dedicated browser contract blocked; board-first presentation needs full geometry sweep |
| Classic setup/game | PARTIAL | PARTIAL | PARTIAL | PARTIAL | Classic browser + responsive run-combat pass; setup modal matrix still needed |
| Endless run summary | OPEN | OPEN | OPEN | PARTIAL | explicit one-screen/internal-overflow audit needed |
| Portrait orientation lock | PROVEN | PROVEN where applicable | PROVEN | RU proven; EN verify | full viewport coverage already asserted |

---

# Open verification items (not yet classified as production defects)

1. **Dependency security warning:** audit-only Playwright installation printed `2 high severity vulnerabilities`. A dedicated dependency audit must separate production-relevant issues from dev-only tooling before assigning severity.
2. **Observer/listener callback fan-out:** static review confirms many observers/global clicks/events, but callback counts through repeated route loops still need instrumentation.
3. **DOM/listener leak:** several modules install page-lifetime global listeners by design. Repeated route loops must prove whether handlers/nodes accumulate or remain stable.
4. **Asset orphan inventory:** build budgets are green, but `generated_assets`, source masters, music/SFX need a reference graph to identify copied-but-unused runtime files.

---

# Further steps after this review

These actions are ordered to reduce risk and avoid another patch-on-patch cycle.

## Phase A — finish the audit truth set (no production refactor yet)

1. Repair **audit-only browser scene setup** so the complete suite can reliably enter Menu/New Game/Continue without changing production behavior.
2. Replace stale page-scroll assertions in audit copies with the approved viewport/frame/internal-scroll contract.
3. Build one reusable geometry checker and run it for **every active screen** at:
   - `1920×1080`;
   - `1366×768`;
   - `1280×720`;
   - `1024×768`;
   - `844×390`;
   - breakpoint boundaries (±1–2 px around active media-query thresholds);
   - portrait lock sizes.
4. Run the same geometry matrix in **RU and EN**. Localization and layout must be evaluated together.
5. For every constrained panel, record which element owns overflow. If content exceeds a frame and the frame has neither internal scroll nor carousel, create a UI finding.
6. Explicitly cover weak/open surfaces: Language, Identity, Chronicle vertical containment, Battle aftermath, Starvation, Puzzle/Training, Classic setup modal and Endless summary.

## Phase B — runtime lifecycle/performance instrumentation

7. Instrument one complete route loop (`Roster -> Travel -> encounter -> aftermath -> Travel`, repeated multiple times) and count:
   - `MutationObserver` callbacks;
   - `rpchess:*` event dispatches/subscriber calls;
   - render/scheduler invocations per screen;
   - document-level click-handler effects;
   - DOM node count before/after each loop.
8. Repeat the loop 10+ times and confirm listener/node counts remain stable. Any growth becomes a leak finding.
9. Produce an event dependency map for `rpchess:run-updated`, `resources-updated`, scene-open events and Power settlement.

## Phase C — persistence/deployment/tooling review completion

10. Define the **save schema migration strategy** before any v2 format change: migrators, backup, failure diagnostics and migration tests.
11. Run a dedicated dependency security audit and classify the two reported high-severity advisories as production-relevant or dev-only.
12. Build an asset reference/orphan report for `dist`, especially `generated_assets`, music/SFX and legacy masters.
13. Decide whether Wrangler/Cloudflare remains an intentional preview fallback. Rename/document or remove the stale generic deploy path accordingly.
14. Collapse repeated puzzle materialization in local/CI gates and deduplicate build inputs.

## Phase D — implementation plan grouped by root cause

Do not start with cosmetic deletion. Fix ownership in this order so each later deletion is safe:

15. **Settlement/Resources ownership:** render accepted Market row and Supplies/Market assets directly in true owners. Remove DOM parsing and `supplies-resource-icon.mjs` after parity.
16. **Explicit presentation bootstrap:** remove unrelated UI import chain from Hero Notes.
17. **Screen-owned CSS:** migrate accepted declarations from `battle-route`, `post-pages-ui-*`, `ux-consistency`, `cross-scene-visuals` and runtime `<style>` blocks into canonical owner stylesheets. Delete superseded rules as each screen passes the full viewport matrix.
18. **Stable DOM structure:** remove obsolete source controls/runtime cleanup; replace DOM reparenting with owner structure/slots.
19. **Resource/event lifecycle:** reduce global click/MutationObserver fallbacks and broad `run-updated` fan-out to semantic state-change scheduling.
20. **Keyed localization migration:** move active screen copy to owner-level `t(key, params)` rendering. Shrink legacy whole-document translation only after each migrated screen passes RU/EN parity.
21. **Legacy repository cleanup:** archive/remove the Vertical Slice stack and legacy-only tests once production references are proven absent.

## Phase E — validation and merge sequence

22. Implement cleanup as **several bounded PRs**, not one mega-refactor. Suggested grouping:
   - PR A: test truth + CI/browser contract repair;
   - PR B: Settlement/Resources ownership simplification;
   - PR C: presentation bootstrap + CSS consolidation for non-combat screens;
   - PR D: Battle/Skirmish layout ownership + removal of reparenting/hotfix CSS;
   - PR E: Resources/event scheduler simplification;
   - PR F: keyed localization migration;
   - PR G: persistence/tooling/legacy cleanup.
23. For each PR use the **minimum sufficient regression set** plus the affected screen's real-Chromium RU/EN viewport matrix.
24. Player-facing UI changes require Human Acceptance before merge.
25. After the final cleanup PR, rerun the complete browser matrix, production Pages gate and a representative manual run.

## Phase F — documentation synchronization after fixes

26. Update `docs/CURRENT_STATE.md` to the final accepted production SHA.
27. Add current-contract headers to numbered feature docs; retain old Cloudflare/GitHub Actions/scroll receipts only under clearly marked historical sections.
28. Synchronize the same final architecture/UI/persistence/deployment state into Notion.
29. Add a short architecture note naming final owners for:
   - scene navigation;
   - run persistence;
   - resources;
   - localization;
   - responsive layout;
   - asset presentation;
   - deployment gates.

---

# Current simplification order

1. Establish complete browser/UI truth first; fix stale tests, not production to satisfy stale tests.
2. Move accepted Market row and Supplies/Market asset ownership into true renderers.
3. Collapse `post-pages-ui-*` chain into owner CSS/renderers while proving viewport parity after each deletion.
4. Remove obsolete source DOM controls and runtime `.remove()` cleanup.
5. Replace DOM reparenting with stable owner structure/slots.
6. Reduce Resources runtime to semantic event-driven rendering with one scheduler.
7. Migrate active production copy from legacy DOM translation to keyed owner-level i18n.
8. Add persistence migrations before the first schema bump.
9. Remove/archive legacy repository stacks and stale deployment/tooling paths only after reachability/reference proof.

No production fix should be merged until the audit finding set and dependency order are complete enough to avoid another patch-on-patch cycle.