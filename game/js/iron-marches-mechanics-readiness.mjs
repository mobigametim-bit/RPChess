const READINESS_LABELS = Object.freeze({
  IMPLEMENTED: 'Работает',
  PARTIAL: 'Частично подключено',
  DECLARATIVE: 'Пока недоступно',
  BLOCKED_BY_DESIGN: 'Требует уточнения правил'
});

const HERO_MECHANICS = Object.freeze({
  'hero.aldric_wall': Object.freeze({ id: 'ability.interpose', name: 'Перехват', status: 'IMPLEMENTED', availability: 'enabled', note: 'Соседняя союзная фигура получает видимую одноразовую защиту от взятия.' }),
  'hero.mara_chain': Object.freeze({ id: 'ability.chain_formation', name: 'Цепное построение', status: 'IMPLEMENTED', availability: 'enabled', note: 'Две соседние союзные пешки одновременно продвигаются на одну свободную легальную клетку.' }),
  'hero.brother_orell': Object.freeze({ id: 'ability.forge_line', name: 'Линия кузни', status: 'IMPLEMENTED', availability: 'enabled', note: 'На выбранной свободной диагональной клетке создаётся видимый временный блокер.' }),
  'hero.vael_hammer': Object.freeze({ id: 'ability.previewed_charge', name: 'Предсказанный натиск', status: 'IMPLEMENTED', availability: 'enabled', note: 'Игрок заранее выбирает и видит оба неатакующих прыжка коня; стоимость — два приказа.' }),
  'hero.lady_sorn': Object.freeze({ id: 'ability.hostage_tactic', name: 'Тактика заложника', status: 'IMPLEMENTED', availability: 'enabled', note: 'Леди Сорн и выбранная вражеская фигура получают взаимную видимую связку.' }),
  'hero.tomas_gate': Object.freeze({ id: 'ability.gate_command', name: 'Команда ворот', status: 'IMPLEMENTED', availability: 'enabled', note: 'Томас детерминированно открывает или закрывает выбранную видимую клетку ворот.' })
});

const RELIC_MECHANICS = Object.freeze({
  'relic.echo_shield': Object.freeze({ id: 'effect.ward_first_capture', name: 'Защита от первого взятия', status: 'IMPLEMENTED', availability: 'enabled', note: 'Владелец автоматически получает ward; первое взятие предотвращается и расходует защиту.' }),
  'relic.phantom_spurs': Object.freeze({ id: 'effect.visible_evasion_after_non_capture', name: 'Видимое уклонение', status: 'IMPLEMENTED', availability: 'enabled', note: 'Первый неатакующий ход коня даёт видимое уклонение, которое отменяет следующее взятие.' }),
  'relic.circle_warding': Object.freeze({ id: 'effect.place_adjacent_ward', name: 'Соседний круг защиты', status: 'IMPLEMENTED', availability: 'enabled', note: 'Один приказ, один раз за бой, соседняя союзная не-королевская цель получает ward.' }),
  'relic.twin_command': Object.freeze({ id: 'effect.first_ability_order_discount', name: 'Скидка на первый приказ', status: 'IMPLEMENTED', availability: 'enabled', note: 'Первая активная способность владельца в бою стоит на один приказ меньше и расходует скидку.' }),
  'relic.royal_decree': Object.freeze({ id: 'effect.conditional_early_promotion', name: 'Раннее превращение', status: 'IMPLEMENTED', availability: 'enabled', note: 'Пешка на предпоследней горизонтали может за два приказа досрочно превратиться в ладью, слона или коня.' }),
  'relic.oath_fallen': Object.freeze({ id: 'effect.order_after_voluntary_sacrifice', name: 'Приказ после жертвы', status: 'IMPLEMENTED', availability: 'enabled', note: 'Игрок заранее объявляет атакуемую союзную фигуру жертвой; её взятие приносит два приказа.' })
});

function readinessLabel(status) {
  return READINESS_LABELS[status] || String(status || 'Неизвестно');
}

function heroMechanicReadiness(heroId) {
  return HERO_MECHANICS[String(heroId || '')] || null;
}

function relicMechanicReadiness(relicId) {
  return RELIC_MECHANICS[String(relicId || '')] || null;
}

function heroMechanicsSummary(heroId, relicIds = []) {
  const ability = heroMechanicReadiness(heroId);
  const relics = Object.freeze((relicIds || []).map(relicMechanicReadiness).filter(Boolean));
  return Object.freeze({ heroId, ability, relics });
}

export {
  READINESS_LABELS,
  HERO_MECHANICS,
  RELIC_MECHANICS,
  readinessLabel,
  heroMechanicReadiness,
  relicMechanicReadiness,
  heroMechanicsSummary
};
