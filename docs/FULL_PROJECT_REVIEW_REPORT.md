# RPChess — Full Project Review Report

**Audit status:** IN PROGRESS  
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit branch:** `audit/full-project-review-2026-09-08`  
**Started:** 2026-09-08

This report records findings from the full technical/runtime/UI review. The audit intentionally does not patch production problems as they are discovered: first the ownership/dependency graph and complete finding set are established, then fixes should be grouped by root cause rather than layered as more hotfixes.

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

Canonical targets include desktop landscape, 1024×768 tablet landscape, 844×390 phone landscape and portrait rotate-device behavior, plus boundary viewports around active media queries.

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
**Evidence:** `game/js/settlement-app.mjs`, `game/js/content/post-pages-ui-review4.mjs`

`settlement-app.mjs` is the actual Settlement owner and renders stock, price and button state. Afterwards `post-pages-ui-review4.mjs`:

- parses stock from `[data-settlement-supply-stock].textContent` / `card.textContent`;
- parses price from rendered text;
- creates a second Market presentation;
- calls `card.replaceChildren(product, button)`;
- stores derived values in `data-review4-*` attributes.

This means the DOM has become a secondary state bus between the real renderer and the accepted renderer.

**Why this matters:** localization, icon selection, button lifecycle and stock/price changes can desynchronize based on scheduling order. This is the same class of ownership error that caused the recent Market/Supplies icon regression.

**Root-cause direction:** render the accepted product row directly from `settlement-app.mjs` using `activeRun/currentSettlement` and canonical pricing constants. Remove the DOM parsing/replacement layer after parity is proven.

---

## REV-003 — P1 — Resource HUD has overlapping observer/event/click/microtask/timeout render paths

**Area:** runtime performance / lifecycle  
**Evidence:** `game/js/resources-app.mjs`

The resource runtime currently refreshes from all of the following paths:

- `rpchess:run-updated`;
- `rpchess:run-new`;
- `rpchess:run-continue`;
- `rpchess:travel-open`;
- `rpchess:resources-updated`;
- **every document click**;
- a subtree `MutationObserver` watching `hidden` and child-list changes;
- `queueMicrotask(render)`;
- `setTimeout(render, 0)`;
- additional delayed combat-reward rendering.

`settleCombatRewards()` itself can write the run, render, schedule another render and dispatch another resource event.

**Risk:** one semantic transition can fan out into several redundant DOM passes. It also makes event-order bugs difficult to reason about because rendering is partly semantic and partly inferred from arbitrary DOM mutations/clicks.

**Root-cause direction:** make scene/run/resource events the only refresh triggers, keep one coalescing scheduler, and remove global click + subtree-observer fallbacks once owners emit reliable lifecycle events.

---

## REV-004 — P1 — Localization still depends on whole-document post-render DOM translation

**Area:** localization / runtime performance / architecture  
**Evidence:** `game/js/i18n.mjs`, `tests/localization-foundation.cjs`

The active i18n layer has good corpus coverage, but much of runtime localization still follows this model:

`Russian source string -> render DOM -> MutationObserver -> translateLegacy() -> mutate text/attributes`

`i18n.mjs` observes `document.documentElement` with subtree `childList`, `characterData`, and multiple attributes, then re-localizes mutated nodes. The tests validate a large catalogue of exact/pattern translations of Russian source phrases. The canonical keyed UI registry reported by the gate currently contains only **17 UI keys**.

**Why this matters:** newly generated copy can remain Russian until a post-render translation catches it; UI components cannot know their final text width at render time; translation correctness depends on Russian source phrasing remaining exactly recognizable.

**Root-cause direction:** active production screen owners should render semantic `t(key, params)` messages directly. Keep the legacy translator only as a migration compatibility layer, shrink its observation scope progressively, then remove the document-wide observer.

---

## REV-005 — P2 — Source DOM contains controls that accepted runtime immediately removes

**Area:** hidden/obsolete DOM / source-of-truth  
**Evidence:** `game/index.html`, `game/js/ui-redesign-final.mjs`

Canonical source still contains controls such as `[data-skirmish-back]`, while `ui-redesign-final.mjs` defines an `OBSOLETE_HIDDEN_CONTROLS` list and repeatedly calls `.remove()` for Skirmish/Battle/Puzzle/Settlement/Event controls.

