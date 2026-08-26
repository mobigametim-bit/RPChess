# RPChess Reboot

Fantasy chess roguelite built around **classical 8×8 chess**, a persistent roster of personalized living chess pieces, and an endless sequence of three-way travel choices.

## Current development mode

The project is being rebuilt feature-by-feature. The previous Iron Marches vertical slice is preserved in:

- branch `archive/iron-marches-v1`;
- legacy commit `035fb817a93f53047a1d20f7cdfc9093b0f7d611`.

Active development happens through feature branches and human playtest gates before merge to `main`.

## Active design documentation

The source-of-truth documentation lives under [`docs/`](docs/):

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

GitHub docs and Notion must describe the same accepted version of the game.

## Development workflow

`SPEC → IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DOCS SYNCED → DONE`

No later gameplay feature is treated as accepted merely because CI is green.

## Local verification

```bash
npm ci
npm test
npm run build
```

The live build is deployed automatically through Cloudflare from accepted `main` changes. Feature branches use preview deployments for manual testing before merge.
