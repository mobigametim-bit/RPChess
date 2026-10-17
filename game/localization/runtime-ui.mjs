const RU = Object.freeze({
  'identity.kicker':'НОВЫЙ ПОХОД','identity.title':'Кто ты, воин?','identity.close':'Закрыть','identity.copy':'Это имя будет вписано в события и Летопись похода.','identity.name':'ИМЯ','identity.continue':'ПРОДОЛЖИТЬ','identity.error':'Введите имя.','identity.choosePortrait':'ВЫБЕРИТЕ ОБЛИК ПОЛКОВОДЦА',
  'chronicle.ariaLabel':'Летопись походов','chronicle.title':'Летопись','chronicle.current':'ТЕКУЩИЙ ПОХОД','chronicle.noActive':'Нет активного похода','chronicle.best':'ЛУЧШИЙ ПОХОД','chronicle.emptyKicker':'ЛУЧШАЯ ЛЕТОПИСЬ','chronicle.emptyTitle':'Летопись пуста','chronicle.emptyCopy':'Ни одно имя ещё не вписано в её страницы.','chronicle.power':'МОЩЬ','chronicle.week':'НЕДЕЛЯ','chronicle.heroes':'ГЕРОЕВ В СТРОЮ','chronicle.glory':'СЛАВА', 'chronicle.commanders':'Великие полководцы', 'leaderboard.yourRank':'ВАШЕ МЕСТО', 'leaderboard.notRanked':'Нет результата', 'leaderboard.notAuthenticated':'VK не подтверждён', 'leaderboard.top10':'Десять лучших игроков', 'leaderboard.empty':'Пока нет результатов', 'leaderboard.offline':'Рейтинг временно недоступен', 'leaderboard.unavailable':'Онлайн-рейтинг пока не подключён',
  'endless.ariaLabel':'Итоги забега','endless.kicker':'ПУТЕШЕСТВИЕ ОКОНЧЕНО','endless.title':'ЗАБЕГ ЗАВЕРШЁН','endless.metricsAria':'Статистика завершённого забега','endless.metric.weeks':'НЕДЕЛЬ В ПУТИ','endless.metric.goldEarned':'ЗАРАБОТАНО ЗОЛОТА','endless.metric.skirmishWins':'ПОБЕД В СТЫЧКАХ','endless.metric.battleWins':'ПОБЕД В БИТВАХ','endless.metric.caravansDefended':'ЗАЩИЩЕНО КАРАВАНОВ','endless.metric.puzzlesSolved':'РЕШЕНО ЗАДАЧ','endless.metric.eventsResolved':'ПРОЙДЕНО СОБЫТИЙ','endless.metric.heroesRecruited':'НАНЯТО ГЕРОЕВ','endless.metric.finalPower':'ИТОГОВАЯ МОЩЬ','endless.newGame':'НОВАЯ ИГРА','endless.menu':'ГЛАВНОЕ МЕНЮ',
  'power.label':'МОЩЬ','power.threat':'УГРОЗА {stars}',
  'ux.resource.gold':'{amount} золота','ux.resource.supplyOne':'{amount} припас','ux.resource.supplyMany':'{amount} припасов','ux.board.ranks':'Горизонтали доски','ux.board.files':'Вертикали доски','ux.combat.battle':'Битва','ux.combat.skirmish':'Стычка'
});

const EN = Object.freeze({
  'identity.kicker':'NEW JOURNEY','identity.title':'Who are you, warrior?','identity.close':'Close','identity.copy':'This name will appear in events and your journey chronicle.','identity.name':'NAME','identity.continue':'CONTINUE','identity.error':'Enter a name.','identity.choosePortrait':'CHOOSE YOUR COMMANDER',
  'chronicle.ariaLabel':'Journey chronicle','chronicle.title':'Chronicle','chronicle.current':'CURRENT JOURNEY','chronicle.noActive':'No active journey','chronicle.best':'BEST JOURNEY','chronicle.emptyKicker':'BEST CHRONICLE','chronicle.emptyTitle':'The chronicle is empty','chronicle.emptyCopy':'No name has yet been written on its pages.','chronicle.power':'POWER','chronicle.week':'WEEK','chronicle.heroes':'HEROES IN RANKS','chronicle.glory':'GLORY', 'chronicle.commanders':'Great Commanders', 'leaderboard.yourRank':'YOUR RANK', 'leaderboard.notRanked':'Not ranked yet', 'leaderboard.notAuthenticated':'VK not verified', 'leaderboard.top10':'Top ten players', 'leaderboard.empty':'No results yet', 'leaderboard.offline':'Leaderboard temporarily unavailable', 'leaderboard.unavailable':'Online leaderboard is not connected yet',
  'endless.ariaLabel':'Run summary','endless.kicker':'JOURNEY ENDED','endless.title':'RUN COMPLETE','endless.metricsAria':'Completed run statistics','endless.metric.weeks':'WEEKS TRAVELLED','endless.metric.goldEarned':'GOLD EARNED','endless.metric.skirmishWins':'SKIRMISH WINS','endless.metric.battleWins':'BATTLE WINS','endless.metric.caravansDefended':'CARAVANS DEFENDED','endless.metric.puzzlesSolved':'PUZZLES SOLVED','endless.metric.eventsResolved':'EVENTS RESOLVED','endless.metric.heroesRecruited':'HEROES RECRUITED','endless.metric.finalPower':'FINAL POWER','endless.newGame':'NEW GAME','endless.menu':'MAIN MENU',
  'power.label':'POWER','power.threat':'THREAT {stars}',
  'ux.resource.gold':'{amount} gold','ux.resource.supplyOne':'{amount} supply','ux.resource.supplyMany':'{amount} supplies','ux.board.ranks':'Board ranks','ux.board.files':'Board files','ux.combat.battle':'Battle','ux.combat.skirmish':'Skirmish'
});

export const RUNTIME_UI_MESSAGES = Object.freeze({ ru: RU, en: EN });

function interpolate(message, params = {}) {
  return String(message).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}

export function runtimeT(language, key, params = {}) {
  const normalized = language === 'en' ? 'en' : 'ru';
  const message = RUNTIME_UI_MESSAGES[normalized]?.[key] ?? RUNTIME_UI_MESSAGES.ru[key];
  return message === undefined ? `[missing:${key}]` : interpolate(message, params);
}
