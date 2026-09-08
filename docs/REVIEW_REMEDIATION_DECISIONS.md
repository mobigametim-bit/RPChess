# RPChess — Review remediation decisions

**Status:** ACCEPTED FOR REMEDIATION  
**Date:** 2026-09-08  
**Applies to:** findings in `docs/FULL_PROJECT_REVIEW_REPORT.md`

## Accepted decisions

1. **Save compatibility is not required.** Existing `rpchess.reboot.v1.*` run/profile data may be discarded if a cleaner persistence contract requires a reset. Do not spend remediation time building migrations only to preserve current saves.
2. **Legacy Vertical Slice may be removed.** Once repository references are proven non-production/non-required, delete `game/vertical-slice.html` and its legacy runtime/test/support stack instead of keeping an in-repo archive. Git history is the archive.
3. **Cloudflare remains manual-only.** GitHub Pages stays canonical production. Cloudflare/Wrangler may remain only as an explicitly named manual deployment/preview path invoked on user request; it must not look like the default `deploy` command and must not run automatically.
4. **Deep root-cause cleanup is approved.** Accepted UI/gameplay parity must be preserved, but patch chains, DOM reparenting, broad observers, post-render image retargeting and other temporary layers may be replaced by owner-level renderers/CSS and then deleted. Do not solve review findings by adding another `post-pages-ui-reviewN` layer.
5. **Localization remediation uses owner-level rendering.** Active production screen owners should render the current language directly using semantic i18n keys/parameters. Static keyed DOM can still be localized explicitly on language change. Dynamic renderers must call `t(key, params)` while rendering. Language switching should explicitly rerender/localize the affected screen; it should not depend on a whole-document MutationObserver noticing Russian text after the fact. The legacy translator may remain temporarily only for content that has not yet been migrated; its scope must shrink until the global observer can be removed.
6. **CI follows minimal-testing policy.** Keep a fast mandatory PR gate for critical contracts. Run the broader Chromium/UI suite manually before major merges and after high-risk architectural changes instead of spending 30+ minutes on every small commit.

## Localization target behavior in practical terms

Current legacy pattern:

`renderer writes Russian -> global MutationObserver notices DOM mutation -> legacy translator rewrites text to English`

Target pattern:

`renderer reads current language -> t('semantic.key', params) -> writes final RU or EN text once`

Example Market row target:

- RU render: `4/4 за 12 Купить`
- EN render: `4/4 for 12 Buy`
- switching RU -> EN emits one language-change notification;
- Settlement rerenders/localizes its own row directly;
- no observer scans the document looking for the Russian words `за` or `Купить`.

This keeps live language switching without reload, while making final text width/state deterministic at the screen owner.

## Remediation execution order

1. Repair browser-test lifecycle and stale one-screen contracts so review evidence becomes trustworthy.
2. Finish RU/EN viewport/frame containment verification across desktop/tablet/mobile and breakpoint boundaries.
3. Instrument production-reachable MutationObservers, global listeners, timers and render/event fan-out through repeated route loops.
4. Move accepted Market/Supplies behavior into true owners; remove DOM parsing/global image retargeting after parity proof.
5. Collapse accepted UI patch CSS/JS into screen-owned renderers/styles and remove superseded patch modules.
6. Remove obsolete source DOM controls and runtime cleanup/reparenting once owner layouts are stable.
7. Convert active production dynamic UI copy to owner-level keyed i18n, then shrink/remove the whole-document localization observer.
8. Simplify Resources/event refresh semantics and generic `rpchess:run-updated` fan-out.
9. Remove the legacy Vertical Slice repository stack after reference/dependency proof.
10. Rename Cloudflare/Wrangler to an explicit manual deployment path; GitHub Pages remains automatic production from `main`.
11. Simplify build/gate duplication and resource optimizer behavior.
12. Run targeted tests after each root-cause batch; run the broad Chromium suite before major merge.
13. Synchronize `FULL_PROJECT_REVIEW_REPORT.md`, `CURRENT_STATE.md`, numbered GitHub docs and Notion after accepted remediation lands.

## Reporting rule

Every remediation progress report must end with an explicit ordered list of **next actions**. A report is not complete if it only describes what has already been done.
