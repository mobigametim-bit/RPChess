# RPChess — Full Project Review Report

**Audit status:** REMEDIATION IN PROGRESS  
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit/remediation branch:** `audit/full-project-review-2026-09-08`  
**Current remediation code head:** `24e7414d698411a9b0f22db090a38c1a8075f79e`  
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
| REV-001 Hero Notes owns unrelated UI patch chain | **DONE — verified** | `hero-notes-runtime.mjs` deleted. Roster/Settlement render Hero Notes directly; remaining temporary presentation duties are isolated behind the explicit presentation bootstrap. |
| REV-002 Market reads state back from DOM | **DONE — verified** | Settlement renders Market from `activeRun.currentSettlement` / `SETTLEMENT_SUPPLY_PRICE`; `post-pages-ui-review4.mjs` deleted. |
| REV-003 Resources render fan-out | **DONE — verified** | Resources subtree `MutationObserver` and global click refresh removed; one coalescing scheduler consumes semantic events. |
| REV-004 whole-document legacy localization | **IN PROGRESS** | Settlement/Resources render keyed `t(...)` copy directly. Remaining active screens must migrate before the global legacy observer can be deleted. |
| REV-005 obsolete source controls / hidden DOM | **DONE — verification pending** | Obsolete Skirmish/Battle/Puzzle/Event shortcuts and dead handlers are deleted from their owners; Settlement already no longer authored its old shortcuts. The shared seven-selector post-render `.remove()` cleanup and dead compatibility CSS are gone (`23778724`). Current `gate:local` passes; full/current Chromium parity remains pending. |
| REV-006 runtime DOM reparenting | **DONE — verification pending** | All three identified live-layout reparent paths are removed: Battle Start CTA is owner-rendered directly in `.battle-army` (`b63772f8`); Classic Journal remains in its source `.classic-shell` slot (`db42fb78`); Skirmish actionbar remains in `.skirmish-shell` (`bac324a0`). Current deterministic gate passes; strengthened Chromium contract is corrected but not yet completed end-to-end. |
| REV-007 canonical Pages gate covers only a smoke subset | **OPEN** | Pages smoke currently runs Classic + Responsive + Settlement. Final fast-smoke vs full 17-contract milestone/release split remains to be defined after current responsive truth is fully green. |
| REV-008 stale browser contract requires page scroll | **DONE — verified** | Foundation/Roster contracts enforce one-screen behavior rather than requiring page scrolling. |
| REV-009 Supplies/Market global image retargeting | **DONE — verified** | True owners render Supplies/Market art directly; global retarget scanner and `supplies-resource-icon.mjs` deleted. |
| REV-010 fragmented runtime hotfix CSS | **IN PROGRESS** | review2/3/4/5/6/7 and `polish-constraints` are deleted; stable Classic/Puzzle rules moved to owner CSS. Remaining `post-pages-ui-polish.mjs` still owns post-render Puzzle duplication plus Settlement/Starvation/Skirmish/Endless compatibility CSS. Aftermath compatibility CSS also remains in `battle-route.mjs`. |
| REV-011 Supplies optimizer makes asset larger | **DONE — verified** | Optimizer keeps original bytes when transformed output is larger while still enforcing budgets. |
| REV-012 stale CURRENT_STATE SHA | **OPEN** | Deferred intentionally until the final accepted remediation SHA. |
| REV-013 shared browser helper lifecycle drift | **DONE — verified** | `startNewRun()` waits for visible scenes and emits diagnostics; full milestone #9 passed 17/17. |
| REV-014 responsive gate does not prove one-screen for every screen | **IN PROGRESS** | Reusable pre-scroll geometry assertions reject page/viewport/frame escapes. RU/EN + 1180/980 matrices exist. Portrait contract was corrected and a real 3px body overflow was fixed (`480ec6f3`); run #93 proved the RU portrait cases progressed past geometry. Remaining matrix surfaces/current end-to-end Chromium proof are pending. |
| REV-015 persistence has no migration path | **DONE — verified** | Unsupported schema versions are explicitly deleted/reset by `readRun()`; no backward-save migration is required by owner decision. |
| REV-016 repeated puzzle materialization / duplicate build inputs | **DONE — verified** | Puzzle catalog materializes once per gate path; duplicate Endless build inputs removed. |
| REV-017 generic Wrangler deploy path looks canonical | **DONE — docs pending** | Generic `npm run deploy` removed. Cloudflare remains explicit manual `deploy:cloudflare`; GitHub Pages is canonical. Temporary audit Pages push trigger used for runs #91–#93 was removed again in `496bfac9`; audit remediation commits no longer auto-deploy Pages. |
| REV-018 legacy Vertical Slice stack | **DONE — verification pending** | Stage 1 removed standalone Vertical Slice browser entry/bundle/builder/tests (`d46ca26e`). Stage 2 removed unreachable `src/` domain/runtime/test stack (`5351eb77`). Current canonical `gate:local`, production build, Stockfish packaging and asset-cache parity pass on runs #91–#93; full 17-contract Chromium milestone remains pending. |
| REV-019 CSS loading split between HTML and runtime JS | **IN PROGRESS** | Travel/Battle compact presentation use explicit owner stylesheets and Travel compact CSS is packaged (`60fb67c7`). Final load order remains split while compatibility runtime modules still exist. |
| REV-020 `rpchess:run-updated` is overly broad bus | **IN PROGRESS** | Resources consumes semantic scene/settlement updates; Travel compatibility fan-out was removed. `post-pages-ui-polish.mjs` still subscribes broadly for Puzzle cosmetics and must disappear with owner migration. |
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
- The final prior Puzzle width constraint lives in `puzzles.css`; the old constraints runtime injector is deleted.
- Skirmish actionbar remains in its source `.skirmish-shell` slot; shared redesign no longer stores home/next references.
- Obsolete Skirmish/Battle/Puzzle/Event navigation shortcuts are absent at source; shared post-render control removal is deleted.
- Responsive test setup now distinguishes a portrait document from a visible landscape menu (`71c3f39b`), and its Classic Journal assertion matches the stable owner structure.
- Portrait orientation lock now excludes the hidden gameplay root from layout instead of leaving a `100vh` invisible box contributing to `body.scrollHeight` (`480ec6f3`).
- Language-modal browser interaction now targets the explicit `reboot-close` control instead of an ambiguous shared `data-close-modal` hook (`24e7414d`).

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

