# RPChess — Full Project Review Report

**Audit status:** REMEDIATION IN PROGRESS  
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit/remediation branch:** `audit/full-project-review-2026-09-08`  
**Current remediation code head:** `51464246a61154919220ac965a7b928f6ab5690e`  
**Started:** 2026-09-08

This report is the source of truth for the full technical/runtime/UI review and remediation. Production `main` remains untouched. Fixes are grouped by root cause; adding another patch layer to conceal an ownership problem is out of scope.

## Severity

- **P0** — data loss, security issue, unrecoverable run corruption, production outage.
- **P1** — high regression risk, wrong state ownership, player-facing lifecycle/layout defect, release proof gap.
- **P2** — substantial technical debt/performance/maintainability problem with bounded current impact.
- **P3** — cleanup/documentation/tooling inefficiency.

## Mandatory UI contract

For every active player-facing screen and every supported adaptation:

1. the whole screen/frame composition fits inside one viewport;
2. no child escapes its owning frame;
3. if content cannot fit, overflow is handled **inside that frame** with deliberate scroll/carousel behavior;
4. page-level scrolling is not a substitute for a correct gameplay layout;
5. RU and EN satisfy the same geometry contract;
6. breakpoint transitions are tested, not only nominal viewport sizes.

Canonical targets include desktop landscape, `1024×768`, `844×390` phone landscape, portrait rotate-device behavior, and boundary viewports around active media queries.

---

# Remediation tracker

Status meanings:

- **DONE — verified**: implementation and its relevant deterministic/browser proof have passed.
- **DONE — verification pending**: implementation is complete but still awaits the relevant gate.
- **IN PROGRESS**: meaningful work remains.
- **OPEN**: no final remediation implemented yet.
- **DECISION CLOSED**: project-owner decision resolved the product/engineering policy.

