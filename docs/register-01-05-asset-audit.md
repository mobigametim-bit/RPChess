# Registers 01–05 — asset integrity and runtime-use audit

Date: 2026-08-07

## Result

The repository contains **518 supplied visual assets** covered by Registers 01–05, with no duplicate repository path across the five supplied sets:

- Register 01: **141** foundation/region/king/doctrine/VFX assets;
- Register 02: **126** hero and political-character assets;
- Register 03: **72** relic icons;
- Register 04: **74** supplied unique event illustrations;
- Register 05: **105** boss visual files = 15 boss kits × 7 files.

Automated source of truth: `tests/register-01-05-integrity.cjs`.

Register 05 image-dimension validation: `tests/register-05-boss-assets.cjs`.

## Documentation-link audit

`CONTENT_AND_ASSET_PRODUCTION_REGISTER.md` points to all five annexes using valid repository-relative paths:

- `register/REGISTER_01_FOUNDATIONS.md`;
- `register/REGISTER_02_HEROES_AND_POLITICS.md`;
- `register/REGISTER_03_RELICS.md`;
- `register/REGISTER_04_EVENTS.md`;
- `register/REGISTER_05_ENCOUNTERS_AND_BOSSES.md`.

The cross-register test fails if an annex is renamed/deleted or if the master link becomes stale.

Two stale art-status areas were corrected during this audit:

1. Register 03 still described all 72 relic icons as `MISSING` although they had already been imported; the art rows are now `REVIEW`.
2. Register 05 still described all fifteen boss visual kits as `MISSING`; the visual rows are now `REVIEW`, while boss gameplay data/AI/localization/fixtures remain separate acceptance work.

## Register 01

Canonical import manifest: `content/assets/register_01_assets.json`.

Browser catalog: `game/js/register-01-assets.mjs`.

Coverage: **141 / 141** supplied files exist and are represented by the canonical catalog.

Current runtime use includes modular board cells, deployment/blocker overlays, focus/VFX, Iron Marches region scenes, king/doctrine art and other implemented presentation surfaces. Future-region art is intentionally catalogued before its gameplay region exists; it is not injected into unrelated Iron Marches screens merely to create artificial usage.

Existing dedicated regression: `tests/register-01-runtime-assets.cjs`.

## Register 02

Canonical import manifest: `content/assets/register_02_assets.json`.

Browser catalog: `game/js/register-02-assets.mjs`.

Coverage: **126 / 126** supplied files exist and are represented by the canonical catalog:

- 36 heroes × portrait/badge/ability icon = 108;
- 18 political portraits = 18.

Current use includes hero selection, hero cards/details/codex and the political portrait catalog. Iron Marches production hero records resolve the canonical Register 02 paths.

Existing dedicated regressions: `tests/register-02-runtime-assets.cjs`, `tests/register-02-presenter-extension.cjs`, `tests/register-02-audit-report.cjs`.

## Register 03

Canonical manifest: `content/manifests/register-03-relics.json`.

Image audit: `content/audits/register_03_relic_assets.json`.

Browser catalog: `game/js/register-03-relic-assets.mjs`.

Coverage: **72 / 72** relic icons exist, are 512×512 runtime assets and are available to the relic UI/codex.

Existing dedicated regressions: `tests/register-03-relic-assets.cjs`, `tests/register-03-relic-ui.cjs`.

## Register 04

Canonical supplied-art manifest: `content/manifests/register-04-events.json`.

Browser resolver: `game/js/register-04-event-assets.mjs`.

Coverage: **74 / 74 supplied unique illustrations** exist and resolve by event ID/alias.

Important: Register 04 defines **140 authored event content records**, but the project owner supplied 74 unique event illustrations. Therefore `74/74 supplied art complete` and `140 event records planned` are both correct; they measure different things. Only events that have been implemented by gameplay should appear during a run. Unimplemented future-event art remains safely catalogued.

Existing dedicated regression: `tests/register-04-event-assets.cjs`.

## Register 05

Canonical supplied boss-art manifest: `content/manifests/register-05-boss-assets.json`.

Browser catalog: `game/js/register-05-boss-assets.mjs`.

Coverage: **15 / 15 boss visual kits, 105 / 105 files**.

Every boss resolves:

- `portrait.png` — 768×768;
- `piece.png` — 512×512;
- `arena.jpg` — 1600×900;
- `phase_01.png` — 512×512;
- `phase_02.png` — 512×512;
- `phase_03.png` — 512×512;
- `phase_transition.png` — 1024×1024 runtime transition art.

The production boss presenter now consumes the Register 05 catalog. The currently implemented Iron Regent uses its boss-specific arena, portrait, current/next phase sigil and transition art. The other fourteen kits are canonical and immediately resolvable when their gameplay boss records are implemented.

Important: the 96 encounter YAML/JSON modules described by Register 05 are **content/data modules, not visual assets**. Their `MISSING` status is not an asset-upload problem. Likewise, boss data, AI profiles, objectives, RU/EN text and validation fixtures are separate from the 105 visual files.

## What “used” means in this audit

Three states are distinguished deliberately:

1. **Present** — the supplied file exists at its canonical repository path.
2. **Catalogued** — runtime/browser code can resolve the file by stable content ID without a hard-coded ad-hoc path.
3. **Actively rendered by current gameplay** — the corresponding game content is already implemented and reaches a player-facing surface.

All **518 / 518 supplied visual files are present and catalogued**.

Not all future P1 assets are actively rendered today, because many belong to regions, events or bosses that are not yet implemented. Treating those as “unused defects” would be incorrect: the correct contract is to keep them canonical and ready until the matching gameplay content is added.

For the currently implemented Iron Marches vertical slice, the required Register 01–05 art paths are connected to the relevant runtime/UI surfaces and covered by regression tests.
