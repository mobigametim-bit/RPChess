# RPChess — Full Project Review Report

**Audit status:** REMEDIATION IN PROGRESS  
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit/remediation branch:** `audit/full-project-review-2026-09-08`  
**Current remediation head:** `df6d35bc8f884c66c185f5ef5496930f1b0a3004`
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
| REV-001 Hero Notes owns unrelated UI patch chain | **DONE — verified** | `hero-notes-runtime.mjs` deleted. Roster/Settlement render Hero Notes directly; remaining temporary presentation modules load explicitly through `presentation-bootstrap.mjs`. |
| REV-002 Market reads state back from DOM | **DONE — verified** | Settlement renders Market from `activeRun.currentSettlement` / `SETTLEMENT_SUPPLY_PRICE`; `post-pages-ui-review4.mjs` deleted. |
| REV-003 Resources render fan-out | **DONE — verified** | Resources subtree `MutationObserver` and global click refresh removed; one coalescing scheduler consumes semantic events. |
| REV-004 whole-document legacy localization | **IN PROGRESS** | Settlement/Resources render keyed `t(...)` copy directly. Remaining active screens must migrate before the global legacy observer can be deleted. |
| REV-005 obsolete source controls / hidden DOM | **DONE — verification pending** | Obsolete Skirmish/Battle/Puzzle/Event shortcuts and dead handlers are deleted from their owners; Settlement already no longer authored its old shortcuts. The shared seven-selector post-render `.remove()` cleanup and dead compatibility CSS are gone (`df6d35bc`). Deterministic owner/UI contracts pass; Chromium proof remains pending. |
| REV-006 runtime DOM reparenting | **DONE — verification pending** | All three identified live-layout reparent paths are removed: Battle Start CTA is owner-rendered directly in `.battle-army` (`b63772f8`); Classic Journal remains in its source `.classic-shell` slot and run-combat styling targets stable siblings (`db42fb78`); Skirmish actionbar remains in its source `.skirmish-shell` slot with no home/next/append lifecycle (`bac324a0`). Existing tests were strengthened; Chromium/local gate still pending. |
| REV-007 canonical Pages gate covers 3/17 browser contracts | **OPEN** | After current test truth is verified, define fast mandatory PR smoke coverage plus a broader milestone/full-release gate. |
| REV-008 stale browser contract requires page scroll | **DONE — verified** | Foundation/Roster contracts now enforce one-screen behavior rather than requiring page scrolling. |
| REV-009 Supplies/Market global image retargeting | **DONE — verified** | True owners render Supplies/Market art directly; global retarget scanner and `supplies-resource-icon.mjs` deleted. |
| REV-010 fragmented runtime hotfix CSS | **IN PROGRESS** | review3/4/5/6/7 are deleted; Training, Roster, Travel and Battle Prep ownership has been consolidated. `review2` now contains only temporary run-combat presentation for stable Classic siblings; `polish-constraints` is reduced to a Puzzle width rule. Remaining `post-pages-ui-polish`, aftermath route styles, Skirmish/Settlement/Puzzle/Endless compatibility rules must move to owners. |
| REV-011 Supplies optimizer makes asset larger | **DONE — verified** | Optimizer keeps original bytes when transformed output is larger while still enforcing budgets. |
| REV-012 stale CURRENT_STATE SHA | **OPEN** | Deferred intentionally until the final accepted remediation SHA. |
| REV-013 shared browser helper lifecycle drift | **DONE — verified** | `startNewRun()` waits for visible scenes and emits diagnostics; full milestone #9 passed 17/17. |
| REV-014 responsive gate does not prove one-screen for every screen | **IN PROGRESS** | Reusable pre-scroll geometry assertions now reject page overflow/viewport escapes/frame escapes. RU/EN and `1180`/`980` boundaries are authored; remaining weak surfaces and browser verification are pending. |
| REV-015 persistence has no migration path | **DONE — verified** | Unsupported schema versions are explicitly deleted/reset by `readRun()`; no backward-save migration is required by owner decision. |
| REV-016 repeated puzzle materialization / duplicate build inputs | **DONE — verified** | Puzzle catalog materializes once per gate path; duplicate Endless build inputs removed. |
| REV-017 generic Wrangler deploy path looks canonical | **DONE — docs pending** | Generic `npm run deploy` removed. Cloudflare remains explicit manual `deploy:cloudflare`; GitHub Pages is canonical. |
| REV-018 legacy Vertical Slice stack | **DONE — verification pending** | Stage 1 removed the standalone browser entry/bundle/builder and its isolated tests (`a250a4f7`). Stage 2 removed the unreachable `src/` domain/runtime stack, dormant tests, previews, wards and unbuilt presentation files (`3db16021`). The 74-entrypoint / 81-file live closure contains no `src/`; deterministic verification passes. Full build/Chromium milestone proof is still pending. |
| REV-019 CSS loading split between HTML and runtime JS | **IN PROGRESS** | Travel and Battle compact presentation now use explicit stylesheet files included in production. Battle structural reparenting no longer justifies shared presentation ownership; final explicit stylesheet order still requires consolidation after compatibility modules are removed. |
| REV-020 `rpchess:run-updated` is overly broad bus | **IN PROGRESS** | Resources consumes semantic scene/settlement updates; Travel compatibility fan-out was removed. Broader event graph still needs narrowing. |
| REV-021 historical docs conflict with current UI/deploy rules | **OPEN** | Final docs sync will add current-contract headers and retain history only as clearly marked history. |

