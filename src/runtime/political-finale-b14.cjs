'use strict';

const { hash32 } = require('../core/determinism.cjs');

const B14_FORMAT = 'rpchess-iron-marches-political-finale-b14';
const B14_SCHEMA_VERSION = 1;
const FORCE_IDS = Object.freeze(['crown', 'military_council', 'forge_council', 'marches_charter']);
const GOVERNMENT_IDS = Object.freeze(['crown', 'military_council', 'forge_council', 'marches_charter', 'crown_forge', 'crown_charter', 'military_forge', 'military_charter']);

function freezeArray(values) { return Object.freeze((values || []).slice()); }
function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value); Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child, seen); return value;
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function idsFromNarrative(narrative) {
  if (!narrative) return [];
  if (Array.isArray(narrative)) return narrative.map(String);
  return Object.values(narrative.currentFacts || {}).map((fact) => String(fact?.id || '')).filter(Boolean);
}
function hasAny(ids, needles) { return needles.some((needle) => ids.some((id) => id === needle || id.includes(needle))); }
function deterministicOrder(values, seed, salt) { return values.slice().sort((a, b) => hash32(`${seed}:${salt}:${a.id}`) - hash32(`${seed}:${salt}:${b.id}`) || a.id.localeCompare(b.id)); }

// The B14 authoring specifies which resource domains a crisis may touch, but does not
// authorize numeric cabinet prices yet. Keep the numeric contract at zero instead of
// inventing values; future authored content can add exact costs atomically.
const FORCE_DEFINITIONS = deepFreeze({
  crown: { id:'crown', name:'Корона', direction:'казна, официальные ресурсы, дипломатия', portrait:'assets/politics/heir_elda.png', crisisNeedles:['crown_delegitimized','crown_illegitimate','royal_mandate_rejected'], demand:{ title:'Признать арбитраж Короны', description:'Сохранить ограниченное право назначения и формальное признание королевского мандата.', resourceTypes:['gold'], costGold:0, costSupplies:0, acceptedFact:'obligation.iron_marches.royal_arbitration', refusedFact:'politics.iron_marches.crown_crisis_unresolved', risk:'Отказ ослабит королевские коалиции и изменит эпилог.' } },
  military_council: { id:'military_council', name:'Военный совет', direction:'разведка, военная подготовка, оборонная помощь', portrait:'assets/politics/marshal_varn.png', crisisNeedles:['garrison_divided','officer_revolt','council_resentful'], demand:{ title:'Сохранить переходное командование', description:'На переходный срок сохранить непрерывность командования гарнизонами.', resourceTypes:['supplies'], costGold:0, costSupplies:0, acceptedFact:'obligation.iron_marches.garrison_transition', refusedFact:'politics.iron_marches.military_crisis_unresolved', risk:'Отказ ухудшит военные коалиции и доступность оборонной помощи.' } },
  forge_council: { id:'forge_council', name:'Совет горна', direction:'производство, ремонт, припасы', portrait:'assets/politics/guildmaster_borek.png', crisisNeedles:['workers_hostile','strike_broken','mine_abuse_proven'], demand:{ title:'Гарантировать трудовой компромисс', description:'Амнистия, компенсация и признание участия мастеров в управлении производством.', resourceTypes:['gold'], costGold:0, costSupplies:0, acceptedFact:'obligation.iron_marches.forge_amnesty', refusedFact:'politics.iron_marches.forge_crisis_unresolved', risk:'Отказ ухудшит производственные коалиции и социальные события.' } },
  marches_charter: { id:'marches_charter', name:'Хартия Маршей', direction:'информация, политические связи, гражданская поддержка', portrait:'assets/events/register-04/political/peoples_petition.png', crisisNeedles:['illegal_purge','emergency_indefinite','lawless_command','charter_rejected'], demand:{ title:'Ограничить чрезвычайную власть', description:'Установить срок чрезвычайных полномочий и признать правовую процедуру финального собрания.', resourceTypes:[], costGold:0, costSupplies:0, acceptedFact:'obligation.iron_marches.emergency_term', refusedFact:'politics.iron_marches.charter_crisis_unresolved', risk:'Отказ ухудшит правовые коалиции и изменит гражданский эпилог.' } }
});

