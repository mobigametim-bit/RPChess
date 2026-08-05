# RPChess development status

**Updated:** 2026-08-05  
**Source of truth:** merged code and CI on `main`.  
**Runtime policy:** new systems remain isolated from the legacy public battle until the vertical-slice presentation, content, accessibility and acceptance gates pass.

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
| Browser modular board renderer | Complete foundation | Canvas renderer, high-DPI fitting, real modular tiles, technical load-error fallbacks, coordinates and overlay hooks |
| Asset intake | Complete foundation | Canonical staged paths, PNG validation, safe copy/repair and replacement review |
| Register 01 production asset package | Imported — REVIEW | All 141 candidates normalized into canonical `game/assets/...` paths; 30 register records and 9 board themes moved from `MISSING` to `REVIEW`; no unmapped source images |
| Register 01 runtime visuals | Integrated in isolated vertical slice | Regional banners/crests/scenes, modular tiles, blocker/focus art, move markers and check/capture/promotion/checkmate VFX replace presenter placeholders; fallbacks remain only for file-load errors |
| Atomic saves | Complete foundation | Three profiles, checksums, pending/current/backup recovery, migrations and cloud-conflict classification |
| Data-driven content | Complete foundation | Typed registry for regions, kings, doctrines, heroes, relics, events, encounters and bosses |
| Iron Marches production content | Vertical-slice draft complete | One region, king, doctrine, six heroes, six relics, twelve authored events, six encounters and a two-phase boss with RU/EN localization |
| Authored event choices | Complete foundation | Explicit three-to-four choice gate, deterministic consequences, flags, Chronicle hooks, replay and save support |
| Event effect catalog | Complete foundation | Closed versioned effect vocabulary; unknown effects fail build and execution instead of silently doing nothing |
| Legal AI | Complete foundation | Apprentice/Tactician/Warlord deterministic search, budgets and objective-aware evaluation |
| Scenario objectives | Complete foundation | Checkmate, escort, capture, hold and survival objectives plus explicit failure conditions |
| Visible blocker legality | Complete foundation | Active blocker cells alter attacks, legal moves, castling, reserve, ward, AI, presenter, replay and saves through one battle-state rule source |
| Boss phases | Complete foundation | Explicit two-to-three phase state machine, player/AI pairs, saveable transitions and deterministic phase history |
| Campaign act graph | Complete foundation | Deterministic 9–12 node acts, safe routes, supplies, scouting and 10,000-seed validation |
| Vertical-slice runtime | Complete foundation | Campaign → node → event/scenario/boss → player/AI pair → reward → completion with atomic saves and deterministic replay |
| Iron Marches production bootstrap | Complete foundation | Real compiled content, scenario templates, board themes, localization and effect catalog create the act without test-only fixtures |
| Pre-run selection | Open integration PR | Deterministic selection state exists on PR #30 but is not yet merged into `main` |
| Browser pre-run selection | Open integration PR | Host/client/presenter exists on PR #31 but is not yet merged into `main` |

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
- real modular tile integration and technical load-error fallbacks;
- generated-asset intake;
- exact Register 01 catalog coverage for 141 unique canonical paths;
- region, king and doctrine visual-path registration;
- check/capture/promotion/checkmate VFX event mapping;
- atomic profile saves and cloud conflicts;
- typed content packs and localization references;
- authored event choices and closed effect references;
- legal AI decisions and action corpora;
- alternative objectives and boss transitions;
- 10,000 generated campaign seeds;
- full vertical-slice campaign completion;
- player/AI action-pair enforcement;
- byte-equivalent operation replay;
- vertical-slice checkpoint save, reload and corruption recovery;
- production Iron Marches scenario construction;
- multi-phase boss save/reload/replay and mate objective;
- opaque blocker legality across chess, scenario, reserve, ward, AI, presenter and saves.

Every merged foundation listed above passed its required CI before entering `main`.

## Asset production interface

The complete Register 01 candidate package is stored under canonical runtime paths:

```text
game/assets/<canonical register path>
```

Examples:

```text
game/assets/regions/iron_marches/map_banner.jpg
game/assets/regions/iron_marches/tile_light.png
game/assets/kings/oathkeeper/portrait.png
game/assets/doctrines/fortress/emblem.png
```

The machine-readable import and normalization report is:

```text
content/assets/register_01_assets.json
```

It records source folder/file, original dimensions and mode, normalized output dimensions and format, byte size and `REVIEW` status for all 141 files.

Generated replacement candidates may still be staged under:

```text
game/generated_assets/<canonical register path>
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

Browser previews currently merged in `main`:

```text
game/tools/modular-board-preview.html
game/tools/vertical-slice-preview.html
```

A fallback is rendered only when a referenced file cannot be loaded or when a future screen has no approved asset record. Register 01 records remain `REVIEW`, not `APPROVED`, until provenance/rights and final in-game/Steam Deck visual acceptance are recorded.

## Current vertical-slice flow

The production-ready isolated path currently has these gates:

```text
deterministic Iron Marches act graph
→ authored event choice or combat scenario
→ blocker-aware legal chess action
→ one objective-aware AI response
→ reward
→ save / replay / next node
→ two-phase Iron Regent boss
→ campaign completion
```

The public legacy `index.html` is still the rollback-safe default and has not been replaced.

## Next integration sequence

1. Add a browser entry point that bundles the CommonJS production bootstrap behind the existing snapshot/command boundary without exposing internal mutable state.
2. Merge and reconcile the pre-run selection state and browser presenter from PRs #30 and #31 against current `main`, using the imported king/doctrine art.
3. Add deployment and reserve presentation before each production encounter, including the imported start-zone overlay.
4. Connect pre-run selection, campaign presenter, event screen, combat presenter, boss transitions and rewards into one browser navigation shell.
5. Run the complete authored Iron Marches act through save/reload, replay, real-art load failure, RU/EN and deterministic-seed verification in the browser build.
6. Complete controller focus, remapping foundation, text scaling, reduced motion, contrast and Steam Deck layout stress tests.
7. Perform visual acceptance for the imported Register 01 package and promote individual records from `REVIEW` to `APPROVED` only after provenance/rights and in-game checks pass.
8. Request explicit acceptance before replacing the public legacy runtime; preserve the legacy path as rollback until the new path passes acceptance.

## Intervention gate

No intervention is required for continued browser bundling, navigation-shell, deployment/reserve presentation, validation, accessibility and fallback work. User approval becomes necessary before promoting specific visual candidates to `APPROVED`, locking disputed balance values, approving the complete vertical slice, or replacing the public legacy runtime.
