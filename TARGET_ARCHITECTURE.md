# TARGET_ARCHITECTURE.md

**Status:** Proposed production architecture v1  
**Constraint:** Preserve the working HTML5/Canvas prototype while migrating incrementally.  
**Primary goals:** deterministic simulation, offline operation, testability, data-driven content, Steam-ready platform abstraction.

## 1. Architectural principles

1. **The simulation is pure and deterministic.** UI, audio, file I/O and Steam calls never decide game outcomes.
2. **Commands change state; events describe what happened.** This enables saves, replays, achievements and debugging.
3. **Standard chess and scenario rules are explicit layers.** Special missions may extend or replace win conditions, but never silently bypass legal movement.
4. **Content is data, not conditionals.** Events, relics, talents, kings, doctrines, heroes, factions, encounters and achievements use versioned schemas.
5. **Platform capabilities are adapters.** Browser/offline mode remains fully functional when Steam is absent.
6. **Every migration leaves a playable build.** Legacy modules remain behind adapters until replacement tests pass.
7. **No deployment-time mutation of source.** The repository contains the actual source used to build the game.

## 2. Proposed source tree

```text
apps/
  web/
    index.html
    bootstrap.ts
  desktop/
    wrapper/
    packaging/

src/
  core/
    chess/
      board.ts
      piece.ts
      attacks.ts
      legalMoves.ts
      check.ts
      mate.ts
      castling.ts
      enPassant.ts
      promotion.ts
      notation.ts
      positionHash.ts
    rules/
      ruleset.ts
      standardChessRules.ts
      scenarioRules.ts
      objectiveRules.ts
    state/
      gameState.ts
      reducers.ts
      selectors.ts
      invariants.ts
    commands/
      command.ts
      validation.ts
      execute.ts
    events/
      domainEvent.ts
      eventBus.ts

  combat/
    battleState.ts
    actionScheduler.ts
    deployment.ts
    reserve.ts
    orderPoints.ts
    statuses.ts
    environment.ts
    bossPhases.ts
    objectives.ts

  ai/
    actionProvider.ts
    evaluation.ts
    search.ts
    objectivePlanner.ts
    abilityPlanner.ts
    difficultyProfiles.ts
    deterministicTieBreak.ts

  campaign/
    runState.ts
    actGraph.ts
    region.ts
    scouting.ts
    routeConsequences.ts
    nodeResolution.ts

  procedural/
    rng.ts
    streams.ts
    mapGenerator.ts
    encounterGenerator.ts
    rewardGenerator.ts
    shopGenerator.ts
    validators/
    batchRunner.ts

  army/
    roster.ts
    commandCost.ts
    injuries.ts
    progression.ts
    promotion.ts

  heroes/
  relics/
  talents/
  doctrines/
  kings/
  factions/
  kingdom/
  economy/
  events/

  save/
    saveService.ts
    profileStore.ts
    runStore.ts
    migrations/
    integrity.ts
    backup.ts
    conflict.ts

  replay/
    replayFormat.ts
    recorder.ts
    player.ts
    stateHash.ts

  localization/
    catalog.ts
    formatter.ts
    pluralRules.ts
    validator.ts

  audio/
    audioService.ts
    mixer.ts
    playlist.ts
    sfx.ts
    manifest.ts

  rendering/
    renderModel.ts
    boardRenderer.ts
    animationTimeline.ts
    vfx.ts

  ui/
    navigation/
    screens/
    components/
    viewModels/
    focus/

  input/
    actions.ts
    keyboard.ts
    mouse.ts
    controller.ts
    remapping.ts

  accessibility/
    settings.ts
    colorModes.ts
    motion.ts
    contrast.ts

  editor/
    model.ts
    validation.ts
    authoring/
    testPlay.ts
    packaging.ts

  workshop/
    packageFormat.ts
    moderation.ts
    ugcAdapter.ts

  platform/
    capabilities.ts
    browserAdapter.ts
    desktopAdapter.ts
    steamAdapter.ts

content/
  schemas/
  localization/
  units/
  kings/
  doctrines/
  heroes/
  relics/
  talents/
  factions/
  regions/
  events/
  encounters/
  bosses/
  achievements/
  tutorials/

assets/
  branding/
  ui/
  boards/
  pieces/
  portraits/
  regions/
  events/
  relics/
  vfx/
  audio/

scripts/
  validate-content.mjs
  batch-seeds.mjs
  build-web.mjs
  package-desktop.mjs
  generate-manifest.mjs

tests/
  unit/
  integration/
  property/
  fixtures/
  visual/
  performance/
  platform/
```

TypeScript is recommended for production source because schema-heavy state, command and platform interfaces benefit from static checking. The migration can begin by importing existing JavaScript modules through compatibility wrappers; an immediate full TypeScript rewrite is not required.

## 3. Core state model

### Immutable state transitions

```text
Command + Current State + Ruleset + RNG Stream
                    ↓
             Validation Result
                    ↓
          New State + Domain Events
```

A command must never call UI, audio, Steam or file APIs. Domain events are consumed by:

- animation;
- audio;
- achievements;
- replay recording;
- analytics/debug logs;
- save checkpoints.

### Example commands

- `MovePiece`
- `Castle`
- `PromotePawn`
- `UseRelicAction`
- `UseHeroAbility`
- `DeployReserve`
- `EndSetup`
- `ChooseReward`
- `ResolveEventChoice`
- `BuyShopOffer`
- `SelectRouteNode`