---

# Remediation changes landed

## Ownership / presentation

- Browser lifecycle helper now waits for visible target scenes and emits diagnostics.
- Foundation/Roster stale page-scroll contracts were removed.
- Settlement owns Market row/state, Market art and keyed copy.
- Resources owns Supplies HUD rendering, keyed copy and a single semantic scheduler.
- Roster and Settlement own Hero Notes directly.
- Travel owns its king portrait and explicit compact stylesheet; Travel selectors/fan-out were removed from generic post-pages layers.
- Battle Prep accepted compact geometry moved out of `battle-route` / review / constraints / polish into explicit `battle-compact.css` and is packaged in production.
- Battle Prep duplicate hidden-state observer in `battle-route.mjs` was removed.
- Battle Start CTA is rendered directly in `.battle-army`; obsolete hidden `.battle-actionbar`, counters, action-cost generation and Start reparent/restore logic were removed.
- Classic run-combat Journal no longer moves into `.classic-party-panel`; it remains a stable sibling in `.classic-shell`. `ui-redesign-final` and `post-pages-ui-polish` no longer keep Classic home references or append/restore paths.
- `post-pages-ui-polish-constraints` no longer keeps the unused `post-pages-run-combat-active` lifecycle state/listeners.
- Skirmish actionbar no longer moves into `.skirmish-selection`; it stays in its source `.skirmish-shell` slot. Shared redesign no longer stores actionbar home/next references.
- Obsolete Skirmish/Battle/Puzzle/Event navigation shortcuts are absent at source; the shared post-render control remover and its dead CSS selectors are deleted.

## Deleted/superseded layers

Deleted:

- `hero-notes-runtime.mjs`
- `post-pages-ui-review3.mjs`
- `post-pages-ui-review4.mjs`
- `post-pages-ui-review5.mjs`
- `post-pages-ui-review6.mjs`
- `post-pages-ui-review7.mjs`
- `supplies-resource-icon.mjs`

Remaining temporary presentation modules are explicit and must continue shrinking:

- `post-pages-ui-review2.mjs` — run-combat CSS only, now using stable sibling selectors.
- `post-pages-ui-polish-constraints.mjs` — Puzzle width constraint only.
- `post-pages-ui-polish.mjs` — Puzzle plus remaining Settlement/Starvation/Skirmish/Endless compatibility duties.

## Build / persistence / assets

- Supplies optimizer keeps the smaller source file.
- Puzzle build/materialization work is deduplicated.
- Cloudflare command is manual-only.
- Unsupported run schema resets safely; old save compatibility is intentionally not maintained.
- `battle-compact.css` is part of the explicit production build output.
- The legacy Vertical Slice browser entry, generated Iron Marches bundle/builder, `src/` application/domain/runtime stack, isolated previews/workflows and dormant tests are deleted. `verify-source` now rejects restoration of the legacy entry or stack.

---

# Verification history

The audit workflows are **manual-dispatch only** and never deploy. The current connector does not expose workflow dispatch, so no new Chromium/local-gate PASS is claimed for heads after the last manually executed gates.

