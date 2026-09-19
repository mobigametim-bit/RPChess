# Skirmish obstacles — implementation plan

**Status:** In progress  
**Branch:** `feature/skirmish-obstacles`  
**Delivery:** Cloudflare Preview → human acceptance → PR → merge into `main` → manual GitHub Pages release.

## Approved design

- Scope is **Skirmish only**. Battle, Puzzle and Event combat remain unchanged.
- Each encounter has **1–4** one-cell, indestructible, impassable obstacles.
- Obstacles are generated deterministically from the encounter seed and occupy only ranks **3–6**.
- Props are sliced from every regional `environment_sheet.png` (4×4 transparent grid); eligible props are selected randomly with no race lock.
- Obstacles are part of move legality: no piece may land on them; rook/bishop/queen rays stop at them; knights may jump over them but cannot land there.
- Existing combat layout, landscape-only VK safe-area contract, HUD policy, and artifact UX remain unchanged.

## Checklist

- [x] Record approved scope and deterministic visual-selection rule.
- [ ] Inspect all eight 4×4 source sheets and create reproducible slicing manifest/tool.
- [ ] Produce and visually QA the 128 derived transparent cell props.
- [ ] Add obstacle assets to the runtime-asset compression/cache pipeline and build contract.
- [ ] Generate deterministic 1–4 obstacle squares on ranks 3–6 without duplicates.
- [ ] Extend the classic chess legality layer with optional blocked squares while preserving ordinary chess.
- [ ] Ensure AI only receives executable legal moves when obstacles are active.
- [ ] Render obstacle props above board cells without affecting accepted combat UI/HUD.
- [ ] Add unit and browser coverage for legality, determinism, UI and landscape viewport contracts.
- [ ] Update RU/EN-neutral documentation and Notion progress.
- [ ] Build, deploy the feature branch to Cloudflare Preview and perform human acceptance.
- [ ] Open PR; merge and manually deploy GitHub Pages only after acceptance.

## Acceptance criteria

1. A Skirmish consistently shows 1–4 obstacles in ranks 3–6 after reload.
2. Obstacles use real, transparent props and never overlap pieces or each other.
3. All move and attack paths respect blockers; AI never performs an invalid move.
4. Battle, Puzzle, Event and ordinary Classic Chess remain unaffected.
5. Web, tablet and horizontal VK mobile retain the accepted no-overflow combat layout.
