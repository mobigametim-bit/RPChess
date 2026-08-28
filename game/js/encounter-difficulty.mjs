const DIFFICULTY_LEVELS = Object.freeze([
  Object.freeze({ stars: 1, elo: 400, label: 'Новичок I', tactic: 'Растерянный', threat: 'ОЧЕНЬ НИЗКАЯ' }),
  Object.freeze({ stars: 2, elo: 600, label: 'Новичок II', tactic: 'Неопытный', threat: 'НИЗКАЯ' }),
  Object.freeze({ stars: 3, elo: 800, label: 'Любитель', tactic: 'Осторожный', threat: 'УМЕРЕННАЯ' }),
  Object.freeze({ stars: 4, elo: 1000, label: 'Любитель+', tactic: 'Собранный', threat: 'ЗАМЕТНАЯ' }),
  Object.freeze({ stars: 5, elo: 1200, label: 'Клубный новичок', tactic: 'Уверенный', threat: 'СЕРЬЁЗНАЯ' }),
  Object.freeze({ stars: 6, elo: 1400, label: 'Клубный', tactic: 'Опытный', threat: 'ОПАСНАЯ' }),
  Object.freeze({ stars: 7, elo: 1600, label: 'Сильный клубный', tactic: 'Агрессивный', threat: 'ВЫСОКАЯ' }),
  Object.freeze({ stars: 8, elo: 1800, label: 'Эксперт', tactic: 'Расчётливый', threat: 'ОЧЕНЬ ВЫСОКАЯ' }),
  Object.freeze({ stars: 9, elo: 2000, label: 'Мастерский', tactic: 'Безжалостный', threat: 'СМЕРТЕЛЬНАЯ' }),
  Object.freeze({ stars: 10, elo: 2200, label: 'Мастер+', tactic: 'Мастерский', threat: 'КРИТИЧЕСКАЯ' }),
  Object.freeze({ stars: 11, elo: 2400, label: 'Очень сильный', tactic: 'Неумолимый', threat: 'ЧУДОВИЩНАЯ' }),
  Object.freeze({ stars: 12, elo: 2600, label: 'Гроссмейстер', tactic: 'Совершенный', threat: 'ЛЕГЕНДАРНАЯ' })
]);

const MAX_ENCOUNTER_STARS = 12;
const MIN_ENCOUNTER_STARS = 1;

function clampStars(value) {
  return Math.max(MIN_ENCOUNTER_STARS, Math.min(MAX_ENCOUNTER_STARS, Math.round(Number(value) || MIN_ENCOUNTER_STARS)));
}

function difficultyForStars(stars) {
  return DIFFICULTY_LEVELS[clampStars(stars) - 1];
}

function starsText(stars) {
  return '★'.repeat(clampStars(stars));
}

export { DIFFICULTY_LEVELS, MIN_ENCOUNTER_STARS, MAX_ENCOUNTER_STARS, clampStars, difficultyForStars, starsText };
