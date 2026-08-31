const DIFFICULTY_LEVELS = Object.freeze([
  Object.freeze({ stars: 1, elo: 400, label: 'Растерянный Новобранец', tactic: 'Растерянный', threat: 'ОЧЕНЬ НИЗКАЯ' }),
  Object.freeze({ stars: 2, elo: 600, label: 'Неопытный Ополченец', tactic: 'Неопытный', threat: 'НИЗКАЯ' }),
  Object.freeze({ stars: 3, elo: 800, label: 'Осторожный Ратник', tactic: 'Осторожный', threat: 'УМЕРЕННАЯ' }),
  Object.freeze({ stars: 4, elo: 1000, label: 'Собранный Дружинник', tactic: 'Собранный', threat: 'ЗАМЕТНАЯ' }),
  Object.freeze({ stars: 5, elo: 1200, label: 'Уверенный Ветеран', tactic: 'Уверенный', threat: 'СЕРЬЁЗНАЯ' }),
  Object.freeze({ stars: 6, elo: 1400, label: 'Опытный Сотник', tactic: 'Опытный', threat: 'ОПАСНАЯ' }),
  Object.freeze({ stars: 7, elo: 1600, label: 'Агрессивный Капитан Стражи', tactic: 'Агрессивный', threat: 'ВЫСОКАЯ' }),
  Object.freeze({ stars: 8, elo: 1800, label: 'Расчётливый Воевода', tactic: 'Расчётливый', threat: 'ОЧЕНЬ ВЫСОКАЯ' }),
  Object.freeze({ stars: 9, elo: 2000, label: 'Безжалостный Полководец', tactic: 'Безжалостный', threat: 'СМЕРТЕЛЬНАЯ' }),
  Object.freeze({ stars: 10, elo: 2200, label: 'Мастерский Верховный Маршал', tactic: 'Мастерский', threat: 'КРИТИЧЕСКАЯ' }),
  Object.freeze({ stars: 11, elo: 2400, label: 'Неумолимый Лорд-Командующий', tactic: 'Неумолимый', threat: 'ЧУДОВИЩНАЯ' }),
  Object.freeze({ stars: 12, elo: 2600, label: 'Совершенный Тиран', tactic: 'Совершенный', threat: 'ЛЕГЕНДАРНАЯ' })
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
  const count = clampStars(stars);
  const value = '★'.repeat(count);
  // Keep all 12 levels readable on narrow cards. The zero-width break is
  // invisible on roomy layouts, but gives the browser one deterministic
  // fallback point after six stars, producing a clean 6 + 6 mobile wrap.
  return count > 6 ? `${value.slice(0, 6)}\u200B${value.slice(6)}` : value;
}

export { DIFFICULTY_LEVELS, MIN_ENCOUNTER_STARS, MAX_ENCOUNTER_STARS, clampStars, difficultyForStars, starsText };