| Finding | Status | Remediation / current state |
|---|---|---|
| REV-001 Hero Notes owns unrelated UI patch chain | **DONE — verified** | `hero-notes-runtime.mjs` deleted. Roster/Settlement render Hero Notes directly; temporary presentation bootstrap is also deleted. |
| REV-002 Market reads state back from DOM | **DONE — verified** | Settlement renders Market from `activeRun.currentSettlement` / `SETTLEMENT_SUPPLY_PRICE`; `post-pages-ui-review4.mjs` deleted. |
| REV-003 Resources render fan-out | **DONE — verified** | Resources subtree `MutationObserver` and global click refresh removed; one coalescing scheduler consumes semantic events. |
| REV-004 whole-document legacy localization | **IN PROGRESS** | Settlement/Resources render keyed `t(...)` copy directly. Remaining active screens must migrate before the global legacy observer can be deleted. |
| REV-005 obsolete source controls / hidden DOM | **DONE — verification pending** | Obsolete Skirmish/Battle/Puzzle/Event shortcuts and dead handlers are deleted from their owners; shared post-render `.remove()` cleanup and dead compatibility CSS are gone (`23778724`). Current full Chromium parity remains pending. |
| REV-006 runtime DOM reparenting | **DONE — verification pending** | Battle Start CTA is owner-rendered in `.battle-army` (`b63772f8`); Classic Journal remains in `.classic-shell` (`db42fb78`); Skirmish actionbar remains in `.skirmish-shell` (`bac324a0`). Strengthened contracts reflect stable owner structure; current end-to-end Chromium proof remains pending. |
| REV-007 canonical Pages gate covers only a smoke subset | **OPEN** | Pages smoke currently runs Classic + Responsive + Settlement. Final fast-smoke vs full 17-contract milestone/release split remains to be defined after current responsive truth is fully green. |
| REV-008 stale browser contract requires page scroll | **DONE — verified** | Foundation/Roster contracts enforce one-screen behavior rather than requiring page scrolling. |
| REV-009 Supplies/Market global image retargeting | **DONE — verified** | True owners render Supplies/Market art directly; global retarget scanner and `supplies-resource-icon.mjs` deleted. |
| REV-010 fragmented runtime hotfix CSS | **DONE — verification pending** | All review/polish compatibility modules are deleted. Puzzle/Settlement/Starvation/Skirmish/Endless compact rules live in explicit owner stylesheets. Skirmish/Battle aftermath viewport rules moved into `skirmish-compact.css` / `battle-compact.css`; `battle-route.mjs` is imports-only (`ad37fba5`). No generic CSS-in-JS hotfix layer remains. Current gate/Chromium verification is pending. |
| REV-011 Supplies optimizer makes asset larger | **DONE — verified** | Optimizer keeps original bytes when transformed output is larger while still enforcing budgets. |
| REV-012 stale CURRENT_STATE SHA | **OPEN** | Deferred intentionally until the final accepted remediation SHA. |
| REV-013 shared browser helper lifecycle drift | **DONE — verified** | `startNewRun()` waits for visible scenes and emits diagnostics; full milestone #9 passed 17/17. |
| REV-014 responsive gate does not prove one-screen for every screen | **DONE — verification pending** | Existing responsive suite now covers RU/EN portrait lock, breakpoint matrices and explicit weak surfaces: Classic setup, Puzzle/Training, Starvation, Endless summary and Battle aftermath (`e37f3771`). Assertions reject page overflow and require internal owner-frame scrolling where needed. Execution on the current architecture is still pending. |
| REV-015 persistence has no migration path | **DONE — verified** | Unsupported schema versions are explicitly deleted/reset by `readRun()`; no backward-save migration is required by owner decision. |
| REV-016 repeated puzzle materialization / duplicate build inputs | **DONE — verified** | Puzzle catalog materializes once per gate path; duplicate Endless build inputs removed. |
| REV-017 generic Wrangler deploy path looks canonical | **DONE — docs pending** | Generic `npm run deploy` removed. Cloudflare remains explicit manual `deploy:cloudflare`; GitHub Pages is canonical. Temporary audit Pages push trigger used for runs #91–#93 was removed in `496bfac9`; audit remediation commits no longer auto-deploy Pages. |
| REV-018 legacy Vertical Slice stack | **DONE — verification pending** | Stage 1 removed standalone Vertical Slice browser entry/bundle/builder/tests (`d46ca26e`). Stage 2 removed unreachable `src/` domain/runtime/test stack (`5351eb77`). Canonical `gate:local`, production build, Stockfish packaging and asset-cache parity passed on runs #91–#93; full current 17-contract Chromium milestone remains pending. |
| REV-019 CSS loading split between HTML and runtime JS | **DONE — verification pending** | Every compact stylesheet now loads from its screen owner: Skirmish via owner HTML order; Battle from `battle-app.mjs` after base Battle CSS (`d7827fd1`); Travel/Puzzle/Settlement/Starvation/Endless from their owner apps. Shared `ui-redesign-final.mjs` no longer loads Battle CSS (`54aa9228`), and source/static contracts prevent regression (`fd557c10`, `3bf00851`, `a3ec62b8`). Build/browser verification remains pending. |
| REV-020 `rpchess:run-updated` is overly broad bus | **IN PROGRESS** | Resources consumes semantic scene/settlement updates; Travel compatibility fan-out was removed; Puzzle/global post-pages listeners and the entire generic presentation runtime are deleted. Broader event graph still needs semantic narrowing and loop instrumentation. |
| REV-021 historical docs conflict with current UI/deploy rules | **OPEN** | Final docs sync will add current-contract headers and retain history only as clearly marked history. |

---

# Remediation changes landed

## Ownership / presentation

