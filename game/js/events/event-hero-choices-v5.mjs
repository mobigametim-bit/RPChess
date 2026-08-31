import { RAW_EVENTS_V5_1 } from './event-hero-choices-v5-data-1.mjs';
import { RAW_EVENTS_V5_2 } from './event-hero-choices-v5-data-2.mjs';
import { RAW_EVENTS_V5_3 } from './event-hero-choices-v5-data-3.mjs';

// Generated from approved Events v5 source.
// Source SHA-256: 82eef9b76ac7af36d53cf96c6567449cf5c9fec9d106fd514ca9e5e83c86a191
// Contract: 500 events / 537 named-hero variants / HERO-01..HERO-36.
const HERO_DEFS = Object.freeze({"01":{"id":"hero.aldric_wall","name":"Альдрик Стена"},"02":{"id":"hero.mara_chain","name":"Мара Цепь"},"03":{"id":"hero.brother_orell","name":"Брат Орелл"},"04":{"id":"hero.vael_hammer","name":"Ваэль Молот"},"05":{"id":"hero.lady_sorn","name":"Леди Сорн"},"06":{"id":"hero.tomas_gate","name":"Томас Вратарь"},"07":{"id":"hero.seraph_lyra","name":"Серафима Лира"},"08":{"id":"hero.ivar_lens","name":"Ивар Линза"},"09":{"id":"hero.nemea_quill","name":"Немея Перо"},"10":{"id":"hero.orion_step","name":"Орион Шаг"},"11":{"id":"hero.abbess_celene","name":"Аббатиса Селена"},"12":{"id":"hero.deacon_mirel","name":"Диакон Мирель"},"13":{"id":"hero.cassian_coin","name":"Кассиан Монета"},"14":{"id":"hero.viola_mask","name":"Виола Маска"},"15":{"id":"hero.renzo_bridge","name":"Ренцо Мост"},"16":{"id":"hero.tessa_gull","name":"Тесса Чайка"},"17":{"id":"hero.old_marin","name":"Старый Марин"},"18":{"id":"hero.elio_silk","name":"Элио Шёлк"},"19":{"id":"hero.briar_sister","name":"Сестра Терн"},"20":{"id":"hero.roan_stag","name":"Роан Олень"},"21":{"id":"hero.maeve_root","name":"Мейв Корень"},"22":{"id":"hero.puck_ember","name":"Пак Уголёк"},"23":{"id":"hero.lord_aylen","name":"Лорд Айлен"},"24":{"id":"hero.ysra_moss","name":"Исра Мох"},"25":{"id":"hero.kael_cinder","name":"Каэль Уголь"},"26":{"id":"hero.velka_urn","name":"Велька Урна"},"27":{"id":"hero.rath_banner","name":"Рат Знамя"},"28":{"id":"hero.suri_ash","name":"Сури Пепел"},"29":{"id":"hero.empress_nahla","name":"Императрица Нахла"},"30":{"id":"hero.daro_last","name":"Даро Последний"},"31":{"id":"hero.temur_wind","name":"Темур Ветер"},"32":{"id":"hero.altana_bow","name":"Алтана Лук"},"33":{"id":"hero.batu_cliff","name":"Бату Утёс"},"34":{"id":"hero.saran_dawn","name":"Саран Рассвет"},"35":{"id":"hero.khulan_star","name":"Хулан Звезда"},"36":{"id":"hero.ergen_cloud","name":"Эрген Облако"}});

function parseRaw(raw) {
  return String(raw || '').split('\n').filter(Boolean).map((line) => {
    const [eventId, heroCode, baseChoiceId, ...lineParts] = line.split('|');
    const hero = HERO_DEFS[heroCode];
    if (!hero) throw new Error(`Events v5 unknown hero code ${heroCode}`);
    return Object.freeze({
      eventId,
      heroCode: `HERO-${heroCode}`,
      requiredHeroId: hero.id,
      heroName: hero.name,
      baseChoiceId,
      heroLine: lineParts.join('|')
    });
  });
}

const ALL_SPECS = Object.freeze([
  ...parseRaw(RAW_EVENTS_V5_1),
  ...parseRaw(RAW_EVENTS_V5_2),
  ...parseRaw(RAW_EVENTS_V5_3)
]);

const EVENT_HERO_CHOICES_V5 = Object.freeze(ALL_SPECS.reduce((acc, spec) => {
  (acc[spec.eventId] ||= []).push(spec);
  return acc;
}, {}));

for (const entries of Object.values(EVENT_HERO_CHOICES_V5)) Object.freeze(entries);

function cloneEffectForHero(effect, heroId) {
  if (!effect || typeof effect !== 'object') return effect;
  if ((effect.type === 'wound' || effect.type === 'death') && (effect.target === 'roleHero' || effect.target === 'king')) {
    return { ...effect, target: 'heroId', heroId };
  }
  return { ...effect };
}

function heroChoiceFromBase(base, spec, occurrence) {
  const suffix = occurrence > 1 ? `.${occurrence}` : '';
  return {
    ...base,
    id: `${spec.eventId}.H${spec.heroCode.slice(-2)}${suffix}`,
    role: null,
    requiredHeroId: spec.requiredHeroId,
    requiredHeroName: spec.heroName,
    heroLine: spec.heroLine,
    sourceChoiceId: spec.baseChoiceId,
    kingRisk: false,
    successEffects: (base.successEffects || []).map((effect) => cloneEffectForHero(effect, spec.requiredHeroId)),
    failureEffects: (base.failureEffects || []).map((effect) => cloneEffectForHero(effect, spec.requiredHeroId)),
    alwaysEffects: (base.alwaysEffects || []).map((effect) => cloneEffectForHero(effect, spec.requiredHeroId))
  };
}

function applyEventHeroChoicesV5(event) {
  if (!event?.id || !Array.isArray(event.choices)) return event;
  const specs = EVENT_HERO_CHOICES_V5[event.id] || [];
  if (!specs.length) return event;

  const byBase = new Map();
  const heroOccurrences = new Map();
  for (const spec of specs) {
    if (!byBase.has(spec.baseChoiceId)) byBase.set(spec.baseChoiceId, []);
    byBase.get(spec.baseChoiceId).push(spec);
  }

  const choices = [];
  for (const base of event.choices) {
    const attached = byBase.get(base.id) || [];
    if (!attached.length) {
      choices.push(base);
      continue;
    }

    // v5 personal variants supersede an abstract role gate; ordinary choices remain beside them.
    if (!base.role) choices.push(base);
    for (const spec of attached) {
      const key = `${event.id}:${spec.heroCode}`;
      const occurrence = (heroOccurrences.get(key) || 0) + 1;
      heroOccurrences.set(key, occurrence);
      choices.push(heroChoiceFromBase(base, spec, occurrence));
    }
    byBase.delete(base.id);
  }

  if (byBase.size) {
    throw new Error(`Events v5 base choice missing for ${event.id}: ${[...byBase.keys()].join(', ')}`);
  }
  return { ...event, choices };
}

function heroChoiceSpecsForEvent(eventId) {
  return EVENT_HERO_CHOICES_V5[eventId] || [];
}

const EVENT_HERO_CHOICE_COUNT = ALL_SPECS.length;

export {
  HERO_DEFS,
  EVENT_HERO_CHOICES_V5,
  EVENT_HERO_CHOICE_COUNT,
  heroChoiceSpecsForEvent,
  applyEventHeroChoicesV5
};
