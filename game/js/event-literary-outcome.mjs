import { OUTCOMES_E001_E050 } from './events/literary-outcomes-01.mjs';
import { OUTCOMES_E051_E100 } from './events/literary-outcomes-02.mjs';
import { OUTCOMES_E101_E150 } from './events/literary-outcomes-03.mjs';
import { OUTCOMES_E151_E220 } from './events/literary-outcomes-04.mjs';
import { OUTCOMES_E221_E290 } from './events/literary-outcomes-05.mjs';
import { OUTCOMES_E291_E360 } from './events/literary-outcomes-06.mjs';
import { OUTCOMES_E361_E430 } from './events/literary-outcomes-07.mjs';
import { OUTCOMES_E431_E500 } from './events/literary-outcomes-08.mjs';

// These compact modules contain only editorial prose. They never define rewards,
// chances, RNG, eligible heroes or state transitions.
const LITERARY_OUTCOMES = Object.freeze(Object.assign(Object.create(null),
  OUTCOMES_E001_E050,
  OUTCOMES_E051_E100,
  OUTCOMES_E101_E150,
  OUTCOMES_E151_E220,
  OUTCOMES_E221_E290,
  OUTCOMES_E291_E360,
  OUTCOMES_E361_E430,
  OUTCOMES_E431_E500
));

function literaryOutcomeForEvent(event, outcome, run, language = 'ru') {
  // There are no authored EN counterparts yet: preserve existing localized
  // result notes without mixing Russian narrative into the English interface.
  if (language !== 'ru' || !event || !outcome || !Array.isArray(outcome.effectReceipts)) return '';
  const choice = (event.choices || []).find((item) => item.id === outcome.choiceId);
  if (!choice) return '';
  const entry = LITERARY_OUTCOMES[choice.sourceChoiceId || choice.id];
  if (!entry) return '';
  const branch = outcome.success ? 's' : 'f';
  let prose = entry[branch];
  if (typeof prose !== 'string' || !prose.trim()) return '';

  const receipts = outcome.effectReceipts;
  const recruitUnavailable = receipts.some((receipt) => receipt?.type === 'recruit' && receipt.unavailable);
  const targetMissing = receipts.some((receipt) => (receipt?.type === 'wound' || receipt?.type === 'death') && receipt.skipped);
  if (recruitUnavailable) prose = entry.v?.[outcome.success ? 'rs' : 'rf'] || '';
  if (targetMissing) prose = entry.v?.[outcome.success ? 'ns' : 'nf'] || '';
  if (!prose) return ''; // Never promise a reward or casualty that did not happen.

  const actingHero = (run?.roster || []).find((hero) => hero.id === outcome.heroId);
  const heroName = actingHero?.name || choice.requiredHeroName || '';
  const affectedReceipt = receipts.find((receipt) =>
    (receipt?.type === 'wound' || receipt?.type === 'death') && receipt.targetId && receipt.targetName);
  const affectedHeroName = affectedReceipt?.targetName || '';
  const values = { heroName, affectedHeroName };
  const text = prose.replace(/\{\{(heroName|affectedHeroName)\}\}/g, (_match, key) => values[key]);

  // Old saves lacking receipts, missing names and unexpected tokens fall back
  // to the already persisted factual outcome.notes, not a guessed story.
  return /\{\{[^}]*\}\}/.test(text) || !text.trim() ? '' : text;
}

export { LITERARY_OUTCOMES, literaryOutcomeForEvent };
