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

## Follow-up: artifact-only launch exception

After the observer fix, choosing no artifact worked, but an active amulet still
raised `TypeError: state.blockedSquares?.has is not a function`. Threat overlays
pass `ClassicChessEngine.snapshot()` to `countSquareAttackers`. Public snapshots
serialize blocked squares as an array of square names; the engine's internal
state uses a Set of numeric indices. Previous artifact tests used `parseFEN`
state and therefore missed this boundary mismatch, including empty arrays in
ordinary battles.

The attack-counting API now normalizes snapshot arrays without mutating the
caller. Internal engine states retain their existing Set path. Regression tests
use real JSON-serialized snapshots, all three amulets, both player colors, and
diagonal/straight attack rays with and without blocking obstacles. They also
verify that repeated overlay rendering stops mutating the board.

Validation completed on 2026-09-21: the targeted real-Chromium browser gate
passes for all three amulets and no artifact. Each case checks the visible board,
responsive frame/timer, stable obstacle nodes, one-charge consumption and reload
with the same saved choice without consuming a second charge. The browser gate
used the assembled dist with verified Stockfish JS/WASM and license hashes;
Stockfish's build-script download timed out, so the same pinned release files
were retrieved with curl and verified before testing and deployment.