const GOVERNMENTS = deepFreeze({
  crown:{ id:'crown', name:'Корона', kind:'base', forces:['crown'], description:'Централизованная монархическая власть, опирающаяся на казну, назначения и официальную дипломатию.', warning:'Локальные институты получают меньше самостоятельности.' },
  military_council:{ id:'military_council', name:'Военный совет', kind:'base', forces:['military_council'], description:'Гарнизоны и офицеры сохраняют ведущую роль в безопасности и восстановлении Маршей.', warning:'Гражданские решения подчиняются оборонному приоритету.' },
  forge_council:{ id:'forge_council', name:'Совет горна', kind:'base', forces:['forge_council'], description:'Мастера, шахты и производственные советы становятся основой региональной власти.', warning:'Центральная власть получает меньше прямого контроля над ресурсами.' },
  marches_charter:{ id:'marches_charter', name:'Хартия Маршей', kind:'base', forces:['marches_charter'], description:'Правовые ограничения, выборные институты и местное самоуправление становятся основой порядка.', warning:'Экстренные силовые решения требуют более строгой процедуры.' },
  crown_forge:{ id:'crown_forge', name:'Корона + Совет горна', subtitle:'Социальная монархия', kind:'coalition', forces:['crown','forge_council'], description:'Королевская легитимность сочетается с договорным управлением производством.', warning:'Компромисс требует поддерживать и казну, и трудовые обязательства.' },
  crown_charter:{ id:'crown_charter', name:'Корона + Хартия', subtitle:'Конституционная модель', kind:'coalition', forces:['crown','marches_charter'], description:'Корона сохраняется в рамках признанных правовых ограничений и выборных институтов.', warning:'Ни централизация, ни местная автономия не получают максимальной свободы.' },
  military_forge:{ id:'military_forge', name:'Военный совет + Совет горна', subtitle:'Мобилизационная модель', kind:'coalition', forces:['military_council','forge_council'], description:'Офицеры и мастера совместно управляют обороной, снабжением и восстановлением.', warning:'Гражданская дипломатия уступает место производственно-военному договору.' },
  military_charter:{ id:'military_charter', name:'Военный совет + Хартия', subtitle:'Военная республика', kind:'coalition', forces:['military_council','marches_charter'], description:'Армия действует по ограниченному правовому мандату и отвечает перед гражданскими институтами.', warning:'Продление чрезвычайных полномочий требует нового мандата.' }
});

const COALITION_RULES = deepFreeze({
  crown_forge:{ strong:['labor_rights','furnace_oath','strike_compromise','strike_workers_backed','shared_forge','forge_amnesty'], normal:['workers_support_crown','mine_audit'], weak:[], block:['workers_hostile','strike_broken','forge_crisis_unresolved'] },
  crown_charter:{ strong:['legal_procedure','emergency_term','lawful','charter','royal_arbitration'], normal:['standard_ratified','public_ledger'], weak:[], block:['illegal_purge','crown_delegitimized','charter_crisis_unresolved'] },
  military_forge:{ strong:['mobilization','supply_compact','workers_defense','garrison_forge','forge_amnesty'], normal:['garrison_united','furnace_oath'], weak:[], block:['workers_hostile','strike_broken','supply_sabotage','forge_crisis_unresolved'] },
  military_charter:{ strong:['legal_command','army_reform','garrison_united','standard_ratified','emergency_term'], normal:['prisoners','lawful'], weak:[], block:['garrison_divided','officer_revolt','military_crisis_unresolved','charter_crisis_unresolved'] }
});