- Browser lifecycle helper waits for visible target scenes and emits diagnostics.
- Foundation/Roster stale page-scroll contracts were removed.
- Settlement owns Market row/state, Market art and keyed copy.
- Resources owns Supplies HUD rendering, keyed copy and a single semantic scheduler.
- Roster and Settlement own Hero Notes directly.
- Travel owns its king portrait and explicit compact stylesheet; Travel selectors/fan-out were removed from generic post-pages layers.
- Battle Prep accepted compact geometry moved from route/review/constraints/polish into `battle-compact.css` and is packaged in production.
- Battle Prep duplicate hidden-state observer in `battle-route.mjs` was removed.
- Battle Start CTA is rendered directly in `.battle-army`; obsolete hidden actionbar/counters/action-cost and CTA reparent/restore logic were removed.
- Classic Journal remains a stable sibling in `.classic-shell`; both reparent paths were removed. Run-combat layout now lives in `chess-ai-polish.css`.
- Skirmish actionbar remains in its source `.skirmish-shell` slot; shared redesign no longer stores home/next references.
- Obsolete Skirmish/Battle/Puzzle/Event navigation shortcuts are absent at source; shared post-render control removal is deleted.
- Responsive test setup distinguishes a portrait document from a visible landscape menu (`71c3f39b`), and its Classic Journal assertion matches stable owner structure.
- Portrait orientation lock excludes hidden gameplay roots from layout rather than leaving a `100vh` invisible box contributing to `body.scrollHeight` (`480ec6f3`).
- Language-modal browser interaction targets the explicit `.reboot-close` instead of an ambiguous shared close hook (`24e7414d`).
- Puzzle owner authors compact objective/stars/reward DOM and renders compact values directly from Puzzle state (`d5c6f3c2`); the former post-render read/copy/regex mutation path is gone.
- Puzzle accepted compact presentation is explicitly owned by `puzzles-compact.css`, loaded by `puzzle-app.mjs` and packaged by production build (`d5c6f3c2`).
- Starvation accepted compact HUD-safe/internal-scroll rules live in `starvation-compact.css` and are loaded by `starvation-app.mjs` (`286e94d7`, `ab67c470`).
- Endless summary resource-HUD suppression lives in `endless-run-compact.css` and is loaded by `endless-run-app.mjs` (`775c50ba`, `beb1a036`).
- Skirmish mobile formation geometry lives in `skirmish-compact.css`, loaded immediately after base `skirmish.css` (`d420dea7`, `c52e526e`).
- Settlement tablet/phone service composition lives in `settlement-compact.css`, loaded by `settlement-app.mjs` (`91d26bbb`, `049977ea`).
- Production build/source contracts package and require all owner compact stylesheets.
- Skirmish aftermath toast/hidden-section/phone viewport containment moved from route CSS-in-JS into `skirmish-compact.css` (`4eff6a42`).
- Battle aftermath toast/hidden-section/phone viewport containment moved into `battle-compact.css` (`90f2a714`).
- `battle-route.mjs` is imports-only after `ad37fba5`; presentation injection has been removed completely.
- Existing Battle/Skirmish regressions require owner aftermath CSS and reject any route `style` injection (`4f6e9b06`, `54c96e78`).
- Existing responsive browser suite now adds owner-frame geometry for Classic setup, Puzzle/Training, Starvation, Endless summary and Battle aftermath at `1024×768` and `844×390`; Battle/Skirmish combat path retains `1180×820` coverage (`e37f3771`).
- Battle now loads `battle-compact.css` from `battle-app.mjs` immediately after `battle.css`; shared redesign no longer owns that stylesheet (`54aa9228`, `d7827fd1`).

## Deleted/superseded layers

Deleted:

- `hero-notes-runtime.mjs`
- `post-pages-ui-review2.mjs`
- `post-pages-ui-review3.mjs`
- `post-pages-ui-review4.mjs`
- `post-pages-ui-review5.mjs`
- `post-pages-ui-review6.mjs`
- `post-pages-ui-review7.mjs`
- `post-pages-ui-polish-constraints.mjs`
- `supplies-resource-icon.mjs`
- `post-pages-ui-polish.mjs` (`99399790`)
- `presentation-bootstrap.mjs` (`bcd5dea4`)

There is **no remaining generic post-pages presentation runtime and no presentation CSS injection in `battle-route.mjs`**. Existing owner tests reject return of these paths.

## Build / persistence / assets / deployment

- Supplies optimizer keeps the smaller source file.
- Puzzle build/materialization work is deduplicated.
- Unsupported run schema resets safely; old save compatibility is intentionally not maintained.
- `battle-compact.css`, `travel-choice-compact.css`, `puzzles-compact.css`, `settlement-compact.css`, `starvation-compact.css`, `skirmish-compact.css` and `endless-run-compact.css` have explicit production build ownership.
- Battle compact CSS loading is now owned by `battle-app.mjs`; shared final redesign loads only its own consolidated stylesheet and combat side-color stylesheet.
- `battle-route.mjs` no longer imports `presentation-bootstrap.mjs` and contains only imports/comments; build no longer packages retired presentation modules.
- Vertical Slice browser entry, generated Iron Marches bundle/builder, `src/` application/domain/runtime stack, isolated previews/workflows and dormant tests are deleted; source verification blocks their return.
- GitHub-hosted runs #91–#93 prove `npm run gate:local`, Reboot production build with Stockfish 18.0.0 and runtime asset-cache parity on the remediated architecture through `480ec6f3`.
- A one-commit audit-only push trigger was added to `full-project-review.yml` at `0931aebb` to try to start the current milestone without changing Pages or Cloudflare. GitHub reported **zero check runs** for that commit, so no verification result is claimed. The trigger was immediately removed in `51464246`; the workflow is manual-only again.
- The temporary audit-branch Pages push trigger used for runs #91–#93 remains removed. Pages auto-deploys only from `main`.
- Cloudflare remains manual-only and was not deployed.

