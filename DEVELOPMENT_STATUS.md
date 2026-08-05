# RPChess development status

**Updated:** 2026-08-05  
**Source of truth:** merged code and CI on `main`.  
**Runtime policy:** the new production vertical slice remains isolated at `game/vertical-slice.html`; public legacy `index.html` stays rollback-safe until explicit acceptance.

## Completed foundations

| Area | Status | Main result |
|---|---|---|
| Phase 0 audit and production register | Complete | Audit, target architecture, schemas, test strategy, release checklist and full content/asset register |
| Repository normalization | Complete | Normal source tree in `game/`; no ZIP/patch-chain source of truth; required local assets |
| Legacy characterization | Complete | Current public behavior protected by regression tests |
| Determinism | Complete foundation | Named RNG streams, snapshots, deterministic IDs, command/event envelopes |
| Legal chess core | Complete foundation | Check, mate, stalemate, castling, en passant, promotion, self-check prevention and perft |
| Alternating combat | Complete foundation | One player action followed by one opponent action, deterministic replay |
| Deployment and reserve core | Complete foundation | Command budget, legal deployment zones, order points and reserve actions |
| Persistent piece identity | Complete foundation | Hero/talent/relic identity survives movement, captures, castling, promotion and reserve |
| Visible statuses and ward | Complete foundation | Closed status set, durations, events, restrictions and first-capture interception |
| Figure progression and relic loadouts | Complete foundation | Three stars, passive policy, hero specialization and figure-bound relic slots |
| Modular boards | Complete foundation | Runtime cells from `tile_light.png` / `tile_dark.png`; arbitrary masks; no frame/underlay dependency |
| Browser board renderer | Complete foundation | High-DPI Canvas renderer, real modular tiles, coordinates, overlays and load-error fallbacks |
| Asset intake | Complete foundation | Canonical staged paths, validation, safe replacement and review states |
| Register 01 asset package | Imported — REVIEW | All 141 candidates normalized into `game/assets/...`; 30 records and 9 board themes moved to `REVIEW`; no unmapped images |
| Register 01 runtime visuals | Integrated in isolated slice | Region scenes/crests, modular tiles, blocker/start-zone/focus art, move markers and battle VFX replace placeholders |
| Atomic saves | Complete foundation | Three profiles, checksums, pending/current/backup recovery, migrations and conflict classification |
| Browser persistence | Complete | localStorage-backed atomic profiles, autosave per resolved command, recovery and continuation after reload |
| Browser profile selector | Complete | Three accessible slots with Continue, New Campaign and Delete; profile isolation and recovery metadata |
| Data-driven content | Complete foundation | Typed regions, kings, doctrines, heroes, relics, events, encounters and bosses |
| Iron Marches production content | Vertical-slice draft complete | One region, king, doctrine, six heroes/relics, twelve events, six encounters and two-phase boss with RU/EN |
| Authored event choices and effects | Complete foundation | Explicit choices, deterministic effects, flags, Chronicle hooks and closed effect catalog |
| Legal AI | Complete foundation | Apprentice/Tactician/Warlord deterministic search, budgets and objective-aware evaluation |
| Scenario objectives and bosses | Complete foundation | Checkmate, escort, capture, hold, survival, failures and saveable multi-phase bosses |
| Visible blocker legality | Complete foundation | Blockers affect attacks, moves, castling, reserve, ward, AI, presenter, replay and saves |
| Campaign act graph | Complete foundation | Deterministic 9–12 node acts, routes, supplies, scouting and 10,000-seed validation |
| Vertical-slice runtime | Complete foundation | Campaign → event/scenario/boss → player/AI pair → reward → completion with saves/replay |
| Pre-run selection | Complete | Validated king, doctrine and hero roster selection with Register 01 art and locked runtime handoff |
| Production browser entry | Complete isolated entry | Reproducible esbuild bundle and real `vertical-slice.html`; no mock runtime and no public-index replacement |
| Browser reserve presentation | Complete | Order points, reserve cards, legal deployment cells and `start_zone.png` targeting through `PlayerCommand` |

## Current automated acceptance coverage

The main CI suite covers:

- legacy behavior and deterministic foundations;
- legal chess/perft, alternating combat and replay;
- deployment, reserve, order points and persistent identities;
- statuses, ward, progression and relic loadouts;
- modular board planning and browser/Core parity;
- Register 01 catalog paths, dimensions and VFX mappings;
- atomic saves, browser SHA-256 parity, autosave, recovery and three-profile isolation;
- typed content, RU/EN localization and closed event effects;
- objective-aware AI, scenarios and boss transitions;
- 10,000 generated campaign seeds and full vertical-slice completion;
- production Iron Marches bootstrap and browser runtime bundling;
- pre-run selection, profile selector and runtime handoff;
- reserve snapshot projection, order-point spending and browser board targeting;
- full production build containing `vertical-slice.html` and the generated runtime bundle.

Every merged item above passed its required CI before entering `main`.

## Asset production interface

Canonical Register 01 assets are stored under:

```text
game/assets/<canonical register path>
```

Machine-readable import report:

```text
content/assets/register_01_assets.json
```

Replacement candidates may be staged under:

```text
game/generated_assets/<canonical register path>
```

Validation commands:

```text
npm run assets:audit
npm run assets:intake
```

Runtime board themes use only paired cells:

```text
tile_light.png
tile_dark.png
```

Complete board rasters, frames and underlays are not runtime dependencies. Register 01 remains `REVIEW` until provenance/rights and final in-game/Steam Deck acceptance are recorded.

## Current isolated browser flow

```text
three profile slots
→ continue recovered save OR start a new run
→ king / doctrine / hero selection
→ deterministic Iron Marches map
→ authored event OR combat scenario
→ blocker-aware legal chess
→ visible reserve deployment and order-point spending
→ one objective-aware AI response
→ reward and autosave
→ next node
→ two-phase Iron Regent boss
→ campaign completion
```

Direct test launch remains possible with:

```text
game/vertical-slice.html?profile=profile-1
```

A fresh selected profile can be forced with `&new=1`. The public legacy `index.html` remains unchanged.

## Next integration sequence

1. Add a true pre-battle deployment gate using the existing deployment core and imported `start_zone.png`.
2. Preserve chosen army composition from pre-run selection into deployment, reserve and encounter identities rather than relying on scenario-only fixture placement.
3. Add controller-first board navigation, promotion choice UI and non-pointer reserve placement.
4. Run complete browser act tests across all three profiles, RU/EN, save/reload at every gate and load-error fallbacks.
5. Add text scaling, remapping foundation, contrast modes and Steam Deck 1280×800 stress coverage.
6. Perform visual acceptance of Register 01 and promote individual records to `APPROVED` only with provenance and in-game evidence.
7. Request explicit acceptance before replacing the public legacy runtime; retain rollback until the new route passes release acceptance.

## Intervention gate

No intervention is required for deployment integration, roster propagation, controller navigation, save/reload coverage, accessibility and fallback work. User approval is required before promoting art to `APPROVED`, locking disputed balance values, accepting the complete vertical slice or replacing/removing the public legacy runtime.
