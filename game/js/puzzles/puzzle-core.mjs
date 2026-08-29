import { hashString } from '../race-assets.mjs';

const PUZZLE_TYPES = Object.freeze(['mate1', 'mate2', 'mate3', 'material']);
const TARGET_PIECES = Object.freeze(['queen', 'rook', 'bishop', 'knight']);
const TYPE_LABELS = Object.freeze({ mate1:'МАТ В 1', mate2:'МАТ В 2', mate3:'МАТ В 3', material:'ВЫИГРАЙТЕ ФИГУРУ' });
const TARGET_LABELS = Object.freeze({ queen:'ФЕРЗЯ', rook:'ЛАДЬЮ', bishop:'СЛОНА', knight:'КОНЯ' });
const ERROR_MULTIPLIERS = Object.freeze([1, 0.7, 0.4, 0]);

const DIFFICULTY_TABLE = Object.freeze([
  null,
  Object.freeze({ stars:1, weeks:[1,8], rating:[600,900], mix:Object.freeze({ mate1:70, material:30 }) }),
  Object.freeze({ stars:2, weeks:[9,16], rating:[800,1050], mix:Object.freeze({ mate1:60, material:40 }) }),
  Object.freeze({ stars:3, weeks:[17,24], rating:[950,1200], mix:Object.freeze({ mate1:45, mate2:20, material:35 }) }),
  Object.freeze({ stars:4, weeks:[25,32], rating:[1100,1350], mix:Object.freeze({ mate1:30, mate2:35, material:35 }) }),
  Object.freeze({ stars:5, weeks:[33,40], rating:[1250,1500], mix:Object.freeze({ mate1:15, mate2:50, material:35 }) }),
  Object.freeze({ stars:6, weeks:[41,48], rating:[1400,1650], mix:Object.freeze({ mate2:55, mate3:10, material:35 }) }),
  Object.freeze({ stars:7, weeks:[49,56], rating:[1550,1800], mix:Object.freeze({ mate2:50, mate3:15, material:35 }) }),
  Object.freeze({ stars:8, weeks:[57,64], rating:[1700,1950], mix:Object.freeze({ mate2:40, mate3:25, material:35 }) }),
  Object.freeze({ stars:9, weeks:[65,72], rating:[1850,2100], mix:Object.freeze({ mate2:30, mate3:35, material:35 }) }),
  Object.freeze({ stars:10, weeks:[73,80], rating:[2000,2250], mix:Object.freeze({ mate2:20, mate3:45, material:35 }) }),
  Object.freeze({ stars:11, weeks:[81,88], rating:[2150,2450], mix:Object.freeze({ mate2:15, mate3:50, material:35 }) }),
  Object.freeze({ stars:12, weeks:[89,null], rating:[2350,2800], mix:Object.freeze({ mate2:10, mate3:55, material:35 }) })
]);

function clampStars(value) {
  return Math.max(1, Math.min(12, Number.isFinite(Number(value)) ? Math.round(Number(value)) : 1));
}

// Kept as a compatibility helper for old saves/tests. New puzzle selection no longer uses travel week.
function puzzleStarsForWeek(week) {
  const resolved = Math.max(1, Number.isFinite(Number(week)) ? Math.floor(Number(week)) : 1);
  return clampStars(Math.floor((resolved - 1) / 8) + 1);
}

function puzzleDifficulty(stars) { return DIFFICULTY_TABLE[clampStars(stars)]; }
function puzzleBaseGold(stars) { return 9 + 3 * clampStars(stars); }

function puzzleGoldReward(stars, errors = 0) {
  const resolvedErrors = Math.max(0, Math.min(3, Number.isFinite(Number(errors)) ? Math.floor(Number(errors)) : 0));
  return Math.round(puzzleBaseGold(stars) * ERROR_MULTIPLIERS[resolvedErrors]);
}

function objectiveLabel(puzzle) {
  if (puzzle?.type === 'material') return `ВЫИГРАЙТЕ ${TARGET_LABELS[puzzle.targetPiece] || 'ФИГУРУ'}`;
  return TYPE_LABELS[puzzle?.type] || 'ШАХМАТНАЯ ЗАДАЧА';
}

function uciParts(uci) {
  const value = String(uci || '').trim().toLowerCase();
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value)
    ? { from:value.slice(0,2), to:value.slice(2,4), promotion:value.slice(4,5) || null, uci:value }
    : null;
}

function publicMoveUci(move) {
  if (!move?.from || !move?.to) return '';
  return `${move.from}${move.to}${move.promotion || ''}`.toLowerCase();
}

function isNormalizedPuzzle(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id || typeof value.sourceId !== 'string' || !value.sourceId) return false;
  if (typeof value.fen !== 'string' || !value.fen || !['w','b'].includes(value.side) || !PUZZLE_TYPES.includes(value.type)) return false;
  if (!Array.isArray(value.solution) || !value.solution.length || !value.solution.every((move) => Boolean(uciParts(move)))) return false;
  if (!Number.isFinite(value.rating) || !Number.isInteger(value.difficulty) || value.difficulty < 1 || value.difficulty > 12) return false;
  if (!Array.isArray(value.themes) || !Number.isInteger(value.reward) || value.reward !== puzzleBaseGold(value.difficulty)) return false;
  if (value.type === 'material' && !TARGET_PIECES.includes(value.targetPiece)) return false;
  if (value.type !== 'material' && value.targetPiece != null) return false;
  return true;
}

