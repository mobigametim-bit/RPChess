# Caravan — implementation plan

**Status:** SPEC APPROVED — implementation not started  
**Planned branch:** `feature/caravan`  
**Delivery:** implementation branch → automated gates → human playtest → merge into `main` → manual VK deployment.

## Product contract

- Travel Choice receives a sixth route type: **Caravan / Караван**.
- The route card shows the normal adaptive difficulty stars and displays the reward as **`???`**. The real reward is not disclosed before victory.
- Selecting the route commits it through the existing idempotent Travel transaction and consumes the normal travel Supply exactly once.
- Caravan is a Chess960 encounter. Its starting position is generated deterministically from the committed route seed, so reload/resume cannot reroll it.
- The back rank must be one of the 960 legal Fischer Random positions: bishops on opposite-colour squares and the King between the two Rooks. Black mirrors White; Pawns keep the ordinary second/seventh ranks.
- Chess960 castling follows the actual Fischer Random result squares and legality rules. The feature must not silently substitute ordinary castling assumptions.
- The player selects available healthy named heroes on a Battle-like preparation screen. The run King is mandatory. Every remaining slot is filled by a matching **free mercenary**; Caravan does not show or charge Battle mercenary cost.
- No Skirmish obstacles or other rule modifiers are added to Caravan v1.
- Before combat, reuse the existing artifact-choice flow including **No artifact**, atomic/idempotent charge spending and resume safety.
- Victory opens a separate choice overlay with exactly three deterministic eligible reward cards sampled without duplicates from: Gold, Supplies, Artifact, Healing and Hero.
- Each card describes the concrete reward before confirmation. One click applies exactly one reward, persists it before closing the overlay and cannot pay twice after reload or rapid taps.
- Ineligible rewards are filtered before the three-card offer is built (for example, Healing with no wounded target). The pool must always have deterministic fallbacks so the player still receives three valid choices.
- After the reward is claimed, Caravan uses the standard combat victory screen. Rewarded-video **×2** remains owned by the existing standard victory/monetization contract; Caravan must not create a parallel ad implementation.
- Defeat and draw skip the reward choice and use the standard combat defeat/draw aftermath. Continue returns to the next Travel Choice.

## Selected repository assets

| Surface | Source asset | Reason | Production contract |
| --- | --- | --- | --- |
| Route icon | `game/assets/doctrines/cavalry/emblem.png` | Horse emblem reads clearly at route-card scale and does not reuse the Market/Supplies identity. | Existing icon optimizer, max 192 px / 128 KiB. |
| Route backdrop | `game/assets/events/register-04/sky_khanate/storm_over_caravan.png` | Explicit caravan scene with a clear left-side text zone. | Existing background optimizer, 1600×900 opaque RGB / max 2 MiB. |

The source masters are not destructively rewritten. The build copies only these explicitly registered paths into `dist` and compresses the runtime copies.

## Persistence model

Add a dedicated `lastCaravan`/active encounter record without changing the storage namespace unless a schema migration becomes necessary. It must persist at least:

- committed route/encounter id, seed and difficulty;
- generated Chess960 index or equivalent canonical back-rank representation;
- selected named participants and free-mercenary fillers;
- player colour and artifact selection/spend receipt;
- combat result;
- deterministic reward candidates, selected reward id/payload and settlement receipt;
- ordinary aftermath/continue state.

All state transitions must be idempotent. Reloading at preparation, artifact choice, combat, reward choice or aftermath resumes the same state without a second Supply cost, artifact charge, reward roll or reward payout.

## Implementation sequence

1. **Route and content registration**
   - Add `caravan` to the central route/content registry, RU/EN localization and Travel renderer.
   - Rebalance the route generator explicitly for six types while preserving deterministic generation and duplicate policy.
   - Use the approved `???` reward label, adaptive stars, selected icon and selected backdrop.
2. **Chess960 core**
   - Add a deterministic 0–959 position generator with invariant tests for bishops, King/Rooks and mirroring.
   - Extend position import, legal moves, check/checkmate, castling and AI adapter boundaries for Chess960 without changing ordinary chess.
3. **Preparation and participants**
   - Reuse the Battle preparation shell and mobile containment rules.
   - Allow healthy named-hero selection, require the run King and fill all remaining role slots with free mercenaries.
   - Hide Battle hiring price/payment presentation and never mutate Gold/Supplies for fillers.
4. **Artifact and combat launch**
   - Route through the existing artifact modal and battle transition contract.
   - Start the exact persisted Chess960 layout and preserve personalized piece identity/art.
5. **Reward choice**
   - Build a deterministic eligible reward pool and three-card offer.
   - Implement atomic handlers for Gold, Supplies, Artifact charge/item, Healing and Hero recruitment.
   - Persist the chosen payload before transition to the standard victory aftermath.
6. **Outcome integration**
   - Reuse standard victory/defeat/draw screens, existing rewarded-video handling and `Продолжить путь` transition.
   - Extend resource/reward settlement and run history without affecting Battle/Skirmish receipts.
7. **Responsive and regression coverage**
   - Cover desktop 1920×1080, tablet 1024×768 and phone landscape 844×390, plus the current short-phone boundary matrix.
   - Verify preparation scrolling, artifact transition, board geometry, reward-card scrolling/selection and reachable Continue CTA.
8. **Delivery gates**
   - Run deterministic/core tests, content validation, production asset budgets, canonical local gate and targeted real-Chromium flow.
   - Publish a feature preview for human acceptance. Do not merge or deploy to VK before explicit approval.

## Acceptance criteria

1. A Caravan card shows `???`, normal difficulty stars, the approved icon/backdrop and commits only once.
2. The same route always restores the same legal Chess960 start position across reload/resume.
3. The player can choose healthy named heroes; the King is mandatory; every unfilled slot is a free mercenary and no hiring cost is displayed or charged.
4. All ordinary moves, checks, mate/stalemate and Chess960 castling are legal; AI never emits an unexecutable move.
5. Artifact selection works exactly as in Battle/Skirmish and never double-spends.
6. Victory offers three valid deterministic reward cards, settles exactly one reward once, then shows the standard victory aftermath.
7. Draw/loss never opens the reward choice and uses the standard aftermath.
8. Battle, Skirmish, Puzzle/Training, Event combat, ordinary Classic Chess and existing saves remain unaffected.
9. All approved landscape viewports keep content inside its owner frame with only intentional internal scrolling.

## Explicit non-goals for v1

- New Caravan-specific art generation, new artifacts, new heroes or new ad provider logic.
- Skirmish obstacles, escort-unit AI, moving wagons or asymmetric armies.
- Rerolling the Chess960 position or reward offer after the route is committed.
- Changes to Battle mercenary prices or the existing economy outside Caravan rewards.

