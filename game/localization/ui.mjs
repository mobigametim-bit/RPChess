export const LANGUAGES = Object.freeze([
  Object.freeze({ code: 'ru', label: 'Русский' }),
  Object.freeze({ code: 'en', label: 'English' })
]);

export const UI_MESSAGES = Object.freeze({
  ru: Object.freeze({
    'menu.ariaLabel': 'Главное меню RPChess',
    'menu.actionsLabel': 'Главное меню',
    'menu.newGame': 'Новая игра',
    'menu.continue': 'Продолжить',
    'menu.settings': 'Настройки',
    'menu.language': 'Язык',
    'settings.title': 'Настройки',
    'settings.close': 'Закрыть настройки',
    'settings.music': 'Музыка',
    'settings.sfx': 'Звуки',
    'settings.reducedMotion': 'Уменьшить анимации',
    'language.kicker': 'ЯЗЫК',
    'language.title': 'Язык',
    'language.close': 'Закрыть выбор языка',
    'language.optionsLabel': 'Доступные языки',
    'language.current': 'Выбран: {language}',
    'common.back': 'Назад'
  }),
  en: Object.freeze({
    'menu.ariaLabel': 'RPChess main menu',
    'menu.actionsLabel': 'Main menu',
    'menu.newGame': 'New Game',
    'menu.continue': 'Continue',
    'menu.settings': 'Settings',
    'menu.language': 'Language',
    'settings.title': 'Settings',
    'settings.close': 'Close settings',
    'settings.music': 'Music',
    'settings.sfx': 'Sound',
    'settings.reducedMotion': 'Reduce motion',
    'language.kicker': 'LANGUAGE',
    'language.title': 'Language',
    'language.close': 'Close language selection',
    'language.optionsLabel': 'Available languages',
    'language.current': 'Selected: {language}',
    'common.back': 'Back'
  })
});
