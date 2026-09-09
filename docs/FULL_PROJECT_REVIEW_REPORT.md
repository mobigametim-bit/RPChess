# RPChess — Full Project Review Report

**Audit status:** REMEDIATION IN PROGRESS  
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit/remediation branch:** `audit/full-project-review-2026-09-08`  
**Current remediation code head:** `54c8ddc96f0aec8ca1ad05dfc5d3feb9503bf67d`  
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
| REV-020 broad `rpchess:run-updated` bus | **IN PROGRESS** | Semantic narrowing is implementation-complete: Power, redesign, shared UX, cross-scene and Events no longer consume broad `run-updated`; Resources retains one documented broad listener solely as a coalesced, side-effect-free HUD projection. State-mutating combat reward settlement is semantic. Reentrancy-safe lifecycle bridge and 12-transition regression exist. Remaining work: browser listener/render/node stability proof across 10+ route loops. |
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
- Cross-scene visuals moved off broad `run-updated` in `328ee91d`; combat outcome uses semantic completion and Event note decoration is tied to Event interaction/open lifecycle.
- Shared UX moved off broad `run-updated` in `7dbdc171`.
- Existing UI contract synchronized `aa801cab`; bridge packaged `a8af96fa`; verifier synchronized `dada4d10`.
- Reentrancy bug found during review: semantic consumer could synchronously emit another `run-updated` before bridge snapshot advanced. Fixed in `27b1c892` by committing `previous = next` before notification.
- Permanent lifecycle regression `c86d763e`, wired by `b29b763e`, executes 12 alternating Battle/Skirmish transitions, nested derived `run-updated`, and ten no-state-change notifications; contract requires exactly one semantic completion per canonical transition.
- Events moved from `run-updated` consumer to `combat-completed` in `1158b857`; existing 500-event regression strengthened in `3e354cfb`.
- Resources split in `b3ef74a5`: `combat-completed`/`run-continue` own reward settlement, while the sole remaining broad `run-updated` listener calls `scheduleRender` only. Existing Resources regression updated in `54c8ddc9` to forbid broad state-mutating settlement and record this one justified projection.

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
- Pages #91 (`34330513111`, `0c4156bc`), #92 (`34341624633`, `71c3f39b`), #93 (`34342233234`, `480ec6f3`): current-at-the-time local/build PASS; browser runs exposed stale/real responsive issues subsequently fixed.
- Pages audit auto-trigger removed `496bfac9`.
- One-off full-review trigger `0931aebb` produced no check run through connector; restored manual-only in `51464246`.
- Localization completion (`f37994ac` → `30755415`): implementation/static contracts complete; no fresh full gate claimed.
- Semantic lifecycle (`6aaa8422` → `54c8ddc9`): implementation/static contracts/12-transition regression committed; **no fresh execution PASS is claimed** because current connected environment has not executed the gate.
- No full 17-contract Chromium PASS is claimed for current head.

---

# Open verification / cleanup items

1. Browser-level 10+ route-loop stability proof for `REV-020`: listener callback counts, owner root/style/HUD node counts and render stability must not grow across loops.
2. Full current `gate:local` + all 17 Chromium contracts.
3. Dependency security classification, separating player runtime from dev/build-only exposure.
4. Asset orphan/reference inventory; delete only proven-unused assets.
5. Final `CURRENT_STATE.md`, historical docs/Notion synchronization after accepted final SHA.

---

# Autonomous remediation plan

## Phase A — localization

1. **DONE:** Roster/Travel/Starvation/Puzzle/Events/Skirmish/Battle owner localization.
2. **DONE:** Classic/Endless/Power/shared dynamic localization.
3. **DONE:** Whole-document localization observer/scan deletion.
4. **DONE:** Permanent i18n ownership gate and stale source-regression synchronization.

## Phase B — lifecycle/performance

5. **DONE:** Semantic completion bridge and first-import ownership.
6. **DONE:** Power/redesign/shared UX/cross-scene broad consumer removal.
7. **DONE:** Bridge reentrancy fix + permanent 12-transition regression.
8. **DONE:** Events semantic combat completion.
9. **DONE:** Resources lifecycle split; broad listener retained only as render-only HUD projection.
10. **NEXT:** Browser 10+ route-loop stability instrumentation and proof.

## Phase C — validation/tooling

11. Run targeted regressions and then `gate:local` + all 17 Chromium contracts when executable.
12. Classify dependency advisories and build asset reference/orphan inventory.

## Phase D — final integration/docs

13. Fix only evidence-backed regressions from final gate.
14. Update `docs/CURRENT_STATE.md` to final accepted SHA.
15. Mark historical docs clearly and synchronize architecture/UI/persistence/deployment into Notion.
16. Do not merge `main` or deploy Cloudflare without explicit owner instruction.

## Next actions

1. Extend an existing browser contract with at least 10 route/scene loops; instrument callback/render/node counts and assert no accumulation. Do not add a second browser suite unless the existing harness cannot host the proof.
2. Synchronize source verifier with the final Events/Resources lifecycle contract if needed after the browser instrumentation package.
3. Run targeted lifecycle/UI/Resources/Events contracts when an executable environment is available, then run full `gate:local` + 17 Chromium contracts; update verification statuses only from actual results.
4. Complete dependency security classification and asset orphan/reference inventory; delete only evidence-backed unused items.
5. Finish `CURRENT_STATE.md`, historical docs/Notion synchronization and final release-readiness report; keep `main` frozen and Cloudflare manual-only until explicit owner direction.

Every subsequent remediation checkpoint must update this report and end with a concrete numbered **Next actions** list.
