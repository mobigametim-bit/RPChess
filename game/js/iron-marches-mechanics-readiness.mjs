const READINESS_LABELS = Object.freeze({
  IMPLEMENTED: 'Работает',
  PARTIAL: 'Частично подключено',
  DECLARATIVE: 'Пока недоступно',
  BLOCKED_BY_DESIGN: 'Требует уточнения правил'
});

const HERO_MECHANICS = Object.freeze({
  'hero.aldric_wall': Object.freeze({
    id: 'ability.interpose',
    name: 'Перехват',
    status: 'DECLARATIVE',
    availability: 'disabled',
    note: 'Нет исполняемой runtime-команды, точных целей и стоимости.'
  }),
  'hero.mara_chain': Object.freeze({
    id: 'ability.chain_formation',
    name: 'Цепное построение',
    status: 'DECLARATIVE',
    availability: 'disabled',
    note: 'Формальное правило построения и обработчик ещё не подключены.'
  }),
  'hero.brother_orell': Object.freeze({
    id: 'ability.forge_line',
    name: 'Линия кузни',
    status: 'DECLARATIVE',
    availability: 'disabled',
    note: 'Не определены геометрия, цели и исполняемый эффект.'
  }),
  'hero.vael_hammer': Object.freeze({
    id: 'ability.previewed_charge',
    name: 'Предсказанный натиск',
    status: 'DECLARATIVE',
    availability: 'disabled',
    note: 'Не определены дальность, цена, допустимые цели и обработчик.'
  }),
  'hero.lady_sorn': Object.freeze({
    id: 'ability.hostage_tactic',
    name: 'Тактика заложника',
    status: 'DECLARATIVE',
    availability: 'disabled',
    note: 'Точный боевой эффект и условия применения ещё не заданы.'
  }),
  'hero.tomas_gate': Object.freeze({
    id: 'ability.gate_command',
    name: 'Команда ворот',
    status: 'DECLARATIVE',
    availability: 'disabled',
    note: 'Управление воротами не оформлено как runtime-команда.'
  })
});

const RELIC_MECHANICS = Object.freeze({
  'relic.echo_shield': Object.freeze({
    id: 'effect.ward_first_capture',
    name: 'Защита от первого взятия',
    status: 'IMPLEMENTED',
    availability: 'enabled',
    note: 'Владелец автоматически получает ward в начале production-боя; первое взятие предотвращается и расходует защиту.'
  }),
  'relic.phantom_spurs': Object.freeze({
    id: 'effect.visible_evasion_after_non_capture',
    name: 'Видимое уклонение',
    status: 'DECLARATIVE',
    availability: 'disabled',
    note: 'Нет обработчика, длительности и выбора клетки.'
  }),
  'relic.circle_warding': Object.freeze({
    id: 'effect.place_adjacent_ward',
    name: 'Соседний круг защиты',
    status: 'IMPLEMENTED',
    availability: 'enabled',
    note: 'Работает как UseAbility: один приказ, один раз за бой, соседняя союзная не-королевская цель.'
  }),
  'relic.twin_command': Object.freeze({
    id: 'effect.first_ability_order_discount',
    name: 'Скидка на первый приказ',
    status: 'PARTIAL',
    availability: 'limited',
    note: 'Скидка и её расходование работают в общем контуре; способность Томаса ещё не подключена.'
  }),
  'relic.royal_decree': Object.freeze({
    id: 'effect.conditional_early_promotion',
    name: 'Раннее превращение',
    status: 'DECLARATIVE',
    availability: 'disabled',
    note: 'Условия и допустимые клетки превращения не определены.'
  }),
  'relic.oath_fallen': Object.freeze({
    id: 'effect.order_after_voluntary_sacrifice',
    name: 'Приказ после жертвы',
    status: 'DECLARATIVE',
    availability: 'disabled',
    note: 'Runtime пока не различает добровольную жертву и обычную потерю.'
  })
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
