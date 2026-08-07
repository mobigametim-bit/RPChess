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

## Event selection

`src/campaign/production-event-selector.cjs` implements the production selector independently of the legacy content queue:

- authored early, middle, and late phase weights;
- a `×2` multiplier for an active chain follow-up;
- deterministic weighted selection from the act seed;
- temporary reservation for simultaneously materialized neighboring nodes;
- no duplicate event within the same materialized fork;
- release of a reservation when its normal branch closes;
- restoration of the exact saved event when a rare effect reopens the branch;
- permanent exclusion after the event is completed.

The browser entry exports the selector state and mutation functions so the campaign-map integration can persist them alongside the act state.

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

The browser entry exports `createProductionEventSession` and `restoreProductionEventSession` for a dedicated event surface.

## Legacy compatibility

The current campaign presenter still consumes a one-step authored-event contract. The production bundle therefore compiles the first stage into that contract and uses a compatibility resolver, while the complete session and selector APIs remain available for direct integration without changing old saves.

The browser gameplay pool contains only the seven production events. The source registry retains the five earlier vertical-slice event records for old references and regression tests.

## Artwork

The production pack binds the seven events to the imported `REGISTER_04_EVENTS` files under `assets/events/register-04`.
