# Resources — Gold + Supplies

**Feature status:** DONE on `main`.  
**Lifecycle:** IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.

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
Resources acceptance requires all of the following:

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

## 9. Human acceptance — 2026-08-27
The user completed the live Resources playtest and explicitly confirmed: **«все работает, золото начисляется, припасы тратятся»**.

Human Gate is therefore closed. Confirmed in live gameplay:
- Gold is awarded after combat;
- Supplies are consumed on travel;
- the Resources economy loop is functioning as intended.

Accepted gameplay preview runtime: version `2.7.0-resources.preview.1`.  
Accepted gameplay head: `e162c347efe7ec1e55c1f76df7999c90469f1906`.  
Accepted Cloudflare build: `34063395-1b82-44b2-b93c-caef6f4c0e5f`.  
Accepted Cloudflare Version: `da19ea4e-60ef-467a-85e4-5137a2e76c15`.  
Accepted preview: `https://da19ea4e-rpchess.mobigametim.workers.dev`.

Subsequent commit `44766f3e5e0bd6fa98684ada50ce19fb043e8c6a` changes only the Chromium test assertion scope and does not alter gameplay/runtime behavior.

## 10. Merge and post-merge closure — 2026-08-27
PR #71 `Resources: persistent Gold and Supplies economy` passed its final exact-head GitHub Actions and Cloudflare gates, was marked Ready, and was squash-merged into `main`.

- Resources merge SHA / resulting `main`: `c4e98b7f2bdbf926727ceec7bee15099919ea19d`
- post-merge GitHub Actions: `33105645405` / #942 — **SUCCESS**
- post-merge real Chromium regression: **SUCCESS** across Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle → Travel Choice → Resources
- post-merge Cloudflare build: `bb7e0099-3513-45d2-a151-b7ecc057770b` — **SUCCESS**
- production Cloudflare Version: `69a291d3-8b0e-4e3f-9715-9cce1c9f4d86`

Resources is therefore fully closed as **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**. The next roadmap stage is **Settlement**, beginning with UX/spec approval before implementation.
