# RPChess — Full Project Review Report

**Audit status:** REMEDIATION IN PROGRESS  
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit/remediation branch:** `audit/full-project-review-2026-09-08`  
**Current remediation code head:** `b3ae7599e4d51a344ca99d3281ed4d9da60b6a1c`  
**Started:** 2026-09-08

This document is the source of truth for remediation. `main` remains untouched. Cloudflare remains manual-only. Do not restore compatibility patch layers, post-render DOM rewrites, runtime DOM reparenting or whole-document UI workarounds to conceal ownership problems.

## Mandatory UI contract

For every active player-facing screen and supported adaptation:

1. the whole screen/frame composition fits inside one viewport;
2. no child escapes its owning frame;
3. overflow, when unavoidable, is handled deliberately inside the owning frame;
4. page scrolling is not a substitute for gameplay layout;
5. RU/EN satisfy the same geometry contract;
6. breakpoint transitions are tested, not only nominal viewport sizes.

Canonical targets: desktop (`1920×1080`, `1366×768`, `1280×720`), `1024×768`, `844×390`, active boundaries around `1180/980`, and portrait rotate-device behavior.

---

# Remediation tracker

Status meanings: **DONE — verified**, **DONE — verification pending**, **IN PROGRESS**, **OPEN**, **DECISION CLOSED**.

| Finding | Status | Current state |
|---|---|---|
| REV-001 Hero Notes owns unrelated patch chain | **DONE — verified** | Hero Notes rendered by true owners; compatibility runtime deleted. |
| REV-002 Market reads state back from DOM | **DONE — verified** | Settlement renders Market from canonical state. |
| REV-003 Resources render fan-out | **DONE — verified** | Global Resources observer/click fan-out removed; semantic scheduler owns updates. |
| REV-004 whole-document legacy localization | **IN PROGRESS** | Settlement/Resources plus Roster, Travel, Starvation and Puzzle now render owner-keyed UI. Roster/Travel explicitly translate content at render time where needed. Events, Battle/Skirmish and remaining active surfaces still need migration before the global legacy `MutationObserver` can be deleted. |
| REV-005 obsolete source controls / hidden DOM | **DONE — verification pending** | Obsolete Skirmish/Battle/Puzzle/Event shortcuts and hidden controls deleted at source; generic `.remove()` cleanup gone. |
| REV-006 runtime DOM reparenting | **DONE — verification pending** | Battle Start, Classic Journal and Skirmish actionbar have stable owner/source slots; append/restore paths removed. |
| REV-007 canonical Pages gate covers smoke subset | **OPEN** | Pages policy is safe (`main` push only). Full 17-contract milestone/release gate remains manual because connector does not expose `workflow_dispatch`. |
| REV-008 stale page-scroll contract | **DONE — verified** | Geometry tests enforce one-screen behavior instead of scrolling. |
| REV-009 Supplies/Market image retargeting | **DONE — verified** | True owners render resource imagery; global scanner deleted. |
| REV-010 fragmented runtime hotfix CSS | **DONE — verification pending** | Review/polish chain, presentation bootstrap and route CSS-in-JS deleted; compact/aftermath rules are owner stylesheets. |
| REV-011 Supplies optimizer increases asset | **DONE — verified** | Optimizer keeps smaller source bytes. |
| REV-012 stale CURRENT_STATE SHA | **OPEN** | Intentionally deferred to final accepted remediation SHA. |
| REV-013 browser helper lifecycle drift | **DONE — verified** | Shared helper waits for visible scenes; older full milestone passed 17/17. |
| REV-014 responsive gate incomplete | **DONE — verification pending** | Reusable geometry assertions plus RU/EN/boundary matrices exist. Coverage now explicitly includes Battle aftermath, Starvation, Puzzle/Training, Classic setup and Endless summary (`e37f3771`). Current full Chromium execution still pending. |
| REV-015 persistence migration policy | **DONE — verified** | Unsupported schema resets safely; no old-save preservation required by owner decision. |
| REV-016 repeated puzzle materialization/build inputs | **DONE — verified** | Puzzle materialization deduplicated; duplicate build inputs removed. |
| REV-017 generic Wrangler deploy path | **DONE — docs pending** | Generic deploy removed; Cloudflare explicit/manual; GitHub Pages canonical. |
| REV-018 legacy Vertical Slice | **DONE — verification pending** | Standalone browser stack and unreachable `src/` domain/runtime/tests deleted after reachability proof; source verifier blocks return. |
| REV-019 stylesheet ownership/load split | **DONE — verification pending** | Compact/aftermath styles are explicit owner inputs. Battle now loads `battle.css` + `battle-compact.css` itself; shared redesign no longer owns Battle stylesheet loading (`54aa9228`, `d7827fd1`, `a3ec62b8`). |
| REV-020 broad `rpchess:run-updated` bus | **IN PROGRESS** | Generic post-pages listeners are gone. Remaining event graph still needs semantic narrowing and repeated-loop instrumentation. |
| REV-021 historical docs conflict with current rules | **OPEN** | Final documentation synchronization remains after code/gate completion. |

