# RPChess Reboot

Fantasy chess roguelite built around **classical 8×8 chess**, persistent named heroes and a Journey loop. **Infinite Kingdom** is part of the production game on `main` (accepted PR #195, 12 November 2026).

## Current development mode

The project is being rebuilt feature-by-feature. The previous Iron Marches vertical slice is preserved in:

- branch `archive/iron-marches-v1`;
- legacy commit `035fb817a93f53047a1d20f7cdfc9093b0f7d611`.

Active development happens through feature branches and human playtest gates before merge to `main`.

## Active design documentation

The source-of-truth documentation lives under [`docs/`](docs/). Start with the current operational snapshot:

- [`CURRENT_STATE.md`](docs/CURRENT_STATE.md) — production/runtime state and historical receipts;
- [`DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) — **approved focused-PR / full pre-merge testing, release gates, and branch retention rules**;
- [`KINGDOM_EXPLORATION_ECONOMY_BIOME_DESIGN.md`](docs/KINGDOM_EXPLORATION_ECONOMY_BIOME_DESIGN.md) — Infinite Kingdom design, feature-stage progress and acceptance;
- [`KINGDOM_ECONOMY_ARMY_SPEC.md`](docs/KINGDOM_ECONOMY_ARMY_SPEC.md) — economy, permanent Army, recruitment and settlement balance;
- [`KINGDOM_ROADS_AND_TRAVELERS_PLAN.md`](docs/features/KINGDOM_ROADS_AND_TRAVELERS_PLAN.md) — updated roads and animated travelers (planned, not yet implemented);
- [`ARENA_PLAN.md`](docs/features/ARENA_PLAN.md) — historical Arena design and milestone plan;
- `00_PRODUCT_VISION.md`
- `01_CORE_GAME_LOOP.md`
- `02_CHESS_RULES.md`
- `03_TRAVEL_SYSTEM.md`
- `04_ROSTER.md`
- `05_SKIRMISH.md`
- `06_BATTLE.md`
- `07_PUZZLES.md`
- `08_EVENTS.md`
- `09_SETTLEMENT.md`
- `10_RESOURCES.md`
- `11_CHESS_AI.md`
- `12_ENCOUNTER_GENERATION.md`
- `13_CONTENT.md`
- `14_ASSETS.md`
- `15_SAVE_SYSTEM.md`
- `16_UI_UX.md`
- `17_TECH_ARCHITECTURE.md`
- `ROADMAP.md`
- `CHANGELOG.md`

The numbered documents and changelog intentionally keep historical acceptance receipts. When an old receipt describes a superseded hosting/UI/asset state, `CURRENT_STATE.md` is the operational reference for current production.

**Documentation policy (10.11.2026): GitHub is the sole required project-documentation source of truth.** Update the applicable files under `docs/` and reference the PR/commit where needed. Notion is optional, archival and **never a release/merge requirement**; automatic GitHub–Notion synchronization is not required.

## Development workflow

`SPEC → IMPLEMENTED → AUTOTESTED → HUMAN ACCEPTED (when required) → GITHUB DOCS UPDATED → MERGED → PRODUCTION VERIFIED`

No player-facing feature is treated as accepted merely because CI is green.

## Local verification

```bash
npm ci
npm test
npm run build
```

For the canonical project gate use `npm run gate:local`. The complete pre-merge gate is `npm run gate:full` (including all 36 default Chromium suites). During development, GitHub runs only selected coupled tests based on the PR diff. See [development rules](docs/DEVELOPMENT_WORKFLOW.md).

## Production

Production: https://mobigametim-bit.github.io/RPChess/

PRs run focused tests; after explicit human acceptance the `release-approved` label triggers full pre-merge validation. Merge alone does not publish. Production Pages publishes only on an authorized release commit or workflow dispatch from `main`, after its own production verification. See [CI and branch governance](docs/DEVELOPMENT_WORKFLOW.md).

Cloudflare configuration remains in the repository for compatibility/legacy preview workflows, but GitHub Pages is the canonical public production host.