Remaining temporary presentation layer:

- `post-pages-ui-polish.mjs` — post-render Puzzle objective/reward duplication plus Settlement/Starvation/Skirmish/Endless compatibility presentation. It must be emptied into true owners and deleted.
- `presentation-bootstrap.mjs` — currently exists only to load the remaining compatibility module; delete it when that module is empty.

## Build / persistence / assets / deployment

- Supplies optimizer keeps the smaller source file.
- Puzzle build/materialization work is deduplicated.
- Unsupported run schema resets safely; old save compatibility is intentionally not maintained.
- `battle-compact.css` and `travel-choice-compact.css` are explicit production build inputs.
- Vertical Slice browser entry, generated Iron Marches bundle/builder, `src/` application/domain/runtime stack, isolated previews/workflows and dormant tests are deleted; source verification blocks their return.
- Current GitHub-hosted runs #91–#93 prove `npm run gate:local`, the Reboot production build with Stockfish 18.0.0 and runtime asset-cache parity on the remediated architecture.
- The temporary audit-branch Pages push trigger added by `0c4156bc` was removed in `496bfac9`. Pages again auto-deploys only from `main`; PR/manual verification remains available without changing that production policy.
- Cloudflare remains manual-only and was not deployed.

---

# Verification history

`Full Project Review Runtime Gate` / audit workflows remain explicit milestone tools. Separately, the canonical Pages workflow was temporarily allowed to run on the audit branch for runs #91–#93, then restored to `main`-only push deployment in `496bfac9`.

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
- **Portrait containment #22** (`480ec6f3`): portrait lock makes non-lock top-level gameplay surfaces non-layout participants and constrains root/body to the dynamic viewport.
- **Pages audit run #93** (`34342233234`, `480ec6f3`): `gate:local` + production build PASS, Classic Chromium PASS. Responsive passed the previously failing RU portrait geometry and progressed into the landscape menu matrix; it then stopped on a stale Playwright strict-mode selector because Language modal legitimately has two `data-close-modal` controls. No deployment occurred.
- **Pages policy restoration #23** (`496bfac9`): audit branch removed from Pages `push.branches`; GitHub confirmed no workflow run was created for that audit push.
- **Language modal test truth #24** (`24e7414d`): responsive test now clicks `[data-language-modal] .reboot-close`; Chromium rerun pending at the next meaningful browser milestone.

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
Implementation complete. Current deterministic/canonical gate passes. Current full Chromium parity remains pending.