---

# Verification history

The full audit/browser workflows remain milestone tools. Separately, canonical Pages was temporarily allowed to run on the audit branch for runs #91–#93, then restored to `main`-only push deployment in `496bfac9`.

- **Full Project Review #7** (`34257582147`, `b0d6b001`): 16/17 Chromium contracts PASS; Settlement failed due compatibility `background` shorthand erasing owner Market art.
- Root cause fixed by preserving owner background image and limiting compatibility declaration to `background-color`.
- **Full Project Review #8** (`34262502407`, `d5820573`): canonical local gate PASS, **17/17 Chromium PASS**, zero failures.
- **Full Project Review #9** (`34265688360`, `b63726eb`): canonical local gate PASS, **17/17 Chromium PASS**, zero failures after review3/5/6/7 deletion and owner migration.
- **Targeted owner-migration #10** (`34266676368`, `8e7c4675`): local gate PASS; Classic/Settlement/Puzzles 3/3 PASS.
- **Save-schema #11** (`34267715267`, `2ced5f67`): local gate and persistence regression PASS.
- **Geometry contract #12** (`6888beb2`): geometry/static contract authored; strengthened/current Chromium verification remained pending.
- **Roster/Travel owner cleanup #13** (through `15bc21b6`): implementation/static ownership contracts landed.
- **Battle Prep presentation #14** (`b1978918`): explicit Battle compact stylesheet, route observer cleanup and existing Battle test extension.
- **Stable Battle CTA #15** (`b63772f8`): owner-rendered Battle Start; obsolete actionbar/counters/action-cost/reparenting removed.
- **Stable Classic Journal #16** (`db42fb78`): Journal stays in `.classic-shell`; both runtime reparent paths removed.
- **Stable Skirmish actionbar #17** (`bac324a0`): final identified `REV-006` runtime reparent removed.
- **Vertical Slice deletion Stage 1** (`d46ca26e`): removed standalone browser entry/bundle/builder and two isolated browser tests after reachability proof.
- **Vertical Slice deletion Stage 2** (`5351eb77`): removed 284 unreachable files / 38,496 lines. Active closure contains no legacy `src/` stack.
- **Obsolete source DOM removal #18** (`23778724`): deprecated shortcuts/handlers/remover and matching CSS deleted.
- **Compatibility owner migration #19** (`58aac6b2`): stable Classic/Puzzle rules moved into owner CSS; `review2` and `polish-constraints` deleted.
- **Travel build ownership #20** (`60fb67c7`): Travel compact stylesheet added to production copy/output contracts.
- **Pages audit run #91** (`34330513111`, `0c4156bc`): `gate:local` PASS, production build/Stockfish/asset-cache parity PASS, Classic Chromium PASS. Responsive stopped because portrait setup incorrectly waited for a main menu that accepted portrait CSS intentionally hides. No deployment occurred.
- **Responsive test-truth #21** (`71c3f39b`): portrait setup separated from visible-menu setup; stale Classic Journal parent expectation updated to stable `.classic-shell` ownership.
- **Pages audit run #92** (`34341624633`, `71c3f39b`): `gate:local` + production build PASS, Classic Chromium PASS. Responsive then exposed a real `768×1024` RU portrait defect: root height `1024`, body scroll height `1027`.
- **Portrait containment #22** (`480ec6f3`): portrait lock makes non-lock top-level gameplay surfaces non-layout participants and constrains root/body to dynamic viewport.
- **Pages audit run #93** (`34342233234`, `480ec6f3`): `gate:local` + production build PASS, Classic Chromium PASS. Responsive passed the previously failing RU portrait geometry and progressed into landscape menu matrix; it then stopped on a stale Playwright strict-mode Language close selector. No deployment occurred.
- **Pages policy restoration #23** (`496bfac9`): audit branch removed from Pages `push.branches`; no workflow run was created for that audit push.
- **Language modal test truth #24** (`24e7414d`): responsive test clicks `[data-language-modal] .reboot-close`; Chromium rerun pending at next meaningful browser milestone.
- **Puzzle compact owner migration #25** (`d5c6f3c2`): Puzzle owner now renders compact objective/stars/reward directly, accepted compact CSS lives in explicit owner stylesheet, production packaging contract includes it, and generic post-pages runtime no longer has Puzzle/global refresh listeners.
- **Final generic presentation owner migration #26** (`286e94d7` → `bf038da0`): Settlement/Starvation/Skirmish/Endless compact rules moved to owner stylesheets; production/source contracts were updated; `post-pages-ui-polish.mjs` and `presentation-bootstrap.mjs` were physically deleted; existing owner regressions were updated to require their absence.
- **Aftermath owner migration / imports-only route #27** (`4eff6a42` → `54c96e78`): Skirmish/Battle aftermath viewport rules moved into owner compact CSS, final route CSS injection was deleted, and Battle/Skirmish existing regressions reject route presentation logic.
- **Expanded responsive truth + final Battle CSS ownership #28** (`e37f3771` → `a3ec62b8`): responsive suite explicitly covers the previous weak surfaces; Battle compact CSS loading moved from shared redesign to Battle owner; source and existing UI/Battle regressions enforce the ownership boundary. A temporary audit-only full-review push trigger at `0931aebb` produced no check run and was removed at `51464246`; therefore **no current gate/Chromium PASS is claimed**.

