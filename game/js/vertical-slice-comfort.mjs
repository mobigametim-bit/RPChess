const HELP_STORAGE_KEY = 'rpchess.vertical-slice.help.seen.v1';

const HELP_COPY = Object.freeze({
  ru: Object.freeze({
    button: 'Открыть помощь по прохождению',
    title: 'Как проходить вертикальный срез',
    intro: 'Весь прогресс сохраняется автоматически в выбранном профиле. Интерфейс показывает только легальные ходы и доступные действия.',
    close: 'Закрыть помощь',
    accept: 'Понятно, начать игру',
    saved: 'Подсказку всегда можно снова открыть кнопкой «?» в левом нижнем углу.',
    steps: Object.freeze([
      ['1. Выберите профиль', 'Можно вести три независимых похода. Кнопка «Продолжить» восстанавливает точное состояние, включая расстановку и бой.'],
      ['2. Соберите отряд', 'Выберите короля, доктрину и героев. Счётчик в верхней части показывает, сколько героев уже входит в отряд.'],
      ['3. Играйте на доске', 'Нажмите фигуру, затем подсвеченную клетку. Способности и резерв находятся в правой панели; рядом всегда указана стоимость в очках приказов.'],
      ['4. Следуйте цели', 'В каждом бою читайте блок цели. После победы заберите награду и продолжите путь по карте до двух фаз Железного Регента.']
    ]),
    hints: Object.freeze({
      profiles: 'Выберите профиль. Сохранения независимы и восстанавливаются после перезагрузки.',
      selection: 'Соберите отряд: король → доктрина → герои. Затем нажмите «Начать поход».',
      runtime: 'Выбирайте фигуры и действия. Все показанные команды уже проверены правилами игры.',
      loading: 'Подготавливается поход…'
    })
  }),
  en: Object.freeze({
    button: 'Open play guide',
    title: 'How to play the vertical slice',
    intro: 'Progress is saved automatically in the selected profile. The interface exposes only legal moves and available actions.',
    close: 'Close guide',
    accept: 'Got it, start playing',
    saved: 'You can reopen this guide with the “?” button in the lower-left corner.',
    steps: Object.freeze([
      ['1. Choose a profile', 'Three independent campaigns are available. Continue restores the exact deployment and battle state.'],
      ['2. Build the army', 'Choose a king, doctrine and heroes. The header counter shows how many heroes are selected.'],
      ['3. Use the board', 'Select a piece, then a highlighted square. Abilities and reserve actions are in the side panel with their order-point cost.'],
      ['4. Follow the objective', 'Read the objective panel in every battle. Claim rewards and follow the campaign map through both Iron Regent phases.']
    ]),
    hints: Object.freeze({
      profiles: 'Choose a profile. Each save is independent and survives a page reload.',
      selection: 'Build the army: king → doctrine → heroes. Then press Start campaign.',
      runtime: 'Select pieces and actions. Every displayed command has already passed game-rule validation.',
      loading: 'Preparing the campaign…'
    })
  })
});

function languageFor(document = globalThis.document) {
  return document?.documentElement?.lang === 'en' ? 'en' : 'ru';
}

function helpCopy(language = 'ru') {
  return HELP_COPY[language === 'en' ? 'en' : 'ru'];
}

function helpMarkup(language = 'ru') {
  const copy = helpCopy(language);
  return `<div class="rpcomfort__scrim" data-rpcomfort-close></div>
    <section class="rpcomfort__window" role="dialog" aria-modal="true" aria-labelledby="rpcomfort-title" tabindex="-1">
      <header class="rpcomfort__header">
        <div><h2 id="rpcomfort-title">${copy.title}</h2><p>${copy.intro}</p></div>
        <button class="rpcomfort__close" type="button" data-rpcomfort-close aria-label="${copy.close}">×</button>
      </header>
      <div class="rpcomfort__steps">${copy.steps.map(([title, body]) => `<article class="rpcomfort__step"><b>${title}</b><p>${body}</p></article>`).join('')}</div>
      <footer class="rpcomfort__footer"><small>${copy.saved}</small><button class="rpcomfort__accept" type="button" data-rpcomfort-accept>${copy.accept}</button></footer>
    </section>`;
}