---

# Major remediation completed

## Architecture / presentation ownership

- Hero Notes, Market and Resources moved to true owners.
- Roster and Travel compact presentation moved to owner CSS.
- Battle Prep compact presentation moved to `battle-compact.css`.
- Battle Start CTA is rendered directly in `.battle-army`; legacy actionbar/counters/action-cost removed.
- Classic Journal remains a stable `.classic-shell` sibling; all runtime reparenting removed.
- Skirmish actionbar remains in `.skirmish-shell`; no home/next restore state.
- Obsolete source controls are deleted instead of hidden/removed post-render.
- Puzzle compact objective/stars/reward DOM is authored by `puzzle-app.mjs`.
- Settlement, Starvation, Skirmish and Endless compact rules are owner stylesheets.
- `post-pages-ui-polish.mjs`, `presentation-bootstrap.mjs`, review2–review7, polish constraints and other compatibility modules are deleted.
- Skirmish/Battle aftermath rules live in owner compact CSS.
- `battle-route.mjs` is imports-only.
- Battle compact stylesheet loading moved from shared `ui-redesign-final.mjs` into `battle-app.mjs`.

## Responsive truth

- Geometry helper rejects page-level overflow, nonzero window scroll and frame/viewport escapes.
- Portrait setup no longer waits for an intentionally hidden landscape menu (`71c3f39b`).
- Real portrait body overflow (`1027px` body in `768×1024`) fixed by removing hidden gameplay roots from portrait layout (`480ec6f3`).
- Ambiguous Language modal selector fixed (`24e7414d`).
- Existing responsive suite now covers weak surfaces: Battle aftermath, Starvation, Puzzle/Training, Classic setup and Endless summary (`e37f3771`).

## Localization ownership

Already owner-keyed:

- Settlement and Resources — earlier remediation.
- Roster — `7432aa43`; UI uses `t(...)`, content is translated explicitly at render time, owner subscribes to language changes. Existing regression updated in `6ea67719`.
- Travel — `7216b01c`; week/type/cost/reward/Threat/buttons/warnings/aftermath CTA are keyed, flavor is explicitly translated at render. Registry additions in `4e249726`; regression/source contracts updated.
- Starvation — `ef0fb91e`; all screen chrome and parameterized victim copy keyed; owner language subscription; regression `d7ab7123`.
- Puzzle — registry `6eba6011`, owner migration `187ce871`, semantic DOM kicker override `337fa7d5`, regression `c6a59c75`, source gate `b3ae7599`. Objective/instruction/status/outcome/board aria/promotion labels are owner-rendered; CSS-generated `TRAINING` is suppressed in favor of semantic DOM.

Still to migrate before deleting the global legacy observer: Events UI chrome, Battle/Skirmish UI presentation and remaining active shared/classic/endless surfaces.

## Legacy / build / deployment

- Vertical Slice Stage 1 removed standalone browser entry/bundle/builder/tests (`d46ca26e`).
- Vertical Slice Stage 2 removed unreachable `src/` stack (`5351eb77`).
- Production build packages all owner compact stylesheets.
- Unsupported save schema resets safely.
- GitHub Pages auto-deploy remains `main`-only; audit commits do not auto-deploy.
- Cloudflare has not been deployed during remediation.

---

# Verification history