No full 17-contract Chromium PASS is claimed for the current head yet.

---

# Confirmed findings — current conclusions

## REV-001 — Hero Notes bootstrap ownership
Resolved.

## REV-002 — Market DOM state bus
Resolved.

## REV-003 — Resource refresh fan-out
Resolved for Resources owner. Broader app event instrumentation remains under REV-020.

## REV-004 — Whole-document localization
Still active debt. Owner-keyed migration must continue before removing the global legacy translation observer.

## REV-005 — Obsolete source DOM
Implementation complete. Current full Chromium parity remains pending.

## REV-006 — Runtime DOM reparenting
Implementation complete. Battle CTA, Classic Journal and Skirmish actionbar all have stable owner/source structure. Strengthened browser contract reflects that structure; end-to-end current Chromium proof remains pending.

## REV-007 — Pages browser gate coverage
Still open. Canonical Pages smoke has useful Classic/Responsive/Settlement coverage, but final fast-smoke vs 17-contract milestone/release split must be defined after strengthened responsive suite is actually executed green.

## REV-008 — Page-scroll test contradiction
Resolved.

## REV-009 — Global Supplies/Market retarget
Resolved.

## REV-010 — Runtime hotfix CSS fragmentation
Implementation complete. The review/polish patch chain, generic presentation runtime/bootstrap, and route CSS-in-JS aftermath patch are all removed. Compact and aftermath presentation now belongs to explicit screen owner stylesheets. Current gate/Chromium proof remains pending.

## REV-011 — Asset optimizer regression
Resolved.

## REV-012 — Stale CURRENT_STATE SHA
Deferred to final integration.

## REV-013 — Browser helper lifecycle drift
Resolved and verified in milestone #9.

## REV-014 — Exhaustive responsive proof
Implementation coverage is complete for the currently identified weak surfaces. `e37f3771` adds Classic setup, Puzzle/Training, Starvation, Endless summary and Battle aftermath to the existing RU/EN geometry suite while preserving portrait and breakpoint coverage. Current Chromium execution remains pending; failures, if any, must be fixed in owner CSS rather than by weakening geometry assertions.

## REV-015 — Persistence version policy
Resolved: fail-safe reset, no migration preservation.

## REV-016 — Puzzle build duplication
Resolved.

## REV-017 — Cloudflare / canonical deploy policy
Implementation resolved. GitHub Pages deploys on push only from `main`; audit remediation does not auto-deploy. Cloudflare remains explicit manual-only.

## REV-018 — Vertical Slice
Implementation complete. Canonical gate and production build passed on GitHub-hosted runs after deletion, including Stockfish and asset-cache parity. Full current Chromium milestone is the remaining broad verification gap.

