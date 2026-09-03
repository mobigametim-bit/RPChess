import { STARTER_TEMPLATES } from './roster-data.mjs';

const END_REASON_LABELS = Object.freeze({
  starvation_king: 'Король погиб во время перехода без припасов.',
  event_king: 'Король погиб из-за принятого решения в событии.',
  king_solo_battle: 'Наемники не посчитались со словами одинокого короля без королевства и повесили вас на суку ближайшего дерева',
  king_dead: 'Король погиб. Путешествие завершено.'
});

const STARTER_IDS = new Set(STARTER_TEMPLATES.map((character) => character.id));
const RUN_STAT_KEYS = Object.freeze(['goldEarned','skirmishWins','battleWins','puzzlesSolved','eventsResolved']);

function safeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function emptyRunStats() {
  return {
    goldEarned: 0,
    skirmishWins: 0,
    battleWins: 0,
    puzzlesSolved: 0,
    eventsResolved: 0
  };
}

function hydrateRunStats(run) {
  const source = run?.runStats || {};
  return {
    goldEarned: safeCount(source.goldEarned),
    skirmishWins: safeCount(source.skirmishWins),
    battleWins: safeCount(source.battleWins),
    puzzlesSolved: safeCount(source.puzzlesSolved),
    eventsResolved: safeCount(source.eventsResolved)
  };
}

function isRunStats(value) {
  if (!value || typeof value !== 'object') return false;
  return RUN_STAT_KEYS.every((key) => Number.isInteger(value[key]) && value[key] >= 0);
}

function combatVictory(record) {
  return Boolean(record?.result === 'checkmate' && record?.winner && record.winner === (record.playerColor || 'w'));
}

function puzzleIdentity(record) {
  if (!record) return '';
  return `${record.routeId || ''}:${record.puzzleId || ''}`;
}

function accrueRunStats(run, previous) {
  const next = { ...run, runStats: hydrateRunStats(run) };
  if (!previous || previous.id !== next.id) return next;

  const previousStats = hydrateRunStats(previous);
  const stats = { ...next.runStats };
  for (const key of RUN_STAT_KEYS) stats[key] = Math.max(stats[key], previousStats[key]);

  const previousGold = Number.isInteger(previous.gold) ? previous.gold : 0;
  const nextGold = Number.isInteger(next.gold) ? next.gold : previousGold;
  if (nextGold > previousGold) stats.goldEarned += nextGold - previousGold;

  const previousSkirmishes = safeCount(previous.skirmishCount);
  const nextSkirmishes = safeCount(next.skirmishCount);
  if (nextSkirmishes > previousSkirmishes && combatVictory(next.lastSkirmish)) stats.skirmishWins += 1;

  const previousBattles = safeCount(previous.battleCount);
  const nextBattles = safeCount(next.battleCount);
  if (nextBattles > previousBattles && combatVictory(next.lastBattle)) stats.battleWins += 1;

  if (next.lastPuzzle?.result === 'solved' && puzzleIdentity(next.lastPuzzle) && puzzleIdentity(next.lastPuzzle) !== puzzleIdentity(previous.lastPuzzle)) {
    stats.puzzlesSolved += 1;
  }

  const nextEvent = next.currentEvent;
  const previousEvent = previous.currentEvent;
  if (nextEvent?.resolved === true && (!previousEvent?.resolved || previousEvent.routeId !== nextEvent.routeId)) {
    stats.eventsResolved += 1;
  }

  return { ...next, runStats: stats };
}

function recruitedHeroCount(run) {
  return (run?.roster || []).filter((character) => character?.id && !STARTER_IDS.has(character.id)).length;
}

function endReasonLabel(reason) {
  return END_REASON_LABELS[reason] || END_REASON_LABELS.king_dead;
}

function summarizeRun(run, { power = 0 } = {}) {
  const stats = hydrateRunStats(run);
  return Object.freeze({
    weeks: safeCount(run?.journeyStep),
    goldEarned: stats.goldEarned,
    skirmishWins: stats.skirmishWins,
    battleWins: stats.battleWins,
    puzzlesSolved: stats.puzzlesSolved,
    eventsResolved: stats.eventsResolved,
    heroesRecruited: recruitedHeroCount(run),
    finalPower: Math.max(0, Number.isFinite(Number(power)) ? Math.round(Number(power)) : 0),
    endReason: run?.endReason || 'king_dead',
    endReasonLabel: endReasonLabel(run?.endReason),
    kingName: (run?.roster || []).find((character) => character?.isRunKing)?.name || 'Король'
  });
}

export {
  END_REASON_LABELS,
  RUN_STAT_KEYS,
  emptyRunStats,
  hydrateRunStats,
  isRunStats,
  combatVictory,
  accrueRunStats,
  recruitedHeroCount,
  endReasonLabel,
  summarizeRun
};