- Full Review #8 (`34262502407`, `d5820573`): `gate:local` PASS, **17/17 Chromium PASS**.
- Full Review #9 (`34265688360`, `b63726eb`): `gate:local` PASS, **17/17 Chromium PASS** after major compatibility deletion.
- Owner migration #10 (`34266676368`, `8e7c4675`): local PASS; Classic/Settlement/Puzzles 3/3 PASS.
- Save schema #11 (`34267715267`, `2ced5f67`): local/persistence PASS.
- Pages audit #91 (`34330513111`, `0c4156bc`): `gate:local` + production build PASS; responsive stopped on stale portrait setup.
- Pages audit #92 (`34341624633`, `71c3f39b`): `gate:local` + build PASS; exposed real portrait 3px overflow.
- Pages audit #93 (`34342233234`, `480ec6f3`): `gate:local` + build PASS; portrait geometry progressed; stopped later on stale Language close selector.
- Pages audit auto-trigger removed in `496bfac9`.
- Attempted one-off full-review trigger on audit branch (`0931aebb`) created **no check run** through the connector; immediately restored to manual-only in `51464246`. Do not claim CI evidence from this attempt.
- No full 17-contract Chromium PASS is claimed for the current head.

---

# Open verification / cleanup items

1. Full current `gate:local` + all 17 Chromium contracts after the strengthened responsive and localization changes.
2. Events/Battle/Skirmish/remaining owner-keyed localization, then removal of whole-document legacy localization observer.
3. Map and narrow `rpchess:*` event fan-out; instrument at least 10 route loops for callback/render/node stability.
4. Dependency security classification: keep player runtime separate from dev/build-only exposure.
5. Asset orphan/reference inventory; delete only proven-unused assets.
6. Final CURRENT_STATE/docs/Notion synchronization after accepted final SHA.

---

# Autonomous remediation plan

## Phase A — localization completion

1. **DONE:** Roster owner-keyed localization.
2. **DONE:** Travel owner-keyed localization.
3. **DONE:** Starvation owner-keyed localization.
4. **DONE:** Puzzle owner-keyed localization and semantic kicker DOM.
5. Migrate Event UI chrome while preserving the existing 500-event content/presentation translation layer and IDs/effects.
6. Migrate Battle and Skirmish presentation copy without changing encounter/domain mechanics.
7. Migrate remaining active shared/classic/endless UI surfaces.
8. Delete whole-document legacy localization `MutationObserver` only after active owners no longer rely on it.

## Phase B — lifecycle/performance

9. Map remaining `rpchess:*` producers/consumers.
10. Narrow broad `run-updated` consumers to semantic events where safe.
11. Instrument 10+ route loops and compare listener/render/node counts.

## Phase C — validation/tooling

12. Run minimum targeted regressions per cleanup package.
13. Run `gate:local` and all 17 Chromium contracts at the next executable milestone; do not weaken geometry contracts for green.
14. Classify dependency advisories and build asset reference/orphan inventory.

## Phase D — final integration/docs

15. Fix only evidence-backed regressions from the final gate.
16. Update `docs/CURRENT_STATE.md` to the final accepted SHA.
17. Mark historical documentation clearly and synchronize architecture/UI/persistence/deployment state into Notion.
18. Do not merge `main` or deploy Cloudflare without explicit owner instruction.

## Next actions

1. Migrate **Events UI chrome** to owner-keyed localization without changing the 500-event catalog, IDs, effects, hero gates or existing English content layers.
2. Extend the existing Events regression/source verifier; do not create a parallel localization suite.
3. Migrate Battle and Skirmish presentation copy to semantic owner keys using shared `piece.*` / status keys where appropriate.
4. Inventory remaining active screens still dependent on `localizeLegacyDocument` and migrate them in owner-sized packages.
5. Remove the whole-document localization `MutationObserver` only when that inventory reaches zero; retain explicit content translation helpers where content data requires them.
6. Map/narrow `rpchess:run-updated` and instrument 10+ route loops for listener/render/node stability.
7. Run full current `gate:local` + 17 Chromium contracts when executable; update statuses only from actual results.
8. Complete dependency/asset cleanup and final documentation; keep `main` frozen and Cloudflare manual-only until explicit owner direction.

Every subsequent remediation checkpoint must update this report and end with a concrete numbered **Next actions** list.
