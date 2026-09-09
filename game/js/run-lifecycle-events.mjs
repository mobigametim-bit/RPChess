import { readRun } from './run-persistence.mjs';

function snapshot(run) {
  const puzzle = run?.currentPuzzle;
  return Object.freeze({
    runId: run?.id || null,
    battleCount: Number.isInteger(run?.battleCount) ? run.battleCount : 0,
    skirmishCount: Number.isInteger(run?.skirmishCount) ? run.skirmishCount : 0,
    puzzleKey: puzzle?.routeId && puzzle?.puzzleId ? `${puzzle.routeId}:${puzzle.puzzleId}` : null,
    puzzleResolved: Boolean(puzzle?.resolved)
  });
}

let previous = snapshot(readRun());

function dispatch(name, detail) {
  globalThis.dispatchEvent(new CustomEvent(name, { detail }));
}

function syncLifecycle(event) {
  const run = readRun();
  const next = snapshot(run);
  if (!run) {
    previous = next;
    return;
  }

  if (previous.runId && previous.runId !== next.runId) {
    previous = next;
    return;
  }

  if (next.battleCount > previous.battleCount) {
    dispatch('rpchess:combat-completed', {
      kind: 'battle',
      runId: next.runId,
      count: next.battleCount,
      source: event?.detail?.source || null
    });
  }
  if (next.skirmishCount > previous.skirmishCount) {
    dispatch('rpchess:combat-completed', {
      kind: 'skirmish',
      runId: next.runId,
      count: next.skirmishCount,
      source: event?.detail?.source || null
    });
  }
  if (next.puzzleKey && next.puzzleResolved && (next.puzzleKey !== previous.puzzleKey || !previous.puzzleResolved)) {
    dispatch('rpchess:puzzle-resolved', {
      runId: next.runId,
      puzzleKey: next.puzzleKey
    });
  }

  previous = next;
}

addEventListener('rpchess:run-updated', syncLifecycle);

globalThis.RPChessRunLifecycle = Object.freeze({
  snapshot: () => previous,
  sync: syncLifecycle
});