## REV-019 — Stylesheet loading ownership
Implementation complete. Compact CSS now loads through explicit screen owners; Battle no longer depends on shared final redesign for its stylesheet. Source/static contracts enforce the final ownership model. Current build/browser proof remains pending.

## REV-020 — Broad run-updated bus
In progress. Generic post-pages listeners/schedulers are gone entirely. Remaining event graph still requires semantic narrowing and repeated-loop instrumentation.

## REV-021 — Historical documentation conflicts
Open until final documentation synchronization.

---

# UI screen/adaptation evidence matrix

Legend: **PROVEN** = direct passing evidence on an executed browser head; **PARTIAL** = useful coverage exists but latest strengthened/current architecture has not completed a full rerun; **OPEN** = explicit audit still required.

| Screen / surface | Desktop | 1024×768 | 844×390 | RU/EN | Current gap |
|---|---:|---:|---:|---:|---|
| Main menu | PARTIAL | PARTIAL | PARTIAL | PARTIAL | strengthened suite pending current rerun |
| Settings modal | PARTIAL | PARTIAL | PARTIAL | PARTIAL | current full matrix pending |
| Language modal | PARTIAL | PARTIAL | PARTIAL | PARTIAL | geometry authored; close-selector ambiguity fixed after #93 |
| Player Identity | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner-frame assertions exist; current execution pending |
| Roster | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner cleanup + stronger geometry pending full rerun |
| Chronicle | PARTIAL | PARTIAL | PARTIAL | PARTIAL | pre-scroll containment pending current rerun |
| Travel Choice | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner compact cascade + boundary sweep pending current rerun |
| Skirmish prep | PARTIAL | PARTIAL | PARTIAL | PARTIAL | stable actionbar + owner compact CSS pending full rerun |
| Skirmish combat | PROVEN board (older head) | PROVEN board (older head) | PROVEN board (older head) | PARTIAL | stable Journal/current head pending full rerun |
| Skirmish aftermath | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner aftermath CSS + frame assertions pending execution |
| Battle prep | PARTIAL | PARTIAL | PARTIAL | PARTIAL | Battle owner CSS + stable CTA pending full rerun |
| Battle combat | PROVEN board (older head) | PROVEN board (older head) | PROVEN board (older head) | PARTIAL | stable Journal/current head pending full rerun |
| Battle aftermath | PARTIAL | PARTIAL | PARTIAL | PARTIAL | explicit frame assertions now exist; pending execution |
| Settlement | PROVEN (older owner head) | PROVEN | PROVEN | PROVEN | owner compact split pending current rerun |
| Event | PARTIAL | PARTIAL | PARTIAL | PARTIAL | RU/EN page/frame sweep pending current execution |
| Starvation | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner screen/panel/internal-scroll assertions now exist; pending execution |
| Puzzle / Training | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner board/panel/internal-scroll assertions now exist; pending execution |
| Classic setup/game | PARTIAL | PARTIAL | PARTIAL | PARTIAL | setup modal ownership assertions now exist; pending execution |
| Endless summary | PARTIAL | PARTIAL | PARTIAL | PARTIAL | explicit panel/action ownership assertions now exist; pending execution |
| Portrait lock | PARTIAL current head | PARTIAL where applicable | PARTIAL | PARTIAL | RU portrait geometry passed through #93; expanded/current suite pending |

---

# Open verification items

1. **Responsive current truth:** execute the expanded `responsive-viewport-browser.cjs`; do not weaken geometry assertions to get green.
2. **Full browser milestone:** execute all 17 Chromium contracts on the current architecture. The connected GitHub tool cannot dispatch the manual workflow, and API-written push commits did not create Actions check runs, so this remains an explicit verification gap rather than an assumed PASS.
3. **Dependency security:** classify current advisories from the repository/tooling graph; temporary Playwright installation reports must not be conflated with player runtime exposure without dependency tracing.
4. **Observer/listener/event fan-out:** measure callbacks/render scheduling over repeated route loops.
5. **Leak stability:** repeat 10+ route loops and compare listener/node counts.
6. **Asset orphan inventory:** build runtime reference graph for generated assets, music/SFX and legacy masters.

---

# Autonomous remediation plan

## Phase A — restore complete test/UI truth

