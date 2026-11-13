# Production buildings — agreed scope and implementation plan (13.11.2026)

Status: **approved for feature development**. No merge to `main` until manual QA and explicit owner's “сливай”.

## Product rules (owner-approved)
- Only existing Gold and Supplies; **base per completed building: 5 Gold / 1 Supply per week**. Actual output = base × current Castle level (I–V). Castle level increases retroactively upgrade all existing buildings, no manual upgrades.
- Game calendar remains the sole authority: 7 game days = 1 week. **One free automatic construction at week 1 (day 7)** and at most one newly founded site per subsequent week. New site displays `construction_site.png` for its first week; it completes at the next weekly boundary, producing its first income at day 14 for the initial site.
- A weekly boundary first credits all **previously founded** completed buildings, then founds the new site (if any). Automatically pay run Gold/Supplies; no collection interaction; credit exactly once across rerenders, repeated saves and cloud/local resume.
- Foundation site and resource kind chosen deterministically using run map seed, current week and eligible locations. **Biomes:**
  - plains → Farm / Pasture (Supplies)
  - hills → Pasture (Supplies) / Stone Quarry (Gold)
  - forest → Hunting Lodge (Supplies) / Sawmill (Gold)
  - mountain → Gold Mine / Stone Quarry (Gold)
  - marsh → Fishing Pier (Supplies)
  - wasteland → **Oasis (Supplies)**, confirmed later by owner from newly supplied graphic
- Foundation candidates are **currently player-owned** (castle annexations, completed conquests, outpost annexations), not already occupied by Castle/Outpost/settlement/encounter/production structure. Skip cells of generated travel events or existing royal/route/natural roads. Never place sites in fog outside owned land. No candidate → skip that week; never queue missed buildings.
- Original weekly production by completed road events (settlements/events/caravans/puzzles/skirmishes/battles) remains untouched.
- Eight original 64×64 transparent PNGs come from user-supplied `постройки.zip`, plus the additional Oasis icon for wastelands. Ship all production art in the runtime build without changing the gameplay geometry; do not silently use unrelated placeholder art for Oasis.

## Implementation steps
1. Add pure `kingdom-industry-core.mjs`: frozen biome-to-type catalog, deterministic eligible-cell scanning, weekly scheduler, structural validator, stable yield ledgers and build-stage introspection. Use existing `worldAt` and roads. No DOM, clock or RNG.
2. Extend `kingdom-map-core.mjs` map state: `industry` ledger; create, migration and validation; settle once per week within the current `advanceDay` call. For pre-feature saved runs, initialize `processedWeek` at the current week to avoid retrospective construction/income.
3. Update `run-persistence.mjs`: atomically credit the difference between accrued and already-paid totals before saving; persist the new paid totals as the idempotency receipt. No separate localStorage key.
4. Render transparent construction sprite until completion and then final building sprite on the Kingdom board; show current Castle level and yield in the tile inspector, RU/EN copy, no additional controls.
5. Copy and verify all eight production sprites with `scripts/build.cjs` so GitHub Pages/VK/Cloudflare previews include them.
6. Minimal meaningful regressions: one focused pure-gameplay test (week boundary, resources, level, no duplicate, placement eligibility, migration) and a compact extension of the existing Kingdom browser scenario for DOM art + automatic income. Add to the existing CI selection and test:materialized. Verify base and build, then deploy **isolated preview** if available through existing action; do not touch production.
7. Commit feature branch and open Draft PR with a manual QA checklist. Ask for owner inspection before `release-approved` / `gate:full` and merge.

## Data contract
```js
kingdomMap.industry = {
  buildings: [{id:'1,2',kind:'farm',builtWeek:1}],
  processedWeek: 2,
  accruedGold: 0, accruedSupplies: 2,
  creditedGold: 0, creditedSupplies: 2
}
```
A site becomes active once `builtWeek < processedWeek`. The inspector derives `level` from `castleLevel(map.peakKingPower)` rather than persisting a stale level. `accrued*` is an incremental ledger; `credited*` is the receipt for run resources. Only nonnegative integer totals are valid.

## Non-goals
- No new resources (food/stone/wood), no extra currencies, manual building management, operating costs, caps, construction timers or building icons from other sources.
- No deletion of existing map encounters, no road re-layout, no retroactive credit on old saves, no `main` merge or production deployment before explicit approval.

## QA checklist
- Fresh Journey: day 1 none, day 7 a site, day 14 first production and second site, subsequent weekly cycle stable.
- Rerender/reload/time progression: one site per eligible week, no double income; new/old saves accepted.
- Gold/Supplies correctly match `5 × level` or `1 × level`. Castle level changes update existing output.
- Resource type matches terrain; no buildings on roads, encounters, Castle, Outposts, Settlements or existing buildings.
- Correct assets and tooltip/inspector RU/EN, desktop/mobile; production survives GitHub Pages subpath build.
