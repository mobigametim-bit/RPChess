# RPChess — Current State

**Last synchronized:** 2026-09-08  
**Production branch:** `main`  
**Production commit at sync start:** `bc84d4b53db1544f338d4d7ea421e1e1d41b49d9`  
**Production URL:** https://mobigametim-bit.github.io/RPChess/

This page is the short operational snapshot of the accepted project state. Historical feature receipts remain in the numbered documents and `CHANGELOG.md`; when an old acceptance receipt conflicts with this page about deployment, responsive UI or current asset usage, this page describes the current production configuration.

## Production and delivery

RPChess is published from `main` through **GitHub Pages**.

`.github/workflows/pages.yml` runs on pull requests and on pushes to `main`:

1. `npm ci --no-audit --no-fund`;
2. `npm run gate:local`;
3. Pages artifact-size guard (`dist` must remain below 1 GB);
4. Playwright/Chromium installation;
5. real browser verification under the project subpath `/RPChess/` using Classic Chess/Stockfish and responsive viewport contracts;
6. on non-PR runs, upload `dist` and deploy it to GitHub Pages.

PR runs validate the candidate but do not publish it. Pushes to accepted `main` publish production after the same gate.

The post-merge workflow for `main@bc84d4b53db1544f338d4d7ea421e1e1d41b49d9` completed successfully: canonical gate/build, `/RPChess/` Chromium verification and GitHub Pages deploy all passed.

Cloudflare configuration remains in the repository for compatibility/legacy preview workflows, but GitHub Pages is the canonical public production deployment described by the active workflow and documentation.

## Current accepted UI contract

The landscape redesign and live-device correction cycle is merged and human accepted.

Canonical viewport targets:

- desktop landscape: `1920×1080`;
- tablet landscape: `1024×768`;
- mobile landscape: `844×390`;
- portrait gameplay: bilingual rotate-device lock.

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

High-resolution masters remain in the repository where required; production-size budgets protect the shipped `dist` payload rather than destructively replacing all source masters.

## Localization

Canonical language codes are `ru` and `en`.

The accepted main branch includes bilingual shell/runtime coverage and live-verified English presentation for Roster, Battle, Skirmish, Travel, Settlement and Event across desktop/tablet/mobile. Event mechanics remain language-independent; localization is presentation-only.

The broader `feature/localisation-completion` work described in `localization_glossary.md` is a separate completion track and is not implied to be fully release-accepted merely by this production snapshot.

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

GitHub `main`, GitHub `docs/` and the Notion **RPChess — Центр проекта** hierarchy must describe the same accepted production state.

For active work the lifecycle remains:

`SPEC → IMPLEMENTED → AUTOTESTED → HUMAN ACCEPTED (when required) → DOCS SYNCED → MERGED → PRODUCTION VERIFIED`

A green technical gate is not a substitute for Human Acceptance on player-facing UI/gameplay changes.