1. Keep the reusable geometry checker authoritative for page/frame containment.
2. Retain the portrait containment fix and corrected browser selectors.
3. **DONE:** add explicit weak-surface coverage for Classic setup, Puzzle/Training, Starvation, Endless summary and Battle aftermath (`e37f3771`).
4. Execute RU/EN matrices at desktop, `1024×768`, `844×390`, `1180/980` boundaries and portrait lock when a runnable current-head browser gate is available.
5. Run full 17-contract Chromium at the next executable milestone.

## Phase B — finish presentation/source ownership

6. **DONE:** Puzzle compact DOM/data ownership moved into `puzzle-app.mjs`; accepted compact styling is owner-loaded in `puzzles-compact.css`; generic Puzzle runtime refresh path removed (`d5c6f3c2`).
7. **DONE:** Settlement, Starvation, Skirmish and Endless compact compatibility rules moved into explicit owner stylesheets and production packaging contracts.
8. **DONE:** `post-pages-ui-polish.mjs` and `presentation-bootstrap.mjs` deleted; route/build/source-verifier and existing owner tests require their absence.
9. **DONE:** Skirmish/Battle aftermath presentation CSS moved out of `battle-route.mjs`; route is imports-only (`ad37fba5`).
10. **DONE:** Battle compact stylesheet loading moved from shared redesign into Battle owner (`54aa9228`, `d7827fd1`); static/source contracts prevent regression.

## Phase C — localization/event lifecycle

11. Continue owner-keyed localization: Roster → Travel → Starvation → Events/Puzzles → Battle/Skirmish → remaining active surfaces.
12. Remove each screen’s legacy translation reliance after RU/EN parity proof.
13. Delete the whole-document legacy localization observer after all active owners are keyed.
14. Map `rpchess:*` events and narrow broad `run-updated` fan-out.
15. Instrument 10+ route loops and prove stable callback/render/node counts.

## Phase D — persistence/tooling/legacy cleanup

16. Retain verified unsupported-schema reset policy.
17. Complete dependency security classification.
18. Generate asset orphan/reference inventory and remove only proven-unused assets.
19. Retain Vertical Slice non-return source contract; application/runtime/test deletion is complete.
20. Keep Cloudflare manual-only; GitHub Pages remains canonical and audit commits do not auto-deploy.

## Phase E — validation/integration

21. Use minimum sufficient targeted tests during each cleanup package.
22. Run complete Chromium matrix at meaningful architecture milestones rather than after every small commit.
23. Before integration run complete browser matrix, canonical Pages gate and representative manual playthrough.
24. Do not merge to `main` without explicit owner instruction.

## Phase F — final documentation synchronization

25. Update `docs/CURRENT_STATE.md` to final accepted production SHA.
26. Add current-contract headers to feature docs and clearly mark historical rules.
27. Synchronize final architecture/UI/persistence/deployment state into Notion.
28. Add final architecture ownership note covering navigation, persistence, resources, localization, responsive layout, assets and deployment gates.

---

# Current simplification order

1. Finish owner-keyed localization and delete global legacy observation.
2. Reduce event/render fan-out and prove no leaks.
3. Complete dependency and asset cleanup; retain Vertical Slice non-return contract.
4. Execute current expanded RU/EN all-screen matrix + all 17 Chromium contracts when the gate can be dispatched/run.
5. Synchronize final documentation and only then prepare integration.

## Next actions

1. Migrate Roster and Travel to semantic owner-level `t(key, params)` copy, extending existing localization/owner regressions rather than adding parallel suites.
2. Migrate Starvation, then Puzzle/Event presentation copy to keyed owners while preserving gameplay IDs/effects and existing event presentation layers.
3. Migrate Battle/Skirmish and remaining active surfaces, then remove each owner’s dependency on document-wide localization.
4. Delete the whole-document localization observer only after all active owner contracts are keyed and RU/EN parity can be proved.
5. Map and narrow remaining `rpchess:run-updated` fan-out, then instrument 10+ route loops for listener/render/node stability.
6. Complete dependency classification and asset orphan inventory before final integration.
7. Execute expanded responsive coverage, all 17 Chromium contracts and `gate:local` at the first available current-head execution path; update statuses only from actual results.
8. Update `CURRENT_STATE.md` only after the final accepted remediation SHA and full gate are available; keep `main` frozen and Cloudflare manual-only until explicit owner direction changes either constraint.

Every subsequent remediation report must update this tracker and end with a concrete numbered **Next actions** list.