const REASON_COPY = deepFreeze({
  labor_rights:'Рабочие права уже признаны решениями этого похода.',
  furnace_oath:'Решения у горна создали основу для совместного управления производством.',
  strike_compromise:'Компромисс в шахтах дал Короне и мастерам общий политический фундамент.',
  strike_workers_backed:'Поддержка шахтёров связывает Корону с производственными советами.',
  shared_forge:'Контроль горнов уже разделён между сторонами.',
  forge_amnesty:'Трудовой компромисс и амнистия позволяют заключить устойчивый союз.',
  workers_support_crown:'Рабочие сохранили поддержку Короны.',
  mine_audit:'Аудит шахт создал почву для договорного контроля производства.',
  legal_procedure:'Поход закрепил правовую процедуру принятия чрезвычайных решений.',
  emergency_term:'Чрезвычайные полномочия уже ограничены признанным сроком.',
  lawful:'Предыдущие решения укрепили законный порядок.',
  charter:'Хартия получила политическое признание в ходе акта.',
  royal_arbitration:'Королевский арбитраж признан законной частью нового порядка.',
  standard_ratified:'Полномочия хранителя знамени закреплены формальной клятвой.',
  public_ledger:'Открытые книги усилили запрос на подотчётное управление.',
  mobilization:'Производство и гарнизоны уже связаны общими мобилизационными решениями.',
  supply_compact:'Снабжение опирается на совместный договор военных и мастеров.',
  workers_defense:'Защита рабочих стала частью оборонного соглашения.',
  garrison_forge:'Гарнизон и горны уже действуют как единая система снабжения.',
  garrison_united:'Гарнизон сохранил единство и способен принять общий мандат.',
  legal_command:'Командование уже связано признанной правовой процедурой.',
  army_reform:'Военные решения похода создали основу для ограниченного мандата армии.',
  prisoners:'Решение о пленных стало прецедентом для военного закона.'
});