The removal is not a one-time migration; it is also called from the generic UI refresh scheduler.

**Risk:** source HTML and runtime accepted DOM describe different products. Tests/hooks can unknowingly depend on nodes which production removes. Hidden/obsolete controls make UI archaeology harder and increase accidental regressions.

**Root-cause direction:** delete obsolete controls at their owner/source renderer. Retain DOM hooks only when a real runtime consumer requires them.

---

## REV-006 — P1 — Core screen layout is implemented by runtime DOM reparenting

**Area:** UI lifecycle / architecture  
**Evidence:** `game/js/ui-redesign-final.mjs`

The accepted layout reparents existing runtime nodes depending on scene/adaptation, including:

- Classic moves panel -> Party panel;
- Skirmish actionbar -> selection panel;
- Battle start button -> Army panel.

The module records original parent/nextSibling references and later restores nodes.

**Risk:** component ownership, event bubbling, CSS selectors and accessibility relationships depend on current parentage and on refresh timing. A renderer that replaces an ancestor can invalidate stored homes. This also forces generic click/resize/event listeners to keep the DOM rearranged.

**Root-cause direction:** make the owning renderers emit the accepted structure directly, or use stable layout containers/slots that do not require moving live interactive controls between parents.

---

## REV-007 — P1 — Canonical Pages gate proves only 3 of 17 browser contracts

**Area:** CI / release proof / regression coverage  
**Evidence:** `.github/workflows/pages.yml`, `scripts/run-browser-tests.cjs`

The default real-Chromium runner defines **17** browser contracts. The canonical PR/main Pages workflow overrides it with:

`classic-chess-browser.cjs,responsive-viewport-browser.cjs,settlement-browser.cjs`

Thus 14 existing browser contracts do not participate in canonical PR/production gating.

A temporary full audit run already demonstrated the consequence: `npm run gate:local` was completely green, but the full browser run failed on the first noncanonical test.

**Root-cause direction:** after stale browser contracts are repaired, define a fast mandatory smoke matrix plus a reliable broader browser gate appropriate to risk. Do not advertise `gate:full` parity if the delivery workflow intentionally runs only a subset.

---

## REV-008 — P2 — Existing Reboot browser contract directly contradicts the accepted one-screen UI policy

**Area:** test debt / UI contract  
**Evidence:** `tests/reboot-foundation-browser.cjs` around the small `390×500` viewport assertion

The full audit run failed with:

`AssertionError: html overflowY=hidden`

Inspection shows the test explicitly requires:

- `html overflowY` = `auto|scroll`;
- `body overflowY` = `auto|scroll`;
- document height > viewport height;
- the page must actually scroll vertically.

That is now the opposite of the user-approved project rule: gameplay/screen composition fits one viewport, and overflow belongs inside constrained frames rather than at page level.

**Classification:** stale test, not evidence that the current `overflow:hidden` UI is itself wrong.

**Root-cause direction:** rewrite this browser test around viewport containment/reachability and explicit internal scroll containers instead of requiring page scroll.

---

## REV-009 — P2 — Supplies/Market presentation is still implemented as global image retargeting + injected CSS

**Area:** UI ownership / regression risk  
**Evidence:** `game/js/content/supplies-resource-icon.mjs`

The runtime:

- injects a Market `background-image` style dynamically;
- hides nested Market `<img>` elements with `display:none!important`;
- scans several unrelated screens for images and rewrites their `src`;
- has explicit exclusion logic for `.settlement-service__icon`;
- uses double `requestAnimationFrame` scheduling;
- listens to a broad set of application events and capture-phase document clicks.

**Why this matters:** the distinction between “Market service art” and “Supplies resource art” belongs in the renderer/data contract, not in a global patch that identifies DOM context after rendering.

**Root-cause direction:** each owner should render the correct semantic asset once. Remove this scanner after Travel/HUD/Settlement/Event owners all use the canonical Supplies asset directly.

---

## REV-010 — P2 — UI hotfix CSS is fragmented across many dynamically injected style blocks

**Area:** CSS ownership / maintainability  
**Evidence:** `post-pages-ui-polish.mjs`, `post-pages-ui-polish-constraints.mjs`, `post-pages-ui-review2..7.mjs`, `supplies-resource-icon.mjs`

