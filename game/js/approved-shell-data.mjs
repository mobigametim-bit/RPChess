const PROTOTYPE_ASSET_ROOT = 'generated_assets';

const COMMANDERS = Object.freeze([
  Object.freeze({
    id: 'warlord', name: 'Полководец', nameEn: 'Warlord', unlock: 0,
    heroId: 'hero.aldric_wall', heroName: 'Альдрик Стена',
    portrait: `${PROTOTYPE_ASSET_ROOT}/commander_warlord.png`,
    description: 'Надёжный командир передовой. Начинает поход с ветераном-защитником и прямолинейной тактикой удержания строя.',
    descriptionEn: 'A dependable frontline commander who begins with a veteran protector and formation-focused tactics.',
    kingId: 'king.oathkeeper', doctrineId: 'doctrine.fortress'
  }),
  Object.freeze({
    id: 'necromancer', name: 'Некромант', nameEn: 'Necromancer', unlock: 1,
    heroId: 'hero.mara_chain', heroName: 'Мара Цепь',
    portrait: `${PROTOTYPE_ASSET_ROOT}/commander_necromancer.png`,
    description: 'Командир истощения и пешечных построений. Открывается после первого крупного открытия в походах.',
    descriptionEn: 'An attrition and pawn-formation commander unlocked after the first major campaign discovery.',
    kingId: 'king.oathkeeper', doctrineId: 'doctrine.fortress'
  }),
  Object.freeze({
    id: 'engineer', name: 'Рунный мастер', nameEn: 'Runesmith', unlock: 2,
    heroId: 'hero.brother_orell', heroName: 'Брат Орелл',
    portrait: `${PROTOTYPE_ASSET_ROOT}/commander_engineer.png`,
    description: 'Строит временные преграды и меняет геометрию поля. Требует двух открытий в событиях, лавках или завершённых походах.',
    descriptionEn: 'Builds temporary obstacles and changes board geometry. Requires two discoveries from events, shops or completed runs.',
    kingId: 'king.oathkeeper', doctrineId: 'doctrine.fortress'
  }),
  Object.freeze({
    id: 'psionic', name: 'Провидец', nameEn: 'Seer', unlock: 3,
    heroId: 'hero.vael_hammer', heroName: 'Ваэль Молот',
    portrait: `${PROTOTYPE_ASSET_ROOT}/commander_psionic.png`,
    description: 'Предсказывает маршрут тяжёлой кавалерии и заранее показывает последствия натиска.',
    descriptionEn: 'Forecasts heavy cavalry routes and previews the consequences of a charge.',
    kingId: 'king.oathkeeper', doctrineId: 'doctrine.fortress'
  }),
  Object.freeze({
    id: 'chronicler', name: 'Хронист', nameEn: 'Chronicler', unlock: 5,
    heroId: 'hero.lady_sorn', heroName: 'Леди Сорн',
    portrait: `${PROTOTYPE_ASSET_ROOT}/commander_chronicler.png`,
    description: 'Политический тактик, связывающий противника обязательствами и последствиями решений.',
    descriptionEn: 'A political tactician who binds enemies through obligations and consequences.',
    kingId: 'king.oathkeeper', doctrineId: 'doctrine.fortress'
  }),
  Object.freeze({
    id: 'aggressor', name: 'Берсерк', nameEn: 'Berserker', unlock: 7,
    heroId: 'hero.tomas_gate', heroName: 'Томас Вратарь',
    portrait: `${PROTOTYPE_ASSET_ROOT}/commander_aggressor.png`,
    description: 'Сценарный командир прорыва, управляющий воротами и быстрым изменением линии фронта.',
    descriptionEn: 'A breakthrough commander who controls gates and rapidly changes the frontline.',
    kingId: 'king.oathkeeper', doctrineId: 'doctrine.fortress'
  })
]);

const NODE_ART = Object.freeze({
  start: `${PROTOTYPE_ASSET_ROOT}/node_story.png`,
  battle: `${PROTOTYPE_ASSET_ROOT}/node_battle.png`,
  elite: `${PROTOTYPE_ASSET_ROOT}/node_elite.png`,
  event: `${PROTOTYPE_ASSET_ROOT}/node_event.png`,
  shop: `${PROTOTYPE_ASSET_ROOT}/node_shop.png`,
  service: `${PROTOTYPE_ASSET_ROOT}/node_repair.png`,
  treasure: `${PROTOTYPE_ASSET_ROOT}/node_vault.png`,
  boss: `${PROTOTYPE_ASSET_ROOT}/node_boss.png`
});

const SCENE_ART = Object.freeze({
  campaign: `${PROTOTYPE_ASSET_ROOT}/scene_campaign.jpg`,
  battle: `${PROTOTYPE_ASSET_ROOT}/scene_battle.jpg`,
  event: `${PROTOTYPE_ASSET_ROOT}/scene_event.jpg`,
  reward: `${PROTOTYPE_ASSET_ROOT}/scene_reward.jpg`,
  settings: `${PROTOTYPE_ASSET_ROOT}/scene_settings.jpg`,
  achievements: `${PROTOTYPE_ASSET_ROOT}/scene_achievements.jpg`,
  codex: `${PROTOTYPE_ASSET_ROOT}/scene_codex.jpg`,
  victory: `${PROTOTYPE_ASSET_ROOT}/scene_victory.jpg`,
  defeat: `${PROTOTYPE_ASSET_ROOT}/scene_defeat.jpg`,
  shop: `${PROTOTYPE_ASSET_ROOT}/scene_shop.jpg`,
  service: `${PROTOTYPE_ASSET_ROOT}/scene_repair.jpg`
});

