# TEST_STRATEGY.md

**Status:** Release test strategy v1  
**Principle:** tests are introduced before or with each migrated system; serious defects receive permanent regression tests.

## 1. Test layers

| Layer | Purpose | Typical runtime |
|---|---|---|
| Static validation | IDs, schemas, localization, asset references | seconds |
| Unit tests | Pure rules, reducers, calculations | seconds |
| Property tests | Invariants across generated positions/states | seconds–minutes |
| Integration tests | Commands across systems | minutes |
| Procedural batch tests | Thousands of seeds and distributions | minutes–hours |
| Browser/UI tests | Navigation, layout, controller focus | minutes |
| Visual regression | Key screens/resolutions/locales | minutes |
| Performance/soak | FPS, memory, long sessions | scheduled |
| Platform integration | Steam, Cloud, Workshop, leaderboards | release pipeline |

## 2. Baseline characterization tests

Before replacing legacy modules, capture current behavior for:

- run creation from fixed seed;
- node-choice sequences;
- battle setup from fixed node seed;
- current movement patterns;
- capture, shield, guard, status and ability effects;
- boss phase transitions;
- reward generation;
- event resolution;
- shop purchases;
- save/export/import round trips;
- UI screen transitions.

Each characterization test states whether the behavior is:

- **preserve**;
- **intentionally change**;
- **remove**.

## 3. Chess-core tests

### Piece movement

- pawn single move;
- initial double move;
- blocked pawn;
- diagonal capture;
- en passant creation, expiration and capture;
- knight jumps;
- bishop, rook and queen ray blocking;
- king movement into/out of attack;
- friendly occupancy rejection.

### Legality

- check detection by every piece type;
- discovered check;
- double check;
- pinned pieces;
- legal check evasions;
- rejection of self-check;
- illegal king adjacency;
- checkmate;
- stalemate;
- insufficient-material policy if enabled;
- repetition/move-count policy selected for RPChess.

### Castling

- both sides;
- rights lost after king/rook movement;
- occupied path;
- king in check;
- crossing attacked square;
- destination attacked;
- scenario-disabled castling.

### Promotion

- all four standard choices;
- capture promotion;
- state retention for named pawn;
- future command-cost update;
- alternative promotion unlock validation.

### Reference suites

- known FEN positions;
- perft positions at agreed depths;
- state-hash snapshots;
- randomized legal-play invariant tests.

## 4. Combat-system tests

- one player action followed by one enemy action;
- reaction and extra-action chain limits;
- order-point start, gain, cost and reset;
- reserve deployment costs and legal cells;
- deployment-zone validation;
- objective completion and failure;
- environment blocking and attack lines;
- portals and destination legality;
- traps and visible warnings;
- status single-primary-status invariant;
- status duration and removal;
- no hidden geometry mutation;
- boss phase transition state preservation;
- inter-phase reserve and regroup rules;
- injury generation after battle;
- permadeath only under explicit conditions.

## 5. AI tests

- AI only selects from legal action list;
- no hidden-state access;
- deterministic result for fixed state/profile/seed;
- easy AI avoids constant nonsensical moves;
- hard AI meets minimum tactical positions;
- objective-aware scenarios;
- ability and environment use;
- no resource cheating;
- bounded calculation time;
- graceful fallback when search budget expires.

Create tactical fixture sets:

- mate in one/two;
- avoid immediate mate;
- defend escort target;
- capture objective;
- hold zone;
- use reserve;
- trigger boss phase;
- decline harmful ability.

## 6. Procedural generation tests

### Per-seed validation

- graph connectedness;
- valid act length;
- boss reachable;
- no meaningless dead ends;
- node-type streak limits;
- recovery availability constraints;
- encounter module compatibility;
- valid board and required kings;
- objective reachable;
- mandatory objects accessible;
- portals valid;
- no unavoidable unannounced first-move mate;
- reward offer count and compatibility;
- shop stock validity;
- event condition validity.

### Batch reports

For at least 10,000 seeds per release candidate report:

- generation error rate;
- act length distribution;
- node frequency;
- event repetition;
- reward rarity distribution;
- gold/supplies curves;
- injury frequency;
- encounter difficulty estimate;
- win-rate estimate from reference bots;
- content coverage;
- duplicate-layout rate.