function screenNameFromRoot(root) {
  if (!root || typeof root.querySelector !== 'function') return 'loading';
  if (root.querySelector('.rpprofile')) return 'profiles';
  if (root.querySelector('.rprs')) return 'selection';
  if (root.querySelector('.rpvs')) return 'runtime';
  return 'loading';
}

function safeStorage(storage = undefined) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage || null; } catch (_error) { return null; }
}

function rememberHelpSeen(storage) {
  try { storage?.setItem?.(HELP_STORAGE_KEY, '1'); } catch (_error) {}
}

function helpWasSeen(storage) {
  try { return storage?.getItem?.(HELP_STORAGE_KEY) === '1'; } catch (_error) { return false; }
}

function installComfortUi(options = {}) {
  const document = options.document || globalThis.document;
  if (!document?.body || document.getElementById('rpcomfort-host')) return null;
  const root = options.root || document.getElementById('app');
  const language = options.language || languageFor(document);
  const copy = helpCopy(language);
  const storage = safeStorage(options.storage);
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'rpcomfort-help-button';
  trigger.className = 'rpcomfort-help-button';
  trigger.setAttribute('aria-label', copy.button);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.textContent = '?';

  const host = document.createElement('div');
  host.id = 'rpcomfort-host';
  host.className = 'rpcomfort';
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = helpMarkup(language);

  const hint = document.createElement('div');
  hint.className = 'rpcomfort-screen-hint';
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-live', 'polite');

  let previousFocus = null;
  const setOpen = (open) => {
    host.classList.toggle('is-open', open);
    host.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('rpcomfort-help-open', open);
    if (open) {
      previousFocus = document.activeElement;
      host.querySelector('.rpcomfort__window')?.focus();
    } else {
      rememberHelpSeen(storage);
      previousFocus?.focus?.();
    }
  };

  const updateScreen = () => {
    const screen = screenNameFromRoot(root);
    document.body.dataset.rpcomfortScreen = screen;
    hint.textContent = copy.hints[screen] || copy.hints.loading;
    const controls = root?.querySelectorAll?.('button,a,input,select,textarea') || [];
    for (const control of controls) {
      const text = String(control.textContent || control.getAttribute?.('aria-label') || '').trim();
      if (!control.getAttribute?.('aria-label') && text) control.setAttribute('aria-label', text);
    }
  };

  trigger.addEventListener('click', () => setOpen(true));
  host.querySelectorAll('[data-rpcomfort-close]').forEach((element) => element.addEventListener('click', () => setOpen(false)));
  host.querySelector('[data-rpcomfort-accept]')?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && host.classList.contains('is-open')) setOpen(false);
  });

  document.body.append(trigger, hint, host);
  updateScreen();
  const observer = typeof MutationObserver === 'function' && root
    ? new MutationObserver(() => queueMicrotask(updateScreen))
    : null;
  observer?.observe(root, { childList: true, subtree: true });

  const forceHelp = (() => {
    try { return new URLSearchParams(globalThis.location?.search || '').get('help') === '1'; } catch (_error) { return false; }
  })();
  if (forceHelp || !helpWasSeen(storage)) queueMicrotask(() => setOpen(true));

  return Object.freeze({
    host,
    trigger,
    hint,
    observer,
    open: () => setOpen(true),
    close: () => setOpen(false),
    updateScreen,
    destroy: () => { observer?.disconnect(); trigger.remove(); hint.remove(); host.remove(); }
  });
}

if (typeof document !== 'undefined') {
  const boot = () => installComfortUi();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}

export {
  HELP_STORAGE_KEY,
  HELP_COPY,
  languageFor,
  helpCopy,
  helpMarkup,
  screenNameFromRoot,
  safeStorage,
  rememberHelpSeen,
  helpWasSeen,
  installComfortUi
};
