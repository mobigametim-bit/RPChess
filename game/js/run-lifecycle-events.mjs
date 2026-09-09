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

  const completed = [];
  if (next.battleCount > previous.battleCount) {
    completed.push(['rpchess:combat-completed', {
      kind: 'battle',
      runId: next.runId,
      count: next.battleCount,
      source: event?.detail?.source || null
    }]);
  }
  if (next.skirmishCount > previous.skirmishCount) {
    completed.push(['rpchess:combat-completed', {
      kind: 'skirmish',
      runId: next.runId,
      count: next.skirmishCount,
      source: event?.detail?.source || null
    }]);
  }
  if (next.puzzleKey && next.puzzleResolved && (next.puzzleKey !== previous.puzzleKey || !previous.puzzleResolved)) {
    completed.push(['rpchess:puzzle-resolved', {
      runId: next.runId,
      puzzleKey: next.puzzleKey
    }]);
  }

  // Commit the canonical transition before notifying semantic consumers. Consumers may
  // synchronously persist derived state and emit run-updated again; that must not replay
  // the same completion event.
  previous = next;
  for (const [name, detail] of completed) dispatch(name, detail);
}

addEventListener('rpchess:run-updated', syncLifecycle);

globalThis.RPChessRunLifecycle = Object.freeze({
  snapshot: () => previous,
  sync: syncLifecycle
});
