# RPChess development status

**Updated:** 2026-08-05  
**Source of truth:** merged code and CI on `main`.  
**Runtime policy:** new systems remain isolated from the legacy browser battle until the vertical-slice integration gate passes.

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
| Asset intake | Complete foundation | Canonical staged paths, PNG validation, safe copy/repair and replacement review |
| Atomic saves | Complete foundation | Three profiles, checksums, pending/current/backup recovery, migrations and cloud-conflict classification |
| Data-driven content | Complete foundation | Typed registry for regions, kings, doctrines, heroes, relics, events, encounters and bosses |
| Legal AI | Complete foundation | Apprentice/Tactician/Warlord deterministic search, budgets and objective-aware evaluation |
| Scenario objectives | Complete foundation | Checkmate, escort, capture, hold and survival objectives plus explicit failure conditions |
| Boss phases | Complete foundation | Explicit two-to-three phase state machine and deterministic phase history |
| Campaign act graph | Complete foundation | Deterministic 9–12 node acts, safe routes, supplies, scouting and 10,000-seed validation |

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
- generated-asset intake;
- atomic profile saves and cloud conflicts;
- typed content packs and localization references;
- legal AI decisions and action corpora;
- alternative objectives and boss transitions;
- 10,000 generated campaign seeds.

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

## Next integration sequence

1. Build a vertical-slice runtime adapter that composes campaign, scenario, battle, AI, saves and content registry without replacing the legacy browser path yet.
2. Add browser-facing modular board rendering with technical fallback cells.
3. Connect one approved king, doctrine, region, hero set, relic set, events, encounters and boss kit.
4. Run the full vertical slice through save/reload, replay and deterministic-seed verification.
5. Switch the public runtime only after regression, accessibility, performance and fallback tests pass.
6. Scale authored content and final assets after the vertical-slice acceptance gate.

## Intervention gate

No user intervention is currently required for the technical foundations. User input becomes necessary when selecting or approving final visual candidates, confirming balance/content decisions that have multiple valid design directions, and approving the vertical slice before the legacy runtime is replaced.