- **Full Project Review #7** (`34257582147`, `b0d6b001`): 16/17 Chromium contracts PASS; Settlement failed due compatibility `background` shorthand erasing owner Market art.
- Root cause fixed by preserving owner background image and limiting compatibility declaration to `background-color`.
- **Full Project Review #8** (`34262502407`, `d5820573`): canonical local gate PASS, **17/17 Chromium PASS**, zero failures.
- **Full Project Review #9** (`34265688360`, `b63726eb`): canonical local gate PASS, **17/17 Chromium PASS**, zero failures after review3/5/6/7 deletion and owner migration.
- **Targeted owner-migration #10** (`34266676368`, `8e7c4675`): local gate PASS; Classic/Settlement/Puzzles 3/3 PASS.
- **Save-schema #11** (`34267715267`, `2ced5f67`): local gate and persistence regression PASS.
- **Geometry contract #12** (`6888beb2`): geometry/static contract authored; Chromium verification pending.
- **Roster/Travel owner cleanup #13** (through `15bc21b6`): implementation/static ownership contracts landed; Chromium/local verification pending.
- **Battle Prep presentation #14** (`b1978918`): explicit Battle compact stylesheet, route observer cleanup and existing Battle test extension; verification pending.
- **Stable Battle CTA #15** (`b63772f8`): Battle owner renders Start directly in `.battle-army`; obsolete actionbar/counters/action-cost and CTA reparenting removed; existing deterministic/browser contracts updated; verification pending.
- **Stable Classic Journal #16** (`db42fb78`): Classic Journal remains in `.classic-shell`; both runtime reparent paths removed; dead constraints combat lifecycle removed; existing Classic static contract strengthened; verification pending.
- **Stable Skirmish actionbar #17** (`bac324a0`): last identified `REV-006` runtime reparent removed; existing Skirmish deterministic contract strengthened; verification pending.
- **Vertical Slice deletion Stage 1** (`a250a4f7`): removed the standalone `vertical-slice.html` browser entry, generated Iron Marches bundle/builder and two isolated browser tests after package/runner/workflow reachability proof.
- **Vertical Slice deletion Stage 2** (`3db16021`): removed 284 unreachable files / 38,496 lines. The active graph contains 74 entrypoints and 81 reachable code/test files, no `src/`, and no dormant top-level tests. `verify`, all deterministic/domain tests, content validation and the 11,498-puzzle catalog validation pass. Build packaging reached a clean Reboot `dist` with no legacy runtime; final Stockfish download was blocked by the execution environment's external-network cancellation, so no full local-gate or Chromium PASS is claimed for this head.
- **Obsolete source DOM removal #18** (`df6d35bc`): removed the remaining deprecated scene shortcuts, dead handlers, seven-selector runtime remover and matching compatibility CSS. `verify`, syntax checks and the UI/Skirmish/Battle/Settlement/Events/Puzzles owner tests pass; Chromium verification pending.

---

# Confirmed findings — current conclusions

## REV-001 — Hero Notes bootstrap ownership
Resolved. Hero Notes no longer loads unrelated global UI patch chains.

## REV-002 — Market DOM state bus
Resolved. Settlement state is authoritative; no DOM read-back renderer remains.

## REV-003 — Resource refresh fan-out
Resolved for Resources owner. Broader app event instrumentation remains under REV-020.

## REV-004 — Whole-document localization
Still active debt. Owner-keyed migration must continue before removing the global legacy translation observer.

## REV-005 — Obsolete source DOM
Implementation complete. Battle's hidden actionbar and the remaining deprecated Skirmish/Battle/Puzzle/Event shortcuts are deleted at source; Settlement already authored none of its old shortcuts. No shared post-render `.remove()` cleanup or dead selector-based hiding remains. Current-head Chromium verification is pending.

## REV-006 — Runtime DOM reparenting
Implementation complete on the current head. The three identified paths (Battle CTA, Classic Journal, Skirmish actionbar) now have stable source/owner structure. Browser parity proof is still required.

## REV-007 — Pages browser gate coverage
Still open. Final gate split must be based on verified current test truth.

## REV-008 — Page-scroll test contradiction
Resolved.

## REV-009 — Global Supplies/Market retarget
Resolved.

## REV-010 — Runtime hotfix CSS fragmentation
Significantly reduced but still open. The next target is to delete `review2` and `polish-constraints` after their last rules are absorbed by screen owners, then shrink `post-pages-ui-polish`.

## REV-011 — Asset optimizer regression
Resolved.

## REV-012 — Stale CURRENT_STATE SHA
Deferred to final integration.

## REV-013 — Browser helper lifecycle drift
Resolved and verified in milestone #9.

## REV-014 — Exhaustive responsive proof
In progress. Geometry helper and stronger RU/EN/boundary matrix exist; weak surfaces still need explicit coverage and Chromium execution.

## REV-015 — Persistence version policy
Resolved: fail-safe reset, no migration preservation.

## REV-016 — Puzzle build duplication
Resolved.

