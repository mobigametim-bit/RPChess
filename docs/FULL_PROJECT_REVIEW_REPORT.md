# RPChess — Full Project Review Report

**Audit status:** REMEDIATION IN PROGRESS  
**Frozen production baseline:** `main@e92831ca5d6e0c14fb2d919e410180ce77b97ce6`  
**Audit/remediation branch:** `audit/full-project-review-2026-09-08`  
**Current remediation code head:** `b29b763e3b34ca6599e452cbd9a2a15befda2cab`  
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
| REV-004 whole-document legacy localization | **DONE — verification pending** | All identified active dynamic surfaces now localize at owner render time. Classic, Endless, Power results, shared resource/board UX and formation titles were migrated; the global legacy `MutationObserver`, TreeWalker scan and DOM source WeakMaps were deleted in `fc74ac8b`. Explicit `translateLegacy(...)` remains only as a render-time authored/content helper. Ownership gate added to `test:localization`. |
| REV-005 obsolete source controls / hidden DOM | **DONE — verification pending** | Obsolete Skirmish/Battle/Puzzle/Event shortcuts and hidden controls deleted at source; generic `.remove()` cleanup gone. |
| REV-006 runtime DOM reparenting | **DONE — verification pending** | Battle Start, Classic Journal and Skirmish actionbar have stable owner/source slots; append/restore paths removed. |
| REV-007 canonical Pages gate covers smoke subset | **OPEN** | Pages policy is safe (`main` push only). Full 17-contract milestone/release gate remains manual because connector does not expose `workflow_dispatch`. |
| REV-008 stale page-scroll contract | **DONE — verified** | Geometry tests enforce one-screen behavior instead of scrolling. |
| REV-009 Supplies/Market image retargeting | **DONE — verified** | True owners render resource imagery; global scanner deleted. |
| REV-010 fragmented runtime hotfix CSS | **DONE — verification pending** | Review/polish chain, presentation bootstrap and route CSS-in-JS deleted; compact/aftermath rules are owner stylesheets. |
| REV-011 Supplies optimizer increases asset | **DONE — verified** | Optimizer keeps smaller source bytes. |
| REV-012 stale CURRENT_STATE SHA | **OPEN** | Intentionally deferred to final accepted remediation SHA. |
| REV-013 browser helper lifecycle drift | **DONE — verified** | Shared helper waits for visible scenes; older full milestone passed 17/17. |
| REV-014 responsive gate incomplete | **DONE — verification pending** | Reusable geometry assertions plus RU/EN/boundary matrices exist. Coverage explicitly includes Battle aftermath, Starvation, Puzzle/Training, Classic setup and Endless summary (`e37f3771`). Current full Chromium execution still pending. |
| REV-015 persistence migration policy | **DONE — verified** | Unsupported schema resets safely; no old-save preservation required by owner decision. |
| REV-016 repeated puzzle materialization/build inputs | **DONE — verified** | Puzzle materialization deduplicated; duplicate build inputs removed. |
| REV-017 generic Wrangler deploy path | **DONE — docs pending** | Generic deploy removed; Cloudflare explicit/manual; GitHub Pages canonical. |
| REV-018 legacy Vertical Slice | **DONE — verification pending** | Standalone browser stack and unreachable `src/` domain/runtime/tests deleted after reachability proof; source verifier blocks return. |
| REV-019 stylesheet ownership/load split | **DONE — verification pending** | Compact/aftermath styles are explicit owner inputs. Battle loads `battle.css` + `battle-compact.css` itself; shared redesign no longer owns Battle stylesheet loading. |
| REV-020 broad `rpchess:run-updated` bus | **IN PROGRESS** | Semantic lifecycle bridge now derives `combat-completed` and `puzzle-resolved` from canonical run transitions. Power, final redesign, shared UX and cross-scene presentation no longer consume broad `run-updated`. Bridge reentrancy is fixed and a 12-transition regression is wired into the canonical test set. Events still needs semantic narrowing; Resources remains under review as a potentially legitimate broad canonical-state projection. Browser listener/render/node stability proof is still pending. |
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
- Battle Mercenary debt is now resolved inside the Battle completion lifecycle before aftermath rendering; the Mercenaries module no longer post-renders aftermath or subscribes to broad `rpchess:run-updated` for settlement.
- Whole-document localization is no longer a presentation owner: all identified dynamic UI surfaces render translated presentation themselves, and `i18n.mjs` no longer observes or walks the full DOM.

## Semantic lifecycle ownership

