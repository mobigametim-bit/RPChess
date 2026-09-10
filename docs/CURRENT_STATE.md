# RPChess — Current State

**Last synchronized:** 2026-09-10  
**Production branch:** `main`  
**Accepted production/audit merge head:** `24885b2da20bc5063e4b4f5101a34f6d7aa2ddde`  
**Production URL:** https://mobigametim-bit.github.io/RPChess/  
**Current active stage:** **VK Games publication**  
**VK working plan:** `docs/platforms/VK_GAMES_PUBLICATION_PLAN.md`

This page is the short operational snapshot of the project. Historical feature receipts remain in the numbered documents and `CHANGELOG.md`; when an old receipt conflicts with this page about deployment, responsive UI, persistence, current asset usage or current project stage, this page describes the current contract.

## Current phase — VK Games publication

The full-project review remediation is complete, human accepted, merged into `main` and used as the production baseline. The active delivery track is now the first external platform release: **VK Games**.

Canonical working checklist:

`docs/platforms/VK_GAMES_PUBLICATION_PLAN.md`

Agents continuing this project should use that checklist as the source of truth for VK work, mark completed items there, preserve one shared gameplay codebase, and keep VK-specific integration behind the platform layer rather than creating a separate copy of RPChess.

Immediate next technical stages are:

1. verify/record the existing RPChess readiness state (plan section 0);
2. create `platform/vk-games` from current `main` and establish the platform-integration boundary (plan section 1);
3. after the owner creates the VK Games project and provides `app_id`, continue with VK Bridge, `build:vk`, VK Hosting config and platform testing.

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
6. on permitted `main` runs, upload `dist` and deploy it to GitHub Pages.

PR runs validate candidates but do not publish them. Production Pages deployment is guarded to `main`.

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

For VK Games, storage must be accessed through the planned platform boundary so the existing local-save behavior can remain the first implementation while cloud/platform storage can be introduced later without duplicating gameplay logic.

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

Historical acceptance/build receipts remain in the numbered design documents and changelog.

## Documentation synchronization rule

GitHub `main`, GitHub `docs/` and the Notion **RPChess — Центр проекта** hierarchy must describe the same accepted production state and current active delivery stage.

For active work the lifecycle remains:

`SPEC → IMPLEMENTED → AUTOTESTED → HUMAN ACCEPTED (when required) → DOCS SYNCED → MERGED → PRODUCTION VERIFIED`

A green technical gate is not a substitute for Human Acceptance on player-facing UI/gameplay changes.