## REV-017 — Cloudflare deploy ambiguity
Implementation resolved; documentation cleanup remains. No Cloudflare deploy occurs unless explicitly requested by the project owner.

## REV-018 — Vertical Slice
Implementation complete. Both the standalone browser stack and the remaining unreachable legacy application/domain/runtime stack are deleted. Source verification prevents the entry, builder and stack anchors from returning. A current-head full build and Chromium milestone remain the only verification gap.

## REV-019 — Stylesheet loading ownership
Improving. Owner-specific Travel/Battle files exist, but final production ordering remains split across HTML and runtime loaders.

## REV-020 — Broad run-updated bus
In progress; further semantic narrowing and loop instrumentation required.

## REV-021 — Historical documentation conflicts
Open until final documentation synchronization.

---

# UI screen/adaptation evidence matrix

Legend: **PROVEN** = direct passing evidence on an executed browser head; **PARTIAL** = useful coverage exists but latest strengthened/current architecture has not been fully rerun; **OPEN** = explicit audit still required.

| Screen / surface | Desktop | 1024×768 | 844×390 | RU/EN | Current gap |
|---|---:|---:|---:|---:|---|
| Main menu | PARTIAL | PARTIAL | PARTIAL | PARTIAL | strengthened pre-scroll contract pending rerun |
| Settings modal | PARTIAL | PARTIAL | PARTIAL | PARTIAL | frame contract pending rerun |
| Language modal | OPEN | OPEN | OPEN | OPEN | authored RU/EN geometry pending browser proof |
| Player Identity | OPEN | OPEN | OPEN | PARTIAL | owner-frame contract pending browser proof |
| Roster | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner cleanup + stronger geometry pending rerun |
| Chronicle | PARTIAL | PARTIAL | PARTIAL | PARTIAL | pre-scroll containment pending rerun |
| Travel Choice | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner compact cascade + boundary sweep pending rerun |
| Skirmish prep | PARTIAL | PARTIAL | PARTIAL | PARTIAL | stable actionbar architecture pending rerun |
| Skirmish combat | PROVEN board (older head) | PROVEN board (older head) | PROVEN board (older head) | PARTIAL | stable Classic Journal/current head pending rerun |
| Skirmish aftermath | PARTIAL | PARTIAL | PARTIAL | PARTIAL | explicit current-head rerun pending |
| Battle prep | PARTIAL | PARTIAL | PARTIAL | PARTIAL | Battle owner CSS + stable CTA pending rerun |
| Battle combat | PROVEN board (older head) | PROVEN board (older head) | PROVEN board (older head) | PARTIAL | stable Journal/current head pending rerun |
| Battle aftermath | PARTIAL | PARTIAL | PARTIAL | PARTIAL | explicit frame matrix pending |
| Settlement | PROVEN (older owner head) | PROVEN | PROVEN | PROVEN | rerun after later shared cleanup |
| Event | PARTIAL | PARTIAL | PARTIAL | PARTIAL | RU/EN page/frame sweep pending rerun |
| Starvation | PARTIAL | PARTIAL | PARTIAL | PARTIAL | geometry matrix pending |
| Puzzle / Training | PARTIAL | PARTIAL | PARTIAL | PARTIAL | owner/compat cleanup + board/panel matrix pending |
| Classic setup/game | PARTIAL | PARTIAL | PARTIAL | PARTIAL | setup modal + stable Journal matrix pending |
| Endless summary | OPEN | OPEN | OPEN | PARTIAL | explicit one-screen/internal-overflow audit pending |
| Portrait lock | PROVEN older contract | PROVEN where applicable | PROVEN | PARTIAL | EN/current-head rerun pending |

---

# Open verification items

1. **Current architecture regression:** run strengthened responsive, Roster, Travel, Battle, Classic and Skirmish contracts against head `df6d35bc`, then `gate:local`.
2. **Full browser milestone:** run all 17 Chromium contracts at the next meaningful architecture checkpoint.
3. **Dependency security:** classify the two previously reported high-severity advisories as production-relevant or dev-only.
4. **Observer/listener/event fan-out:** measure callbacks/render scheduling over repeated route loops.
5. **Leak stability:** repeat 10+ route loops and compare listener/node counts.
6. **Asset orphan inventory:** build runtime reference graph for generated assets, music/SFX and legacy masters.
7. **Responsive weak surfaces:** Battle aftermath, Starvation, Puzzle/Training, Classic setup and Endless summary need explicit frame coverage.

---

# Autonomous remediation plan

## Phase A — restore complete test/UI truth