Multiple production modules create `<style>` elements at runtime and contain overlapping responsive selectors with extensive `!important` use. The sequence itself is meaningful because later review modules can override earlier review modules.

**Risk:** final computed UI is not derivable from the main CSS files alone. Specificity/order changes become behavioral dependencies; breakpoint fixes tend to create another patch instead of simplifying an owner stylesheet.

**Root-cause direction:** consolidate accepted rules into screen-owned CSS files by adaptation, remove superseded declarations, and use runtime JS only for state/classes that genuinely cannot be expressed statically.

---

## REV-011 — P3 — Resource icon optimizer currently enlarges the already tiny Supplies runtime file

**Area:** asset pipeline  
**Evidence:** audit `npm run gate:local` log

Current audit build reported:

`Runtime resource icons: 1; 1.3 KiB -> 3.7 KiB; saved -2358 B`

The budget is still safely satisfied, so this is not a shipping blocker, but the optimizer is counterproductive for this input.

**Root-cause direction:** optimizer should preserve the original when the transformed output is larger, while still enforcing max dimensions/size.

---

## REV-012 — P3 — Current-state documentation SHA is stale

**Area:** documentation  
**Evidence:** `docs/CURRENT_STATE.md`

The document still names the earlier `bc84d4b5...` production snapshot while this review was frozen from current `main@e92831ca...`.

This is expected to be repaired only after the audit/fix cycle stabilizes; otherwise the report would chase every audit commit.

---

# Positive controls already proven

The audit is not treating the project as globally unhealthy. On the frozen baseline the canonical local gate passed all deterministic/domain/build checks, including:

- 164 production modules with no import cycles;
- Classic chess engine acceptance;
- AI adapter;
- Roster, Battle, Skirmish, Travel, Settlement, Events, Starvation, Puzzles persistence/domain regressions;
- complete Event localization corpus checks;
- 11,498 puzzle catalogue validation;
- production asset-budget verification;
- runtime asset cache parity.

The highest-value debt discovered so far is concentrated in **presentation lifecycle/ownership**, **legacy localization**, and **release-proof coverage**, rather than in chess legality or core deterministic economy logic.

# Runtime/UI verification status

A temporary audit-only workflow was added to the audit branch. It never deploys and does not touch `main`.

### Audit run 1

- `npm run gate:local`: PASS
- Playwright/Chromium install: PASS
- full browser runner: stopped at first failure (`reboot-foundation-browser.cjs`)
- that failure is now classified as stale test debt (REV-008), because it requires page scrolling contrary to the accepted UI contract.

### Audit run 2

The audit workflow was changed to execute **every browser contract even when earlier contracts fail**, recording `AUDIT_RESULT PASS/FAIL` for each. Results are pending while this report is being assembled.

# Remaining review work

The following are still open and must not be represented as complete yet:

- collect all 17 browser-contract results from audit run 2;
- screen-by-screen RU/EN containment verification for desktop/tablet/phone landscape;
- breakpoint-boundary geometry checks;
- internal scroll/carousel ownership review for every constrained frame;
- observer/listener/timer callback-count instrumentation through repeated route loops;
- DOM node/listener leak checks across repeated screen transitions;
- custom-event dependency graph and duplicate dispatch audit;
- persistence state ownership / localStorage namespace review;
- production-vs-legacy/dead-code inventory;
- CSS supersession/deletion map;
- asset reference/orphan inventory;
- final simplification plan ordered by dependency and regression risk.

# Current preliminary simplification order

1. Establish complete browser/UI truth first; fix stale tests, not production to satisfy stale tests.
2. Move accepted Market row and Supplies/Market asset ownership into `settlement-app.mjs` and other true resource owners.
3. Collapse `post-pages-ui-*` chain into owner CSS/renderers while proving viewport parity after each deletion.
4. Remove obsolete source DOM controls and runtime `.remove()` cleanup.
5. Replace DOM reparenting with stable owner structure/slots.
6. Reduce Resources runtime to semantic event-driven rendering with one scheduler.
7. Migrate active production copy from legacy DOM translation to keyed owner-level i18n.
8. Only after the above, measure which global observers/listeners can be deleted safely.

No production fix should be merged until the audit finding set and dependency order are complete enough to avoid another patch-on-patch cycle.
