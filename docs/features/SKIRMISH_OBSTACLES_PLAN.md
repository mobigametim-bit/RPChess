# Skirmish obstacles — implementation plan

**Status:** Implemented — awaiting playable acceptance
**Branch:** `feature/skirmish-obstacles`  
**Delivery:** Cloudflare Preview → human acceptance → PR → merge into `main` → manual GitHub Pages release.

## Approved design

- Scope is **Skirmish only**. Battle, Puzzle and Event combat remain unchanged.
- Each encounter has **1–4** one-cell, indestructible, impassable obstacles.
- Obstacles are generated deterministically from the encounter seed and occupy only ranks **3–6**.
- Props originate from regional `environment_sheet.png` files (4×4 transparent grids). An audit retained 31 green slices; yellow and red slices were removed from both the runtime pool and source-prop folders. Eligible props are selected randomly with no race lock.
- Obstacles are part of move legality: no piece may land on them; rook/bishop/queen rays stop at them; knights may jump over them but cannot land there.
- Existing combat layout, landscape-only VK safe-area contract, HUD policy, and artifact UX remain unchanged.

## Checklist

- [x] Record approved scope and deterministic visual-selection rule.
- [x] Inspect all eight 4×4 source sheets and create reproducible slicing manifest/tool.
- [x] Audit the 128 derived transparent cell props and retain the 31 green candidates only.
- [x] Add obstacle assets to the runtime build contract and 10 MiB runtime budget check.
- [x] Generate deterministic 1–4 obstacle squares on ranks 3–6 without duplicates.
- [x] Extend the classic chess legality layer with optional blocked squares while preserving ordinary chess.
- [x] Ensure AI only receives executable legal moves when obstacles are active.
- [x] Render obstacle props above board cells without affecting accepted combat UI/HUD.
- [x] Add unit coverage for legality, determinism and source asset budget.
- [x] Update RU/EN-neutral documentation.
- [ ] Build a feature preview and perform human acceptance without changing `main`.
- [ ] Open PR; merge and manually deploy GitHub Pages only after acceptance.

## Acceptance criteria

1. A Skirmish consistently shows 1–4 obstacles in ranks 3–6 after reload.
2. Obstacles use real, transparent props and never overlap pieces or each other.
3. All move and attack paths respect blockers; AI never performs an invalid move.
4. Battle, Puzzle, Event and ordinary Classic Chess remain unaffected.
5. Web, tablet and horizontal VK mobile retain the accepted no-overflow combat layout.

## Implementation verification (2026-09-19)

- `npm run verify`, classic-engine acceptance, Skirmish, obstacle legality/slicing and source asset budget checks pass locally.
- The browser gate requires a Chromium runtime that is not present in this workspace.
- The next review surface will be a standalone feature build or a branch preview; neither changes the moderated `main` or VK build.