## REV-006 — Runtime DOM reparenting
Implementation complete. Battle CTA, Classic Journal and Skirmish actionbar all have stable owner/source structure. Strengthened browser contract now reflects that structure; end-to-end current Chromium proof remains pending.

## REV-007 — Pages browser gate coverage
Still open. Canonical Pages smoke has useful Classic/Responsive/Settlement coverage, but the final fast-smoke vs 17-contract milestone/release split must be defined after the strengthened responsive suite is fully green.

## REV-008 — Page-scroll test contradiction
Resolved.

## REV-009 — Global Supplies/Market retarget
Resolved.

## REV-010 — Runtime hotfix CSS fragmentation
Significantly reduced but open. The next root-cause package is Puzzle: remove duplicate post-render objective/reward DOM and move its remaining compact presentation into `puzzle-app.mjs` / `puzzles.css`. Then migrate Settlement/Starvation/Skirmish/Endless rules and delete `post-pages-ui-polish.mjs` / `presentation-bootstrap.mjs` when empty.

## REV-011 — Asset optimizer regression
Resolved.

## REV-012 — Stale CURRENT_STATE SHA
Deferred to final integration.

## REV-013 — Browser helper lifecycle drift
Resolved and verified in milestone #9.

## REV-014 — Exhaustive responsive proof
In progress. The strengthened suite now distinguishes portrait-lock setup correctly and the real body overflow it exposed is fixed. Run #93 proved the RU portrait geometry progressed past the previous failure. A test-selector ambiguity was corrected afterward; full current matrix still requires execution.

## REV-015 — Persistence version policy
Resolved: fail-safe reset, no migration preservation.

## REV-016 — Puzzle build duplication
Resolved.

## REV-017 — Cloudflare / canonical deploy policy
Implementation resolved. GitHub Pages is canonical and again deploys on push only from `main`; audit remediation no longer auto-deploys. Cloudflare remains explicit manual-only.

## REV-018 — Vertical Slice
Implementation complete. Current canonical gate and production build now pass on GitHub-hosted runs after the deletion, including Stockfish and asset-cache parity. Full current Chromium milestone is the remaining broad verification gap.

## REV-019 — Stylesheet loading ownership
Improving. Owner-specific Travel/Battle files are packaged, but final production ordering remains split across HTML/runtime loaders while compatibility modules remain.

## REV-020 — Broad run-updated bus
In progress. Removing Puzzle from `post-pages-ui-polish.mjs` will also eliminate one unnecessary broad `run-updated` consumer plus its global capture-click refresh.

## REV-021 — Historical documentation conflicts
Open until final documentation synchronization.

---

# UI screen/adaptation evidence matrix

Legend: **PROVEN** = direct passing evidence on an executed browser head; **PARTIAL** = useful coverage exists but latest strengthened/current architecture has not completed a full rerun; **OPEN** = explicit audit still required.