function law(id, name, category, advantage, cost) { return deepFreeze({ id, name, category, advantage, cost, universallyValid:true }); }
const LAW_POOLS = deepFreeze({
  crown:[
    law('royal_command','Королевское назначение командиров','command','Дешевле одна военная подготовка или разведка в каждом последующем акте.','Гражданские политические услуги чаще требуют дополнительного золота.'),
    law('crown_forge_ownership','Шахты принадлежат Короне, мастера управляют производством','labor_production','Первая крупная ремонтная услуга следующего акта дешевле.','Часть социальных компромиссов требует компенсации.'),
    law('limited_emergency_edicts','Чрезвычайный указ действует ограниченный срок','law','Лучшие условия в правовых и гражданских событиях.','Военная экстренная помощь требует больше припасов.'),
    law('appointed_castellans','Кастелянов назначает Корона','local_governance','Официальный региональный запрос может дать больше золота.','Локальные общественные варианты поддержки встречаются реже.'),
    law('royal_amnesty','Королевская амнистия после регионального кризиса','law','Снижает стоимость примирительных политических решений.','Жёсткие силовые решения дают меньше краткосрочной экономии.')],
  military_council:[
    law('unified_garrison_command','Единое командование гарнизонами','command','Одна военная разведка после входа в новый акт бесплатна.','Гражданские сервисы дороже.'),
    law('wartime_production_priority','Военные поставки имеют первый приоритет','labor_production','Первая закупка припасов или ремонта дешевле.','Торговые и социальные события чаще требуют компенсации.'),
    law('codified_emergency_power','Чрезвычайные полномочия армии перечислены законом','law','Экстренные военные контекстные опции дешевле.','Использование гражданско-политической поддержки может требовать ресурс.'),
    law('garrison_autonomy','Гарнизоны самостоятельно решают локальные вопросы обороны','local_governance','Лучше подготовительные опции перед тяжёлым боем.','Официальная дипломатическая помощь региона менее гибкая.'),
    law('officer_accountability','Военные решения подлежат послебоевому разбору','law','События о дисциплине получают улучшенный компромисс.','Принудительные решения не дают максимальной краткосрочной выгоды.')],
  forge_council:[
    law('masters_elect_quartermasters','Мастера выбирают распорядителей снабжения','command','Сервисные цены ремонта и припасов ниже.','Официальные королевские субсидии менее эффективны.'),
    law('right_to_stop_unsafe_work','Право остановки опасных работ','labor_production','Меньше тяжёлых последствий производственных событий.','Экстренные военные поставки стоят дороже.'),
    law('forge_contract_supremacy','Производственный договор имеет силу регионального закона','law','Торгово-производственные договоры дают лучший гарантированный результат.','Разрыв договора требует повышенной компенсации.'),
    law('professional_councils','Города признают профессиональные советы мастеров','local_governance','Дополнительные варианты в ремесленных и трудовых событиях.','Прямой сбор золота центральной властью ниже.'),
    law('shared_safety_fund','Общий фонд восстановления шахт и мастерских','labor_production','Первая тяжёлая сервисная потеря следующего акта смягчается.','Часть крупной субсидии уходит в фонд.')],
  marches_charter:[
    law('charter_ratifies_commanders','Командиры получают полномочия через Хартию','command','Политико-военные компромиссы чаще имеют прозрачный безопасный вариант.','Срочная военная помощь требует дополнительного ресурса.'),
    law('workers_petition_right','Рабочие имеют право на обязательное рассмотрение петиции','labor_production','Социальные события чаще дают компромисс без тяжёлого наказания.','Некоторые быстрые производственные решения стоят дороже.'),
    law('fixed_emergency_term','Чрезвычайные полномочия имеют фиксированный срок','law','Правовые события и дипломатия получают улучшенные варианты.','Экстренная силовая опция не получает максимального бонуса.'),
    law('elected_local_councils','Города избирают местные советы','local_governance','Лучше общественная поддержка и информация.','Меньше прямых централизованных ресурсов.'),
    law('public_ledger','Крупные региональные расходы публикуются в открытом реестре','law','Финансовые политические сделки имеют меньший риск скрытой цены.','Подкуп и неформальная покупка влияния обходятся дороже.')],
  crown_forge:[
    law('dual_seal_command','Военные назначения требуют королевской печати и подписи Совета горна','command','Снабжение и подготовка лучше синхронизированы.','Срочная подготовка дороже без подходящего сервиса.'),
    law('shared_forge_seal','Корона владеет шахтами, Совет горна управляет производством по общей печати','labor_production','Сильная скидка на одну крупную ремонтную или снабженческую операцию.','Отказ от трудового компромисса требует компенсации.'),
    law('binding_labor_compact','Трудовой договор обязателен и для Короны, и для мастеров','law','Социально-производственные события чаще имеют устойчивый компромисс.','Односторонние ресурсные решения менее выгодны.'),
    law('chartered_forge_towns','Города горнов получают ограниченное самоуправление','local_governance','Локальные сервисы и ремесленные контакты лучше.','Централизованная денежная помощь немного меньше.'),
    law('reconstruction_tithe','Часть королевской казны закрепляется за восстановлением производств','labor_production','Первая крупная потеря припасов или ремонта смягчается.','Одна будущая денежная награда уменьшается.')],
  crown_charter:[
    law('ratified_command','Корона назначает командиров, Хартия ратифицирует полномочия','command','Военная помощь сохраняет качество без усиления гражданских кризисов.','Срочное назначение требует золота или припасов.'),
    law('protected_labor_petitions','Трудовые петиции защищены Хартией и рассматриваются королевским судом','labor_production','Больше мирных вариантов в социальных событиях.','Производственные уступки иногда дороже.'),
    law('crown_bound_by_term','Корона не может продлевать чрезвычайные полномочия без нового мандата','law','Сильные правовые и дипломатические контекстные опции.','Экстренная централизация ресурсов менее эффективна.'),
    law('elected_councils_royal_veto','Местные советы избираются, Корона сохраняет ограниченное вето','local_governance','Общественная поддержка и официальная дипломатия доступны вместе.','Ни один из двух типов помощи не получает максимальный эффект чистого режима.'),
    law('constitutional_ledger','Крупные указы и расходы требуют публичного обоснования','law','Меньше скрытых политических цен.','Неформальные сделки стоят дороже.')],
  military_forge:[
    law('joint_logistics_command','Офицеры и мастера совместно управляют военной логистикой','command','Подготовка и ремонт дешевле.','Гражданские дипломатические решения дороже.'),
    law('defense_quota_with_floor','Военные квоты действуют только после гарантированного гражданского минимума','labor_production','Устойчивое снабжение и меньше социальных кризисов.','Максимальный объём экстренных припасов ниже.'),
    law('mobilization_code','Правила мобилизации заранее закреплены кодексом','law','Экстренные военные опции предсказуемее и дешевле.','Нестандартные политические сделки менее гибки.'),
    law('fortress_work_councils','При гарнизонах действуют совместные советы офицеров и мастеров','local_governance','Дополнительные варианты ремонта и подготовки в военных контекстах.','Чистая денежная помощь встречается реже.'),
    law('veteran_worker_guarantee','Раненые защитники и работники получают общий фонд восстановления','labor_production','Одна тяжёлая стоимость лечения или ремонта снижается.','Часть военной субсидии резервируется фондом.')],
  military_charter:[
    law('elected_war_mandate','Военное командование действует по ограниченному мандату Хартии','command','Сильная военная разведка без ухудшения общественных событий.','Продление экстренной подготовки требует ресурса.'),
    law('civil_supply_guarantee','Военные квоты не могут опустить гражданское снабжение ниже гарантированного уровня','labor_production','Меньше кризисов снабжения и лучше гражданские события.','Максимальная скидка на военные припасы снижена.'),
    law('reviewable_emergency_orders','Каждый чрезвычайный приказ подлежит правовой проверке','law','Доступ к безопасным компромиссам в силовых и правовых событиях.','Самые быстрые авторитарные варианты дороже.'),
    law('elected_garrison_councils','Гарнизоны имеют выборные гражданско-военные советы','local_governance','Информация и разведывательные контакты сильнее.','Централизованная ресурсная помощь слабее.'),
    law('officer_recall','Командир может быть отозван по установленной процедуре','law','Кризисы дисциплины легче разрешать без тяжёлого исхода.','Некоторые жёсткие военные бонусы недоступны.')]
});

