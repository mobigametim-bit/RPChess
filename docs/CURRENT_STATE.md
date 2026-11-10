# RPChess — Current State

**Documentation reviewed:** 2026-11-10.  
**Production source:** `main`; the September 2026 production baseline retained below is historical and should not be mistaken for the latest feature-branch state.  
**Latest separately verified Pages release SHA:** not established in this document; deployment is manual.  
**Production URL:** https://mobigametim-bit.github.io/RPChess/  
**Current active development:** Infinite Kingdom / «Бесконечное королевство», Draft [PR #190](https://github.com/mobigametim-bit/RPChess/pull/190).  
**Active specs:** `docs/KINGDOM_EXPLORATION_ECONOMY_BIOME_DESIGN.md`, `docs/KINGDOM_ECONOMY_ARMY_SPEC.md`, `docs/features/KINGDOM_ROADS_AND_TRAVELERS_PLAN.md`.

This file separates production history from active feature work. Older September milestones and acceptance receipts below are retained as historical evidence, not current claims of unimplemented features. The GitHub Pages site is updated only by a manually dispatched Pages workflow from `main`; regular PR checks validate without publishing.

## Active feature branch — Infinite Kingdom, 10.11.2026

- Draft PR #190 has a playable isolated Cloudflare Preview; it is not merged into `main`. Hex/grid world, six biome semantics, fog, calendar, territory, Castle recruits, weekly production, Arena Shards and settlement economy have working implementation paths. Final long-run/mobile acceptance is open.
- Author's Atlas Lab v6 economy preset dated 09.11.2026 is committed as `docs/KINGDOM_ECONOMY_APPROVED_20261110.json`. The Skirmish runtime is **named-heroes only**; ordinary Army recruits are for other eligible modes. Roster tab labels: `Герои / Heroes`, `Армия / Army`.
- Current `completedRoads` implementation links newly completed routes to the previously completed event (first to Castle). This is **not** the newly agreed future rule. Target: each known road-event node inside owned territory connects to the Castle **and** its nearest other owned road-event node without duplicate segments. See `docs/features/KINGDOM_ROADS_AND_TRAVELERS_PLAN.md`.
- Five authored 64×64 transparent four-frame animation sets are supplied: `merchant`, `convoy`, `courier` (any roads), `patrol`, `builders` (owned-territory road segments only). These are **planned**; source files are not yet imported to the runtime, and no NPC movement code is claimed.
- Continue through review and explicit player acceptance before merge. The documentation source of truth is **GitHub only**; Notion synchronization is not required.

## Historical production snapshot — September 2026 (superseded as an active-plan heading)

- **Arena (historical September plan):** 84 opponents (14 races × 6 pieces) and Honor Shards design were originally recorded in `docs/features/ARENA_PLAN.md`. This older note predates the present Arena implementation (`game/js/arena-app.mjs` exists on `main`); it must not be read as a current statement that Arena has no gameplay implementation.
- **Caravan:** Chess960, free mercenaries, artifacts, reward selection and reload recovery were human accepted and merged to `main` in [PR #144](https://github.com/mobigametim-bit/RPChess/pull/144), merge `a706eb8`. The earlier plan-only [PR #143](https://github.com/mobigametim-bit/RPChess/pull/143) is also merged.
- **VK cross-device saves:** [PR #145](https://github.com/mobigametim-bit/RPChess/pull/145), [#146](https://github.com/mobigametim-bit/RPChess/pull/146) and [#147](https://github.com/mobigametim-bit/RPChess/pull/147) are merged, last merge `f6f0eec`. The owner confirmed on 2026-09-24 that a phone resumed at the laptop's location after a manually repaired remote checksum mismatch. The manual repair demonstrates one successful transfer, not automatic recovery of corrupted cloud state or a completed two-device acceptance matrix. Direct GitHub Pages remains browser-local.
- **VK moderation:** the owner reported resubmission for moderation on 2026-09-24. Dashboard status and eventual approval have not been independently verified.
- **Skirmish obstacles / mobile fixes / artifacts:** already accepted and merged; historical details are retained in their feature docs and changelog.

## Full-project review closure

- Final remediation code candidate: `2906aebf5c95f20620bc9691279f95fd65fe8544`.
- Final exact validation run `34451963848`: canonical local gate, standalone responsive RU/EN/boundary matrix and all 17 Chromium contracts **PASS**.
- The accepted audit line was fast-forward merged into `main`; final cleanup/docs commits culminated in accepted production merge head `24885b2da20bc5063e4b4f5101a34f6d7aa2ddde` before the subsequent docs-only VK planning updates.
- All REV-001…REV-021 review findings are closed and verified.

## Production and delivery

RPChess is published from `main` through **GitHub Pages**.

`.github/workflows/pages.yml` runs on pull requests and on pushes to `main`:

1. `npm ci --no-audit --no-fund`;
2. `npm run gate:local`;
3. Pages artifact-size guard (`dist` must remain below 1 GB);
4. Playwright/Chromium installation;
5. real browser verification under the project subpath `/RPChess/` using Classic Chess/Stockfish and responsive viewport contracts;
6. only for a manually dispatched workflow from `main`, upload `dist` and deploy it to GitHub Pages.

PR and push runs validate candidates without publishing. Only `workflow_dispatch` from `main` publishes GitHub Pages.

Cloudflare configuration and `npm run deploy:cloudflare` remain only for an explicit manual owner request. No normal push, PR or milestone workflow deploys Cloudflare automatically. GitHub Pages remains the canonical public web production deployment while VK Games is developed as an additional platform target.

## Current accepted UI contract

The landscape redesign, live-device correction cycle and full-review remediation geometry are human accepted and merged into `main`.

Canonical viewport targets:

- desktop landscape: `1920×1080`;
- tablet landscape: `1024×768`;
- mobile landscape: `844×390`;
- portrait gameplay: bilingual rotate-device lock.

Every gameplay composition must remain within one viewport in both RU and EN. Page scrolling is not a layout substitute; unavoidable overflow belongs only to an explicitly designated owner-frame. Breakpoint boundaries around `1180/980` are part of the browser contract.

Battle, Skirmish and Training/Puzzle are board-first screens. Their 8×8 boards use the accepted edge-to-edge landscape geometry without coordinate gutters in combat/training presentation.

Current live-device details include:

- Training/Puzzle information frame stays separated from the board; Settings is standalone;
- mobile Roster uses enlarged hero cards;
- Travel command row distributes Week, portrait, Power/Threat, resources and actions across the frame;
- Battle/Skirmish combat does not show the floating Gold/Supplies HUD;
- Battle/Skirmish mobile uses a combined information frame for combat summary/log;
- Settlement tablet/mobile uses compact Tavern/Healer/Market grouping; mobile Tavern portraits are square;
- desktop Settlement service icons have no circular backing/frame;
- board role glyphs in Battle/Skirmish/Training are filled symbols with opposite-color outline, anchored to the lower-left of the square; desktop/tablet keep the enlarged treatment and mobile uses the reduced 19.5 px treatment;
- English combat pseudo-headings are localized (`COMBAT SUMMARY`, `COMBAT LOG`) rather than hard-coded Russian CSS content.
- mobile Tavern portraits use a raised crop; Healer candidates and Skirmish victory lists scroll inside their owner panels;
- Starvation rescue buttons reset to an actionable state on every prompt;
- mobile Skirmish preparation keeps `Боевой отряд`, participant list, formation and Start footer in-frame;
- artifact-choice styles are loaded before combat selection, preventing the transient unstyled/grey transition surface.

## Resources and Settlement

Gold and Supplies remain the two run resources.

The dedicated Supplies art is now:

`game/generated_assets/reward_supplies.png`

It is used for Supplies presentation in shared resource UI/HUD, Travel, Settlement Market product rows and Event outcomes. `generated_assets/node_shop.png` is reserved for the **Market service icon** and is no longer reused as the Supplies resource icon.

The Supplies icon is covered by the production resource-icon asset budget/optimizer:

- runtime max side: **192 px**;
- runtime max encoded size: **128 KiB**;
- the production build fails closed if the covered icon exceeds the budget after optimization.

Settlement's current player-facing service names are:

- `Знахарка` / Healer;
- `Таверна` / Tavern;
- `Рынок` / Market.

The Market product row is intentionally compact: item icon + current/max stock + Gold icon + price + Buy on one row. The old explanatory stock paragraph is not part of the accepted UI.

## Runtime asset optimization

Production `dist` is built from high-resolution source assets and then optimized for runtime delivery. Existing optimized classes include board pieces, portraits, backgrounds, board skins, pin/ice VFX, combat auras and the dedicated resource-icon pipeline.

High-resolution masters and reserve/planned assets may remain in the repository where required. Explicit build allowlists/collectors determine production ownership, and production-size budgets protect the shipped `dist` payload rather than destructively replacing source masters. Orphan inventory is candidate-only; deletion requires positive reachability proof.

Legacy `ui_button_primary.png` is excluded from production `dist`; ordinary CTA controls use the CSS-only obsidian/gold contract. Every local CSS `url(...)` in the built distribution must resolve to an existing runtime file.

## Localization

Canonical language codes are `ru` and `en`.

Current `main` includes owner-level RU/EN rendering for active dynamic surfaces and no whole-document localization observer. Explicit authored-content translation remains render-time and owner-controlled. Event mechanics remain language-independent; localization is presentation-only.

## Persistence boundary

The current namespace is `rpchess.reboot.v1.run`, schema version `1`. Supported same-schema state is hydrated best-effort. Unsupported schema versions reset safely; old/legacy schema preservation and Iron Marches save import are not product obligations.

In VK, the PlatformAdapter now syncs a compact cloud envelope and retains localStorage as a local cache. Direct GitHub Pages play stays local to the browser. A corrupted VK remote checksum previously paused sync; a manual repair restored cross-device continuation once, while automatic recovery and concurrent-device conflict handling remain open verification points.

## Core gameplay state

The accepted Reboot core currently includes:

- Foundation and Classic Chess;
- Stockfish-based Chess AI;
- persistent personalized Roster;
- Skirmish and Battle;
- three-way Travel Choice;
- Gold/Supplies economy;
- Settlement;
- Starvation;
- Events and hero-specific Event choices;
- Lichess-based Puzzles/Training;
- Power/Threat encounter scaling;
- Content Framework;
- continuous endless-run loop;
- Player Identity + Chronicle;
- Hero Notes;
- Battle Mercenaries economy and Balance Gate values.
- Skirmish battlefield obstacles with obstacle-aware move/attack rays and pin-ice suppression.

- Caravan Chess960 encounters are merged on `main` through PR #144; cross-device VK Cloud Save through PRs #145–147.

Arena is planned and is not part of this implementation list.

Historical acceptance/build receipts remain in the numbered design documents and changelog.

## Documentation rule — GitHub only (10.11.2026)

GitHub repository documentation (`README.md`, applicable `docs/` specs and PR acceptance notes) is the **only required** source of project requirements, active plans and accepted delivery state. Update GitHub docs during the relevant development/release; a separate Notion mirror or GitHub–Notion sync is **not mandatory** and must not block a PR or release. Older Notion mentions in historical receipts are not active policy.

For active work the lifecycle remains:

`SPEC → IMPLEMENTED → AUTOTESTED → HUMAN ACCEPTED (when required) → GITHUB DOCS UPDATED → MERGED → PRODUCTION VERIFIED`

A green technical gate is not a substitute for Human Acceptance on player-facing UI/gameplay changes.
