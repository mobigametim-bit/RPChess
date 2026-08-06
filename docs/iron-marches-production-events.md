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

## Runtime compatibility

The content bundle compiles the first stage into the current authored-event presenter and uses a compatibility resolver for the legacy one-step flow. The complete multi-stage state machine remains available through `src/content/production-events.cjs` for the dedicated event presenter/runtime integration.

## Artwork

The production pack binds the seven events to the imported `REGISTER_04_EVENTS` files under `assets/events/register-04`.