### Example events

- `PieceMoved`
- `PieceCaptured`
- `KingChecked`
- `CheckmateDeclared`
- `ObjectiveCompleted`
- `PieceInjured`
- `OrderPointsChanged`
- `RewardChosen`
- `FactionStateChanged`
- `SaveCheckpointRequested`

## 4. Ruleset architecture

### Standard chess ruleset

Owns:

- board bounds;
- piece movement;
- attack maps;
- legal move filtering;
- check/mate/stalemate;
- castling;
- en passant;
- promotion;
- draw rules selected for campaign use.

### Scenario ruleset

Composes the standard ruleset with:

- alternative objectives;
- board shapes;
- environment objects;
- reserve/deployment rules;
- boss phases;
- scenario-specific allowed actions.

Every override is named and visible in scenario data. No ability may mutate geometry invisibly.

## 5. Determinism and RNG

Use named RNG streams derived from run seed and version:

- `campaign-map`;
- `event-selection`;
- `encounter-layout`;
- `enemy-roster`;
- `reward-offers`;
- `shop-stock`;
- `cosmetic-variation`.

Simulation IDs must derive from deterministic counters or hashes, not `Date.now()`/`Math.random()`.

Persist:

- game version;
- rules version;
- content version;
- seed;
- stream states;
- decision history hash.

## 6. Content architecture

Every content file has:

- stable ID;
- schema version;
- localization keys;
- tags;
- unlock conditions;
- compatibility constraints;
- references by stable ID;
- validation rules.

Runtime loads a compiled content bundle generated from source JSON/YAML. The compiler rejects:

- duplicate IDs;
- missing localization keys;
- missing assets;
- invalid references;
- incompatible effects;
- unreachable event choices;
- invalid scenario objectives.

## 7. Save architecture

### Separation

- `ProfileSave` — kingdom/meta progress.
- `RunSave` — active campaign.
- `BattleCheckpoint` — exact current battle.
- `SettingsSave` — local device settings.
- `ReplayFile` — commands and version metadata.

### Transaction protocol

1. serialize canonical JSON/binary payload;
2. validate schema and invariants;
3. calculate checksum;
4. write `.tmp`;
5. flush;
6. rotate current to `.bak`;
7. rename `.tmp` to current;
8. verify readback.

Browser adapter emulates this with IndexedDB records and generations. Desktop adapter uses atomic file operations.

## 8. Platform capabilities

```ts
interface PlatformCapabilities {
  files: FileStore;
  cloud: CloudStore | NullCloudStore;
  achievements: AchievementService | NullAchievementService;
  leaderboards: LeaderboardService | NullLeaderboardService;
  workshop: WorkshopService | NullWorkshopService;
  overlay: OverlayService | NullOverlayService;
  input: PlatformInputInfo;
  lifecycle: LifecycleService;
}
```

Gameplay never imports Steam directly. Browser/offline mode receives null services with predictable behavior.

## 9. Rendering boundary

Simulation exposes a `BattleRenderModel` containing only:

- board geometry;
- visible pieces;
- legal highlights;
- objective markers;
- environment objects;
- statuses;
- queued domain events.

The renderer never reads or mutates full campaign state. Animation consumes domain events through a timeline and can be accelerated/skipped without changing simulation.

## 10. UI architecture

- Screen router with explicit screen IDs and parameters.
- View models convert domain state into localized display data.
- Components use semantic controls and controller focus metadata.
- No nested interactive controls.
- Localization keys, not inline RU/EN ternaries.
- Layout tests at 1920×1080, 1280×800, 1366×768 and text-scale extremes.

## 11. AI boundary

AI receives the same legal action list available to the player and returns one command. It cannot mutate state or access hidden data.

Difficulty profiles define:

- search depth/time budget;
- evaluation noise within bounded deterministic rules;
- scenario-planning weight;
- ability-use sophistication.

No hidden resources or illegal actions.

## 12. Legacy compatibility layer

During migration:

```text
Legacy Game/UI
      ↕ compatibility adapters
New modules introduced one boundary at a time
```

Recommended sequence:

1. extract current source tree;
2. wrap existing `Game` as `LegacyGameFacade`;
3. introduce typed content loader;
4. introduce pure RNG and ID service;
5. introduce new chess core for test scenarios;
6. route standard battles to new core;
7. migrate campaign/economy;
8. migrate saves;
9. migrate UI and platform services;
10. remove legacy facade when no production route uses it.

## 13. Build and repository architecture

Target build:

```text
source + content + asset manifest
          ↓ validate
compiled web bundle + copied assets
          ↓ test
web artifact / desktop package
```

Rules:

- no source ZIP in repository as canonical code;
- no network downloads during release build;
- all release assets are versioned or fetched by a verified dependency stage before the release candidate;
- lockfiles committed;
- deterministic build manifest generated;
- build hashes recorded.

## 14. Acceptance criteria for architecture migration

Architecture migration is complete when:

- current playable loop runs from normal source files;
- all new content is schema-validated;
- standard battles use the new legal chess core;
- replays reproduce state hashes;
- saves use profile/run/checkpoint separation and recovery;
- Steam-disabled mode passes all gameplay tests;
- UI has controller focus navigation;
- deployment no longer applies string-replacement patches.
