# Skirmish launch freeze after artifact selection

## Root cause

`syncBattleFromChess` observes the board with `childList: true, subtree: true`.
It calls `applyBoardArt`, which calls `renderObstacleProps`. The previous
renderer removed all obstacle images and appended replacements on every call.
Each observer delivery therefore queued another delivery indefinitely, starving
browser painting, timers and input after combat launch. The last painted frame
could still show the artifact picker, although its click handler had returned.
The artifact launch try/catch did not address this observer microtask loop.

## Fix

Reconcile obstacle nodes by square. Keep matching images, remove only stale,
misplaced or duplicate nodes, and append only missing images. Compare `src`
before changing it. Rebuilt board cells still receive their obstacles; an
unchanged board reaches a mutation-free fixed point.

## Validation

- `tests/skirmish-obstacles.cjs` runs the actual renderer with bounded observer
  delivery. It fails before the fix and passes after it. It also covers stable
  node identity, board replacement, changed assets, duplicates and empty plans.
- Skirmish, artifact, chess-engine and runtime module checks pass.
- `tests/skirmish-artifact-browser.cjs` covers all three artifacts and no artifact,
  one-charge consumption, visible board and a responsive frame/timer. It is part
  of the browser gate but was not executed successfully in this environment:
  Chromium was unavailable and its CDN download timed out / returned HTTP 502.

Scope: feature/skirmish-obstacles and private preview only; no main/VK changes.
