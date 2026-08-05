# RPChess development status

**Updated:** 2026-08-05  
**Source of truth:** merged code and CI on `main`.  
**Runtime policy:** new systems remain isolated from the legacy browser battle until the vertical-slice presentation and content acceptance gates pass.

## Completed foundations

| Area | Status | Main result |
|---|---|---|
| Phase 0 audit and production register | Complete | Audit, target architecture, schemas, test strategy, release checklist and full content/asset register |
| Repository normalization | Complete | Normal source tree in `game/`; no ZIP/patch-chain source of truth; local required assets |
| Legacy characterization | Complete | Current playable behavior preserved by regression tests |
| Determinism | Complete foundation | Named RNG streams, snapshots, deterministic IDs, command/event envelopes |
| Legal chess core | Complete foundation | Check, mate, stalemate, castling, en passant, promotion, self-check prevention and perft |
| Alternating combat | Complete foundation | One player action followed by one opponent action, deterministic replay |
| Deployment and reserve | Complete foundation | Command budget, legal deployment zone, order points and reserve actions |
| Persistent piece identity | Complete foundation | Hero/talent/relic identity survives movement, capture history, castling, promotion and reserve |
| Visible statuses | Complete foundation | One-primary-status rule, durations, events and movement restrictions |
| Ward protection | Complete | First legal capture interception with check-safety and en-passant support |
| Figure progression and relic loadouts | Complete foundation | Three stars, passive policy, hero specialization and figure-bound relic slots |
| Modular boards | Complete foundation | Runtime cell plan from `tile_light.png` / `tile_dark.png`; arbitrary active-cell masks; no frame/underlay dependency |
| Browser modular board renderer | Complete foundation | Canvas renderer, high-DPI fitting, technical fallbacks, coordinates, overlay hooks and standalone preview |
| Asset intake | Complete foundation | Canonical staged paths, PNG validation, safe copy/repair and replacement review |
| Atomic saves | Complete foundation | Three profiles, checksums, pending/current/backup recovery, migrations and cloud-conflict classification |
| Data-driven content | Complete foundation | Typed registry for regions, kings, doctrines, heroes, relics, events, encounters and bosses |
| Legal AI | Complete foundation | Apprentice/Tactician/Warlord deterministic search, budgets and objective-aware evaluation |
| Scenario objectives | Complete foundation | Checkmate, escort, capture, hold and survival objectives plus explicit failure conditions |
| Boss phases | Complete foundation | Explicit two-to-three phase state machine and deterministic phase history |
| Campaign act graph | Complete foundation | Deterministic 9–12 node acts, safe routes, supplies, scouting and 10,000-seed validation |
| Vertical-slice runtime | Complete foundation | Campaign → node → scenario → player/AI pair → reward → boss completion with atomic saves and deterministic replay |

## Current automated acceptance coverage

The CI suite currently covers:

- legacy behavior characterization;
- deterministic foundations;
- legal chess/perft;
- alternating combat and replay;
- deployment, reserve and order points;
- persistent identities;
- statuses and ward interception;
- progression and relic loadouts;
- modular board planning;
- browser/Core board-plan parity;
- technical and partial-image board fallbacks;
- generated-asset intake;
- atomic profile saves and cloud conflicts;
- typed content packs and localization references;
- legal AI decisions and action corpora;
- alternative objectives and boss transitions;
- 10,000 generated campaign seeds;
- full vertical-slice campaign completion;
- player/AI action-pair enforcement;
- byte-equivalent operation replay;
- vertical-slice checkpoint save, reload and corruption recovery.

Every merged foundation listed above passed CI before merge.

## Asset production interface

Generated canonical candidates are staged under:

```text
game/generated_assets/<canonical register path>
```

Example:

```text
game/generated_assets/assets/regions/iron_marches/tile_light.png
```

Audit and intake commands:

```text
npm run assets:audit
npm run assets:intake
```

Runtime board themes require only paired 512×512 cells:

```text
tile_light.png
tile_dark.png
```

Complete board rasters, board frames and decorative underlays are not runtime dependencies.

The browser preview is available at:

```text
game/tools/modular-board-preview.html
```

It supports standard 8×8, fractured 8×8 and rectangular 10×6 layouts, board flipping and coordinate toggling. Missing final art is represented by visible technical cells rather than blank space.

## Next integration sequence

1. Add a production vertical-slice content pack containing one approved king, doctrine, region, hero set, relic set, events, encounters and boss kit.
2. Add a browser presenter for campaign routes, scenario HUD, modular board overlays, rewards and completion screens.
3. Connect the browser presenter to the deterministic vertical-slice runtime through a narrow command/snapshot bridge.
4. Run the authored vertical slice through save/reload, replay, fallback-art, RU/EN and deterministic-seed verification.
5. Complete controller focus, accessibility, layout-stress and performance checks for the slice.
6. Switch the public runtime only after explicit acceptance; keep the legacy path available as rollback until then.
7. Scale authored content and final assets after the vertical-slice acceptance gate.

## Intervention gate

No intervention is required for continued presenter, bridge, validation and fallback work. User approval becomes necessary before declaring a specific king/doctrine/region kit canonical, replacing technical visuals with final candidates, locking balance values with multiple valid design directions, or replacing the public legacy runtime.