const UNIT_ART = Object.freeze({
  w: Object.freeze({
    p: `${PROTOTYPE_ASSET_ROOT}/unit_pawn_player.png`,
    n: `${PROTOTYPE_ASSET_ROOT}/unit_knight_player.png`,
    b: `${PROTOTYPE_ASSET_ROOT}/unit_bishop_player.png`,
    r: `${PROTOTYPE_ASSET_ROOT}/unit_rook_player.png`,
    q: `${PROTOTYPE_ASSET_ROOT}/unit_queen_player.png`,
    k: `${PROTOTYPE_ASSET_ROOT}/unit_king_player.png`
  }),
  b: Object.freeze({
    p: `${PROTOTYPE_ASSET_ROOT}/unit_pawn_enemy.png`,
    n: `${PROTOTYPE_ASSET_ROOT}/unit_knight_enemy.png`,
    b: `${PROTOTYPE_ASSET_ROOT}/unit_bishop_enemy.png`,
    r: `${PROTOTYPE_ASSET_ROOT}/unit_rook_enemy.png`,
    q: `${PROTOTYPE_ASSET_ROOT}/unit_queen_enemy.png`,
    k: `${PROTOTYPE_ASSET_ROOT}/unit_king_enemy.png`
  })
});

const STATUS_LABELS = Object.freeze({
  ward: 'Защита от первого взятия',
  warded: 'Защита от первого взятия',
  evasion: 'Уклонение от следующей атаки',
  guarded: 'Под защитой Альдрика',
  offered: 'Добровольная жертва',
  bound: 'Связан тактикой заложника',
  primary: 'Боевой эффект',
  cursed: 'Проклят',
  marked: 'Отмечен',
  provoked: 'Спровоцирован',
  silenced: 'Способности подавлены'
});

const FAILURE_LABELS = Object.freeze({
  'failure.lose_oathkeeper': 'Мат вашему королю',
  'failure.lose_oathkeeper_elite': 'Мат вашему королю',
  'failure.lose_oathkeeper_boss': 'Мат вашему королю',
  'failure.lose_chain': 'Мара Цепь погибла',
  'failure.lose_tomas': 'Томас Вратарь погиб',
  'failure.diagonal_action_limit': 'Лимит действий исчерпан',
  'failure.outpost_action_limit': 'Лимит действий исчерпан',
  'failure.seal_phase_limit': 'Печать не разрушена вовремя',
  'failure.collapse_limit': 'Поле разрушилось до завершения боя'
});

const OBJECTIVE_LABELS = Object.freeze({
  checkmate: 'Поставьте мат вражескому королю',
  capture_targets: 'Возьмите отмеченные фигуры',
  escort: 'Проведите героя к цели',
  occupy_cells: 'Займите отмеченные клетки',
  survive_actions: 'Продержитесь указанное число действий'
});

function commanderById(id) {
  return COMMANDERS.find((item) => item.id === id) || COMMANDERS[0];
}

function commanderForHero(heroId) {
  return COMMANDERS.find((item) => item.heroId === heroId) || null;
}

function unlockedCommanders(progress = {}) {
  const points = Math.max(0, Number(progress.unlockPoints || 0));
  return Object.freeze(COMMANDERS.filter((item) => points >= item.unlock));
}

function nodeArt(type) {
  return NODE_ART[type] || NODE_ART.event;
}

function sceneArt(type) {
  return SCENE_ART[type] || SCENE_ART.campaign;
}

function unitArt(piece) {
  return UNIT_ART[piece?.side]?.[piece?.type] || null;
}

function humanStatus(value) {
  const id = String(value || '').split(':')[0];
  return STATUS_LABELS[id] || id.replace(/[._-]+/g, ' ');
}

function humanFailure(item = {}) {
  if (FAILURE_LABELS[item.id]) return FAILURE_LABELS[item.id];
  if (item.type === 'piece_lost') return 'Не потеряйте защищаемого героя';
  if (item.type === 'action_limit') return 'Завершите бой до истечения лимита действий';
  return item.label || 'Не допустите поражения';
}

function humanObjective(item = {}) {
  return item.label && !/^objective\./.test(item.label) ? item.label : OBJECTIVE_LABELS[item.type] || item.label || 'Выполните задачу боя';
}

export {
  PROTOTYPE_ASSET_ROOT,
  COMMANDERS,
  NODE_ART,
  SCENE_ART,
  UNIT_ART,
  STATUS_LABELS,
  FAILURE_LABELS,
  OBJECTIVE_LABELS,
  commanderById,
  commanderForHero,
  unlockedCommanders,
  nodeArt,
  sceneArt,
  unitArt,
  humanStatus,
  humanFailure,
  humanObjective
};
