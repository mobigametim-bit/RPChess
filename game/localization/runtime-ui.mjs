const RU = Object.freeze({
  'endless.ariaLabel':'Итоги забега','endless.kicker':'ПУТЕШЕСТВИЕ ОКОНЧЕНО','endless.title':'ЗАБЕГ ЗАВЕРШЁН','endless.metricsAria':'Статистика завершённого забега','endless.metric.weeks':'НЕДЕЛЬ В ПУТИ','endless.metric.goldEarned':'ЗАРАБОТАНО ЗОЛОТА','endless.metric.skirmishWins':'ПОБЕД В СТЫЧКАХ','endless.metric.battleWins':'ПОБЕД В БИТВАХ','endless.metric.puzzlesSolved':'РЕШЕНО ЗАДАЧ','endless.metric.eventsResolved':'ПРОЙДЕНО СОБЫТИЙ','endless.metric.heroesRecruited':'НАНЯТО ГЕРОЕВ','endless.metric.finalPower':'ИТОГОВАЯ МОЩЬ','endless.newGame':'НОВАЯ ИГРА','endless.menu':'ГЛАВНОЕ МЕНЮ',
  'power.label':'МОЩЬ','power.threat':'УГРОЗА {stars}',
  'ux.resource.gold':'{amount} золота','ux.resource.supplyOne':'{amount} припас','ux.resource.supplyMany':'{amount} припасов','ux.board.ranks':'Горизонтали доски','ux.board.files':'Вертикали доски','ux.combat.battle':'Битва','ux.combat.skirmish':'Стычка'
});

const EN = Object.freeze({
  'endless.ariaLabel':'Run summary','endless.kicker':'JOURNEY ENDED','endless.title':'RUN COMPLETE','endless.metricsAria':'Completed run statistics','endless.metric.weeks':'WEEKS TRAVELLED','endless.metric.goldEarned':'GOLD EARNED','endless.metric.skirmishWins':'SKIRMISH WINS','endless.metric.battleWins':'BATTLE WINS','endless.metric.puzzlesSolved':'PUZZLES SOLVED','endless.metric.eventsResolved':'EVENTS RESOLVED','endless.metric.heroesRecruited':'HEROES RECRUITED','endless.metric.finalPower':'FINAL POWER','endless.newGame':'NEW GAME','endless.menu':'MAIN MENU',
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