- `run-lifecycle-events.mjs` introduced in `6aaa8422` and loaded first by `battle-route.mjs` in `2e1968e5`.
- The bridge derives only semantic completion transitions from canonical persisted state: `rpchess:combat-completed` for Battle/Skirmish count increments and `rpchess:puzzle-resolved` for a newly resolved Puzzle.
- Power stopped consuming broad `run-updated` in `15ac7458`; it now reacts to semantic completion events plus one initial recovery sync.
- Final redesign presentation stopped consuming broad `run-updated` in `ee05e0ad`.
- Cross-scene visuals stopped consuming broad `run-updated` in `328ee91d`; combat outcome styling uses `combat-completed`, Event resource decoration is tied to Event choice/open lifecycle, and restore paths remain explicit.
- Shared UX stopped consuming broad `run-updated` in `7dbdc171`; resources/power/scene/language/click events plus semantic combat/Puzzle completion own refresh scheduling.
- Existing UI regression was synchronized in `aa801cab` and source/build contracts in `a8af96fa` + `dada4d10`.
- A reentrancy defect was found during review before CI: nested `run-updated` from a semantic consumer could replay the same completion because the bridge updated its snapshot after dispatch. `27b1c892` now commits the transition before notifying consumers.
- Permanent `tests/run-lifecycle.cjs` (`c86d763e`) executes 12 alternating Battle/Skirmish transitions, intentionally emits nested derived `run-updated`, and requires exactly one semantic completion per canonical transition. It also verifies ten no-state-change notifications do not fan out. The test is wired into `test:materialized` and exposed as `test:lifecycle` in `b29b763e`.

## Responsive truth

- Geometry helper rejects page-level overflow, nonzero window scroll and frame/viewport escapes.
- Portrait setup no longer waits for an intentionally hidden landscape menu (`71c3f39b`).
- Real portrait body overflow (`1027px` body in `768×1024`) fixed by removing hidden gameplay roots from portrait layout (`480ec6f3`).
- Ambiguous Language modal selector fixed (`24e7414d`).
- Existing responsive suite covers weak surfaces: Battle aftermath, Starvation, Puzzle/Training, Classic setup and Endless summary (`e37f3771`).

## Localization ownership

Owner-keyed / explicit render-time localization now covers all identified active surfaces:

- Settlement and Resources — earlier remediation.
- Roster — `7432aa43`; UI uses `t(...)`, content is translated explicitly at render time, owner subscribes to language changes. Regression `6ea67719`.
- Travel — `7216b01c`; week/type/cost/reward/Threat/buttons/warnings/aftermath CTA are keyed, flavor is explicitly translated at render. Registry additions `4e249726`.
- Starvation — `ef0fb91e`; all screen chrome and parameterized victim copy keyed; owner language subscription; regression `d7ab7123`.
- Puzzle — registry `6eba6011`, owner `187ce871`, semantic DOM kicker override `337fa7d5`, regression `c6a59c75`, source gate `b3ae7599`. Objective/instruction/status/outcome/board aria/promotion labels are owner-rendered.
- Events — registry `d2b7bac3`, owner `1234cd07`, regression `7c95fd05`. Event chrome/chance/outcome/hero-state/cost presentation is keyed and owner-subscribed; authored 500-event narrative, reactions, IDs, effects and hero gates remain in explicit content translation/domain layers.
- Skirmish — registry `d69ca389`, owner `75d6a70f`, regression `dedb1a72`. Prep limits/notices/cards/aria, aftermath and run-end are keyed; encounter labels/descriptions and character names translate explicitly at render. Combat visual observers remain because they own chess flyer/ghost art, not localization.
- Battle — registry `9222fceb`, owner lifecycle `bd7ce73f`, Mercenary cleanup `9bea349d`, verifier sync `e8b99563` + `43afa5a8`. Prep/cards/aria/aftermath/run-end and Mercenary quote/payment presentation are keyed. Encounter/name content translates explicitly at render. Debt settlement is performed before final aftermath render.
- Classic — registry `f37994ac`, owner migration `5ac0afb5`, capture fallback preservation `00a48e09`, existing static regression synchronized in `d885e2e5`. Setup/promotion/static chrome plus dynamic board aria/status/result/history/AI presentation now rerender from the owner on language changes; SAN, engine and AI mechanics are unchanged.
- Shared runtime registry — `5568ce5d` adds semantic RU/EN messages for Endless, Power and generated shared UX.
- Endless — `b916736c`; summary chrome is owner-rendered and `kingName` / `endReasonLabel` translate explicitly. Existing Endless regression was synchronized with owner localization in `30755415` without weakening run-statistics/persistence coverage.
- Power result — `ce766967`; generated Power/Threat result labels localize at render time and repaint on language changes.
- Shared UX — `2e0699af`; resource aria, board-axis aria and active combat captions/difficulty translate explicitly when generated and refresh on language changes.
- Shared formation titles — `ffdf174a`; dynamic formation piece titles translate explicitly and refresh from the lifecycle module.
- Global observer removal — `fc74ac8b`; removed localization `MutationObserver`, TreeWalker full-DOM scan, text/attribute WeakMaps and `localizeLegacyDocument`. `refreshLocalization()` now handles semantic `data-i18n` only.
- Ownership gate — `c88fa577`, wired into `test:localization` in `6b88b94d`. It enforces RU/EN registry parity, absence of whole-document localization machinery and owner language subscriptions for the migrated runtime surfaces.

