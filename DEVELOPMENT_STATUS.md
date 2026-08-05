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
| Browser modular board renderer | Complete foundation | Canvas renderer, high-DPI fitting, technical fallbacks, coordinates, overlay hooks and standalone preview |
| Asset intake | Complete foundation | Canonical staged paths, PNG validation, safe copy/repair and replacement review |
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
| Pre-run selection | Complete foundation | Immutable king, doctrine and regional hero selection with compatibility, roster limits, locking, snapshots and deterministic bootstrap handoff |
| Browser pre-run selection | Complete foundation | Accessible host/client/presenter, missing-art fallbacks, responsive layout and standalone preview |

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
- opaque blocker legality across chess, scenario, reserve, ward, AI, presenter and saves;
- pre-run selection compatibility, locking and snapshot restoration;
- browser selection command, escaping, accessibility-state and runtime-handoff checks.

Every merged foundation listed above passed its required CI before entering `main`.

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

Browser previews:

```text
game/tools/modular-board-preview.html
game/tools/vertical-slice-preview.html
game/tools/run-selection-preview.html
```

Missing final art is represented by visible technical cells or fallback cards rather than blank space.

## Current vertical-slice flow

The production-ready isolated path now has these gates:

```text
pre-run selection
→ locked king / doctrine / hero roster
→ deterministic Iron Marches act graph
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
2. Render figures, statuses, visible blockers, objectives and legal targeting on the modular board using approved assets or technical fallbacks.
3. Add deployment and reserve presentation before each production encounter.
4. Connect pre-run selection, campaign presenter, event screen, combat presenter, boss transitions and rewards into one browser navigation shell.
5. Run the complete authored Iron Marches act through save/reload, replay, missing-art, RU/EN and deterministic-seed verification in the browser build.
6. Complete controller focus, remapping foundation, text scaling, reduced motion, contrast and Steam Deck layout stress tests.
7. Validate the first approved asset package in the running slice and replace fallbacks without changing gameplay data.
8. Request explicit acceptance before replacing the public legacy runtime; preserve the legacy path as rollback until the new path passes acceptance.

## Intervention gate

No intervention is required for continued browser bundling, navigation-shell, deployment/reserve presentation, validation, accessibility and fallback work. User approval becomes necessary before declaring specific visual candidates canonical, locking disputed balance values, approving the complete vertical slice, or replacing the public legacy runtime.
