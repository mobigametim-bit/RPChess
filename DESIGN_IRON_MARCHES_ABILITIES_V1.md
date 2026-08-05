# Iron Marches ability contract v1

**Status:** approved implementation contract  
**Scope:** deterministic active abilities and relic effects for the Iron Marches vertical slice.

## Shared active-ability rules

- An active ability replaces the owner's ordinary action for the turn.
- Every ability has an explicit owner, side, order-point cost, target contract and use limit.
- Legal targets are projected before dispatch and validated again during execution.
- An ability cannot be used while the acting king is in check unless that ability explicitly resolves the check.
- Ability execution advances the turn and is preserved in command history, save/load and replay.
- No hidden probability is permitted.
- `UseAbility` is the canonical battle command.

## Package 1 implemented rules

### Echo Shield — `effect.ward_first_capture`

When a battle is created, the canonical owner of `relic.echo_shield` receives one visible `ward`, including when that owner starts in reserve. The first legal capture attempt against the active owner is prevented by the existing ward interception engine and consumes the ward.

### Circle Warding — `effect.place_adjacent_ward`

Executable action: `ability.circle_warding`.

- owner: canonical holder of `relic.circle_warding`;
- cost: 1 order point;
- limit: once per battle;
- target: an orthogonally adjacent allied non-king piece;
- target must not already have a primary status;
- result: target receives one non-expiring `ward` sourced from the relic;
- the ability passes the turn after resolution.

### Twin Command — `effect.first_ability_order_discount`

The canonical holder of `relic.twin_command` receives a persistent battle modifier. The first active ability used by that owner costs one fewer order point, to a minimum of zero, and consumes the modifier. The modifier is already executable in the shared ability engine; its production gameplay becomes reachable when the owner's unique ability is implemented.

## Remaining approved rules

The following mechanics retain their audited readiness status until their executable package is merged:

- Phantom Spurs: visible evasion after the first non-capturing knight move;
- Royal Decree: optional early underpromotion from the penultimate rank for two orders;
- Oath of the Fallen: two orders after a declared voluntary sacrifice is captured;
- Aldric Wall: adjacent ally interception;
- Mara Chain: simultaneous two-pawn formation advance;
- Brother Orell: temporary forged line blocker;
- Vael Hammer: fully previewed two-jump knight charge;
- Lady Sorn: mutual hostage binding;
- Tomas Gate: deterministic visible gate toggle.

## Required validation for every implementation

- legal command projection;
- rejection of forged or stale targets;
- order-point accounting;
- use-limit accounting;
- check safety;
- save/load and replay stability;
- browser presentation;
- AI legality boundary;
- production army and relic binding;
- readiness audit evidence.