`translateLegacy(...)` is intentionally retained. It is no longer a whole-document workaround; it is an explicit helper for authored/content values such as Event prose, names, descriptions and domain labels at the point where their owners render them.

## Legacy / build / deployment

- Vertical Slice Stage 1 removed standalone browser entry/bundle/builder/tests (`d46ca26e`).
- Vertical Slice Stage 2 removed unreachable `src/` stack (`5351eb77`).
- Production build packages the complete `localization/` directory, including the Classic/runtime owner registries.
- Semantic lifecycle bridge is explicitly packaged and asserted in production build (`a8af96fa`).
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
- Battle owner/Mercenary package (`9222fceb` → `43afa5a8`): implementation and source-contract review complete; no current gate PASS is claimed.
- Localization completion package (`f37994ac` → `30755415`): implementation, ownership inventory and static contract synchronization complete. A local checkout execution attempt could not resolve `github.com` from the execution environment, so **no fresh `gate:local`, targeted Node PASS or Chromium PASS is claimed** for this head.
- Semantic lifecycle package (`6aaa8422` → `b29b763e`): implementation, build/source contracts and permanent 12-transition regression are committed. The test has **not yet been executed in the connected environment**, so no fresh PASS is claimed from it yet.
- No full 17-contract Chromium PASS is claimed for the current head.

---

# Open verification / cleanup items

1. Full current `gate:local` + all 17 Chromium contracts after strengthened responsive, localization and semantic lifecycle changes.
2. Finish `REV-020`: move Events from broad `run-updated` to semantic combat completion; classify Resources broad subscription as either necessary canonical projection or replace it with explicit state/resource events. Then perform browser listener/render/node stability proof across 10+ route loops.
3. Dependency security classification: keep player runtime separate from dev/build-only exposure.
4. Asset orphan/reference inventory; delete only proven-unused assets.
5. Final CURRENT_STATE/docs/Notion synchronization after accepted final SHA.

---

# Autonomous remediation plan

## Phase A — localization completion

1. **DONE:** Roster owner-keyed localization.
2. **DONE:** Travel owner-keyed localization.
3. **DONE:** Starvation owner-keyed localization.
4. **DONE:** Puzzle owner-keyed localization and semantic kicker DOM.
5. **DONE:** Event UI chrome owner-keyed while authored Event content remains in explicit content translation layers.
6. **DONE:** Skirmish owner-keyed presentation.
7. **DONE:** Battle + Mercenary owner-keyed presentation and owner-lifecycle debt settlement.
8. **DONE:** Classic, Endless, Power and shared dynamic presentation migrated to owner/local render-time localization.
9. **DONE:** Whole-document legacy localization observer/scan removed; explicit authored/content translation helper retained.
10. **DONE:** Permanent i18n ownership gate added to the existing localization gate path; stale Classic/Endless source assertions synchronized.

## Phase B — lifecycle/performance

11. **DONE:** Introduce semantic completion bridge and load it before journey consumers.
12. **DONE:** Remove broad `run-updated` from Power, final redesign, shared UX and cross-scene presentation; synchronize build/source/UI contracts.
13. **DONE:** Fix semantic bridge reentrancy and add a permanent 12-transition/no-state-change regression.
14. Narrow Events to semantic combat completion.
15. Decide/implement the minimal Resources event contract; broad `run-updated` may remain only if documented as the canonical run-state projection and no safer explicit event covers all resource mutations.
16. Add browser-level 10+ route-loop listener/render/node stability instrumentation.

## Phase C — validation/tooling

17. Run minimum targeted regressions per cleanup package.
18. Run `gate:local` and all 17 Chromium contracts at the next executable milestone; do not weaken geometry contracts for green.
19. Classify dependency advisories and build asset reference/orphan inventory.

## Phase D — final integration/docs

20. Fix only evidence-backed regressions from the final gate.
21. Update `docs/CURRENT_STATE.md` to the final accepted SHA.
22. Mark historical documentation clearly and synchronize architecture/UI/persistence/deployment state into Notion.
23. Do not merge `main` or deploy Cloudflare without explicit owner instruction.

## Next actions

1. Replace the Events `rpchess:run-updated` consumer with `rpchess:combat-completed`, preserving the event-combat completion/write ordering now that the bridge is reentrant-safe.
2. Review Resources mutations across Travel/Settlement/Events/Puzzle/combat and either replace the remaining broad state projection with explicit resource events or document/guard it as the single justified broad consumer.
3. Extend existing browser infrastructure with 10+ route-loop stability instrumentation for listener/render/node counts; avoid a second browser suite if the existing route/browser harness can host it.
4. Run full current `gate:local` + all 17 Chromium contracts when executable; update verification-pending statuses only from actual results.
5. Complete dependency security classification and asset orphan/reference inventory; delete only evidence-backed unused items.
6. Finish `CURRENT_STATE.md`, historical docs/Notion synchronization and final release-readiness report; keep `main` frozen and Cloudflare manual-only until explicit owner direction.

Every subsequent remediation checkpoint must update this report and end with a concrete numbered **Next actions** list.