| Screen / surface | Desktop | 1024×768 | 844×390 | RU/EN | Current gap |
|---|---:|---:|---:|---:|---|
| Main menu | PARTIAL | PARTIAL | PARTIAL | PARTIAL | strengthened suite selector fix pending rerun |
| Settings modal | PARTIAL | PARTIAL | PARTIAL | PARTIAL | current full matrix pending |
| Language modal | PARTIAL | PARTIAL | PARTIAL | PARTIAL | geometry authored; close-selector ambiguity fixed after #93 |
| Player Identity | OPEN | OPEN | OPEN | PARTIAL | owner-frame contract pending full browser proof |
| Roster | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner cleanup + stronger geometry pending full rerun |
| Chronicle | PARTIAL | PARTIAL | PARTIAL | PARTIAL | pre-scroll containment pending full rerun |
| Travel Choice | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner compact cascade + boundary sweep pending full rerun |
| Skirmish prep | PARTIAL | PARTIAL | PARTIAL | PARTIAL | stable actionbar architecture pending full rerun |
| Skirmish combat | PROVEN board (older head) | PROVEN board (older head) | PROVEN board (older head) | PARTIAL | stable Journal/current head pending full rerun |
| Skirmish aftermath | PARTIAL | PARTIAL | PARTIAL | PARTIAL | explicit current-head frame sweep pending |
| Battle prep | PARTIAL | PARTIAL | PARTIAL | PARTIAL | Battle owner CSS + stable CTA pending full rerun |
| Battle combat | PROVEN board (older head) | PROVEN board (older head) | PROVEN board (older head) | PARTIAL | stable Journal/current head pending full rerun |
| Battle aftermath | PARTIAL | PARTIAL | PARTIAL | PARTIAL | explicit frame matrix pending |
| Settlement | PROVEN (older owner head) | PROVEN | PROVEN | PROVEN | rerun after later shared cleanup |
| Event | PARTIAL | PARTIAL | PARTIAL | PARTIAL | RU/EN page/frame sweep pending |
| Starvation | PARTIAL | PARTIAL | PARTIAL | PARTIAL | geometry matrix pending |
| Puzzle / Training | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner/compat cleanup + board/panel matrix pending |
| Classic setup/game | PARTIAL | PARTIAL | PARTIAL | PARTIAL | setup modal + stable Journal matrix pending |
| Endless summary | OPEN | OPEN | OPEN | PARTIAL | explicit one-screen/internal-overflow audit pending |
| Portrait lock | PARTIAL current head | PARTIAL where applicable | PARTIAL | PARTIAL | RU portrait geometry passed through #93; EN/full suite pending |

---

# Open verification items

1. **Responsive current truth:** rerun corrected `responsive-viewport-browser.cjs` after `24e7414d`; do not weaken geometry assertions to get green.
2. **Full browser milestone:** run all 17 Chromium contracts after the remaining presentation compatibility layer is removed or at the next equivalent architecture checkpoint.
3. **Dependency security:** classify the current advisories from the repository/tooling graph; note that temporary Playwright installation in Pages logs reports five highs but must not be conflated with player runtime exposure without dependency tracing.
4. **Observer/listener/event fan-out:** measure callbacks/render scheduling over repeated route loops.
5. **Leak stability:** repeat 10+ route loops and compare listener/node counts.
6. **Asset orphan inventory:** build runtime reference graph for generated assets, music/SFX and legacy masters.
7. **Responsive weak surfaces:** Battle aftermath, Starvation, Puzzle/Training, Classic setup and Endless summary need explicit frame coverage.

---

# Autonomous remediation plan

## Phase A — restore complete test/UI truth

1. Keep the reusable geometry checker authoritative for page/frame containment.
2. Retain the portrait containment fix; the strengthened browser selector has been corrected and awaits the next execution milestone.
3. Finish explicit weak-surface coverage.
4. Execute RU/EN matrices at desktop, `1024×768`, `844×390`, `1180/980` boundaries and portrait lock.
5. Run full 17-contract Chromium at the next meaningful architecture milestone.

## Phase B — finish presentation/source ownership

