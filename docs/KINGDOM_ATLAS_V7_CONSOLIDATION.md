# Kingdom Atlas v7 — consolidated review and human acceptance

Status: **DRAFT / READY FOR OWNER PLAYTEST**. Latest isolated-preview workflow, including full local gate, real-Chromium browser checks, Cloudflare deploy and published-file verification: **PASS** ([run #43518031032](https://github.com/mobigametim-bit/RPChess/actions/runs/43518031032)). This document belongs to PR #203; do not merge `main` before the owner explicitly approves the preview.

## Source comparison

- **PR #201** (`fix/kingdom-geography-atlas-v7-20261113`): canonical geometry, versioned v5/v6 mapping, six biome visuals, building footprints, Skirmish preservation, standalone Atlas Lab, regression assertions. Its dedicated `kingdom-biome-render.mjs` is **not copied**: PR #203 already provides biome-scoped PNG selection and landmark placement in `kingdom-parchment-app.mjs`. The v5 geometry and retained-Skirmish regression assertions were adopted into the existing `tests/travel-choice.cjs`.
- **PR #202** (`feature/kingdom-map-geometry-atlas-v7`): same overall functionality, but its focused Node checks failed at `tests/travel-choice.cjs:291` (`undefined !== 1.6`). Its separate `kingdom-site-occupancy.mjs` is **not copied** because PR #203 already checks built-road Bezier crossings and construction conflicts in `kingdom-industry-core.mjs` and uses that policy for both Settlements and Outposts.
- **PR #203** (`fix/kingdom-world-geometry-atlas-v7`) is the sole integration target. Its dedicated Cloudflare isolated preview pipeline verifies the generated HTML and the shared geography module.

## Contracts to keep

1. New worlds use generator **v6**. Existing generator v4/v5 saves retain their previous seed, encounter assignments, and versioned road/landmark semantics; never rewrite them into v6 on load.
2. River and natural-road lines use shared world-coordinate functions for painting, encounters and movement; new v6 bridges appear near visible rivers.
3. The map draws appropriate marsh/wasteland art, with separate densities; do not reuse marsh stamps indiscriminately in dry wasteland.
4. Industry, Settlement and Outpost footprints reject natural roads/rivers, drawn paved-road curves, and conflicting occupied sites.
5. A preassigned Skirmish remains a Skirmish when the current roster lacks an eligible companion; the UI may postpone it, not reroll it.
6. Atlas Lab v7 uses game-aligned settings, retains the simulator, supports exported review JSON and omits retired preview-only controls.
7. Atlas Lab is a **development-only** editor. Do not introduce it to production builds by default.

## Validation evidence

- Focused Node and real-Chromium checks: PR #203 [successful prior run](https://github.com/mobigametim-bit/RPChess/actions/runs/43516148583).
- Isolated Cloudflare browser/build/deploy verification: [previous successful run](https://github.com/mobigametim-bit/RPChess/actions/runs/43515727171).
- The v5 geometry and deferred Skirmish assertions from PR #201 were incorporated as **two focused regression contracts** in `tests/travel-choice.cjs`. Their code/test commit `484e9cbaaafba21a7c9b80faae55fae23defbdc5` passed the [fresh isolated preview workflow](https://github.com/mobigametim-bit/RPChess/actions/runs/43518031032). Subsequent commits to this branch are documentation-only.
- **Release Gate** on PRs is intentionally protected by an explicit owner-acceptance control; failure at this gate before approval does **not** indicate failed gameplay tests.

## Manual acceptance checklist

- [ ] Open the [isolated Atlas Lab v7](https://rpchess-kingdom-atlas-v7-preview.mobigametim.workers.dev/atlas-lab.html); test map panning, zoom, riverSpacing, roadSpacing, biome densities and JSON export.
- [ ] Compare generated roads, bridges, marsh/wasteland and landmarks with the playable Kingdom map for the same seed.
- [ ] Try to build a Settlement and an Outpost on clear land, then on a river, natural road and a curved completed road (blocked).
- [ ] Open a seeded Skirmish without an eligible companion; its type stays unchanged while its entrance is unavailable.
- [ ] Start a new world, reload it and confirm generator v6 and stable coordinates; load an existing v5 save if available to confirm no reseeding.
- [ ] Confirm no red errors, broken map sprites or blank parchment.

## Release sequence — GitHub only

1. Let the latest **PR #203** focused CI and isolated preview workflow pass; investigate any new failure.
2. Owner plays the isolated preview and approves it explicitly (or supplies feedback).
3. After approval, execute the full owner-authorized Release Gate. Do not bypass the guard.
4. Finalize GitHub documentation; merge **only PR #203** into `main`.
5. PRs #201 and #202 were **closed unmerged** as superseded by #203 after the consolidated preview passed CI; their code/reviews remain in GitHub history.

**Workflow rule:** GitHub code, PRs, checks and GitHub documentation only. **Notion synchronization is not required.**
