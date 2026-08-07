# Iron Marches production events

This implementation promotes seven authored events into the production content bundle:

- `event.empty_armory`
- `event.cracked_bell`
- `event.duel_masons`
- `event.disputed_standard`
- `event.furnace_oath`
- `event.prisoners_pass`
- `event.miners_on_strike`

## Authoring contract

- Distribution: three small, three standard, one key event.
- Small events contain one stage and two choices.
- Standard events contain one or two stages and two or three choices per stage.
- The key event contains two or three stages and three or four choices per stage.
- A probabilistic choice has exactly two outcomes whose displayed probabilities total 100%.
- Immediate consequence bundles contain one to three effects and at most one serious punishment.
- Long-term consequences are stored as stable typed facts rather than numeric reputation.
- Connected events can select standalone, favorable, or crisis variants from existing facts.
- Event participant selection is deterministic and prioritizes eligible roster entries that have not participated earlier in the act.
- Event battle metadata declares the encounter, danger offset, warning, objective, and event-only reward rule.
- The library does not persist discovered event knowledge between runs.
- `production-event-policy.cjs` validates the accepted class, combat, loss, chain, and persistence rules in both Node and browser bundles.

## B9 materialization integration

The production selector is now integrated directly into the B9 campaign lifecycle rather than running as a parallel content queue.

`src/campaign/production-event-b9-adapter.cjs` connects the event library to the B9 callback contract:

- `selectEvent` chooses and reserves the event when a map level is revealed;
- `onBranchesClosed` releases reservations belonging to normally closed alternatives;
- `onBranchReopened` restores the original reservation for an authored rare reopening;
- `onNodeCompleted` permanently completes the assignment and activates chain state.

The B9 materialized node stores the stable `contentSeed`, `contentVersion`, event ID, variant ID, participant ID when available, displayed probabilities, and an authored event snapshot. `selectorState` is serialized with campaign state, so reload never rerolls an already revealed event.

Simultaneously revealed event nodes are reserved as one deterministic batch and cannot receive the same event ID. Rare reopening reuses the original `materializedContentByNode` entry rather than selecting again.

`src/browser/install-b9-production-events.cjs` installs the callbacks before the production browser host loads and recreates them after save/load without serializing functions into the profile.

## Event selection policy

`src/campaign/production-event-selector.cjs` provides:

- authored early, middle, and late phase weights;
- a `×2` multiplier for an active chain follow-up;
- deterministic weighted selection from the act seed;
- temporary reservation for simultaneously materialized neighboring nodes;
- no duplicate event within the same materialized fork;
- release of a reservation when its normal branch closes;
- restoration of the exact saved event when a rare effect reopens the branch;
- permanent exclusion after the event is completed.

## Multi-stage runtime

`src/runtime/production-event-session.cjs` provides a browser-safe event session:

- selects standalone, favorable, or crisis variants from known facts;
- hides unavailable choices;
- exposes exact current probabilities and applied modifiers;
- fixes the participant on event entry and tracks act participation;
- applies resource and fact changes between stages;
- saves and restores an unfinished event exactly;
- emits `combat_pending` with the authored encounter contract;
- resumes the next event stage after victory or closes the branch after defeat.

The browser entry exports `createProductionEventSession` and `restoreProductionEventSession` for a dedicated event surface, while the B9 map owns event assignment and persistence.

## Legacy compatibility

The existing campaign presenter still consumes a one-step authored-event contract. The production bundle therefore compiles the first stage into that contract and uses a compatibility resolver, while the complete multi-stage session remains available without changing old saves.

The browser gameplay pool contains only the seven production events. The source registry retains the five earlier vertical-slice event records for old references and regression tests.

## Verification

The rebased B9/event branch passed `RPChess CI #393`, including source verification, production content validation, the complete test suite, browser production build, and distribution verification.

`tests/b9-production-events-integration.cjs` additionally verifies sibling reservations, versioned event snapshots, deterministic reload, branch release, exact rare reopening, and completion/exclusion behavior.

## Artwork

The production pack binds the seven events to the imported `REGISTER_04_EVENTS` files under `assets/events/register-04`.
