# DESIGN_FIGURE_PROGRESSION.md

**Status:** implemented foundation policy v1  
**Goal:** meaningful progression without stacking numerical power or obscuring chess readability.

## Star progression

A figure has 0–3 stars.

### Star 1 — passive specialization

- choose exactly one primary passive talent;
- ordinary and named figures follow the same one-passive limit;
- the talent changes a tactical rule or interaction, not raw HP/damage;
- the passive remains attached to the figure through promotion and the current run.

### Star 2 — first relic slot

- unlock exactly one figure-bound relic slot;
- the slot is empty until a compatible relic is accepted;
- relics cannot be moved between figures;
- an accepted replacement immediately removes the old relic from the run.

### Star 3 — specialization choice

**Ordinary recruit:** choose one refinement for the existing passive talent. The figure still has only one primary passive talent and one relic slot.

**Named hero:** choose exactly one of:

1. refine the passive talent; or
2. unlock a second relic slot.

The named hero cannot receive both benefits from the third star. Its unique active ability is part of hero identity and does not consume the passive talent slot.

## Why this policy

- prevents the third star from combining a major talent spike and a second relic spike;
- keeps ordinary recruits competitive through focused specialization;
- gives named heroes flexibility rather than unconditional superiority;
- makes relic capacity visible and predictable;
- preserves a hard cap of one passive talent per figure;
- allows promotion to retain identity, talent and relics without recalculating the current battle command budget.

## Relic acquisition

There is no shared in-run relic inventory.

On acquisition the player must:

- equip to a compatible figure with an empty slot;
- replace a relic in a compatible occupied slot;
- refuse the relic.

Replacement or refusal produces a small choice of gold or supplies based on rarity. Compensation is intentionally far below relic value.

## Required UI

A figure card must show:

- stars;
- one passive talent and optional refinement;
- unique hero ability when applicable;
- relic slot count and contents;
- compatibility explanation;
- future promotion command cost;
- explicit third-star path for named heroes.

## Validation rules

- stars are 0–3;
- passive talent requires at least one star;
- first relic requires at least two stars;
- second relic requires named hero, three stars and the `second_relic_slot` path;
- talent refinement requires three stars and excludes `second_relic_slot`;
- ordinary recruit never has more than one relic slot;
- named hero never has more than two relic slots;
- no relic can be equipped to more than one figure;
- no incompatible relic can be offered as the only assignment option.
