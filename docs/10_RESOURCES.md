# Resources — Gold + Supplies

**Feature status:** IMPLEMENTED on `feature/resources`; automated and deployed gates must pass before human acceptance.  
**Lifecycle:** IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN PLAYTEST REQUIRED → DONE.

## 1. Canonical resources
RPChess Reboot uses only two run resources:

- **Gold** — persistent currency used later by recruitment, healing, supply purchases and authored Events.
- **Supplies** — persistent travel resource. Every newly committed travel transition consumes Supplies.

The encounter generator does **not** use current Gold or Supplies to choose or reroll encounters.

## 2. Resources v1 tuning
For the first Reboot economy pass a new run starts with:

- **Gold: 80**
- **Supplies: 10**

These are Reboot v1 tuning values, not inherited gameplay rules from Iron Marches v1. They are intentionally centralized in `game/js/resources-core.mjs` so balance can be changed without touching UI or persistence code.

## 3. Travel cost
Every newly committed Travel Choice route costs exactly **1 Supply**.

Rules:

1. The route card discloses the cost before selection.
2. Clicking the card remains the immediate and irreversible Travel Choice action.
3. The Supply is deducted atomically with persistence of `activeTravelChoice`.
4. Returning to Roster, reloading, or resuming the already committed route does not charge again.
5. Supplies never become negative.

At **0 Supplies**, Resources v1 still allows the route to be committed and records `supplyPaid: 0`. This is a temporary stage boundary so the run cannot soft-lock before the dedicated **Starvation** feature is implemented. The canonical starvation casualty rule remains unchanged and will be activated in its own roadmap stage.

## 4. Combat Gold rewards
Resources v1 adds deterministic Gold rewards to completed Skirmish and Battle encounters. Reward settlement is idempotent: each completed combat count can pay out only once.

### Skirmish
- victory: `12 + 4 × threat stars` Gold
- draw: half of the victory reward
- player loss / King death: `0`

Range at 1–5 stars:
- victory: **16–32 Gold**
- draw: **8–16 Gold**

### Battle
- victory: `20 + 6 × threat stars` Gold
- draw: half of the victory reward
- player loss / King death: `0`

Range at 1–5 stars:
- victory: **26–50 Gold**
- draw: **13–25 Gold**

Gold rewards are stored with the latest combat result for observability and shown in the normal aftermath. No reward is invented for a run-ending King death.

## 5. Persistence
The existing run save namespace remains `rpchess.reboot.v1.run` and schema version remains `1` for backward compatibility.

Resources adds:

- `gold: non-negative integer`
- `supplies: non-negative integer`
- `resourceRewards.skirmishCount`
- `resourceRewards.battleCount`
- on a committed route: `supplyCostAtSelection`, `supplyPaid`
- on a settled combat record: `goldReward`

Pre-Resources Reboot saves are hydrated safely:

- missing Gold → 80
- missing Supplies → 10
- already completed historical combats are marked as already settled so they do **not** receive retroactive Gold.

## 6. UI
A compact frameless resource HUD is visible throughout active run surfaces and displays current Gold and Supplies.

- Gold reuses the approved existing `generated_assets/reward_gold.png` asset.
- Supplies uses a lightweight CSS/text symbol in v1; no semantically incorrect legacy image is substituted.
- route cards show the 1-Supply travel cost before commitment.
- combat aftermath shows the Gold payout.
- resource changes use a short non-blocking status toast.
- mobile 390×844 must have no horizontal overflow.

All Resources surfaces obey the global frameless CSS-only panel invariant. `ui_panel_frame.png` and `ui_panel_wide.png` remain forbidden in active Reboot UI.

## 7. Explicitly outside Resources v1
These stay in later roadmap stages:

- starvation casualty selection and death consequences at 0 Supplies;
- Settlement shops;
- buying Supplies;
- healing and recruitment prices;
- Event costs/rewards;
- adaptive encounter generation based on economy;
- resource-based chess modifiers or abilities.

## 8. Acceptance contract
Resources cannot become DONE until all of the following are true:

- Node tests pass for defaults, hydration, persistence, travel cost, zero-floor and reward formulas;
- real Chromium confirms visible 80/10 starting HUD;
- every Travel card discloses 1 Supply;
- one committed route changes Supplies 10 → 9 exactly once;
- resuming/reloading that route never charges again;
- completed combat pays deterministic Gold exactly once and shows it in aftermath;
- zero Supplies never becomes negative and does not soft-lock Travel during this feature stage;
- 390×844 has no horizontal overflow;
- full Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle → Travel Choice regression remains green;
- Cloudflare preview deploy succeeds;
- user completes live playtest and explicitly accepts the preview.