1. Keep the reusable geometry checker authoritative for page/frame containment.
2. Finish explicit weak-surface coverage.
3. Execute RU/EN matrices at desktop, `1024×768`, `844×390`, `1180/980` boundaries and portrait lock.
4. Run full 17-contract Chromium at the next meaningful architecture milestone.

## Phase B — finish presentation/source ownership

5. Move run-combat sibling presentation out of `post-pages-ui-review2.mjs` into Classic-owned CSS; delete `review2`.
6. Move the remaining Puzzle width constraint into Puzzle owner CSS; delete `post-pages-ui-polish-constraints.mjs`.
7. Move remaining Puzzle/Settlement/Starvation/Skirmish/Endless duties out of `post-pages-ui-polish.mjs`; delete the module when empty.
8. Move remaining aftermath presentation/state bridge out of `battle-route.mjs`; remove its hidden-attribute `MutationObserver`.
9. Delete obsolete source controls from Skirmish/Battle/Puzzle/Settlement/Event owners; then delete `removeObsoleteHiddenControls()` and its selector list.
10. Consolidate final stylesheet load order and ownership.

## Phase C — localization/event lifecycle

11. Continue owner-keyed localization: Roster → Travel → Starvation → Events/Puzzles → Battle/Skirmish → remaining active surfaces.
12. Remove each screen’s legacy translation reliance after RU/EN parity proof.
13. Delete the whole-document legacy localization observer after all active owners are keyed.
14. Map `rpchess:*` events and narrow broad `run-updated` fan-out.
15. Instrument 10+ route loops and prove stable callback/render/node counts.

## Phase D — persistence/tooling/legacy cleanup

16. Retain the verified unsupported-schema reset policy.
17. Complete dependency security classification.
18. Generate asset orphan/reference inventory and remove only proven-unused assets.
19. Retain the verified Vertical Slice non-return source contract; the authorized application/runtime/test deletion is complete.
20. Keep Cloudflare manual-only; GitHub Pages remains canonical.

## Phase E — validation/integration

21. Use minimum sufficient targeted tests during each cleanup package.
22. Run the complete Chromium matrix at meaningful architecture milestones rather than after every small commit.
23. Before integration run complete browser matrix, canonical Pages gate and a representative manual playthrough.
24. Do not merge to `main` without explicit owner instruction.

## Phase F — final documentation synchronization

25. Update `docs/CURRENT_STATE.md` to the final accepted production SHA.
26. Add current-contract headers to feature docs and clearly mark historical rules.
27. Synchronize final architecture/UI/persistence/deployment state into Notion.
28. Add final architecture ownership note covering navigation, persistence, resources, localization, responsive layout, assets and deployment gates.

---

# Current simplification order

1. Finish compatibility presentation ownership and delete the remaining patch modules.
2. Remove obsolete source DOM/runtime cleanup.
3. Finish exhaustive geometry truth and rerun current architecture.
4. Finish keyed localization and delete global legacy observation.
5. Reduce event/render fan-out and prove no leaks.
6. Complete dependency and asset cleanup; retain the Vertical Slice non-return contract.
7. Run final RU/EN all-screen matrix + Pages gate.
8. Synchronize final documentation and only then prepare integration.

## Next actions

1. Move the stable Classic run-combat sibling CSS from `post-pages-ui-review2.mjs` into Classic-owned presentation and delete `post-pages-ui-review2.mjs`.
2. Move the final Puzzle width constraint out of `post-pages-ui-polish-constraints.mjs` and delete that compatibility module.
3. Continue shrinking `post-pages-ui-polish.mjs` by moving Puzzle, Settlement, Starvation, Skirmish and Endless rules into their true owners.
4. Remove the remaining aftermath style/state bridge and hidden-attribute observer from `battle-route.mjs`.
5. Ensure every owner-loaded stylesheet, including Travel compact presentation, is copied explicitly into `dist`; then consolidate final stylesheet order.
6. Extend geometry coverage to Battle aftermath, Starvation, Puzzle/Training, Classic setup and Endless summary.
7. Run all 17 Chromium contracts plus `gate:local` at the next meaningful architecture milestone; fix only real current-contract failures and update evidence from actual results.
8. Continue owner-keyed localization and event-bus narrowing after presentation/source ownership is stable.
9. Complete dependency classification and asset orphan inventory before final integration; retain the Vertical Slice non-return source contract.
10. Update `CURRENT_STATE.md` only after the final accepted remediation SHA and full gate are available.

Every subsequent remediation report must update this tracker and end with a concrete numbered **Next actions** list.