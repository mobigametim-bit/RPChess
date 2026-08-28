import { hashString } from './travel-choice-core.mjs';

function livingStarvationCandidates(roster) {
  return (roster || []).filter((character) => character && ['healthy', 'wounded'].includes(character.status));
}

function starvationApplies(choice) {
  return Boolean(
    choice &&
    Number.isInteger(choice.supplyCostAtSelection) && choice.supplyCostAtSelection > 0 &&
    Number.isInteger(choice.supplyPaid) && choice.supplyPaid < choice.supplyCostAtSelection
  );
}

function hasStarvationResolution(choice) {
  return Boolean(choice?.starvationVictimId && typeof choice.starvationVictimId === 'string');
}

function deterministicStarvationVictim(run, choice) {
  const candidates = livingStarvationCandidates(run?.roster).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!candidates.length) return null;
  const seed = `${run?.id || 'run'}:${choice?.id || 'choice'}:${choice?.step || 0}:starvation`;
  return candidates[hashString(seed) % candidates.length] || null;
}

function resolveStarvation(run, choice = run?.activeTravelChoice) {
  if (!run || !choice || !starvationApplies(choice)) {
    return { run, choice, victim: null, triggered: false };
  }

  if (hasStarvationResolution(choice)) {
    const victim = (run.roster || []).find((character) => character.id === choice.starvationVictimId) || null;
    return { run, choice, victim, triggered: false };
  }

  const victim = deterministicStarvationVictim(run, choice);
  if (!victim) return { run, choice, victim: null, triggered: false };

  const kingDied = Boolean(victim.isRunKing);
  const nextChoice = {
    ...choice,
    starvationVictimId: victim.id,
    starvationKingDied: kingDied,
    starvationAcknowledged: false
  };
  const nextRoster = run.roster.map((character) => character.id === victim.id
    ? { ...character, status: 'dead' }
    : character);
  const nextRun = {
    ...run,
    roster: nextRoster,
    activeTravelChoice: nextChoice,
    ...(kingDied ? { ended: true, endReason: 'starvation_king' } : {})
  };

  return {
    run: nextRun,
    choice: nextChoice,
    victim: nextRoster.find((character) => character.id === victim.id) || null,
    triggered: true
  };
}

function hasPendingStarvation(run) {
  const choice = run?.activeTravelChoice;
  return Boolean(hasStarvationResolution(choice) && choice.starvationAcknowledged !== true);
}

function acknowledgeStarvation(run) {
  const choice = run?.activeTravelChoice;
  if (!run || !hasStarvationResolution(choice) || choice.starvationKingDied || choice.starvationAcknowledged === true) return run;
  return {
    ...run,
    activeTravelChoice: {
      ...choice,
      starvationAcknowledged: true
    }
  };
}

export {
  livingStarvationCandidates,
  starvationApplies,
  hasStarvationResolution,
  deterministicStarvationVictim,
  resolveStarvation,
  hasPendingStarvation,
  acknowledgeStarvation
};