A generation error rate above zero is a blocker unless every failure is rejected and regenerated within a bounded deterministic process.

## 7. Content tests

- unique IDs;
- schema versions;
- all references resolve;
- all RU and EN keys exist;
- plural forms complete;
- required assets exist;
- no text baked into language-neutral images;
- relic compatibility rules have at least one valid recipient;
- hero abilities have legal targets;
- king/doctrine starting builds fit command budget;
- event choices have valid consequences;
- boss phases have valid objectives;
- Workshop-safe modules contain no executable content.

## 8. Save tests

### Round trips

- profile;
- active run;
- mid-battle checkpoint;
- pending reward;
- event screen;
- shop screen;
- boss inter-phase state;
- replay archive.

### Failure tests

- process termination during temporary write;
- truncated current file;
- invalid checksum;
- valid backup recovery;
- unsupported future version;
- migration from every shipped version;
- missing optional fields;
- invalid references after content update;
- cloud/local conflict;
- corrupt file not uploaded to cloud.

### Golden fixtures

Maintain anonymized fixture saves for every public release version.

## 9. Replay tests

- command recording begins from canonical initial state;
- replay produces identical state hash after every command;
- invalid version rejected with clear message;
- no interaction during playback;
- seek-by-turn uses snapshots without changing outcome;
- export/import round trip;
- leaderboard replay signature validation.

## 10. UI and input tests

### Screen flow

- profiles;
- new run;
- king/doctrine/roster selection;
- deployment;
- battle;
- reward assignment;
- campaign map;
- events;
- shops;
- kingdom;
- tutorials;
- codex;
- editor;
- replay viewer;
- cloud conflict.

### Layout matrix

- 1920×1080;
- 1600×900;
- 1366×768;
- 1280×800;
- 1280×720;
- 16:10 and ultrawide sanity;
- RU and EN;
- 100%, 125%, 150%, 200% text/UI scale.

Assert:

- no clipped text;
- no overflow outside frames;
- no interactive element below unreachable scroll area;
- scene art not cropped when specification requires full display;
- controller focus visible;
- focus order complete;
- correct input glyphs.

## 11. Accessibility tests

- color modes remain distinguishable in grayscale checks;
- every color cue has shape/icon redundancy;
- reduced motion suppresses flashes/shake;
- VFX intensity setting works;
- animation skip does not skip simulation;
- remapping conflicts are reported;
- keyboard-only and controller-only full campaign smoke tests.

## 12. Audio tests

- every manifest file exists and decodes;
- no immediate music repeat;
- shuffled queue eventually covers all tracks;
- crossfade does not overlap excessively;
- master/music/UI/ambience/gameplay channels are independent;
- focus loss and resume policy;
- victory fanfare triggers once per completed battle reward screen and final victory screen;
- zero volume prevents playback;
- no network dependency in release build.

## 13. Performance and soak tests

### Targets

- stable 60 FPS in ordinary battles;
- frame-time budget documented for board and UI;
- no progressive memory growth over a 3-hour session;
- save and load remain responsive;
- 1280×800 Steam Deck target verified.

### Scenarios

- maximum supported board and pieces;
- dense VFX;
- long endless run;
- repeated screen navigation;
- replay fast-forward;
- editor with maximum safe objects;
- Workshop catalog pagination.

## 14. Steam/platform tests

- startup with Steam running;
- startup without Steam;
- offline mode;
- overlay;
- achievements idempotency;
- leaderboard upload/download;
- Workshop subscribe/publish/update;
- Cloud upload/download/conflict;
- controller glyph detection;
- clean shutdown;
- Proton/Steam Deck install and resume.

## 15. CI gates

### Every commit

- format/lint/type check;
- unit tests;
- schema/localization validation;
- build web artifact;
- smoke browser test.

### Pull request

- integration tests;
- selected visual regressions;
- 1,000-seed batch;
- save migration fixtures.

### Nightly

- 10,000+ seed batch;
- AI tactical suite;
- performance smoke;
- memory soak subset.

### Release candidate

- full test matrix;
- clean machine install;
- Steam sandbox integration;
- Steam Deck manual certification checklist;
- signed build hashes and content manifest.
