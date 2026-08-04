# IMPLEMENTATION_ROADMAP.md

**Status:** Production roadmap v1  
**Rule:** every stage ends with a runnable build and a written verification report.

## Stage 0 — audit and production planning

**Goal:** establish a trustworthy baseline before feature development.

Deliverables:

- `CURRENT_STATE_AUDIT.md`;
- `TARGET_ARCHITECTURE.md`;
- `CONTENT_AND_ASSET_PRODUCTION_REGISTER.md`;
- `CONTENT_GAP_SUMMARY.md`;
- `DESKTOP_WRAPPER_DECISION.md`;
- `TEST_STRATEGY.md`;
- `DATA_FORMATS_AND_SCHEMAS.md`;
- `RELEASE_ACCEPTANCE_CHECKLIST.md`;
- this roadmap.

Exit criteria:

- current source and deployment fully mapped;
- content gap quantified;
- architecture migration approved;
- no unresolved P0 design contradiction.

## Stage 1 — source normalization and reproducible build

**Goal:** make the repository contain the actual source of the deployed game.

Work:

- materialize extracted source tree;
- move audio/assets into repository or verified artifact storage;
- remove deployment-time string patches;
- introduce lockfile and deterministic asset manifest;
- establish CI build artifact;
- preserve existing Cloudflare URL.

Tests:

- clean clone builds without network asset downloads;
- generated `dist` matches expected baseline behavior;
- current tests pass.

## Stage 2 — characterization and pure foundations

**Goal:** protect existing behavior and introduce production module boundaries.

Work:

- add characterization fixtures;
- create TypeScript/build setup or typed JSDoc boundary;
- extract deterministic RNG streams;
- replace nondeterministic simulation IDs;
- introduce command/event types;
- wrap legacy game as compatibility facade.

Exit criteria:

- fixed-seed run and battle snapshots reproducible;
- command/event log available for new modules;
- no visible regression.

## Stage 3 — legal chess core

**Goal:** implement complete standard chess legality independently of roguelite effects.

Work:

- board/position representation;
- attack maps;
- legal moves;
- check/mate/stalemate;
- castling;
- en passant;
- promotion;
- notation/hash;
- standard 8×8 board.

Tests:

- full chess suite;
- known positions;
- perft targets;
- randomized invariants.

Exit criteria:

- pure core passes all tests;
- no UI integration required to pass this gate.

## Stage 4 — combat scheduler and scenario rules

**Goal:** create release action economy and scenario extension system.

Work:

- one player action / one enemy action scheduler;
- reactions and bounded extra actions;
- order points;
- deployment zones;
- reserve;
- objectives/failures;
- environment registry;
- visible statuses;
- boss phase state machine.

Exit criteria:

- standard battle can end by legal mate;
- one alternative objective scenario works;
- current prototype battle remains available as legacy regression mode until retired.

## Stage 5 — AI

**Goal:** legal, deterministic and objective-aware AI with three difficulty profiles.

Work:

- action provider;
- search/evaluation;
- scenario planner;
- ability/environment planning;
- deterministic tie breaks;
- time budgets.

Exit criteria:

- no illegal action in randomized test corpus;
- tactical fixture thresholds met;
- target frame responsiveness maintained.

## Stage 6 — data-driven content pipeline

**Goal:** stop adding gameplay through hard-coded conditionals.

Work:

- schemas/compiler;
- localization catalogs;
- asset manifest;
- effect vocabulary;
- validators;
- content preview tools.

Migrate first:

- current units;
- current relics;
- current events;
- current achievements.

Exit criteria:

- runtime loads compiled content bundle;
- duplicate/missing references fail build.

## Stage 7 — army, kings, doctrines and progression

**Goal:** implement independent king/doctrine selection and tactical roster systems.

Work:

- 7 king definitions;
- 6 release doctrines;
- command-cost budget;
- roster vs active army;
- deployment/reserve;
- stars/talent choice;
- figure-bound relic slots;
- named hero persistence;
- injuries.

Exit criteria:

- vertical-slice king/doctrine combinations validated;
- full replacement/compensation flow works;
- no roster overflow state.

## Stage 8 — campaign graph and procedural validation

**Goal:** build full act maps with regions, scouting and safe generation.

Work:

- region selection;
- 9–12-node graph;
- route visibility;
- supplies/scouting;
- encounter modules;
- reward/shop generation;
- automatic validation;
- batch reports.

Exit criteria:

- 10,000 seeds generate without unrecoverable error;
- act length/economy distributions within targets.

## Stage 9 — economy, events and political state

**Goal:** release-grade non-combat loop.

Work:

- gold/supplies/meta currency;
- 100-event authored library;
- shop/service types;
- faction conditions and consequences;
- event repeat/weight rules;
- third-act consequence routing.

Exit criteria:

- event localization complete for vertical slice;
- consequence flags validated;
- no invalid choice states.

## Stage 10 — regions, factions, bosses and narrative campaign

**Goal:** complete the three-act campaign content.

Work:

- 6 main regions;
- 2 rare branches;
- 6 factions plus 2 rare factions;
- 15–18 political figures;
- primary/alternative bosses;
- four ending models and modular epilogues.

Exit criteria:

- campaign can complete through all major ending models;
- regional boss routes and faction fates are reflected in act III and epilogues.

## Stage 11 — kingdom and metaprogression

**Goal:** persistent kingdom focused on content variety, not power grind.

Work:

- three profile kingdoms;
- buildings and small branches;
- named heroes;
- chronicle/world memory;
- cosmetic unlocks;
- meta currency.

Exit criteria:

- profiles isolated;
- reset/export/delete safe;
- no mandatory timed systems.

## Stage 12 — save system and replays

**Goal:** crash-safe saves and deterministic replay foundation.

Work:

- atomic profile/run/battle files;
- migrations;
- checksums/backups;
- corruption recovery;
- command replay;
- import/export;
- ranked replay auto-save.

Exit criteria:

- failure-injection tests pass;
- every shipped save fixture migrates;
- replay state hashes match.

## Stage 13 — tutorials, UI, input and accessibility

**Goal:** make the complete game usable by chess players, novices and Steam Deck users.

Work:

- two tutorial tracks;
- contextual help;
- controller focus graph;
- remapping;
- text/UI scale;
- color/contrast modes;
- animation/VFX controls;
- screen layout stress tests.

Exit criteria:

- full campaign navigation controller-only;
- no clipped RU/EN UI in target matrix.

## Stage 14 — modes

**Goal:** implement mandatory release modes without destabilizing campaign.

Order:

1. authored challenges;
2. endless mode;
3. weekly act and scoring;
4. replay leaderboards;
5. editor;
6. Workshop.

Each mode shares production rules/content modules and does not fork core logic.

## Stage 15 — desktop wrapper and Steam integration

**Goal:** package tested web core as Windows Steam application.

Work:

- selected wrapper proof-of-concept;
- Steam initialization/null fallback;
- achievements;
- Cloud;
- leaderboards;
- Workshop;
- lifecycle/paths;
- controller glyphs;
- Proton testing.

Exit criteria:

- clean Steam sandbox install;
- offline mode works;
- Cloud conflicts safe;
- Steam Deck campaign completion test.

## Stage 16 — content completion and balance

**Goal:** close all P0/P1 register items and tune release economy/difficulty.

Work:

- final content integration;
- localization QA;
- seed coverage;
- AI/difficulty balance;
- performance and memory;
- accessibility review;
- audio normalization.

Exit criteria:

- no P0/P1 placeholders;
- mandatory minimum content counts reached;
- target performance met.

## Stage 17 — Steam store and release candidate

**Goal:** produce installable, documented release candidate.

Work:

- capsules and screenshots;
- store descriptions RU/EN;
- system requirements;
- achievement list;
- Workshop/legal/moderation notes;
- build instructions;
- release notes;
- final checklist.

Exit criteria:

- all release acceptance checks pass;
- no known blockers;
- signed artifact and rollback build preserved.