6. Move Puzzle post-render objective/reward creation from `post-pages-ui-polish.mjs` into `puzzle-app.mjs` owner markup/rendering and move its compact CSS into `puzzles.css`.
7. Move Settlement, Starvation, Skirmish and Endless compatibility rules into their owner stylesheets.
8. Delete `post-pages-ui-polish.mjs` when empty, then delete `presentation-bootstrap.mjs` and remove both from build/source contracts.
9. Move the remaining aftermath presentation CSS out of `battle-route.mjs`. **The duplicate hidden-attribute `MutationObserver` is already removed and must not be listed as future work again.**
10. Obsolete source controls/shared removal are already deleted under REV-005; retain the no-return contracts rather than repeating the cleanup.
11. Consolidate final stylesheet load order and ownership.

## Phase C — localization/event lifecycle

12. Continue owner-keyed localization: Roster → Travel → Starvation → Events/Puzzles → Battle/Skirmish → remaining active surfaces.
13. Remove each screen’s legacy translation reliance after RU/EN parity proof.
14. Delete the whole-document legacy localization observer after all active owners are keyed.
15. Map `rpchess:*` events and narrow broad `run-updated` fan-out.
16. Instrument 10+ route loops and prove stable callback/render/node counts.

## Phase D — persistence/tooling/legacy cleanup

17. Retain the verified unsupported-schema reset policy.
18. Complete dependency security classification.
19. Generate asset orphan/reference inventory and remove only proven-unused assets.
20. Retain the Vertical Slice non-return source contract; application/runtime/test deletion is complete.
21. Keep Cloudflare manual-only; GitHub Pages remains canonical and audit commits do not auto-deploy.

## Phase E — validation/integration

22. Use minimum sufficient targeted tests during each cleanup package.
23. Run complete Chromium matrix at meaningful architecture milestones rather than after every small commit.
24. Before integration run complete browser matrix, canonical Pages gate and a representative manual playthrough.
25. Do not merge to `main` without explicit owner instruction.

## Phase F — final documentation synchronization

26. Update `docs/CURRENT_STATE.md` to the final accepted production SHA.
27. Add current-contract headers to feature docs and clearly mark historical rules.
28. Synchronize final architecture/UI/persistence/deployment state into Notion.
29. Add final architecture ownership note covering navigation, persistence, resources, localization, responsive layout, assets and deployment gates.

---

# Current simplification order

1. Finish compatibility presentation ownership and delete the final patch/bootstrap modules.
2. Finish exhaustive geometry truth and rerun current architecture.
3. Finish keyed localization and delete global legacy observation.
4. Reduce event/render fan-out and prove no leaks.
5. Complete dependency and asset cleanup; retain Vertical Slice non-return contract.
6. Run final RU/EN all-screen matrix + Pages gate.
7. Synchronize final documentation and only then prepare integration.

## Next actions

1. Move Puzzle compact objective/reward presentation into `puzzle-app.mjs` / `puzzles.css`; remove Puzzle DOM duplication and broad refresh hooks from `post-pages-ui-polish.mjs`, extending the existing Puzzle regression only.
2. Move Settlement, Starvation, Skirmish and Endless compatibility CSS into their owner stylesheets; delete `post-pages-ui-polish.mjs` when empty.
3. Delete `presentation-bootstrap.mjs` once it has no imports and remove both compatibility modules from `battle-route`, build and source-verifier contracts.
4. Move the remaining aftermath CSS out of `battle-route.mjs`; do not reintroduce the already removed observer.
5. Consolidate final stylesheet order after runtime compatibility loading is gone.
6. Extend geometry coverage to Battle aftermath, Starvation, Puzzle/Training, Classic setup and Endless summary, retaining the corrected portrait-lock contract.
7. At the next meaningful architecture milestone run corrected responsive coverage plus all 17 Chromium contracts and `gate:local`; update evidence only from actual results.
8. Continue owner-keyed localization and event-bus narrowing after presentation ownership stabilizes.
9. Complete dependency classification and asset orphan inventory before final integration.
10. Update `CURRENT_STATE.md` only after the final accepted remediation SHA and full gate are available; keep `main` frozen and Cloudflare manual-only until explicit owner direction changes either constraint.

Every subsequent remediation report must update this tracker and end with a concrete numbered **Next actions** list.