function chooseType(stars, seed) {
  const mix = puzzleDifficulty(stars).mix;
  const roll = hashString(`${seed}:puzzle-type`) % 100;
  let cursor = 0;
  for (const [type, weight] of Object.entries(mix)) {
    cursor += weight;
    if (roll < cursor) return type;
  }
  return Object.keys(mix).at(-1);
}

function candidatePool(catalog, stars, type, excludedIds = []) {
  const normalized = (catalog || []).filter(isNormalizedPuzzle);
  const excluded = new Set(Array.isArray(excludedIds) ? excludedIds : []);
  const exact = normalized.filter((item) => item.difficulty === stars);
  const exactUnseen = exact.filter((item) => !excluded.has(item.id));
  const typedExactUnseen = exactUnseen.filter((item) => item.type === type);
  if (typedExactUnseen.length) return typedExactUnseen;
  if (exactUnseen.length) return exactUnseen;

  // An endless run can eventually exhaust a small high-star bucket. Preserve no-repeat first,
  // then fall back across other difficulties rather than forcing an early duplicate.
  const unseen = normalized.filter((item) => !excluded.has(item.id));
  if (unseen.length) {
    const typedUnseen = unseen.filter((item) => item.type === type);
    return typedUnseen.length ? typedUnseen : unseen;
  }

  const typedExact = exact.filter((item) => item.type === type);
  if (typedExact.length) return typedExact;
  if (exact.length) return exact;
  return normalized;
}

function selectPuzzle(catalog, { runId = 'run', routeId = 'route', excludedIds = [] } = {}) {
  const seed = `${runId}:${routeId}:any-difficulty`;
  // Every Puzzle encounter gets an independent 1..12 roll. Travel week/card difficulty is intentionally ignored.
  const rolledStars = 1 + (hashString(`${seed}:stars`) % 12);
  const type = chooseType(rolledStars, seed);
  const pool = candidatePool(catalog, rolledStars, type, excludedIds);
  if (!pool.length) throw new Error('Puzzle catalog is empty');
  return pool[hashString(`${seed}:pick`) % pool.length];
}

function createPuzzleState({ puzzle, routeId, stars, week }) {
  if (!isNormalizedPuzzle(puzzle)) throw new Error('Invalid normalized puzzle');
  return Object.freeze({
    routeId:String(routeId || ''),
    puzzleId:puzzle.id,
    // Reward/UI difficulty follows the selected puzzle itself, never the travel week/card.
    stars:clampStars(puzzle.difficulty),
    week:Math.max(1, Math.floor(Number(week) || 1)),
    currentFen:puzzle.fen,
    solutionIndex:0,
    errors:0,
    resolved:false,
    result:null,
    goldReward:0,
    rewardSettled:false
  });
}

function isPuzzleState(value) {
  if (value == null) return true;
  if (!value || typeof value !== 'object' || typeof value.routeId !== 'string' || typeof value.puzzleId !== 'string') return false;
  if (!Number.isInteger(value.stars) || value.stars < 1 || value.stars > 12 || !Number.isInteger(value.week) || value.week < 1) return false;
  if (typeof value.currentFen !== 'string' || !Number.isInteger(value.solutionIndex) || value.solutionIndex < 0 || !Number.isInteger(value.errors) || value.errors < 0 || value.errors > 3) return false;
  if (typeof value.resolved !== 'boolean' || (value.result != null && !['solved','failed'].includes(value.result))) return false;
  if (!Number.isInteger(value.goldReward) || value.goldReward < 0 || typeof value.rewardSettled !== 'boolean') return false;
  return true;
}

function resolvedPuzzleState(state, result) {
  const solved = result === 'solved';
  const errors = solved ? state.errors : 3;
  return {
    ...state,
    errors,
    resolved:true,
    result:solved ? 'solved' : 'failed',
    goldReward:solved ? puzzleGoldReward(state.stars, errors) : 0
  };
}

function applyPuzzleReward(run, puzzleState) {
  if (!run || !puzzleState?.resolved || puzzleState.rewardSettled) {
    return { run, state:puzzleState, reward:0, changed:false };
  }
  const reward = Math.max(0, Number.isInteger(puzzleState.goldReward) ? puzzleState.goldReward : 0);
  const settledState = { ...puzzleState, rewardSettled:true };
  const nextRun = {
    ...run,
    gold:(Number.isInteger(run.gold) ? run.gold : 0) + reward,
    currentPuzzle:settledState,
    lastPuzzle:{
      puzzleId:settledState.puzzleId,
      routeId:settledState.routeId,
      result:settledState.result,
      errors:settledState.errors,
      goldReward:reward
    }
  };
  return { run:nextRun, state:settledState, reward, changed:true };
}

export {
  PUZZLE_TYPES,
  TARGET_PIECES,
  TYPE_LABELS,
  TARGET_LABELS,
  ERROR_MULTIPLIERS,
  DIFFICULTY_TABLE,
  puzzleStarsForWeek,
  puzzleDifficulty,
  puzzleBaseGold,
  puzzleGoldReward,
  objectiveLabel,
  uciParts,
  publicMoveUci,
  isNormalizedPuzzle,
  candidatePool,
  selectPuzzle,
  createPuzzleState,
  isPuzzleState,
  resolvedPuzzleState,
  applyPuzzleReward
};