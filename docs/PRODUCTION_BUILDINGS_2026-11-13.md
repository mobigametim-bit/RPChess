# Production buildings — agreed scope and implementation plan (13.11.2026)

Status: **approved for feature development**. No merge to `main` until manual QA and explicit owner's “сливай”.

## Product rules (owner-approved)
- Only existing Gold and Supplies; **base per completed building: 5 Gold / 1 Supply per week**. Actual output = base × current Castle level (I–V). Castle level increases retroactively upgrade all existing buildings, no manual upgrades.
- Game calendar remains the sole authority: 7 game days = 1 week. **One free automatic construction at week 1 (day 7)** and at most one newly founded site per subsequent week. New site displays `construction_site.png` for its first week; it completes at the next weekly boundary, producing its first income at day 14 for the initial site.
- A weekly boundary first credits all **previously founded** completed buildings, then founds the new site (if any). Produce claimable resources once each game week. **The owner specifically requested floating resource collection markers**, so Gold/Supplies are deposited only after clicking the resource icon above a completed building; unclaimed amounts accumulate and persist across weeks/reloads. Repeated clicks/reloads must never pay twice.
- Foundation site and resource kind chosen deterministically using run map seed, current week and eligible locations. **Biomes:**
  - plains → Farm / Pasture (Supplies)
  - hills → Pasture (Supplies) / Stone Quarry (Gold)
  - forest → Hunting Lodge (Supplies) / Sawmill (Gold)
  - mountain → Gold Mine / Stone Quarry (Gold)
  - marsh → Fishing Pier (Supplies)
  - wasteland → **Oasis (Supplies)**, confirmed later by owner from newly supplied graphic
- Foundation candidates are **currently player-owned** (castle annexations, completed conquests, outpost annexations), not already occupied by Castle/Outpost/settlement/encounter/production structure. Skip cells of generated travel events or existing royal/route/natural roads. Never place sites in fog outside owned land. No candidate → skip that week; never queue missed buildings.
- Original weekly production by completed road events (settlements/events/caravans/puzzles/skirmishes/battles) remains untouched.
- **Art completed:** The eight original 64×64 PNGs from `постройки.zip` and the owner's 64×64 Oasis PNG are packed (palette-compressed, no redraw) into a single transparent **576×64 PNG atlas**: `game/assets/kingdom-production/industry-atlas.png` (12,940 bytes). In left-to-right order: construction_site, farm, fishing_pier, gold_mine, hunting_lodge, pasture, sawmill, stone_quarry, oasis. CSS `background-size:900% 100%` and crop index position yield one map object per production tile; no new network request per icon.

## Implementation steps
1. Add pure `kingdom-industry-core.mjs`: frozen biome-to-type catalog, deterministic eligible-cell scanning, weekly scheduler, structural validator, stable yield ledgers and build-stage introspection. Use existing `worldAt` and roads. No DOM, clock or RNG.
2. Extend `kingdom-map-core.mjs` map state: `industry` ledger; create, migration and validation; settle once per week within the current `advanceDay` call. For pre-feature saved runs, initialize `processedWeek` at the current week to avoid retrospective construction/income.
3. Update `run-persistence.mjs` to keep the original save logic without automatic industry payout. On user click, the Kingdom UI updates the run's Gold/Supplies and the industry's per-site pending and credited ledgers in the same `writeRun` call. No separate localStorage key.
4. Render transparent construction sprite until completion and then final building sprite on the Kingdom board; show current Castle level and yield in the tile inspector, RU/EN copy, no additional controls.
5. Ensure `scripts/build.cjs` preserves the production PNG atlas in `dist`; verify it in Node and Chromium, including the `/RPChess/` URL subpath. All producer sprites, including Oasis and construction stage, are 30% smaller than the first preview and share the forest's `VISUAL.stampOpacity=0.8`.
6. Minimal meaningful regressions: one focused pure-gameplay test (week boundary, resources, level, no duplicate, placement eligibility, migration) and a compact extension of the existing Kingdom browser scenario for DOM art + automatic income. Add to the existing CI selection and test:materialized. Verify base and build, then deploy **isolated preview** if available through existing action; do not touch production.
7. Commit feature branch and open Draft PR with a manual QA checklist. Ask for owner inspection before `release-approved` / `gate:full` and merge.

## Data contract
```js
kingdomMap.industry = {
  buildings: [{id:'1,2',kind:'farm',builtWeek:1}],
  processedWeek: 2,
  pending: {'1,2': 2},
  accruedGold: 0, accruedSupplies: 2,
  creditedGold: 0, creditedSupplies: 0
}
```
A site becomes active once `builtWeek < processedWeek`. The inspector derives `level` from `castleLevel(map.peakKingPower)` rather than persisting a stale level. `accrued*` tracks produced resources; `pending` tracks unclaimed amount per built cell, and `credited*` records only user-collected amounts. Previously auto-paid preview saves without `pending` are accepted and do not generate duplicate rewards. Only nonnegative integer totals are valid.

## Non-goals
- No new resources (food/stone/wood), no extra currencies, manual building management, operating costs, caps, construction timers or building icons from other sources.
- No deletion of existing map encounters, no road re-layout, no retroactive credit on old saves, no `main` merge or production deployment before explicit approval.

## QA checklist
- Fresh Journey: day 1 none, day 7 a site, day 14 first production and second site, subsequent weekly cycle stable.
- Rerender/reload/time progression: one site per eligible week, no double income; new/old saves accepted.
- Gold/Supplies appear in floating collection icons with amount `5 × level` or `1 × level`. Payout happens once when clicked, persists after reload; unclaimed rewards remain available. Castle level changes update future output.
- Resource type matches terrain; no buildings on roads, encounters, Castle, Outposts, Settlements or existing buildings.
- Correct assets, 70% sprite size and forest opacity, empty-cell biome-only inspector RU/EN, yellow roads on owned tiles / gray outside, desktop/mobile; production survives GitHub Pages subpath build.

## Manual QA corrections (13.11.2026)
- Production buildings: 70% of first preview size; alpha 0.8 like forest stamps.
- Each matured building displays the **existing floating resource icon** with the amount awaiting manual collection; accumulation survives missed weeks and reloads, payout is one-time per claim.
- Empty inspected tile: display the actual biome name (Лес/Горы/Холмы/Равнина/Болото/Пустоши; EN counterparts), no no-event explanatory text.
- Paved roads: yellow brick strictly inside owned tile bounds, gray brick outside. Crossing borders changes color at tile boundary, not per route ID.