function deriveForceStates(narrative) {
  const ids = idsFromNarrative(narrative);
  return deepFreeze(Object.fromEntries(FORCE_IDS.map((id) => {
    const force = FORCE_DEFINITIONS[id];
    const crisis = hasAny(ids, force.crisisNeedles);
    return [id, { id, name:force.name, direction:force.direction, portrait:force.portrait, status:crisis ? 'crisis' : 'normal', demand:crisis ? force.demand : null }];
  })));
}
function reasonCopy(needle) { return REASON_COPY[needle] || 'Решения похода создали основание для этого союза.'; }
function coalitionAnalysis(governmentId, facts, forceStates) {
  const rule = COALITION_RULES[governmentId]; const ids = facts;
  const block = hasAny(ids, rule.block);
  const strong = rule.strong.filter((needle) => hasAny(ids,[needle]));
  const normal = rule.normal.filter((needle) => hasAny(ids,[needle]));
  const weak = (rule.weak || []).filter((needle) => hasAny(ids,[needle]));
  const crises = GOVERNMENTS[governmentId].forces.filter((id) => forceStates[id]?.status === 'crisis').length;
  const available = strong.length > 0 && !block;
  const reasons = [...strong.slice(0,2), ...normal.slice(0,1)].slice(0,3).map(reasonCopy);
  return { id:governmentId, available, strong:strong.length, normal:normal.length, weak:weak.length, crises, reasons, blocked:block };
}
function availableGovernments(finale) {
  const ids = [...finale.factIds, ...Object.values(finale.cabinetResolutions || {}).map((v)=>v.factId).filter(Boolean)];
  const base = ['crown','military_council','forge_council','marches_charter'].map((id)=>({ ...GOVERNMENTS[id], available:true, reasons:[], variant:finale.forceStates[id]?.status === 'crisis' ? 'crisis' : 'normal', costGold:0, costSupplies:0 }));
  let coalitions = ['crown_forge','crown_charter','military_forge','military_charter'].map((id)=>({ ...GOVERNMENTS[id], ...coalitionAnalysis(id,ids,finale.forceStates) })).filter((entry)=>entry.available);
  if (coalitions.length > 3) coalitions = coalitions.sort((a,b)=>b.strong-a.strong || b.normal-a.normal || a.crises-b.crises || b.weak-a.weak || hash32(`${finale.finaleSeed}:${a.id}`)-hash32(`${finale.finaleSeed}:${b.id}`)).slice(0,3);
  return deepFreeze([...base,...coalitions]);
}
function materializeLaws(finale, governmentId) {
  const pool = (LAW_POOLS[governmentId] || []).slice();
  const specialUnsafe = hasAny(finale.factIds,['strike_workers_backed','strike_compromise','right_to_stop_unsafe_work']);
  if (specialUnsafe) {
    const index = pool.findIndex((entry)=>entry.category === 'labor_production');
    if (index >= 0) pool[index] = law('charter_safe_work_stop','Закрепить право остановки опасных работ в Хартии Маршей','labor_production','Меньше тяжёлых последствий производственных событий.','Экстренные производственные и военные решения требуют большего ресурса.');
  }
  // No additional incompatibility numbers or predicates are authored on 12.8 yet.
  // Keep the baseline pool intact rather than inventing exclusions.
  const ordered = deterministicOrder(pool, finale.finaleSeed, `laws:${governmentId}`);
  const selected=[]; const categories=new Set();
  for (const entry of ordered) { if (categories.has(entry.category)) continue; selected.push(entry); categories.add(entry.category); if (selected.length===3) break; }
  if (selected.length !== 3 || new Set(selected.map((entry)=>entry.category)).size !== 3) throw new Error('B14 must materialize exactly three laws from distinct categories');
  if (selected.filter((entry)=>entry.universallyValid !== false).length < 2) throw new Error('B14 must retain at least two universally valid laws');
  return deepFreeze(selected);
}
function regionalLineCopy(lineId, status) {
  const names = lineId === 'iron_and_bread' ? 'Шахты, горны и трудовой договор' : 'Гарнизоны, знамя и воинский закон';
  const endings = {
    favorable:'завершились устойчивым соглашением, которое признали участники конфликта.',
    crisis:'завершились после тяжёлого кризиса; новый порядок сохраняет следы раскола.',
    standalone:'получили самостоятельное решение в ходе похода и закреплены финальным устройством региона.',
    incomplete:'не были доведены до отдельной развязки и теперь закрыты итоговым политическим решением.',
    unstarted:'не стали отдельной линией этого похода; их судьбу определило финальное устройство Маршей.'
  };
  return `${names} ${endings[status] || endings.incomplete}`;
}
function notableOutcomeCopy(id) {
  if (id.includes('prisoners_released')) return 'Пленные перевала были освобождены, и решение стало частью памяти Маршей.';
  if (id.includes('prisoners_recruited')) return 'Часть пленных принесла новую клятву и вошла в войско.';
  if (id.includes('prisoners_exchanged')) return 'Судьбу пленных решил обмен, закрепив новый военный прецедент.';
  if (id.includes('amnesty')) return 'Амнистия стала одним из условий послевоенного примирения.';
  if (id.includes('hero.')) return 'Судьба одного из героев заметно повлияла на итог Железных Маршей.';
  return null;
}
function buildEpilogue(finale) {
  const government = GOVERNMENTS[finale.governmentId]; const selectedLaw = finale.lawOffers.find((entry)=>entry.id===finale.legacyLawId) || null;
  const cards=[
    { id:'government', title:'Новая власть', body:`${government?.name || 'Новая власть'}. ${government?.description || ''}` },
    { id:'law', title:'Принятый закон', body:selectedLaw ? `${selectedLaw.name}. Преимущество: ${selectedLaw.advantage} Цена: ${selectedLaw.cost}` : 'Основной закон ещё не выбран.' },
    { id:'iron_and_bread', title:'Железо и хлеб', body:regionalLineCopy('iron_and_bread', finale.regionalLines?.iron_and_bread || 'unstarted') },
    { id:'honor_of_marches', title:'Честь Маршей', body:regionalLineCopy('honor_of_marches', finale.regionalLines?.honor_of_the_marches || 'unstarted') }
  ];
  const notable = finale.factIds.map(notableOutcomeCopy).filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).slice(0,3);
  if (notable.length) cards.push({ id:'people', title:'Люди и последствия', body:notable.join(' ') });
  return deepFreeze(cards);
}
function createPoliticalFinale(options={}) {
  const factIds=freezeArray(idsFromNarrative(options.narrative).sort()); const finaleSeed=hash32(`${Number(options.seed||1)}:iron_marches:B14`); const forceStates=deriveForceStates(options.narrative);
  const crisisQueue=freezeArray(FORCE_IDS.filter((id)=>forceStates[id].status==='crisis'));
  return deepFreeze({ format:B14_FORMAT, schemaVersion:B14_SCHEMA_VERSION, stage:'cabinet', finaleSeed, factIds, regionalLines:deepFreeze({ ...(options.regionalLines||{}) }), forceStates, crisisQueue, crisisIndex:0, cabinetResolutions:deepFreeze({}), governmentId:null, governmentOffers:freezeArray([]), lawOffers:freezeArray([]), legacyLawId:null, support:deepFreeze({ regionId:'region.iron_marches', charges:0, maximum:2, directions:freezeArray([]) }), epilogueCards:freezeArray([]), actRewardClaimed:false, actRewardId:null, completed:false });
}
function currentCabinetDemand(finale) { const forceId=finale.crisisQueue[finale.crisisIndex]; return forceId ? finale.forceStates[forceId]?.demand || null : null; }
function cabinetChoices(finale, resources={}) {
  const forceId=finale.crisisQueue[finale.crisisIndex]; const demand=currentCabinetDemand(finale);
  if (!forceId || !demand) return deepFreeze([{ id:'cabinet_confirm', title:'Утвердить чрезвычайный кабинет', consequence:'Распределить временные полномочия между четырьмя силами и перейти к выбору постоянной власти.', available:true, costGold:0, costSupplies:0, supporters:FORCE_IDS }]);
  const affordable=Number(resources.gold||0)>=demand.costGold && Number(resources.supplies||0)>=demand.costSupplies;
  return deepFreeze([
    { id:`cabinet_accept:${forceId}`, title:demand.title, consequence:`${demand.description} Точная числовая ресурсная цена пока не авторизована; дополнительных ресурсов не списывается.`, available:affordable, costGold:demand.costGold, costSupplies:demand.costSupplies, supporters:[forceId], risk:demand.risk },
    { id:`cabinet_refuse:${forceId}`, title:`Отказать: ${FORCE_DEFINITIONS[forceId].name}`, consequence:`Не выполнять требование. ${demand.risk}`, available:true, costGold:0, costSupplies:0, supporters:[] }
  ]);
}
function resolveCabinet(finaleInput, choiceId, resources={}) {
  const finale=clone(finaleInput); const forceId=finale.crisisQueue[finale.crisisIndex];
  if (!forceId) { if (choiceId!=='cabinet_confirm') throw new Error('cabinet confirmation is required'); finale.stage='government'; finale.governmentOffers=availableGovernments(finale); return deepFreeze({ finale, resources:{...resources} }); }
  const demand=finale.forceStates[forceId].demand; const accept=choiceId===`cabinet_accept:${forceId}`; const refuse=choiceId===`cabinet_refuse:${forceId}`; if(!accept&&!refuse) throw new Error('invalid cabinet resolution');
  if(accept && (Number(resources.gold||0)<demand.costGold || Number(resources.supplies||0)<demand.costSupplies)) throw new Error('cabinet demand is unaffordable');
  const factId=accept?demand.acceptedFact:demand.refusedFact; finale.cabinetResolutions[forceId]={ accepted:accept, factId }; finale.crisisIndex+=1;
  const nextResources={...resources, gold:Number(resources.gold||0)-(accept?demand.costGold:0), supplies:Number(resources.supplies||0)-(accept?demand.costSupplies:0)};
  if(finale.crisisIndex>=finale.crisisQueue.length){ finale.stage='government'; finale.governmentOffers=availableGovernments(finale); }
  return deepFreeze({ finale, resources:nextResources });
}
function chooseGovernment(finaleInput, governmentId) {
  const finale=clone(finaleInput); if(finale.stage!=='government') throw new Error('government stage is not active'); const offer=(finale.governmentOffers||[]).find((entry)=>entry.id===governmentId&&entry.available); if(!offer) throw new Error('government is unavailable'); finale.governmentId=governmentId; finale.stage='law'; finale.lawOffers=materializeLaws(finale,governmentId); return deepFreeze(finale);
}
function chooseLaw(finaleInput, lawId) {
  const finale=clone(finaleInput); if(finale.stage!=='law') throw new Error('law stage is not active'); const selected=(finale.lawOffers||[]).find((entry)=>entry.id===lawId); if(!selected) throw new Error('law is unavailable'); finale.legacyLawId=lawId; finale.support={ regionId:'region.iron_marches', charges:1, maximum:2, directions:freezeArray((GOVERNMENTS[finale.governmentId]?.forces||[]).map((id)=>FORCE_DEFINITIONS[id].direction)) }; finale.stage='epilogue'; finale.epilogueCards=buildEpilogue(finale); return deepFreeze(finale);
}
function finishEpilogue(finaleInput) { const finale=clone(finaleInput); if(finale.stage!=='epilogue') throw new Error('epilogue is not active'); finale.stage='act_reward'; return deepFreeze(finale); }
function finishActReward(finaleInput, rewardId) { const finale=clone(finaleInput); if(finale.stage!=='act_reward') throw new Error('act reward is not active'); if (!rewardId) throw new Error('act reward id is required'); finale.actRewardClaimed=true; finale.actRewardId=String(rewardId); finale.stage='interact'; return deepFreeze(finale); }
function completeFinale(finaleInput) { const finale=clone(finaleInput); if(finale.stage!=='interact') throw new Error('inter-act state is not active'); finale.stage='complete'; finale.completed=true; return deepFreeze(finale); }
function playerGovernmentChoice(choice) {
  return deepFreeze({ id:choice.id, name:choice.name, subtitle:choice.subtitle || null, kind:choice.kind, description:choice.description || '', warning:choice.warning || '', reasons:freezeArray(choice.reasons || []), available:choice.available !== false, variant:choice.variant || 'normal', costGold:Number(choice.costGold || 0), costSupplies:Number(choice.costSupplies || 0) });
}
function finaleSurface(finale, resources={}) {
  if(!finale) return null;
  if(finale.stage==='cabinet') return deepFreeze({ stage:'cabinet', title:'Чрезвычайный кабинет', summary:'После падения Железного Регента четыре силы должны превратить военный приказ во временный законный порядок.', forces:Object.values(finale.forceStates), choices:cabinetChoices(finale,resources) });
  if(finale.stage==='government') return deepFreeze({ stage:'government', title:'Форма власти', summary:'Выберите постоянную модель власти. Четыре базовых пути всегда доступны; коалиции зависят от истории прохождения.', choices:finale.governmentOffers.map(playerGovernmentChoice) });
  if(finale.stage==='law') return deepFreeze({ stage:'law', title:'Фундаментальный закон', summary:'Выберите один из трёх законов разных категорий. Он станет единственным механическим наследием Железных Маршей.', choices:finale.lawOffers });
  if(finale.stage==='epilogue') return deepFreeze({ stage:'epilogue', title:'Эпилог Железных Маршей', summary:'Регион запоминает новую власть, закон и последствия ваших решений.', cards:finale.epilogueCards, choices:[{ id:'epilogue_continue', title:'Продолжить', consequence:'Перейти к крупной награде за завершение акта.', available:true }] });
  if(finale.stage==='act_reward') return deepFreeze({ stage:'act_reward', title:'Награда за завершение акта', summary:'Выберите одну крупную награду. Политический режим не определяет состав предложений.', choices:[] });
  if(finale.stage==='interact') return deepFreeze({ stage:'interact', title:'Состояние кампании', summary:'Железные Марши завершены. Проверьте наследие, поддержку и армию перед переходом.', government:GOVERNMENTS[finale.governmentId], legacy:finale.lawOffers.find((entry)=>entry.id===finale.legacyLawId)||null, support:finale.support, choices:[{ id:'interact_continue', title:'К следующему акту', consequence:'Завершить межактовый экран.', available:true }] });
  return deepFreeze({ stage:finale.stage, title:'Политический финал', summary:'Финал завершён.', choices:[] });
}

module.exports={ B14_FORMAT,B14_SCHEMA_VERSION,FORCE_IDS,GOVERNMENT_IDS,FORCE_DEFINITIONS,GOVERNMENTS,COALITION_RULES,LAW_POOLS,deriveForceStates,coalitionAnalysis,availableGovernments,materializeLaws,buildEpilogue,createPoliticalFinale,currentCabinetDemand,cabinetChoices,resolveCabinet,chooseGovernment,chooseLaw,finishEpilogue,finishActReward,completeFinale,finaleSurface };
